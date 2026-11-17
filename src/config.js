/**
 * 娱乐时间的配置段与文案。
 *
 * 段名是 `config.json` 的 `worlds.fun`。WebUI 热改就地写这个对象，
 * World 每次用时现读，所以这里只有默认值与 schema，不持有副本。
 *
 * 目前四项用户可配的（初版定稿是 funOn / funSessionTTLMin / funAskReport 三项，
 * 后来加了吃喝开关 funTasteFromFeast）：
 *   funOn / funSessionTTLMin / funAskReport / funTasteFromFeast。
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
  /**
   * 吃喝的味道去不去「鱼的每一天」拿。
   *
   * **这不是自动探测**：World 不能去探测别的扩展装没装（那本身就是一种依赖，
   * 认证要查）。所以这是用户手动拨的一个意愿开关：
   *
   *   true  → 吃喝的回执会写「用 feast_menu / feast_eat 去点一道真的，那里才有九维口感」
   *   false → 只写「你在这儿喝了什么」，一个字都不提味道
   *
   * 默认 true：装了鱼的每一天是常见情况；没装时她调不到 feast_eat，会自己退回
   * 「只说我喝了什么」——所以开着也不会编味道。
   */
  funTasteFromFeast: true,
});

const ZH = {
  label: '娱乐时间',
  lamp: '娱乐时间',
  stopped: '未启动',
  badgeSession: '正在逛',
  badgePlaces: '能去哪儿',
  prompt: '娱乐时间 World 的环境说明：她可以真去逛二十处地方——游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山、咖啡店、奶茶店、餐厅、图书馆、夜市、澡堂、旧货市场、江边。还能在面板上自己加地方、改预设。进门、逛摊位、买纪念品、拍照、收摊；收摊回执把这一趟收成一句话，交给她记进自己的日程。不调别的 World 的工具、不读别人的状态。',
  config: {
    title: '娱乐时间',
    funOn: '开着',
    funOnDesc: '总开关。关掉之后不往提示词里注入场所清单；工具和面板照旧可用，她想逛随时能逛。',
    funSessionTTLMin: '一趟逛多久',
    funSessionTTLMinDesc: '一次出游最多挂多少分钟，过了这段时间就不再算「正在逛」——不会催她收摊，也不会替她记一笔，只是下一次 fun_wander 会提醒她这一趟该收了。',
    funAskReport: '收摊说一声',
    funAskReportDesc: '开启时，收摊回执会提醒她把「今天逛了什么」用 feast_life_play 记进自己的日程，再跟主人说一句。关掉就只给这段文字，不提记账。',
    funTasteFromFeast: '吃喝的味道去「鱼的每一天」拿',
    funTasteFromFeastDesc: '开启时，咖啡店/奶茶店/餐厅/夜市的回执会让她用 feast_menu → feast_eat 去「鱼的每一天」点一道真的，那里才有九维口感、香气和余韵。关掉就只说「在这儿喝了什么」，一个字都不提味道。\n\n注意：这不是自动检测——本插件不会去探测别的扩展装没装（World 契约不允许互相依赖）。所以装没装都要你自己定这一项：装了鱼的每一天建议开着。',
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
    funTasteFromFeast: 'Get tastes from Fish Every Day',
    funTasteFromFeastDesc: 'On: receipts at the coffee shop, tea stand, restaurant and night market tell her to order something real via feast_menu → feast_eat in Fish Every Day, where the nine-axis flavour profile lives. Off: she only says what she had, and never describes a taste.\n\nNote: this is not auto-detection — a World must not probe whether another extension is installed (the contract forbids interdependence). Set it yourself; leave it on if you have Fish Every Day.',
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
        description: 'The twenty places (plus any you add or edit), whether each is open right now, and the trip she is on.',
      },
      book: {
        title: 'Trip book',
        description: 'Every trip she has taken: where she went, what she wandered and bought.',
      },
      shelf: {
        title: 'Shelf',
        description: 'Everything the trips have gathered, grouped by place: what came from where and when, how many times she has been, and what is still left to wander at each place.',
      },
    };
  }
  return {
    places: {
      title: '去哪儿',
      description: '二十处地方（还有你自己加的、改过的）这会儿开没开、人多不多，以及她正在逛的那一趟。',
    },
    book: {
      title: '纪念册',
      description: '她去过的每一趟：逛了什么、买了什么、在哪儿拍了照。',
    },
    shelf: {
      title: '纪念品架',
      description: '这些趟攒下来的东西，按地方归着：哪件是在哪儿哪天拿到的、去过几次、每一处还差什么没逛。',
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
        [`${K}.funTasteFromFeast`]: {
          type: 'boolean',
          title: t.funTasteFromFeast,
          description: t.funTasteFromFeastDesc,
          'x-hot': true,
        },
      },
    },
  };
}
