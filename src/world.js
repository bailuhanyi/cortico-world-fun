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
 * 状态是纯 JSON，落在 `<dataDir>/fun/state.json`；历史保留，跨天超时的行程等待续逛或收摊。
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
  areasNow, descNow, eventPool, eventsNow, phaseLabelAt, rareEventsNow,
} from './phases.js';
import {
  cameEarlierToday, dayPhrase, filterRepeatedEvents, historyFor, memoryLine, pickEvent,
  regularLine, untriedAreas,
} from './memories.js';
import {
  USER_PREFIX, blankVenue, cleanOverride, cleanUserVenue, idFromName, isPresetId,
  mergeVenues, parseVenueFile, stringifyVenueFile,
} from './user-venues.js';
import { collectSouvenirs, progressFor, progressLine } from './keepsakes.js';
import { resolveName } from './names.js';
import { filterEventsForArea } from './events.js';
import { aquariumDetail, aquariumEventDetail } from './aquarium.js';
import { applyChoice, choiceForEvent } from './choices.js';
import { addWish, changeWish, fulfillWishes } from './wishes.js';
import { explorationFor } from './exploration.js';
import { branchChoiceFor, branchFollowup } from './branches.js';
import { addMoment, timelineFor, normalizeRoute, storeRoute, routeText } from './journeys.js';
import { recommendVenue } from './recommendations.js';
import { StoryLibrary, storyResultText } from './story-library.js';
import { pickStory, advanceStoryChoice } from './story-packs.js';
import {
  buySouvenir, closeSession, dayIn, enterVenue, favoriteTrip, hmIn, isStale, minutesIn,
  newState, normalizeState, outingMinutes, outingStatus, recentPlaceIds, recordConsume,
  takePhoto, tripDay, tripSummary, visitedText, wanderOnce,
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
    description: '查询地点、当前可逛项目及心愿的合适时段。',
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
    description: '开始一趟出游并返回当前时段的地点描写与可逛项目。place 必填，使用 fun_places 返回的地点名或别名。',
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
    description: '在当前地点逛一个项目；可选 buy/photo/consume 记录本次真实收获。若回执含 choiceId/optionId，先用 fun_choice 处理再继续。',
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
    name: 'fun_choice',
    tags: ['write'],
    description: '按待选回执的选项处理当前事件，也可略过。',
    parameters: {
      type: 'object',
      properties: {
        choiceId: { type: 'string', description: '待选择事件回执给出的 choiceId。' },
        optionId: { type: 'string', description: '使用回执中的 optionId，或填 skip 略过。' },
      },
      required: ['choiceId', 'optionId'],
      additionalProperties: false,
    },
  },
  {
    name: 'fun_resume',
    tags: ['write'],
    description: '继续未逛完的行程，返回进度和待选事件。',
    parameters: {
      type: 'object',
      properties: { id: { type: 'string', description: 'fun_view 提供的未完行程 ID。' } },
      required: ['id'], additionalProperties: false,
    },
  },
  {
    name: 'fun_home',
    tags: ['write'],
    description: '收摊并把已发生的经历记入纪念册。',
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: '这一趟怎么样，一句话，可选。' },
        draftId: { type: 'string', description: '要按已有记录结束未完行程时，填 fun_view 提供的 ID。结束正在逛的行程时不填。' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'fun_start',
    tags: ['read'],
    description: '查看当前推荐地点；详细筛选用 fun_places。',
    parameters: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'fun_route',
    tags: ['write'],
    description: '规划两站出门、前往下一站、改下一站或取消后续；不自动移动。',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['plan', 'status', 'next', 'change', 'cancel'] },
      places: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2, description: 'plan 时填两个不同地点正名或 ID。' },
      id: { type: 'string', description: 'next/change/cancel 时填回执中的路线 ID。' },
      place: { type: 'string', description: 'change 时的新下一站；只改尚未去的站。' },
      company: { type: 'string', description: 'plan 时的同行人，可选。' },
    }, required: ['action'], additionalProperties: false },
  },
  {
    name: 'fun_view',
    tags: ['read', 'snapshot'],
    description: '查询行程，可按地点、同行人、日期或关键词检索。',
    parameters: {
      type: 'object',
      properties: {
        count: { type: 'integer', description: '看最近几趟，默认 5。', minimum: 1, maximum: 20 },
        query: { type: 'string', description: '搜索地点、项目、备注、小事或纪念品。' },
        place: { type: 'string', description: '只看这个地点的行程，正名或别名。' },
        company: { type: 'string', description: '只看与这位同行人的行程。' },
        from: { type: 'string', description: '开始日期 YYYY-MM-DD，包含当天。' },
        to: { type: 'string', description: '结束日期 YYYY-MM-DD，包含当天。' },
        id: { type: 'string', description: '精确查看一个已有行程 ID。' },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'fun_wishes',
    tags: ['read', 'snapshot'],
    description: '查看出游心愿及状态；只有明确说过想去、想做的事才会记录，不会催促。',
    parameters: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'fun_wish',
    tags: ['write'],
    description: '记录明确表达的出游心愿，或暂缓、恢复、取消。先选地点；项目、时段、纪念品须填真实清单正名。不会替你出游，也不按旧行程补完成。',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['add', 'pause', 'resume', 'cancel'] },
        id: { type: 'string', description: '管理现有心愿时填 fun_wishes 给出的 ID。' },
        place: { type: 'string', description: '新增心愿的地点名，别名也认。' },
        type: { type: 'string', enum: ['visit', 'area', 'phase', 'souvenir'] },
        target: { type: 'string', description: '项目/时段/纪念品正名；visit 不填。' },
        reason: { type: 'string', description: '你明确表达的缘由，可选，不凭空猜测偏好。' },
      },
      required: ['action'], additionalProperties: false,
    },
  },
  {
    name: 'fun_keepsake',
    tags: ['write'],
    description: '用 fun_view 的行程 ID 珍藏或取消珍藏一趟已收摊的行程。珍藏独立保留，不影响收藏账本。',
    parameters: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '行程 ID，来自纪念册（fun_view）。' },
        keep: { type: 'boolean', description: 'true 珍藏，false 取消珍藏。' },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
  {
    name: 'fun_story',
    tags: ['write'],
    description: '管理本地地点剧情包，校验和预览只读，导入或启停须指定操作。',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['list', 'template', 'validate', 'preview', 'export', 'import', 'enable', 'disable', 'remove'] },
      id: { type: 'string', description: '已有剧情包 ID，来自 list。' },
      json: { type: 'string', description: '完整剧情包 JSON，最多 32 KB；validate/preview 不保存。' },
      placeId: { type: 'string', description: 'template 绑定的真实地点 ID，可来自自填地点；list 提供可用 ID。' },
      area: { type: 'string', description: 'preview 的项目，默认使用起始节点项目。' },
      time: { type: 'string', description: 'preview 的测试时刻 HH:MM，默认当前本地时刻。' },
      replace: { type: 'boolean', description: 'import 覆盖已有同 ID 自定义包时才设 true。' },
    }, required: ['action'], additionalProperties: false },
  },
  {
    name: 'fun_shelf',
    tags: ['read', 'snapshot'],
    description: '按地点查询长期纪念品收藏和收集进度。',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: '只看某一处的架子（填地方名，可选）。不填就看全部。' },
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
  /** 用户自填的地点（从 venues.json 读进内存；同步工具回执要即时用）。 */
  #userVenues = null;
  /** B 阶段：预设覆盖层 `{ [presetId]: {字段: 值} }`，稀疏、只存改过的字段。 */
  #overrides = {};
  #storyLibrary;

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
    this.#storyLibrary = new StoryLibrary({ file: this.storiesFile(), venues: () => this.#places(), visits: (id) => this.#state ? this.#history(id)?.visitCount ?? 0 : 0, nowMin: () => minutesIn(this.timezone, this.#now()) });
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
   * 吃喝的味道去不去「鱼的每一天」拿。
   *
   * 这是**用户意愿开关**，不是自动探测：World 不能去探测别的扩展装没装
   * （那本身就是一种依赖，认证要查）。拨关就一个字都不提味道。
   */
  #tasteFromFeast() {
    const v = this.cfg?.funTasteFromFeast;
    return v === undefined || v === null ? Boolean(DEFAULTS.funTasteFromFeast) : Boolean(v);
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

  /** 用户自填地点的文件。和 state.json 分开放：一个是「她逛到哪」，一个是「主人配了什么」。 */
  venuesFile() {
    return join(this.dataDir, 'fun', 'venues.json');
  }

  storiesFile() { return join(this.dataDir, 'fun', 'stories.json'); }

  // -------------------------------------------------------------------------
  // 场所：预设 + 用户自填
  // -------------------------------------------------------------------------

  /**
   * 当前可用的全部场所：预设 20 处（可带覆盖层）+ 用户自填。
   *
   * **永远返回数组，永远不抛错**——场所表读不出来时退回纯预设，
   * 这个 World 照常能逛（降级是第一公民）。
   *
   * 合并规则见 `user-venues.js`：用户改动优先，预设升级照常生效。
   * 这个方法是同步的（工具回执要即时算），所以用户数据在 `#load` 时读进内存。
   */
  #places() {
    try {
      const users = Array.isArray(this.#userVenues) ? this.#userVenues : [];
      return mergeVenues(VENUES, users, this.#overrides);
    } catch (err) {
      this.#host?.log?.warn?.('娱乐时间：场所合并失败，退回预设', { err: msg(err) });
      return [...VENUES];
    }
  }

  /**
   * 读 venues.json（坏文件、目录不存在一律当空，不抛）。
   * 兼容 A 阶段旧格式：顶层数组或只有 `{ venues: [...] }`。
   */
  async #loadVenueFile() {
    try {
      const raw = JSON.parse(await readFile(this.venuesFile(), 'utf8'));
      return parseVenueFile(raw);
    } catch {
      return { venues: [], overrides: {} };
    }
  }

  /** 写 venues.json（tmp → rename 原子写）；覆盖层与自填地点一起落盘。 */
  async #saveVenueFile(venues, overrides) {
    const file = this.venuesFile();
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, stringifyVenueFile({ venues, overrides }), 'utf8');
    await rename(tmp, file);
    this.#userVenues = venues;
    this.#overrides = overrides;
  }

  // -------------------------------------------------------------------------
  // 提示词
  // -------------------------------------------------------------------------

  /** This World adds no dynamic venue list to the always-present prompt. */
  envPromptVars() {
    return { fun_places_block: '' };
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
      const previous = this.#state ? structuredClone(this.#state) : null;
      try {
        return await this.#tool(name, args);
      } catch (err) {
        this.#state = previous;
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
      case 'fun_choice': return await this.#choiceTool(args);
      case 'fun_resume': return await this.#resumeTool(args.id);
      case 'fun_home': return await this.#homeTool(args);
      case 'fun_start': return this.#startTool();
      case 'fun_route': return await this.#routeTool(args);
      case 'fun_view': return this.#viewTool(args);
      case 'fun_wishes': { this.#state = this.#normalizeState(); return { text: this.#wishesText() }; }
      case 'fun_wish': {
        const result = await this.#manageWish(args);
        return { text: result.ok ? this.#wishesText() : result.error, ...(result.ok ? {} : { failed: true }) };
      }
      case 'fun_keepsake': return await this.#keepsakeTool(args);
      case 'fun_shelf': return this.#shelfTool(args);
      case 'fun_story': {
        const result = await this.#storyLibrary.act(args);
        return { text: storyResultText(result), ...(result.ok ? {} : { failed: true }) };
      }
      default: return { text: `[${name} 失败] 不认识这个工具。`, failed: true };
    }
  }

  async #routeTool(args) {
    const next = this.#normalizeState();
    const action = args?.action;
    if (action === 'status') return { text: next.route ? routeText(next.route) : '当前没有待继续的路线。' };
    if (action === 'plan') {
      if (next.route || next.session || next.draft) return { text: '请先处理当前行程或路线，再规划新的两站出门。', failed: true };
      if (!Array.isArray(args.places) || args.places.length !== 2) return { text: '请指定两个不同地点。', failed: true };
      const venues = args.places.map((p) => findVenue(this.#places(), p));
      if (venues.some((v) => !v) || venues[0].id === venues[1].id) return { text: '两个地点须存在且不同；用 fun_places 查看清单。', failed: true };
      next.routeSeq += 1;
      const route = { id: 'route-' + this.#now() + '-' + next.routeSeq, stops: venues.map((v) => ({ placeId: v.id, placeName: v.name })), company: typeof args.company === 'string' ? args.company.trim().slice(0, 40) : '', nextIndex: 0, status: 'planned', tripIds: [], startedAt: this.#now() };
      storeRoute(next, route);
      await this.#commitState(next);
      return { text: routeText(route) + '。准备好后用 fun_route 的 next 并填 id 前往第一站。' };
    }
    const route = next.route;
    if (!route || args.id !== route.id) return { text: '找不到当前这条路线，请用 fun_route status 查看。', failed: true };
    if (action === 'cancel') {
      route.status = 'cancelled';
      storeRoute(next, route);
      await this.#commitState(next);
      return { text: '已取消后续路线；正在逛的行程和已经保存的记录保留。' };
    }
    if (action === 'change') {
      const index = next.session?.routeId === route.id || next.draft?.routeId === route.id ? route.nextIndex + 1 : route.nextIndex;
      if (index > 1) return { text: '已经没有尚未去的下一站。', failed: true };
      const venue = findVenue(this.#places(), args.place);
      if (!venue || route.stops.some((stop, i) => i !== index && stop.placeId === venue.id)) return { text: '新下一站须是另一处现有地点。', failed: true };
      route.stops[index] = { placeId: venue.id, placeName: venue.name };
      storeRoute(next, route);
      await this.#commitState(next);
      return { text: routeText(route) + '。没有自动出发。' };
    }
    if (action === 'next') {
      if (next.session || next.draft) return { text: '这一站还没有收摊，请先完成或处理未完行程。', failed: true };
      const stop = route.stops[route.nextIndex];
      if (!stop || !this.#places().some((v) => v.id === stop.placeId)) return { text: '下一站已不在地点清单，可 change 换一站或 cancel 取消后续。', failed: true };
      return this.#goTool({ place: stop.placeId, company: route.company });
    }
    return { text: '可用 plan/status/next/change/cancel。', failed: true };
  }

  #queryTrips(args = {}) {
    const value = (v) => typeof v === 'string' ? v.trim().toLocaleLowerCase() : '';
    const query = value(args.query), company = value(args.company), place = value(args.place);
    const venue = place ? findVenue(this.#places(), args.place) : null;
    return this.#savedTrips().filter((t) => {
      if (args.id && t.id !== args.id || args.placeId && t.placeId !== args.placeId) return false;
      if (args.kept && !(this.#state.keepsakeTrips ?? []).some((k) => k.id === t.id)) return false;
      if (place && (venue ? t.placeId !== venue.id : !value(t.placeName).includes(place))) return false;
      if (company && !value(t.company).includes(company)) return false;
      const day = tripDay(t, this.timezone);
      if (args.from && (!day || day < args.from) || args.to && (!day || day > args.to)) return false;
      if (query && !value([t.placeName, t.company, t.note, ...(t.visited ?? []).map((v) => v.area + ' ' + v.note), ...(t.events ?? []), ...(t.souvenirs ?? []), ...(t.photos ?? []), ...(t.choices ?? []).map((c) => c.result)].join(' ')).includes(query)) return false;
      return true;
    });
  }

  #tripLookup(args = {}, requireId = false) {
    if (requireId && (typeof args.id !== 'string' || !args.id)) return { ok: false, error: '缺少行程 ID。' };
    const ids = new Set(this.#queryTrips(args).map((t) => t.id));
    const trips = this.#bookData().trips.filter((t) => ids.has(t.id));
    if (requireId && !trips.length) return { ok: false, error: '详细行程已不在近期或珍藏记录中。' };
    return { ok: true, trips };
  }

  #wishesText() {
    const labels = { active: '想去', paused: '暂缓', completed: '已完成', cancelled: '已取消' };
    const wishes = this.#state.wishes ?? [];
    if (!wishes.length) return '还没有出游心愿。只有明确想去或想做时才记录，不需要凑任务。';
    return ['出游心愿（不会催促）：', ...wishes.map((w) => `- [${labels[w.status]}] ${w.placeName}${w.target ? ` · ${w.target}` : ''}${w.reason ? `：${w.reason}` : ''}（ID：${w.id}）`)].join('\n');
  }

  #outings(now = this.#now()) {
    return outingStatus(this.#state, dayIn(this.timezone, now), now, this.#ttlMin(), this.timezone);
  }

  #draftHint(draft) {
    return `「${draft.placeName}」还有一趟未逛完（ID：${draft.id}）。用 fun_resume 填 id 继续，或用 fun_home 填 draftId 按已有记录收摊。`;
  }

  #choiceHint(choice) {
    return [
      `待选择事件（choiceId：${choice.id}）：${choice.prompt}`,
      [...choice.options.map((o) => `${o.id}：${o.label}`), 'skip：略过'].join(' / '),
      '用 fun_choice 填 choiceId 和 optionId，再继续下一处。',
    ].join('\n');
  }

  async #resumeTool(id) {
    const next = this.#normalizeState();
    const draft = next.draft;
    if (!draft || id !== draft.id || next.session) {
      return { text: '找不到可继续的这趟行程，请用 fun_view 查看当前状态。', failed: true };
    }
    if (!this.#places().some((v) => v.id === draft.placeId)) {
      return { text: `「${draft.placeName}」已不在地点清单。可用 fun_home 填 draftId 按已有记录收摊。`, failed: true };
    }
    const now = this.#now();
    draft.pausedMs += Math.max(0, now - draft.lastAt);
    draft.lastAt = now;
    next.session = draft;
    next.draft = null;
    await this.#commitState(next);
    return { text: [`接着逛「${draft.placeName}」。${visitedText(draft)}。`,
      draft.pendingChoice ? this.#choiceHint(draft.pendingChoice) : '接着用 fun_wander 逛下一处。',
    ].join('\n') };
  }

  async #choiceTool(args) {
    const next = this.#normalizeState();
    if (next.draft) return { text: this.#draftHint(next.draft), failed: true };
    const session = next.session;
    if (!session?.pendingChoice) return { text: '现在没有待选择的事件。', failed: true };
    const choice = session.pendingChoice;
    if (args?.choiceId !== choice.id) return { text: this.#choiceHint(choice), failed: true };
    const skip = args?.optionId === 'skip';
    const result = skip ? null : applyChoice(choice, args?.optionId);
    if (result && !result.ok) return { text: `${result.error}\n${this.#choiceHint(choice)}`, failed: true };
    const now = this.#now();
    session.choices.push({ event: choice.event, option: args.optionId, result: skip ? '略过了这次选择' : result.option.result, at: now });
    addMoment(session, 'choice', skip ? '略过了这次选择' : result.option.result, now, choice.area, choice.event);
    session.storyProgress = advanceStoryChoice(session.storyProgress, choice.id, args.optionId);
    session.pendingChoice = null;
    session.lastAt = now;
    await this.#commitState(next);
    return { text: skip ? '略过了这次选择，可以接着逛。' : `你选择了「${result.option.label}」。${result.option.result}。` };
  }

  async #manageWish(args) {
    const action = args?.action;
    const now = this.#now();
    let result;
    if (action === 'add') {
      const venue = this.#places().find((v) => v.id === args?.placeId) ?? findVenue(this.#places(), args?.place);
      if (!venue) return { ok: false, error: '请先选择一个现有地点；fun_places 可以查看地点清单。' };
      const type = args?.type;
      const rawTarget = typeof args?.target === 'string' ? args.target.trim() : '';
      const lists = { area: venue.areas, phase: (venue.phases ?? []).map((p) => p.label), souvenir: venue.souvenirs };
      if (!['visit', 'area', 'phase', 'souvenir'].includes(type)) return { ok: false, error: '心愿类型请选择 visit、area、phase 或 souvenir。' };
      if (type !== 'visit' && !lists[type]?.includes(rawTarget)) return { ok: false, error: `这处没有这个目标；可填：${(lists[type] ?? []).join('、') || '暂无此类目标'}。` };
      result = addWish(this.#state.wishes, { placeId: venue.id, placeName: venue.name, type, target: type === 'visit' ? '' : rawTarget, reason: args.reason }, now);
    } else {
      result = changeWish(this.#state.wishes, args?.id, action, now);
    }
    if (result.error) return { ok: false, error: result.error };
    const previous = this.#state.wishes;
    this.#state.wishes = result.wishes;
    try { await this.#save(); } catch (err) { this.#state.wishes = previous; throw err; }
    return { ok: true, wish: result.wish, duplicate: result.duplicate ?? false };
  }

  #completeWishes(facts) {
    const result = fulfillWishes(this.#state.wishes, facts, this.#now());
    this.#state.wishes = result.wishes;
    return result.completed;
  }

  #history(placeId, today = dayIn(this.timezone, this.#now())) {
    const recent = historyFor(this.#savedTrips(), placeId, today, this.timezone);
    const permanent = explorationFor(this.#state.exploration, placeId);
    if (!permanent) return recent;
    const items = (this.#state.collection ?? []).filter((x) => x.placeId === placeId);
    return { ...recent, visitCount: permanent.visits, firstDay: permanent.firstDay,
      lastDay: permanent.lastDay, lastDayPhrase: dayPhrase(permanent.lastDay, today),
      areas: permanent.areas.map((area) => ({ area, times: permanent.areaCounts[area] || 1 })).sort((a,b) => b.times - a.times),
      photos: permanent.photos.map((spot) => ({ spot, times: 1 })),
      souvenirs: items.map((x) => ({ item: x.name, times: x.times })), ate: recent?.ate ?? [],
      events: [...new Set([...permanent.events, ...(recent?.events ?? [])])], phases: permanent.phases,
    };
  }

  #recommendations(picks, nowMin, now) {
    const day = dayIn(this.timezone, now);
    const memories = this.#savedTrips();
    const wishes = this.#state.wishes;
    return picks.map((p) => ({
      ...p,
      ...recommendVenue(p.venue, nowMin, wishes, this.#history(p.venue.id, day)),
    })).sort((a, b) => rankOf(a.state) - rankOf(b.state)
      || Number(Boolean(b.wishReason)) - Number(Boolean(a.wishReason)));
  }

  #upcomingWish(recommendations) {
    let next = null;
    for (const { venue, upcomingWish } of recommendations) {
      if (upcomingWish && (!next || upcomingWish.minutesAway < next.minutesAway)) {
        next = { ...upcomingWish, placeName: venue.name };
      }
    }
    return next ? `下个适合实现心愿的时段 · ${next.placeName} · ${next.text}` : '';
  }

  #recommendationLine(pick, detailed = false) {
    const { venue, state, phase, areas, wishReason, revisitReason } = pick;
    const bits = [`${venue.name}（${[STATE_LABEL[state], phase, CROWD_LABEL[venue.crowd] || '人不少'].filter(Boolean).join('，')}）`];
    if (detailed) bits.push(`${venue.hours.open}–${venue.hours.close}`);
    if (areas.length && detailed) bits.push(`现在能逛：${areas.slice(0, 5).join('、')}`);
    if (wishReason) bits.push(wishReason);
    if (revisitReason) bits.push(revisitReason);
    return `- ${bits.join('；')}`;
  }

  #placesTool(args) {
    const now = this.#now();
    const nowMin = minutesIn(this.timezone, now);
    const places = this.#places();
    const all = args?.all === true;
    const count = clampInt(args?.count, 1, 8, 4);
    const avoid = recentPlaceIds(this.#state, 2);

    // kind 三档都认：某种体验（室内 / 户外 / 夜 / 排队，走 tags）、
    // 某个大类（吃饭喝东西 / 户外，走 KIND_LABEL）、某一处正名或别名。
    // 以前只查 tags + KIND_LABEL，于是「咖啡」这种细类词筛不到咖啡店——现在 tags 补全了。
    const kindFilter = typeof args?.kind === 'string' ? args.kind.trim() : '';
    let picks;
    if (kindFilter) {
      const byName = findVenue(places, kindFilter);
      // 「吃饭喝东西」按 hasFood 判，不只看 kind：夜市是 market 大类，但它也能吃。
      // 这样以后再加能吃喝的地方不用回来改筛选逻辑。
      const wantsFood = kindFilter === KIND_LABEL.food;
      const matched = byName
        ? [byName]
        : places.filter((v) => (wantsFood ? hasFood(v) : false)
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
      picks = allPlaces(nowMin, avoid, places);
    }
    picks = this.#recommendations(picks, nowMin, now);
    const upcomingWish = this.#upcomingWish(picks);
    if (!all && !kindFilter) picks = picks.slice(0, count);

    const lines = [`这会儿 ${hmIn(this.timezone, now)}，能去逛的：`];
    lines.push(...picks.map((p) => this.#recommendationLine(p, true)));
    if (upcomingWish) lines.push(upcomingWish);
    const { session, draft } = this.#outings(now);
    if (session) lines.push(`（你正在「${session.placeName}」逛着，${visitedText(session)}；要换地方先 fun_home 收个摊。）`);
    if (draft) lines.push(this.#draftHint(draft));
    if (!all && !kindFilter && places.length > picks.length) {
      lines.push(`（一共 ${places.length} 处，这里只排了 ${picks.length} 处；想看全的就 all 填 true，只想看室内/户外/夜就填 kind。）`);
    }
    if (!draft) lines.push('定了就用 fun_go（place 填地方名）进门。');
    return { text: lines.join('\n') };
  }

  async #goTool(args) {
    const now = this.#now();
    const day = dayIn(this.timezone, now);
    this.#state = this.#normalizeState();
    if (this.#state.draft) return { text: this.#draftHint(this.#state.draft), failed: true };

    const places = this.#places();
    const venue = findVenue(places, args?.place);
    if (!venue) {
      const names = places.map((v) => v.name).join(' / ');
      return { text: `没听说过「${args?.place ?? ''}」这处。现在能去的是：${names}。\n（拿不准就 fun_places 看看，或者 all 填 true 列全部。）`, failed: true };
    }

    const route = this.#state.route;
    if (route && venue.id !== route.stops[route.nextIndex]?.placeId && !this.#state.session) {
      return { text: routeText(route) + '。要换目的地可先 fun_route change，或 cancel 取消后续。', failed: true };
    }
    const state = hoursState(venue, minutesIn(this.timezone, now));
    const company = typeof args?.company === 'string' ? args.company.trim() : '';
    const { session, already } = enterVenue(this.#state, venue, now, this.#random, company);
    if (already) {
      return {
        text: `你已经在「${this.#state.session.placeName}」逛着了（${visitedText(this.#state.session)}）。\n要么接着 fun_wander，要么 fun_home 收了再换地方。`,
      };
    }
    const enteredPhase = phaseLabelAt(venue, minutesIn(this.timezone, now));
    session.phases = enteredPhase ? [enteredPhase] : [];
    addMoment(session, 'enter', '进了' + venue.name, now);
    if (route) {
      session.routeId = route.id;
      session.routeOrder = route.nextIndex + 1;
      route.status = 'active';
      storeRoute(this.#state, route);
    }
    const completedWishes = this.#completeWishes({ placeId: venue.id, phase: enteredPhase });
    await this.#save();

    // 时段气氛：江边清早和夜里不是一回事，所以描写和可逛的项目都按此刻取。
    const nowMin = minutesIn(this.timezone, now);
    const label = phaseLabelAt(venue, nowMin);

    const lines = [`进了${venue.name}${label ? `（${label}）` : ''}。`, descNow(venue, nowMin)];
    if (route) lines.push(routeText(route) + ' · 第' + session.routeOrder + '站。');
    if (completedWishes.length) lines.push(`完成了心愿：${completedWishes.map((w) => w.target || `去${w.placeName}`).join('、')}。`);
    if (args?.company) lines.push(`跟${String(args.company).slice(0, 40)}一起。`);
    if (state === 'closingSoon') lines.push(`（快到打烊时间了，${venue.hours.close} 就关，别排太长的队。）`);
    if (state === 'closed') lines.push(`（其实这会儿已经过了开放时段（${venue.hours.open}–${venue.hours.close}），当它开着逛也行，只是别写外头太亮。）`);
    lines.push(`能逛的：${areasNow(venue, nowMin).join('、')}。`);
    if (venue.souvenirs?.length) lines.push(`纪念品：${venue.souvenirs.join('、')}。`);
    if (venue.photoSpots?.length) lines.push(`拍照点：${venue.photoSpots.join('、')}。`);
    if (hasFood(venue)) lines.push(`可${venue.food.verb}：${venue.food.items.join('、')}。`);
    // 有分时段的场所，提醒一句「换个时间来是另一副样子」——这是这个世界最耐玩的地方。
    const phaseCount = Array.isArray(venue.phases) ? venue.phases.length : 0;
    if (phaseCount > 1) {
      const others = venue.phases.map((p) => p.label).join(' / ');
      lines.push(`（这里不同时段不一样：${others}。换个时间来是另一副样子。）`);
    }

    // 去过的痕迹：只讲记得住的、只讲这一处的。没来过就一个字都不提。
    const history = this.#history(venue.id, day);
    if (history) {
      const memory = memoryLine(history, day);
      const bits = [];
      if (cameEarlierToday(history, day)) bits.push('今天你已经来过一次了。');
      if (memory) bits.push(memory);
      if (bits.length) lines.push(`（${bits.join('')}）`);

      // 常来的地方换一种口气：这是「这处是我的」和「一个场所库」的区别。
      // 只在够格时出现（5 趟起），且和上面那句分开放，免得事实和关系糊成一团。
      const regular = regularLine(history, venue.name);
      if (regular) lines.push(regular);
      const prog = progressFor(venue, this.#state.trips, this.#state.collection, this.#state.exploration);
      if (prog.areas.left.length) {
        lines.push(`还没去过：${prog.areas.left.slice(0, 4).join('、')}${prog.areas.left.length > 4 ? ` 等 ${prog.areas.left.length} 处` : ''}。`);
      }

    }

    lines.push('一处一处来：fun_wander 逛一处（不填 area 就自动挑一个没逛过的），看到纪念品/拍照点会用得了；遇到需要决定的事件，先用 fun_choice 选完再继续。');
    return { text: lines.join('\n') };
  }

  async #wanderTool(args) {
    const now = this.#now();
    const day = dayIn(this.timezone, now);
    this.#state = this.#normalizeState();
    const session = this.#state.session;
    if (this.#state.draft) return { text: this.#draftHint(this.#state.draft), failed: true };
    if (session?.pendingChoice) return { text: this.#choiceHint(session.pendingChoice) };
    if (!session) {
      return { text: '你还没进门呢。先用 fun_places 选地点，再用 fun_go 进门。' };
    }
    const places = this.#places();
    // venueById 只认预设；自填地点要在这份合并表里按 id 查，否则用户加的地方
    // 进门第一趟正常、第二趟 fun_wander 就找不到它了。
    const venue = places.find((v) => v.id === session.placeId)
      ?? findVenue(places, session.placeName);
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
    // 小事件里要滤掉「她以前真做过」那些，否则去过几次就成了复读机
    // （上次买了吧唧，这次又抽到「吧唧挑了半天」——那件事这次没发生）。
    const pastHistory = this.#history(venue.id, day);
    const liveEvents = filterRepeatedEvents(eventsNow(venue, nowMin), pastHistory);
    // 少见事件：来过才轮到（内容是按「熟人」写的），而且只是**有机会**。
    // 两池都先滤掉碰过的，再按 `eventPool` 决定这次从哪个池子里抽。
    const rarePool = filterRepeatedEvents(rareEventsNow(venue, nowMin), pastHistory);
    const visitsBefore = pastHistory?.visitCount ?? 0;

    // 指定了没逛过的项目就用它，否则自动挑。
    //
    // `area` 和 `buy` / `photo` / `consume` 一样**必须先判「这儿真有这处」再记**。
    // 以前这里是 `hit ?? wanted`：填一个库里没有的名字（「蹦极」）会被原样接受，
    // 回执写「海洋馆 · 蹦极」，还进了纪念册——等于替她编了一个不存在的地方。
    // 现在三档认：正名、别名式包含、或者不填让系统挑。
    const wanted = typeof args?.area === 'string' ? args.area.trim() : '';
    let picked = null;
    let areaMiss = '';
    if (wanted) {
      const hit = liveAreas.includes(wanted) ? wanted : liveAreas.find((a) => a.includes(wanted));
      if (!hit) {
        // 这一处**此刻**没有这处项目。可能是时段收窄了（夜市刚开摊只有几家），
        // 也可能是这处压根不存在——两种都如实说，把能逛的递给她。
        const allHere = (venue.areas || []).includes(wanted) ? '（这会儿还没开）' : '';
        areaMiss = `${venue.name}没有「${wanted}」这处${allHere}。这会儿能逛的是：${liveAreas.join('、')}。`;
      } else {
        if (!session.visited.some((v) => v.area === hit)) {
          session.visited.push({ area: hit, note: String(args?.note ?? '').slice(0, 120), at: now });
        }
        session.lastAt = now;
        picked = { area: hit, event: null };
      }
    } else {
      picked = wanderOnce(this.#state, venue, now, this.#random, liveAreas, []);
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
    const misfit = [];
    const resolve = (list, name, missing) => {
      const match = resolveName(list, name);
      if (match.name) return match.name;
      misfit.push(match.candidates.length > 1
        ? `「${name}」能对应多样：${match.candidates.join('、')}，请填完整名字，这次没记`
        : missing);
      return null;
    };

    let bought = null;
    if (buyName) {
      const name = resolve(venue.souvenirs, buyName, `「${buyName}」不是${venue.name}的东西，没记`);
      if (name) bought = buySouvenir(this.#state, name, now);
    }
    let shot = null;
    if (photoName) {
      const name = resolve(venue.photoSpots, photoName, `「${photoName}」不是${venue.name}的拍照点，没记`);
      if (name) shot = takePhoto(this.#state, name, now);
    }
    // 吃了/喝了什么：只记「这处地方供得出来」的品类，且**只记名字不记味道**。
    let ate = null;
    if (eatName) {
      if (!hasFood(venue)) misfit.push(`${venue.name}没有能吃能喝的，没记`);
      else {
        const name = resolve(venue.food.items, eatName, `「${eatName}」不是${venue.name}有的，没记`);
        if (name) ate = recordConsume(this.#state, venue, name, now);
      }
    }
    // 项目和已验证的收获确定后才抽事件，避免串项目或凭空获得东西。
    if (picked) {
      let story = null;
      try { story = pickStory(this.#storyLibrary.catalog(), venue, picked.area, nowMin, session, visitsBefore); }
      catch (error) { this.#host?.log?.warn?.('剧情包未能触发，继续普通游逛', { error: msg(error) }); }
      let choice = null;
      if (story) {
        picked.event = story.event;
        session.storyProgress = story.progress;
        choice = story.choice;
      } else {
      const common = filterEventsForArea(liveEvents, picked.area, venue, session);
      const rare = filterEventsForArea(rarePool, picked.area, venue, session);
      const chosenPool = eventPool(common, rare, visitsBefore, this.#random);
      const followup = branchFollowup(venue.id, picked.area, session, nowMin);
      picked.event = followup?.event ?? pickEvent(chosenPool, session.events, this.#random);
      if (followup) session.branchSeen.push(followup.id);
      choice = followup ? null : choiceForEvent(picked.event, { area: picked.area });
      if (!choice && !followup) {
        choice = branchChoiceFor(venue.id, picked.area, session, nowMin);
        if (choice) picked.event = choice.event;
      }
      }
      if (picked.event) session.events.push(picked.event);
      if (choice && !session.pendingChoice) session.pendingChoice = choice;
    }
    if (picked) {
      if (phaseName && !session.phases.includes(phaseName)) session.phases.push(phaseName);
      addMoment(session, 'area', picked.area + (args?.note ? ' · ' + String(args.note).slice(0, 120) : ''), now, picked.area);
      if (picked.event) addMoment(session, 'event', picked.event, now, picked.area, picked.event);
    }
    if (bought && !bought.duplicate) addMoment(session, 'buy', '买了' + bought.item, now, picked?.area);
    if (shot && !shot.duplicate) addMoment(session, 'photo', '在' + shot.spot + '拍了照', now, picked?.area);
    if (ate && !ate.duplicate) addMoment(session, 'consume', ate.verb + '了' + ate.item, now, picked?.area);

    const completedWishes = this.#completeWishes({ placeId: venue.id, area: picked?.area ?? '', phase: phaseName, souvenirs: bought && !bought.duplicate ? [bought.item] : [] });
    await this.#save();

    // 点的那处不存在：不编一个「逛了」，把能逛的如实递给她，买/拍照/吃喝照常结算
    // （她可能就是想在那儿买点东西，没必要连这个也拦掉）。
    if (areaMiss) {
      const lines = [`（${areaMiss}）`];
      if (completedWishes.length) lines.push(`完成了心愿：${completedWishes.map((w) => w.target || `去${w.placeName}`).join('、')}。`);
      if (bought) lines.push(bought.duplicate ? `（${bought.item} 你之前已经买过了。）` : `买了：${bought.item}。`);
      if (shot) lines.push(shot.duplicate ? `（${shot.spot} 已经拍过了。）` : `拍了张照：${shot.spot}。`);
      if (ate) lines.push(ate.duplicate ? `（${ate.item} 你这一趟已经${ate.verb}过了。）` : `${ate.verb}了：${ate.item}。`);
      for (const m of misfit) lines.push(`（${m}。）`);
      lines.push('这一处没记进这一趟。想接着逛就挑上面某一处，或者不填 area 让我自己挑。');
      return { text: lines.join('\n') };
    }

    const lines = [`${venue.name}${phaseName ? `（${phaseName}）` : ''} · ${picked.area}`, this.#areaLine(venue, picked.area, nowMin)];
    if (completedWishes.length) lines.push(`完成了心愿：${completedWishes.map((w) => w.target || `去${w.placeName}`).join('、')}。`);
    if (picked.event) {
      lines.push(`——${picked.event}`);
      const detail = aquariumEventDetail(picked.event, picked.area);
      if (detail) lines.push(detail);
      if (session.pendingChoice?.event === picked.event) {
        lines.push(this.#choiceHint(session.pendingChoice));
      }
    }
    const last = session.visited[session.visited.length - 1];
    if (last?.note) lines.push(`（你记的：${last.note}）`);

    if (bought) lines.push(bought.duplicate ? `（${bought.item} 你之前已经买过了。）` : `买了：${bought.item}。`);
    if (shot) lines.push(shot.duplicate ? `（${shot.spot} 已经拍过了。）` : `拍了张照：${shot.spot}。`);
    if (ate) lines.push(ate.duplicate ? `（${ate.item} 你这一趟已经${ate.verb}过了。）` : `${ate.verb}了：${ate.item}。`);
    for (const m of misfit) lines.push(`（${m}。）`);
    if (hasFood(venue) && ate) lines.push(this.#foodHint(venue));

    if (staleBefore) {
      lines.push(`（这一趟挂得有点久了，上一次动是 ${hmIn(this.timezone, idleSince)}。想收就用 fun_home。）`);
    } else if (session.visited.length >= venue.areas.length) {
      lines.push('这儿差不多逛遍了。');
    }
    return { text: lines.join('\n') };
  }

  async #homeTool(args) {
    const now = this.#now();
    const next = this.#normalizeState();
    if (args?.draftId !== undefined && (!next.draft || args.draftId !== next.draft.id || next.session)) {
      return { text: '找不到要收摊的未完行程，请用 fun_view 查看当前状态。', failed: true };
    }
    if (next.draft && args?.draftId === undefined) return { text: this.#draftHint(next.draft), failed: true };
    const outing = next.session ?? next.draft;
    if (!outing) return { text: '你这会儿没在逛啊。想出门就 fun_go，先挑一处地方。' };

    const endAt = next.draft ? (outing.lastAt || outing.enteredAt || now) : now;
    if (outing.pendingChoice) {
      outing.storyProgress = advanceStoryChoice(outing.storyProgress, outing.pendingChoice.id, 'skip');
      outing.choices.push({ event: outing.pendingChoice.event, option: 'skip', result: '收摊时未作选择', at: endAt });
    }
    next.session = outing;
    next.draft = null;
    const venue = this.#places().find((v) => v.id === outing.placeId)
      ?? { name: outing.placeName, scene: outing.scene };
    const closed = closeSession(next, endAt, args?.note, dayIn(this.timezone, endAt), this.timezone);
    const route = (next.routes ?? []).find((r) => r.id === outing.routeId);
    if (route) {
      if (!route.tripIds.includes(closed.trip.id)) route.tripIds.push(closed.trip.id);
      route.nextIndex = outing.routeOrder;
      if (route.status !== 'cancelled') route.status = route.nextIndex >= 2 ? 'completed' : 'between';
      storeRoute(next, route);
    }
    await this.#commitState(next);

    const { trip, stayedMin, note } = closed;
    const summary = tripSummary(trip);
    const lines = [`收摊：这一趟在${summary}。`];
    if (route) lines.push(routeText(route) + (route.status === 'between' ? '。想继续时用 fun_route next 并填路线 id；也可 change 换下一站或 cancel 提前结束。' : '。'));
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
    const places = this.#places();
    const picks = this.#recommendations(allPlaces(nowMin, recentPlaceIds(this.#state, 2), places), nowMin, now);
    const lines = [`这会儿 ${hmIn(this.timezone, now)}。想现在就出门的话，能去：`];
    lines.push(...picks.slice(0, 5).map((p) => this.#recommendationLine(p)));
    const upcomingWish = this.#upcomingWish(picks);
    if (upcomingWish) lines.push(upcomingWish);
    lines.push(`（一共 ${places.length} 处，fun_places all 填 true 能看全，kind 填「室内」「户外」「夜」能只看一类。）`);
    const { draft } = this.#outings(now);
    lines.push(draft ? this.#draftHint(draft) : '选好后用 fun_go 进门；逛完用 fun_home 收摊。');
    return { text: lines.join('\n') };
  }

  #savedTrips() {
    const kept = new Map((this.#state?.keepsakeTrips ?? []).map((t) => [t.id, t]));
    const all = [...(this.#state?.trips ?? []), ...kept.values()];
    return [...new Map(all.map((t) => [t.id, kept.get(t.id) ?? t])).values()].sort((a, b) => b.leftAt - a.leftAt);
  }

  async #favorite(id, keep = true) {
    return this.#serial(async () => {
      const result = favoriteTrip(this.#state, id, keep);
      if (result.ok) await this.#save();
      return result;
    });
  }

  #viewTool(args) {
    const count = clampInt(args?.count, 1, 20, 5);
    const trips = this.#queryTrips(args).slice(0, count);
    const { session, draft } = this.#outings();
    if (!trips.length && !session && !draft) {
      return { text: this.#savedTrips().length ? '没有找到符合条件的行程。' : '纪念册还是空的——还没收过摊。想出门就 fun_start 或 fun_places 看看。' };
    }
    const lines = [];
    if (session) {
      lines.push(`正在逛：${tripSummary(session)}。`);
      if (session.pendingChoice) lines.push(this.#choiceHint(session.pendingChoice));
    }
    if (draft) { lines.push(this.#draftHint(draft), `已有记录：${tripSummary(draft)}。`); if (draft.pendingChoice) lines.push(this.#choiceHint(draft.pendingChoice)); }
    if (this.#state.route) lines.push(routeText(this.#state.route));
    if (trips.length) {
      lines.push('去过的地方：');
      for (const t of trips) {
        const when = tripDay(t, this.timezone);
        const kept = (this.#state.keepsakeTrips ?? []).some((k) => k.id === t.id);
        const archived = !(this.#state.trips ?? []).some((x) => x.id === t.id);
        lines.push(`- ${when} ${tripSummary(t)}${kept ? '（已珍藏）' : ''}${archived && !kept ? '（近期行程已归档）' : ''}`);
        lines.push(`  行程 ID：${t.id}`);
        if (t.routeId) lines.push('  同次出门：' + t.routeId + ' · 第' + t.routeOrder + '站');
        if (t.note) lines.push(`  （你记的：${t.note}）`);
      }
    }
    return { text: lines.join('\n') };
  }

  /**
   * 纪念品架：这些趟攒下来的东西，按地方归着。
   *
   * 数据全部来自 `state.trips` 的归集（`keepsakes.js`），**不落新状态**——
   * 所以老用户的纪念册一升级就自动有了架子，不需要迁移，也不会因为
   * 清空纪念册之外的操作而丢失。
   *
   * 只读工具：不写盘、不改状态。
   */
  async #keepsakeTool(args) {
    this.#state = this.#normalizeState();
    const id = typeof args?.id === 'string' ? args.id.trim() : '';
    if (!id) return { text: '要珍藏哪一趟？用 fun_view 找行程 ID。', failed: true };
    const result = favoriteTrip(this.#state, id, args?.keep !== false);
    if (!result.ok) return { text: result.error, failed: true };
    await this.#save();
    return { text: result.kept ? `已珍藏「${result.trip.placeName}」这一趟，之后仍可在纪念册查看。` : `已取消珍藏「${result.trip.placeName}」这一趟；近期纪念册中的记录不受影响。` };
  }

  #shelfTool(args) {
    const places = this.#places();
    const want = typeof args?.place === 'string' ? args.place.trim() : '';
    let only = null;
    if (want) {
      only = findVenue(places, want);
      if (!only) {
        const names = places.map((v) => v.name).join(' / ');
        return {
          text: `没听说过「${want}」这处。能看的是：${names}。\n（不填 place 就看全部。）`,
          failed: true,
        };
      }
    }

    const trips = this.#savedTrips();
    const allMemories = [...trips, ...(this.#state.keepsakeTrips ?? [])];
    const rack = collectSouvenirs(allMemories, this.timezone, this.#state.collection);
    const target = only ? rack.byPlace.find((p) => p.placeId === only.id) : null;

    const lines = [];
    if (only) {
      const prog = progressFor(only, allMemories, this.#state.collection, this.#state.exploration);
      lines.push('进度按当前场所清单统计；移除或改名的旧项目仍保留在回忆中。');
      const group = target;
      lines.push(`${only.name}的架子（去过 ${prog.visits} 次）：`);
      if (group?.items?.length) {
        for (const it of group.items) {
          const when = it.firstDay ? `${it.firstDay} 记录中最早拿到` : '';
          const times = it.times > 1 ? `，一共 ${it.times} 件` : '';
          lines.push(`- ${it.name}${when ? `（${when}${times}）` : (times ? `（${times.replace('，', '')}）` : '')}`);
          for (const m of it.memories) {
            lines.push(`  ${m.day || '日期不详'}：${m.summary}${m.note ? `；你记的：${m.note}` : ''}`);
          }
          if (it.archivedCount) {
            lines.push(`  另有 ${it.archivedCount} 次更早获得记录已归档；累计数量仍保留。`);
          }
        }
      } else {
        lines.push('（这处还什么都没买过。）');
      }
      // 三条进度：项目 / 纪念品 / 拍照点。说得具体，不报百分比。
      const bits = [];
      bits.push(`逛过 ${prog.areas.done}/${prog.areas.total} 处`);
      if (prog.souvenirs.total) bits.push(`纪念品 ${prog.souvenirs.done}/${prog.souvenirs.total}`);
      if (prog.photos.total) bits.push(`拍过 ${prog.photos.done}/${prog.photos.total} 个点`);
      lines.push(bits.join('，') + '。');
      const leftLine = progressLine(prog, 5);
      if (leftLine) lines.push(leftLine);
      return { text: lines.join('\n') };
    }

    if (!rack.items.length) {
      return { text: '架子上还什么都没有——还没买过纪念品。想逛就 fun_start 或 fun_places 看看。' };
    }

    lines.push(`长期收藏账本里一共 ${rack.items.length} 样东西（${rack.total} 件），来自 ${rack.uniquePlaces} 处地方；详细行程保留最近 40 趟及已珍藏的行程：`);
    for (const group of rack.byPlace) {
      const bits = group.items.map((it) => (it.times > 1 ? `${it.name}×${it.times}` : it.name));
      const when = group.firstDay ? `（最早 ${group.firstDay}）` : '';
      lines.push(`- ${group.placeName}${when}：${bits.join('、')}`);
    }
    // 哪几处快集齐了：这是「再去一次把它补完」的钩子，比总数有用。
    const close = places
      .map((v) => ({ v, p: progressFor(v, trips, this.#state.collection, this.#state.exploration) }))
      .filter((x) => x.p.visits > 0 && x.p.areas.total > 0)
      .sort((a, b) => b.p.percent - a.p.percent || b.p.visits - a.p.visits)
      .slice(0, 3);
    if (close.length) {
      lines.push('快逛遍的：');
      for (const { v, p } of close) {
        const left = p.areas.left.length;
        lines.push(`- ${v.name}：逛过 ${p.areas.done}/${p.areas.total}${left ? `，还差${p.areas.left.slice(0, 3).join('、')}` : '，已经逛遍'}。`);
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
    let scenery = venue.id === 'aquarium' ? aquariumDetail(area) : '';
    if (!scenery) scenery = descNow(venue, nowMin).split('；')[0].replace(/^[^：]*：/, '');
    // 自填地点的描述是用户手写的，可能本来就有句号；别再补一个变成「。。」。
    scenery = scenery.replace(/[。！？.!?]+$/, '');
    const where = n ? `（第 ${n} 处，共 ${venue.areas.length} 处）` : '';
    return `${scenery}。${where}`;
  }

  #homeHint() {
    return '想收就用 fun_home，回执会把这一趟收成一句话。';
  }

  /**
   * 吃 / 喝那句：按 `funTasteFromFeast` 走两条路。
   *
   * 为什么不自动探测 feast 装没装：World 契约不允许一个 World 依赖另一个扩展，
   * 认证会查这条。探测本身就是依赖。所以这一项是**用户自己拨的意愿开关**。
   *
   *   开着 → 告诉她去 `feast_menu` / `feast_eat` 点一道真的，那里才有九维口感
   *   关着 → 只说她在这儿吃了喝了什么，**一个字都不提味道**
   *
   * 两条路都不编味道。开着时她调不到 feast_eat 也会自然退回「只说喝了什么」。
   */
  #foodHint(venue) {
    const f = venue.food;
    const sample = f.items.slice(0, 3).join(' / ');
    const head = `想${f.verb}点什么就自己挑（${sample}…）。`;
    if (!this.#tasteFromFeast()) {
      // 关掉时连「味道」这个词都不该出现——否则她会以为自己该形容一番。
      return `${head}只说你在这儿${f.verb}了什么就够了，一句人话。`;
    }
    // 措辞按「喝 / 吃」分开写，别拼出「喝了什么」这种别扭话。
    return `${head}但味道别自己编：装了「鱼的每一天」就用 feast_menu 挑一道同类的、`
      + `feast_eat 真${f.verb}一口，你才能说得出九维口感、香气和余韵；`
      + `没装就只说在这儿${f.verb}了什么，一句人话，别形容味道。`;
  }

  // -------------------------------------------------------------------------
  // 存取
  // -------------------------------------------------------------------------

  async #load() {
    const day = dayIn(this.timezone, this.#now());
    try {
      const raw = JSON.parse(await readFile(this.stateFile(), 'utf8'));
      return normalizeState(raw, day, this.#now(), this.#ttlMin(), this.timezone);
    } catch {
      return newState(day);
    }
  }

  /**
   * 每次工具调用前把状态对齐到今天。
   *
   * **所有**用到状态的地方都走这一个方法，别在别处直接调 `normalizeState`——
   * `now` 和 `ttlMin` 必须一起传，少传一个就会退回「跨天无脑清 session」的旧行为
   * （夜市凌晨逛着逛着就「你还没进门呢」）。
   */
  #normalizeState() {
    const now = this.#now();
    return normalizeState(this.#state, dayIn(this.timezone, now), now, this.#ttlMin(), this.timezone);
  }

  async #save(state = this.#state) {
    if (!state) return;
    const file = this.stateFile();
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await rename(tmp, file);
  }

  async #commitState(next) {
    await this.#save(next);
    this.#state = next;
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
    const { session, draft } = this.#outings(now);
    const nowMin = minutesIn(this.timezone, now);
    const places = this.#places();
    const openCount = places.filter((v) => hoursState(v, nowMin) !== 'closed').length;
    const badges = [
      {
        label: t.badgePlaces,
        value: `${openCount}/${places.length}`,
        tone: openCount > 0 ? 'plain' : 'off',
      },
    ];
    if (session) {
      const venue = this.#places().find((v) => v.id === session.placeId);
      badges.unshift({
        label: t.badgeSession,
        value: `${session.placeName}·${session.visited.length}/${venue?.areas.length ?? '?'}`,
        tone: 'on',
      });
    }
    if (draft) badges.unshift({ label: '未逛完', value: draft.placeName, tone: 'plain' });
    return {
      label: t.label,
      lamps: [{
        label: t.lamp,
        state: this.#started ? 'online' : 'offline',
        hint: this.#started
          ? (session ? `正在${session.placeName}逛：${visitedText(session)}` : (draft ? `「${draft.placeName}」还没逛完` : '没在逛'))
          : t.stopped,
      }],
      badges,
      panels: [
        {
          id: 'places',
          title: p.places.title,
          description: p.places.description,
          // getMethods 是**只读**方法；save/remove/reset/resetAll 是写方法，
          // 单独声明给宿主看，免得面板被当成纯展示、宿主判定它不需要刷新。
          getMethods: ['list', 'blank', 'history'],
          methods: ['save', 'remove', 'reset', 'resetAll', 'resume', 'closeDraft'],
        },
        { id: 'book', title: p.book.title, description: p.book.description, getMethods: ['list'], methods: ['favorite', 'wish'] },
        { id: 'shelf', title: p.shelf.title, description: p.shelf.description, getMethods: ['list', 'trip'] },
        { id: 'stories', title: this.language === 'en' ? 'Story packs' : '地点剧情包', description: '导入、校验、预览和管理本地原创剧情包。', getMethods: ['list', 'template', 'validate', 'preview', 'export'], methods: ['import', 'enable', 'disable', 'remove'] },
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
      if (panel === 'stories') {
        const reads = ['list', 'template', 'validate', 'preview', 'export'];
        const writes = ['import', 'enable', 'disable', 'remove'];
        const payload = { ...(args?.[0] ?? {}), action: method };
        if (reads.includes(method)) return await this.#storyLibrary.act(payload);
        if (writes.includes(method)) return await this.#serial(() => this.#storyLibrary.act(payload));
        throw new Error('不支持的剧情包操作');
      }
      if (panel === 'places') {
        switch (method) {
          case 'list': return this.#placesData();
          case 'history': return typeof args?.[0]?.placeId === 'string' ? this.#tripLookup({ placeId: args[0].placeId }) : { ok: false, error: '缺少地点 ID。' };
          case 'resume':
          case 'closeDraft': {
            const id = args?.[0]?.id;
            if (typeof id !== 'string' || !id) return { ok: false, error: '缺少未完行程 ID，请刷新后重试。' };
            const result = await this.#serial(() => method === 'resume' ? this.#resumeTool(id) : this.#homeTool({ draftId: id }));
            return result.failed ? { ok: false, error: result.text } : { ok: true, text: result.text.split('\n')[0] };
          }
          // 写方法：只动用户的 venues.json，绝不动预设常量。
          case 'save': return await this.#saveVenue(args?.[0] ?? args ?? {});
          case 'remove': return await this.#removeVenue(args?.[0]?.id ?? args?.id);
          // B 阶段：恢复预设（抹掉这一处 / 全部覆盖层）。
          case 'reset': return await this.#resetVenue(args?.[0]?.id ?? args?.id);
          case 'resetAll': return await this.#resetAllVenues();
          case 'blank': return { ok: true, venue: blankVenue(), feast: this.#tasteFromFeast() };
          default: throw new Error(`places 没有 ${method} 这个方法`);
        }
      }
      if (panel === 'book') {
        switch (method) {
          case 'list': return this.#bookData();
          case 'favorite': return await this.#favorite(args?.[0]?.id, args?.[0]?.keep !== false);
          case 'wish': return await this.#serial(() => this.#manageWish(args?.[0] ?? {}));
          default: throw new Error(`book 没有 ${method} 这个方法`);
        }
      }
      if (panel === 'shelf') {
        switch (method) {
          case 'list': return this.#shelfData();
          case 'trip': return this.#tripLookup({ id: args?.[0]?.id }, true);
          default: throw new Error(`shelf 没有 ${method} 这个方法`);
        }
      }
      throw new Error(`不认识的面板：${panel}`);
    } catch (err) {
      return { ok: false, error: msg(err) };
    }
  }

  /**
   * 保存一个地点：预设写覆盖层，自填写完整场所（B 阶段）。
   *
   * 两条路共用 `cleanUserVenue` 的校验，但落盘形状不同：
   *   - 预设 id → `cleanOverride` 压成稀疏差异存进 overrides（预设升级照常生效）；
   *   - `user-` 前缀 → 完整场所存进 venues（A 阶段原样）；
   *   - 没有 id → 新建自填地点（按名字生成 id）。
   *
   * 预设**不能删**，所以这里不接受「删除预设」；要恢复用 reset / resetAll。
   * 新建自填仍不能撞预设的正名（否则按名字找会二义）；编辑预设时保留正名是合法的。
   */
  async #saveVenue(raw) {
    const list = Array.isArray(this.#userVenues) ? [...this.#userVenues] : [];
    const overrides = { ...(this.#overrides ?? {}) };
    const editingId = typeof raw?.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
    const presetHit = VENUES.find((v) => v.id === editingId);

    if (presetHit) {
      // B 阶段：编辑预设 → 稀疏覆盖层。名字/别名撞别的预设仍要拦（按名字找会二义）。
      const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
      const clash = VENUES.find((v) => v.id !== editingId
        && (v.name === name || (Array.isArray(raw?.aliases)
          && raw.aliases.some((a) => String(a).trim() === v.name))));
      if (clash) {
        return { ok: false, error: `「${clash.name}」是另一处预设的名字，换一个吧——不然按名字找会撞。` };
      }
      const { fields, problems } = cleanOverride(raw, presetHit);
      if (problems.length) return { ok: false, error: problems.join('；') || '这条改动存不下来' };
      if (Object.keys(fields).length) overrides[editingId] = fields;
      else delete overrides[editingId]; // 跟预设一模一样 = 没有覆盖层
      await this.#saveVenueFile(list, overrides);
      this.#host?.log?.info?.('娱乐时间：改了预设场所（覆盖层）', { id: editingId, fields: Object.keys(fields) });
      return { ok: true, venue: this.#places().find((v) => v.id === editingId), places: this.#places().length };
    }

    // 自填地点（新建 / 改自己的）
    if (editingId && !editingId.startsWith(USER_PREFIX)) {
      return { ok: false, error: `不认识的 id「${editingId}」：既不是预设，也不是自己加的地方。` };
    }
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (name && VENUES.some((v) => v.name === name)) {
      return { ok: false, error: `「${name}」是预设里的名字，换一个吧——不然按名字找会撞。` };
    }

    const existingIds = [...VENUES.map((v) => v.id), ...list.map((v) => v.id)];
    const id = editingId || idFromName(name, existingIds);
    const { venue, problems } = cleanUserVenue({ ...raw, id }, { requireId: true });
    if (!venue) return { ok: false, error: problems.join('；') || '这条地点存不下来' };

    const at = list.findIndex((v) => v.id === venue.id);
    if (at >= 0) list[at] = venue;
    else list.push(venue);

    await this.#saveVenueFile(list, overrides);
    this.#host?.log?.info?.('娱乐时间：保存了自填地点', { id: venue.id, name: venue.name, editing: at >= 0 });
    return { ok: true, venue, places: this.#places().length };
  }

  /** 删掉一个用户自己的地点。预设一律拒绝（想还原用 reset）。 */
  async #removeVenue(id) {
    const target = typeof id === 'string' ? id.trim() : '';
    if (!target) return { ok: false, error: '没给 id' };
    if (isPresetId(VENUES, target)) {
      return { ok: false, error: '预设里的地方删不掉；想还原就在编辑表单里点「恢复预设」。' };
    }
    if (!target.startsWith(USER_PREFIX)) {
      return { ok: false, error: '只能删自己加的地方。' };
    }
    const list = (this.#userVenues ?? []).filter((v) => v.id !== target);
    if (list.length === (this.#userVenues ?? []).length) {
      return { ok: false, error: '没找到这个自填地点' };
    }
    await this.#saveVenueFile(list, this.#overrides ?? {});
    this.#host?.log?.info?.('娱乐时间：删掉自填地点', { id: target });
    return { ok: true, places: this.#places().length };
  }

  /** 恢复一处预设：抹掉它的覆盖层（B 阶段「一键恢复」的单处版）。 */
  async #resetVenue(id) {
    const target = typeof id === 'string' ? id.trim() : '';
    if (!target) return { ok: false, error: '没给 id' };
    if (!isPresetId(VENUES, target)) {
      return { ok: false, error: '只能恢复预设里的地方。' };
    }
    const overrides = { ...(this.#overrides ?? {}) };
    if (!(target in overrides)) return { ok: true, places: this.#places().length };
    delete overrides[target];
    await this.#saveVenueFile(this.#userVenues ?? [], overrides);
    this.#host?.log?.info?.('娱乐时间：恢复了一处预设', { id: target });
    return { ok: true, places: this.#places().length };
  }

  /** 一键恢复全部预设：清空整个覆盖层（自填地点不动）。 */
  async #resetAllVenues() {
    const count = Object.keys(this.#overrides ?? {}).length;
    if (!count) return { ok: true, places: this.#places().length, cleared: 0 };
    await this.#saveVenueFile(this.#userVenues ?? [], {});
    this.#host?.log?.info?.('娱乐时间：恢复了全部预设', { cleared: count });
    return { ok: true, places: this.#places().length, cleared: count };
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
    const { session, draft } = this.#outings(now);
    const recommendations = this.#recommendations(allPlaces(nowMin, recent, this.#places()), nowMin, now);
    const places = recommendations.map(({ venue: v, state, phase, areas, wishReason, revisitReason }) => {
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
        kindLabel: KIND_LABEL[v.kind] ?? '自填',
        // 自填的地点：面板上显示「删除这处」；B 阶段起预设也能编辑。
        userVenue: String(v.id).startsWith(USER_PREFIX),
        // 这一处预设被改过（覆盖层非空）：面板上标一下，并提供「恢复预设」。
        overridden: Boolean(this.#overrides?.[v.id] && Object.keys(this.#overrides[v.id]).length),
        hours: v.hours,
        state,
        stateLabel: STATE_LABEL[state],
        // 编辑表单要的是场所自己的完整清单；`areas` 是「此刻能逛的」，
        // 被时段收窄过，不能直接拿去当编辑数据（那样编辑一次会丢掉半天的内容）。
        allAreas: v.areas,
        randomEvents: v.randomEvents ?? [],
        recommendedOutfit: v.recommendedOutfit,
        food: v.food ? { label: v.food.label, items: v.food.items, verb: v.food.verb } : null,
        areas: state === 'closed' ? areasNow(v, nowMin) : areas,
        wishReason,
        revisitReason,
        areaCount: v.areas.length,
        souvenirs: v.souvenirs,
        photoSpots: v.photoSpots,
        recent: recent.includes(v.id),
        // 去过几次：面板上标「去过 3 次」比什么都不说有用。
        visitCount: this.#history(v.id, dayIn(tz, now))?.visitCount ?? 0,
        // 时段：现在处于哪一段、这一处共有哪几段（面板上做「换时间来是另一副样子」的提示）
        phase: phase || null,
        phases: Array.isArray(v.phases) ? v.phases.map((x) => ({
          key: x.key, label: x.label, from: x.from, to: x.to,
          overridesDesc: typeof x.desc === 'string' && Boolean(x.desc.trim()),
          overridesAreas: Array.isArray(x.areas) && x.areas.length > 0,
        })) : [],
        // 有吃有喝的地方：只给品类名和动词，**不给味道**（味道在鱼的每一天里）。
        food: hasFood(v) ? { label: v.food.label, items: v.food.items, verb: v.food.verb } : null,
      };
    });


    return {
      ok: true,
      nowHm: hmIn(tz, now),
      day: dayIn(tz, now),
      ttlMin: this.#ttlMin(),
      askReport: this.#askReport(),
      on: this.#on(),
      // 吃喝了去不去鱼的每一天拿味道：面板上显示成开关状态，让主人知道自己是哪种模式。
      feast: this.#tasteFromFeast(),
      userVenueCount: places.filter((x) => String(x.id).startsWith(USER_PREFIX)).length,
      overriddenCount: Object.keys(this.#overrides ?? {}).length,
      openCount: places.filter((x) => x.state !== 'closed').length,
      total: places.length,
      places,
      session: this.#outingData(session, places, now),
      draft: this.#outingData(draft, places, now, true),
      upcomingWish: this.#upcomingWish(recommendations),
      recommendationIds: recommendations.filter((p) => p.state !== 'closed').slice(0, 3).map((p) => p.venue.id),
      route: this.#state.route ? structuredClone(this.#state.route) : null,
    };
  }

  #outingData(outing, places, now, isDraft = false) {
    if (!outing) return null;
    const tz = this.timezone;
    const venue = places.find((v) => v.id === outing.placeId);
    return {
      id: outing.id,
      placeId: outing.placeId,
      placeName: outing.placeName,
      scene: outing.scene,
      outfit: outing.outfit,
      company: outing.company || '',
      enteredHm: hmIn(tz, outing.enteredAt),
      lastHm: hmIn(tz, outing.lastAt),
      lastDay: dayIn(tz, outing.lastAt),
      stayedMin: outingMinutes(outing, isDraft ? outing.lastAt : now),
      stale: isStale(outing, now, this.#ttlMin()),
      visited: outing.visited.map((v) => ({ area: v.area, note: v.note, hm: hmIn(tz, v.at) })),
      souvenirs: outing.souvenirs,
      photos: outing.photos,
      ate: (outing.ate ?? []).map((x) => ({ item: x.item, verb: x.verb, hm: hmIn(tz, x.at) })),
      events: outing.events,
      pendingChoice: outing.pendingChoice ?? null,
      choices: outing.choices ?? [],
      venueAreaCount: venue?.areas.length ?? null,
      canResume: Boolean(venue),
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
    const { session, draft } = this.#outings(now);
    const recentIds = new Set((st.trips ?? []).map((t) => t.id));
    const keptIds = new Set((st.keepsakeTrips ?? []).map((t) => t.id));
    const keptTrips = new Map((st.keepsakeTrips ?? []).map((t) => [t.id, t]));
    const trips = [...(st.keepsakeTrips ?? []), ...(st.trips ?? [])]
      .map((t) => keptTrips.get(t.id) ?? t)
      .filter((t, i, all) => all.findIndex((x) => x.id === t.id) === i)
      .sort((a, b) => b.leftAt - a.leftAt)
      .map((t) => ({
      id: t.id,
      kept: keptIds.has(t.id) || t.favorite === true,
      routeId: t.routeId || '',
      routeOrder: t.routeOrder || 0,
      timeline: timelineFor(t, tz),
      timelineTruncated: t.timelineTruncated === true,
      archived: !recentIds.has(t.id),
      placeId: t.placeId,
      placeName: t.placeName,
      scene: t.scene,
      outfit: t.outfit,
      company: t.company || '',
      // 用 trip 里存下的本地日期，别拿 leftAt 去反算（UTC 会把早上 8 点前的摊算成前一天）。
      day: tripDay(t, this.timezone),
      enteredHm: t.enteredAt ? hmIn(tz, t.enteredAt) : '',
      leftHm: t.leftAt ? hmIn(tz, t.leftAt) : '',
      stayedMin: t.leftAt && t.enteredAt ? outingMinutes(t, t.leftAt) : 0,
      note: t.note || '',
      visited: t.visited.map((v) => v.area),
      souvenirs: t.souvenirs,
      photos: t.photos,
      ate: (t.ate ?? []).map((x) => ({ item: x.item, verb: x.verb })),
      events: t.events,
      choices: t.choices ?? [],
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
      wishes: structuredClone(st.wishes ?? []),
      places: this.#places().map((v) => ({ id: v.id, name: v.name, areas: v.areas, souvenirs: v.souvenirs, phaseNames: (v.phases ?? []).map((p) => p.label) })),
      totalRecent: st.trips?.length ?? 0,
      totalKept: keptIds.size,
      keepsakeCount: keptIds.size,
      souvenirCount: st.collection?.reduce((n, x) => n + (Number(x.times) || 0), 0) ?? trips.reduce((n, t) => n + t.souvenirs.length, 0),
      photoCount: trips.reduce((n, t) => n + t.photos.length, 0),
      visitedAreaCount: trips.reduce((n, t) => n + t.visited.length, 0),
      mostVisited,
      routes: structuredClone(st.routes ?? []),
      trips,
      session: session ? { placeName: session.placeName, summary: tripSummary(session) } : null,
      draft: draft ? { placeName: draft.placeName, summary: tripSummary(draft) } : null,
    };
  }

  /**
   * 「纪念品架」面板：跨趟归集的收藏 + 每处的集齐进度。
   *
   * 只读、幂等、不写盘（和 book / places 同一套契约）。数据全部从 `trips`
   * 现算，所以面板永远和纪念册一致，不会出现「架子上有、册子里没有」。
   */
  #shelfData() {
    const now = this.#now();
    const st = this.#state ?? newState(dayIn(this.timezone, now));
    const trips = this.#savedTrips();
    const allMemories = [...trips, ...(st.keepsakeTrips ?? [])];
    const rack = collectSouvenirs(allMemories, this.timezone, st.collection);
    const detailMemories = new Map(allMemories.map((t) => [t.id, t]));
    for (const item of rack.items) {
      item.memories = (st.collection ?? []).find((x) => x.key === item.key)?.tripIds
        ?.map((id) => detailMemories.get(id)).filter(Boolean).map((t) => ({ id: t.id, day: tripDay(t, this.timezone), summary: tripSummary(t), note: t.note, company: t.company })) ?? item.memories;
      if (item.memories.length < item.times) item.archivedCount = item.times - item.memories.length;
    }
    const places = this.#places();

    // 每一处都给进度：面板上按「去过但没逛遍」排前面，没去过的排最后。
    const progress = places.map((v) => {
      const p = progressFor(v, trips, st.collection, st.exploration);
      return {
        placeId: v.id,
        placeName: v.name,
        scene: v.scene,
        visits: p.visits,
        phases: explorationFor(st.exploration, v.id)?.phases ?? [],
        percent: p.percent,
        areas: { done: p.areas.done, total: p.areas.total, left: p.areas.left, complete: p.areas.complete },
        souvenirs: { done: p.souvenirs.done, total: p.souvenirs.total, left: p.souvenirs.left, complete: p.souvenirs.complete },
        photos: { done: p.photos.done, total: p.photos.total, left: p.photos.left, complete: p.photos.complete },
        items: rack.byPlace.find((g) => g.placeId === v.id)?.items ?? [],
      };
    });
    // 去过 > 没逛遍 > 逛遍了，同级按完成度降序。
    const rank = (x) => {
      if (!x.visits) return 2;
      const allDone = x.areas.complete && (x.souvenirs.total === 0 || x.souvenirs.complete)
        && (x.photos.total === 0 || x.photos.complete);
      return allDone ? 1 : 0;
    };
    progress.sort((a, b) => rank(a) - rank(b) || b.percent - a.percent || b.visits - a.visits);

    return {
      ok: true,
      total: rack.items.length,
      pieces: rack.total,
      places: rack.uniquePlaces,
      visitedPlaces: progress.filter((x) => x.visits > 0).length,
      completePlaces: progress.filter((x) => rank(x) === 1).length,
      items: rack.items,
      byPlace: rack.byPlace,
      progress,
    };
  }

  /** 清空她的出游记录（存储页「清掉」）。只清 state 这一份，不碰别的 World。 */
  async #clearState() {
    return this.#serial(async () => {
      await this.#commitState(newState(dayIn(this.timezone, this.#now())));
      this.#host?.log?.info?.('娱乐时间：出游记录已清空');
      return { ok: true };
    });
  }

  // -------------------------------------------------------------------------
  // 生命周期
  // -------------------------------------------------------------------------

  async start(host) {
    if (this.#started) return;
    this.#host = host;
    this.#ensureConfigSection();
    this.#state = await this.#load();
    // 用户自填地点 + 预设覆盖层：读失败就当没有，预设照常能逛。
    const venueFile = await this.#loadVenueFile();
    this.#userVenues = venueFile.venues;
    this.#overrides = venueFile.overrides;
    await this.#storyLibrary.load();
    this.#started = true;
    this.#host?.log?.info?.('娱乐时间已启动', {
      places: this.#places().length,
      userVenues: this.#userVenues.length,
      overridden: Object.keys(this.#overrides).length,
      session: this.#state.session?.placeName ?? null,
      trips: this.#state.trips.length,
    });
  }

  async stop() {
    this.#started = false;
    await this.#serial(async () => {
      try { await this.#save(); } catch { /* 停的时候存不上就算了 */ }
      this.#host = null;
    });
  }
}

/** 给面板/测试用的场所名清单（正名 + 别名一起）。可传合并后的表。 */
export function venueNames(venues = VENUES) {
  return venues.flatMap((v) => [v.name, ...v.aliases]);
}

export { KIND_LABEL, VENUES };
