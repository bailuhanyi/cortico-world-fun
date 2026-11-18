/**
 * WorldDefinition：默认配置、实例工厂和自描述。
 * create() 必须保持纯：不读状态文件、不建目录、不启动定时器。
 */
import { DEFAULTS, ID, LABEL } from './config.js';
import { FUN_TOOL_DECLS, FunWorld } from './world.js';

/** 自描述里每个工具配一句给人看的话，按工具名。 */
const TOOL_SUMMARIES = {
  fun_places: {
    zh: '查询当前地点，按营业状态和拥挤度排序；可筛选或列出全部。',
    en: 'Query available places ranked by opening hours and crowd; filter by kind or list all.',
  },
  fun_go: {
    zh: '进门开始行程，返回当前时段描写和可逛项目。',
    en: 'Start a trip and return the current-time description and available areas.',
  },
  fun_choice: {
    zh: '处理逛到的结构化事件选择，按回执中的 choiceId 和 optionId 选择。',
    en: 'Resolve a structured event choice using the choiceId and optionId from the receipt.',
  },
  fun_wander: {
    zh: '逛一个项目，可记录本次购买、拍照或吃喝；待选择事件按回执处理。',
    en: 'Wander one spot and optionally record a purchase, photo or food; resolve pending choices from the receipt.',
  },
  fun_home: {
    zh: '结束行程并返回本次摘要与记录提示。',
    en: 'End the trip and return its summary and logging prompt.',
  },
  fun_start: {
    zh: '查看当前推荐地点；详细筛选用 fun_places。',
    en: 'Show current place recommendations; use fun_places for filters.',
  },
  fun_view: {
    zh: '按需查询近期或珍藏的行程记录。',
    en: 'Query recent or kept trip records on demand.',
  },
  fun_wishes: {
    zh: '查看明确记下的出游心愿和状态，不催促。',
    en: 'View outing wishes and their status without reminders.',
  },
  fun_wish: {
    zh: '记录、暂缓、恢复或取消一个出游心愿。',
    en: 'Add, pause, resume or cancel an outing wish.',
  },
  fun_keepsake: {
    zh: '珍藏或取消珍藏一趟行程，不影响纪念册近期列表和长期收藏。',
    en: 'Keep or unkeep a trip without changing the recent trip book or permanent collection.',
  },
  fun_shelf: {
    zh: '按地点查询长期纪念品收藏和收集进度。',
    en: 'Query long-term souvenirs and collection progress by place.',
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
