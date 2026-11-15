/**
 * 娱乐时间的配置段与文案。
 *
 * 段名是 `config.json` 的 `worlds.fun`。WebUI 热改就地写这个对象，
 * World 每次用时现读，所以这里只有默认值与 schema，不持有副本。
 *
 * **刻意只有三项**（`FUN-联动方案.md` §四 定稿的正是这三项）：
 *   funOn / funSessionTTLMin / funAskReport。
 *
 * 为什么没有「叫醒档位」这类键：这个 World **不自己推事件**。她什么时候出门，
 * 由「鱼的每一天」的 `lifeFreeSlots` 叫醒时那一行 `lifeFreeMenu` 顺手一提，
 * 或者她自己 `fun_start`。再开一套档位就成了双重叫醒，还要跟 feast 抢时间轴——
 * 那是方案 B 的事，不在这一版里。
 */

export const ID = 'fun';
export const LABEL = '娱乐时间';

/** `worlds.fun` 段的默认值；`enabled` 由框架的 World 开关管理。 */
export const DEFAULTS = Object.freeze({
  enabled: false,
  /** 总开关。关掉=不注入场所清单，工具与面板还在（想现在去随时能去）。 */
  funOn: true,
  /** 一次出游挂多久自动收摊（分钟）。到点不催，只是不再算「正在逛」。 */
  funSessionTTLMin: 90,
  /** 收摊回执要不要提醒她 feast_life_play 记一笔、跟主人说一句。 */
  funAskReport: true,
});

const ZH = {
  label: '娱乐时间',
  lamp: '娱乐时间',
  stopped: '未启动',
  badgeSession: '正在逛',
  badgePlaces: '能去哪儿',
  prompt: '娱乐时间 World 的环境说明：她可以真去逛十二处地方——游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山。进门、逛摊位、买纪念品、拍照、收摊；收摊回执把这一趟收成一句话，交给她记进自己的日程。不调别的 World 的工具、不读别人的状态。',
  config: {
    title: '娱乐时间',
    funOn: '开着',
    funOnDesc: '总开关。关掉之后不往提示词里注入场所清单；工具和面板照旧可用，她想逛随时能逛。',
    funSessionTTLMin: '一趟逛多久',
    funSessionTTLMinDesc: '一次出游最多挂多少分钟，过了这段时间就不再算「正在逛」——不会催她收摊，也不会替她记一笔，只是下一次 fun_wander 会提醒她这一趟该收了。',
    funAskReport: '收摊说一声',
    funAskReportDesc: '开启时，收摊回执会提醒她把「今天逛了什么」用 feast_life_play 记进自己的日程，再跟主人说一句。关掉就只给这段文字，不提记账。',
  },
  storage: {
    label: '出游记录',
    note: '清掉之后，正在进行的那一趟和纪念册里的所有趟都会没（逛过哪些地方、买了什么、在哪儿拍过照）。场所库是内置的，不受影响；别的东西一概不动。',
  },
};

const EN = {
  label: 'Fun time',
  lamp: 'Fun time',
  stopped: 'not running',
  badgeSession: 'Out',
  badgePlaces: 'Places',
  prompt: 'The Fun Time world: she can actually go out — amusement park, aquarium, temple fair, fan convention. Walk in, wander the stalls, buy a souvenir, take a photo; the closing receipt turns the trip into one line she can log into her own day, and image generation draws the scene and outfit she actually wore.',
  config: {
    title: 'Fun time',
    funOn: 'Enabled',
    funOnDesc: 'Master switch. Off: no venue list in the prompt; the tools and panel still work, she can go any time.',
    funSessionTTLMin: 'A trip lasts',
    funSessionTTLMinDesc: 'How many minutes an outing stays open. Past this it no longer counts as in progress — she is never nagged to wrap up and nothing is logged for her; the next fun_wander just mentions the trip should close.',
    funAskReport: 'Say something at the end',
    funAskReportDesc: 'When on, the closing receipt reminds her to log the trip with feast_life_play and tell the owner one sentence.',
  },
  storage: {
    label: 'Outing records',
    note: 'Clearing this erases the trip in progress and every trip in the book (where she went, what she bought, where she took photos). The venue list is built in and unaffected; nothing else is touched.',
  },
};

export function text(language = 'zh') {
  return language === 'en' ? EN : ZH;
}

/**
 * 面板自己的文案。
 *
 * 客户端产物（`dist/webui.js`）不 import 服务端模块，所以面板标题和说明
 * 这里给一份、bundle 里另存一份——改文案时两处一起改（feast 也是这么做的）。
 */
export function panelText(language = 'zh') {
  if (language === 'en') {
    return {
      places: {
        title: 'Where to go',
        description: 'The twelve places, whether each is open right now, and the trip she is on.',
      },
      book: {
        title: 'Trip book',
        description: 'Every trip she has taken: where she went, what she wandered and bought.',
      },
    };
  }
  return {
    places: {
      title: '去哪儿',
      description: '十二处地方这会儿开没开、人多不多，以及她正在逛的那一趟。',
    },
    book: {
      title: '纪念册',
      description: '她去过的每一趟：逛了什么、买了什么、在哪儿拍了照。',
    },
  };
}

/** WebUI 的配置组；路径必须落在 `worlds.fun.` 段内。 */
export function configGroup(language = 'zh') {
  const t = text(language).config;
  const K = `worlds.${ID}`;
  return {
    id: `world:${ID}`,
    owner: `world:${ID}`,
    schema: {
      type: 'object',
      title: t.title,
      properties: {
        [`${K}.funOn`]: {
          type: 'boolean',
          title: t.funOn,
          description: t.funOnDesc,
          'x-hot': true,
        },
        [`${K}.funSessionTTLMin`]: {
          type: 'integer',
          title: t.funSessionTTLMin,
          description: t.funSessionTTLMinDesc,
          minimum: 15,
          maximum: 480,
          'x-suffix': ' 分钟',
          'x-hot': true,
        },
        [`${K}.funAskReport`]: {
          type: 'boolean',
          title: t.funAskReport,
          description: t.funAskReportDesc,
          'x-hot': true,
        },
      },
    },
  };
}
