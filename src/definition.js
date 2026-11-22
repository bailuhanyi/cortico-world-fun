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
    zh: '处理待选择事件，可按回执选择或略过。',
    en: 'Resolve or skip a pending event choice.',
  },
  fun_resume: {
    zh: '继续一趟未逛完的行程。',
    en: 'Resume an unfinished outing.',
  },
  fun_wander: {
    zh: '逛一个项目，可记录本次购买、拍照或吃喝；待选择事件按回执处理。',
    en: 'Wander one spot and optionally record a purchase, photo or food; resolve pending choices from the receipt.',
  },
  fun_home: {
    zh: '结束行程并返回本次摘要与记录提示。',
    en: 'End the trip and return its summary and logging prompt.',
  },
  fun_home_state: {
    zh: '只读查看房间状态与可复制的「待记一条」；不含图片，不写盘。',
    en: 'Read the room state and a copyable "one line to log"; no images, no writes.',
  },
  fun_home_activity: {
    zh: '切换她在家的十个固定活动之一，可附备注；revision 冲突不自动重试。',
    en: 'Switch one of her ten fixed home activities, optionally with a note; no retry on revision conflicts.',
  },
  fun_start: {
    zh: '查看当前推荐地点；详细筛选用 fun_places。',
    en: 'Show current place recommendations; use fun_places for filters.',
  },
  fun_route: {
    zh: '规划和管理最多两站的出门路线，明确前往下一站或提前结束。',
    en: 'Plan and manage a two-stop outing, explicitly move on or end early.',
  },
  fun_view: {
    zh: '查看正在逛、未逛完或已回家的行程。',
    en: 'View active, unfinished, or finished outings.',
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
  fun_story: {
    zh: '管理、校验与预览本地故事工坊，支持自填地点。',
    en: 'Manage, validate, and preview local story packs, including custom places.',
  },
  fun_shelf: {
    zh: '按地点查询长期纪念品收藏和收集进度。',
    en: 'Query long-term souvenirs and collection progress by place.',
  },
  fun_story_places: { zh: '查询地点索引或单个地点详情，只读，不开始出游；JSON 回执经标准 text 返回。', en: 'Read the place index or one place detail; does not start an outing. JSON is returned in standard text.' },
  fun_story_candidates: { zh: '查询故事候选和公开简介，不返回未来分支；JSON 回执经标准 text 返回。', en: 'Read story candidates and public synopses without future branches. JSON is returned in standard text.' },
  fun_story_detail: { zh: '查询单个故事的公开资料与可用原因，不返回节点内容；JSON 回执经标准 text 返回。', en: 'Read one story’s public metadata and availability without node contents. JSON is returned in standard text.' },
  fun_story_current: { zh: '查询当前故事的状态和已发生内容，不推进故事；JSON 回执经标准 text 返回。', en: 'Read current story state and actual events without advancing it. JSON is returned in standard text.' },
  fun_story_recap: { zh: '查询已保存故事的事实回顾，不写入日程或长期记忆；JSON 回执经标准 text 返回。', en: 'Read an actual story recap without writing a schedule or long-term memory. JSON is returned in standard text.' },
  fun_story_schedule: { zh: '生成可复制的故事候选短文本；复制不写日程；JSON 回执经标准 text 返回。', en: 'Create copyable story-candidate text; copying does not write a schedule. JSON is returned in standard text.' },
  fun_story_start: { zh: '在文字通道里开始一段故事（需开启文字通道开关），开始前重新校验条件；JSON 回执经标准 text 返回。', en: 'Start a story from a text channel (requires the text switch), rechecking conditions. JSON is returned in standard text.' },
  fun_story_act: { zh: '在文字通道里推进当前故事：选项式先给待确认提议，自由模式每句推进一回合；JSON 回执经标准 text 返回。', en: 'Advance the current story from a text channel: option packs return a proposal, free packs advance one turn per line. JSON is returned in standard text.' },
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
    if (typeof structuredClone !== 'function') throw new Error('从0开始的肥鱼大冒险需要 Node 22+ 的 structuredClone。');
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
   * 方案 B 起多了一个内部事件 `fun.home.free`：到她「自己出门的时段」时，
   * 本 World 推一条只有她看得到的提醒，叫她先看当天的日程（feast_life_now）再决定
   * 出不出门。**它只负责叫醒**——不读「鱼的每一天」的日程、不挑地方、不替她出门。
   * 关着 `funHomeAutoGo` 或时段留空时，这条路径根本不注册。
   */
  describe: {
    tools: describeTools(FUN_TOOL_DECLS),
    events: [
      {
        type: 'fun.home.free',
        description: {
          zh: '到她自己的时段：一条 internal 事件提醒她「这会儿是你自己的时间」，请她先看当天日程（feast_life_now）；这一段自由就用 fun_start / fun_go 自己出门，回来 feast_life_play 记一笔；写着上班、通勤或睡觉就不出门。origin 是 internal，不是主人发的消息；去不去、去哪儿由她定，本插件不挑地方。',
          en: 'One of her own-time slots came due: an internal event says this stretch is hers and asks her to check that day\'s schedule (feast_life_now) first. If the stretch is free she may head out with fun_start / fun_go and log it with feast_life_play; if it says work, commute or sleep she stays in. Internal origin, not an owner message; whether and where to go is her call — the plugin never picks a place.',
        },
        trigger: 'flush',
      },
    ],
  },
};

export default funDefinition;
