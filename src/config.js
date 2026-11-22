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
  /** 一次出游挂多久自动回家（分钟）。到点不催，只是不再算「正在逛」。 */
  funSessionTTLMin: 90,
  /** 回家回执要不要提醒她 feast_life_play 记一笔、跟主人说一句。 */
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
  /** 剧情图片独立开关；来源在故事面板设置，默认回执委派，显式本地URL可选直连。 */
  funStoryImages: false,
  /** 可选文本主持；默认沿用宿主，面板可配置本机加密的独立接口。 */
  funStoryDM: false,
  /** 文字通道（QQ/控制台聊天）能不能开局和推进故事；面板永远可玩。 */
  funStoryTextOn: false,
  /** 自由模式（version 3 场景包）：作者写设定，DM 即兴演。 */
  funStoryFree: false,
  /** 自由模式单趟回合上限（1 回合 = 1 次模型调用）。 */
  funStoryFreeTurns: 40,
  /** 鱼自主游玩：每段最多几步（走一步 = 一次真实推进，含不花模型的那一步）。 */
  funAutoSteps: 20,
  /** 鱼自主游玩：每段最多几次「鱼自己决定」（每一次都是一次真实模型请求）。 */
  funAutoCalls: 6,
});

const ZH = {
  label: '娱乐时间',
  lamp: '娱乐时间',
  stopped: '未启动',
  badgeSession: '正在逛',
  badgePlaces: '能去哪儿',
  prompt: '娱乐时间 World 的环境说明：她可以真去逛二十处地方——游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山、咖啡店、奶茶店、餐厅、图书馆、夜市、澡堂、旧货市场、江边。还能在面板上自己加地方、改预设。进门、逛摊位、买纪念品、拍照、回家；回家回执把这一趟收成一句话，交给她记进自己的日程。不调别的 World 的工具、不读别人的状态。',
  config: {
    title: '娱乐时间',
    funOn: '开着',
    funOnDesc: '总开关。关掉之后不往提示词里注入场所清单；工具和面板照旧可用，她想逛随时能逛。',
    funSessionTTLMin: '一趟逛多久',
    funSessionTTLMinDesc: '一次出游最多挂多少分钟，过了这段时间就不再算「正在逛」。不会催她回家，也不会替她记一笔；下一次游逛时会提醒她这趟已经挂了很久。',
    funAskReport: '回家说一声',
    funAskReportDesc: '开启时，回家回执会提醒她把「今天逛了什么」用 feast_life_play 记进自己的日程，再跟主人说一句。关掉就只给这段文字，不提记账。',
    funTasteFromFeast: '吃喝的味道去「鱼的每一天」拿',
    funTasteFromFeastDesc: '开启时，咖啡店/奶茶店/餐厅/夜市的回执会让她用 feast_menu → feast_eat 去「鱼的每一天」点一道真的，那里才有九维口感、香气和余韵。关掉就只说「在这儿喝了什么」，一个字都不提味道。\n\n注意：这不是自动检测——本插件不会去探测别的扩展装没装（World 契约不允许互相依赖）。所以装没装都要你自己定这一项：装了鱼的每一天建议开着。',
    funStoryDM: '可选文本主持',
    funStoryDMDesc: '默认关闭。去「故事工坊」面板设置区填写接口地址、API Key 和模型名（地址与 Key 是密码输入，不回显；模型名留空则由接口用自己的默认模型）。地址与 Key 都留空沿用宿主 cognition.request；都填写则由本插件直连 OpenAI 兼容 POST /chat/completions，密钥仅存在本机，不传给宿主或其他插件。Windows 使用 DPAPI 当前用户加密，其他平台禁用凭据保存；换机器或重装需重填。可立即清除。主持只提议合法选项，当前行动者明确提交才执行。每趟 6 次、每步 2 次（含重试、失败、取消），未知 token 不估算。',
    funStoryTextOn: '文字通道也能玩故事',
    funStoryTextOnDesc: '默认关闭。开启后，QQ 或控制台聊天里也能开始和推进故事（fun_story_start / fun_story_act 才生效）；关掉时只能在娱乐时间面板里点，六个只读查询不受影响。\n\n注意：World 拿不到消息来源，所以这是「允许文字通道」的总开关，不能只对 QQ 生效。面板任何时候都能玩。',
    funStoryFree: '自由模式（场景包）',
    funStoryFreeDesc: '默认关闭。开启后可以使用 version 3「场景包」：作者只写大方向、正史、人物和结局条件，具体怎么演交给主持即兴。主持只能修改作者登记过的状态，结局由程序按条件判定；旧的选项式故事完全不受影响，两种模式可以同时存在。',
    funStoryFreeTurns: '自由模式一段走多少回合',
    funStoryFreeTurnsDesc: '一段最多多少回合（1 回合 = 1 次模型调用）。场景包自己写了更小的 maxTurns 就按更小的来。用完后这一段的输入框会收起：可以点「再来一段」接着走（一趟最多三段，要你亲手点），也可以收起进回忆；不会自动续。',
    funAutoSteps: '鱼自己玩：每段最多几步',
    funAutoStepsDesc: '「鱼自己游玩」每一段最多自动走几步，默认 20，最多 200。走动、选选项都算一步。用满后这一段停下，轮到你；你可以点「再来一段」把步数和决定次数都重置，一趟最多三段（要你亲手点，不自动续）。这个数只影响鱼自己玩，不影响你手动点。',
    funAutoCalls: '鱼自己玩：每段最多几次决定',
    funAutoCallsDesc: '「鱼自己游玩」每一段最多让鱼自己决定几次，默认 6，最多 120。每一次都是一次真实的模型请求（花的是你自己的模型额度），所以改大会更费。用满后仍然算「走不动」：可以点「再来一段」，也可以你替她选这一步（她会记为「由你替选」）。旧版的 20 步 / 6 次就是这个默认值。',
    storyDmApiUrl: '接口地址', storyDmApiKey: 'API Key', storyDmModel: '模型名（可留空）', storyDmApiSaved: '已保存 / 未设置', storyDmApiClear: '清除密钥',
    storyDmApiInvalid: '接口地址与密钥必须成对设置或成对清空；不支持的加密环境不会保存。',
    storyDmApiHint: '请到「故事工坊」设置区填写。地址和密钥仅存本机 DPAPI 密文；模型名按你的服务商填，留空则不发送 model。都不会进入普通配置或故事导出，保存后只显示掩码。',
    funStoryImages: '剧情图片生成',    funStoryImagesDesc: '独立开关，默认关闭。去「故事工坊」设置区填写一个来源。留空：本插件给主对话 imggen_draw 的 scene/outfits/prompt，由主对话调用「鱼的生图包」，需要该插件；无法确认安装时明确标注，未装则跳过。填本机 loopback URL：本插件按 ComfyUI HTTP 协议直连，需运行 ComfyUI 并有可用 checkpoint；30 秒或超过 8 MiB/格式错误即失败，保留原插画。填其他插件名/说明：只生成委派回执，由主对话或该插件执行，需要你自行准备该能力。委派图片由执行插件管理，直连图片存本插件 dataDir/fun/story-images。关闭不发图片请求，只用预制或显式导入插画；文字故事始终不等图片。',
    storyImageSource: '图片来源（留空为鱼的生图包）',
    storyImageSourceHint: '留空由主对话调用 imggen_draw；本机 URL 由本插件直连 ComfyUI；其他文本交主对话委派。不会调用其他 World 的工具或读取其私有状态。',
    storyImageDelegated: '已生成委派说明，等待主对话或指定插件执行。', storyImageDirect: '显式本机 URL：由本插件直连 ComfyUI。',
    storyImageNoPlugin: '未安装鱼的生图包；跳过图片，文字故事照常继续。', storyImageUnavailable: '图片暂不可用，继续使用本地插画。',
    storyEditorExpand: '展开', storyEditorCollapse: '收起', storyEditorDirty: '有未保存修改',
    storyEmptyTitle: '还没有故事', storyEmptyBody: '还没有故事，点「编写故事」写第一篇。',
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
    funStoryDM: 'Optional text DM',
    funStoryDMDesc: 'Off by default. In Fish Story World settings enter the API URL, Key and model name (URL and Key are password fields, never echoed; leave the model blank to use the endpoint’s own default). Leave URL and Key blank for host cognition.request, or set both for this plugin to call OpenAI-compatible POST /chat/completions directly. Credentials stay on this machine, never sent to the host or other plugins. Windows DPAPI CurrentUser encryption only; saving is disabled elsewhere. Re-enter after changing machines or reinstalling; clear immediately at any time. The current actor must explicitly submit a valid proposal. Limits: 6 calls per run, 2 attempts per step, including retries, failures and cancellations; unknown tokens remain unknown.',
    funStoryTextOn: 'Play stories from text',
    funStoryTextOnDesc: 'Off by default. On: stories can be started and advanced from QQ or console chat (fun_story_start / fun_story_act). Off: only the Fun Time panel can play; the six read-only queries still work.\n\nA World cannot see which channel called it, so this is one switch for all text channels — it cannot be QQ-only. The panel always works.',
    funStoryFree: 'Free mode (scene packs)',
    funStoryFreeDesc: 'Off by default. On: version 3 scene packs become playable. The author writes only the premise, canon, cast and ending conditions; the host DM improvises. The DM may change only registered state, and endings are decided by the program. Option-based stories are untouched; both modes can coexist.',
    funStoryFreeTurns: 'Free-mode turns per run',
    funStoryFreeTurnsDesc: 'Maximum turns in one run (one turn = one model call). A pack that declares a smaller maxTurns wins. When the segment is spent the input closes: start another segment (at most three per run, always by an explicit click) or wrap the run up. It never continues on its own.',
    funAutoSteps: 'Fish autoplay: steps per segment',
    funAutoStepsDesc: 'How many steps the fish may take on its own in one segment. Default 20, maximum 200. Walking and choosing both count. When spent, the segment stops and it is your turn; you can start another segment (steps and decisions reset, at most three per run, always by an explicit click). This only limits the fish; your own clicks are not counted.',
    funAutoCalls: 'Fish autoplay: decisions per segment',
    funAutoCallsDesc: 'How many times the fish may decide on its own in one segment. Default 6, maximum 120. Every decision is a real model request billed to your own quota, so raising it costs more. When spent the fish is blocked: start another segment, or pick for her yourself (recorded as your substitution). These defaults are the old 20 steps / 6 decisions.',
    storyDmApiUrl: 'API URL', storyDmApiKey: 'API Key', storyDmModel: 'Model name (optional)', storyDmApiSaved: 'Saved / Not set', storyDmApiClear: 'Clear key',
    storyDmApiInvalid: 'Set or clear the URL and key together. Unsupported encryption environments cannot save credentials.',
    storyDmApiHint: 'Use Fish Story World settings. Only local DPAPI ciphertext is stored; the model name is plain and optional (blank sends no model). No credentials enter ordinary configuration or story exports, and saved fields show masks only.',
    funStoryImages: 'Story image generation',
    funStoryImagesDesc: 'Separate opt-in, off by default. Enter one source in Fish Story World settings. Blank: this plugin returns imggen_draw scene/outfits/prompt for the main conversation to call Fish Image Studio; that plugin is required, installation uncertainty is explicit and absence skips images. Loopback URL: this plugin calls the local ComfyUI HTTP API; a running server and available checkpoint are required. A 30-second timeout, images over 8 MiB or invalid formats keep the original artwork. Other plugin name/instructions: a receipt delegates execution to that plugin or the main conversation, and you must provide that capability. Delegated images belong to the executing plugin; direct images go to this plugin dataDir/fun/story-images. Off means no image requests, only prebuilt or explicitly imported art. Text never waits for images.',
    storyImageSource: 'Image source (blank: Fish Image Studio)',
    storyImageSourceHint: 'Blank delegates imggen_draw to the main conversation; a local URL connects this plugin to ComfyUI; other text delegates to the named plugin. No tools or private state of other Worlds are accessed.',
    storyImageDelegated: 'Drawing instructions are ready for the main conversation or selected plugin.', storyImageDirect: 'Explicit local URL: this plugin connects to ComfyUI.',
    storyImageNoPlugin: 'Fish Image Studio is not installed; skip images and continue the text story.', storyImageUnavailable: 'Images are unavailable; keep local artwork.',
    storyEditorExpand: 'Expand', storyEditorCollapse: 'Collapse', storyEditorDirty: 'Unsaved changes',
    storyEmptyTitle: 'No stories yet', storyEmptyBody: 'No stories yet. Choose Write a story to create the first one.',
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
        [`${K}.funStoryDM`]: {
          type: 'boolean', title: t.funStoryDM, description: t.funStoryDMDesc, 'x-hot': true,
        },
        [`${K}.funStoryImages`]: {
          type: 'boolean', title: t.funStoryImages, description: t.funStoryImagesDesc, 'x-hot': true,
        },
        [`${K}.funStoryTextOn`]: {
          type: 'boolean', title: t.funStoryTextOn, description: t.funStoryTextOnDesc, 'x-hot': true,
        },
        [`${K}.funStoryFree`]: {
          type: 'boolean', title: t.funStoryFree, description: t.funStoryFreeDesc, 'x-hot': true,
        },
        [`${K}.funStoryFreeTurns`]: {
          type: 'integer', title: t.funStoryFreeTurns, description: t.funStoryFreeTurnsDesc,
          minimum: 5, maximum: 120, 'x-suffix': ' 回合', 'x-hot': true,
        },
        [`${K}.funAutoSteps`]: {
          type: 'integer', title: t.funAutoSteps, description: t.funAutoStepsDesc,
          minimum: 1, maximum: 200, 'x-suffix': ' 步', 'x-hot': true,
        },
        [`${K}.funAutoCalls`]: {
          type: 'integer', title: t.funAutoCalls, description: t.funAutoCallsDesc,
          minimum: 1, maximum: 120, 'x-suffix': ' 次', 'x-hot': true,
        },
      },
    },
  };
}
