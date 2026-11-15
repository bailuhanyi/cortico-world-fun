/**
 * 娱乐时间 World。
 *
 * 她一直「有地方可去，但没有真的去成」：发动态、刷视频、逛客厅都是零碎的，
 * 没有一趟**有头有尾**的出门。这个 World 补的就是这一趟：
 *
 *   - `fun_places` 看今天哪几处开着、人多不多；
 *   - `fun_go` 进门，回执给当下的描写和能逛什么；
 *   - `fun_wander` 一处一处地逛：过山车、鲸豚湾、捞金鱼、同人展台；
 *   - 买纪念品、拍照点各有一个小口子（在 `fun_wander` 回执里递到嘴边）；
 *   - `fun_home` 收摊，回执把这一趟收成一句话，交给她 `feast_life_play` 记一笔。
 *
 * **不推事件、不开定时器**：什么时候出门由「鱼的每一天」的
 * `lifeFreeMenu` 那一行顺手一提，或者她自己 `fun_start`。
 * 这是刻意的——两套叫醒会互相抢时间轴，而联动本来靠的就是提示词。
 *
 * 状态是纯 JSON，落在 `<dataDir>/fun/state.json`；跨天整份重来。
 *
 * 红线（World 契约）：不调别的 World 的工具、不读别人的状态或日程文件、
 * `envPromptVars()` 永不抛错、`create()` 保持纯。
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { DEFAULTS, ID, configGroup, panelText, text } from './config.js';
import {
  CROWD_LABEL, KIND_LABEL, VENUES, allPlaces, findVenue, hasFood, hasScene, hoursState, suggestPlaces,
} from './venues.js';
import {
  areasNow, descNow, eventsNow, phaseLabelAt,
} from './phases.js';
import {
  buySouvenir, closeSession, dayIn, enterVenue, hmIn, isStale, minutesIn,
  newState, normalizeState, photoSpotsFor, recentPlaceIds, recordConsume,
  souvenirsFor, takePhoto, tripSummary, venueById, visitedText, wanderOnce,
} from './state.js';

const ENV_PROMPT = fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url));

const msg = (err) => (err instanceof Error ? err.message : String(err));

function clampInt(v, min, max, fallback) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

const STATE_LABEL = {
  open: '开着',
  closingSoon: '快关了',
  closed: '已经关了',
};

/** 排序用：开着的 0、快关的 1、关着的 2。 */
const rankOf = (state) => (state === 'open' ? 0 : (state === 'closingSoon' ? 1 : 2));
/** 工具声明（不含 handler）；describe 与 tools() 共用。 */
export const FUN_TOOL_DECLS = [
  {
    name: 'fun_places',
    tags: ['read', 'snapshot'],
    description: '看看今天能去哪儿逛：游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山、咖啡店、奶茶店、餐厅、图书馆、夜市、澡堂、旧货市场、江边，一共二十处。默认按这会儿开没开、人多不多排前几个；想看全的就把 all 填 true，只想看某一类就填 kind。',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'integer', description: '看几个，默认 4。', minimum: 1, maximum: 8 },
        kind: {
          type: 'string',
          description: '只看某一类。三档都认：某个大类（「吃饭喝东西」「户外」）、某种感受（「室内」「夜」「排队」「安静」「免费」「一个人」）、或者某一处的正名（「咖啡店」「猫咖」）。',
        },
        all: { type: 'boolean', description: '填 true 就列全部二十处（按开没开排序），不看 count。' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'fun_go',
    tags: ['write'],
    description: '进门：挑一处地方开始这一趟。回执是进门那一下看到的样子，以及接下来能逛什么。place 填地方名（游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山，别名也认）。进去之后用 fun_wander 一处一处逛，逛完用 fun_home 收摊。',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: '去哪儿，例如「漫展」「海洋馆」。' },
        company: { type: 'string', description: '跟谁一起去的，可选。一个人去就不填。' },
      },
      required: ['place'],
      additionalProperties: false,
    },
  },
  {
    name: 'fun_wander',
    tags: ['write'],
    description: '在逛的这处地方里逛一处：一个项目、一个摊位、一段路。回执会给这一处的细节和一条小事件，并顺手递上「要不要买点什么 / 在哪儿拍张照」。可以连着逛好几次。',
    parameters: {
      type: 'object',
      properties: {
        area: { type: 'string', description: '想逛哪一处，例如「过山车」「同人展台」。不填就自动挑一个还没逛过的。' },
        note: { type: 'string', description: '逛到那儿你干了什么，一句话，可选。' },
        buy: { type: 'string', description: '顺手买了什么纪念品，可选。填 souvenir 的名字。' },
        photo: { type: 'string', description: '在哪儿拍了张照，可选。填 photoSpot 的名字。' },
        consume: {
          type: 'string',
          description: '在咖啡店/奶茶店/餐厅吃了或喝了什么，可选。只能填这处地方真有的那几样。'
            + '**只记名字不记味道**：味道要用 feast_menu / feast_eat 去「鱼的每一天」里点，那里才有九维口感。',
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'fun_home',
    tags: ['write'],
    description: '收摊：这一趟到此为止。回执把「今天逛了什么、买了什么、在哪儿拍了照」收成一句话，提醒你用 feast_life_play 记进自己的日程，再跟主人说一句。note 可以写一句这一趟的感受。',
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: '这一趟怎么样，一句话，可选。' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'fun_start',
    tags: ['read'],
    description: '不用等叫醒：现在就想出门时用它。回执给能去哪儿、怎么进门，以及这一趟可以怎么走。拿到的和叫醒时那份是一个东西。',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'fun_view',
    tags: ['read', 'snapshot'],
    description: '纪念册：以前逛过哪些趟、每一趟逛了什么买了什么。想不起来上次去哪儿了就看这个。',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'integer', description: '看最近几趟，默认 5。', minimum: 1, maximum: 20 },
      },
      additionalProperties: false,
    },
  },
];

export class FunWorld {
  #host = null;
  #state = null;
  #started = false;
  #queue = Promise.resolve();
  #now;
  #random;
  #persist = null;
  #rawCfg = null;

  constructor(opts = {}) {
    this.id = ID;
    this.#rawCfg = opts.cfg ?? {};
    this.cfg = { ...DEFAULTS, ...this.#rawCfg };
    this.dataDir = opts.dataDir ?? process.cwd();
    this.language = 'zh';
    this.timezone = opts.timezone || 'Asia/Shanghai';
    this.#now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    this.#random = typeof opts.random === 'function' ? opts.random : Math.random;
    this.#persist = typeof opts.persist === 'function' ? opts.persist : null;
  }

  // -------------------------------------------------------------------------
  // 配置（热改：每次用时现读）
  // -------------------------------------------------------------------------

  #on() {
    const v = this.cfg?.funOn;
    return v === undefined || v === null ? Boolean(DEFAULTS.funOn) : Boolean(v);
  }

  #ttlMin() {
    return clampInt(this.cfg?.funSessionTTLMin, 15, 480, Number(DEFAULTS.funSessionTTLMin));
  }

  #askReport() {
    const v = this.cfg?.funAskReport;
    return v === undefined || v === null ? Boolean(DEFAULTS.funAskReport) : Boolean(v);
  }

  /**
   * 把 `worlds.fun` 段里缺的键补成默认值（启动时做一次）。
   *
   * 宿主的 `/api/config` 拿落盘的段**直接**渲染，不合并 defaults：
   *   boolean 缺 → 界面显示 false，而 World 自己按 true 在跑。
   * 只补缺的键，不覆盖用户已有的值；没有 persist 就跳过；绝不抛错。
   */
  #ensureConfigSection() {
    if (!this.#persist) return;
    try {
      const raw = this.#rawCfg ?? {};
      const patch = {};
      for (const [key, value] of Object.entries(DEFAULTS)) {
        if (key === 'enabled') continue;
        if (key in raw) continue;
        patch[key] = value;
      }
      if (!Object.keys(patch).length) return;
      this.#persist(patch);
      Object.assign(this.cfg, patch);
      Object.assign(raw, patch);
      this.#host?.log?.info?.('娱乐时间：配置段补齐了缺失的键', { keys: Object.keys(patch) });
    } catch (err) {
      this.#host?.log?.warn?.('娱乐时间：配置段没补齐（界面可能显示和实际不一致）', { err: msg(err) });
    }
  }

  stateFile() {
    return join(this.dataDir, 'fun', 'state.json');
  }

  // -------------------------------------------------------------------------
  // 提示词
  // -------------------------------------------------------------------------

  /**
   * 只放**一天变不了几次**的东西：十二处场所的正名与别名。
   *
   * 十二处全列细节会顶掉几百 token 的常驻前缀，所以这里**只列名字和别名**，
   * 细节留给 `fun_places` / `fun_go` 按需给。生图素材库里有的那几处后面带一句
   * 「scene 填「X」」；没有的不带——**不能让她以为每处都有 scene 可填**。
   *
   * 「此刻在逛哪儿」不进前缀——那是 `fun_wander` 和收摊回执的事。
   * 这个方法绝不能抛错：契约里抛错会把整个 World 卸载掉。
   */
  envPromptVars() {
    try {
      if (!this.#on()) return { fun_places_block: '' };
      const lines = ['（能去逛的地方：）'];
      for (const v of VENUES) {
        const alias = v.aliases.length ? `（也叫 ${v.aliases.slice(0, 3).join('、')}）` : '';
        const scene = hasScene(v) ? ` 生图 scene 填「${v.scene}」` : '';
        lines.push(`- ${v.name}${alias}${scene}`);
      }
      return { fun_places_block: lines.join('\n') };
    } catch (err) {
      this.#host?.log?.warn?.('娱乐时间：场所清单算不出来', { err: msg(err) });
      return { fun_places_block: '' };
    }
  }

  // -------------------------------------------------------------------------
  // 工具
  // -------------------------------------------------------------------------

  tools() {
    return FUN_TOOL_DECLS.map((decl) => ({
      ...decl,
      handler: (args) => this.#runTool(decl.name, args ?? {}),
    }));
  }

  #runTool(name, args) {
    return this.#serial(async () => {
      try {
        return await this.#tool(name, args);
      } catch (err) {
        return { text: `[${name} 失败] ${msg(err)}`, failed: true };
      }
    });
  }

  async #tool(name, args) {
    this.#ensureStarted();
    switch (name) {
      case 'fun_places': return this.#placesTool(args);
      case 'fun_go': return await this.#goTool(args);
      case 'fun_wander': return await this.#wanderTool(args);
      case 'fun_home': return await this.#homeTool(args);
      case 'fun_start': return this.#startTool();
      case 'fun_view': return this.#viewTool(args);
      default: return { text: `[${name} 失败] 不认识这个工具。`, failed: true };
    }
  }

  #placesTool(args) {
    const now = this.#now();
    const nowMin = minutesIn(this.timezone, now);
    const all = args?.all === true;
    const count = clampInt(args?.count, 1, 8, 4);
    const avoid = recentPlaceIds(this.#state, 2);

    // kind 三档都认：某种体验（室内 / 户外 / 夜 / 排队，走 tags）、
    // 某个大类（吃饭喝东西 / 户外，走 KIND_LABEL）、某一处正名或别名。
    // 以前只查 tags + KIND_LABEL，于是「咖啡」这种细类词筛不到咖啡店——现在 tags 补全了。
    const kindFilter = typeof args?.kind === 'string' ? args.kind.trim() : '';
    let picks;
    if (kindFilter) {
      const byName = findVenue(VENUES, kindFilter);
      // 「吃饭喝东西」按 hasFood 判，不只看 kind：夜市是 market 大类，但它也能吃。
      // 这样以后再加能吃喝的地方不用回来改筛选逻辑。
      const wantsFood = kindFilter === KIND_LABEL.food;
      const matched = byName
        ? [byName]
        : VENUES.filter((v) => (wantsFood ? hasFood(v) : false)
          || v.tags.includes(kindFilter)
          || KIND_LABEL[v.kind] === kindFilter
          || v.kind === kindFilter);
      if (!matched.length) {
        const kinds = [...new Set(Object.values(KIND_LABEL))].join(' / ');
        const tagHints = '室内 / 户外 / 夜 / 排队 / 安静';
        return { text: `没有「${kindFilter}」这一类。能填的是：${kinds}；或者感受类的 ${tagHints}；或者某一处的正名（咖啡店 / 猫咖 …）。` };
      }
      picks = matched
        .map((venue) => ({ venue, state: hoursState(venue, nowMin) }))
        .sort((a, b) => rankOf(a.state) - rankOf(b.state));
    } else {
      picks = all ? allPlaces(nowMin, avoid) : suggestPlaces(nowMin, count, avoid);
    }

    const lines = [`这会儿 ${hmIn(this.timezone, now)}，能去逛的：`];
    for (const { venue, state } of picks) {
      const bits = [`${venue.name}（${STATE_LABEL[state]}，${CROWD_LABEL[venue.crowd] || '人不少'}）`];
      bits.push(`${venue.hours.open}–${venue.hours.close}`);
      bits.push(`能逛：${venue.areas.slice(0, 5).join('、')}`);
      lines.push(`- ${bits.join('；')}`);
    }
    if (this.#state.session) {
      lines.push(`（你正在「${this.#state.session.placeName}」逛着，${visitedText(this.#state.session)}；要换地方先 fun_home 收个摊。）`);
    }
    if (!all && !kindFilter && VENUES.length > picks.length) {
      lines.push(`（一共 ${VENUES.length} 处，这里只排了 ${picks.length} 处；想看全的就 all 填 true，只想看室内/户外/夜就填 kind。）`);
    }
    lines.push('定了就用 fun_go（place 填地方名）进门。');
    return { text: lines.join('\n') };
  }

  async #goTool(args) {
    const now = this.#now();
    const day = dayIn(this.timezone, now);
    this.#state = normalizeState(this.#state, day);

    const venue = findVenue(VENUES, args?.place);
    if (!venue) {
      const names = VENUES.map((v) => v.name).join(' / ');
      return { text: `没听说过「${args?.place ?? ''}」这处。现在能去的是：${names}。\n（拿不准就 fun_places 看看，或者 all 填 true 列全部。）`, failed: true };
    }

    const state = hoursState(venue, minutesIn(this.timezone, now));
    const { session, already } = enterVenue(this.#state, venue, now, this.#random);
    if (already) {
      return {
        text: `你已经在「${this.#state.session.placeName}」逛着了（${visitedText(this.#state.session)}）。\n要么接着 fun_wander，要么 fun_home 收了再换地方。`,
      };
    }
    await this.#save();

    // 时段气氛：江边清早和夜里不是一回事，所以描写和可逛的项目都按此刻取。
    const nowMin = minutesIn(this.timezone, now);
    const label = phaseLabelAt(venue, nowMin);

    const lines = [`进了${venue.name}${label ? `（${label}）` : ''}。`, descNow(venue, nowMin)];
    if (args?.company) lines.push(`跟${String(args.company).slice(0, 40)}一起。`);
    if (state === 'closingSoon') lines.push(`（快到打烊时间了，${venue.hours.close} 就关，别排太长的队。）`);
    if (state === 'closed') lines.push(`（其实这会儿已经过了开放时段（${venue.hours.open}–${venue.hours.close}），当它开着逛也行，只是别写外头太亮。）`);
    lines.push(`能逛的：${areasNow(venue, nowMin).join('、')}。`);
    if (hasFood(venue)) {
      lines.push(`这儿还能${venue.food.verb}：${venue.food.items.join('、')}。`);
    }
    // 有分时段的场所，提醒一句「换个时间来是另一副样子」——这是这个世界最耐玩的地方。
    const phaseCount = Array.isArray(venue.phases) ? venue.phases.length : 0;
    if (phaseCount > 1) {
      const others = venue.phases.map((p) => p.label).join(' / ');
      lines.push(`（这里不同时段不一样：${others}。换个时间来是另一副样子。）`);
    }
    lines.push('一处一处来：fun_wander 逛一处（不填 area 就自动挑一个没逛过的），看到纪念品/拍照点会用得了。');
    return { text: lines.join('\n') };
  }

  async #wanderTool(args) {
    const now = this.#now();
    const day = dayIn(this.timezone, now);
    this.#state = normalizeState(this.#state, day);
    const session = this.#state.session;
    if (!session) {
      return { text: `你还没进门呢。先 fun_go 挑一处地方（${VENUES.slice(0, 4).map((v) => v.name).join(' / ')}…一共 ${VENUES.length} 处，fun_places 能看全），再一处一处逛。` };
    }
    const venue = venueById(session.placeId) ?? findVenue(VENUES, session.placeName);
    if (!venue) {
      return { text: `找不到「${session.placeName}」这处了（场所库改过？）。fun_home 收个摊吧。` };
    }

    // 挂太久的判断要在这一趟「动过之前」做：逛一次就会刷新 lastAt，
    // 事后判等于永远判不出来。上次动的时刻也先存下来，正文要用。
    const idleSince = session.lastAt;
    const staleBefore = isStale(session, now, this.#ttlMin());

    // 时段气氛：此刻能逛的项目和会碰到的小事件都跟着时段走。
    // 夜市刚开摊时只有几家摆好，快收的时候只剩最后几家——这些差异在这里生效。
    const nowMin = minutesIn(this.timezone, now);
    const phaseName = phaseLabelAt(venue, nowMin);
    const liveAreas = areasNow(venue, nowMin);
    const liveEvents = eventsNow(venue, nowMin);

    // 指定了没逛过的项目就用它，否则自动挑。
    const wanted = typeof args?.area === 'string' ? args.area.trim() : '';
    let area = wanted;
    let picked = null;
    if (wanted) {
      const hit = liveAreas.includes(wanted) ? wanted : liveAreas.find((a) => a.includes(wanted));
      area = hit ?? wanted;
      const evPool = liveEvents.filter((e) => !session.events.includes(e));
      const ev = evPool.length ? evPool[Math.floor(this.#random() * evPool.length) % evPool.length] : null;
      if (!session.visited.some((v) => v.area === area)) {
        session.visited.push({ area, note: String(args?.note ?? '').slice(0, 120), at: now });
      }
      session.lastAt = now;
      if (ev) session.events.push(ev);
      picked = { area, event: ev };
    } else {
      picked = wanderOnce(this.#state, venue, now, this.#random, liveAreas);
      if (!picked) {
        return { text: `${venue.name}这几处你都逛过了。${this.#homeHint()}` };
      }
      if (args?.note) {
        const last = session.visited[session.visited.length - 1];
        if (last) last.note = String(args.note).slice(0, 120);
      }
    }

    // 顺手买东西 / 拍照（同一个工具里两个小口子，少一个工具少一次往返）。
    //
    // 顺手买 / 拍照 / 吃点什么。三者都先判「这儿真有没有」再记，
    // 不然回执会先「买了：吧唧」又说「没记」。
    const buyName = typeof args?.buy === 'string' ? args.buy.trim() : '';
    const photoName = typeof args?.photo === 'string' ? args.photo.trim() : '';
    const eatName = typeof args?.consume === 'string' ? args.consume.trim() : '';
    const belongs = (list, name) => (list || []).some((x) => x.includes(name) || name.includes(x));

    const misfit = [];
    let bought = null;
    if (buyName) {
      if (belongs(venue.souvenirs, buyName)) bought = buySouvenir(this.#state, buyName, now);
      else misfit.push(`「${buyName}」不是${venue.name}的东西，没记`);
    }
    let shot = null;
    if (photoName) {
      if (belongs(venue.photoSpots, photoName)) shot = takePhoto(this.#state, photoName, now);
      else misfit.push(`「${photoName}」不是${venue.name}的拍照点，没记`);
    }
    // 吃了/喝了什么：只记「这处地方供得出来」的品类，且**只记名字不记味道**。
    let ate = null;
    if (eatName) {
      if (!hasFood(venue)) misfit.push(`${venue.name}没有能吃能喝的，没记`);
      else if (!belongs(venue.food.items, eatName)) misfit.push(`「${eatName}」不是${venue.name}有的，没记`);
      else ate = recordConsume(this.#state, venue, eatName, now);
    }
    await this.#save();

    const lines = [`${venue.name}${phaseName ? `（${phaseName}）` : ''} · ${picked.area}`, this.#areaLine(venue, picked.area, nowMin)];
    if (picked.event) lines.push(`——${picked.event}`);
    const last = session.visited[session.visited.length - 1];
    if (last?.note) lines.push(`（你记的：${last.note}）`);

    const spots = photoSpotsFor(session, venue);
    const goods = souvenirsFor(session, venue);
    if (bought) lines.push(bought.duplicate ? `（${bought.item} 你之前已经买过了。）` : `买了：${bought.item}。`);
    if (shot) lines.push(shot.duplicate ? `（${shot.spot} 已经拍过了。）` : `拍了张照：${shot.spot}。`);
    if (ate) lines.push(ate.duplicate ? `（${ate.item} 你这一趟已经${ate.verb}过了。）` : `${ate.verb}了：${ate.item}。`);
    for (const m of misfit) lines.push(`（${m}。）`);
    // 候选放在「已经做了什么」之后：先说她干的事，再给下一步的选项。
    if (spots.length) lines.push(`还能拍的：${spots.slice(0, 3).join('、')}。`);
    if (goods.length) lines.push(`还能买的：${goods.slice(0, 4).join('、')}。`);

    // ---- 吃 / 喝：本插件只说「这儿有得吃」，味道交给鱼的每一天 ----
    if (hasFood(venue)) {
      const f = venue.food;
      lines.push(`这儿能${f.verb}：${f.items.join('、')}。`);
      lines.push(this.#foodHint(venue));
    }

    const total = venue.areas.length;
    const got = session.visited.length;
    lines.push(`这一趟逛了 ${got} 处（${visitedText(session)}）。`);
    if (staleBefore) {
      lines.push(`（这一趟挂得有点久了，上一次动是 ${hmIn(this.timezone, idleSince)}。想收就用 fun_home。）`);
    } else if (got >= total) {
      lines.push('这儿差不多逛遍了。');
    } else {
      lines.push('还想逛就接着 fun_wander；逛够了就 fun_home 收摊。');
    }
    return { text: lines.join('\n') };
  }

  async #homeTool(args) {
    const now = this.#now();
    const day = dayIn(this.timezone, now);
    this.#state = normalizeState(this.#state, day);
    if (!this.#state.session) {
      return { text: '你这会儿没在逛啊。想出门就 fun_go，先挑一处地方。' };
    }

    const venue = venueById(this.#state.session.placeId) ?? { name: this.#state.session.placeName, scene: this.#state.session.scene };
    const closed = closeSession(this.#state, now, args?.note);
    await this.#save();

    const { trip, stayedMin, note } = closed;
    const summary = tripSummary(trip);
    const lines = [`收摊：这一趟在${summary}。`];
    if (stayedMin >= 5) lines.push(`待了大约 ${stayedMin} 分钟。`);
    if (note) lines.push(`（你记的：${note}）`);

    // 只认场所有没有 scene：trip.scene 是从 session 抄来的，两边一致；
    // 老状态文件里可能有「scene 被兜成场所名」的脏数据，所以用 venue 判定为主。
    const scene = hasScene(venue) ? venue.scene : '';
    // 这句话是联动的关键：把「该填哪个名字」递到她嘴边，替她省一次猜。
    // 素材库里没有这处场景时**一个字都不提**——点了库里没有的名字，那一项等于白填。
    if (scene) {
      lines.push(`要发图的时候就照这一趟画：imggen_draw 的 scene 填「${scene}」，outfits 填${trip.outfit ? `「${trip.outfit}」` : '你这一趟穿的那身'}，道具/情境按当时的样子填，别自己编地方。`);
    } else {
      lines.push(`要发图的时候，scene 不用填（素材库里没有${trip.placeName}这个场景），按当时的样子写进 prompt 就行，outfits 填${trip.outfit ? `「${trip.outfit}」` : '你这一趟穿的那身'}。`);
    }

    if (this.#askReport()) {
      lines.push('这会儿顺手做两件事：');
      lines.push(`1) 用 feast_life_play 记一笔（activity 写「去${trip.placeName}逛」，note 就写上面那句话里你真有感觉的部分）；`);
      lines.push('2) 跟主人说一句你刚才去了哪儿、看到什么——一句话就够，别列清单。');
    } else {
      lines.push(`（想记进日程就用 feast_life_play，不记也没关系。）`);
    }
    return { text: lines.join('\n') };
  }

  #startTool() {
    const now = this.#now();
    const nowMin = minutesIn(this.timezone, now);
    const picks = suggestPlaces(nowMin, 5, recentPlaceIds(this.#state, 2));
    const lines = [`这会儿 ${hmIn(this.timezone, now)}。想现在就出门的话，能去：`];
    for (const { venue, state } of picks) {
      lines.push(`- ${venue.name}（${STATE_LABEL[state]}，${CROWD_LABEL[venue.crowd] || '人不少'}）：${venue.areas.slice(0, 4).join('、')}`);
    }
    lines.push(`（一共 ${VENUES.length} 处，fun_places all 填 true 能看全，kind 填「室内」「户外」「夜」能只看一类。）`);
    lines.push('怎么走：fun_go 进门 → fun_wander 一处一处逛（能顺手买纪念品、拍照）→ fun_home 收摊。');
    lines.push('收摊回执会把这一趟收成一句话，你照着 feast_life_play 记一笔就行。');
    return { text: lines.join('\n') };
  }

  #viewTool(args) {
    const count = clampInt(args?.count, 1, 20, 5);
    const trips = (this.#state.trips || []).slice(0, count);
    if (!trips.length && !this.#state.session) {
      return { text: '纪念册还是空的——还没收过摊。想出门就 fun_start 或 fun_places 看看。' };
    }
    const lines = [];
    if (this.#state.session) {
      lines.push(`正在逛：${tripSummary(this.#state.session)}。`);
    }
    if (trips.length) {
      lines.push('去过的地方：');
      for (const t of trips) {
        const when = t.leftAt ? `${new Date(t.leftAt).toISOString().slice(0, 10)}` : '';
        lines.push(`- ${when} ${tripSummary(t)}`);
      }
    }
    return { text: lines.join('\n') };
  }

  // -------------------------------------------------------------------------
  // 正文小工具
  // -------------------------------------------------------------------------

  /**
   * 这一处的细节描写。
   *
   * 不重复整段 `desc`（`fun_go` 已经给过一遍了），只取desc里**跟空间有关**的那一截，
   * 再补一句「这是第几处」的位置感。`nowMin` 决定取哪个时段的描写——
   * 江边夜里不能拿清早那段来用。
   */
  #areaLine(venue, area, nowMin) {
    const idx = (venue.areas || []).indexOf(area);
    const n = idx >= 0 ? idx + 1 : null;
    // desc 的第一段（到第一个分号）通常就是空间本身，够用且不啰嗦。
    const scenery = descNow(venue, nowMin).split('；')[0].replace(/^[^：]*：/, '');
    const where = n ? `（第 ${n} 处，共 ${venue.areas.length} 处）` : '';
    return `${scenery}。${where}`;
  }

  #homeHint() {
    return '想收就用 fun_home，回执会把这一趟收成一句话。';
  }

  /**
   * 吃 / 喝那句：把味道这件事**交回给鱼的每一天**。
   *
   * 为什么不是本插件自己写味道：菜品库（824 道菜、九维口感、实吃描写）在
   * `cortico-world-feast` 里。World 契约不允许一个 World 读另一个 World 的库，
   * 认证会查「一个 World 依赖另一个扩展」。所以这里只做两件事：
   *
   *   1. 告诉她「这儿能吃到什么」（品类名，本插件自己的数据）
   *   2. 告诉她「去 feast 点一道真的」——具体点哪道、什么味道，由她自己在
   *      同一回合调 `feast_menu` / `feast_eat`，那是她的工具，不是我们的
   *
   * **没装 feast 怎么办**：她的 `feast_eat` 调不出来（工具不存在），于是她只知道
   * 「我在这儿喝了杯奶茶」——没有九维、没有香气余韵。这不是 bug，是有意的降级：
   * 与其编一个假的味道档案，不如只说她真知道的那件事。
   *
   * 本插件永远不会知道 feast 装没装（不该去探测别人的扩展），所以这段话
   * **同时给出两条路**，让她按自己手头有什么走。
   */
  #foodHint(venue) {
    const f = venue.food;
    const sample = f.items.slice(0, 3).join(' / ');
    return [
      `想${f.verb}点什么就自己挑（${sample}…）。`,
      // 措辞按「喝 / 吃」分开写，别拼出「喝了什么」这种别扭话。
      `但味道别自己编：装了「鱼的每一天」就用 feast_menu 挑一道同类的、feast_eat 真${f.verb}一口，`
      + `你才能说得出九维口感、香气和余韵；没装就只说在这儿${f.verb}了什么，一句人话，别形容味道。`,
    ].join('');
  }

  // -------------------------------------------------------------------------
  // 存取
  // -------------------------------------------------------------------------

  async #load() {
    const day = dayIn(this.timezone, this.#now());
    try {
      const raw = JSON.parse(await readFile(this.stateFile(), 'utf8'));
      return normalizeState(raw, day);
    } catch {
      return newState(day);
    }
  }

  async #save() {
    if (!this.#state) return;
    const file = this.stateFile();
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(this.#state, null, 2), 'utf8');
    await rename(tmp, file);
  }

  #serial(task) {
    const run = () => task();
    const result = this.#queue.then(run, run);
    this.#queue = result.then(() => {}, () => {});
    return result;
  }

  #ensureStarted() {
    if (!this.#started || !this.#state) throw new Error('娱乐时间还没启动；等它启用后再试。');
  }

  // -------------------------------------------------------------------------
  // WebUI
  // -------------------------------------------------------------------------

  webUi(language = 'zh') {
    this.language = language === 'en' ? 'en' : 'zh';
    const t = text(this.language);
    const p = panelText(this.language);
    const now = this.#now();
    const state = this.#state ?? newState(dayIn(this.timezone, now));
    const nowMin = minutesIn(this.timezone, now);
    const openCount = VENUES.filter((v) => hoursState(v, nowMin) !== 'closed').length;
    const session = state.session;
    const badges = [
      {
        label: t.badgePlaces,
        value: `${openCount}/${VENUES.length}`,
        tone: openCount > 0 ? 'plain' : 'off',
      },
    ];
    if (session) {
      const venue = venueById(session.placeId);
      badges.unshift({
        label: t.badgeSession,
        value: `${session.placeName}·${session.visited.length}/${venue?.areas.length ?? '?'}`,
        tone: 'on',
      });
    }
    return {
      label: t.label,
      lamps: [{
        label: t.lamp,
        state: this.#started ? 'online' : 'offline',
        hint: this.#started
          ? (session ? `正在${session.placeName}逛：${visitedText(session)}` : '没在逛')
          : t.stopped,
      }],
      badges,
      panels: [
        { id: 'places', title: p.places.title, description: p.places.description, getMethods: ['list'] },
        { id: 'book', title: p.book.title, description: p.book.description, getMethods: ['list'] },
      ],
      invoke: (panel, method, args) => this.#invoke(panel, method, args ?? []),
      config: [configGroup(this.language)],
      promptDocs: [{
        key: `worlds.${ID}.env`,
        title: t.label,
        description: t.prompt,
        path: ENV_PROMPT,
        role: 'envPrompt',
      }],
      storage: [{
        key: 'fun-state',
        label: t.storage.label,
        kind: 'disk',
        location: this.stateFile(),
        danger: true,
        note: t.storage.note,
        stat: () => {
          const st = this.#state;
          if (!st) return '还没启动';
          const trips = st.trips?.length ?? 0;
          return `${trips} 趟纪念册${st.session ? ` · 正在${st.session.placeName}逛` : ''}`;
        },
        clear: () => this.#clearState(),
      }],
    };
  }

  // -------------------------------------------------------------------------
  // 面板数据面（客户端 bundle 只走这里，不读私有状态）
  // -------------------------------------------------------------------------

  /**
   * 面板调用的唯一入口。
   *
   * 契约：**只读方法必须幂等、不写盘**；写方法（go/wander/home）走的是和工具同一个
   * 实现，所以在面板上点一下和她自己调工具是一回事——不会有第二套逻辑。
   * 任何异常都兜成 `{ ok: false, error }`，不让面板挂掉。
   */
  async #invoke(panel, method, args) {
    try {
      this.#ensureStarted();
      if (panel === 'places') {
        switch (method) {
          case 'list': return this.#placesData();
          default: throw new Error(`places 没有 ${method} 这个方法`);
        }
      }
      if (panel === 'book') {
        switch (method) {
          case 'list': return this.#bookData();
          default: throw new Error(`book 没有 ${method} 这个方法`);
        }
      }
      throw new Error(`不认识的面板：${panel}`);
    } catch (err) {
      return { ok: false, error: msg(err) };
    }
  }

  /**
   * 「去哪儿」面板：全部场所 + 此刻的开放状态 + 正在逛的这一趟。
   *
   * 只读：不动状态、不写盘。`now` 由服务端给，别让面板自己算——
   * 客户端的钟可能和她的时区不一致。
   */
  #placesData() {
    const now = this.#now();
    const nowMin = minutesIn(this.timezone, now);
    const tz = this.timezone;
    const st = this.#state ?? newState(dayIn(tz, now));
    const recent = recentPlaceIds(st, 3);
    const places = VENUES.map((v) => {
      const state = hoursState(v, nowMin);
      return {
        id: v.id,
        name: v.name,
        aliases: v.aliases,
        tags: v.tags,
        // 给此刻的那段：有阶段的场所，面板上显示的该是「此刻的样子」，不是通用那段。
        desc: descNow(v, nowMin),
        descAll: v.desc,
        scene: v.scene,
        hasScene: hasScene(v),
        outfit: v.recommendedOutfit,
        crowd: v.crowd,
        crowdLabel: CROWD_LABEL[v.crowd] ?? '',
        kindLabel: KIND_LABEL[v.kind] ?? '',
        hours: v.hours,
        state,
        stateLabel: STATE_LABEL[state],
        areas: areasNow(v, nowMin),
        areaCount: v.areas.length,
        souvenirs: v.souvenirs,
        photoSpots: v.photoSpots,
        recent: recent.includes(v.id),
        // 时段：现在处于哪一段、这一处共有哪几段（面板上做「换时间来是另一副样子」的提示）
        phase: phaseLabelAt(v, nowMin) || null,
        phases: Array.isArray(v.phases) ? v.phases.map((x) => ({ key: x.key, label: x.label, from: x.from, to: x.to })) : [],
        // 有吃有喝的地方：只给品类名和动词，**不给味道**（味道在鱼的每一天里）。
        food: hasFood(v) ? { label: v.food.label, items: v.food.items, verb: v.food.verb } : null,
      };
    });
    // 开着的排前面；面板不截断，十二处都给它，前端自己分组。
    places.sort((a, b) => rankOf(a.state) - rankOf(b.state));

    return {
      ok: true,
      nowHm: hmIn(tz, now),
      day: dayIn(tz, now),
      ttlMin: this.#ttlMin(),
      askReport: this.#askReport(),
      on: this.#on(),
      openCount: places.filter((x) => x.state !== 'closed').length,
      total: places.length,
      places,
      session: st.session ? {
        placeId: st.session.placeId,
        placeName: st.session.placeName,
        scene: st.session.scene,
        outfit: st.session.outfit,
        enteredHm: hmIn(tz, st.session.enteredAt),
        lastHm: hmIn(tz, st.session.lastAt),
        stayedMin: Math.max(0, Math.round((now - st.session.enteredAt) / 60000)),
        stale: isStale(st.session, now, this.#ttlMin()),
        visited: st.session.visited.map((v) => ({ area: v.area, note: v.note, hm: hmIn(tz, v.at) })),
        souvenirs: st.session.souvenirs,
        photos: st.session.photos,
        ate: (st.session.ate ?? []).map((x) => ({ item: x.item, verb: x.verb, hm: hmIn(tz, x.at) })),
        events: st.session.events,
        venueAreaCount: venueById(st.session.placeId)?.areas.length ?? null,
      } : null,
    };
  }

  /**
   * 「纪念册」面板：去过的每一趟 + 汇总。
   *
   * 只读。`trips` 已经在 state 里裁到 MAX_TRIPS 条，这里不再二次截断，
   * 否则面板上看到的总趟数和实际记得的对不上。
   */
  #bookData() {
    const tz = this.timezone;
    const now = this.#now();
    const st = this.#state ?? newState(dayIn(tz, now));
    const trips = (st.trips ?? []).map((t) => ({
      placeId: t.placeId,
      placeName: t.placeName,
      scene: t.scene,
      outfit: t.outfit,
      day: t.leftAt ? dayIn(tz, t.leftAt) : '',
      enteredHm: t.enteredAt ? hmIn(tz, t.enteredAt) : '',
      leftHm: t.leftAt ? hmIn(tz, t.leftAt) : '',
      stayedMin: t.leftAt && t.enteredAt ? Math.max(0, Math.round((t.leftAt - t.enteredAt) / 60000)) : 0,
      visited: t.visited.map((v) => v.area),
      souvenirs: t.souvenirs,
      photos: t.photos,
      ate: (t.ate ?? []).map((x) => ({ item: x.item, verb: x.verb })),
      events: t.events,
      summary: tripSummary(t),
    }));
    // 按地方汇总：哪几处去得最多（面板上的「常去」）。
    const byPlace = new Map();
    for (const t of trips) {
      const cur = byPlace.get(t.placeName) ?? { name: t.placeName, times: 0, lastDay: '' };
      cur.times += 1;
      if (!cur.lastDay || t.day > cur.lastDay) cur.lastDay = t.day;
      byPlace.set(t.placeName, cur);
    }
    const mostVisited = [...byPlace.values()].sort((a, b) => b.times - a.times || (a.lastDay < b.lastDay ? 1 : -1));
    return {
      ok: true,
      total: trips.length,
      souvenirCount: trips.reduce((n, t) => n + t.souvenirs.length, 0),
      photoCount: trips.reduce((n, t) => n + t.photos.length, 0),
      visitedAreaCount: trips.reduce((n, t) => n + t.visited.length, 0),
      mostVisited,
      trips,
      session: st.session ? { placeName: st.session.placeName, summary: tripSummary(st.session) } : null,
    };
  }

  /** 清空她的出游记录（存储页「清掉」）。只清 state 这一份，不碰别的 World。 */
  async #clearState() {
    this.#state = newState(dayIn(this.timezone, this.#now()));
    await this.#save();
    this.#host?.log?.info?.('娱乐时间：出游记录已清空');
    return { ok: true };
  }

  // -------------------------------------------------------------------------
  // 生命周期
  // -------------------------------------------------------------------------

  async start(host) {
    if (this.#started) return;
    this.#host = host;
    this.#ensureConfigSection();
    this.#state = await this.#load();
    this.#started = true;
    this.#host?.log?.info?.('娱乐时间已启动', {
      places: VENUES.length,
      session: this.#state.session?.placeName ?? null,
      trips: this.#state.trips.length,
    });
  }

  async stop() {
    this.#started = false;
    try { await this.#save(); } catch { /* 停的时候存不上就算了 */ }
    this.#host = null;
  }
}

/** 给面板/测试用的场所名清单（正名 + 别名一起）。 */
export function venueNames() {
  return VENUES.flatMap((v) => [v.name, ...v.aliases]);
}

export { KIND_LABEL, VENUES };
