/**
 * 从0开始的肥鱼大冒险 World。
 *
 * 她一直「有地方可去，但没有真的去成」：发动态、刷视频、逛客厅都是零碎的，
 * 没有一趟**有头有尾**的出门。这个 World 补的就是这一趟：
 *
 *   - `fun_places` 看今天哪几处开着、人多不多；
 *   - `fun_go` 进门，回执给当下的描写和能逛什么；
 *   - `fun_wander` 一处一处地逛：过山车、鲸豚湾、捞金鱼、同人展台；
 *   - 买纪念品、拍照点各有一个小口子（在 `fun_wander` 回执里递到嘴边）；
 *   - `fun_home` 回家，回执把这一趟收成一句话，交给她 `feast_life_play` 记一笔。
 *
 * **出门许可跟随「她自己的时间」**：`funHomeAutoGo` 只是主人的许可，不再自带
 * 叫醒时段——几点算她自己的时间由「鱼的每一天」的「她自己的时间」决定。
 * 本 World **不读**「鱼的每一天」的日程、不挑地方、不替她出门、也不注册自己的
 * 叫醒定时器；没有别人的叫醒时，这条许可只在提示词里等她主动用。
 *
 * 状态是纯 JSON，落在 `<dataDir>/fun/state.json`；历史保留，跨天超时的行程等待续逛或回家。
 *
 * 红线（World 契约）：不调别的 World 的工具、不读别人的状态或日程文件、
 * `envPromptVars()` 永不抛错、`create()` 保持纯。
 */
import { copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
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
  blankVenue, cleanOverride, cleanUserVenue, idFromName, isPresetId,
  isUserPlaceId, mergeVenues, parseVenueFile, stringifyVenueFile,
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
import { readStoryQuery } from './story-read.js';
import { randomUUID } from 'node:crypto';
import { pickStory, advanceStoryChoice, normalizeStoryProgress, storyReferences } from './story-packs.js';
import { describeMemory, describePack, describeStoryTrip, requestStoryDecision, STORY_ACTIONS, storyFailure, storyStamp, StoryAutonomy } from './story-panel.js';
import { jointActor, jointCanVote, jointDecision, jointView } from './joint.js';
import {
  continueFreeSegment, effectiveMaxTurns, freeCanContinue, freePromptPayload, freeSummaryText, freeTurn, freeTurnsLeft,
  isFreePack, newFreeState, normalizeFreeState, requestFreeTurn,
} from './story-free.js';
import { StorySecrets } from './story-secrets.js';
import { DEFAULT_STORY_NODE_LIMIT, MAX_STORY_NODE_LIMIT, StoryNodeLimit } from './story-node-limit.js';
import { StoryImages, validateStoryImageSource, validateStoryWorkflow } from './story-images.js';
import { markVenueMigration, markPromotedVenueMigration, migratePromotedVenues, migrateSampleVenue } from './story-venue-migration.js';
import {
  MAX_TRASH_TRIPS, MAX_TRIPS, buySouvenir, closeSession, dayIn, enterVenue, favoriteTrip, hmIn, isStale, minutesIn,
  newState, normalizeState, outingMinutes, outingStatus, recentPlaceIds, recordConsume,
  takePhoto, tripDay, tripSummary, visitedText, wanderOnce,
} from './state.js';

import { autoLimits, budgetStop, normalizeStoryReceipts, publicStoryReceipt, storyBudget, storyRequestKey } from './story-reliability.js';
import { StoryDM, addDmUsage, dmBudget } from './story-dm.js';
import { PlaceLibrary } from './place-library.js';
import { ACTIVITIES, ACTIVITY_HINTS, ACTIVITY_LABELS, HomeRoom, defaultActivityAt, phaseAtHour, souvenirCategory } from './home-room.js';
const ENV_PROMPT = fileURLToPath(new URL('./ENV_PROMPT.md', import.meta.url));
/** 面板委派出去的配图请求，在她的提示词里保留多久。 */
const IMAGE_DELEGATION_TTL_MS = 45 * 60 * 1000;
/** 六个只读故事查询的记忆化窗口：同一参数 10 分钟内只回一条「没变化」。 */
const STORY_READ_TTL_MS = 10 * 60 * 1000;
/** 只读查询里唯一允许穿透缓存、强制重取的参数。 */
const FULL_QUERY = { type: 'boolean', description: '跳过 10 分钟记忆化，重取完整结果。' };
/**
 * 文字通道关着时不暴露的故事工具：`start/act` 调了也只会报「未开启」，
 * `places/current/recap/schedule` 是文字通道在推进时才会用的查询。
 * 保留 `candidates` / `detail` 两个，应对聊天里问「有什么故事」。
 */
const STORY_TEXT_ONLY = [
  'fun_story_start', 'fun_story_act', 'fun_story_places', 'fun_story_current', 'fun_story_recap', 'fun_story_schedule',
];

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
          description: '筛一类：大类（「户外」）、感受（「室内」「夜」「免费」）或某处正名（「猫咖」）。',
        },
        all: { type: 'boolean', description: 'true = 列全部地点，忽略 count。' },
        now: { type: 'boolean', description: 'true = 查看此刻推荐的五处地点。' },
      },
      additionalProperties: false,
    },
  },
{
    name: 'fun_go',
    tags: ['write'],
    description: '开始一趟出游，返回当下描写与可逛项目。place 用 fun_places 给的地点名或别名。',
    parameters: {
      type: 'object',
      properties: {
        place: { type: 'string', description: '去哪儿，如「海洋馆」。' },
        company: { type: 'string', description: '同行人，可选；一个人不填。' },
        tripId: { type: 'string', description: '继续这趟未完行程时填 fun_journal 返回的行程 ID。' },
      },
      required: ['place'],
      additionalProperties: false,
    },
  },
{
    name: 'fun_wander',
    tags: ['write'],
    description: '在当前地点逛一处；可记录本次真实收获。遇到待选小事件时按回执中的选项处理。',
    parameters: {
      type: 'object',
      properties: {
        choiceId: { type: 'string', description: '待选回执中的 choiceId。' },
        optionId: { type: 'string', description: '待选回执中的 optionId，或 skip。' },
        area: { type: 'string', description: '逛哪儿，如「过山车」；不填自动挑一处没逛过的。' },
        note: { type: 'string', description: '一句话，可选。' },
        buy: { type: 'string', description: '买了什么，填 souvenir 名。' },
        photo: { type: 'string', description: '在哪儿拍照，填 photoSpot 名。' },
        consume: { type: 'string', description: '只填这处真有的品类。只记名字不记味道——味道用 feast_menu/feast_eat 去「鱼的每一天」点。' },
      },
      additionalProperties: false,
    },
  },
{
    name: 'fun_home',
    tags: ['write'],
    description: '回家，把已发生的经历记入纪念册。',
    parameters: {
      type: 'object',
      properties: {
        note: { type: 'string', description: '一句话，可选。' },
        draftId: { type: 'string', description: '按已有记录结束未完行程时填 fun_view 的 ID；结束正在逛的不填。' },
      },
      additionalProperties: false,
    },
  },
  { name: 'fun_home_room', tags: ['read', 'write', 'snapshot'], description: '读取房间状态；可切换活动并写备注或今天计划，不会写入出游经历。', parameters: { type: 'object', properties: { activity: { type: 'string', description: '可选：idle / reading / watching / cards / gaming / painting / cooking / looking_outside / sleeping / chatting。' }, note: { type: 'string', description: '可选房间备注。' }, pose: { type: 'string', description: 'activity 的兼容别名。' } }, additionalProperties: false } },
{
    name: 'fun_story',
    tags: ['write'],
    description: '管理本地故事工坊：校验/预览只读，导入、改绑地点、启停、删除要指定 action。需打开「聊天里也能管故事」才挂。',
    parameters: { type: 'object', properties: {
      action: { type: 'string', enum: ['list', 'template', 'validate', 'preview', 'playtest', 'export', 'import', 'rebind', 'enable', 'disable', 'remove'] },
      id: { type: 'string', description: '已有包 ID（list 取）。' },
      json: { type: 'string', description: '完整包 JSON，≤32 KB；validate/preview 不保存。' },
      placeId: { type: 'string', description: 'template 绑定的地点 ID；rebind 要绑到的新地点 ID（list 可查）。' },
      bindPlaceId: { type: 'string', description: 'import 时把包里不存在的地点改绑到这处已有地点。' },
      mode: { type: 'string', enum: ['static', 'free'], description: 'template 类型：static 选项式（默认）/ free 场景包。' },
      area: { type: 'string', description: 'preview 的项目，默认起始项目。' },
      time: { type: 'string', description: 'preview 的测试时刻 HH:MM，默认现在。' },
      path: { type: 'array', maxItems: 16, items: { type: 'string', maxLength: 24 }, description: 'playtest 已选的路径，只用临时状态。' },
      replace: { type: 'boolean', description: 'import 覆盖同 ID 包时设 true。' },
    }, required: ['action'], additionalProperties: false },
  },
{
    name: 'fun_story_places', tags: ['read', 'snapshot'],
    description: '查询故事地点索引或单个地点详情；只读，不开始出游。',
    parameters: { type: 'object', properties: { id: { type: 'string', description: '地点 ID；不填返回索引。' }, full: FULL_QUERY }, additionalProperties: false },
  },
{
    name: 'fun_story_candidates', tags: ['read', 'snapshot'],
    description: '查询可用故事候选和公开简介（不含未来分支）；只读。',
    parameters: { type: 'object', properties: { full: FULL_QUERY }, additionalProperties: false },
  },
{
    name: 'fun_story_detail', tags: ['read', 'snapshot'],
    description: '查询一篇故事的公开资料与可用原因，不含节点全文。',
    parameters: { type: 'object', properties: { id: { type: 'string', description: '故事 ID。' }, full: FULL_QUERY }, required: ['id'], additionalProperties: false },
  },
{
    name: 'fun_story_current', tags: ['read', 'snapshot'],
    description: '查询当前故事的状态、已发生片段与待选项；不推进。',
    parameters: { type: 'object', properties: { full: FULL_QUERY }, additionalProperties: false },
  },
{
    name: 'fun_story_recap', tags: ['read', 'snapshot'],
    description: '查询已结束故事的事实回顾，只含实际发生。',
    parameters: { type: 'object', properties: { id: { type: 'string', description: '回忆 ID；不填取最近。' }, full: FULL_QUERY }, additionalProperties: false },
  },
{
    name: 'fun_story_schedule', tags: ['read', 'snapshot'],
    description: '生成候选的可复制短文本；复制不写日程、不出发。',
    parameters: { type: 'object', properties: { id: { type: 'string', description: '候选 ID，可选。' }, full: FULL_QUERY }, additionalProperties: false },
  },
  { name: 'fun_journal', tags: ['read', 'write', 'snapshot'], description: '查看行程、纪念品或珍藏；也可珍藏或取消珍藏行程。故事回顾请用 fun_story_recap。', parameters: { type: 'object', properties: { view: { type: 'string', enum: ['trips', 'shelf', 'keepsake'], description: '查看行程、纪念品展示柜或珍藏列表。' }, id: { type: 'string', description: '行程 ID。' }, keep: { type: 'boolean', description: '配合 id 珍藏或取消珍藏。' } }, required: ['view'], additionalProperties: false } },
{
    name: 'fun_story_start', tags: ['write'],
    description: '在聊天里开始一段故事（需开「文字通道也能玩故事」）。先从 fun_story_candidates / detail 取 packId、revision，从 fun_story_current 取 startStamp；开始前会重校验。用户明确说要开始才填 confirm:true。',
    parameters: {
      type: 'object',
      properties: {
        packId: { type: 'string', description: '候选里的故事 ID。' },
        revision: { type: 'string', description: '候选里的版本。' },
        startStamp: { type: 'string', description: 'fun_story_current 的 startStamp。' },
        confirm: { type: 'boolean', description: '用户明确说要开始时填 true。' },
        party: { type: 'array', description: '群聊参与者，可选。', items: { type: 'object', properties: { who: { type: 'string' }, tag: { type: 'string' } }, required: ['who'], additionalProperties: false } },
      },
      required: ['packId', 'revision', 'startStamp', 'confirm'],
      additionalProperties: false,
    },
  },
{
    name: 'fun_story_act', tags: ['write'],
    description: '在聊天里推进当前故事，把用户原话交给它，不替用户编选择。选项式按回合身份提交：用户回合记 owner，鱼回合由鱼决定；原话对不上先返回 proposalId，确认后再带 proposalId+optionId。自由模式每句一回合；结束用 intent:close + confirm:true。',
    parameters: {
      type: 'object',
      properties: {
        tripId: { type: 'string', description: 'fun_story_current 的行程 ID。' },
        stamp: { type: 'string', description: 'fun_story_current 的进度戳；变了重读，别猜。' },
        intent: { type: 'string', enum: ['say', 'close', 'redo'], description: 'say 推进；close 结束；redo 重跑当前回合。' },
        say: { type: 'string', description: '用户原话。' },
        actions: { type: 'array', description: '多人动作一次性汇总提交。', items: { type: 'object', properties: { who: { type: 'string' }, say: { type: 'string' } }, required: ['who', 'say'], additionalProperties: false } },
        proposalId: { type: 'string', description: '上次返回的提议 ID。' },
        optionId: { type: 'string', description: '确认提交的选项 ID。' },
        from: { type: 'string', description: 'QQ 昵称，仅日志归属，可选。' },
        confirm: { type: 'boolean', description: 'intent 为 close 时填 true。' },
      },
      required: ['tripId', 'stamp', 'intent'],
      additionalProperties: false,
    },
  }
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
  #autonomy = new StoryAutonomy();
  #dm = new StoryDM();
  #storyEpoch = randomUUID();
  #storyCommit;
  /** 文字通道里"待确认"的选项提议（只在内存里，5 分钟或进度变化就失效）。 */
  #textProposal = null;
  #stateError;
  #locationLibrary;
  /** 第七个面板「家」的 2D 房间状态：只写 `fun/home/`，不碰 `state.json`。 */
  #home;
  #storySecrets;
  #storyNodeLimit;
  #storyImages;
  /** 主人在面板上点过「给你画一张」的委派参数（只在内存里，45 分钟或下一次委派就换掉）。 */
  #imageDelegation = null;
  /** 自动配图：上一次准备过参数的进度戳，同一个戳不重复准备。 */
  #autoImageStamp = '';
  #venueMigrationError;
  /** 只读故事查询的记忆化：键 = 工具 + 参数，值 = 上一次的完整回执。 */
  #readCache = new Map();
  /** 任何写操作（工具或面板）都 +1；缓存条目的 epoch 对不上就作废。 */
  #cacheEpoch = 0;

  constructor(opts = {}) {
    this.id = ID;
    this.#rawCfg = opts.cfg ?? {};
    this.dataDir = opts.dataDir ?? process.cwd();
    this.language = 'zh';
    this.timezone = opts.timezone || 'Asia/Shanghai';
    this.#now = typeof opts.now === 'function' ? opts.now : () => Date.now();
    this.#random = typeof opts.random === 'function' ? opts.random : Math.random;
    this.#persist = typeof opts.persist === 'function' ? opts.persist : null;
    this.#storySecrets = new StorySecrets({ dataDir: this.dataDir, onInvalidate: () => this.#dm.cancel(),
      url: () => this.cfg?.funStoryDmUrl, model: () => this.cfg?.funStoryDmModel });
    this.#storyNodeLimit = new StoryNodeLimit({ dataDir: this.dataDir });
    this.#storyImages = new StoryImages({ dataDir: this.dataDir, source: () => this.cfg?.funStoryImageSource });
    this.#locationLibrary = new PlaceLibrary({
      dataDir: this.dataDir,
      venues: () => this.#allPlaces(),
      saveVenue: (raw) => this.#saveVenue(raw),
      removeVenue: (id) => this.#removeVenue(id),
    });
    this.#home = new HomeRoom({ dataDir: this.dataDir, now: () => this.#now() });
    this.#storyLibrary = new StoryLibrary({ file: this.storiesFile(), venues: () => this.#places(), visits: (id) => this.#state ? this.#history(id)?.visitCount ?? 0 : 0, nowMin: () => minutesIn(this.timezone, this.#now()), nodeLimit: () => this.#storyNodeLimitValue() });
  }

  get cfg() { return { ...DEFAULTS, ...(this.#rawCfg ?? {}) }; }

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
      this.#host?.log?.info?.('从0开始的肥鱼大冒险：配置段补齐了缺失的键', { keys: Object.keys(patch) });
    } catch (err) {
      this.#host?.log?.warn?.('从0开始的肥鱼大冒险：配置段没补齐（界面可能显示和实际不一致）', { err: msg(err) });
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
   * 地点表：预设 20 处（可带覆盖层）+ 用户自己的（含从旧地点库迁来的不可玩地点）。
   *
   * **永远返回数组，永远不抛错**——场所表读不出来时退回纯预设，
   * 这个 World 照常能逛（降级是第一公民）。
   *
   * 合并规则见 `user-venues.js`：用户改动优先，预设升级照常生效。
   * 这个方法是同步的（工具回执要即时算），所以用户数据在 `#load` 时读进内存。
   */
  #allPlaces() {
    try {
      const users = Array.isArray(this.#userVenues) ? this.#userVenues : [];
      return mergeVenues(VENUES, users, this.#overrides);
    } catch (err) {
      this.#host?.log?.warn?.('从0开始的肥鱼大冒险：场所合并失败，退回预设', { err: msg(err) });
      return [...VENUES];
    }
  }

  /**
   * 能逛的场所：玩法只看这一份。
   *
   * C 版把地点库并进 venues 之后，`#allPlaces()` 里也会有「只是地图上一个点」
   * 的不可玩地点（`playable:false` / 没有能逛的）。出去玩、推荐、行程校验
   * 一律用这里，语义和重构前完全一样。
   */
  #places() {
    return this.#allPlaces().filter((v) => v.playable !== false && Array.isArray(v.areas) && v.areas.length > 0);
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
    if (this.#venueMigrationError) throw new Error(this.#venueMigrationError);
    const file = this.venuesFile();
    await mkdir(dirname(file), { recursive: true });
    await markVenueMigration(file);
    await markPromotedVenueMigration(file);
    const tmp = `${file}.tmp`;
    await writeFile(tmp, stringifyVenueFile({ venues, overrides }), 'utf8');
    await rename(tmp, file);
    this.#userVenues = venues;
    this.#overrides = overrides;
    // 地点名/别名/开放时段都进了 `fun_story_places` 与候选卡，写完必须让缓存重取。
    this.#bumpCache();
  }

  /**
   * C 版迁移：把旧地点库 `data.places` 里的「基础地点」搬进 venues.json。
   *
   * 为什么必须保留原 id：relations / homeId / 故事绑定 / 历史行程里存的都是
   * `place-<uuid>`，换 id 等于把这些关系全断掉。
   *
   * 安全线：动任何东西之前先留 `venues.json` 与 `library.json` 的备份；
   * 任何一步失败就回滚 library.json、把错误记到 `#venueMigrationError`
   * （之后 `#saveVenueFile` 一律拒绝，宁可不能存也不要用半套数据覆盖）。
   */
  async #migrateLegacyPlaces() {
    const library = this.#locationLibrary;
    let taken;
    try {
      taken = await library.takeLegacyPlaces();
    } catch (err) {
      this.#venueMigrationError = this.#venueMigrationError
        ?? `旧地点库迁移失败；已保留原文件，暂不允许保存地点。（${msg(err)}）`;
      return;
    }
    const legacy = Array.isArray(taken?.places) ? taken.places : [];
    if (!legacy.length) return;

    const byId = new Map((this.#userVenues ?? []).map((venue) => [venue.id, venue]));
    const extras = [];
    for (const row of legacy) {
      if (!row || typeof row !== 'object' || !row.id) continue;
      const { venue, problems } = cleanUserVenue({
        id: row.id, kind: row.kind, name: row.name, desc: row.desc,
        aliases: row.aliases, tags: row.tags, scene: row.scene,
        playable: false, hours: { open: '00:00', close: '23:59' },
      }, { requireId: true });
      if (!venue) {
        this.#host?.log?.warn?.('从0开始的肥鱼大冒险：旧地点没法迁移，先跳过', { id: row.id, problems });
        continue;
      }
      // 迁移来的地点是「地图上的一个点」，不是能逛的场所。
      venue.playable = false;
      byId.set(venue.id, venue);
      extras.push({ id: venue.id, style: row.style, relations: row.relations, cover: row.cover, coverFocus: row.coverFocus });
    }

    const restoreLibrary = async () => {
      if (taken?.backup) await copyFile(taken.backup, library.file).catch(() => {});
    };
    // venues.json 也留一份备份（不存在就跳过）。
    try {
      const file = this.venuesFile();
      const bytes = await readFile(file).catch((err) => {
        if (err?.code === 'ENOENT') return null;
        throw err;
      });
      if (bytes) await writeFile(`${file}.bak-c-${Date.now()}`, bytes, { flag: 'wx' });
    } catch (err) {
      await restoreLibrary();
      this.#venueMigrationError = this.#venueMigrationError
        ?? `地点表备份失败；已保留原文件，暂不允许保存地点。（${msg(err)}）`;
      return;
    }
    try {
      await this.#saveVenueFile([...byId.values()], this.#overrides ?? {});
    } catch (err) {
      await restoreLibrary();
      this.#venueMigrationError = this.#venueMigrationError
        ?? `旧地点迁移写入失败；已从备份恢复地点库，暂不允许保存地点。（${msg(err)}）`;
      return;
    }
    for (const item of extras) {
      try {
        await library.adoptExtras(item.id, item);
      } catch (err) {
        await restoreLibrary();
        this.#venueMigrationError = this.#venueMigrationError
          ?? `旧地点的画风/关联/封面迁移失败；已从备份恢复地点库，暂不允许保存地点。（${msg(err)}）`;
        return;
      }
    }
    this.#host?.log?.info?.('从0开始的肥鱼大冒险：旧地点库已并进地点表', { migrated: extras.length });
  }

  // -------------------------------------------------------------------------
  // 提示词
  // -------------------------------------------------------------------------

  /** This World adds no dynamic venue list to the always-present prompt. */
  envPromptVars() {
    return { fun_places_block: this.#imageDelegationBlock() + this.#selfGoBlock() };
  }

  /**
   * 主人允许她自己出门时，加一句许可：不限次数，但要落在她当天的日程里。
   * 时段不归本插件管——「她自己的时间」由「鱼的每一天」决定，那边叫醒她时，
   * 这一段许可让她可以把空着的时段当成出门的许可；本插件不叫醒、不挑地方。
   */
  #selfGoBlock() {
    if (this.cfg?.funHomeAutoGo !== true) return '';
    return '\n\n### 主人允许你自己出门（不限次数）\n'
      + '想出去就出去，不用等主人开口。出门的时间跟着「鱼的每一天」的「她自己的时间」走：'
      + '那边叫醒你时，先用 feast_life_now 看这会儿本来安排了什么——日程空着，就把这一趟当成你自己的出门；'
      + '写着上班、通勤或睡觉就不出门。要改计划就用 feast_life_adjust 把这一段改成出门；'
      + '几点、去哪儿、去几次都由你和主对话定，我不会替你挑地方，也不会自己把你送出门。回来用 feast_life_play 记一笔。';
  }

  /**
   * 面板只生成"委派参数"，真正画图的是主对话（也就是她）。参数如果只留在面板上，
   * 她永远不知道主人点过这一下——所以把还没过期的那一份递进提示词里，让"想不想画"有据可依。
   */
  #imageDelegationBlock() {
    const pending = this.#imageDelegation;
    if (!pending) return '';
    const age = this.#now() - pending.at;
    if (!(age >= 0 && age <= IMAGE_DELEGATION_TTL_MS)) { this.#imageDelegation = null; return ''; }
    const scene = pending.scene ? `scene 填「${pending.scene}」` : 'scene 不用填';
    const outfits = pending.outfits ? `outfits 填「${pending.outfits}」` : 'outfits 按当时的样子';
    const when = age < 60_000 ? '刚刚' : `${Math.round(age / 60000)} 分钟前`;
    const title = pending.by === 'auto'
      ? `### 这一处可以配一张图（${when}自动准备的参数）`
      : `### 主人刚在面板上给你点了一张图（${when}）`;
    const who = pending.by === 'auto' ? '不是主人点的，是自动准备的；' : '';
    return `\n\n${title}\n`
      + `用 imggen_draw 画的话：${scene}，${outfits}，prompt 用「${pending.prompt}」。\n`
      + `${who}想画就画；不想画、或者已经画过了就不用管。这条 45 分钟后自己消失，不要反复提。`;
  }

  // -------------------------------------------------------------------------
  // 工具
  // -------------------------------------------------------------------------

  tools() {
    // 工具面按开关收窄，schema 是每轮都要带的固定开销：
    //   · 文字通道关着 → 只留 candidates / detail，应付聊天里「有什么故事」；
    //   · 作者工具默认不挂（面板走 #invoke，不靠工具写故事）。
    // 宿主每轮会重新取一次 tools()，改开关立即生效。
    const textOn = this.cfg?.funStoryTextOn === true;
    const authorOn = this.cfg?.funStoryAuthorInChat === true;
    const hidden = new Set();
    if (!textOn) for (const name of STORY_TEXT_ONLY) hidden.add(name);
    if (!authorOn) hidden.add('fun_story');
    return FUN_TOOL_DECLS
      .filter((decl) => !hidden.has(decl.name))
      .map((decl) => ({
        ...decl,
        handler: (args) => this.#runTool(decl.name, args ?? {}),
      }));
  }

  /** 写操作把整张只读缓存清掉；读操作不动。 */
  #bumpCache() {
    this.#cacheEpoch += 1;
    if (this.#readCache.size) this.#readCache.clear();
  }

  /** 缓存键：参数按键名排序，`full` 不参与（它只是穿透，不是另一个查询）。 */
  #readCacheKey(name, args) {
    const { full: _full, ...rest } = args ?? {};
    const keys = Object.keys(rest).sort();
    return `${name}\u0000${JSON.stringify(keys.map((key) => [key, rest[key]]))}`;
  }

  /**
   * 命中就回一条短回执：`{ok, unchanged:true, since, hint}`。
   *
   * 只读工具的大头是 `fun_story_places` / `fun_story_candidates`（各约 1.8k 字符）；
   * 同一份东西一天问六次就是一万字符。`full:true` 是逃生门，绕过记忆化重取。
   */
  #readCacheGet(name, args) {
    if (args?.full === true) return null;
    const hit = this.#readCache.get(this.#readCacheKey(name, args));
    if (!hit || hit.epoch !== this.#cacheEpoch) return null;
    const age = this.#now() - hit.at;
    if (!(age >= 0 && age <= STORY_READ_TTL_MS)) {
      this.#readCache.delete(this.#readCacheKey(name, args));
      return null;
    }
    const short = {
      ok: true, unchanged: true, since: hit.since, tool: name,
      hint: '同一查询 10 分钟内结果没变；上下文里已有完整内容就别再问。被截断了再加 full:true 重取一次。',
    };
    return { ...short, text: JSON.stringify(short) };
  }

  /** 只在成功时记；失败不缓存，免得把一次临时错误钉住 10 分钟。 */
  #readCacheSet(name, args, result) {
    this.#readCache.set(this.#readCacheKey(name, args), {
      epoch: this.#cacheEpoch,
      at: this.#now(),
      since: hmIn(this.timezone, Number(result?.queryAt) || this.#now()),
    });
  }

  #runTool(name, args) {
    return this.#serial(async () => {
      // 写工具一律先清只读缓存：`fun_story_current` 这类回执必须反映最新写结果。
      if (FUN_TOOL_DECLS.find((decl) => decl.name === name)?.tags?.includes('write')) this.#bumpCache();
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
      case 'fun_places': return args?.now === true ? this.#startTool() : this.#placesTool(args);
      case 'fun_go': return args?.tripId ? await this.#resumeTool(args.tripId) : await this.#goTool(args);
      case 'fun_wander': return args?.choiceId ? await this.#choiceTool({ choiceId: args.choiceId, optionId: args.optionId }, this.#state.session?.storyRun?.participation === 'duo' ? 'fish' : undefined) : await this.#wanderTool(args, this.#state.session?.storyRun?.participation === 'duo' ? 'fish' : undefined);
      case 'fun_home': {
        if ((this.#state.session ?? this.#state.draft)?.storyRun?.participation === 'duo') return { failed: true, text: '双人故事由用户在故事面板明确结束，鱼不能代替用户回家。' };
        return await this.#homeTool(args);
      }
      case 'fun_home_room': { if (!args?.activity && !args?.pose && !args?.note) return await this.#homeStateTool(); const state = await this.#homeState(); return await this.#homeActivityTool({ activity: args.activity ?? args.pose ?? state.room.activity, note: args.note, expectedRevision: state.revision }); }
      case 'fun_journal': { this.#state = this.#normalizeState(); if (args.view === 'trips') return this.#viewTool({ id: args.id }); if (args.view === 'shelf') return this.#shelfTool({}); if (args.view === 'keepsake') { if (args.id) return await this.#keepsakeTool({ id: args.id, keep: args.keep }); return this.#viewTool({ kept: true }); } return { text: 'view 只能是 trips、shelf 或 keepsake。', failed: true }; }
      case 'fun_story_places':
      case 'fun_story_candidates':
      case 'fun_story_detail':
      case 'fun_story_current':
      case 'fun_story_recap':
      case 'fun_story_schedule': {
        const cached = this.#readCacheGet(name, args);
        if (cached) return cached;
        let result;
        try { result = await this.#storyRead(name, args); }
        catch (error) { result = { ok: false, code: 'QUERY_FAILED', error: msg(error) }; }
        const receipt = { ...result, text: JSON.stringify(result), ...(result.ok ? {} : { failed: true }) };
        if (result.ok) this.#readCacheSet(name, args, result);
        // The host model consumes text; keep typed fields for direct local callers.
        return receipt;
      }
      case 'fun_story': {
        const result = await this.#storyLibrary.act(args);
        return { text: storyResultText(result), ...(result.ok ? {} : { failed: true }) };
      }
      case 'fun_story_start': return this.#storyTextStart(args);
      case 'fun_story_act': return this.#storyTextAct(args);
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
      if (next.session || next.draft) return { text: '这一站还没有回家，请先完成或处理未完行程。', failed: true };
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
    return `「${draft.placeName}」还有一趟未逛完（ID：${draft.id}）。用 fun_resume 填 id 继续，或用 fun_home 填 draftId 按已有记录回家。`;
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
      return { text: `「${draft.placeName}」已不在地点清单。可用 fun_home 填 draftId 按已有记录回家。`, failed: true };
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

  async #choiceTool(args, actor, reason) {
    const next = this.#normalizeState();
    if (next.draft) return { text: this.#draftHint(next.draft), failed: true };
    const session = next.session;
    if (!session?.pendingChoice) return { text: '现在没有待选择的事件。', failed: true };
    const choice = session.pendingChoice;
    if (args?.choiceId !== choice.id) return { text: this.#choiceHint(choice), failed: true };
    let submitter = actor ?? 'owner';
    let optionId = args?.optionId;
    let jointVotes;
    let substituted = false;
    if (choice.actor === 'owner' && submitter !== 'owner') return { text: '当前是用户回合，鱼不能代替用户提交。', failed: true };
    if (choice.actor === 'fish' && submitter !== 'fish') {
      // 「我替她选」只在鱼这一步真的没法自己决定时才成立：认知接口不可用，
      // 或者这一趟的决定次数/本步重试已经用满。否则鱼的回合仍由鱼自己提交。
      if (!(submitter === 'owner' && args?.substitute === true && this.#fishCannotDecide(args?.stamp))) {
        return { text: '当前是鱼的回合，用户不能替鱼提交。', failed: true };
      }
      substituted = true;
    }
    if (choice.actor === 'joint') {
      // 规则、权限与文案都从 src/joint.js 取：空票面两席都能先投；只剩一席没投时只有那一席
      // 能投；异票时两席都能改自己那一票，只写自己这一席。世界不再自己比对票面。
      const optionLabel = (id) => choice.options.find(({ id: value }) => value === id)?.label ?? id;
      const before = jointView(choice, optionLabel, this.language);
      if (!['owner', 'fish'].includes(submitter)) return { text: before.invalidText, failed: true };
      if (args?.substitute === true) return { text: before.substituteText, failed: true };
      if (!jointCanVote(choice, submitter)) return { text: before.blocked[submitter] ?? before.invalidText, failed: true };
      if (optionId === 'skip') return { text: before.skipText, failed: true };
      if (!choice.options.some(({ id }) => id === optionId)) return { text: this.#choiceHint(choice), failed: true };
      const votes = { ...(choice.votes ?? {}), [submitter]: optionId };
      const after = jointView({ ...choice, votes }, optionLabel, this.language);
      const decision = jointDecision({ ...choice, votes });
      if (!decision.advance) {
        // 异票不清任何一席：两票都留在票面上，谁都可以改自己那一票，两边一致才前进。
        // （此前是「只保留后投的那一票」，会静默吞掉对方刚投的票，两个人只能互相清票。）
        session.pendingChoice = { ...choice, votes };
        session.lastAt = this.#now();
        await this.#commitState(next);
        return { text: decision.stage === 'disagree' ? after.hint : after.saved[submitter] };
      }
      optionId = decision.optionId;
      jointVotes = [{ actor: 'owner', option: votes.owner }, { actor: 'fish', option: votes.fish }];
      submitter = 'joint';
    }
    const skip = optionId === 'skip';
    const result = skip ? null : applyChoice(choice, optionId);
    if (result && !result.ok) return { text: `${result.error}\n${this.#choiceHint(choice)}`, failed: true };
    const now = this.#now();
    const source = submitter ? { actor: submitter, label: result?.option.label ?? '略过', ...(reason ? { reason } : {}), ...(jointVotes ? { votes: jointVotes } : {}), ...(substituted ? { substituted: true } : {}) } : {};
    session.choices.push({ event: choice.event, option: optionId, result: skip ? '略过了这次选择' : result.option.result, at: now, ...source });
    addMoment(session, 'choice', skip ? '略过了这次选择' : result.option.result, now, choice.area, choice.event);
    const before = session.storyProgress.find((entry) => entry.waitingChoiceId === choice.id);
    session.storyProgress = advanceStoryChoice(session.storyProgress, choice.id, optionId);
    if (!skip && before?.packId === session.storyRun?.packId && before && !before.options.find(({ id }) => id === optionId)?.next) {
      session.storyRun.endingNodeId = before.nodeId;
    }
    session.pendingChoice = null;
    session.lastAt = now;
    await this.#commitState(next);
    return { text: skip ? '略过了这次选择，可以接着逛。' : `${substituted ? '你替鱼选了' : '选择已确认：'}${result.option.label}。${result.option.result}。` };
  }

  /** 鱼在这一步还有没有可能自己决定：接口不可用、决定次数用满、或本步两次尝试都失败。 */
  #fishCannotDecide(stamp) {
    if (typeof this.#host?.cognition?.request !== 'function') return true;
    const budget = storyBudget(this.#state?.session?.storyRun?.budget);
    return budgetStop(budget, this.#autoLimits(), { step: 'choose', stamp }) !== null;
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

  async #goTool(args, storyRun) {
    const now = this.#now();
    const day = dayIn(this.timezone, now);
    this.#state = this.#normalizeState();
    if (this.#state.draft) return { text: this.#draftHint(this.#state.draft), failed: true };

    const places = this.#places();
    const venue = storyRun ? places.find(({ id }) => id === storyRun.placeId) : findVenue(places, args?.place);
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
        text: `你已经在「${this.#state.session.placeName}」逛着了（${visitedText(this.#state.session)}）。\n要么接着 fun_wander，要么 fun_home 回家后再换地方。`,
      };
    }
    if (storyRun) {
      const { packId, revision, title } = storyRun;
      session.id = randomUUID();
      const resourceVersion = storyStamp([venue.id, venue.name, venue.desc, venue.areas, venue.scene ?? '', venue.coverId ?? '']);
      const free = storyRun.mode === 'free' && storyRun.setting ? newFreeState(storyRun.setting) : null;
      session.storyRun = { packId, revision, title, endingNodeId: null, runId: session.id,
        participation: storyRun.participation === 'duo' ? 'duo' : 'solo', canonical: storyRun.canonical !== false && !this.#completedStoryIds().has(packId),
        ...(free ? { free } : {}),
        sourceRunId: typeof storyRun.sourceRunId === 'string' ? storyRun.sourceRunId : null,
        sourceMemoryId: typeof storyRun.sourceMemoryId === 'string' ? storyRun.sourceMemoryId : null,
        resourceVersion, checkpoints: [] };
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
    const completedWishes = session.storyRun?.canonical === false ? [] : this.#completeWishes({ placeId: venue.id, phase: enteredPhase });
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

    lines.push('把这一趟落进你今天的日程：feast_life_adjust 把这一段改成出门（已经写在计划里就不用改）；回来再用 feast_life_play 记一笔。没有这些工具就跳过这句。');
    lines.push('一处一处来：fun_wander 逛一处（不填 area 就自动挑一个没逛过的），看到纪念品/拍照点会用得了；遇到需要决定的事件，先用 fun_choice 选完再继续。');
    return { text: lines.join('\n') };
  }

  async #wanderTool(args, actor = 'owner') {
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
      return { text: `找不到「${session.placeName}」这处了（场所库改过？）。fun_home 先回家吧。` };
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
    let pinnedStory = null;
    if (session.storyRun) {
      const rows = this.#storyLibrary.catalog().filter(({ pack }) => pack.id === session.storyRun.packId && pack.revision === session.storyRun.revision);
      if (rows.some(({ pack }) => isFreePack(pack))) {
        return { text: '这一段是自由模式，用 fun_story_act 说一句来推进；想收尾就用 intent: close。', failed: true };
      }
      const step = describeStoryTrip(session, false, rows, venue, nowMin, visitsBefore, [], this.cfg?.funStoryFreeTurns, this.language);
      if (step.step !== 'move' || (wanted && wanted !== step.nextArea)) {
        return { text: step.blocked || (step.nextArea ? `下一处是「${step.nextArea}」。` : '故事已经走完，可以回家。'), failed: true };
      }
      if (session.storyRun.participation === 'duo' && step.actor !== actor) {
        return { text: step.actor === 'fish' ? '当前是鱼的回合，请开启鱼自主模式或等待鱼明确提交。' : '当前是用户回合，请由用户提交。', failed: true };
      }
      args = { area: step.nextArea };
      pinnedStory = pickStory(rows, venue, step.nextArea, nowMin, session, visitsBefore);
    }
    const target = pinnedStory ? args.area : wanted;
    let picked = null;
    let areaMiss = '';
    if (target) {
      const hit = liveAreas.includes(target) ? target : liveAreas.find((a) => a.includes(target));
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
      let story = pinnedStory;
      if (!session.storyRun) {
        try {
          const legacyRows = this.#storyLibrary.catalog().filter(({ pack }) => pack.version === 1);
          story = pickStory(legacyRows, venue, picked.area, nowMin, session, visitsBefore);
        } catch (error) { this.#host?.log?.warn?.('剧情包未能触发，继续普通游逛', { error: msg(error) }); }
      }
      let choice = null;
      if (story) {
        picked.event = story.event;
        session.storyProgress = story.progress;
        choice = story.choice;
        const completed = session.storyRun && story.progress.find(({ packId, done }) => done && packId === session.storyRun.packId);
        if (completed) session.storyRun.endingNodeId = completed.nodeId;
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

    const completedWishes = session.storyRun?.canonical === false ? []
      : this.#completeWishes({ placeId: venue.id, area: picked?.area ?? '', phase: phaseName, souvenirs: bought && !bought.duplicate ? [bought.item] : [] });
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
    const imageOffer = this.#autoImageHint(session);
    if (imageOffer) lines.push(imageOffer);

    if (staleBefore) {
      lines.push(`（这一趟挂得有点久了，上一次动是 ${hmIn(this.timezone, idleSince)}。想回家就用 fun_home。）`);
    } else if (session.visited.length >= venue.areas.length) {
      lines.push('这儿差不多逛遍了。');
    }
    return { text: lines.join('\n') };
  }

  async #homeTool(args) {
    const now = this.#now();
    const next = this.#normalizeState();
    if (args?.draftId !== undefined && (!next.draft || args.draftId !== next.draft.id || next.session)) {
      return { text: '找不到要回家的未完行程，请用 fun_view 查看当前状态。', failed: true };
    }
    if (next.draft && args?.draftId === undefined) return { text: this.#draftHint(next.draft), failed: true };
    const outing = next.session ?? next.draft;
    if (!outing) return { text: '你这会儿没在逛啊。想出门就 fun_go，先挑一处地方。' };

    const endAt = next.draft ? (outing.lastAt || outing.enteredAt || now) : now;
    if (outing.pendingChoice) {
      if (outing.storyRun?.participation === 'duo') {
        const abandoned = '共同决定未完成；行程提前结束，未将等待或超时记作同意';
        outing.events.push(abandoned);
        addMoment(outing, 'event', abandoned, endAt, outing.pendingChoice.area, outing.pendingChoice.event);
      } else {
        outing.storyProgress = advanceStoryChoice(outing.storyProgress, outing.pendingChoice.id, 'skip');
        outing.choices.push({ event: outing.pendingChoice.event, option: 'skip', result: '回家时未作选择', at: endAt });
      }
      outing.pendingChoice = null;
    }
    next.session = outing;
    next.draft = null;
    const venue = this.#allPlaces().find((v) => v.id === outing.placeId)
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
    const lines = [`回家：这一趟在${summary}。`];
    if (route) lines.push(routeText(route) + (route.status === 'between' ? '。想继续时用 fun_route next 并填路线 id；也可 change 换下一站或 cancel 提前结束。' : '。'));
    if (stayedMin >= 5) lines.push(`待了大约 ${stayedMin} 分钟。`);
    if (note) lines.push(`（你记的：${note}）`);

    // 只认场所有没有 scene：trip.scene 是从 session 抄来的，两边一致；
    // 老状态文件里可能有「scene 被兜成场所名」的脏数据，所以用 venue 判定为主。
    const scene = hasScene(venue) ? venue.scene : '';
    // 这句话是联动的关键：把「该填哪个名字」递到她嘴边，替她省一次猜。
    // 素材库里没有这处场景时**一个字都不提**——点了库里没有的名字，那一项等于白填。
    if (this.cfg?.funStoryImages === true) {
      const images = this.#storyImages.status(true);
      if (images.state === 'direct') {
        lines.push('剧情图片已选本机 ComfyUI；请在「出游」面板明确点击生成。回家不等待图片，也不会自动发图片请求。');
      } else {
        const image = await this.#storyImages.generate({ enabled: true, scene, outfits: trip.outfit || '', prompt: `仅画实际经历：${summary}` });
        lines.push(image.message, `图片委派参数：${JSON.stringify({ source: image.source, tool: image.tool, scene: image.scene, outfits: image.outfits, prompt: image.prompt })}`);
      }
    } else if (scene) {
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
    lines.push(draft ? this.#draftHint(draft) : '选好后用 fun_go 进门；逛完用 fun_home 回家。');
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

  // -------------------------------------------------------------------------
  // 回收站：删掉的回忆先放这里，能恢复，也能彻底删
  // -------------------------------------------------------------------------

  #trashView() {
    return (this.#state?.trash ?? []).map(({ id, from, deletedAt, trip }) => ({
      id, from, deletedAt, tripId: trip.id,
      title: trip.storyRun?.title ?? trip.placeName,
      placeName: trip.placeName, endedAt: trip.leftAt,
      complete: Boolean(trip.storyRun?.endingNodeId ?? trip.storyRun?.free?.ended),
      mode: trip.storyRun?.free ? 'free' : 'static',
    }));
  }

  /** 删除 = 从纪念册挪进回收站；纪念品架是独立账本，已经带回家的东西不跟着消失。 */
  #deleteMemory(payload) {
    return this.#serial(async () => {
      this.#ensureStarted();
      const memoryId = typeof payload?.memoryId === 'string' ? payload.memoryId : '';
      if (!memoryId) return storyFailure('缺少要删除的回忆 ID。');
      const state = this.#normalizeState();
      if (state.trash.some((entry) => entry.trip.id === memoryId)) return storyFailure('这条回忆已经在回收站里了。');
      const inRecent = state.trips.findIndex((trip) => trip.id === memoryId);
      const inKept = state.keepsakeTrips.findIndex((trip) => trip.id === memoryId);
      if (inRecent < 0 && inKept < 0) return storyFailure('没有找到这条回忆；可能已经删掉了。');
      const trip = inKept >= 0 ? state.keepsakeTrips[inKept] : state.trips[inRecent];
      const from = inKept >= 0 ? 'keepsakeTrips' : 'trips';
      if (inRecent >= 0) state.trips.splice(inRecent, 1);
      if (inKept >= 0) state.keepsakeTrips.splice(inKept, 1);
      state.trash = [...state.trash, {
        id: `trash-${trip.id}-${this.#now()}`, from, deletedAt: this.#now(), trip: structuredClone(trip),
      }].slice(-MAX_TRASH_TRIPS);
      await this.#commitState(state);
      return this.#storyStatus();
    });
  }

  #restoreMemory(payload) {
    return this.#serial(async () => {
      this.#ensureStarted();
      const trashId = typeof payload?.trashId === 'string' ? payload.trashId : '';
      const state = this.#normalizeState();
      const index = state.trash.findIndex((entry) => entry.id === trashId);
      if (index < 0) return storyFailure('回收站里没有这一条；可能已经恢复或彻底删除了。');
      const [entry] = state.trash.splice(index, 1);
      if (state.trips.some((trip) => trip.id === entry.trip.id) || state.keepsakeTrips.some((trip) => trip.id === entry.trip.id)) {
        return storyFailure('这条行程已经在纪念册里了。');
      }
      if (entry.from === 'keepsakeTrips' || entry.trip.favorite === true) {
        state.keepsakeTrips = [...state.keepsakeTrips, entry.trip].sort((a, b) => b.leftAt - a.leftAt).slice(0, MAX_TRIPS);
      } else {
        state.trips = [...state.trips, entry.trip].sort((a, b) => b.leftAt - a.leftAt).slice(0, MAX_TRIPS);
      }
      await this.#commitState(state);
      return this.#storyStatus();
    });
  }

  #purgeMemory(payload) {
    return this.#serial(async () => {
      this.#ensureStarted();
      const trashId = typeof payload?.trashId === 'string' ? payload.trashId : '';
      const state = this.#normalizeState();
      const index = state.trash.findIndex((entry) => entry.id === trashId);
      if (index < 0) return storyFailure('回收站里没有这一条。');
      state.trash.splice(index, 1);
      await this.#commitState(state);
      return this.#storyStatus();
    });
  }

  #emptyTrash() {
    return this.#serial(async () => {
      this.#ensureStarted();
      const state = this.#normalizeState();
      if (!state.trash.length) return this.#storyStatus();
      state.trash = [];
      await this.#commitState(state);
      return this.#storyStatus();
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
    return '想回家就用 fun_home，回执会把这一趟收成一句话。';
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
    this.#stateError = undefined;
    try {
      const raw = JSON.parse(await readFile(this.stateFile(), 'utf8'));
      if (!raw || typeof raw !== 'object' || Array.isArray(raw) || !Array.isArray(raw.trips)) throw new Error('Invalid outing state');
      return normalizeState(raw, day, this.#now(), this.#ttlMin(), this.timezone);
    } catch (error) {
      if (error?.code !== 'ENOENT') {
        this.#stateError = '出游存档无法读取，原文件未改动。请从备份恢复后重启从0开始的肥鱼大冒险。';
        this.#host?.log?.warn?.(this.#stateError);
      }
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
    if (this.#stateError) throw new Error(this.#stateError);
    this.#storyCommit?.(state);
    const file = this.stateFile();
    await mkdir(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await writeFile(tmp, JSON.stringify(state, null, 2), 'utf8');
    await rename(tmp, file);
  }

  async #commitState(next) {
    await this.#save(next);
    this.#storyImages.cancel();
    this.#state = next;
    this.#bumpCache();
  }

  #serial(task) {
    const run = () => task();
    const result = this.#queue.then(run, run);
    this.#queue = result.then(() => {}, () => {});
    return result;
  }

  #ensureStarted() {
    if (!this.#started || !this.#state) throw new Error('从0开始的肥鱼大冒险还没启动；等它启用后再试。');
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
      const venue = this.#allPlaces().find((v) => v.id === session.placeId);
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
          id: 'home',
          title: this.language === 'en' ? 'Home' : '家',
          description: this.language === 'en'
            ? 'Her room right now: change the pose, dress the room, or see whether she is out.'
            : '她此刻在家做什么：换一个姿势、布置房间，或者看看她在不在外面。',
          // 只读：幂等、不写盘。写方法单独声明给宿主，面板才不会只被当成展示。
          getMethods: ['state', 'art', 'snapshotList', 'exportRoom'],
          methods: ['setActivity', 'setNote', 'setPlan', 'resume', 'setBackground', 'clearBackground', 'setForeground', 'clearForeground', 'setCharacter', 'clearCharacter', 'saveHotspots', 'savePlacements', 'setPainting', 'clearPainting', 'snapshotSave', 'snapshotRemove', 'importRoom', 'resetRoom'],
        },
        {
          id: 'outing', title: this.language === 'en' ? 'Go explore' : '自己去逛',
          description: this.language === 'en' ? 'Explore places and manage the place library.' : '推荐并管理能去逛的地方。',
          getMethods: ['list', 'blank', 'history'],
          methods: ['save', 'remove', 'reset', 'resetAll', 'resume', 'closeDraft', 'get', 'cover', 'create', 'update', 'setHome', 'setDefaultStyle', 'setCover', 'clearCover', 'previewImport', 'commitImport', 'restoreImport'],
        },
        {
          id: 'story', title: this.language === 'en' ? 'Story Journal' : '故事手账',
          description: this.language === 'en' ? 'Play free stories and manage story packs.' : '开启自由故事、推进剧情并管理故事包。',
          getMethods: ['status', 'storySettings', 'storyImageRead', 'authorList', 'authorTemplate', 'authorValidate', 'authorPreview', 'authorPlaytest', 'authorExport', 'list', 'template', 'validate', 'preview', 'playtest', 'export'],
          methods: [...STORY_ACTIONS, 'locationCover', 'saveStorySettings', 'saveStoryAutoImages', 'clearStoryKey', 'storyImage', 'authorImport', 'authorRebind', 'authorEnable', 'authorDisable', 'authorRemove', 'import', 'rebind', 'enable', 'disable', 'remove'],
        },
        { id: 'journal', title: this.language === 'en' ? 'Memory Journal' : '回忆手账', description: this.language === 'en' ? 'Browse trips and keepsakes.' : '回看行程并整理珍藏。', getMethods: ['list', 'trip'], methods: ['favorite', 'keep'] },
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
  #completedStoryIds() {
    return new Set((this.#normalizeState().storyCanon ?? []).map((row) => row.packId));
  }

  /** 六个公开只读查询：实现拆在 `story-read.js`，这里只把只读依赖递过去。 */
  async #storyRead(name, args = {}) {
    return readStoryQuery({
      name,
      args,
      now: this.#now(),
      timezone: this.timezone,
      places: this.#places(),
      allPlaces: this.#allPlaces(),
      locationsSnapshot: () => this.#locationLibrary.snapshot(),
      catalog: () => this.#storyLibrary.catalog(),
      status: () => this.#storyStatus(),
      savedTrips: () => this.#savedTrips(),
      visitCount: (id) => this.#history(id)?.visitCount ?? 0,
      completedStoryIds: () => this.#completedStoryIds(),
      freeEnabled: this.cfg?.funStoryFree === true,
      language: this.language,
      runId: this.#state.session?.storyRun?.runId ?? this.#state.draft?.storyRun?.runId ?? null,
    });
  }

  /** 自主游玩的上限每次都现读设置：用户在设置里改完不用重开面板。 */
  #autoLimits() {
    return autoLimits(this.cfg ?? {});
  }

  #storyStatus(token) {
    if (this.cfg?.funStoryImages !== true) this.#storyImages.cancel();
    if (this.#stateError) return storyFailure(this.#stateError);
    const state = this.#normalizeState();
    const outing = state.session ?? state.draft;
    const now = this.#now();
    const nowMin = minutesIn(this.timezone, now);
    const places = this.#places();
    const catalog = this.#storyLibrary.catalog();
    const place = (id) => places.find((venue) => venue.id === id);
    const visits = (id) => this.#history(id)?.visitCount ?? 0;
    const completed = this.#completedStoryIds();
    const trip = describeStoryTrip(outing, Boolean(state.draft), catalog, place(outing?.placeId), nowMin, visits(outing?.placeId), completed, this.cfg?.funStoryFreeTurns, this.language);
    if (trip) trip.dmBudget = dmBudget(outing.storyRun.dmBudget);
    // 新的一屏 = 一次「要不要配图」的机会；同一个进度戳只准备一次，不会反复刷。
    this.#maybeAutoImageRequest(trip, outing);
    const conflict = outing && !trip ? `「${outing.placeName}」还有一趟普通出游，请在从0开始的肥鱼大冒险继续或结束。`
      : !outing && state.route ? '从0开始的肥鱼大冒险还有一条未结束的联程，请先处理这条路线。' : undefined;
    return {
      ok: true, trip, conflict,
      ...(this.#venueMigrationError ? { migrationWarning: this.#venueMigrationError } : {}),
      startStamp: storyStamp([this.#storyEpoch, state.tripSeq, outing?.id, state.route?.id]),
      catalog: catalog.filter(({ enabled }) => enabled)
        .map((row) => describePack(row, place(row.pack.placeId), nowMin, visits(row.pack.placeId), completed, { freeEnabled: this.cfg?.funStoryFree === true })),
      memories: this.#savedTrips().filter((saved) => saved.storyRun).map(describeMemory),
      trash: this.#trashView(),
      autoplay: outing?.storyRun?.autoplay === true,
      images: { ...this.#storyImages.status(this.cfg?.funStoryImages === true),
        auto: this.cfg?.funStoryAutoImages === true, masterOn: this.cfg?.funStoryImages === true },
      dm: { ...this.#dm.view(trip, this.#storySecrets.status.available ? { request() {} } : this.#host?.cognition, this.cfg?.funStoryDM === true), api: this.#storySecrets.status },
      autonomy: this.#autonomy.view(trip, this.#host?.cognition, now, token, this.#autoLimits()),
    };
  }

  async #commitStoryAction(identity, action, trip, actor, details, run) {
    const priorSeq = this.#state.tripSeq;
    let receipt;
    this.#storyCommit = (next) => {
      const saved = action === 'close' && next.tripSeq > priorSeq ? next.trips[0] : next.session;
      if (!saved?.storyRun || (action !== 'start' && action !== 'close' && saved.id !== trip.id)) throw new Error('故事动作未生成可保存的进度。');
      const storyRun = saved.storyRun;
      storyRun.seq = (storyRun.seq ?? 0) + 1;
      const budget = storyBudget(storyRun.budget);
      if (actor === 'fish') budget.steps++;
      storyRun.budget = budget;
      const progress = normalizeStoryProgress(saved.storyProgress);
      const checkpoint = {
        id: randomUUID(), runId: storyRun.runId ?? saved.id, packId: storyRun.packId, revision: storyRun.revision,
        resourceVersion: storyRun.resourceVersion ?? 'legacy-unknown', seq: storyRun.seq,
        nodeId: progress.find((entry) => entry.waitingChoiceId === saved.pendingChoice?.id)?.nodeId
          ?? progress.find((entry) => !entry.done)?.nodeId ?? storyRun.endingNodeId ?? 'start',
        budget: storyBudget(storyRun.budget),
        progress, pendingChoice: saved.pendingChoice ? structuredClone(saved.pendingChoice) : null,
        ...(storyRun.free ? { free: structuredClone(storyRun.free) } : {}),
        events: [...(saved.events ?? [])], visited: (saved.visited ?? []).map((entry) => ({ ...entry })),
        choices: (saved.choices ?? []).map((entry) => ({ ...entry })), timeline: (saved.timeline ?? []).map((entry) => ({ ...entry })),
        at: this.#now(),
      };
      storyRun.checkpoints = [...(storyRun.checkpoints ?? []), checkpoint].slice(-32);
      receipt = { ...identity, ...details, action, actor, at: this.#now(), runId: saved.storyRun.runId ?? trip?.id ?? saved.id,
        revision: storyRun.revision, ...(action === 'close' ? { memoryId: saved.id } : {}) };
      next.storyReceipts = normalizeStoryReceipts([...(next.storyReceipts ?? []), receipt], this.#now());
    };
    try {
      const result = await run();
      if (result.failed) return storyFailure(result.text);
      return receipt ? { ok: true, receipt: publicStoryReceipt(receipt) } : storyFailure('没有可确认的故事进度，请刷新。');
    } finally { this.#storyCommit = undefined; }
  }

  async #forkStory(payload = {}) {
    if (typeof payload.forkToken !== 'string' || !/^[A-Za-z0-9_-]{16,80}$/.test(payload.forkToken)) return { ok: false, code: 'INVALID_FORK_TOKEN', error: '分支需要有效的一次性操作标识。' };
    const existing = this.#state?.session?.storyRun ?? this.#state?.draft?.storyRun;
    if (existing?.forkToken === payload.forkToken && existing.sourceMemoryId === payload.memoryId && existing.sourceCheckpointId === payload.checkpointId) {
      return { ...this.#storyStatus(), replayed: true, fork: { runId: existing.runId, sourceRunId: existing.sourceRunId, sourceMemoryId: existing.sourceMemoryId, checkpointId: existing.sourceCheckpointId, canonical: false } };
    }
    const completedFork = this.#savedTrips().find((trip) => trip.storyRun?.forkToken === payload.forkToken
      && trip.storyRun.sourceMemoryId === payload.memoryId && trip.storyRun.sourceCheckpointId === payload.checkpointId);
    if (completedFork) return { ...this.#storyStatus(), replayed: true,
      fork: { runId: completedFork.storyRun.runId, sourceRunId: completedFork.storyRun.sourceRunId,
        sourceMemoryId: completedFork.storyRun.sourceMemoryId, checkpointId: completedFork.storyRun.sourceCheckpointId, canonical: false },
      memory: describeMemory(completedFork) };
    const state = this.#normalizeState();
    if (state.session || state.draft || state.route) return { ok: false, code: 'ACTIVE_OUTING', error: '请先处理当前行程或路线，再开启故事分支。' };
    const memory = this.#savedTrips().find((trip) => trip.id === payload.memoryId && trip.storyRun);
    if (!memory) return { ok: false, code: 'NOT_FOUND', error: '找不到指定的故事回忆。' };
    const checkpoint = (memory.storyRun.checkpoints ?? []).find((item) => item.id === payload.checkpointId);
    if (!checkpoint) return { ok: false, code: 'CHECKPOINT_NOT_FOUND', error: '检查点不存在或已过期。' };
    if (checkpoint.revision !== memory.storyRun.revision) return { ok: false, code: 'CONTENT_STALE', error: '故事内容版本已变化，不能从旧检查点分支。' };
    const venue = this.#allPlaces().find((item) => item.id === memory.placeId);
    const currentResourceVersion = venue ? storyStamp([venue.id, venue.name, venue.desc, venue.areas, venue.scene ?? '', venue.coverId ?? '']) : null;
    if (!venue || checkpoint.resourceVersion === 'legacy-unknown' || checkpoint.resourceVersion !== currentResourceVersion) {
      return { ok: false, code: 'RESOURCE_STALE', error: '地点资源版本不匹配，不能从此检查点分支。' };
    }
    const row = this.#storyLibrary.catalog().find(({ pack }) => pack.id === memory.storyRun.packId && pack.revision === checkpoint.revision);
    if (!row) return { ok: false, code: 'CONTENT_STALE', error: '故事内容当前不可用，不能从此检查点分支。' };
    const now = this.#now();
    const runId = randomUUID();
    const next = state;
    next.session = {
      id: runId, placeId: venue.id, placeName: venue.name, scene: venue.scene ?? '', outfit: venue.recommendedOutfit ?? '', company: '',
      enteredAt: now, lastAt: now, pausedMs: 0, routeId: '', routeOrder: 0, phases: [], branchSeen: [],
      storyProgress: normalizeStoryProgress(checkpoint.progress), storyRun: {
        packId: memory.storyRun.packId, revision: checkpoint.revision, title: memory.storyRun.title,
        endingNodeId: null, seq: checkpoint.seq ?? 0, budget: storyBudget(memory.storyRun.budget), dmBudget: dmBudget(memory.storyRun.dmBudget),
        runId, sourceRunId: checkpoint.runId ?? memory.storyRun.runId ?? memory.id, sourceMemoryId: memory.id,
        sourceCheckpointId: checkpoint.id, forkToken: payload.forkToken,
        participation: memory.storyRun.participation ?? row.pack.metadata?.participation ?? 'solo', canonical: false,
        resourceVersion: checkpoint.resourceVersion, checkpoints: [],
      },
      timelineTruncated: false, timeline: (checkpoint.timeline ?? []).map((item) => ({ ...item })), leftDay: '', note: '', favorite: false,
      visited: (checkpoint.visited ?? []).map((item) => ({ ...item })), souvenirs: [], photos: [], ate: [],
      events: [...(checkpoint.events ?? [])], choices: (checkpoint.choices ?? []).map((item) => ({ ...item })),
      pendingChoice: checkpoint.pendingChoice ? structuredClone(checkpoint.pendingChoice) : null,
    };
    await this.#commitState(next);
    this.#autonomy.clear();
    const status = this.#storyStatus();
    return status.ok ? { ...status, fork: { runId, sourceRunId: next.session.storyRun.sourceRunId, sourceMemoryId: memory.id, checkpointId: checkpoint.id, canonical: false } } : status;
  }

  async #runStoryAction(method, payload) {
    const status = this.#storyStatus(payload.token);
    if (!status.ok) return status;
    const { trip } = status;
    const identity = storyRequestKey(method, payload);
    const recorded = identity && normalizeStoryReceipts(this.#state.storyReceipts, this.#now()).find((row) => row.key === identity.key);
    if (recorded) return recorded.digest === identity.digest
      ? { ...status, receipt: publicStoryReceipt(recorded), replayed: true }
      : { ...storyFailure('这一步已由另一项操作提交，请刷新进度。'), code: 'STORY_STEP_CONFLICT' };
    if (method === 'pause') {
      if (typeof payload.token === 'string' && typeof payload.tripId === 'string') this.#autonomy.pause(payload.tripId, payload.token);
      return this.#storyStatus();
    }
    if (method === 'start') {
      if (!identity || status.conflict || trip || payload.startStamp !== status.startStamp) return storyFailure(status.conflict || '当前进度已变更，请刷新后再出发。');
      const card = status.catalog.find(({ id, revision }) => id === payload.packId && revision === payload.revision);
      if (!card?.available) return storyFailure(card?.problem || '这篇故事当前不可出发，请刷新。');
      const row = this.#storyLibrary.catalog().find(({ pack }) => pack.id === card.id && pack.revision === card.revision);
      const free = row && isFreePack(row.pack);
      const result = await this.#commitStoryAction(identity, 'start', null, 'owner', { stepId: payload.startStamp }, () =>
        this.#goTool({}, {
          packId: card.id, revision: card.revision, title: card.title, placeId: card.placeId, participation: card.participation,
          mode: free ? 'free' : 'static', ...(free ? { setting: row.pack.setting } : {}),
        }));
      return result.ok ? { ...this.#storyStatus(), receipt: result.receipt } : result;
    }
    if (!trip || payload.tripId !== trip.id || payload.stamp !== trip.stamp) return storyFailure('行程或事件已变更，请刷新后再操作。');
    if (method === 'mode') {
      const next = this.#normalizeState();
      const run = next.session?.storyRun;
      if (!run) return storyFailure('当前没有进行中的故事。');
      if (payload.enabled !== true) {
        this.#autonomy.pause(trip.id, payload.token);
        run.autoplay = false;
        await this.#commitState(next);
        return this.#storyStatus();
      }
      // 用户说「让鱼自己玩」是一次持久偏好：即使此刻是用户回合（duo），也先记住，
      // 轮到鱼时面板会自动续上；授权租约仍然只在真正能推进时才发。
      // 但如果是额度用完、认知接口不可用这类"现在就不行"的原因，仍按失败返回，别给假开关。
      const grant = this.#autonomy.enable(trip, this.#host?.cognition, this.#now(), this.#autoLimits());
      const ownerTurn = trip.actor === 'owner' && typeof this.#host?.cognition?.request === 'function';
      if (!grant.ok && !ownerTurn) return grant;
      run.autoplay = true;
      await this.#commitState(next);
      return grant.ok ? this.#storyStatus(grant.token) : { ...this.#storyStatus(), autoplay: true };
    }
    if (method === 'segment') {
      if (payload.confirm !== true) return storyFailure('开新的一段要你明确点一次：确认后带 confirm: true 再调。');
      if (trip.mode === 'free') return this.#freeSegment(trip);
      const proceeded = this.#autonomy.continueSegment(trip, this.#now(), this.#autoLimits());
      if (!proceeded.ok) return proceeded;
      const next = this.#normalizeState();
      if (!next.session?.storyRun) return storyFailure('当前没有进行中的故事。');
      next.session.storyRun.budget = proceeded.budget;
      await this.#commitState(next);
      return this.#storyStatus();
    }
    if (payload.dmProposalId !== undefined) {
      const proposal = this.#dm.validateApply(trip, payload.dmProposalId);
      if (this.cfg?.funStoryDM !== true || method !== 'choose' || !proposal.ok || payload.optionId !== proposal.optionId) {
        return storyFailure(proposal.error || '主持提议不能执行这项操作。');
      }
    }
    this.#dm.cancel();
    // 文字通道可以按当前回合声明身份：用户让你替他选（owner），或本来就是你的回合（fish）。
    let actor = payload.as === 'fish' ? 'fish' : 'owner';
    let reason;
    let choiceId = payload.choiceId;
    let optionId = payload.optionId;
    if (method === 'auto') {
      if (!status.autonomy.available) {
        this.#autonomy.clear();
        return storyFailure('角色认知接口当前不可用，请手动继续。');
      }
      const decision = this.#autonomy.take(trip, payload.token, payload.ticket, this.#now(), this.#autoLimits());
      if (!decision.ok) return decision;
      method = trip.step;
      actor = 'fish';
      reason = decision.reason;
      choiceId = trip.pending?.id;
      optionId = decision.optionId;
    } else {
      // A manual action from any authorized panel takes over at the next action boundary.
      this.#autonomy.clear();
    }
    if (!identity) return storyFailure('操作缺少有效的行程与步骤标识。');
    let run;
    if (method === 'move' && trip.step === 'move') run = () => this.#wanderTool({ area: trip.nextArea }, actor);
    else if (method === 'choose' && trip.step === 'choose' && choiceId === trip.pending.id && trip.pending.options.some(({ id }) => id === optionId)) {
      run = () => this.#choiceTool({ choiceId, optionId, substitute: payload.substitute === true, stamp: trip.stamp }, actor, reason);
    } else if (method === 'resume' && trip.step === 'resume') run = () => this.#resumeTool(trip.id);
    else if (method === 'close') run = () => this.#homeTool(trip.state === 'draft' ? { draftId: trip.id } : {});
    else return storyFailure('当前行程没有这项操作或该选项已失效。');
    const substituting = method === 'choose' && actor === 'owner' && payload.substitute === true && trip.actor === 'fish';
    const result = await this.#commitStoryAction(identity, method, trip, actor, {
      stepId: trip.stamp, area: method === 'move' ? trip.nextArea : undefined, optionId: method === 'choose' ? optionId : undefined,
      ...(substituting ? { substituted: true } : {}),
    }, run);
    if (!result.ok || method === 'close') this.#autonomy.clear();
    if (!result.ok) return result;
    const updated = this.#storyStatus(actor === 'fish' ? payload.token : undefined);
    if (updated.trip?.actor === 'owner') this.#autonomy.clear();
    return { ...updated, receipt: result.receipt };
  }

  // -------------------------------------------------------------------------
  // 文字通道（QQ / 控制台聊天）：开局与推进
  // -------------------------------------------------------------------------

  #textOff() {
    return { text: '文字通道游玩没有开启。到从0开始的肥鱼大冒险的设置里打开「文字通道也能玩故事」，或者到「出游」面板里玩。', failed: true };
  }

  async #storyTextStart(args) {
    if (this.cfg?.funStoryTextOn !== true) return this.#textOff();
    if (args?.confirm !== true) return { text: '开始故事要用户明确说要开始：确认后带 confirm: true 再调一次。', failed: true };
    const status = this.#storyStatus();
    if (!status.ok) return { text: status.error, failed: true };
    if (status.trip) return { text: `已经有一段故事在进行中（《${status.trip.title}》）；先 fun_story_act 继续，或结束它。`, failed: true };
    const card = status.catalog.find((item) => item.id === args.packId && item.revision === args.revision);
    if (!card) return { text: '没有找到这篇故事。先用 fun_story_candidates 或 fun_story_detail 取 packId 和 revision。', failed: true };
    if (!card.available) return { text: card.problem || '这篇故事现在不能开始。', failed: true };
    const result = await this.#runStoryAction('start', { startStamp: args.startStamp, packId: args.packId, revision: args.revision });
    if (!result.ok) return { text: result.error || '故事没有开始。', failed: true };
    const trip = result.trip;
    const row = this.#storyLibrary.catalog().find(({ pack }) => pack.id === trip.packId && pack.revision === trip.revision);
    return { text: JSON.stringify({
      ok: true, tripId: trip.id, stamp: trip.stamp, mode: trip.mode ?? 'static', title: trip.title, placeName: trip.placeName,
      state: trip.state, step: trip.step, opening: row && isFreePack(row.pack) ? row.pack.setting.opening : undefined,
      free: trip.free ? { turn: trip.free.turn, maxTurns: trip.free.maxTurns, segment: trip.free.segment,
        turnsLeft: trip.free.turnsLeft, segmentsLeft: trip.free.segmentsLeft, canContinue: trip.free.canContinue } : null,
      hint: trip.mode === 'free'
        ? '把开场告诉用户，然后用户每说一句就用 fun_story_act 的 say 交进来。'
        : '把当前待选的事件和选项告诉用户；用户说定之后用 fun_story_act 的 say 交进来（原话命中选项会直接生效，否则先给一个待确认提议）。',
      receipt: result.receipt ?? null,
    }) };
  }

  async #storyTextAct(args) {
    if (this.cfg?.funStoryTextOn !== true) return this.#textOff();
    const status = this.#storyStatus();
    if (!status.ok) return { text: status.error, failed: true };
    const trip = status.trip;
    if (!trip) return { text: '现在没有正在进行的故事。先 fun_story_start。', failed: true };
    if (args?.tripId !== trip.id || args?.stamp !== trip.stamp) {
      return { text: JSON.stringify({ ok: false, code: 'STALE', error: '故事进度已经变了：先 fun_story_current 读最新的 tripId/stamp 再继续，不要猜。', stamp: trip.stamp, step: trip.step }), failed: true };
    }
    if (args?.intent === 'close') {
      if (args?.confirm !== true) return { text: '结束这一段要用户明确确认：确认后带 confirm: true 再调一次。', failed: true };
      const closed = await this.#runStoryAction('close', { tripId: trip.id, stamp: trip.stamp });
      if (!closed.ok) return { text: closed.error || '没有结束成功。', failed: true };
      return { text: JSON.stringify({ ok: true, closed: true, memoryId: closed.receipt?.memoryId ?? null, receipt: closed.receipt ?? null }) };
    }
    if (args?.intent !== 'say') return { text: 'intent 只能是 say、close 或 redo。', failed: true };
    const result = trip.mode === 'free' ? await this.#storyTextFree(args, trip) : await this.#storyTextStatic(args, trip);
    if (result.failed) return result;
    let payload;
    try { payload = JSON.parse(result.text); } catch { payload = {}; }
    const raw = [payload.report, payload.narration, payload.lastSay?.narration, payload.result, payload.events?.at?.(-1), trip.events?.at?.(-1)].find((item) => typeof item === 'string' && item.trim());
    const report = String(raw ?? '这一回合已经推进。').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 400);
    return { ...result, report, text: JSON.stringify({ ...payload, report }) };
  }

  /**
   * 文字通道里这一票默认记在谁名下。
   * 普通回合看节点 actor；共同决定只看 `jointActor`（空票面与异票回主人，缺鱼那一票才是鱼）。
   * 这不是权限：空票面时鱼也能先投，调用方带 `as: "fish"` 即可（规则见 src/joint.js）。
   */
  #textVoter(pending) {
    return jointActor(pending) ?? (pending?.actor === 'fish' ? 'fish' : 'owner');
  }

  async #storyTextStatic(args, trip) {
    // 这一回合该谁走：轮到鱼（duo 的 fish 回合）就以鱼的身份提交；否则以用户身份（用户让鱼代说）。
    const as = (pendingActor) => (pendingActor === 'fish' ? 'fish' : 'owner');
    if (trip.step === 'resume') {
      const resumed = await this.#runStoryAction('resume', { tripId: trip.id, stamp: trip.stamp, as: as(trip.actor) });
      if (!resumed.ok) return { text: resumed.error || '没有继续成功。', failed: true };
      return { text: JSON.stringify(this.#textStaticPayload(resumed.trip, { resumed: true })) };
    }
    if (trip.step === 'move') {
      const moved = await this.#runStoryAction('move', { tripId: trip.id, stamp: trip.stamp, as: as(trip.actor) });
      if (!moved.ok) return { text: moved.error || '没有走到下一处。', failed: true };
      return { text: JSON.stringify(this.#textStaticPayload(moved.trip, { moved: true })) };
    }
    const pending = trip.pending;
    if (!pending) return { text: '现在没有待选择的节点，这一步不需要 say。', failed: true };
    // 空票面时两席都能先投，两票不同时两席都能改自己那一票：这两种状态允许调用方显式声明
    // `as`。只剩一席没投时，声明成另一席会被 #choiceTool 的 jointCanVote 明确拒绝。
    const declared = args.as === 'fish' ? 'fish' : args.as === 'owner' ? 'owner' : null;
    const voter = declared ?? this.#textVoter(pending);
    const say = typeof args.say === 'string' ? args.say.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    if (args.proposalId || args.optionId) {
      const proposal = this.#textProposal;
      if (!proposal || proposal.id !== args.proposalId || proposal.tripId !== trip.id || proposal.stamp !== trip.stamp
        || this.#now() - proposal.at > 10 * 60 * 1000
        || (args.optionId && args.optionId !== proposal.optionId)) {
        return { text: '这个提议已经失效（进度变了、超过十分钟，或不是同一步）。用 say 重新说一句。', failed: true };
      }
      this.#textProposal = null;
      return this.#commitTextChoice(trip, pending, proposal.optionId, `用户确认：${proposal.label}`, voter);
    }
    if (!say) return { text: '请把用户这一回合的原话放进 say（最多 200 字）。', failed: true };
    const hit = pending.options.find((option) => {
      const label = option.label.replace(/\s+/g, '');
      return label && (say.replace(/\s+/g, '').includes(label) || label.includes(say.replace(/\s+/g, '')));
    });
    if (hit) return this.#commitTextChoice(trip, pending, hit.id, `按用户原话命中：${hit.label}`, voter);
    const ordinal = this.#ordinalPick(pending, say);
    if (ordinal) return this.#commitTextChoice(trip, pending, ordinal.id, `按用户明的序号：${ordinal.label}`, voter);
    if (/^(skip|略过|算了|跳过|不选)$/i.test(say)) return this.#commitTextChoice(trip, pending, 'skip', '用户明确略过', voter);
    // 轮到鱼、用户又没有指定时，让鱼按自己的角色决定（不再要求用户替鱼选）。
    // 共同决定里「缺的是鱼那一票」同样算鱼的回合。
    if (voter === 'fish') {
      const cognition = await this.#storySecrets.cognition(this.#host?.cognition);
      const decision = await requestStoryDecision(cognition, trip);
      if (!decision.ok) return { text: decision.error || '鱼没有做出决定；可以再说一次或自己去面板选。', failed: true };
      return this.#commitTextChoice(trip, pending, decision.optionId, '鱼自己决定', 'fish');
    }
    const mapped = await this.#mapSayToOption(trip, pending, say);
    if (!mapped.ok) return { text: mapped.error, failed: true };
    const proposal = { id: randomUUID(), tripId: trip.id, stamp: trip.stamp, optionId: mapped.optionId, label: mapped.label, at: this.#now() };
    this.#textProposal = proposal;
    return { text: JSON.stringify({
      ok: true, needConfirm: true, proposalId: proposal.id, optionId: mapped.optionId, label: mapped.label, reason: mapped.reason,
      hint: '这一步还没有提交。把候选告诉用户，用户确认后带上 proposalId 和 optionId 再调一次 fun_story_act。',
    }) };
  }

  /** 文字通道的回执：把「这一票是谁投的、下一步等谁」写清楚，别让主持靠猜。 */
  #textStaticPayload(trip, extra = {}) {
    const pending = trip?.pending ?? null;
    const joint = pending?.actor === 'joint';
    const labelOf = (id) => pending?.options?.find(({ id: value }) => value === id)?.label ?? id;
    const view = joint ? jointView(pending, labelOf, this.language) : null;
    return {
      ok: true, ...extra, step: trip?.step ?? '', stamp: trip?.stamp ?? '', nextArea: trip?.nextArea ?? null,
      pending, narration: trip?.events?.at(-1) ?? '',
      // stage / seat / canVote 与面板、只读查询同源，主持不用自己比对票面。
      ...(view ? { joint: { stage: view.stage, resolution: view.resolution, votes: view.votes, waitingFor: view.seat, disagree: view.stage === 'disagree', canVote: view.canVote } } : {}),
      hint: !pending ? '故事已经走完，可以用 intent: close 收尾。'
        : view ? view.hint
          : '把事件和选项告诉用户；用户说完再用 say 交进来（原话命中选项会直接生效）。',
    };
  }

  /** 「选第一个 / 就第二个 / 3」这种明确的序号；含糊的句子不猜。 */
  #ordinalPick(pending, say) {
    const text = say.replace(/\s+/g, '');
    const digits = { 1: 0, 2: 1, 3: 2, 4: 3, 一: 0, 二: 1, 两: 1, 三: 2, 四: 3 };
    for (const pattern of [/第([1-4一二两三四])(?:个|条|项|号)?/, /(?:选|挑|要|就)([1-4一二两三四])(?:个|条|项|号)?/, /^([1-4一二两三四])$/]) {
      const match = text.match(pattern);
      if (match) return pending.options[digits[match[1]]] ?? null;
    }
    return null;
  }

  async #commitTextChoice(trip, pending, optionId, how, as = 'owner') {
    const chosen = pending.options.find(({ id }) => id === optionId);
    const result = await this.#runStoryAction('choose', { tripId: trip.id, stamp: trip.stamp, choiceId: pending.id, optionId, as });
    if (!result.ok) return { text: result.error || '选择没有提交成功。', failed: true };
    const recorded = result.trip?.choices?.at(-1);
    return { text: JSON.stringify(this.#textStaticPayload(result.trip, {
      chosen: optionId, how, as, result: recorded?.result ?? (optionId === 'skip' ? '略过了这次选择' : ''),
      label: chosen?.label ?? '', receipt: result.receipt ?? null,
    })) };
  }

  /** 用户原话和选项对不上时，让主持做一次"最接近"的映射；只是提议，不提交。 */
  async #mapSayToOption(trip, pending, say) {
    const cognition = await this.#storySecrets.cognition(this.#host?.cognition);
    if (typeof cognition?.request !== 'function') return { ok: false, error: '这句话没有正好对上任何一个选项，而当前没有可用的主持做映射；请让用户从选项里挑一个。' };
    let timer;
    try {
      const task = Promise.resolve().then(() => cognition.request({
        brief: '把玩家的原话映射到给定的选项上。只返回一行 JSON：{"optionId":"选项 ID","reason":"一句简短理由"}。'
          + '不要替玩家编造动作，不要选择列表以外的 ID；实在对不上时返回 {"optionId":"none","reason":"..."}。\n'
          + JSON.stringify({ event: pending.event, prompt: pending.prompt, options: pending.options.map(({ id, label }) => ({ id, label })), say }),
        tools: [], hint: { rounds: 1 },
      }));
      const result = await Promise.race([task, new Promise((resolve) => {
        timer = setTimeout(() => resolve({ error: 'timeout' }), 20_000);
      })]);
      if (result?.error || typeof result?.text !== 'string') return { ok: false, error: '映射超时了：请让用户直接从选项里挑一个。' };
      const parsed = JSON.parse(result.text.trim().replace(/^```(?:json)?\s*([\s\S]*?)\s*```$/i, '$1'));
      const option = pending.options.find(({ id }) => id === parsed?.optionId);
      if (!option) return { ok: false, error: '这句话和当前选项都对不上；请让用户从选项里挑一个，或明确说略过。' };
      return { ok: true, optionId: option.id, label: option.label, reason: typeof parsed.reason === 'string' ? parsed.reason.slice(0, 120) : '' };
    } catch {
      return { ok: false, error: '映射失败：请让用户从选项里挑一个。' };
    } finally { clearTimeout(timer); }
  }

  /**
   * 自由模式的「再来一段」：只把这一段的回合下限抬到当前回合，回合数、日志与状态都不重置。
   * 与选项式共用同一条 RPC（`segment`）和同一个「最多三段」上限。
   */
  async #freeSegment(trip) {
    const row = this.#storyLibrary.catalog().find(({ pack }) => pack.id === trip.packId && pack.revision === trip.revision);
    if (!row || !isFreePack(row.pack)) return storyFailure('这篇故事不是自由模式（场景包）。');
    const maxTurns = effectiveMaxTurns(row.pack, this.cfg?.funStoryFreeTurns);
    const next = this.#normalizeState();
    const outing = next.session ?? next.draft;
    const run = outing?.storyRun;
    if (!run?.free) return storyFailure('这一趟没有自由模式的状态。');
    const proceeded = continueFreeSegment(run.free, maxTurns);
    if (!proceeded.ok) return storyFailure(proceeded.error);
    run.free = proceeded.free;
    run.seq = (run.seq ?? 0) + 1;
    await this.#commitState(next);
    return this.#storyStatus();
  }

  async #storyTextFree(args, trip) {
    const row = this.#storyLibrary.catalog().find(({ pack }) => pack.id === trip.packId && pack.revision === trip.revision);
    if (!row || !isFreePack(row.pack)) return { text: '这篇故事不是自由模式（场景包）。', failed: true };
    const setting = row.pack.setting;
    const outing = this.#state.session ?? this.#state.draft;
    if (!outing?.storyRun) return { text: '故事已经不在进行中了。', failed: true };
    const storyRun = outing.storyRun;
    const free = normalizeFreeState(storyRun.free, setting);
    const maxTurns = effectiveMaxTurns(row.pack, this.cfg?.funStoryFreeTurns);
    const canContinue = freeCanContinue(free, maxTurns);
    if (free.ended) return { text: '这一段已经收尾了：用 intent: close（confirm: true）结束并保存回忆。', failed: true };
    if (freeTurnsLeft(free, maxTurns) === 0) {
      return { text: `这一段的回合数已经用完（第 ${free.segment + 1} 段，${maxTurns} 回合）：${canContinue ? '到面板点「再来一段」，或者' : ''}用 intent: close 收尾。`, failed: true };
    }
    const say = typeof args.say === 'string' ? args.say.replace(/\s+/g, ' ').trim().slice(0, 200) : '';
    if (!say) return { text: '请把用户这一回合的原话放进 say（最多 200 字）。', failed: true };
    const from = typeof args.from === 'string' ? args.from.trim().slice(0, 40) : '';
    const identity = storyRequestKey('say', { tripId: trip.id, stamp: trip.stamp, say, from });
    if (!identity) return { text: '这一句不合法。', failed: true };
    const recorded = normalizeStoryReceipts(this.#state.storyReceipts, this.#now()).find((row) => row.key === identity.key);
    if (recorded) return recorded.digest === identity.digest
      ? { text: JSON.stringify({ ok: true, replayed: true, note: '这一句已经提交过，没有重复推进。' }) }
      : { text: '这一步已经被另一句话提交过了，请先 fun_story_current 读最新进度。', failed: true };

    const calls = Number.isSafeInteger(storyRun.freeCalls) ? storyRun.freeCalls : 0;
    // 每一段各有自己的调用上限；已经花掉的跨段累计。
    if (calls >= (free.segment + 1) * (maxTurns * 2 + 4)) return { text: '这一段的模型调用额度用完了：用 intent: close 收尾。', failed: true };
    const reserved = this.#normalizeState();
    if (!reserved.session?.storyRun) return { text: '故事已经不在进行中了。', failed: true };
    reserved.session.storyRun.freeCalls = calls + 1;
    await this.#commitState(reserved);

    const cognition = await this.#storySecrets.cognition(this.#host?.cognition);
    let outcome = null;
    let lastError = '';
    let narrationText = '';
    for (let attempt = 0; attempt < 2 && !outcome; attempt += 1) {
      const payload = freePromptPayload(setting, free, { say, from, turn: free.turn });
      const answer = await requestFreeTurn(cognition, payload, lastError);
      if (!answer.ok) { lastError = answer.error; continue; }
      const turn = freeTurn(setting, free, answer.output, { now: this.#now(), from, say, maxTurns });
      if (!turn.ok) { lastError = turn.error; continue; }
      outcome = turn;
      narrationText = answer.output.narration;
    }
    if (!outcome) return { text: `这一回合没有提交：${lastError}。进度没有变化，可以重说一句。`, failed: true };

    const next = this.#normalizeState();
    const nextRun = next.session?.storyRun;
    if (!nextRun) return { text: '故事已经不在进行中了。', failed: true };
    nextRun.free = outcome.free;
    nextRun.freeCalls = calls + 1;
    nextRun.seq = (nextRun.seq ?? 0) + 1;
    const checkpoint = {
      id: randomUUID(), runId: nextRun.runId ?? trip.id, packId: nextRun.packId, revision: nextRun.revision,
      resourceVersion: nextRun.resourceVersion ?? 'legacy-unknown', seq: nextRun.seq,
      nodeId: `t${outcome.free.turn}`, budget: storyBudget(nextRun.budget), progress: [], pendingChoice: null,
      events: [...(next.session.events ?? [])], visited: (next.session.visited ?? []).map((entry) => ({ ...entry })),
      choices: [...(next.session.choices ?? [])], timeline: (next.session.timeline ?? []).map((entry) => ({ ...entry })),
      free: outcome.free, at: this.#now(),
    };
    nextRun.checkpoints = [...(nextRun.checkpoints ?? []), checkpoint].slice(-32);
    const receipt = { key: identity.key, digest: identity.digest, at: this.#now(), action: 'say', actor: 'owner',
      runId: nextRun.runId ?? trip.id, stepId: trip.stamp, revision: nextRun.revision };
    next.storyReceipts = normalizeStoryReceipts([...(next.storyReceipts ?? []), receipt], this.#now());
    await this.#commitState(next);
    return { text: JSON.stringify({
      ok: true, narration: narrationText, ended: outcome.free.ended, endRejected: outcome.endRejected ?? null,
      tripId: trip.id, stamp: this.#storyStatus().trip?.stamp ?? null,
      turn: outcome.free.turn, maxTurns, summary: freeSummaryText(setting, outcome.free),
      free: { turn: outcome.free.turn, maxTurns, segment: outcome.free.segment + 1, turnsLeft: freeTurnsLeft(outcome.free, maxTurns),
        canContinue: freeCanContinue(outcome.free, maxTurns), ended: outcome.free.ended,
        facts: outcome.free.facts, flags: outcome.free.flags, counters: outcome.free.counters },
      state: outcome.free.ended ? 'ended' : 'active',
      hint: outcome.free.ended ? '把收尾讲给用户；然后可以用 intent: close（confirm: true）结束并保存回忆。'
        : freeTurnsLeft(outcome.free, maxTurns) === 0 ? '这一段的回合已经说完：可以到面板点「再来一段」，或者用 intent: close 收尾。' : '继续等用户下一句。',
    }) };
  }

  /**
   * 退回上一回合：只回滚自由模式的状态与日志，不退还已花的调用额度。
   * 复用检查点里的 `free` 快照，写入一个新的检查点（新的 seq），原分支不丢。
   */
  async #rewindFreeTurn() {
    const status = this.#storyStatus();
    if (!status.ok) return status;
    const trip = status.trip;
    if (!trip || trip.mode !== 'free') return storyFailure('只有自由模式可以退回上一回合；选项式故事请用检查点分支。');
    const run = this.#state.session?.storyRun;
    if (!run?.free) return storyFailure('现在没有可退回的自由模式进度。');
    const row = this.#storyLibrary.catalog().find(({ pack }) => pack.id === run.packId && pack.revision === run.revision);
    if (!row || !isFreePack(row.pack)) return storyFailure('这篇故事的场景包已经不在了，没法退回。');
    const setting = row.pack.setting;
    const free = normalizeFreeState(run.free, setting);
    if (free.turn < 1) return storyFailure('还没有可以退回的回合。');
    const target = [...(run.checkpoints ?? [])].reverse().find((entry) => entry?.free && entry.free.turn === free.turn - 1);
    if (!target) return storyFailure('找不到上一回合的检查点，没法退回。');
    const next = this.#normalizeState();
    if (!next.session?.storyRun) return storyFailure('故事已经不在进行中了。');
    const nextRun = next.session.storyRun;
    nextRun.free = normalizeFreeState(target.free, setting);
    nextRun.seq = (nextRun.seq ?? 0) + 1;
    nextRun.checkpoints = [...(nextRun.checkpoints ?? []), {
      id: randomUUID(), runId: nextRun.runId ?? trip.id, packId: nextRun.packId, revision: nextRun.revision,
      resourceVersion: nextRun.resourceVersion ?? 'legacy-unknown', seq: nextRun.seq, nodeId: `t${nextRun.free.turn}`,
      budget: storyBudget(nextRun.budget), progress: [], pendingChoice: null,
      events: [...(next.session.events ?? [])], visited: (next.session.visited ?? []).map((entry) => ({ ...entry })),
      choices: [...(next.session.choices ?? [])], timeline: (next.session.timeline ?? []).map((entry) => ({ ...entry })),
      free: nextRun.free, at: this.#now(),
    }].slice(-32);
    await this.#commitState(next);
    return { ...this.#storyStatus(), lastSay: { ok: true, rewound: true, turn: nextRun.free.turn, note: '已退回上一回合；已经花掉的模型调用不退。' } };
  }

  #modelStoryTrip(trip, audience) {
    const outing = this.#state.session ?? this.#state.draft;
    const row = this.#storyLibrary.catalog().find(({ pack, enabled }) => enabled && pack.id === trip.packId && pack.revision === trip.revision);
    return { ...trip, references: storyReferences(row?.pack, outing, audience) };
  }

  async #proposeStoryDM(payload) {
    const prepared = await this.#serial(async () => {
      this.#ensureStarted();
      const status = this.#storyStatus(payload.token);
      if (!status.ok) return status;
      const trip = status.trip;
      if (!trip || payload.tripId !== trip.id || payload.stamp !== trip.stamp) return storyFailure('行程或事件已变更，请刷新。');
      const cognition = await this.#storySecrets.cognition(this.#host?.cognition);
      const reservation = this.#dm.reserve(trip, cognition, this.cfg?.funStoryDM === true, payload.requestId);
      if (!reservation.ok || reservation.replayed) return reservation;
      const next = this.#normalizeState();
      next.session.storyRun.dmBudget = reservation.budget;
      try { await this.#commitState(next); }
      catch { this.#dm.cancel(); return storyFailure('主持额度未能保存；没有发起模型请求。'); }
      return { ...reservation, trip: this.#modelStoryTrip(trip, 'dm'), cognition, epoch: this.#storyEpoch };
    });
    if (!prepared.ok) return prepared;
    if (prepared.replayed) return this.#serial(() => this.#storyStatus(payload.token));
    const recordUsage = (usage) => this.#serial(async () => {
      // After stop/restart the durable reservation remains explicitly unknown.
      if (!usage || !this.#started || this.#storyEpoch !== prepared.epoch) return;
      const next = this.#normalizeState();
      const outings = [next.session, next.draft, ...(next.trips ?? []), ...(next.keepsakeTrips ?? [])];
      let changed = false;
      for (const outing of outings) {
        if (outing?.id !== prepared.trip.id || !outing.storyRun) continue;
        outing.storyRun.dmBudget = addDmUsage(outing.storyRun.dmBudget, usage);
        changed = true;
      }
      if (changed) await this.#commitState(next);
    });
    const outcome = await this.#dm.generate(prepared.cognition, prepared.trip, prepared.attempt, recordUsage);
    return this.#serial(() => {
      const status = this.#started ? this.#storyStatus(payload.token) : null;
      const result = this.#dm.finish(status?.trip, prepared.attempt, outcome, this.#started && this.cfg?.funStoryDM === true);
      return result.ok ? this.#storyStatus(payload.token) : result;
    });
  }

  #storySettings() {
    return { ok: true, dm: this.#storySecrets.status, imageSource: this.#storyImages.status().source,
      imageWorkflow: this.#storyImages.status().workflow,
      nodeLimit: this.#storyNodeLimitValue(), dmEnabled: this.cfg?.funStoryDM === true, imagesEnabled: this.cfg?.funStoryImages === true,
      textOn: this.cfg?.funStoryTextOn === true, freeEnabled: this.cfg?.funStoryFree === true,
      freeTurns: clampInt(this.cfg?.funStoryFreeTurns, 5, 120, 40) };
  }

  /** 故事长度现读配置（0 = 不限）；配置坏值回到默认，不抛错。 */
  #storyNodeLimitValue() {
    const raw = this.cfg?.funStoryNodeLimit;
    if (raw === undefined || raw === null || raw === '') return DEFAULT_STORY_NODE_LIMIT;
    return clampInt(raw, 0, MAX_STORY_NODE_LIMIT, DEFAULT_STORY_NODE_LIMIT);
  }

  /**
   * 0.7.3 一次性迁移：把旧文件里的故事长度、主持地址/模型、图片来源搬进配置。
   *
   * 宿主的 `ctx.cfg` 已经是「默认值 + 盘上值」合并后的对象，所以不能靠
   * `'key' in raw` 判断配置里有没有这项——那永远成立。这里改成：旧文件有值、
   * 且配置里的值仍是默认值（或没有）才搬；搬成功一次就把旧文件清掉/重写，
   * 所以第二次启动不会再写。必须在 `#ensureConfigSection()` 之前跑。
   * 每一步独立 try/catch，失败只记日志，不阻止启动。
   */
  async #migrateLegacyStorySettings() {
    if (!this.#persist) return;
    const raw = this.#rawCfg ?? {};
    const patch = {};
    const unsetOr = (key, fallback) => !(key in raw) || raw[key] === fallback;
    let clearNodeLimit = false;
    try {
      const saved = this.#storyNodeLimit;
      clearNodeLimit = saved.found;
      if (saved.found && unsetOr('funStoryNodeLimit', DEFAULT_STORY_NODE_LIMIT)) {
        patch.funStoryNodeLimit = saved.value;
      }
    } catch (err) {
      this.#host?.log?.warn?.('从0开始的肥鱼大冒险：故事长度迁移失败', { err: msg(err) });
    }
    let legacySecrets = { apiUrl: '', model: '' };
    try {
      legacySecrets = await this.#storySecrets.legacyEndpoint();
    } catch (err) {
      this.#host?.log?.warn?.('从0开始的肥鱼大冒险：主持设置迁移读取失败', { err: msg(err) });
    }
    const secretsMigrated = Boolean(legacySecrets.apiUrl || legacySecrets.model);
    if (secretsMigrated) {
      if (legacySecrets.apiUrl && unsetOr('funStoryDmUrl', DEFAULTS.funStoryDmUrl)) patch.funStoryDmUrl = legacySecrets.apiUrl;
      if (legacySecrets.model && unsetOr('funStoryDmModel', DEFAULTS.funStoryDmModel)) patch.funStoryDmModel = legacySecrets.model;
    }
    let legacyImageSource = '';
    try {
      legacyImageSource = this.#storyImages.legacySource();
    } catch (err) {
      this.#host?.log?.warn?.('从0开始的肥鱼大冒险：图片来源迁移读取失败', { err: msg(err) });
    }
    if (legacyImageSource && unsetOr('funStoryImageSource', DEFAULTS.funStoryImageSource)) {
      patch.funStoryImageSource = legacyImageSource;
    }
    let persisted = true;
    if (Object.keys(patch).length) {
      try {
        this.#persist(patch);
        Object.assign(raw, patch);
        this.#host?.log?.info?.('从0开始的肥鱼大冒险：旧设置已搬进配置', { keys: Object.keys(patch) });
      } catch (err) {
        persisted = false;
        this.#host?.log?.warn?.('从0开始的肥鱼大冒险：旧设置迁移没写进去', { err: msg(err) });
      }
    }
    if (!persisted) return;
    // 配置写成功了才清旧文件；写失败就原样留着，下次启动再试。
    if (clearNodeLimit) await this.#storyNodeLimit.clear();
    if (secretsMigrated) {
      const result = await this.#storySecrets.rewriteKeyOnly().catch(() => ({ ok: false }));
      if (!result?.ok) this.#host?.log?.warn?.('从0开始的肥鱼大冒险：主持密文清理失败，下次启动再试');
    }
    if (legacyImageSource) {
      await this.#storyImages.configure({}).catch(() => null);
    }
  }

  /**
   * 出游 → 设置 → 高级：只保存 API Key 与自定义工作流。
   *
   * 地址、模型、图片来源都在配置页，不从这里进出；老客户端如果还传这些键，
   * 明确报错而不是悄悄忽略。
   */
  async #saveStorySettings(payload = {}) {
    const moved = ['apiUrl', 'model', 'imageSource'].filter((key) => Object.hasOwn(payload, key));
    if (moved.length) {
      return { ...this.#storySettings(), ok: false,
        error: '接口地址、模型名与图片来源在「配置 → 从0开始的肥鱼大冒险」；这里只保存 API Key 与自定义工作流。' };
    }
    const hasKey = Object.hasOwn(payload, 'apiKey');
    const hasWorkflow = Object.hasOwn(payload, 'workflow');
    if (hasWorkflow) {
      const checked = validateStoryWorkflow(payload.workflow);
      if (!checked.ok) return { ...this.#storySettings(), ...checked };
    }
    if (hasKey) {
      const secrets = await this.#storySecrets.save({ apiKey: payload.apiKey });
      if (!secrets.ok) return { ...this.#storySettings(), ...secrets };
    }
    if (hasWorkflow) {
      const image = await this.#storyImages.configure({ workflow: payload.workflow });
      if (!image.ok) return { ...this.#storySettings(), ok: false,
        ...(hasKey ? { partial: 'dm' } : {}),
        error: '自定义工作流保存失败；主持密钥的当前状态已返回，请核对后重试。' };
    }
    return this.#storySettings();
  }

  /** 顶栏「自动配图」开关：只改配置并落盘，不发任何图片请求。 */
  async #saveStoryAutoImages(payload = {}) {
    const auto = payload?.auto;
    if (typeof auto !== 'boolean') {
      return { ok: false, autoImages: this.cfg?.funStoryAutoImages === true, error: '自动配图开关只接受开或关。' };
    }
    if (!this.#rawCfg) this.#rawCfg = {};
    const previous = this.#rawCfg.funStoryAutoImages;
    this.#rawCfg.funStoryAutoImages = auto;
    if (this.#persist) {
      try {
        this.#persist({ funStoryAutoImages: auto });
      } catch {
        // 落盘失败就回滚内存值，面板看到的状态和盘上一致。
        if (previous === undefined) delete this.#rawCfg.funStoryAutoImages;
        else this.#rawCfg.funStoryAutoImages = previous;
        return { ok: false, autoImages: this.cfg?.funStoryAutoImages === true, error: '自动配图设置没保存成功；请重试。' };
      }
    }
    return { ok: true, autoImages: auto };
  }

  /** 当前这一屏的画面参数：面板按钮与「自动准备」共用同一份，避免两处各算一套。 */
  #imageSceneParams(outing) {
    const venue = this.#allPlaces().find((item) => item.id === outing?.placeId);
    // 自由模式没有「待选事件」：取最后一条真实发生的叙述，别拿选项式的事件去凑。
    const row = outing?.storyRun
      ? this.#storyLibrary.catalog().find(({ pack }) => pack.id === outing.storyRun.packId && pack.revision === outing.storyRun.revision)
      : null;
    const free = row && isFreePack(row.pack) ? normalizeFreeState(outing.storyRun.free, row.pack.setting) : null;
    const narration = free?.log?.at(-1)?.narration ?? '';
    const freePlace = free
      ? [row.pack.setting.locations?.[0]?.name, row.pack.setting.locations?.[0]?.desc].filter(Boolean).join('：')
      : '';
    const prompt = outing
      ? [`仅描绘已发生的场景：${outing.placeName}`, narration, freePlace,
        outing.pendingChoice?.area || outing.visited?.at(-1)?.area || '',
        narration ? '' : outing.pendingChoice?.event || outing.events?.at(-1) || venue?.desc || ''].filter(Boolean).join('。')
      : '';
    return { scene: hasScene(venue) ? venue.scene : (freePlace || ''), outfits: outing?.outfit || '', prompt };
  }

  /**
   * 不用点按钮：每走到新的一处就替她把这一屏的参数准备好，递进提示词。
   * 只对委派型来源生效——直连 ComfyUI 要花真实算力，仍然只由面板按钮触发。
   */
  #maybeAutoImageRequest(trip, outing) {
    if (this.cfg?.funStoryAutoImages !== true || this.cfg?.funStoryImages !== true) return;
    if (!outing || !trip || trip.state !== 'active' || trip.step === 'blocked') return;
    if (validateStoryImageSource(this.#storyImages.status().source).kind === 'comfyui') return;
    const key = `${trip.id}:${trip.stamp}`;
    if (this.#autoImageStamp === key) return;
    const params = this.#imageSceneParams(outing);
    if (!params.prompt) return;
    this.#autoImageStamp = key;
    this.#imageDelegation = { at: this.#now(), ...params, by: 'auto' };
  }

  /**
   * 普通出游的每一处也顺手给一份配图参数：她不用等面板点按钮。
   * 和故事那边一样，只对委派型来源生效；画不画仍由她定。
   */
  #autoImageHint(session) {
    if (this.cfg?.funStoryAutoImages !== true || this.cfg?.funStoryImages !== true) return '';
    if (validateStoryImageSource(this.#storyImages.status().source).kind === 'comfyui') return '';
    const params = this.#imageSceneParams(session);
    if (!params.prompt) return '';
    const scene = params.scene ? `scene 填「${params.scene}」` : 'scene 不用填';
    const outfits = params.outfits ? `outfits 填「${params.outfits}」` : 'outfits 按当时的样子';
    return `想给这一处配张图就自己画：imggen_draw ${scene}，${outfits}，prompt 用「${params.prompt}」。不想画就不用管。`;
  }

  async #requestStoryImage() {
    const prepared = await this.#serial(async () => {
      this.#ensureStarted();
      const outing = this.#state.session ?? this.#state.draft ?? this.#savedTrips()[0];
      const home = !outing ? (await this.#locationLibrary.snapshot()).places.find((item) => item.isHome) : null;
      const params = this.#imageSceneParams(outing);
      const prompt = outing ? params.prompt : home ? `${home.name}。${home.desc || ''}` : '鱼的家，安静的日常场景。';
      return { epoch: this.#storyEpoch, enabled: this.cfg?.funStoryImages === true, ...params, prompt };
    });
    // Network and polling never hold the story-action queue.
    const image = await this.#storyImages.generate(prepared);
    if (!this.#started || prepared.epoch !== this.#storyEpoch || (prepared.enabled && this.cfg?.funStoryImages !== true)) {
      this.#storyImages.cancel();
      return { ok: false, error: '图片请求已取消或设置已变更；文字故事仍可继续。' };
    }
    // 委派型来源：画不画由她定，但参数得送到她眼前，否则这一下点了等于没点。
    if (image?.status === 'delegated') {
      this.#imageDelegation = { at: this.#now(), scene: image.scene ?? '', outfits: image.outfits ?? '', prompt: image.prompt ?? '', by: 'owner' };
    }
    return { ok: true, image };
  }

  async #invokeStory(method, payload) {
    const author = { authorList: 'list', authorTemplate: 'template', authorValidate: 'validate', authorPreview: 'preview', authorPlaytest: 'playtest', authorExport: 'export', authorImport: 'import', authorRebind: 'rebind', authorEnable: 'enable', authorDisable: 'disable', authorRemove: 'remove' }[method];
    if (author) {
      const act = () => this.#storyLibrary.act({ ...payload, action: author });
      return ['import', 'rebind', 'enable', 'disable', 'remove'].includes(author) ? this.#serial(act) : act();
    }
    if (method === 'storySettings') return this.#storySettings();
    if (method === 'saveStorySettings') return this.#serial(() => this.#saveStorySettings(payload));
    if (method === 'saveStoryAutoImages') return this.#saveStoryAutoImages(payload);
    if (method === 'clearStoryKey') {
      this.#dm.cancel();
      const result = await this.#storySecrets.clear();
      return { ...this.#storySettings(), ...result };
    }
    if (method === 'storyImage') return this.#requestStoryImage();
    if (method === 'storyImageRead') {
      const result = await this.#storyImages.read(payload.id);
      return result.ok ? { ok: true, image: { dataUrl: result.dataUrl } } : result;
    }
    if (method === 'dmPropose') return this.#proposeStoryDM(payload);
    if (method === 'dmCancel') return this.#serial(() => { this.#dm.cancel(); return this.#storyStatus(payload.token); });
    if (method === 'status' || method === 'dmStatus') return this.#serial(() => this.#storyStatus(payload.token));
    if (method === 'say') {
      return this.#serial(async () => {
        this.#ensureStarted();
        const status = this.#storyStatus();
        if (!status.ok) return status;
        const trip = status.trip;
        if (!trip || trip.mode !== 'free') return storyFailure('只有自由模式用 say；选项式故事请在面板上点选项。');
        if (payload?.tripId !== trip.id || payload?.stamp !== trip.stamp) return storyFailure('故事进度已变更，请刷新后再试。');
        if (typeof payload?.say !== 'string' || !payload.say.trim()) return storyFailure('先说一句想做的事。');
        const result = await this.#storyTextFree(payload, trip);
        if (result.failed) return storyFailure(result.text);
        return { ...this.#storyStatus(), lastSay: JSON.parse(result.text) };
      });
    }
    if (method === 'rewind') return this.#serial(() => this.#rewindFreeTurn());
    if (method === 'deleteMemory') return this.#deleteMemory(payload);
    if (method === 'restoreMemory') return this.#restoreMemory(payload);
    if (method === 'purgeMemory') return this.#purgeMemory(payload);
    if (method === 'emptyTrash') return this.#emptyTrash();
    if (!STORY_ACTIONS.includes(method)) return storyFailure('不支持的故事操作。');
    if (method === 'fork') return this.#serial(async () => { this.#ensureStarted(); return this.#forkStory(payload); });
    if (method !== 'decide') {
      return this.#serial(async () => {
        this.#ensureStarted();
        const before = this.#state;
        try {
          return await this.#runStoryAction(method, payload);
        } catch (error) {
          this.#state = before;
          this.#autonomy.clear();
          throw error;
        }
      });
    }
    const prepared = await this.#serial(async () => {
      this.#ensureStarted();
      const cognition = this.#host?.cognition;
      const status = this.#storyStatus(payload.token);
      if (!status.ok) return status;
      const trip = status.trip;
      if (!trip || payload.tripId !== trip.id || payload.stamp !== trip.stamp || !cognition) return storyFailure('当前行程或角色接口已变更。');
      const reserved = this.#autonomy.reserve(trip, payload.token, this.#now(), this.#autoLimits());
      if (!reserved.ok) return reserved;
      const next = this.#normalizeState();
      next.session.storyRun.budget = reserved.budget;
      try { await this.#commitState(next); }
      catch (error) {
        this.#autonomy.finish(trip, payload.token, this.#now(), storyFailure('预算未保存。'), reserved.attemptId);
        throw error;
      }
      return { ...reserved, cognition, trip: this.#modelStoryTrip(trip, 'fish') };
    });
    if (!prepared.ok) return storyFailure(prepared.error);
    const decision = await requestStoryDecision(prepared.cognition, prepared.trip);
    return this.#serial(() => {
      const trip = this.#started ? this.#storyStatus(payload.token).trip : null;
      const current = trip?.stamp === prepared.trip.stamp ? trip : null;
      const outcome = this.#autonomy.finish(current, payload.token, this.#now(), decision, prepared.attemptId);
      return outcome.ok ? { ...this.#storyStatus(payload.token), ticket: outcome.ticket, reason: outcome.reason } : outcome;
    });
  }

  async #invokeLocations(method, payload) {
    return this.#serial(async () => {
      this.#ensureStarted();
      const library = this.#locationLibrary;
      const snapshot = async () => ({ ok: true, ...this.#decoratePlaces(await library.snapshot()) });
      if (method === 'list') return snapshot();
      if (method === 'get') {
        const place = await library.get(payload.id);
        return { ok: true, place: place ? this.#decoratePlaces({ places: [place] }).places[0] : null };
      }
      if (method === 'cover') return { ok: true, image: await library.readCover(payload.id) };
      if (method === 'previewImport') return { ok: true, ...await library.previewImport(payload.bundle, {
        sourceId: payload.sourceId, defaultStyle: payload.defaultStyle, mappings: payload.mappings, useImportedHome: payload.useImportedHome,
      }) };
      if (method === 'commitImport') return { ok: true, ...await library.commitImport(payload, { requireReview: true }) };
      if (payload.revision !== (await library.snapshot()).revision) return { ok: false, code: 'STALE_LOCATION', error: '地点册已变更，请刷新后再提交。' };
      switch (method) {
        case 'create': {
          const place = await library.create(payload.input);
          return { ...await snapshot(), place };
        }
        case 'update': {
          // C 版：地点册是唯一编辑器。场所字段写 venues.json，画风/关联写 extras。
          const patch = payload.patch ?? {};
          const venue = patch.venue && typeof patch.venue === 'object' ? patch.venue : null;
          if (venue && Object.keys(venue).length) await library.updateVenue(payload.id, venue);
          const supplement = {};
          for (const key of ['style', 'relations', 'coverFocus']) if (key in patch) supplement[key] = patch[key];
          if (Object.keys(supplement).length) await library.update(payload.id, supplement);
          break;
        }
        case 'remove': {
          const row = await library.get(payload.id);
          if (!row) return { ok: false, error: '这处地点已找不到，刷新后再试。' };
          if (row.playable) {
            // 可玩场所的「删除」= 删场所本身（地点册里才能做），预设只能恢复。
            if (isPresetId(VENUES, row.id)) return { ok: false, error: '预设地点删不掉；想还原就用「恢复预设」。' };
            const removed = await this.#removeVenue(row.id);
            if (!removed.ok) return { ok: false, error: removed.error };
            await library.forget(row.id);
          } else {
            await library.remove(payload.id);
          }
          break;
        }
        case 'setHome': await library.setHome(payload.id); break;
        case 'setDefaultStyle': await library.setDefaultStyle(payload.style); break;
        case 'setCover': await library.setCover(payload.id, { dataUrl: payload.dataUrl, coverFocus: payload.coverFocus }); break;
        case 'clearCover': await library.clearCover(payload.id); break;
        case 'reset': {
          const result = await this.#resetVenue(payload.id);
          if (!result.ok) return { ok: false, error: result.error };
          break;
        }
        case 'resetAll': await this.#resetAllVenues(); break;
        case 'restoreImport': await library.restoreImport(payload.recoveryId); break;
        default: return storyFailure('不支持的地点操作。');
      }
      return snapshot();
    });
  }

  /** 地点册的展示字段：中文分类、故事绑定状态和是否自填，供图鉴筛选使用。 */
  #decoratePlaces(snapshot) {
    const builtin = new Set();
    const custom = new Set();
    for (const { pack, builtin: isBuiltin } of this.#storyLibrary.catalog()) {
      if (!pack?.placeId) continue;
      (isBuiltin ? builtin : custom).add(pack.placeId);
    }
    const places = snapshot.places.map((place) => ({
      ...place,
      kindLabel: KIND_LABEL[place.kind] ?? '',
      storyBound: builtin.has(place.id) || custom.has(place.id),
      builtinStoryBound: builtin.has(place.id),
      customStoryBound: custom.has(place.id),
      userPlace: place.playable ? !isPresetId(VENUES, place.id) : true,
      preset: isPresetId(VENUES, place.id),
      overridden: Boolean(this.#overrides?.[place.id] && Object.keys(this.#overrides[place.id]).length),
    }));
    return { ...snapshot, places };
  }

  async #storyLocations(result) {
    if (!result.ok || !Array.isArray(result.catalog)) return result;
    let places;
    try { ({ places } = await this.#locationLibrary.snapshot()); }
    catch { return { ...result, locationWarning: '地点册暂不可读，仍可使用文字场景。' }; }
    const index = new Map(places.map((place) => [place.id, place]));
    const artwork = (place) => place && ({ id: place.id, cover: place.cover, coverFocus: place.coverFocus });
    const enrich = (card) => {
      const place = index.get(card.placeId);
      return { ...card, style: place?.effectiveStyle || card.style, locationArt: artwork(place) };
    };
    const home = places.find((place) => place.isHome);
    return { ...result, home: home ? { ...artwork(home), name: home.name, desc: home.desc, style: home.effectiveStyle } : null,
      catalog: result.catalog.map(enrich),
      trip: result.trip && { ...result.trip, locationArt: artwork(index.get(result.trip.placeId)) } };
  }

  // -------------------------------------------------------------------------
  // 第七个面板：家（2D 房间）
  // -------------------------------------------------------------------------

  /**
   * 「家」的展示面：房间状态 + 当前住所 + 在不在外面。
   *
   * 只读：不写盘、不推进任何行程。`trip` 只是把本 World 自己的 `state.json`
   * 翻译成「出门中 / 还没逛完 / 在家」三种展示，**不会**因为看面板就改变行程。
   */
  async #homeState() {
    const snapshot = await this.#home.snapshot();
    let home = null;
    let libraryWarning = '';
    try {
      home = (await this.#locationLibrary.snapshot()).places.find((place) => place.isHome) ?? null;
    } catch {
      libraryWarning = '地点册暂不可读，房间照常显示。';
    }
    const session = this.#state?.session ?? null;
    const { draft } = this.#outings(this.#now());
    const outing = session ?? draft;
    let trip = { mode: 'home', placeName: '', visited: 0, total: 0 };
    if (outing) {
      const venue = this.#allPlaces().find((item) => item.id === outing.placeId);
      trip = {
        mode: session ? 'out' : 'draft',
        placeName: outing.placeName ?? '',
        visited: Array.isArray(outing.visited) ? outing.visited.length : 0,
        total: venue?.areas?.length ?? 0,
        auto: outing.auto === true,
      };
    }
    // 未完行程票笺：只给「继续」，不提供「替她回家」。
    const resume = draft
      ? { id: draft.id, placeName: draft.placeName ?? '', visited: trip.visited, total: trip.total }
      : null;
    // 心愿便签：第一个还没完成的，只读；管理仍在「纪念册」。
    const activeWish = (this.#state?.wishes ?? []).find((wish) => wish.status === 'active') ?? null;
    // 纪念品：本 World 收藏里最新 3–5 件，按类别落固定位置；没有就不摆。
    const keepsakes = collectSouvenirs(this.#savedTrips(), this.timezone, this.#state?.collection)
      .items.slice(0, 5)
      .map((item) => ({
        name: item.name,
        placeName: item.placeName,
        day: item.lastDay,
        category: souvenirCategory(item.name),
      }));
    const warnings = [snapshot.warning, libraryWarning, this.#stateError ? '行程档案损坏，暂时看不到出门状态。' : '']
      .filter(Boolean);
    // 时段默认：source 还是 default 时，活动由服务端按此刻的小时算，**不写盘**。
    // 用户点一下（source 变 panel）之后才固定成文件里的活动。
    const defaultActivity = defaultActivityAt(Math.floor(minutesIn(this.timezone, this.#now()) / 60));
    const phase = phaseAtHour(Math.floor(minutesIn(this.timezone, this.#now()) / 60));
    const byDefault = snapshot.room.source === 'default';
    const activity = byDefault ? defaultActivity : snapshot.room.activity;
    const room = {
      ...snapshot.room,
      activity,
      label: ACTIVITY_LABELS[activity],
      hint: ACTIVITY_HINTS[activity],
      since: byDefault ? null : snapshot.room.since,
      elapsedMinutes: byDefault ? null : snapshot.room.elapsedMinutes,
      defaultActivity,
    };
    const pendingLine = this.#pendingLine(room, trip);
    return {
      ok: true,
      revision: snapshot.revision,
      room,
      art: snapshot.art,
      damaged: snapshot.damaged,
      warning: warnings.join(' '),
      place: home
        ? { id: home.id, name: home.name, desc: home.desc ?? '', hasCover: Boolean(home.cover), style: home.effectiveStyle ?? '' }
        : null,
      trip,
      resume,
      wish: activeWish
        ? { id: activeWish.id, placeName: activeWish.placeName, target: activeWish.target ?? '', reason: activeWish.reason ?? '' }
        : null,
      keepsakes,
      pendingLine,
      phase,
      placements: snapshot.placements ?? {},
      activities: ACTIVITIES.map((id) => ({ id, label: ACTIVITY_LABELS[id], hint: ACTIVITY_HINTS[id] })),
    };
  }

  /**
   * 「待记一条」：房间这一刻的可复制文本，**不是经历**。
   * 有备注才加最后一段；在外面就写地点和进度。日期时间按 World 自己的时区算。
   */
  #pendingLine(room, trip) {
    const now = this.#now();
    const day = dayIn(this.timezone, now);
    const [, month, date] = day.split('-');
    const where = trip.mode === 'home'
      ? `在家${room.label}`
      : `在${trip.placeName}${trip.total ? `（逛了 ${trip.visited}/${trip.total}）` : ''}`;
    return `${Number(month)} 月 ${Number(date)} 日 ${hmIn(this.timezone, now)} · ${where}${room.note ? ` · ${room.note}` : ''}`;
  }

  /** 模型只读面：房间状态 + 待记一条；不返回图片字节，也不写盘。 */
  async #homeStateTool() {
    const state = await this.#homeState();
    const lines = [`在家：${state.room.label}（${state.room.source === 'default' ? '随时段变' : '已固定'}）`];
    if (state.room.note) lines.push(`备注：${state.room.note}`);
    if (state.room.plan) lines.push(`今天想做什么：${state.room.plan}`);
    if (state.place?.name) lines.push(`住所：${state.place.name}`);
    if (state.trip.mode === 'out') lines.push(`现在在外面：${state.trip.placeName}（逛了 ${state.trip.visited}/${state.trip.total}）`);
    else if (state.trip.mode === 'draft') lines.push(`还留着一趟：${state.trip.placeName}（逛了 ${state.trip.visited}/${state.trip.total}）`);
    else lines.push('现在在家，没有进行中的行程。');
    lines.push(`待记一条：${state.pendingLine}`);
    lines.push('（房间状态是画面，不是经历；要不要记由用户和主会话决定。）');
    return { text: lines.join('\n'), pendingLine: state.pendingLine, revision: state.revision, room: state.room, trip: state.trip };
  }

  /** 模型写面：只切姿态/写备注，改的是 `fun/home/room.json`，不写生活记录。 */
  async #homeActivityTool(args) {
    const expectedRevision = args?.expectedRevision;
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) {
      return { failed: true, text: '[fun_home_activity 失败] expectedRevision 必须是 fun_home_state 返回的非负整数。' };
    }
    try {
      await this.#home.setActivity(args?.activity, { note: args?.note, revision: expectedRevision });
      const state = await this.#homeState();
      return {
        text: `换成「${state.room.label}」了。\n待记一条：${state.pendingLine}\n（切姿势不写生活记录，也不推进行程。）`,
        pendingLine: state.pendingLine, revision: state.revision,
      };
    } catch (error) {
      if (error?.code === 'STALE_ROOM') {
        return { failed: true, text: '[fun_home_activity 失败] 房间刚被改过（revision 已不是最新的）。先用 fun_home_state 再看一次；没有自动重试。' };
      }
      if (error?.code === 'INVALID_ACTIVITY') {
        return { failed: true, text: '[fun_home_activity 失败] 不认识这个活动；只有十个固定 id，先看 fun_home_state。' };
      }
      return { failed: true, text: `[fun_home_activity 失败] ${msg(error)}` };
    }
  }

  async #invokeHome(method, payload) {
    if (method === 'state') return await this.#homeState();
    if (method === 'snapshotList') {
      const list = await this.#home.listSnapshots();
      return { ok: true, items: list.items.map(({ data, ...rest }) => rest) };
    }
    if (method === 'exportRoom') {
      const data = await this.#home.exportRoom();
      return { ok: true, ...data };
    }
    if (method === 'art') {
      const allowed = ['background', 'foreground', 'painting', 'character'];
      const slot = allowed.includes(payload?.slot) ? payload.slot : 'character';
      const image = await this.#home.readArt(slot, payload?.activity ?? 'idle');
      return { ok: true, image };
    }
    return this.#serial(async () => {
      switch (method) {
        case 'setActivity':
          await this.#home.setActivity(payload.activity, { note: payload.note, since: payload.since, revision: payload.revision });
          break;
        case 'setNote': await this.#home.setNote(payload.note, payload.revision); break;
        case 'setPlan': await this.#home.setPlan(payload.plan, payload.revision); break;
        case 'resume': {
          const result = await this.#resumeTool(payload?.id);
          if (result.failed) return { ok: false, error: result.text };
          break;
        }
        case 'setBackground': await this.#home.setBackground(payload.dataUrl, payload.revision); break;
        case 'clearBackground': await this.#home.clearBackground(payload.revision); break;
        case 'setForeground': await this.#home.setForeground(payload.dataUrl, payload.revision); break;
        case 'clearForeground': await this.#home.clearForeground(payload.revision); break;
        case 'setCharacter': await this.#home.setCharacter(payload.activity, payload.dataUrl, payload.revision); break;
        case 'clearCharacter': await this.#home.clearCharacter(payload.activity, payload.revision); break;
        case 'saveHotspots': await this.#home.saveHotspots(payload.hotspots, payload.revision); break;
        case 'savePlacements': await this.#home.savePlacements(payload.placements, payload.revision); break;
        case 'setPainting': await this.#home.attachPainting(payload.path, payload.revision); break;
        case 'clearPainting': await this.#home.clearPainting(payload.revision); break;
        case 'snapshotSave': {
          const state = await this.#homeState();
          await this.#home.saveSnapshot({
            phase: state.phase,
            room: { activity: state.room.activity, label: state.room.label, note: state.room.note, plan: state.room.plan },
            art: {
              background: state.art.background,
              characters: state.art.characters,
              hotspots: state.art.hotspots,
              foreground: state.art.foreground,
              painting: state.art.painting,
            },
            placements: state.placements,
            keepsakes: state.keepsakes,
          });
          break;
        }
        case 'snapshotRemove': await this.#home.removeSnapshot(payload.id); break;
        case 'importRoom': await this.#home.importRoom(payload.data ?? payload); break;
        case 'resetRoom': await this.#home.resetRoom(payload.revision); break;
        default: return { ok: false, error: `home 没有 ${method} 这个方法` };
      }
      return await this.#homeState();
    });
  }

  async #invoke(panel, method, args) {
    try {
      this.#ensureStarted();
      const payload = args?.[0] ?? {};
      if (panel === 'home') return await this.#invokeHome(method, payload);
      if (panel === 'outing' && ['locationList', 'locationGet', 'locationCover', 'locationPreviewImport', 'locationCommitImport', 'locationCreate', 'locationUpdate', 'locationRemove', 'locationReset', 'locationResetAll', 'locationSetHome', 'locationSetDefaultStyle', 'locationSetCover', 'locationClearCover', 'locationRestoreImport'].includes(method)) {
        const locationMethod = method.slice('location'.length);
        return await this.#invokeLocations(locationMethod[0].toLowerCase() + locationMethod.slice(1), payload);
      }
      if (panel === 'outing' && method.startsWith('place')) {
        const placeMethod = method.slice('place'.length);
        method = placeMethod[0].toLowerCase() + placeMethod.slice(1);
        panel = 'places';
      }
      if (panel === 'outing' && ['get', 'cover', 'create', 'update', 'setHome', 'setDefaultStyle', 'setCover', 'clearCover', 'previewImport', 'commitImport', 'restoreImport'].includes(method)) return await this.#invokeLocations(method, payload);
      if (panel === 'outing' && ['list', 'remove', 'reset', 'resetAll'].includes(method) && args?.at(-1)?.__panelSource === 'locations') return await this.#invokeLocations(method, payload);
      if (panel === 'outing' && ['list', 'remove', 'reset', 'resetAll', 'blank', 'history', 'resume', 'closeDraft', 'save'].includes(method)) panel = 'places';
      if (panel === 'home') return await this.#invokeHome(method, payload);
      if (panel === 'locations') return await this.#invokeLocations(method, payload);
      if (panel === 'story') {
        if (['list', 'template', 'validate', 'preview', 'playtest', 'export', 'import', 'rebind', 'enable', 'disable', 'remove'].includes(method)) {
          const reads = ['list', 'template', 'validate', 'preview', 'playtest', 'export'];
          const payload = { ...(args?.[0] ?? {}), action: method };
          if (reads.includes(method)) return await this.#storyLibrary.act(payload);
          this.#bumpCache();
          return await this.#serial(() => this.#storyLibrary.act(payload));
        }
        if (method === 'locationCover') return await this.#invokeLocations('cover', payload);
        return await this.#storyLocations(await this.#invokeStory(method, payload));
      }
      if (this.#stateError && (panel === 'journal' || (panel === 'places' && method === 'history'))) return storyFailure(this.#stateError);
      if (panel === 'journal') {
        const source = args?.at(-1)?.__panelSource;
        if (method === 'list') return source === 'shelf' ? this.#shelfData() : this.#bookData();
        if (method === 'trip') return this.#tripLookup({ id: payload.id }, true);
        if (method === 'favorite') return await this.#favorite(payload.id, payload.keep !== false);
        if (method === 'keep') {
          const result = favoriteTrip(this.#state, payload.id, payload.keep !== false);
          if (result.ok) await this.#save();
          return result;
        }
        throw new Error('journal does not support method ' + method);
      }
      if (panel === 'stories') {
        const reads = ['list', 'template', 'validate', 'preview', 'playtest', 'export'];
        const writes = ['import', 'rebind', 'enable', 'disable', 'remove'];
        const payload = { ...(args?.[0] ?? {}), action: method };
        if (reads.includes(method)) return await this.#storyLibrary.act(payload);
        if (writes.includes(method)) {
          this.#bumpCache();
          return await this.#serial(() => this.#storyLibrary.act(payload));
        }
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
          case 'save': return await this.#serial(() => this.#saveVenue(args?.[0] ?? args ?? {}));
          case 'remove': return await this.#serial(() => this.#removeVenue(args?.[0]?.id ?? args?.id));
          // B 阶段：恢复预设（抹掉这一处 / 全部覆盖层）。
          case 'reset': return await this.#serial(() => this.#resetVenue(args?.[0]?.id ?? args?.id));
          case 'resetAll': return await this.#serial(() => this.#resetAllVenues());
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
      return { ok: false, error: msg(err), ...((panel === 'locations' || panel === 'outing' || panel === 'home') && typeof err?.code === 'string' ? { code: err.code } : {}) };
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
      // 面板可能只提交改动过的字段，所以先叠在当前有效值上再压差异；
      // 否则没提交的字段会被当成「用户清空了」。
      const current = this.#allPlaces().find((v) => v.id === editingId) ?? presetHit;
      const merged = { ...current, ...raw, id: editingId };
      const name = typeof merged.name === 'string' ? merged.name.trim() : '';
      const clash = VENUES.find((v) => v.id !== editingId
        && (v.name === name || (Array.isArray(merged.aliases)
          && merged.aliases.some((a) => String(a).trim() === v.name))));
      if (clash) {
        return { ok: false, error: `「${clash.name}」是另一处预设的名字，换一个吧——不然按名字找会撞。` };
      }
      const { fields, problems } = cleanOverride(merged, presetHit);
      if (problems.length) return { ok: false, error: problems.join('；') || '这条改动存不下来' };
      if (Object.keys(fields).length) overrides[editingId] = fields;
      else delete overrides[editingId]; // 跟预设一模一样 = 没有覆盖层
      await this.#saveVenueFile(list, overrides);
      this.#host?.log?.info?.('从0开始的肥鱼大冒险：改了预设场所（覆盖层）', { id: editingId, fields: Object.keys(fields) });
      return { ok: true, venue: this.#allPlaces().find((v) => v.id === editingId), places: this.#places().length };
    }

    // 自己的地点：`user-` 新建 / 编辑，`place-` 是从旧地点库迁进来的。
    if (editingId && !isUserPlaceId(editingId)) {
      return { ok: false, error: `不认识的 id「${editingId}」：既不是预设，也不是自己加的地方。` };
    }
    const name = typeof raw?.name === 'string' ? raw.name.trim() : '';
    if (name && VENUES.some((v) => v.name === name)) {
      return { ok: false, error: `「${name}」是预设里的名字，换一个吧——不然按名字找会撞。` };
    }

    const existingIds = [...VENUES.map((v) => v.id), ...list.map((v) => v.id)];
    const id = editingId || idFromName(name, existingIds);
    const existing = list.find((v) => v.id === id) ?? null;
    // 部分提交（只改一两个字段）不能把没提交的字段清空：先叠在旧值上。
    // 这次带了 areas 就以 areas 重新判断可玩——清空「能逛的」= 退回不可玩地点。
    const merged = existing ? { ...existing, ...raw, id } : { ...raw, id };
    if (existing && Object.hasOwn(raw ?? {}, 'areas') && !Object.hasOwn(raw ?? {}, 'playable')) delete merged.playable;
    const { venue, problems } = cleanUserVenue(merged, { requireId: true });
    if (!venue) return { ok: false, error: problems.join('；') || '这条地点存不下来' };

    const at = list.findIndex((v) => v.id === venue.id);
    if (at >= 0) list[at] = venue;
    else list.push(venue);

    await this.#saveVenueFile(list, overrides);
    this.#host?.log?.info?.('从0开始的肥鱼大冒险：保存了自填地点', { id: venue.id, name: venue.name, editing: at >= 0 });
    return { ok: true, venue, places: this.#places().length };
  }

  /** 删掉一个用户自己的地点。预设一律拒绝（想还原用 reset）。 */
  async #removeVenue(id) {
    const target = typeof id === 'string' ? id.trim() : '';
    if (!target) return { ok: false, error: '没给 id' };
    if (isPresetId(VENUES, target)) {
      return { ok: false, error: '预设里的地方删不掉；想还原就在编辑表单里点「恢复预设」。' };
    }
    if (!isUserPlaceId(target)) {
      return { ok: false, error: '只能删自己加的地方。' };
    }
    const list = (this.#userVenues ?? []).filter((v) => v.id !== target);
    if (list.length === (this.#userVenues ?? []).length) {
      return { ok: false, error: '没找到这个自填地点' };
    }
    await this.#saveVenueFile(list, this.#overrides ?? {});
    this.#host?.log?.info?.('从0开始的肥鱼大冒险：删掉自填地点', { id: target });
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
    this.#host?.log?.info?.('从0开始的肥鱼大冒险：恢复了一处预设', { id: target });
    return { ok: true, places: this.#places().length };
  }

  /** 一键恢复全部预设：清空整个覆盖层（自填地点不动）。 */
  async #resetAllVenues() {
    const count = Object.keys(this.#overrides ?? {}).length;
    if (!count) return { ok: true, places: this.#places().length, cleared: 0 };
    await this.#saveVenueFile(this.#userVenues ?? [], {});
    this.#host?.log?.info?.('从0开始的肥鱼大冒险：恢复了全部预设', { cleared: count });
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
        // 内置故事带来的地点虽然沿用了 user- 前缀（历史行程与回忆里存的就是这个 id），
        // 但它们是随版本内置的预设，删不掉，也不算「我的地点」。
        userVenue: !isPresetId(VENUES, v.id),
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
      userVenueCount: places.filter((x) => !isPresetId(VENUES, x.id)).length,
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
      auto: t.auto === true,
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
      this.#storyEpoch = randomUUID();
      this.#dm.cancel();
      this.#autonomy.clear();
      this.#host?.log?.info?.('从0开始的肥鱼大冒险：出游记录已清空');
      return { ok: true };
    });
  }

  // -------------------------------------------------------------------------
  // 生命周期
  // -------------------------------------------------------------------------

  async start(host) {
    if (this.#started) return;
    this.#host = host;
    this.#state = await this.#load();
    // 用户自填地点 + 预设覆盖层：读失败就当没有，预设照常能逛。
    const venueMigration = await migrateSampleVenue(this.venuesFile());
    this.#venueMigrationError = venueMigration.ok ? null : venueMigration.error;
    // 内置故事带来的地点：只移除与内置定义完全一致的历史副本，改过的保留。
    const promoted = await migratePromotedVenues(this.venuesFile(), VENUES);
    if (!promoted.ok) this.#venueMigrationError = this.#venueMigrationError ?? promoted.error;
    const venueFile = await this.#loadVenueFile();
    this.#userVenues = venueFile.venues;
    this.#overrides = venueFile.overrides;
    // C 版：旧地点库里的基础地点并进 venues.json（保留原 id），画风/关联/封面留在 extras。
    await this.#migrateLegacyPlaces();
    await this.#storyNodeLimit.load();
    await this.#storyLibrary.load();
    await this.#storySecrets.load();
    await this.#storyImages.init();
    // 先搬旧文件里的值，再补默认值：顺序反了「配置里没有这个键」就永远不成立。
    await this.#migrateLegacyStorySettings();
    this.#ensureConfigSection();
    this.#started = true;
    // 出门许可不注册自己的定时器：「她自己的时间」由「鱼的每一天」叫醒，不在这里重复一套。
    this.#host?.log?.info?.('从0开始的肥鱼大冒险已启动', {
      places: this.#places().length,
      userVenues: this.#userVenues.length,
      overridden: Object.keys(this.#overrides).length,
      session: this.#state.session?.placeName ?? null,
      trips: this.#state.trips.length,
    });
  }

  async stop() {
    this.#started = false;
    this.#storyImages.cancel();
    this.#dm.cancel();
    this.#autonomy.clear();
    this.#storyEpoch = randomUUID();
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
