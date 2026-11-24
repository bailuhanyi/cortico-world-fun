/**
 * 从0开始的肥鱼大冒险的配置段与文案。
 *
 * 段名是 `config.json` 的 `worlds.fun`。WebUI 热改就地写这个对象，
 * World 每次用时现读，所以这里只有默认值与 schema，不持有副本。
 *
 * 目前用户可配的：funOn / funAutoOuting / funShareAfter，
 * 加上 0.7.3 归位的故事长度、主持地址与模型、剧情图片来源。
 * **API Key 与自定义工作流不在配置里**：前者只存本机 DPAPI 密文，后者是 32 KB
 * JSON（宿主 string 只渲染单行输入），入口都在「出游 → 设置 → 高级」。
 *
 * 她什么时候出门：`funHomeAutoGo` 是「主人允许她自己出门」的许可，本身不带时段。
 * 几点算她自己的时间由「鱼的每一天」的「她自己的时间」决定；那边叫醒她时，
 * 空着的时段就是她可以出门的许可。去不去、去哪儿、去几次仍由她和主对话定。
 * 本 World 不读「鱼的每一天」的日程、不挑地方、不替她出门，也不再注册自己的叫醒。
 */

export const ID = 'fun';
export const LABEL = '从0开始的肥鱼大冒险';

/** `worlds.fun` 段的默认值；`enabled` 由框架的 World 开关管理。 */
export const DEFAULTS = Object.freeze({
  enabled: false,
  /** 总开关。关掉=不注入场所清单，工具与面板还在（想现在去随时能去）。 */
  funOn: true,
  /** 新配置名；旧名 funHomeAutoGo 在读取与迁移时兼容。 */
  funAutoOuting: false,
  /** 新配置名；旧名 funAskReport 在读取与迁移时兼容。 */
  funShareAfter: true,
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
  /**
   * 「家」的「允许她自己出门」：默认关；只是许可，不带自己的叫醒时段。
   * 时段跟着「鱼的每一天」的「她自己的时间」走——本 World 不读它的日程、不挑地方。
   */
  funHomeAutoGo: false,
  /** 剧情图片独立开关；来源在故事面板设置，默认回执委派，显式本地URL可选直连。 */
  funStoryImages: false,
  /**
   * 不用点按钮：每一处新的场景都自动准备一份「委派参数」递给她，画不画由她定。
   * 只对委派型来源生效（直连 ComfyUI 要花算力，仍然只由面板按钮触发）。
   */
  funStoryAutoImages: true,
  /** 可选文本主持；默认沿用宿主，面板可配置本机加密的独立接口。 */
  funStoryDM: false,
  /**
   * 文字通道（QQ/控制台聊天）能不能开局和推进故事；面板永远可玩。
   *
   * 默认开：2026-11-23 群友反馈「聊天里玩不了故事」比省 schema 更重要。
   * 关掉仍有效——关着时聊天里只留 candidates / detail，省 6 个工具的开销。
   */
  funStoryTextOn: true,
  /**
   * 聊天里也能用作者工具 `fun_story`。
   *
   * 默认关：它 1.1k 字符的 schema 是每轮固定开销，而写故事主要在面板里做
   * （面板走 `#invoke`，不依赖这个工具）。要在聊天里让她建/停/导入故事再打开。
   */
  funStoryAuthorInChat: false,
  /** 自由模式（version 3 场景包）：作者写设定，DM 即兴演。 */
  funStoryFree: true,
  /** 自由模式单趟回合上限（1 回合 = 1 次模型调用）。 */
  funStoryFreeTurns: 200,
  /** 鱼自主游玩：每段最多几步（走一步 = 一次真实推进，含不花模型的那一步）。 */
  funAutoSteps: 20,
  /** 鱼自主游玩：每段最多几次「鱼自己决定」（每一次都是一次真实模型请求）。 */
  funAutoCalls: 6,
  /**
   * 故事长度：新建/导入故事最多几个节点。0 = 不限。
   *
   * 0.7.3 从 `fun/story-node-limit.json` 搬进配置（旧文件启动时一次性迁移），
   * 面板不再有输入框。改小不会删掉或阻断已有故事。
   */
  funStoryNodeLimit: 16,
  /**
   * 文本主持的接口地址（OpenAI 兼容）。留空沿用宿主 cognition.request。
   *
   * 0.7.3 从 `fun/story-secrets.json` 的密文里搬出来（地址不是秘密）；
   * **API Key 仍在 story-secrets.json（DPAPI）**，绝不进普通配置。
   */
  funStoryDmUrl: '',
  /** 文本主持的模型名；留空由接口用自己的默认模型。同样搬自 story-secrets。 */
  funStoryDmModel: '',
  /**
   * 剧情图片来源。留空 = 委派「鱼的生图包」；loopback URL = 直连 ComfyUI；
   * 其他文本 = 交给指定插件。0.7.3 从 `fun/story-images/settings.json` 搬进配置，
   * 那个文件只留自定义工作流。
   */
  funStoryImageSource: '',
});

const ZH = {
  label: '从0开始的肥鱼大冒险',
  lamp: '从0开始的肥鱼大冒险',
  stopped: '未启动',
  badgeSession: '正在逛',
  badgePlaces: '能去哪儿',
  prompt: '从0开始的肥鱼大冒险 World 的环境说明：她可以真去逛二十处地方——游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山、咖啡店、奶茶店、餐厅、图书馆、夜市、澡堂、旧货市场、江边。还能在面板上自己加地方、改预设。进门、逛摊位、买纪念品、拍照、回家；回家回执把这一趟收成一句话，交给她记进自己的日程。本插件自己不调用其他 World 的工具、也不读别人的私有状态；她要在家里点吃喝、查日程或配图，仍可以自己调 feast_* / imggen_draw。',
  config: {
    title: '从0开始的肥鱼大冒险',
    advancedPrefix: '高级 · ',
    funOn: '开着',
    funOnDesc: '总开关。关掉之后不往提示词里注入场所清单；工具和面板照旧可用，她想逛随时能逛。',
    funShareAfter: '回家说一声',
    funShareAfterDesc: '开启时，回家回执会提醒她把「今天逛了什么」用 feast_life_play 记进自己的日程，再跟主人说一句。关掉就只给这段文字，不提记账。',
    funAutoOuting: '家：允许她自己出门',
    funAutoOutingDesc: '打开后，她自己出门的许可跟着「鱼的每一天」的「她自己的时间」走：那边叫醒她时，先看当天日程（feast_life_now），自由就出门、写着上班睡觉就不出门。本插件不再单独设「自己出门的时段」，也不读对方的日程、不挑地方、不会自己把她送出门。默认关闭。',
    funSessionTTLMin: '一趟逛多久',
    funSessionTTLMinDesc: '一次出游最多挂多少分钟，过了这段时间就不再算「正在逛」。不会催她回家，也不会替她记一笔；下一次游逛时会提醒她这趟已经挂了很久。',
    funAskReport: '回家说一声',
    funAskReportDesc: '开启时，回家回执会提醒她把「今天逛了什么」用 feast_life_play 记进自己的日程，再跟主人说一句。关掉就只给这段文字，不提记账。',
    funTasteFromFeast: '吃喝的味道去「鱼的每一天」拿',
    funTasteFromFeastDesc: '开启时，咖啡店/奶茶店/餐厅/夜市的回执会让她用 feast_menu → feast_eat 去「鱼的每一天」点一道真的，那里才有九维口感、香气和余韵。关掉就只说「在这儿喝了什么」，一个字都不提味道。\n\n注意：这不是自动检测——本插件不会去探测别的扩展装没装（World 契约不允许互相依赖）。所以装没装都要你自己定这一项：装了鱼的每一天建议开着。',
    funHomeAutoGo: '家：允许她自己出门',
    funHomeAutoGoDesc: '打开后，她自己出门的许可跟着「鱼的每一天」的「她自己的时间」走：那边叫醒她时，先看当天日程（feast_life_now），自由就出门、写着上班睡觉就不出门。本插件不再单独设「自己出门的时段」，也不读对方的日程、不挑地方、不会自己把她送出门。默认关闭。',
    funStoryDM: '可选文本主持',
    funStoryDMDesc: '高级设置里的「主持方式」可选宿主默认或外接接口；外接设置只在选中时显示。DPAPI 密钥仅存本机密文。外接请求失败时回退宿主一次并明确提示，不会自动更改选择。主持只提议合法选项，当前行动者明确提交才执行。每趟 6 次、每步 2 次（含重试、失败、取消），未知 token 不估算。',
    funStoryNodeLimit: '故事长度（节点上限）',
    funStoryNodeLimitDesc: '新建或导入故事最多几个节点，0 = 不限。单篇 JSON 仍最多 32 KB；改小不会删除或阻断已有故事。',
    funStoryDmUrl: '文本主持接口地址',
    funStoryDmUrlDesc: '留空沿用宿主。填 OpenAI 兼容地址（http/https，不能带账号、查询或片段）。API Key 在「出游 → 设置 → 高级」填写，只存本机密文。',
    funStoryDmModel: '文本主持模型名',
    funStoryDmModelDesc: '留空由接口用自己的默认模型；最长 200 字，不能含控制字符。密钥不进配置。',
    funStoryImageSource: '剧情图片来源',
    funStoryImageSourceDesc: '留空 = 委派「鱼的生图包」；本机 loopback URL = 直连 ComfyUI；其他文本 = 交给指定插件。自定义工作流仍在「出游 → 设置 → 高级」。',
    funStoryTextOn: '文字通道也能玩故事',
    funStoryTextOnDesc: '默认开启：QQ 或控制台聊天里也能开始和推进故事（fun_story_start / fun_story_act），六个只读查询也全部可用。关掉后聊天里只留 fun_story_candidates / fun_story_detail 两个查询应付「有什么故事」，其余故事工具不出现，每轮省下它们的 schema；面板任何时候都能玩。\n\n注意：World 拿不到消息来源，所以这是「允许文字通道」的总开关，不能只对 QQ 生效。',
    funStoryAuthorInChat: '聊天里也能管故事',
    funStoryAuthorInChatDesc: '默认关闭。开启后，聊天里会多一个作者工具 fun_story（模板、校验、预览、导入导出、启停、删除）；关着时它不出现——这能省下它每轮约 1.1k 字符的固定开销。面板里的「故事工坊」不靠这个工具，任何时候都能写、能管。',
    funStoryFree: '自由模式（场景包）',
    funStoryFreeDesc: '默认开启。可以使用 version 3「场景包」：作者只写大方向、正史、人物和结局条件，具体怎么演交给主持即兴。主持只能修改作者登记过的状态，结局由程序按条件判定；旧的选项式故事完全不受影响，两种模式可以同时存在。',
    funStoryFreeTurns: '自由模式一段走多少回合',
    funStoryFreeTurnsDesc: '一段最多多少回合（1 回合 = 1 次模型调用）。场景包自己写了更小的 maxTurns 就按更小的来。用完后这一段的输入框会收起：可以点「再来一段」接着走（一趟最多三段，要你亲手点），也可以收起进回忆；不会自动续。',
    funAutoSteps: '鱼自己玩：每段最多几步',
    funAutoStepsDesc: '「鱼自己游玩」每一段最多自动走几步，默认 20，最多 200。走动、选选项都算一步。用满后这一段停下，轮到你；你可以点「再来一段」把步数和决定次数都重置，一趟最多三段（要你亲手点，不自动续）。这个数只影响鱼自己玩，不影响你手动点。',
    funAutoCalls: '鱼自己玩：每段最多几次决定',
    funAutoCallsDesc: '「鱼自己游玩」每一段最多让鱼自己决定几次，默认 6，最多 120。每一次都是一次真实的模型请求（花的是你自己的模型额度），所以改大会更费。用满后仍然算「走不动」：可以点「再来一段」，也可以你替她选这一步（她会记为「由你替选」）。旧版的 20 步 / 6 次就是这个默认值。',
    storyDmApiUrl: '接口地址', storyDmApiKey: 'API Key', storyDmModel: '模型名（可留空）', storyDmApiSaved: '已保存 / 未设置', storyDmApiClear: '清除密钥',
    storyDmApiInvalid: '接口地址与密钥必须成对设置或成对清空；不支持的加密环境不会保存。',
    storyDmApiHint: '请到「出游」面板设置区填写。地址和密钥仅存本机 DPAPI 密文；模型名按你的服务商填，留空则不发送 model。都不会进入普通配置或故事导出，保存后只显示掩码。',
    funStoryImages: '剧情图片生成',    funStoryImagesDesc: '高级设置里的「剧情图片来源」可选关闭、委派或本机 ComfyUI 直连；只有选直连时才显示 loopback 地址和工作流。委派可由主对话调用生图工作室；不会调用其他 World 工具。直连继续使用现有 30 秒与 8 MiB/格式校验。',
    funStoryAutoImages: '自动准备配图参数', funStoryAutoImagesDesc: '默认开启。总闸开着、且有进行中的行程时，每走到新的一处（或故事翻到新的一页），本插件自动把这一屏的 scene/outfits/prompt 准备好递给她；45 分钟后自动过期，不会反复催。这个开关也在出游页顶部，无行程或总闸关时禁用。只对委派型来源生效——直连本机 ComfyUI 会花算力，仍然只由「出游 → 设置 → 高级」里的按钮触发。',
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
  label: 'Adventures of Fat Fish from Scratch',
  lamp: 'Adventures of Fat Fish from Scratch',
  stopped: 'not running',
  badgeSession: 'Out',
  badgePlaces: 'Places',
  prompt: 'Adventures of Fat Fish from Scratch: she can actually go out — amusement park, aquarium, temple fair, fan convention. Walk in, wander the stalls, buy a souvenir, take a photo; the closing receipt turns the trip into one line she can log into her own day, and image generation draws the scene and outfit she actually wore.',
  config: {
    title: 'Adventures of Fat Fish from Scratch',
    advancedPrefix: 'Advanced · ',
    funOn: 'Enabled',
    funOnDesc: 'Master switch. Off: no venue list in the prompt; the tools and panel still work, she can go any time.',
    funShareAfter: 'Say something at the end',
    funShareAfterDesc: 'When on, the closing receipt reminds her to log the trip with feast_life_play and tell the owner one sentence.',
    funAutoOuting: 'Home: let her go out on her own',
    funAutoOutingDesc: 'On: her permission to head out follows "her own time" in Fish Every Day. When that wake-up arrives she checks the day\'s schedule (feast_life_now) first — go out if the stretch is free, stay in if it says work or sleep. This plugin no longer keeps its own time slots, does not read the other world\'s schedule, never picks a place and never sends her out by itself. Off by default.',
    funSessionTTLMin: 'A trip lasts',
    funSessionTTLMinDesc: 'How many minutes an outing stays open. Past this it no longer counts as in progress — she is never nagged to wrap up and nothing is logged for her; the next fun_wander just mentions the trip should close.',
    funAskReport: 'Say something at the end',
    funAskReportDesc: 'When on, the closing receipt reminds her to log the trip with feast_life_play and tell the owner one sentence.',
    funTasteFromFeast: 'Get tastes from Fish Every Day',
    funTasteFromFeastDesc: 'On: receipts at the coffee shop, tea stand, restaurant and night market tell her to order something real via feast_menu → feast_eat in Fish Every Day, where the nine-axis flavour profile lives. Off: she only says what she had, and never describes a taste.\n\nNote: this is not auto-detection — a World must not probe whether another extension is installed (the contract forbids interdependence). Set it yourself; leave it on if you have Fish Every Day.',
    funHomeAutoGo: 'Home: let her go out on her own',
    funHomeAutoGoDesc: 'On: her permission to head out follows "her own time" in Fish Every Day. When that wake-up arrives she checks the day\'s schedule (feast_life_now) first — go out if the stretch is free, stay in if it says work or sleep. This plugin no longer keeps its own time slots, does not read the other world\'s schedule, never picks a place and never sends her out by itself. Off by default.',
    funStoryDM: 'Optional text DM',
    funStoryDMDesc: 'Choose host default or an external endpoint in Advanced settings; external controls appear only when selected. The DPAPI key stays encrypted locally. A failed external request falls back to the host once with a visible notice, without changing the setting. The current actor must explicitly submit a valid proposal. Limits: 6 calls per run, 2 attempts per step, including retries, failures and cancellations; unknown tokens remain unknown.',
    funStoryNodeLimit: 'Story length (node limit)',
    funStoryNodeLimitDesc: 'Maximum nodes when creating or importing a story; 0 = unlimited. Each story JSON is still capped at 32 KB, and lowering this never deletes or blocks existing stories.',
    funStoryDmUrl: 'Text DM endpoint',
    funStoryDmUrlDesc: 'Blank uses the host. Enter an OpenAI-compatible URL (http/https, no credentials, query or fragment). The API key is entered in Outing → Settings → Advanced and stored only as local ciphertext.',
    funStoryDmModel: 'Text DM model name',
    funStoryDmModelDesc: 'Blank lets the endpoint use its own default; at most 200 characters and no control characters. The key never enters configuration.',
    funStoryImageSource: 'Story image source',
    funStoryImageSourceDesc: 'Blank delegates to Fish Image Studio; a loopback URL connects directly to ComfyUI; other text goes to the named plugin. The custom workflow still lives in Outing → Settings → Advanced.',
    funStoryTextOn: 'Play stories from text',
    funStoryTextOnDesc: 'On by default: stories can be started and advanced from QQ or console chat (fun_story_start / fun_story_act), and all six read-only queries are available. Off: chat keeps only fun_story_candidates / fun_story_detail for "what stories are there", and the other story tools are not offered, saving their schema on every turn. The panel always works.\n\nA World cannot see which channel called it, so this is one switch for all text channels — it cannot be QQ-only.',
    funStoryAuthorInChat: 'Manage stories from chat',
    funStoryAuthorInChatDesc: 'Off by default. On: chat gains the author tool fun_story (template, validate, preview, import/export, enable/disable/remove). Off: it is not offered, saving about 1.1k characters of fixed schema on every turn. The Story Workshop panel does not use this tool and keeps working either way.',
    funStoryFree: 'Free mode (scene packs)',
    funStoryFreeDesc: 'On by default. Version 3 scene packs become playable. The author writes only the premise, canon, cast and ending conditions; the host DM improvises. The DM may change only registered state, and endings are decided by the program. Option-based stories are untouched; both modes can coexist.',
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
    funStoryImagesDesc: 'Choose off, delegation, or direct local ComfyUI in Advanced settings. The loopback URL and workflow appear only in direct mode. Delegation may use Fish Image Studio through the main conversation; this World never calls another World’s tools. Direct mode keeps its 30-second timeout and 8 MiB/format checks.',
    funStoryAutoImages: 'Prepare image parameters automatically',
    funStoryAutoImagesDesc: 'On by default. While the master switch is on and a trip is in progress, every new spot (or story page) prepares that scene’s scene/outfits/prompt for her automatically; the offer expires after 45 minutes and is never nagged. The same switch sits at the top of the Outing panel and is disabled without a trip or with the master off. Delegation sources only — a direct local ComfyUI call costs compute and still needs the button in Outing → Settings → Advanced.',
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
  const advanced = (key) => `${t.advancedPrefix}${t[key]}`;
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
        },
        [`${K}.funAutoOuting`]: {
          type: 'boolean', title: t.funAutoOuting, description: t.funAutoOutingDesc,
        },
        [`${K}.funShareAfter`]: {
          type: 'boolean', title: t.funShareAfter, description: t.funShareAfterDesc,
        },
        [`${K}.funSessionTTLMin`]: {
          type: 'integer', title: advanced('funSessionTTLMin'), description: t.funSessionTTLMinDesc,
          minimum: 15, maximum: 480, 'x-suffix': ' 分钟',
        },
        [`${K}.funTasteFromFeast`]: {
          type: 'boolean', title: advanced('funTasteFromFeast'), description: t.funTasteFromFeastDesc,
        },
        [`${K}.funStoryNodeLimit`]: {
          type: 'integer', title: advanced('funStoryNodeLimit'), description: t.funStoryNodeLimitDesc,
          minimum: 0, maximum: Number.MAX_SAFE_INTEGER, 'x-suffix': ' 个节点',
        },
        [`${K}.funStoryDM`]: {
          type: 'boolean', title: advanced('funStoryDM'), description: t.funStoryDMDesc,
        },
        [`${K}.funStoryDmUrl`]: {
          type: 'string', title: advanced('funStoryDmUrl'), description: t.funStoryDmUrlDesc,
        },
        [`${K}.funStoryDmModel`]: {
          type: 'string', title: advanced('funStoryDmModel'), description: t.funStoryDmModelDesc,
        },
        [`${K}.funStoryImages`]: {
          type: 'boolean', title: advanced('funStoryImages'), description: t.funStoryImagesDesc,
        },
        [`${K}.funStoryAutoImages`]: {
          type: 'boolean', title: advanced('funStoryAutoImages'), description: t.funStoryAutoImagesDesc,
        },
        [`${K}.funStoryImageSource`]: {
          type: 'string', title: advanced('funStoryImageSource'), description: t.funStoryImageSourceDesc,
        },
        [`${K}.funStoryTextOn`]: {
          type: 'boolean', title: advanced('funStoryTextOn'), description: t.funStoryTextOnDesc,
          'x-hot': false,
        },
        [`${K}.funStoryAuthorInChat`]: {
          type: 'boolean', title: advanced('funStoryAuthorInChat'), description: t.funStoryAuthorInChatDesc,
          'x-hot': false,
        },
        [`${K}.funStoryFree`]: {
          type: 'boolean', title: advanced('funStoryFree'), description: t.funStoryFreeDesc,
        },
        [`${K}.funStoryFreeTurns`]: {
          type: 'integer', title: advanced('funStoryFreeTurns'), description: t.funStoryFreeTurnsDesc,
          minimum: 5, maximum: 200, 'x-suffix': ' 回合',
        },
        [`${K}.funAutoSteps`]: {
          type: 'integer', title: advanced('funAutoSteps'), description: t.funAutoStepsDesc,
          minimum: 1, maximum: 200, 'x-suffix': ' 步',
        },
        [`${K}.funAutoCalls`]: {
          type: 'integer', title: advanced('funAutoCalls'), description: t.funAutoCallsDesc,
          minimum: 1, maximum: 120, 'x-suffix': ' 次',
        },
      },
    },
  };
}
