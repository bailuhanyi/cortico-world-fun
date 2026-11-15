/**
 * WorldDefinition：默认配置、实例工厂和自描述。
 * create() 必须保持纯：不读状态文件、不建目录、不启动定时器。
 */
import { DEFAULTS, ID, LABEL } from './config.js';
import { FUN_TOOL_DECLS, FunWorld } from './world.js';

/** 自描述里每个工具配一句给人看的话，按工具名。 */
const TOOL_SUMMARIES = {
  fun_places: {
    zh: '看今天能去哪儿逛：十二处地方，按开放时段和拥挤度排；也能只看某一类或列全部。',
    en: 'See where she can go today: twelve places ranked by opening hours and crowd; can filter by kind or list all.',
  },
  fun_go: {
    zh: '进门：挑一处地方开始这一趟，回执给进门那一下的样子和能逛什么。',
    en: 'Walk in: pick a place and start a trip; the receipt describes arriving and what there is to wander.',
  },
  fun_wander: {
    zh: '逛一处项目或摊位：给细节和一条随机小事件，顺手能买纪念品、拍张照。',
    en: 'Wander one spot: details plus a small random event; can buy a souvenir or take a photo.',
  },
  fun_home: {
    zh: '收摊：把这一趟收成一句话，递到她嘴边去 feast_life_play 记一笔。',
    en: 'Close the trip: sums it into one line she can log with feast_life_play.',
  },
  fun_start: {
    zh: '不用等叫醒，现在就想出门时看有哪些地方、怎么走。',
    en: 'Start on her own, without waiting for a wake-up.',
  },
  fun_view: {
    zh: '纪念册：以前逛过哪些趟、每一趟逛了什么买了什么。',
    en: 'The trip book: where she has been, what she wandered and bought.',
  },
};

function describeTools(decls) {
  return decls.map(({ name, description, parameters, tags }) => ({
    name,
    description,
    parameters,
    tags,
    summary: TOOL_SUMMARIES[name],
  }));
}

export const funDefinition = {
  id: ID,
  label: LABEL,
  /** `worlds.fun` 段的默认值；启用与否由部署决定，定义里恒为 false。 */
  defaults: () => structuredClone(DEFAULTS),
  preflight: () => {
    if (typeof structuredClone !== 'function') throw new Error('娱乐时间需要 Node 22+ 的 structuredClone。');
  },
  create: (ctx) => new FunWorld({
    cfg: ctx.cfg,
    dataDir: ctx.dataDir,
    timezone: ctx.timezone,
    // 补齐配置段用：宿主的 /api/config 读的是落盘的 worlds.fun（不做默认值合并）。
    persist: typeof ctx.persist === 'function' ? (patch) => ctx.persist(patch) : null,
  }),
  /**
   * 自描述：可能出现的全部工具与事件，不进提示词。
   *
   * **events 是空数组，这是有意的**——这个 World 不推任何事件。
   * 出门的时机由「鱼的每一天」的 lifeFreeMenu 那一行顺手一提，或她自己 fun_start。
   * 两套叫醒会互相抢时间轴；写成空数组也让认证那边一眼看得出它不主动打扰。
   */
  describe: {
    tools: describeTools(FUN_TOOL_DECLS),
    events: [],
  },
};

export default funDefinition;
