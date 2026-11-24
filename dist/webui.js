// webui/ui-text.js
var ZH = {
  storyWrite: "编写故事",
  storyEditorExpand: "展开",
  storyEditorCollapse: "收起",
  storyEditorDirty: "有未保存修改",
  storyEmptyTitle: "还没有故事",
  storyEmptyBody: "点「编写故事」写第一篇。可使用作者表单或完整 JSON，保留 v1/v2 校验、隔离试玩与只读预览。",
  storyEdit: "编辑",
  storyEditing: "正在编辑",
  storyEditLoading: "正在读取编辑草稿…",
  storyEditLoaded: "完整故事已载入高级 JSON 编辑器；所有节点和扩展字段均保留。",
  storyEditRetained: "已恢复未保存的编辑草稿。",
  storyEditChanged: "读取期间草稿已修改；保留当前内容，请再次点击编辑。",
  storyNewJson: "新建 JSON 草稿",
  storyNewJsonReady: "已切回新建 JSON 草稿；其他故事的编辑草稿仍保留在本面板中。",
  storyDraftHint: "新建表单与完整 JSON 草稿分别保留在当前面板中；收起、刷新列表、预览或失败不会清空。关闭面板前请保存或复制草稿。",
  storyEditorTitle: "编写故事",
  storySimpleForm: "新建故事表单",
  storyJsonEditor: "高级编辑 · 查看或粘贴完整 JSON",
  storySaved: "已保存故事包",
  storyGroupWork: "作品信息",
  storyGroupStart: "故事起点",
  storyGroupBranches: "分支选项",
  storyGroupTiming: "触发时段（可选）",
  storyGroupProgress: (done, total) => `${done}/${total} 已填写`,
  storyGroupOptional: "可选设置",
  settingsTab: "设置",
  settingsTitle: "高级设置",
  settingsIntro: "这里只放这一台机器的凭据与专家选项。自动配图开关在出游页顶部；故事长度、主持地址与模型、图片来源在配置页；本地插画在地点册。",
  settingsPartElsewhere: "其他设置在哪里",
  settingsElsewhereTitle: "故事长度、主持与图片来源",
  settingsWhereLength: "故事长度、主持接口地址与模型名、剧情图片来源：「配置 → 从0开始的肥鱼大冒险」。",
  settingsWhereArtwork: "本地插画：「地点册 → 本地插画」；换浏览器或清缓存会没有，重新导入即可。",
  settingsElsewhereNote: "文本主持、文字通道、自由模式这些开关也在同一个配置页；地点、住所与画风：「地点册」；场所与故事分支：「故事工坊」。",
  settingsKeyTitle: "文本主持密钥",
  settingsKeySummary: "只保存 API Key；接口地址与模型名在配置页。",
  settingsKeyHint: "接口地址与模型名在「配置 → 从0开始的肥鱼大冒险」；这里只保存 API Key，只存本机 DPAPI 密文，不写进配置。",
  settingsImageManualTitle: "直连出图",
  settingsImageManualSummary: "只在图片来源是本机 ComfyUI 时出现。",
  settingsImageManualHint: "手动生成当前场景的一张图。委派来源不需要这一块：自动准备配图就够了。",
  storyImageManual: "生成当前场景图片",
  settingsAutoImage: "自动配图",
  settingsAutoImageHint: "出游中、且总闸开着，才会自动准备委派参数。",
  settingsAutoImageMasterOff: "剧情图片总闸关着：先在配置里打开「剧情图片生成」。",
  settingsAutoImageNoTrip: "有进行中的行程时才能自动准备配图。",
  settingsAutoImageOn: "自动配图已打开：每到新的一处会准备参数。",
  settingsAutoImageOff: "自动配图已关闭。",
  settingsAutoImageFailed: "没保存成功，已恢复原来的设置。",
  storyDmHelpSummary: "查看密钥保存说明",
  storyImageHelpSummary: "查看直连与失败处理",
  storyImageOff: "已关闭",
  storyImageOn: "已开启",
  storyDmApiKey: "API Key",
  storyDmApiSaved: "已保存",
  storyDmApiUnset: "未设置",
  storyDmApiPending: "已输入，尚未保存",
  storyDmApiClear: "清除密钥",
  storyDmApiHint: "使用 OpenAI 兼容 POST /chat/completions。密钥只在本机用 Windows DPAPI CurrentUser 加密保存，不交给宿主或其他插件，也不写进普通配置。接口地址与模型名在配置页；地址留空时不会发起直连请求。换机器或重装需重填，随时可以清除。主持超时或失败不影响手动游玩，仍受每趟 6 次、每步 2 次额度限制。",
  storyDmApiUnsupported: "此机器不支持私密密钥存储；当前仅 Windows 支持本机 DPAPI 加密。仍可使用宿主模型，地址与模型照旧在配置页。",
  storyImageTitle: "剧情图片生成",
  storyImageWorkflowTitle: "自定义工作流（可选）",
  storyImageWorkflowLabel: "工作流 JSON（留空用内置）",
  storyImageWorkflowPlaceholder: '{\n  "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "your.safetensors" } },\n  "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "{{prompt}}", "clip": ["1", 0] } }\n}',
  storyImageWorkflowSummary: "贴 ComfyUI 的 API 格式 JSON，用 {{prompt}} 标出提示词；只对直连本机 ComfyUI 生效。",
  storyImageWorkflowHint: "怎么导出：在 ComfyUI 里搭好工作流 → 菜单「Save (API Format)」→ 把整段 JSON 贴进来。把你的正向提示词那段文字换成 {{prompt}}（必填），想固定种子就写 {{seed}}（不写则每次自动随机，免得 ComfyUI 缓存出同一张图）。模型、尺寸、步数全由你的工作流决定，本插件不再用内置的 512×512；最多 32 KB、200 个节点。",
  storyImageWorkflowInvalid: "工作流 JSON 解析失败：请确认是从 ComfyUI 用「Save (API Format)」导出的。",
  storyImageWorkflowNoPrompt: "工作流里必须有一个 {{prompt}} 占位符，用来放这一段的正向提示词。",
  storyImageWorkflowOn: "自定义工作流",
  storyImageWorkflowOff: "内置工作流",
  storyImagePending: "正在生成当前场景图片…",
  storyImageDelegated: "已把委派参数递给她（45 分钟内有效）；画不画由她定，也可以按上面的 JSON 交给指定插件。",
  storyImageDirect: "图片已保存在本插件本地数据目录。",
  storyImageNoPlugin: "尚未确认安装「鱼的生图包」；请安装启用，或复制委派参数交给主对话。",
  storyImageUnavailable: "当前无法生成图片；文字故事照常继续。",
  storyImageFailed: "图片请求失败；文字故事照常继续，请检查来源后重试。",
  storyImageParams: "可复制的委派参数",
  storyImageAlt: "当前剧情生成的本地图片",
  settingsSave: "保存设置",
  settingsCancel: "取消输入",
  settingsReload: "读取设置",
  settingsLoading: "正在读取设置…",
  settingsSaving: "正在保存设置…",
  settingsSaved: "设置已保存；私密输入已清空。",
  settingsCancelled: "已清除界面输入；没有发送保存或清除请求。",
  settingsCleared: "密钥已立即清除，接口将回到宿主模型。",
  settingsFailure: "设置请求失败；已保留当前输入，请重试。",
  settingsClearing: "正在清除密钥…",
  settingsLoadFailure: "读取设置失败；当前输入已保留，可重试读取。",
  settingsClearFailure: "清除未获确认；请重试或读取设置核对。",
  settingsDraft: "有未保存的设置输入",
  settingsPartialDm: "密钥已保存，但自定义工作流没保存；请重试工作流，密钥不用重填。",
  storyCatalogTitle: "地点与故事",
  storyCatalogIntro: "选择自己写的故事出发，也可以先写下一个新的开头。",
  storyAuthorHint: "地点册管理住所、画风与封面；去哪儿管理可玩区域；这里的「编写故事」管理自己的故事包。",
  storyEnabled: "已启用故事",
  storyCustom: "自定义故事",
  storyStart: "现在出发",
  storyContinue: "先继续当前行程",
  storyProgress: "进度由从0开始的肥鱼大冒险保存",
  storyBlocked: "暂时无法出发"
};
var EN = {
  storyWrite: "Write a story",
  storyEditorExpand: "Expand",
  storyEditorCollapse: "Collapse",
  storyEditorDirty: "Unsaved changes",
  storyEmptyTitle: "No stories yet",
  storyEmptyBody: "Choose “Write a story” to create your first one. Use the author form or complete JSON, with v1/v2 validation, isolated playtesting and read-only previews.",
  storyEdit: "Edit",
  storyEditing: "Editing",
  storyEditLoading: "Loading an editing draft…",
  storyEditLoaded: "The complete story is in the advanced JSON editor; every node and extension field is preserved.",
  storyEditRetained: "Restored your unsaved editing draft.",
  storyEditChanged: "The draft changed while loading. Your current text is preserved; choose Edit again.",
  storyNewJson: "New JSON draft",
  storyNewJsonReady: "Returned to the new JSON draft. Other editing drafts remain in this panel.",
  storyDraftHint: "The author form and complete JSON drafts are kept separately in this panel. Collapsing, refreshing the list, previewing and failures do not clear them. Save or copy drafts before closing the panel.",
  storyEditorTitle: "Write a story",
  storySimpleForm: "New story form",
  storyJsonEditor: "Advanced · View or paste complete JSON",
  storySaved: "Story pack saved",
  storyGroupWork: "Work details",
  storyGroupStart: "Story opening",
  storyGroupBranches: "Branches",
  storyGroupTiming: "Trigger window (optional)",
  storyGroupProgress: (done, total) => `${done}/${total} filled`,
  storyGroupOptional: "Optional settings",
  settingsTab: "Settings",
  settingsTitle: "Advanced settings",
  settingsIntro: "Only this machine’s credentials and expert options live here. The auto-image switch is at the top of the Outing panel; story length, DM endpoint/model and image source are in configuration; local artwork is in the Place Book.",
  settingsPartElsewhere: "Where the other settings live",
  settingsElsewhereTitle: "Story length, DM and image source",
  settingsWhereLength: "Story length, DM endpoint and model, story image source: Configuration → Adventures of Fat Fish from Scratch.",
  settingsWhereArtwork: "Local artwork: Place Book → Local artwork. It lives in this browser, so clearing site data removes it — import again.",
  settingsElsewhereNote: "DM, text channel and free-mode switches are on the same configuration page; places, home and style: Place Book; venues and story branches: Story Workshop.",
  settingsKeyTitle: "Text DM key",
  settingsKeySummary: "Only the API key is stored here; endpoint and model are in configuration.",
  settingsKeyHint: "The endpoint and model name are in Configuration → Adventures of Fat Fish from Scratch. This field stores only the API key, encrypted with local DPAPI; it never enters configuration.",
  settingsImageManualTitle: "Direct image generation",
  settingsImageManualSummary: "Only shown when the image source is local ComfyUI.",
  settingsImageManualHint: "Generate one image for the current scene by hand. Delegation sources do not need this — automatic preparation is enough.",
  storyImageManual: "Generate current scene image",
  settingsAutoImage: "Auto images",
  settingsAutoImageHint: "Parameters are prepared automatically only during a trip and with the master switch on.",
  settingsAutoImageMasterOff: "The story-image master switch is off: turn on “Story image generation” in configuration first.",
  settingsAutoImageNoTrip: "Automatic preparation needs a trip in progress.",
  settingsAutoImageOn: "Auto images on: parameters are prepared at each new spot.",
  settingsAutoImageOff: "Auto images off.",
  settingsAutoImageFailed: "Could not save; the previous setting was restored.",
  storyDmHelpSummary: "Show key storage details",
  storyImageHelpSummary: "Show direct-generation and failure details",
  storyImageOff: "Off",
  storyImageOn: "On",
  storyDmApiKey: "API key",
  storyDmApiSaved: "Saved",
  storyDmApiUnset: "Not set",
  storyDmApiPending: "Entered, not saved",
  storyDmApiClear: "Clear key",
  storyDmApiHint: "Uses OpenAI-compatible POST /chat/completions. The key is encrypted on this machine with Windows DPAPI CurrentUser, never sent to the host or other plugins, and never written into ordinary configuration. Endpoint and model name live in configuration; a blank endpoint means no direct request. Re-enter after moving machines or reinstalling, and clear it at any time. DM timeouts and failures leave manual play available, with the same limit of 6 calls per trip and 2 per step.",
  storyDmApiUnsupported: "Private key storage is unavailable on this machine; local DPAPI encryption currently requires Windows. The host model still works, and the endpoint and model stay in configuration.",
  storyImageTitle: "Story image generation",
  storyImageWorkflowTitle: "Custom workflow (optional)",
  storyImageWorkflowLabel: "Workflow JSON (blank uses the built-in one)",
  storyImageWorkflowPlaceholder: '{\n  "1": { "class_type": "CheckpointLoaderSimple", "inputs": { "ckpt_name": "your.safetensors" } },\n  "2": { "class_type": "CLIPTextEncode", "inputs": { "text": "{{prompt}}", "clip": ["1", 0] } }\n}',
  storyImageWorkflowSummary: "Paste a ComfyUI API-format JSON and mark the prompt with {{prompt}}. Only used for local ComfyUI.",
  storyImageWorkflowHint: 'In ComfyUI build the graph, then use "Save (API Format)" and paste the whole JSON. Replace your positive prompt text with {{prompt}} (required); add {{seed}} if you want a fixed seed (otherwise every run gets a random one so ComfyUI does not cache the same image). Model, size and steps come from your workflow — the built-in 512×512 is not used. At most 32 KB and 200 nodes.',
  storyImageWorkflowInvalid: `Workflow JSON could not be parsed. Make sure it was exported with ComfyUI's "Save (API Format)".`,
  storyImageWorkflowNoPrompt: "The workflow must contain a {{prompt}} placeholder for the positive prompt.",
  storyImageWorkflowOn: "Custom workflow",
  storyImageWorkflowOff: "Built-in workflow",
  storyImagePending: "Generating the current scene image…",
  storyImageDelegated: "Drawing parameters are handed to her (valid for 45 minutes); whether to draw is up to her, or run the JSON above with a chosen plugin.",
  storyImageDirect: "The image was saved in this plugin’s local data directory.",
  storyImageNoPlugin: "Fish Image Pack installation is unverified. Install and enable it, or copy the delegation parameters to the main conversation.",
  storyImageUnavailable: "Image generation is unavailable. The text story can continue.",
  storyImageFailed: "Image request failed. The text story can continue; check the source and retry.",
  storyImageParams: "Copyable delegation parameters",
  storyImageAlt: "Locally generated image for the current story",
  settingsSave: "Save settings",
  settingsCancel: "Cancel input",
  settingsReload: "Read settings",
  settingsLoading: "Reading settings…",
  settingsSaving: "Saving settings…",
  settingsSaved: "Settings saved; private inputs cleared.",
  settingsCancelled: "Interface inputs cleared. No save or clear request was sent.",
  settingsCleared: "The key was cleared immediately. The endpoint will use the host model.",
  settingsFailure: "Settings request failed. Your input is preserved; retry when ready.",
  settingsClearing: "Clearing key…",
  settingsLoadFailure: "Could not read settings. Your input is preserved; retry reading.",
  settingsClearFailure: "Key removal was not confirmed. Retry or read settings to check.",
  settingsDraft: "Unsaved settings input",
  settingsPartialDm: "The key was saved, but the custom workflow was not. Retry the workflow; the key need not be re-entered.",
  storyCatalogTitle: "Places and stories",
  storyCatalogIntro: "Set out in a story you wrote, or write a new beginning first.",
  storyAuthorHint: "The location book manages homes, art styles and covers; Places manages playable areas. “Write a story” here manages your own story packs.",
  storyEnabled: "Enabled story",
  storyCustom: "Custom story",
  storyStart: "Set out now",
  storyContinue: "Continue the current trip first",
  storyProgress: "Fun saves your progress",
  storyBlocked: "Cannot set out yet"
};
function storyText(language) {
  return /^en(?:[-_]|$)/i.test(language ?? "") ? EN : ZH;
}

// webui/artwork.js
var line = (d, extra = "") => `<path d="${d}" ${extra}/>`;
var rect = (x, y, w, h, r = 3, extra = "") => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ${extra}/>`;
var circle = (x, y, r, extra = "") => `<circle cx="${x}" cy="${y}" r="${r}" ${extra}/>`;
var warm = 'fill="var(--f-art-warm,#e9b97e)"';
var mint = 'fill="var(--f-art-mint,#99c7b9)"';
var blue = 'fill="var(--f-art-blue,#9abfd0)"';
var pink = 'fill="var(--f-art-pink,#d9abc1)"';
var paper = 'fill="var(--f-card,#fbfbfb)"';
var scenes = {
  amusement: circle(139, 48, 34, blue) + line("M139 14V82M105 48H173M115 24L163 72M115 72L163 24M139 48L113 108H165Z") + [[139, 14], [173, 48], [139, 82], [105, 48]].map(([x, y]) => rect(x - 6, y - 4, 12, 10, 3, warm)).join("") + line("M202 104V64H267V104M196 64L235 38L274 64Z", warm) + rect(220, 77, 25, 27, 5, pink) + line("M39 91V45M39 45L69 53L39 63Z", mint),
  aquarium: line("M68 108V57C68 8 249 8 249 57V108", blue) + line("M88 108V58C88 31 229 31 229 58V108", paper) + line("M132 56C154 39 180 41 192 52L210 45V67L192 60C170 73 144 68 132 56Z", mint) + circle(181, 52, 1.5, 'fill="currentColor"') + line("M105 108L108 87L117 100L121 78L128 108M208 108L215 82L219 99L228 89L231 108") + circle(111, 57, 3) + circle(118, 43, 2),
  templefair: line("M67 108V38M91 108V38M225 108V38M249 108V38M52 31Q157 47 264 31L260 44H56ZM58 56H258", warm) + line("M102 80H215M109 80V107M207 80V107M99 79L158 54L218 79Z", mint) + [111, 157, 203].map((x) => circle(x, 60, 9, pink) + line(`M${x} 47V51M${x} 69V74`)).join(""),
  con: rect(77, 35, 164, 72, 5, paper) + rect(91, 48, 63, 47, 3, pink) + line("M107 83L116 65L124 76L137 57L146 83Z") + rect(169, 49, 56, 13, 2, warm) + line("M169 73H225M169 83H209M91 107V114M227 107V114") + line("M47 57L53 43L59 57L73 63L59 69L53 83L47 69L33 63Z", blue),
  cinema: rect(75, 23, 174, 79, 5, blue) + rect(89, 35, 146, 53, 2, paper) + line("M149 46L149 76L175 61Z", warm) + [98, 131, 164, 197, 230].map((x) => rect(x - 9, 96, 21, 16, 4, pink)).join("") + line("M42 96L38 68H62L58 96Z", warm) + line("M40 68Q39 54 48 59Q58 48 62 62"),
  zoo: rect(73, 36, 177, 71, 10, mint) + line("M82 42L100 22H224L243 42", warm) + line("M117 107V72Q117 46 142 46Q167 46 167 72V107", paper) + circle(137, 62, 3) + circle(153, 62, 3) + line("M140 78Q146 84 152 78M201 107V67M195 67Q177 42 193 43Q200 24 207 43Q226 38 219 57Z", blue) + circle(53, 61, 18, mint) + line("M53 79V107"),
  park: line("M119 114Q125 89 154 78Q176 67 178 49", warm) + circle(76, 54, 27, mint) + circle(236, 49, 33, mint) + line("M76 65V109M236 62V109") + rect(104, 75, 63, 10, 3, paper) + line("M110 86V102M160 86V102M105 67H166M113 67V76M157 67V76") + circle(157, 25, 13, warm),
  arcade: rect(105, 25, 85, 82, 7, pink) + rect(116, 35, 63, 39, 3, blue) + line("M129 58L139 45L150 60L159 49L169 65") + line("M105 81L94 94H199L190 81Z", warm) + circle(126, 88, 3) + circle(168, 88, 3) + line("M122 85V78") + rect(128, 98, 37, 4, 1, paper) + line("M224 45L235 34M233 62H251M215 32V19"),
  ktv: rect(62, 29, 126, 69, 6, blue) + line("M78 47H161M78 62H134M78 77H151") + line("M220 53L190 95Q187 103 195 106Q201 108 205 103L234 64", warm) + circle(231, 48, 17, pink) + line("M220 35L242 60M214 43L235 65M206 106Q236 121 255 99M272 31V61Q258 55 257 65Q260 77 273 69V40L290 35V55"),
  museum: line("M64 47L159 15L253 47Z", warm) + rect(65, 47, 188, 10, 1, paper) + [86, 125, 164, 203].map((x) => rect(x, 57, 16, 43, 2, blue)).join("") + rect(61, 101, 195, 10, 1, paper) + circle(159, 36, 8, mint) + line("M41 110H278"),
  catcafe: rect(66, 30, 123, 71, 5, warm) + line("M76 43H178M128 43V101M76 77H178") + line("M201 97C177 89 185 72 199 73L198 58L211 67L225 59L228 78C242 102 217 110 201 97Z", pink) + circle(207, 81, 1.5, 'fill="currentColor"') + circle(220, 81, 1.5, 'fill="currentColor"') + line("M206 91Q215 96 221 88M237 98Q263 100 253 83") + rect(89, 87, 18, 15, 3, paper) + line("M107 90Q119 90 112 98"),
  hiking: line("M45 108L128 21L197 108Z", mint) + line("M127 21L104 47L128 43L145 47Z", paper) + line("M143 108L219 42L278 108Z", blue) + line("M150 108L145 94L164 79L164 70M219 42L205 56H232", paper) + circle(241, 24, 12, warm) + line("M83 109V85M75 93L83 79L91 93ZM248 109V86M239 96L248 78L257 96Z"),
  cafe: rect(77, 30, 159, 77, 4, warm) + line("M69 48H243L232 25H81Z", pink) + rect(89, 61, 61, 46, 3, blue) + rect(167, 61, 55, 34, 3, paper) + line("M177 73H204V85H177ZM204 75Q216 74 211 82M183 64Q178 59 184 55M195 64Q190 59 196 55M119 62V106M89 82H150"),
  milktea: rect(77, 29, 164, 78, 5, pink) + rect(88, 38, 141, 15, 2, paper) + line("M107 64L113 105H145L151 64Z", warm) + line("M102 64H156M127 64L135 40", paper) + [119, 129, 139].map((x) => circle(x, 94, 2.5, 'fill="currentColor"')).join("") + rect(174, 67, 40, 40, 3, blue) + line("M179 80H209M179 89H201"),
  diner: rect(67, 29, 183, 78, 6, warm) + rect(80, 40, 69, 48, 3, blue) + line("M114 41V87M80 64H149") + line("M171 80H225M177 81V105M220 81V105") + line("M184 69H216Q217 56 201 56Q184 56 184 69ZM201 56V51", paper) + line("M183 36V47M196 32V43M209 36V47") + rect(88, 95, 51, 11, 3, pink),
  library: rect(71, 29, 177, 78, 4, warm) + line("M87 35V99M155 35V99M231 35V99M87 65H231M87 99H231") + [95, 110, 126, 164, 179, 211].map((x, i) => rect(x, i % 2 ? 45 : 41, 10, i % 2 ? 19 : 23, 1, i % 2 ? mint : blue)).join("") + line("M106 83Q133 75 159 85Q183 75 208 83V111Q183 102 159 111Q134 102 106 111ZM159 85V111", paper),
  market: line("M51 31Q156 58 269 30") + [75, 116, 158, 200, 242].map((x) => circle(x, x === 158 ? 52 : 45, 7, warm)).join("") + line("M60 104V77H130V104M49 77L67 59H123L141 77Z", pink) + line("M180 104V77H250V104M169 77L187 59H243L261 77Z", blue) + line("M73 90H118M192 89H237M81 104V92M225 104V90") + rect(142, 93, 22, 14, 2, mint),
  bathhouse: rect(69, 33, 181, 74, 5, warm) + line("M60 34L89 18H229L258 34Z", blue) + rect(89, 53, 142, 54, 2, paper) + line("M89 54H231V76Q211 66 195 76Q177 67 160 77Q141 67 124 76Q105 66 89 76ZM160 54V107", mint) + line("M112 44Q102 34 112 25M156 45Q145 34 156 25M200 44Q189 34 200 25"),
  thrift: rect(67, 29, 179, 78, 4, mint) + line("M60 48H253L241 26H73Z", warm) + rect(84, 64, 56, 43, 3, paper) + circle(112, 81, 12, blue) + line("M112 72V81L119 84") + line("M163 80L180 65L197 80M180 65V59Q180 53 187 55M163 80H197", pink) + rect(205, 86, 26, 21, 2, pink) + line("M210 86V79H226V86M90 103L102 96H129"),
  riverside: line("M36 90Q93 80 151 90T284 90M36 103Q93 93 151 103T284 103M52 115Q99 107 145 115M187 115Q224 107 269 115", blue) + line("M62 82V57M88 82V57M114 82V57M140 82V57M57 63H147M57 75H147") + line("M165 60Q202 8 262 60M173 60V78M253 60V78M170 60H259", warm) + circle(103, 26, 13, pink) + line("M218 105L230 96H253L247 105Z", mint),
  // Built-in story destinations: a folded-paper harbour and a rainy corner lane.
  "user-ezfvd": line("M46 108Q150 88 274 108M52 108V62H268V108M52 62L160 22L268 62", blue) + line("M160 22V60M160 60Q130 60 128 82Q127 105 160 105Q193 105 192 82Q190 60 160 60", paper) + circle(160, 44, 7, warm) + line("M214 108V74H248V108M208 74L231 58L254 74M221 88H241", mint) + circle(96, 34, 5, warm),
  "user-f3u9p": line("M52 108V54H150V108M150 108V70H246V108M44 54L101 26L158 54M142 70L198 48L252 70", blue) + line("M78 54Q104 74 130 54M64 108V88H92V108M176 108V84H206V108", paper) + line("M156 30V52M152 52H160", warm) + circle(226, 32, 6, mint) + line("M60 116Q100 110 140 116M170 116Q212 110 254 116", mint)
};
function venueArtwork(id) {
  const drawing = scenes[id] ?? line("M83 107V51L160 20L237 51V107Z", mint) + rect(108, 64, 32, 43, 3, paper) + rect(169, 62, 42, 27, 3, blue);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 128" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M28 112H292" opacity=".2"/><g>${drawing}</g></svg>`;
}
var symbols = {
  ticket: line("M4 6H20V10Q16 12 20 14V18H4V14Q8 12 4 10ZM14 7V9M14 11V13M14 15V17"),
  keychain: circle(9, 7, 4) + line("M9 11V15M7 15H15L18 21H5Z"),
  bookmark: line("M7 3H17V21L12 17L7 21ZM10 7H14M10 10H14"),
  postcard: rect(3, 5, 18, 14, 2) + line("M14 8V16M17 9H19M6 14L9 10L12 14ZM6 16H12"),
  sticker: line("M4 4H20V15L15 20H4ZM15 20V15H20") + circle(9, 9, 1) + circle(15, 9, 1) + line("M8 12Q12 16 16 12"),
  coin: circle(12, 12, 9) + circle(12, 12, 6) + line("M12 7L14 10L17 12L14 14L12 17L10 14L7 12L10 10Z"),
  cup: line("M5 8H16V17Q10 22 5 17ZM16 10H20V15H16M8 3V5M12 3V5"),
  light: line("M8 15Q1 7 8 4Q16 0 19 8Q20 12 16 15V19H8ZM9 22H15M9 16H15"),
  plush: circle(6, 6, 3) + circle(18, 6, 3) + circle(12, 10, 7) + line("M7 16Q4 23 12 22Q20 23 17 16") + circle(9, 9, 1) + circle(15, 9, 1) + line("M11 12H13"),
  charm: line("M12 3V6M7 6H17L20 12L17 21H7L4 12ZM9 10H15M9 14H15M10 18H14"),
  generic: rect(4, 8, 16, 13, 2) + rect(3, 5, 18, 4, 1) + line("M12 5V21M12 5Q4 4 7 1Q10 0 12 5Q14 0 17 1Q20 4 12 5")
};
function souvenirCategory(name) {
  const value = String(name ?? "");
  return /票|券|入场/.test(value) ? "ticket" : /钥匙|挂件|挂饰|吊坠/.test(value) ? "keychain" : /书签/.test(value) ? "bookmark" : /明信片|卡片|画片|海报/.test(value) ? "postcard" : /贴纸|贴画|徽章/.test(value) ? "sticker" : /币|章/.test(value) ? "coin" : /杯|茶|咖啡/.test(value) ? "cup" : /灯/.test(value) ? "light" : /玩偶|公仔|小熊|毛绒/.test(value) ? "plush" : /御守|护符|签/.test(value) ? "charm" : "generic";
}
function souvenirArtwork(name) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${symbols[souvenirCategory(name)]}</svg>`;
}

// webui/dom.js
function el(tag, props, ...kids) {
  const node2 = document.createElement(tag);
  if (props) {
    for (const [key, value] of Object.entries(props)) {
      if (value === null || value === void 0 || value === false) continue;
      if (key === "class") node2.className = value;
      else if (key === "text") node2.textContent = value;
      else if (key === "html") node2.innerHTML = value;
      else if (key.startsWith("on") && typeof value === "function") node2.addEventListener(key.slice(2), value);
      else if (key === "style" && typeof value === "object") Object.assign(node2.style, value);
      else if (key === "style") node2.setAttribute("style", String(value));
      else if (key === "hidden") node2.hidden = Boolean(value);
      else node2.setAttribute(key, value);
    }
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid === null || kid === void 0 || kid === false) continue;
    node2.appendChild(typeof kid === "string" || typeof kid === "number" ? document.createTextNode(String(kid)) : kid);
  }
  return node2;
}
function elIn(doc, tag, attrs = {}, ...children) {
  const element = doc.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === null || value === void 0 || value === false) continue;
    if (name === "class") element.className = value;
    else if (name === "text") element.textContent = String(value);
    else if (name === "style") element.setAttribute("style", value);
    else if (name === "hidden") element.hidden = Boolean(value);
    else if (name.startsWith("on") && typeof value === "function") element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === void 0 || child === false) continue;
    element.append(typeof child === "object" ? child : String(child));
  }
  return element;
}
function errorCard(err, retry, retained = false) {
  return el(
    "div",
    { class: "fun-err", role: "alert" },
    el("span", { text: retained ? `刷新失败，保留上次内容：${err?.message ?? String(err)}` : `面板加载失败：${err?.message ?? String(err)}` }),
    retry ? el("button", { type: "button", onclick: () => {
      void retry();
    } }, "重试") : null
  );
}
function heading(title, subtitle) {
  return el(
    "header",
    { class: "fun-heading" },
    el("p", { class: "fun-kicker", text: `从0开始的肥鱼大冒险 · ${title}` }),
    el("h2", { text: title }),
    subtitle ? el("p", { class: "fun-heading-lead", text: subtitle }) : null
  );
}
function feedback(box) {
  const node2 = el("div", { class: "fun-feedback" });
  box.appendChild(node2);
  return node2;
}

// webui/stories.js
var CSS = `
.fun-stories{--fs-line:var(--border,#e3e4e3);--fs-ink:var(--foreground,#1b1a1e);--fs-dim:var(--muted-foreground,#5c5c60);--fs-card:var(--surface,#fbfbfb);--fs-soft:color-mix(in srgb,var(--fs-card) 93%,var(--fs-ink));--fs-accent:var(--accent,#00a870);--fs-error:var(--destructive,#b23b35);font:14px/1.65 var(--sans,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);color:var(--fs-ink);padding:8px 4px 24px;overflow-wrap:anywhere}
.fun-stories *{box-sizing:border-box}
.fun-stories h2,.fun-stories h3,.fun-stories h4,.fun-stories p{margin:0}
.fun-stories h2{font-size:20px}.fun-stories h3{font-size:15px}.fun-stories h4{font-size:14px}
.fun-story-heading{margin-bottom:14px;padding:4px 0 12px;border-bottom:1px solid var(--fs-line)}
.fun-story-note,.fun-story-field,.fun-story-feedback{color:var(--fs-dim);font-size:12px}
.fun-story-editor,.fun-story-pack{border:1px solid var(--fs-line);border-radius:12px;background:var(--fs-card);padding:12px;margin-bottom:9px}
.fun-story-editor{background:var(--fs-soft);margin-bottom:16px}
.fun-stories [hidden]{display:none!important}.fun-story-authoring{min-width:0}.fun-story-editor-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px}.fun-story-editor-head h3{margin-right:auto}.fun-story-editor-toggle{white-space:normal}.fun-story-dirty{color:var(--fs-error);font-size:12px}.fun-stories :is(input,select,textarea,fieldset,section,details){min-width:0;max-width:100%}.fun-story-author-content{margin-top:10px}.fun-story-advanced{margin:8px 0 14px}.fun-story-advanced>summary{cursor:pointer;font-weight:600}.fun-story-editor>summary{cursor:pointer;font-weight:600}
.fun-story-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(160px,100%),1fr));gap:6px 10px;margin:8px 0}
.fun-story-grid :is(input,select){display:block;width:100%;min-width:0;margin-top:3px}
.fun-story-branches{grid-template-columns:repeat(auto-fit,minmax(min(235px,100%),1fr))}
.fun-story-branch{margin:0;padding:6px 9px;min-width:0;border:1px solid var(--fs-line);border-radius:var(--radius-sm,6px)}
.fun-story-branch>.fun-story-field{margin:5px 0}
.fun-story-row{display:flex;align-items:center;gap:6px 8px;flex-wrap:wrap;margin:6px 0}
.fun-story-row>h3,.fun-story-row>h4{margin-right:auto}
.fun-story-field{display:block;font-weight:600}
.fun-story-row label{display:inline-flex;align-items:center;gap:5px}
.fun-stories button,.fun-stories select,.fun-stories textarea,.fun-story-grid input{font:inherit;color:inherit;background:var(--fs-card);border:1px solid var(--fs-line);border-radius:var(--radius-sm,6px);padding:4px 9px}
.fun-stories button,.fun-stories select{min-height:31px;max-width:100%}
.fun-stories button{cursor:pointer}
.fun-stories button:hover{border-color:var(--fs-accent)}
.fun-stories button[aria-disabled=true]{opacity:.55;cursor:default}
.fun-stories :is(button,select,textarea,input):focus-visible{outline:2px solid var(--fs-accent);outline-offset:2px}
.fun-stories .fun-story-primary{border-color:var(--fs-accent);background:var(--fs-accent);color:var(--accent-foreground,#fff);font-weight:600}
.fun-stories .fun-story-danger,.fun-story-errors{color:var(--fs-error)}
.fun-stories textarea{display:block;width:100%;margin:4px 0;resize:vertical;font:12px/1.55 ui-monospace,Consolas,monospace}
.fun-story-badge{font-size:11.5px;color:var(--fs-dim);border:1px solid var(--fs-line);border-radius:999px;padding:0 7px;background:var(--fs-soft)}
.fun-story-unavailable{border-style:dashed}
.fun-stories ul,.fun-stories ol{margin:3px 0;padding-inline-start:19px}
.fun-story-feedback>:empty,.fun-story-result:empty,.fun-story-confirm:empty{display:none}
.fun-story-confirm,.fun-story-result{margin-top:8px}
.fun-story-node{padding:5px 0;border-bottom:1px solid var(--fs-line)}
.fun-story-node:last-child{border-bottom:0}
.fun-story-node p{white-space:pre-wrap}
.fun-story-group{border:1px solid color-mix(in srgb,var(--fs-line) 86%,var(--fs-accent));border-radius:10px;background:color-mix(in srgb,var(--fs-card) 97%,var(--fs-accent));margin:10px 0;overflow:hidden}.fun-story-group>summary{list-style:none;cursor:pointer;display:flex;align-items:center;gap:8px;padding:10px 12px;font-weight:700}.fun-story-group>summary::-webkit-details-marker{display:none}.fun-story-group>summary:before{content:'›';display:grid;place-items:center;width:18px;height:18px;border:1px solid var(--fs-line);border-radius:5px;color:var(--fs-dim);transition:transform .15s}.fun-story-group[open]>summary:before{transform:rotate(90deg)}.fun-story-group>summary .fun-story-group-progress{margin-left:auto;color:var(--fs-dim);font-size:11px;font-weight:500}.fun-story-group-content{padding:0 12px 10px}.fun-story-group-content>.fun-story-grid{margin-top:0}.fun-story-sticky-actions{position:sticky;bottom:8px;z-index:3;padding:9px 10px;border:1px solid var(--fs-line);border-radius:10px;background:color-mix(in srgb,var(--fs-card) 92%,transparent);backdrop-filter:blur(10px);box-shadow:0 6px 18px color-mix(in srgb,var(--fs-ink) 12%,transparent);margin-top:12px}.fun-story-sticky-actions .fun-story-row{margin:0}.fun-story-sticky-actions .fun-story-field{margin-left:auto;color:var(--fs-dim);font-size:11px}.fun-story-branches{margin-top:0}.fun-story-editor-head{padding-bottom:4px}.fun-story-editor-toggle{min-width:72px}.fun-story-simple>details+details{margin-top:10px}
.fun-story-mode{display:flex;gap:6px;margin:4px 0 10px;flex-wrap:wrap;align-items:center}
.fun-story-mode button{border:1px solid var(--fs-line);border-radius:99px;background:var(--fs-card);color:inherit;padding:5px 12px;font:inherit;font-size:12px;cursor:pointer}
.fun-story-mode button[aria-pressed=true]{border-color:var(--fs-accent);background:color-mix(in srgb,var(--fs-accent) 12%,var(--fs-card));font-weight:700}
.fun-story-mode-note{margin:0 0 8px;color:var(--fs-dim);font-size:11.5px}
.fun-story-free-note{margin:6px 0 10px;color:var(--fs-dim);font-size:12px}
/* 折叠只负责收起/展开：小箭头 + 文字，不再像第三个创建入口 */
.fun-stories .fun-story-editor-toggle{display:inline-flex;align-items:center;gap:4px;min-width:0;min-height:0;padding:3px 8px;border:1px solid transparent;border-radius:7px;background:none;color:var(--fs-dim);font-size:11.5px}
.fun-stories .fun-story-editor-toggle::before{content:'▾';font-size:11px;line-height:1;display:inline-block;transition:transform .15s}
.fun-stories .fun-story-editor-toggle[aria-expanded=false]::before{transform:rotate(-90deg)}
.fun-stories .fun-story-editor-toggle:hover{border-color:var(--fs-line);color:var(--fs-accent);background:none}
/* 从文件导入：选文件是主路径，粘贴保留 */
.fun-story-file{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:8px 0 4px}
.fun-stories .fun-story-file-btn{min-height:0;padding:5px 14px;border:1px solid var(--fs-accent);border-radius:999px;background:var(--fs-card);color:var(--fs-accent);font-size:12.5px;font-weight:600}
.fun-story-file-btn:hover{background:color-mix(in srgb,var(--fs-accent) 8%,var(--fs-card))}
.fun-story-file-note{margin:0;font-size:11.5px;color:var(--fs-dim)}
.fun-story-file-note[data-state=ok]{color:var(--fs-accent)}
.fun-story-file-note[data-state=error]{color:var(--fs-error)}
/* 地点编号对不上时的就地改绑（导入失败与作品卡共用） */
.fun-story-bind{margin:8px 0;padding:8px 10px;border:1px dashed var(--fs-line);border-radius:10px;background:color-mix(in srgb,var(--fs-accent) 5%,var(--fs-card))}
.fun-story-bind>.fun-story-note{margin:0 0 4px}
.fun-story-bind .fun-story-row{margin:0}
.fun-story-bind .fun-story-bind-place{max-width:100%}
@media(max-width:520px){.fun-story-group-content{padding-inline:9px}.fun-story-sticky-actions{bottom:4px;padding:8px}.fun-story-sticky-actions .fun-story-row{align-items:stretch}.fun-story-sticky-actions .fun-story-row>button{flex:1}.fun-story-sticky-actions .fun-story-sticky-status{width:100%;margin:0;text-align:center}}
/* 作品库：一个创建入口 + 作品卡；去掉右栏，正文收窄到 1040 居中 */
.fun-story-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px 18px;flex-wrap:wrap;padding-bottom:14px;margin-bottom:18px;border-bottom:1px solid var(--fs-line)}
.fun-story-head h2{margin:3px 0 5px}
.fun-story-kicker{font-size:11px;letter-spacing:.14em;color:var(--fs-dim);text-transform:uppercase}
.fun-story-head-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fun-story-new{min-height:40px!important;padding:0 18px!important;border-radius:999px!important;white-space:nowrap}
.fun-stories{max-width:1040px;margin:0 auto}
.fun-story-layout{display:grid;gap:20px}
.fun-story-main{min-width:0}
@media(max-width:999px){.fun-stories{max-width:none}}
.fun-story-filters{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0 14px}
.fun-story-filters button{border-radius:999px;padding:5px 13px;background:transparent;min-height:32px;font-size:12.5px}
.fun-story-filters button[aria-pressed=true]{border-color:var(--fs-accent);background:color-mix(in srgb,var(--fs-accent) 12%,var(--fs-card));font-weight:700}
.fun-story-count{font-size:11.5px;color:var(--fs-dim);margin-left:auto}
.fun-story-pack{padding:0;overflow:hidden}
@media(min-width:720px){.fun-story-pack{display:grid;grid-template-columns:132px minmax(0,1fr);align-items:stretch}}
.fun-story-cover{display:flex;align-items:center;justify-content:center;min-height:96px;padding:12px;background:color-mix(in srgb,var(--fs-accent) 5%,var(--fs-card));border-right:1px solid var(--fs-line);color:color-mix(in srgb,var(--fs-ink) 66%,var(--fs-card));--f-card:color-mix(in srgb,var(--fs-card) 88%,var(--fs-ink) 12%)}
.fun-story-cover svg{display:block;width:100%;height:auto;max-height:118px}
.fun-story-body{min-width:0;padding:12px 14px}
.fun-story-body>p{margin-top:5px}
.fun-story-body>.fun-story-row:last-of-type{margin-bottom:0}
.fun-story-body .fun-story-result,.fun-story-body .fun-story-confirm,.fun-story-body .fun-story-feedback{margin-top:8px}
@media(max-width:719px){
  .fun-story-cover{border-right:0;border-bottom:1px solid var(--fs-line);min-height:0;padding:8px 14px}
  .fun-story-cover svg{max-height:74px}
}
.fun-story-required-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--fs-error);flex:none}.fun-story-required-dot[hidden]{display:none!important}.fun-story-group-progress{white-space:nowrap}.fun-story-group-content{padding-top:2px}.fun-story-group-content .fun-story-grid{gap:12px 14px;margin:10px 0}.fun-story-group-content .fun-story-field{display:flex;flex-direction:column;gap:5px;font-size:12px}.fun-story-group-content :is(input,select){height:36px;border-radius:8px;padding:6px 10px}.fun-story-group-content textarea{border-radius:8px;padding:8px 10px}.fun-story-sticky-actions .fun-story-sticky-status{margin-left:auto;color:var(--fs-dim);font-size:11px}.fun-story-sticky-actions .fun-story-sticky-status:empty{display:none}
@media(max-width:420px){.fun-stories{padding-inline:0}.fun-story-editor{padding:10px}.fun-story-body{padding:10px 11px}}
`;
function messageList(messages) {
  return messages?.length ? el("ul", {}, messages.map((message) => el("li", {}, String(message)))) : null;
}
function feedback2() {
  const status = el("div", { role: "status" });
  const alert = el("div", { class: "fun-story-errors", role: "alert" });
  return {
    node: el("div", { class: "fun-story-feedback" }, status, alert),
    set(text2 = "", result) {
      const warnings = messageList(result?.warnings);
      status.replaceChildren(...[text2 ? document.createTextNode(text2) : null, warnings].filter(Boolean));
      const errors = [...new Set([result?.error, ...result?.errors ?? []].filter(Boolean))];
      if (result?.ok === false && !errors.length) errors.push("操作失败，请重试。");
      alert.replaceChildren(...errors.length ? [messageList(errors)] : []);
    }
  };
}
function previewGraph(result) {
  const nodes = (result.nodes ?? []).map((node2) => {
    const when = node2.when && Object.keys(node2.when).length ? `条件：${typeof node2.when === "string" ? node2.when : JSON.stringify(node2.when)}` : "";
    const choices = (node2.choices ?? []).map((choice) => el("li", {}, `${choice.label || choice.id} → ${choice.next || "结束"}`));
    return el(
      "li",
      { class: "fun-story-node" },
      el("strong", {}, `${node2.id}${node2.area ? ` · ${node2.area}` : ""}`),
      node2.event ? el("p", {}, node2.event) : null,
      when ? el("p", { class: "fun-story-note" }, when) : null,
      node2.next ? el("p", { class: "fun-story-note" }, `下一节点 → ${node2.next}`) : null,
      choices.length ? el("ul", {}, choices) : null,
      !node2.next && !choices.length ? el("p", { class: "fun-story-note" }, "结束") : null
    );
  });
  return el(
    "section",
    { class: "fun-story-graph", "aria-label": "只读节点图" },
    el("h4", {}, result.title || "节点图"),
    el("p", { class: "fun-story-note" }, result.eligible ? "当前预览条件匹配" : "当前预览条件未匹配"),
    el("ol", {}, nodes)
  );
}
function label(text2, control) {
  return el("label", { class: "fun-story-field" }, text2, control);
}
function fillSelect(select, items, placeholder) {
  const selected = select.value;
  select.replaceChildren(
    el("option", { value: "" }, placeholder),
    ...items.map(({ value, label: label2 }) => el("option", { value }, label2)),
    ...selected && !items.some((item) => item.value === selected) ? [el("option", { value: selected }, selected)] : []
  );
  select.value = selected || "";
}
function simpleEditor(button2, save, onDirty = () => {
}, t = storyText()) {
  const select = (key) => el("select", { class: `fun-story-author-${key}`, "data-story-field": key });
  const input = (key, max, type = "text") => el("input", { class: `fun-story-author-${key}`, type, "data-story-field": key, ...max ? { maxlength: String(max) } : {} });
  const place = select("place");
  const area = select("area");
  const id = input("id", 24);
  id.value = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const title = input("title", 80);
  const author = input("author", 80);
  const release = input("release", 24);
  release.value = "1.0.0";
  const genre = input("genre", 40);
  genre.value = "日常";
  const synopsis = input("synopsis", 240);
  const participation = select("participation");
  fillSelect(participation, [{ value: "solo", label: "单人" }, { value: "duo", label: "双人" }], "选择参与方式");
  participation.value = "solo";
  const duration = input("duration", null, "number");
  duration.min = "1";
  duration.max = "600";
  const decisionActor = select("decision-actor");
  fillSelect(decisionActor, [{ value: "owner", label: "用户回合" }, { value: "fish", label: "鱼的回合" }, { value: "joint", label: "共同决定" }], "选择当前行动者");
  decisionActor.value = "owner";
  const jointResolution = select("joint-resolution");
  fillSelect(jointResolution, [{ value: "require-agreement", label: "必须一致；分歧保持待定" }, { value: "owner-final", label: "分歧时按用户明确选择" }, { value: "fish-final", label: "分歧时按鱼明确选择" }], "选择分歧规则");
  jointResolution.value = "require-agreement";
  const requirements = input("requirements", 480);
  const event = input("event", 120);
  const prompt = input("prompt", 160);
  const playtestBox = el("div", { class: "fun-story-playtest" });
  const from = input("from", null, "time");
  const to = input("to", null, "time");
  const branches = ["a", "b"].map((key, index) => {
    const choice = input(`${key}-label`, 160);
    const result = input(`${key}-result`, 160);
    const event2 = input(`${key}-event`, 120);
    const area2 = select(`${key}-area`);
    const node3 = el(
      "fieldset",
      { class: "fun-story-branch" },
      el("legend", { class: "fun-story-field" }, `选项 ${index + 1}`),
      label("选项文字", choice),
      label("选择结果", result),
      label("后续事件", event2),
      label("后续区域", area2)
    );
    return { key, choice, result, event: event2, area: area2, node: node3 };
  });
  let places = [];
  const report = feedback2();
  const updateAreas = () => {
    const areas = (places.find((item) => item.id === place.value)?.areas ?? []).map((name) => ({ value: name, label: name }));
    fillSelect(area, areas, "选择起始区域");
    for (const branch of branches) fillSelect(branch.area, areas, "同起始区域");
  };
  place.addEventListener("change", () => {
    area.value = "";
    for (const branch of branches) branch.area.value = "";
    updateAreas();
  });
  const buildPack = () => {
    const start = {
      id: "start",
      area: area.value,
      event: event.value.trim(),
      prompt: prompt.value.trim(),
      ...participation.value === "duo" ? { actor: decisionActor.value } : {},
      choices: branches.map((branch) => ({ id: branch.key, label: branch.choice.value.trim(), result: branch.result.value.trim(), next: `end-${branch.key}` }))
    };
    if (from.value) start.when = { from: from.value, to: to.value };
    const nodes = [start, ...branches.map((branch) => ({ id: `end-${branch.key}`, area: branch.area.value || area.value, event: branch.event.value.trim() }))];
    const metadata = {
      author: author.value.trim(),
      release: release.value.trim(),
      genre: genre.value.trim(),
      synopsis: synopsis.value.trim(),
      participation: participation.value,
      requirements: requirements.value.split(/[，,\n]/).map((item) => item.trim()).filter(Boolean),
      ...duration.value ? { durationMinutes: Number(duration.value) } : {},
      ...participation.value === "duo" ? { jointResolution: jointResolution.value } : {}
    };
    return { version: 2, id: id.value.trim(), title: title.value.trim(), description: synopsis.value.trim(), metadata, placeId: place.value, start: start.id, nodes };
  };
  const validateForm = () => {
    const fields = [
      place,
      area,
      id,
      title,
      author,
      release,
      genre,
      synopsis,
      participation,
      event,
      prompt,
      ...participation.value === "duo" ? [decisionActor, jointResolution] : [],
      ...branches.flatMap((branch) => [branch.choice, branch.result, branch.event])
    ];
    const missing = fields.find((field) => !field.value.trim());
    if (missing) {
      report.set("", { ok: false, error: "请填写作品资料、参与方式、地点与故事内容。" });
      missing.focus();
      return false;
    }
    if (!/^user-[a-z0-9_-]{1,19}$/.test(id.value.trim())) {
      report.set("", { ok: false, error: "标识须以 user- 开头，最多 24 字符，只能含小写字母、数字、短横线或下划线。" });
      id.focus();
      return false;
    }
    if (Boolean(from.value) !== Boolean(to.value) || from.value && from.value === to.value) {
      report.set("", { ok: false, error: "请填写不同的开始和结束时间，或将两项都留空。" });
      (from.value && !to.value ? to : from).focus();
      return false;
    }
    if (duration.value && (!Number.isInteger(Number(duration.value)) || Number(duration.value) < 1 || Number(duration.value) > 600)) {
      report.set("", { ok: false, error: "试玩时长须为 1–600 分钟的整数；留空即显示未知。" });
      duration.focus();
      return false;
    }
    return true;
  };
  const renderPlaytest = (result, path, json) => {
    if (!result?.ok) {
      report.set("隔离试玩未能继续。", result);
      playtestBox.replaceChildren();
      return;
    }
    report.set(result.complete ? "试玩结局已显示；没有写入行程、回忆或解锁。" : "试玩仅使用临时状态；没有写入行程、回忆或解锁。", result);
    const current = result.current;
    playtestBox.replaceChildren(current ? el(
      "div",
      {},
      el("strong", {}, current.event),
      current.prompt ? el("p", {}, current.prompt) : null,
      el("div", { class: "fun-story-row" }, (current.options ?? []).map((option) => button2(option.label, async () => {
        const nextPath = [...path, option.id];
        const next = await save(report, json, "playtest", nextPath);
        renderPlaytest(next, nextPath, json);
      }, { class: "fun-story-action" })))
    ) : el("p", {}, "试玩路径已结束。"));
  };
  const previewButton = button2("预览表单草稿", async () => {
    if (!validateForm()) return;
    const result = await save(report, JSON.stringify(buildPack()), "preview", []);
    if (result?.ok) playtestBox.replaceChildren(previewGraph(result));
  }, { class: "fun-story-action" });
  const playtestButton = button2("隔离试玩", async () => {
    if (!validateForm()) return;
    const json = JSON.stringify(buildPack());
    playtestBox.replaceChildren();
    const result = await save(report, json, "playtest", []);
    renderPlaytest(result, [], json);
  }, { class: "fun-story-action" });
  let stickyStatus;
  const saveButton = button2("保存新故事包", async () => {
    if (!validateForm()) return;
    const submitted = fingerprint();
    const result = await save(report, JSON.stringify(buildPack()), "import", []);
    if (result?.ok && submitted === fingerprint()) {
      baseline = submitted;
      stickyStatus.textContent = t.storySaved;
    }
    onDirty();
  }, { class: "fun-story-action fun-story-primary" });
  const duoSettings = el(
    "div",
    { class: "fun-story-grid fun-story-duo-settings" },
    label("双人起始行动者", decisionActor),
    label("共同选择分歧规则", jointResolution)
  );
  const syncDuoSettings = () => {
    duoSettings.hidden = participation.value !== "duo";
  };
  participation.addEventListener("change", () => {
    playtestBox.replaceChildren();
    report.set();
    syncDuoSettings();
  });
  syncDuoSettings();
  const group = (title2, fields, content, open = false, optional = false) => {
    const badge2 = el("span", { class: "fun-story-group-progress" });
    const requiredDot = el("span", { class: "fun-story-required-dot", "aria-hidden": "true" });
    const detail = el("details", { class: "fun-story-group fun-story-static-group", ...open ? { open: "" } : {} });
    const update2 = () => {
      const missing = fields.some((field) => !String(field.value ?? "").trim());
      requiredDot.hidden = optional || !missing;
      const done = fields.length - fields.filter((field) => !String(field.value ?? "").trim()).length;
      badge2.textContent = optional ? t.storyGroupOptional : typeof t.storyGroupProgress === "function" ? t.storyGroupProgress(done, fields.length) : `${done}/${fields.length}`;
      detail.setAttribute("class", `fun-story-group fun-story-static-group${!optional && missing ? " fun-story-group-incomplete" : ""}`);
    };
    detail.append(el("summary", {}, title2, requiredDot, badge2), el("div", { class: "fun-story-group-content" }, content));
    update2();
    return { node: detail, update: update2 };
  };
  const gWork = group(
    t.storyGroupWork,
    [place, area, id, title, author, release, genre, synopsis, participation],
    el(
      "div",
      {},
      el("div", { class: "fun-story-grid" }, label("地点", place), label("起始区域", area), label("故事标题", title), label("故事标识", id)),
      el("div", { class: "fun-story-grid" }, label("作者", author), label("作品版本", release), label("类型", genre), label("参与方式", participation)),
      el("div", { class: "fun-story-grid" }, label("无剧透简介", synopsis), label("试玩时长（分钟，可留空；留空显示未知）", duration), label("能力要求（可选，用逗号分隔）", requirements))
    ),
    true
  );
  const gStart = group(
    t.storyGroupStart,
    [event, prompt],
    el("div", {}, el("div", { class: "fun-story-grid" }, label("起始事件", event), label("选择提问", prompt)), duoSettings),
    true
  );
  const gBranches = group(
    t.storyGroupBranches,
    branches.flatMap((branch) => [branch.choice, branch.result, branch.event]),
    el("div", { class: "fun-story-grid fun-story-branches" }, branches.map((branch) => branch.node)),
    false
  );
  const gTiming = group(
    t.storyGroupTiming,
    [from, to],
    el("div", { class: "fun-story-grid" }, label("开始时间", from), label("结束时间", to)),
    false,
    true
  );
  stickyStatus = el("span", { class: "fun-story-sticky-status", role: "status", "aria-live": "polite" });
  const stickyActions = el(
    "div",
    { class: "fun-story-sticky-actions" },
    el("div", { class: "fun-story-row" }, saveButton, previewButton, playtestButton, stickyStatus)
  );
  const node2 = el(
    "section",
    { class: "fun-story-simple", "aria-label": t.storySimpleForm },
    gWork.node,
    gStart.node,
    gBranches.node,
    gTiming.node,
    stickyActions,
    report.node,
    playtestBox
  );
  const controls = [...node2.querySelectorAll("input"), ...node2.querySelectorAll("select")];
  const fingerprint = () => JSON.stringify(controls.map((field) => field.value));
  function update(items) {
    places = items;
    fillSelect(place, items.map((item) => ({ value: item.id, label: item.name || item.id })), "选择地点");
    updateAreas();
    gWork.update();
  }
  update([]);
  let baseline = fingerprint();
  const markDirty = () => {
    onDirty();
    gWork.update();
    gStart.update();
    gBranches.update();
    gTiming.update();
    stickyStatus.textContent = fingerprint() === baseline ? "" : t.storyEditorDirty;
  };
  for (const field of controls) for (const eventName of ["input", "change"]) field.addEventListener(eventName, markDirty);
  return { node: node2, update, isDirty: () => fingerprint() !== baseline };
}
function freeEditor(button2, save, onDirty = () => {
}, t = storyText()) {
  const input = (key, max, type = "text") => el("input", { class: `fun-story-free-${key}`, type, "data-free-field": key, ...max ? { maxlength: String(max) } : {} });
  const area = (key, rows = 3) => el("textarea", { class: `fun-story-free-${key}`, rows: String(rows), "data-free-field": key });
  const select = (key) => el("select", { class: `fun-story-free-${key}`, "data-free-field": key });
  const place = select("place");
  const id = input("id", 24);
  id.value = `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const title = input("title", 80);
  const synopsis = input("synopsis", 240);
  const author = input("author", 80);
  const release = input("release", 24);
  release.value = "1.0.0";
  const genre = input("genre", 40);
  genre.value = "日常";
  const participation = select("participation");
  fillSelect(participation, [{ value: "solo", label: "单人" }, { value: "duo", label: "双人" }, { value: "group", label: "多人（群里只有鱼写）" }], "选择参与方式");
  participation.value = "solo";
  const maxTurns = input("max-turns", null, "number");
  maxTurns.min = "1";
  maxTurns.max = "200";
  maxTurns.value = "20";
  const premise = area("premise", 2);
  const opening = area("opening", 3);
  const canon = area("canon", 5);
  const forbidden = area("forbidden", 2);
  const castName = input("cast-name", 40);
  const castRole = input("cast-role", 120);
  const castSecret = input("cast-secret", 120);
  const locName = input("loc-name", 40);
  const locDesc = input("loc-desc", 160);
  const flagLabel = input("flag-label", 40);
  flagLabel.value = "关键进展";
  const counterLabel = input("counter-label", 40);
  counterLabel.value = "信任";
  const counterMax = input("counter-max", null, "number");
  counterMax.min = "1";
  counterMax.max = "100";
  counterMax.value = "5";
  const factLabel = input("fact-label", 40);
  factLabel.value = "那件事的现状";
  const factInitial = input("fact-initial", 200);
  factInitial.value = "还没有人碰过";
  const goalText = input("goal-text", 120);
  goalText.value = "弄清那件事";
  const endText = input("end-text", 120);
  endText.value = "在天黑前把话说开";
  const endThreshold = input("end-threshold", null, "number");
  endThreshold.min = "0";
  endThreshold.max = "100";
  endThreshold.value = "2";
  const report = feedback2();
  const playtestBox = el("div", { class: "fun-story-playtest" });
  const lines = (value) => String(value ?? "").split(/\r?\n/).map((line2) => line2.trim()).filter(Boolean);
  const buildPack = () => {
    const canonLines = lines(canon.value);
    const forbiddenLines = lines(forbidden.value);
    const limit = Number(counterMax.value) || 5;
    const threshold = Number(endThreshold.value) || 0;
    return {
      version: 3,
      id: id.value.trim(),
      title: title.value.trim(),
      description: synopsis.value.trim(),
      placeId: place.value,
      metadata: {
        mode: "free",
        author: author.value.trim(),
        release: release.value.trim(),
        genre: genre.value.trim(),
        synopsis: synopsis.value.trim(),
        participation: participation.value,
        maxTurns: Number(maxTurns.value) || 20
      },
      setting: {
        premise: premise.value.trim(),
        canon: canonLines,
        ...forbiddenLines.length ? { forbidden: forbiddenLines } : {},
        cast: [{ id: "someone", name: castName.value.trim(), role: castRole.value.trim(), secret: castSecret.value.trim() }],
        locations: [{ id: "here", name: locName.value.trim(), desc: locDesc.value.trim() }],
        opening: opening.value.trim(),
        flags: [{ id: "progress", label: flagLabel.value.trim(), initial: false }],
        counters: [{ id: "trust", label: counterLabel.value.trim(), initial: 0, min: 0, max: limit }],
        facts: [{ id: "state", label: factLabel.value.trim(), initial: factInitial.value.trim() }],
        goals: [{ id: "finish", text: goalText.value.trim(), when: { all: [{ flag: "progress" }] } }],
        ends: [{ id: "wrap", text: endText.value.trim(), when: { all: [{ flag: "progress" }, { counter: "trust", gte: threshold }] } }]
      }
    };
  };
  const required = [place, id, title, synopsis, author, release, genre, premise, opening, castName, locName, flagLabel, counterLabel, counterMax, factLabel, goalText, endText, endThreshold];
  const validateForm = () => {
    const missing = required.find((field) => !String(field.value ?? "").trim());
    if (missing) {
      report.set("", { ok: false, error: "请填写作品资料、大方向、开场、人物、地点和收尾条件。" });
      missing.focus();
      return false;
    }
    if (lines(canon.value).length < 3) {
      report.set("", { ok: false, error: "正史（canon）至少写三条：每行一条，主持不能推翻它们。" });
      canon.focus();
      return false;
    }
    if (!/^user-[a-z0-9_-]{1,19}$/.test(id.value.trim())) {
      report.set("", { ok: false, error: "标识须以 user- 开头，最多 24 字符，只能含小写字母、数字、短横线或下划线。" });
      id.focus();
      return false;
    }
    const limit = Number(counterMax.value);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      report.set("", { ok: false, error: "计数上限须为 1–100 的整数。" });
      counterMax.focus();
      return false;
    }
    const threshold = Number(endThreshold.value);
    if (!Number.isInteger(threshold) || threshold < 0 || threshold > limit) {
      report.set("", { ok: false, error: "收尾阈值须为 0 到计数上限之间的整数。" });
      endThreshold.focus();
      return false;
    }
    const turns = Number(maxTurns.value);
    if (!Number.isInteger(turns) || turns < 1 || turns > 200) {
      report.set("", { ok: false, error: "回合上限须为 1–200 的整数。" });
      maxTurns.focus();
      return false;
    }
    return true;
  };
  const freePreview = (result) => {
    if (!result?.free) return el("p", {}, "预览没有返回场景包设定。");
    const setting = result.setting ?? {};
    return el(
      "section",
      { class: "fun-story-graph", "aria-label": "场景包只读预览" },
      el("h4", {}, result.title || "场景包预览"),
      el("p", { class: "fun-story-note" }, result.eligible ? "当前条件可开始" : "当前条件未满足（地点或版本）"),
      setting.premise ? el("p", {}, setting.premise) : null,
      setting.opening ? el("p", { class: "fun-story-note" }, `开场：${setting.opening}`) : null,
      (setting.canon ?? []).length ? el(
        "div",
        {},
        el("strong", {}, "正史（不可改写）"),
        el("ul", {}, setting.canon.map((line2) => el("li", {}, line2)))
      ) : null,
      (setting.cast ?? []).length ? el("p", { class: "fun-story-note" }, `人物：${setting.cast.join("、")}`) : null,
      (setting.ends ?? []).length ? el("p", { class: "fun-story-note" }, `可能的收尾：${setting.ends.join("、")}`) : null
    );
  };
  const previewButton = button2("预览表单草稿", async () => {
    if (!validateForm()) return;
    const result = await save(report, JSON.stringify(buildPack()), "preview", []);
    if (result?.ok) playtestBox.replaceChildren(freePreview(result));
  }, { class: "fun-story-action" });
  const playtestButton = button2("隔离试玩", async () => {
    if (!validateForm()) return;
    playtestBox.replaceChildren();
    const result = await save(report, JSON.stringify(buildPack()), "playtest", []);
    if (!result?.ok) {
      report.set("隔离试玩未能继续。", result);
      return;
    }
    report.set("试玩只显示开场；真正的每一回合要开始故事之后才有主持。没有写入行程、回忆或解锁。", result);
    playtestBox.replaceChildren(el("div", {}, el("strong", {}, result.path?.[0]?.event ?? "（没有开场）")));
  }, { class: "fun-story-action" });
  let stickyStatus;
  const saveButton = button2("保存自由场景包", async () => {
    if (!validateForm()) return;
    const submitted = fingerprint();
    const result = await save(report, JSON.stringify(buildPack()), "import", []);
    if (result?.ok && submitted === fingerprint()) {
      baseline = submitted;
      stickyStatus.textContent = t.storySaved;
    }
    onDirty();
  }, { class: "fun-story-action fun-story-primary fun-story-free-save" });
  const group = (name, content, open = true) => el(
    "details",
    { class: "fun-story-group fun-story-free-group", ...open ? { open: "" } : {} },
    el("summary", {}, name),
    el("div", { class: "fun-story-group-content" }, content)
  );
  const node2 = el(
    "section",
    { class: "fun-story-simple fun-story-free-form", "aria-label": "自由场景包表单" },
    el("p", { class: "fun-story-free-note" }, "只写大方向、正史、人物和收尾条件；每一回合怎么演交给主持。写到一半可以展开下面的 JSON 看结构。"),
    group("作品资料", el(
      "div",
      {},
      el("div", { class: "fun-story-grid" }, label("地点", place), label("故事标题", title), label("故事标识", id), label("参与方式", participation)),
      el("div", { class: "fun-story-grid" }, label("作者", author), label("作品版本", release), label("类型", genre), label("回合上限", maxTurns)),
      el("div", { class: "fun-story-grid" }, label("无剧透简介", synopsis))
    )),
    group("大方向与正史", el(
      "div",
      {},
      el("div", { class: "fun-story-grid" }, label("大方向（premise）", premise)),
      el("div", { class: "fun-story-grid" }, label("开场白", opening)),
      el("div", { class: "fun-story-grid" }, label("正史：每行一条，至少三条，主持不能推翻", canon)),
      el("div", { class: "fun-story-grid" }, label("禁区：每行一条，可选", forbidden))
    )),
    group("人物与地点", el(
      "div",
      {},
      el("div", { class: "fun-story-grid" }, label("人物名字", castName), label("身份 / 关系", castRole), label("他的秘密（玩家不知道）", castSecret)),
      el("div", { class: "fun-story-grid" }, label("这一幕的地方名", locName), label("这一处的样子", locDesc))
    )),
    group("状态与收尾", el(
      "div",
      {},
      el("div", { class: "fun-story-grid" }, label("进展标记（flag）", flagLabel), label("计数（counter）", counterLabel), label("计数上限", counterMax)),
      el("div", { class: "fun-story-grid" }, label("现状（fact）", factLabel), label("现状初值", factInitial)),
      el("div", { class: "fun-story-grid" }, label("目标文案", goalText), label("收尾文案", endText), label("收尾阈值", endThreshold)),
      el("p", { class: "fun-story-note" }, "达成「进展标记」且计数到阈值时，主持才能请求收尾；程序判定通过才真的结束。")
    )),
    el(
      "div",
      { class: "fun-story-sticky-actions" },
      el("div", { class: "fun-story-row" }, saveButton, previewButton, playtestButton, stickyStatus = el("span", { class: "fun-story-sticky-status", role: "status", "aria-live": "polite" }))
    ),
    report.node,
    playtestBox
  );
  const controls = [...node2.querySelectorAll("input"), ...node2.querySelectorAll("select"), ...node2.querySelectorAll("textarea")];
  const fingerprint = () => JSON.stringify(controls.map((field) => field.value));
  let baseline = fingerprint();
  const markDirty = () => {
    onDirty();
    stickyStatus.textContent = fingerprint() === baseline ? "" : t.storyEditorDirty;
  };
  for (const field of controls) for (const eventName of ["input", "change"]) field.addEventListener(eventName, markDirty);
  function update(items) {
    const selected = place.value;
    place.replaceChildren(
      el("option", { value: "" }, "选择地点"),
      ...items.map((item) => el("option", { value: item.id }, item.name || item.id))
    );
    place.value = selected || "";
    if (!selected) baseline = fingerprint();
  }
  update([]);
  return { node: node2, update, isDirty: () => fingerprint() !== baseline };
}
function mountStories(ctx) {
  const { root } = ctx;
  const t = storyText(ctx.language);
  const storageKey = `fun:story-editor:v2:${ctx.worldId ?? ctx.pageId ?? "world:fun"}`;
  const storage = () => root.ownerDocument?.defaultView?.localStorage ?? globalThis.localStorage;
  let expanded = false;
  try {
    expanded = storage()?.getItem(storageKey) === "expanded";
  } catch {
  }
  const box = el("div", { class: "fun-stories" });
  root.replaceChildren(el("style", {}, CSS), box);
  let busy = false;
  let listRequest = 0;
  let lastPacks;
  let draftEdits = 0;
  let jsonBaseline = "";
  let editingId = "";
  const jsonDrafts = /* @__PURE__ */ new Map();
  const dirtyBadge = el("span", { class: "fun-story-dirty", role: "status" });
  const authorContent = el("div", { class: "fun-story-author-content", id: "fun-story-author-content" });
  const editorToggle = button2("", () => setExpanded(!expanded), { class: "fun-story-editor-toggle", "aria-controls": "fun-story-author-content" });
  const authoring = el(
    "section",
    { class: "fun-story-editor fun-story-authoring", "aria-label": t.storyEditorTitle },
    el("div", { class: "fun-story-editor-head" }, el("h3", {}, t.storyEditorTitle), dirtyBadge, editorToggle),
    authorContent
  );
  function updateDirty() {
    const otherDirty = [...jsonDrafts].some(([id, cached]) => id !== editingId && cached.value !== cached.baseline);
    const dirty = Boolean(simple?.isDirty() || free?.isDirty() || draft?.value !== jsonBaseline || otherDirty);
    dirtyBadge.textContent = dirty ? t.storyEditorDirty : "";
    dirtyBadge.hidden = !dirty;
  }
  function setExpanded(value, scroll = false) {
    expanded = value;
    authorContent.hidden = !value;
    editorToggle.setAttribute("aria-expanded", String(value));
    editorToggle.textContent = value ? t.storyEditorCollapse : t.storyEditorExpand;
    try {
      storage()?.setItem(storageKey, value ? "expanded" : "collapsed");
    } catch {
    }
    updateDirty();
    if (scroll) authoring.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
  }
  function button2(text2, handler, attrs = {}) {
    const node2 = el("button", { type: "button", ...attrs }, text2);
    node2.addEventListener("click", () => {
      if (node2.getAttribute("aria-disabled") !== "true" && !ctx.signal?.aborted) handler();
    });
    return node2;
  }
  const errorResult = (error) => ({ ok: false, error: error?.message ?? String(error) });
  function setBusy(value) {
    busy = value;
    for (const node2 of box.querySelectorAll(".fun-story-action")) node2.setAttribute("aria-disabled", String(value));
  }
  async function run(report, pending, method, args, render) {
    if (busy) return;
    setBusy(true);
    report.set(pending);
    try {
      const result = await ctx.invoke(method, [args]);
      if (!ctx.signal?.aborted) await render(result ?? { ok: false, error: "返回结果为空。" });
      return result;
    } catch (error) {
      if (!ctx.signal?.aborted) report.set("", errorResult(error));
      return errorResult(error);
    } finally {
      if (!ctx.signal?.aborted) setBusy(false);
    }
  }
  const place = el("select", { class: "fun-story-place" });
  const defaultPlace = () => el("option", { value: "" }, "默认地点");
  place.appendChild(defaultPlace());
  const draft = el("textarea", { class: "fun-story-json", rows: "8", spellcheck: "false", placeholder: "粘贴故事包 JSON…" });
  const overwrite = el("input", { type: "checkbox", class: "fun-story-overwrite" });
  const editorReport = feedback2();
  const editorResult = el("div", { class: "fun-story-result" });
  const importBind = el("div", { class: "fun-story-bind fun-story-bind-import", hidden: true });
  let bindTarget = "";
  function hideImportBind() {
    importBind.hidden = true;
    importBind.replaceChildren();
    bindTarget = "";
  }
  function showImportBind(placeId) {
    const venues = lastData?.places ?? [];
    if (!venues.length) return;
    const select = el("select", { class: "fun-story-bind-place", "aria-label": "导入时绑定到的地点" });
    select.appendChild(el("option", { value: "" }, "选择要绑定到的地点"));
    for (const venue of venues) select.appendChild(el("option", { value: venue.id }, `${venue.name || venue.id} · ${venue.id}`));
    select.value = venues.some((venue) => venue.id === bindTarget) ? bindTarget : "";
    select.addEventListener("change", () => {
      bindTarget = select.value;
    });
    importBind.replaceChildren(
      el("p", { class: "fun-story-note" }, `包里写的地点编号「${placeId}」在地点册里没有。选一处现有地点，再点「导入故事包」，这次会直接把包绑过去。`),
      el("div", { class: "fun-story-row" }, select)
    );
    importBind.hidden = false;
  }
  draft.addEventListener("input", () => {
    draftEdits += 1;
    if (!busy) editorReport.set();
    editorResult.replaceChildren();
    hideImportBind();
    updateDirty();
  });
  const editingLabel = el("p", { class: "fun-story-note fun-story-editing", role: "status" });
  const retainJson = () => jsonDrafts.set(editingId, { value: draft.value, baseline: jsonBaseline, overwrite: overwrite.checked });
  function loadJson(value, id = "", title = "") {
    retainJson();
    editingId = id;
    const cached = jsonDrafts.get(id);
    const retained = id && cached?.value === cached?.baseline ? null : cached;
    draft.value = retained?.value ?? value;
    jsonBaseline = retained?.baseline ?? value;
    overwrite.checked = retained?.overwrite ?? Boolean(id);
    draftEdits += 1;
    editingLabel.textContent = id ? `${t.storyEditing} · ${title || id}` : "";
    editorResult.replaceChildren();
    editorReport.set(retained && retained.value !== retained.baseline ? t.storyEditRetained : id ? t.storyEditLoaded : t.storyNewJsonReady);
    setAuthorMode("json");
    setExpanded(true, true);
    draft.focus({ preventScroll: true });
  }
  function editAction(text2, method, pending) {
    return button2(text2, () => {
      const json = draft.value;
      const edits = draftEdits;
      const placeId = place.value;
      const args = method === "template" ? placeId ? { placeId } : {} : { json };
      if (method === "import") {
        if (overwrite.checked) args.replace = true;
        if (bindTarget) args.bindPlaceId = bindTarget;
      }
      editorResult.replaceChildren();
      void run(editorReport, pending, method, args, async (result) => {
        const changed = draftEdits !== edits || draft.value !== json;
        const previous = changed ? "上次提交：" : "";
        if (method === "template") {
          if (result.ok && !changed && (!draft.value || draft.value === jsonBaseline)) {
            if (typeof result.json !== "string") throw new Error("模板没有返回 JSON。");
            draft.value = result.json;
            jsonBaseline = "";
            editingId = "";
            editingLabel.textContent = "";
            overwrite.checked = false;
            updateDirty();
          } else if (result.ok && !changed) {
            const output = el("textarea", { class: "fun-story-export", rows: "6", readonly: "", spellcheck: "false" });
            output.value = result.json;
            editorResult.appendChild(output);
          }
          editorReport.set(result.ok ? changed || draft.value !== result.json ? "草稿已修改，保留当前内容。" : "模板已填入。" : "", result);
        } else if (method === "validate") {
          editorReport.set(previous + (result.ok ? result.placeMissing ? "结构校验通过，但包里的地点在本地没有。" : "校验通过。" : "校验未通过。"), result);
          if (result.ok && result.placeMissing) showImportBind(result.pack?.placeId ?? "");
        } else if (method === "preview") {
          editorReport.set(previous + (result.ok ? "只读预览已生成。" : "预览失败。"), result);
          if (result.ok) editorResult.appendChild(previewGraph(result));
          if (result.ok && result.placeMissing) showImportBind(result.placeId ?? "");
        } else {
          editorReport.set(previous + (result.ok ? `已导入${result.id ? ` · ${result.id}` : ""}。` : "导入失败。"), result);
          if (!result.ok && result.placeMissing) showImportBind(result.placeId ?? "");
          if (result.ok) {
            hideImportBind();
            if (!changed) jsonBaseline = json;
            overwrite.checked = false;
            updateDirty();
            await load();
          }
        }
      });
    }, { class: `fun-story-action${method === "import" ? " fun-story-primary" : ""}` });
  }
  const loadReport = feedback2();
  const libraryReport = feedback2();
  const packList = el("div", { class: "fun-story-list" });
  const refreshButton = button2("刷新列表", () => {
    void load();
  });
  let packFilter = "all";
  let lastData = null;
  const countNote = el("span", { class: "fun-story-count" });
  const filterButtons = [];
  const filters = el("nav", { class: "fun-story-filters", "aria-label": "作品筛选" });
  for (const [id, label2] of [["all", "全部作品"], ["builtin", "内置故事"], ["mine", "我的作品"]]) {
    const node2 = button2(label2, () => {
      packFilter = id;
      syncFilters();
      renderCards();
    }, { "aria-pressed": "false" });
    node2.setAttribute("data-filter", id);
    filterButtons.push(node2);
    filters.appendChild(node2);
  }
  function syncFilters() {
    for (const node2 of filterButtons) node2.setAttribute("aria-pressed", String(node2.getAttribute("data-filter") === packFilter));
  }
  syncFilters();
  const savePack = (report, json, method = "import", path = []) => run(
    report,
    method === "playtest" ? "正在隔离试玩…" : "正在保存新故事包…",
    method,
    { json, ...method === "playtest" ? { path } : {} },
    async (result) => {
      if (method === "preview") {
        report.set(result.ok ? "只读预览已生成，没有保存故事或推进行程。" : "预览失败。", result);
        return;
      }
      if (method === "playtest") {
        report.set(result.ok ? "试玩仅使用临时状态，没有写入正式行程或解锁。" : "隔离试玩失败。", result);
        return;
      }
      report.set(result.ok ? `已保存新故事包${result.id ? ` · ${result.id}` : ""}。` : "保存失败。", result);
      if (result.ok) await load();
    }
  );
  const simple = simpleEditor(button2, savePack, updateDirty, t);
  const free = freeEditor(button2, savePack, updateDirty, t);
  let authorMode = "static";
  const MODES = [
    ["static", "选项式故事", "先选地点，再写开场、人物与分支。想让故事顺着走，也可以做一个只写设定的场景包。"],
    ["free", "自由场景包", "只写大方向、正史、人物和收尾条件；每一回合怎么演交给主持。"],
    ["json", "从文件导入", "选一个导出的 .json 文件，或直接粘贴；校验、预览与导入都在这儿，导入会写进故事库。"]
  ];
  const modeButtons = new Map(MODES.map(([id, label2]) => [id, button2(label2, () => setAuthorMode(id), { class: "fun-story-mode-tab", "aria-pressed": "false" })]));
  const modeBar = el("div", { class: "fun-story-mode", role: "group", "aria-label": "从哪儿开始" }, [...modeButtons.values()]);
  const modeNote = el("p", { class: "fun-story-mode-note" });
  function setAuthorMode(mode) {
    authorMode = mode;
    for (const [id, node2] of modeButtons) node2.setAttribute("aria-pressed", String(id === mode));
    simple.node.hidden = mode !== "static";
    free.node.hidden = mode !== "free";
    jsonPane.hidden = mode !== "json";
    modeNote.textContent = MODES.find(([id]) => id === mode)?.[2] ?? "";
    updateDirty();
  }
  const jsonFile = el("input", { type: "file", accept: ".json,application/json", hidden: true, class: "fun-story-json-file", "aria-label": "选择故事包 JSON 文件" });
  const jsonFileNote = el("p", { class: "fun-story-file-note", role: "status" }, "单个 .json 文件，≤ 32 KB；也可以直接粘贴到下面");
  const jsonPick = button2("选择 JSON 文件…", () => jsonFile.click(), { class: "fun-story-file-btn" });
  jsonFile.addEventListener("change", () => {
    const file = jsonFile.files?.[0];
    jsonFile.value = "";
    if (!file) return;
    const size = Number(file.size) || 0;
    if (size > 32 * 1024) {
      jsonFileNote.setAttribute("data-state", "error");
      jsonFileNote.textContent = `「${file.name}」有 ${(size / 1024).toFixed(1)} KB，超过 32 KB 上限`;
      return;
    }
    void (async () => {
      try {
        const text2 = String(await file.text()).replace(/^\uFEFF/, "");
        JSON.parse(text2);
        draft.value = text2;
        jsonBaseline = "";
        editingId = "";
        editingLabel.textContent = "";
        draftEdits += 1;
        setAuthorMode("json");
        jsonFileNote.setAttribute("data-state", "ok");
        jsonFileNote.textContent = `已选 ${file.name} · ${(size / 1024).toFixed(1)} KB，确认无误再点「导入故事包」`;
        updateDirty();
      } catch (error) {
        jsonFileNote.setAttribute("data-state", "error");
        jsonFileNote.textContent = error instanceof SyntaxError ? "这个文件不是有效的 JSON，先确认导出的是故事包。" : "这个文件读不出来，换一个 .json 试试。";
      }
    })();
  });
  const jsonPane = el(
    "section",
    { class: "fun-story-advanced fun-story-json-editor fun-story-json-pane fun-story-mode-pane", "data-pane": "json", "aria-label": "从文件导入", hidden: true },
    el("div", { class: "fun-story-file" }, jsonPick, jsonFile, jsonFileNote),
    el("div", { class: "fun-story-row" }, el("h3", {}, "完整 JSON"), button2(t.storyNewJson, () => loadJson(""))),
    editingLabel,
    el(
      "div",
      { class: "fun-story-row" },
      el("label", { class: "fun-story-field" }, "模板地点", place),
      editAction("填入模板", "template", "正在取模板…"),
      button2("自由模式模板", () => {
        const placeId = place.value;
        const args = { ...placeId ? { placeId } : {}, mode: "free" };
        editorResult.replaceChildren();
        void run(editorReport, "正在取模板…", "template", args, (result) => {
          if (!result.ok || typeof result.json !== "string") {
            editorReport.set("模板没有返回 JSON。", result);
            return;
          }
          draft.value = result.json;
          jsonBaseline = "";
          editingId = "";
          editingLabel.textContent = "";
          setAuthorMode("json");
          setExpanded(true, true);
          updateDirty();
          editorReport.set("自由模式模板已填入：只写设定与收尾条件，不写分支。", result);
        });
      }, { class: "fun-story-action" })
    ),
    el("label", { class: "fun-story-field" }, "故事包 JSON", draft),
    el(
      "div",
      { class: "fun-story-row" },
      editAction("校验 JSON", "validate", "正在校验…"),
      editAction("预览草稿", "preview", "正在预览…"),
      editAction("导入故事包", "import", "正在导入…"),
      el("label", { class: "fun-story-field" }, overwrite, "覆盖同 ID 故事包")
    ),
    importBind,
    editorReport.node,
    editorResult
  );
  authorContent.appendChild(el("p", { class: "fun-story-note" }, t.storyDraftHint));
  authorContent.appendChild(modeBar);
  authorContent.appendChild(modeNote);
  authorContent.appendChild(simple.node);
  authorContent.appendChild(free.node);
  authorContent.appendChild(jsonPane);
  setAuthorMode("static");
  setExpanded(expanded);
  function startNew(mode) {
    setAuthorMode(mode);
    setExpanded(true, true);
    const first = mode === "free" ? free.node.querySelector(".fun-story-free-title") : simple.node.querySelector(".fun-story-author-title");
    first?.focus?.({ preventScroll: true });
  }
  const newButton = button2(`＋ ${t.storyWrite}`, () => startNew("static"), { class: "fun-story-primary fun-story-new" });
  box.replaceChildren(
    el(
      "header",
      { class: "fun-story-heading fun-story-head" },
      el(
        "div",
        { class: "fun-story-head-main" },
        el("p", { class: "fun-story-kicker" }, "从0开始的肥鱼大冒险 · 给下一次出游，写一个故事。"),
        el("h2", {}, "给下一次出游，写一个故事。"),
        el("p", { class: "fun-story-note" }, "故事库、创作与试玩放在一起；平时只看作品，编辑时再展开。")
      ),
      el("div", { class: "fun-story-head-actions" }, newButton)
    ),
    el(
      "div",
      { class: "fun-story-layout" },
      el(
        "div",
        { class: "fun-story-main" },
        authoring,
        el(
          "section",
          { class: "fun-story-library", "aria-label": "故事包列表" },
          el("div", { class: "fun-story-row" }, el("h3", {}, "已收录故事包"), countNote, refreshButton),
          filters,
          loadReport.node,
          libraryReport.node,
          packList
        )
      )
    )
  );
  function packCard(pack) {
    const title = pack.title || pack.id;
    const metadata = pack.metadata;
    const durationLabel = metadata?.durationMinutes === void 0 ? "时长未知" : `${metadata.durationMinutes} 分钟`;
    const report = feedback2();
    const resultBox = el("div", { class: "fun-story-result" });
    const confirm = el("div", { class: "fun-story-confirm" });
    const packAction = (text2, key, handler, css = "") => button2(text2, handler, {
      class: `fun-story-action ${css}`,
      "aria-disabled": String(busy),
      "aria-label": `${text2} ${title}`,
      "data-story-focus": `${pack.id}:${key}`
    });
    const read = (method, label2) => {
      const opener = packAction(label2, method, () => {
        confirm.replaceChildren();
        resultBox.replaceChildren();
        void run(report, method === "preview" ? "正在预览…" : "正在导出…", method, { id: pack.id }, (result) => {
          report.set(result.ok ? method === "preview" ? "只读预览已生成。" : "已导出，可复制 JSON。" : "", result);
          if (!result.ok) return;
          if (method === "preview") {
            resultBox.appendChild(previewGraph(result));
          } else {
            if (typeof result.json !== "string") throw new Error("导出没有返回 JSON。");
            const output = el("textarea", { class: "fun-story-export", rows: "6", readonly: "", spellcheck: "false" });
            output.value = result.json;
            resultBox.appendChild(el("label", { class: "fun-story-field" }, `导出的 JSON · ${title}`, output));
          }
          resultBox.appendChild(button2("收起", () => {
            resultBox.replaceChildren();
            report.set();
            opener.focus();
          }));
        });
      });
      return opener;
    };
    const mutate = (method, label2) => {
      void run(report, `正在${label2}…`, method, { id: pack.id }, async (result) => {
        libraryReport.set();
        report.set("", result);
        if (!result.ok) return;
        libraryReport.set(`已${label2}「${title}」。`, result);
        await load();
        confirm.replaceChildren();
      });
    };
    const toggle = pack.enabled ? ["disable", "停用"] : ["enable", "启用"];
    const remove = pack.builtin ? null : packAction("移除", "remove", () => {
      const cancel = button2("取消", () => {
        confirm.replaceChildren();
        remove.focus();
      });
      confirm.replaceChildren(
        el("span", {}, `移除「${title}」？`),
        el("div", { class: "fun-story-row" }, cancel, packAction("确认移除", "confirm", () => mutate("remove", "移除"), "fun-story-danger"))
      );
      cancel.focus();
    }, "fun-story-danger");
    const warnings = pack.warnings?.length ? pack.warnings : pack.available === false ? ["绑定地点或区域当前不匹配。"] : [];
    const placeBind = pack.placeMissing ? (() => {
      const venues = lastData?.places ?? [];
      const select = el("select", { class: "fun-story-bind-place", "aria-label": `把「${title}」绑定到的地点` });
      select.appendChild(el("option", { value: "" }, "选择要绑定到的地点"));
      for (const venue of venues) select.appendChild(el("option", { value: venue.id }, `${venue.name || venue.id} · ${venue.id}`));
      const apply = pack.builtin ? null : packAction("绑定到此处", "bind", () => {
        if (!select.value) {
          report.set("先在下拉里选一处地点。");
          return;
        }
        const target = select.value;
        void run(report, "正在绑定…", "rebind", { id: pack.id, placeId: target }, async (result) => {
          report.set("", result);
          if (!result.ok) return;
          libraryReport.set(result.message || "已绑定。", result);
          await load();
        });
      });
      return el(
        "div",
        { class: "fun-story-bind" },
        el("p", { class: "fun-story-note" }, `包里写的地点编号是「${pack.placeId}」，本地没有这处。`),
        apply && venues.length ? el("div", { class: "fun-story-row" }, select, apply) : null
      );
    })() : null;
    const cover = el("div", { class: "fun-story-cover", "aria-hidden": "true" });
    cover.innerHTML = venueArtwork(pack.placeId || "");
    const body = el(
      "div",
      { class: "fun-story-body" },
      el(
        "div",
        { class: "fun-story-row" },
        el("h4", {}, title),
        el("span", { class: "fun-story-badge" }, pack.builtin ? "内置" : "自定义"),
        el("span", { class: "fun-story-badge" }, pack.enabled ? "已启用" : "已停用"),
        pack.available === false ? el("span", { class: "fun-story-badge fun-story-unavailable" }, "暂不可用") : null
      ),
      el("p", { class: "fun-story-note" }, `${pack.placeName || pack.placeId || "未绑定地点"} · ${pack.nodeCount} 个节点 · 格式 v${pack.formatVersion ?? 1} · ${pack.revision}`),
      metadata ? el("p", { class: "fun-story-note" }, `作者：${metadata.author} · 类型：${metadata.genre} · ${metadata.participation === "duo" ? "双人" : "单人"} · 时长：${durationLabel}`) : el("p", { class: "fun-story-note" }, `时长未知 · ${pack.nodeCount} 个节点不用于估算时长`),
      pack.description ? el("p", {}, pack.description) : null,
      warnings.length ? el("div", { class: "fun-story-note" }, messageList(warnings)) : null,
      placeBind,
      el(
        "div",
        { class: "fun-story-row" },
        packAction(t.storyEdit, "edit", () => {
          const edits = draftEdits;
          const before = draft.value;
          void run(report, t.storyEditLoading, "export", { id: pack.id }, (result) => {
            if (!result.ok) {
              report.set("", result);
              return;
            }
            if (typeof result.json !== "string") throw new Error("导出没有返回 JSON。");
            if (draftEdits !== edits || draft.value !== before) {
              report.set(t.storyEditChanged);
              return;
            }
            loadJson(result.json, pack.id, title);
            report.set();
          });
        }),
        read("preview", "预览"),
        read("export", "导出 JSON"),
        packAction(toggle[1], "toggle", () => mutate(...toggle)),
        remove
      ),
      confirm,
      report.node,
      resultBox
    );
    return el("article", { class: "fun-story-pack", "data-pack-id": pack.id }, cover, body);
  }
  function renderCards() {
    if (!lastData) return;
    const packs = lastData.packs ?? [];
    const visible = packs.filter((pack) => packFilter === "all" || (packFilter === "builtin" ? Boolean(pack.builtin) : !pack.builtin));
    countNote.textContent = `${visible.length} 篇故事 · 选项式与自由模式`;
    lastPacks = `${packFilter}|${JSON.stringify(packs)}`;
    syncFilters();
    if (visible.length) {
      packList.replaceChildren(...visible.map(packCard));
      return;
    }
    packList.replaceChildren(el(
      "section",
      { class: "fun-story-empty" },
      el("h4", {}, packFilter === "all" ? t.storyEmptyTitle : packFilter === "builtin" ? "还没有内置故事" : "还没有自己的作品"),
      el("p", { class: "fun-story-note" }, packFilter === "all" ? t.storyEmptyBody : packFilter === "builtin" ? "内置故事随版本提供，停用后仍会留在这里。" : "从右侧新建一篇，或用完整 JSON 导入。"),
      packFilter === "all" ? button2(t.storyWrite, () => {
        setExpanded(true, true);
        editorToggle.focus({ preventScroll: true });
      }) : null
    ));
  }
  function renderList(data) {
    lastData = data;
    const selected = place.value;
    place.replaceChildren(
      defaultPlace(),
      ...data.places.map((item) => el("option", { value: item.id }, item.name || item.id)),
      ...selected && !data.places.some((item) => item.id === selected) ? [el("option", { value: selected }, selected)] : []
    );
    place.value = selected;
    simple.update(data.places);
    free.update(data.places);
    const signature = `${packFilter}|${JSON.stringify(data.packs)}`;
    if (signature === lastPacks) return;
    const focused = root.activeElement ?? document.activeElement;
    const buttonWasFocused = [...packList.querySelectorAll("button")].includes(focused);
    const focusKey = focused?.getAttribute?.("data-story-focus");
    renderCards();
    if (buttonWasFocused) {
      const replacement = [...packList.querySelectorAll("button")].find((node2) => focusKey && node2.getAttribute("data-story-focus") === focusKey);
      (replacement || refreshButton).focus();
    }
  }
  async function load() {
    if (ctx.signal?.aborted) return;
    const sequence = ++listRequest;
    refreshButton.setAttribute("aria-disabled", "true");
    loadReport.set("正在读取故事包…");
    try {
      const data = await ctx.invoke("list", []);
      if (sequence !== listRequest || ctx.signal?.aborted) return;
      if (!data?.ok) {
        loadReport.set("列表加载失败。", data ?? { ok: false });
        return;
      }
      renderList(data);
      loadReport.set("", data);
    } catch (error) {
      if (sequence === listRequest && !ctx.signal?.aborted) loadReport.set("列表加载失败。", errorResult(error));
    } finally {
      if (sequence === listRequest && !ctx.signal?.aborted) {
        refreshButton.setAttribute("aria-disabled", "false");
        refreshButton.textContent = loadReport.node.querySelector(".fun-story-errors").textContent ? "重试" : "刷新列表";
      }
    }
  }
  void load();
  return { refresh: load, expand: () => setExpanded(true, true) };
}

// webui/story/controller.js
function createStoryController(ctx, onChange = () => {
}, environment = {}) {
  const doc = environment.document ?? globalThis.document;
  const win = environment.window ?? globalThis.window;
  const state = {
    snapshot: null,
    loading: true,
    busy: "",
    error: "",
    notice: "",
    reason: "",
    dmBusy: false,
    autoRunning: false,
    autoAuthorized: false,
    autoplay: false,
    recovering: false,
    ready: false
  };
  let mounted = !ctx.signal?.aborted;
  let generation = 0;
  let requestVersion = 0;
  let autoJob = null;
  let modeJob = null;
  let mutationJob = null;
  let pauseJob = null;
  const hidden = () => doc?.visibilityState === "hidden";
  const alive = () => mounted && !ctx.signal?.aborted;
  const emit = () => {
    if (alive()) onChange(state);
  };
  const trip = () => state.snapshot?.trip;
  const token = () => state.snapshot?.autonomy?.token;
  const description = (error) => typeof error === "string" ? error : error?.message ?? "请求未完成，请重新读取实际进度。";
  const waits = /* @__PURE__ */ new Set();
  const invalidate = () => {
    generation += 1;
    state.autoAuthorized = false;
    for (const cancel of [...waits]) cancel();
  };
  function pace() {
    const ms = environment.pacingMs ?? 650;
    if (ms <= 0) return Promise.resolve();
    return new Promise((resolve) => {
      let timer;
      const finish = () => {
        waits.delete(finish);
        timer?.dispose();
        resolve();
      };
      waits.add(finish);
      if (ctx.timeout) timer = ctx.timeout(finish, ms);
      else {
        const id = setTimeout(finish, ms);
        timer = { dispose: () => clearTimeout(id) };
      }
    });
  }
  const same = (identity) => alive() && !hidden() && state.autoAuthorized && generation === identity.generation && trip()?.id === identity.id && trip()?.stamp === identity.stamp && token() === identity.token && state.snapshot?.autonomy?.enabled === true;
  async function call(method, payload, opts = {}) {
    if (typeof ctx.storyCall !== "function") throw new Error("故事面板尚未连接调用适配器，请提供 ctx.storyCall。");
    const result = await ctx.storyCall(method, payload, {
      timeoutMs: ["decide", "dmPropose"].includes(method) ? 45e3 : 2e4,
      ...opts.keepalive ? {} : { signal: ctx.signal },
      ...opts
    });
    if (!result || result.ok !== true) throw new Error(description(result?.error ?? "服务没有返回可确认的结果。"));
    return result;
  }
  function apply(snapshot) {
    if (!snapshot || !Object.hasOwn(snapshot, "trip") || !snapshot.autonomy) {
      throw new Error("故事状态不完整，请重新读取实际进度。");
    }
    state.snapshot = snapshot;
    state.ready = true;
    state.autoplay = snapshot.autoplay === true;
    if (!snapshot.trip || snapshot.trip.state !== "active" || !snapshot.autonomy.enabled) state.autoAuthorized = false;
  }
  function identityPayload() {
    const current = trip();
    if (!current || current.stamp === void 0 || current.stamp === null) throw new Error("缺少行程版本，请先刷新进度。");
    return { tripId: current.id, stamp: current.stamp };
  }
  async function pause(reason = "", quiet = false) {
    invalidate();
    if (reason) state.notice = reason;
    state.autoRunning = false;
    const current = trip();
    const currentToken = token();
    if (!current || !currentToken) {
      emit();
      return;
    }
    if (pauseJob) {
      emit();
      return pauseJob;
    }
    const version = ++requestVersion;
    const job = (async () => {
      try {
        const snapshot = await call("pause", { tripId: current.id, token: currentToken }, { keepalive: true });
        if (alive() && version === requestVersion) apply(snapshot);
      } catch (error) {
        if (alive() && !quiet) state.error = `暂停未获确认：${description(error)} 请刷新核对。`;
      } finally {
        if (pauseJob === job) pauseJob = null;
        emit();
      }
    })();
    pauseJob = job;
    emit();
    return job;
  }
  function maybeResume() {
    if (!alive() || hidden() || !state.ready || state.recovering || !state.autoplay) return;
    if (modeJob || mutationJob || autoJob) return;
    const current = trip();
    if (!current || current.state !== "active" || current.step === "blocked" || current.actor === "owner") return;
    if (state.snapshot?.autonomy?.stop) {
      if (!state.notice) {
        state.notice = state.snapshot.autonomy.reason ?? "这一段已经走完，等你决定下一步。";
        emit();
      }
      return;
    }
    if (state.snapshot?.autonomy?.enabled && state.autoAuthorized) return;
    void setMode(true);
  }
  async function refresh({ initial = false } = {}) {
    if (!alive() || state.loading && !initial || mutationJob || modeJob) return;
    invalidate();
    const version = ++requestVersion;
    state.loading = true;
    state.error = "";
    state.reason = "";
    emit();
    try {
      const snapshot = await call("status");
      if (!alive() || version !== requestVersion) return;
      apply(snapshot);
      if (snapshot.autonomy.enabled) await pause("已读取真实进度。自主游玩已暂停，继续前请明确开启。");
      maybeResume();
    } catch (error) {
      if (alive() && version === requestVersion) {
        state.error = description(error);
        state.ready = false;
      }
    } finally {
      if (alive() && version === requestVersion || alive() && !state.autoAuthorized) {
        state.loading = false;
        emit();
      }
    }
  }
  async function recover(error) {
    invalidate();
    state.recovering = true;
    state.ready = false;
    state.error = `操作未获确认：${description(error)} 不会自动重试，正在核对实际进度。`;
    emit();
    await pause("", true);
    if (!alive()) return;
    const version = ++requestVersion;
    try {
      const snapshot = await call("status");
      if (!alive() || version !== requestVersion) return;
      apply(snapshot);
      if (snapshot.autonomy.enabled) await pause("自主游玩已暂停，请核对最新记录后再操作。");
      state.notice = "已重新读取实际进度；请核对发生过的事件，再决定下一步。";
    } catch (statusError) {
      if (alive()) state.error += ` 读取失败：${description(statusError)}`;
    } finally {
      state.recovering = false;
      emit();
    }
  }
  async function runAuto() {
    if (autoJob || !alive() || hidden() || !state.autoAuthorized) return;
    const epoch = generation;
    const job = (async () => {
      let steps = 0;
      while (alive() && !hidden() && state.autoAuthorized && generation === epoch) {
        const autonomy = state.snapshot?.autonomy;
        if (steps >= Math.min(60, Math.max(4, Number(autonomy?.limit?.steps) || 24))) {
          await pause("已到达本窗口的安全步数上限，请查看进度后继续。");
          break;
        }
        const current = trip();
        if (!current || current.state !== "active" || !autonomy?.enabled || !autonomy.token) break;
        if (autonomy.stop) {
          await pause(autonomy.reason ?? "这一段的额度用完了，接下来可以亲自继续。");
          break;
        }
        if (current.step === "blocked" || current.blocked) {
          await pause("当前行程暂时受阻，请查看提示后亲自处理。");
          break;
        }
        const identity = { generation, id: current.id, stamp: current.stamp, token: autonomy.token };
        state.autoRunning = true;
        state.busy = "鱼正在看一看";
        emit();
        try {
          let ticket;
          if (current.step === "choose") {
            state.busy = "鱼正在想一想";
            emit();
            const decision = await call("decide", { ...identityPayload(), token: identity.token });
            if (!same(identity)) break;
            if (decision.trip?.id !== identity.id || decision.trip?.stamp !== identity.stamp || decision.autonomy?.token !== identity.token || !decision.autonomy.enabled) {
              throw new Error("作决定期间实际进度或游玩模式已改变。");
            }
            if (!Object.hasOwn(decision, "ticket") || decision.ticket == null) throw new Error("没有收到可核验的决定凭证。");
            ticket = decision.ticket;
            state.reason = typeof decision.reason === "string" ? decision.reason : "";
            emit();
          }
          if (!same(identity)) break;
          state.busy = "正在确认这一步";
          emit();
          const snapshot = await call("auto", {
            tripId: identity.id,
            stamp: identity.stamp,
            token: identity.token,
            ...ticket === void 0 ? {} : { ticket }
          });
          if (!alive()) break;
          if (!same(identity)) {
            await recover("模式已改变，正在确认已提交动作的结果。");
            break;
          }
          apply(snapshot);
          steps += 1;
          emit();
          const next = trip();
          if (next?.actor === "owner") {
            invalidate();
            state.notice = "轮到你选择；选完鱼会接着走。";
            break;
          }
          if (next && next.id === identity.id && next.stamp === identity.stamp && state.snapshot.autonomy.enabled) {
            throw new Error("操作后行程版本没有变化，已停止继续推进。");
          }
          if (!next || next.state !== "active") {
            invalidate();
            state.notice = "这一趟已收好，可以去回忆里翻看。";
            break;
          }
          await pace();
          if (!alive() || hidden() || !state.autoAuthorized || generation !== epoch) break;
        } catch (error) {
          if (alive() && generation === identity.generation) await recover(error);
          break;
        } finally {
          state.autoRunning = false;
          if (!mutationJob && !modeJob) state.busy = "";
          emit();
        }
      }
    })();
    autoJob = job;
    try {
      await job;
    } finally {
      if (autoJob === job) autoJob = null;
      emit();
    }
  }
  async function setMode(enabled) {
    if (!enabled) {
      invalidate();
      state.autoRunning = false;
    }
    if (!alive() || modeJob || mutationJob || !state.ready || state.recovering) {
      emit();
      return;
    }
    const current = trip();
    if (!current || current.state !== "active") return;
    if (enabled && state.snapshot?.autonomy?.stop) {
      state.notice = state.snapshot.autonomy.reason ?? "这一段的额度用完了，可以先「再来一段」。";
      emit();
      return;
    }
    if (enabled && (!state.snapshot.autonomy.available || hidden() || autoJob)) return;
    const requestedGeneration = ++generation;
    state.autoAuthorized = false;
    state.error = "";
    state.notice = enabled ? "" : "已接管，未提交的自动决定已作废。";
    state.busy = enabled ? "正在开启自主游玩" : "正在关闭自主游玩";
    const job = (async () => {
      try {
        const snapshot = await call("mode", {
          ...identityPayload(),
          enabled,
          ...token() ? { token: token() } : {}
        });
        if (!alive() || generation !== requestedGeneration || hidden()) {
          if (snapshot.autonomy?.token && snapshot.trip) {
            await call("pause", { tripId: snapshot.trip.id, token: snapshot.autonomy.token }, { keepalive: true });
          }
          return;
        }
        ++requestVersion;
        apply(snapshot);
        state.autoAuthorized = enabled && snapshot.autonomy.enabled === true;
        if (enabled && !state.autoAuthorized) state.notice = snapshot.autonomy.reason ?? "自主游玩没有开启。";
      } catch (error) {
        if (alive()) await recover(error);
      } finally {
        if (modeJob === job) modeJob = null;
        state.busy = "";
        emit();
      }
    })();
    modeJob = job;
    emit();
    await job;
    if (state.autoAuthorized) void runAuto();
  }
  async function continueSegment() {
    if (!alive() || hidden() || !state.ready || state.recovering || state.busy || mutationJob || modeJob) return;
    const autonomy = state.snapshot?.autonomy;
    const free = trip()?.free;
    if (!autonomy?.canContinue && !free?.canContinue) return;
    invalidate();
    const operationGeneration = generation;
    state.error = "";
    state.notice = "";
    state.busy = "正在开新的一段";
    emit();
    const job = (async () => {
      try {
        const snapshot = await call("segment", { ...identityPayload(), confirm: true });
        if (!alive()) return;
        if (operationGeneration !== generation) {
          await recover("窗口状态已改变。");
          return;
        }
        ++requestVersion;
        apply(snapshot);
        const freeSegment = snapshot.trip?.free?.segment;
        state.notice = Number.isInteger(freeSegment) ? `第 ${freeSegment} 段：这一段又有 ${snapshot.trip?.free?.maxTurns} 回合。` : snapshot.autonomy?.segment ? `第 ${snapshot.autonomy.segment} 段：步数和决定次数都重新计。` : "已开新的一段。";
      } catch (error) {
        if (alive()) await recover(error);
      } finally {
        if (mutationJob === job) mutationJob = null;
        state.busy = "";
        emit();
      }
    })();
    mutationJob = job;
    emit();
    await job;
    if (state.autoplay && !state.recovering) await setMode(true);
  }
  async function substitute(optionId) {
    const current = trip();
    if (!current?.pending || current.step !== "choose" || !state.snapshot?.autonomy?.canSubstitute) return;
    return mutate("choose", { choiceId: current.pending.id, optionId, substitute: true, confirm: true });
  }
  async function fork(memoryId, checkpointId) {
    if (!alive() || !state.ready || trip() || state.busy || state.recovering || !memoryId || !checkpointId) return false;
    const forkToken = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
    state.error = "";
    state.notice = "";
    state.busy = "正在从检查点创建隔离分支";
    emit();
    try {
      const snapshot = await call("fork", { memoryId, checkpointId, forkToken });
      if (!alive()) return false;
      apply(snapshot);
      state.notice = "已从已验证检查点创建新 runId。源回忆与预算保留；此分支不写入正史探索、心愿或收藏。";
      return Boolean(snapshot?.trip);
    } catch (error) {
      if (alive()) state.error = description(error);
      return false;
    } finally {
      state.busy = "";
      emit();
    }
  }
  async function mutate(method, extra = {}) {
    if (!alive() || !state.ready || hidden() || state.loading || state.recovering || mutationJob || modeJob || state.autoAuthorized) return;
    invalidate();
    const operationGeneration = generation;
    state.error = "";
    state.notice = "";
    state.reason = "";
    state.busy = "正在保存";
    const job = (async () => {
      try {
        let payload = extra;
        if (["move", "resume", "close", "choose", "say", "rewind"].includes(method)) payload = { ...identityPayload(), ...extra };
        if (method === "start") payload = { ...extra, startStamp: state.snapshot.startStamp };
        const snapshot = await call(method, payload);
        if (!alive()) return;
        if (operationGeneration !== generation) {
          await recover("窗口状态已改变。");
          return;
        }
        ++requestVersion;
        apply(snapshot);
        state.notice = method === "close" ? "这趟经历已收进回忆。" : "";
        maybeResume();
      } catch (error) {
        if (alive()) await recover(error);
      } finally {
        if (mutationJob === job) mutationJob = null;
        state.busy = "";
        emit();
      }
    })();
    mutationJob = job;
    emit();
    return job;
  }
  let dmGeneration = 0;
  async function cancelDM(quiet = false) {
    ++dmGeneration;
    const current = trip();
    const version = requestVersion;
    const wasBusy = state.dmBusy;
    state.dmBusy = false;
    emit();
    if (!current || !wasBusy && !state.snapshot?.dm?.pending && !state.snapshot?.dm?.proposal && !quiet) return;
    try {
      const snapshot = await call("dmCancel", {}, { keepalive: true });
      if (alive() && version === requestVersion && trip()?.stamp === current.stamp) apply(snapshot);
    } catch (error) {
      if (alive() && !quiet) state.error = description(error);
    }
    emit();
  }
  async function proposeDM() {
    const current = trip();
    if (!alive() || hidden() || !state.ready || state.dmBusy || state.busy || state.autoAuthorized || state.snapshot?.autonomy?.enabled || !state.snapshot?.dm?.enabled || !state.snapshot?.dm?.available || current?.state !== "active" || current.step !== "choose") return;
    const identity = { ...identityPayload(), epoch: generation, dmEpoch: ++dmGeneration };
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}-${Math.random().toString(36).slice(2, 8)}`;
    state.dmBusy = true;
    state.error = "";
    emit();
    try {
      const snapshot = await call("dmPropose", { tripId: identity.tripId, stamp: identity.stamp, requestId });
      if (!alive() || hidden() || identity.epoch !== generation || identity.dmEpoch !== dmGeneration || trip()?.id !== identity.tripId || trip()?.stamp !== identity.stamp) return;
      apply(snapshot);
    } catch (error) {
      if (alive() && identity.epoch === generation && identity.dmEpoch === dmGeneration) state.error = description(error);
    } finally {
      if (identity.dmEpoch === dmGeneration) state.dmBusy = false;
      emit();
    }
  }
  async function applyDM() {
    const current = trip();
    const proposal = state.snapshot?.dm?.proposal;
    if (!proposal || proposal.stamp !== current?.stamp || current.actor === "fish") return;
    return mutate("choose", { choiceId: current.pending.id, optionId: proposal.optionId, dmProposalId: proposal.id });
  }
  const onHide = () => {
    if (hidden()) {
      void cancelDM(true);
      void pause("窗口已隐藏，自主游玩已暂停。");
    }
  };
  const onPageHide = () => {
    void cancelDM(true);
    void pause("窗口已离开，自主游玩已暂停。");
  };
  const onVisible = () => {
    if (!hidden() && alive()) void refresh();
  };
  function dispose() {
    if (!mounted) return;
    void cancelDM(true);
    void pause("", true);
    mounted = false;
    ++requestVersion;
    doc?.removeEventListener("visibilitychange", onHide);
    doc?.removeEventListener("visibilitychange", onVisible);
    win?.removeEventListener("pagehide", onPageHide);
    ctx.signal?.removeEventListener("abort", dispose);
  }
  doc?.addEventListener("visibilitychange", onHide);
  doc?.addEventListener("visibilitychange", onVisible);
  win?.addEventListener("pagehide", onPageHide);
  ctx.signal?.addEventListener("abort", dispose, { once: true });
  void refresh({ initial: true });
  return { state, refresh, mutate, setMode, pause, fork, continueSegment, substitute, proposeDM, cancelDM, applyDM, dispose };
}

// webui/story/resources.js
var RESOURCE_SLOTS = Object.freeze([
  { id: "home-day", title: "鱼的家", description: "家景 · 建议 16:9 横图" },
  { id: "creek-evening", title: "傍晚溪边", description: "地点与入场场景 · 建议 16:9 横图" },
  { id: "creek-letter-ending", title: "蓝绳与便笺", description: "样章结尾插画 · 建议 16:9 横图" }
]);
var MAX_IMAGE_BYTES = 2 * 1024 * 1024;
var MAX_IMAGE_PIXELS = 16 * 1024 * 1024;
var TYPES = /* @__PURE__ */ new Set(["image/png", "image/jpeg", "image/webp"]);
var PREFIX = "story-artwork-v1:";
function validateImageBytes(type, buffer) {
  if (!TYPES.has(type)) throw new Error("只接受 PNG、JPEG、WebP 图片，不支持 SVG 或 GIF。");
  if (!buffer || !buffer.byteLength || buffer.byteLength > MAX_IMAGE_BYTES) throw new Error("每张图片须大于 0 且不超过 2 MB。");
  const bytes2 = new Uint8Array(buffer);
  const match = type === "image/png" ? [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes2[index] === value) : type === "image/jpeg" ? bytes2[0] === 255 && bytes2[1] === 216 && bytes2[2] === 255 : String.fromCharCode(...bytes2.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes2.slice(8, 12)) === "WEBP";
  if (!match) throw new Error("图片内容与文件类型不一致，请重新选择原始图片。");
  return true;
}
function createArtworkStore(ctx, onChange = () => {
}) {
  const memory = /* @__PURE__ */ new Map();
  const invalid = /* @__PURE__ */ new Set();
  for (const slot of RESOURCE_SLOTS) {
    try {
      const saved = ctx.memo?.get(PREFIX + slot.id, null);
      if (typeof saved === "string" && saved.length <= MAX_IMAGE_BYTES * 1.4 + 100 && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(saved)) memory.set(slot.id, saved);
    } catch {
    }
  }
  const validSlot = (id) => RESOURCE_SLOTS.some((slot) => slot.id === id);
  return {
    get(id) {
      return !invalid.has(id) ? memory.get(id) ?? null : null;
    },
    markFailed(id) {
      invalid.add(id);
    },
    clear(id) {
      if (!validSlot(id)) return;
      memory.delete(id);
      invalid.delete(id);
      try {
        ctx.memo?.set(PREFIX + id, null);
      } catch {
      }
      onChange();
    },
    async import(id, file) {
      if (!validSlot(id)) throw new Error("未知的资源槽位。");
      if (!file || !TYPES.has(file.type)) throw new Error("请选择 PNG、JPEG 或 WebP 图片。");
      if (file.size <= 0 || file.size > MAX_IMAGE_BYTES) throw new Error("每张图片须大于 0 且不超过 2 MB。");
      const buffer = await file.arrayBuffer();
      validateImageBytes(file.type, buffer);
      if (ctx.signal?.aborted) return;
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        const abort = () => {
          reader.abort();
          reject(new Error("面板已关闭，已取消导入。"));
        };
        ctx.signal?.addEventListener("abort", abort, { once: true });
        reader.onload = () => {
          ctx.signal?.removeEventListener("abort", abort);
          resolve(reader.result);
        };
        reader.onerror = () => {
          ctx.signal?.removeEventListener("abort", abort);
          reject(new Error("无法读取这张图片。"));
        };
        reader.onabort = () => {
          ctx.signal?.removeEventListener("abort", abort);
          reject(new Error("图片读取已取消。"));
        };
        reader.readAsDataURL(file);
      });
      const dimensions = await new Promise((resolve, reject) => {
        const image = new Image();
        const abort = () => {
          image.src = "";
          reject(new Error("面板已关闭，已取消导入。"));
        };
        const cleanup = () => {
          image.onload = null;
          image.onerror = null;
          ctx.signal?.removeEventListener("abort", abort);
        };
        ctx.signal?.addEventListener("abort", abort, { once: true });
        image.onload = () => {
          const size = { width: image.naturalWidth, height: image.naturalHeight };
          cleanup();
          resolve(size);
        };
        image.onerror = () => {
          cleanup();
          reject(new Error("无法解码这张图片，请更换文件。"));
        };
        image.src = dataUrl;
      });
      if (ctx.signal?.aborted) return;
      if (!dimensions.width || !dimensions.height || dimensions.width * dimensions.height > MAX_IMAGE_PIXELS) throw new Error("图片像素过大，请缩小到 1600 万像素以内。");
      memory.set(id, dataUrl);
      invalid.delete(id);
      let persistent = Boolean(ctx.memo);
      try {
        ctx.memo?.set(PREFIX + id, dataUrl);
      } catch {
        persistent = false;
      }
      onChange();
      return { persistent };
    }
  };
}

// webui/story/artwork.js
var PATHS = {
  fish: '<path d="M16 7c-5-5-10-2-13 3 3 5 8 8 13 3l5 4V3z"/><circle cx="7.5" cy="9" r=".6" fill="currentColor"/>',
  home: '<path d="m3 10 9-7 9 7M5 9v12h14V9M9 21v-7h6v7"/>',
  leaf: '<path d="M20 3C7 2 2 9 6 15s13 4 14-12ZM4 21 16 9"/>',
  book: '<path d="M3 4h6a4 4 0 0 1 3 2 4 4 0 0 1 3-2h6v15h-6a4 4 0 0 0-3 2 4 4 0 0 0-3-2H3ZM12 6v15"/>',
  settings: '<path d="m14 3 1 3 3 1 3-1 1 4-2 2 1 3-2 3-3-1-2 2-4-1-1-3-3-1-1-4 2-2V5l4-1z"/><circle cx="12" cy="11" r="3"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5M6 6a8 8 0 0 1 13 3M5 15a8 8 0 0 0 13 3"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z"/><circle cx="12" cy="10" r="2.5"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  check: '<path d="m5 12 4 4L20 5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 10v7m0-11v1"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 17 5-5 4 4 4-6 5 7"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
  spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5Z"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  chevron: '<path d="m9 5 7 7-7 7"/>'
};
function icon(name) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.5");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  svg.innerHTML = PATHS[name] ?? PATHS.leaf;
  return svg;
}
var serial = 0;
function illustration(kind = "home") {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const id = `sw-art-${++serial}`;
  svg.setAttribute("class", "sw-illustration");
  svg.setAttribute("viewBox", "0 0 800 400");
  svg.setAttribute("preserveAspectRatio", "xMidYMid slice");
  svg.setAttribute("aria-hidden", "true");
  if (kind === "home") svg.innerHTML = `
    <defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#dce8dc"/><stop offset="1" stop-color="#c8d8c7"/></linearGradient><linearGradient id="${id}-floor" x2="0" y2="1"><stop stop-color="#b8c9b1"/><stop offset="1" stop-color="#8da991"/></linearGradient></defs>
    <path fill="#e6eadd" d="M0 0h800v400H0z"/><path fill="#dce3d2" d="M0 0h219v275H0z"/>
    <path fill="url(#${id}-floor)" d="M0 273h800v127H0z"/><path fill="#aabb9e" opacity=".35" d="m442 272 241 128h117V274z"/>
    <rect x="260" y="28" width="262" height="211" rx="2" fill="#9cb09c"/><rect x="268" y="35" width="246" height="195" fill="url(#${id}-sky)"/>
    <circle cx="445" cy="83" r="29" fill="#f7f0ce"/><path d="M268 162q45-65 90-21t79-5 77 9v85H268" fill="#93b29a" opacity=".6"/><path d="M268 196q56-38 108-4t138-20v58H268" fill="#739d89" opacity=".45"/>
    <path d="M390 35v195M268 130h246" fill="none" stroke="#e6ebdc" stroke-width="9"/><path fill="#cbd7bd" d="M243 15h38v240h-40q24-100 2-240m267 0h35v240h-35q-18-120 0-240"/><path d="M238 17h313" stroke="#899d81" stroke-width="5"/>
    <rect x="47" y="179" width="153" height="109" rx="5" fill="#aebf9f"/><rect x="56" y="193" width="135" height="42" fill="#ced7bb"/><path d="M98 193v42m48-42v42M56 246h135" stroke="#8fa27e" stroke-width="3"/><path d="M66 194v37m8-39v39m9-35v35m28-38v38m8-39v39m9-34v34m29-38 8 38m4-36 8 36" stroke="#8a9d7b" stroke-width="6"/>
    <rect x="72" y="70" width="81" height="73" fill="#bccbad"/><rect x="79" y="77" width="67" height="59" fill="#edf0df"/><path d="m90 123 13-31 12 31m-4-8 13-27 13 35" stroke="#96ad8e" stroke-width="3" fill="none"/>
    <ellipse cx="462" cy="344" rx="181" ry="40" fill="#a4b89b" opacity=".75"/><path d="M554 191h119v89H554z" fill="#819f89"/><rect x="495" y="214" width="186" height="85" rx="18" fill="#94ad91"/><rect x="484" y="231" width="33" height="70" rx="12" fill="#789b82"/><rect x="661" y="231" width="30" height="70" rx="12" fill="#789b82"/><path d="M517 258h143" stroke="#658b73" stroke-width="2"/><rect x="537" y="220" width="48" height="35" rx="7" fill="#cbd6b4" transform="rotate(-8 537 220)"/><path d="M506 300v12m163-12v12" stroke="#65836b" stroke-width="6"/>
    <ellipse cx="432" cy="291" rx="67" ry="17" fill="#b6c4a0"/><path d="M379 292v44m105-44v44" stroke="#819674" stroke-width="6"/><path d="M420 286h24v-8h-24z" fill="#e6e4c7"/><path d="M442 279q12-1 8 8h-8" stroke="#e6e4c7" fill="none" stroke-width="3"/><path d="m392 285 13-10 17 6-13 10z" fill="#d4d8b7"/>
    <path d="M733 275v-86m0 40q-31-31-27-44 28 3 27 35m0-14q10-37 29-39 7 24-29 46m-1-7q-22-24-16-42 21 7 17 36" stroke="#6a926f" stroke-width="4" fill="#86a17a"/><path d="M714 260h39l-7 38h-25z" fill="#a8b28b"/>
    <path d="M0 274h800" stroke="#78946f" stroke-opacity=".25"/><path d="m92 322 42 78m162-127 12 127m300-127-39 127" stroke="#668d72" stroke-opacity=".13"/>`;
  else svg.innerHTML = `
    <defs><linearGradient id="${id}-sky" x2="0" y2="1"><stop stop-color="#e7e0bf"/><stop offset="1" stop-color="#c1d4bc"/></linearGradient><linearGradient id="${id}-river" x2="0" y2="1"><stop stop-color="#9dbfb4"/><stop offset="1" stop-color="#719e94"/></linearGradient></defs>
    <path fill="url(#${id}-sky)" d="M0 0h800v400H0z"/><circle cx="584" cy="91" r="39" fill="#faf0c6"/>
    <path d="M0 159Q115 55 237 144T478 136 800 133v267H0" fill="#adc2a5"/><path d="M0 214Q128 127 268 192t261-12 271 31v189H0" fill="#86a98e"/>
    <path d="M407 202q-98 60-46 89t-89 109h331q-69-57-126-89t15-109" fill="url(#${id}-river)"/>
    <path d="M0 272q129-71 361-6-106 45-89 134H0" fill="#698f76"/><path d="M490 243q139-38 310 12v145H603q-30-56-122-97-52-20 9-60" fill="#75987a"/>
    <path d="m229 268 309-17 4 21-315 19z" fill="#9eaa86"/><path d="m237 264 299-17" stroke="#c5c7a0" stroke-width="7"/><path d="m252 258-2-49m85 44v-48m89 43-1-48m93 44-1-48m-269 28 273-17" stroke="#6e8065" fill="none" stroke-width="7"/><path d="m259 285-1 40m251-54 4 36" stroke="#6a7e62" stroke-width="11"/>
    <path d="m394 326 38-1m-60 15 81-2m-116 31 111-2m-59 16 76-2m17-86 28-1" stroke="#d8e2c4" stroke-width="2" stroke-linecap="round" opacity=".55"/>
    <g stroke="#4c7961" stroke-width="3" fill="none"><path d="m78 338 3-101m-4 54-24-31m29 14 23-36m-5 103 16-79m-2 29 22-17m-2 87 14-110m-3 47-17-18m508 84-5-93m4 51 26-33m-5 83 14-119m-7 52 28-28m4 91 2-71m-1 33 23-17"/></g>
    <g fill="#acc0a0"><ellipse cx="79" cy="234" rx="4" ry="12"/><ellipse cx="106" cy="237" rx="4" ry="12" transform="rotate(35 106 237)"/><ellipse cx="147" cy="248" rx="4" ry="12"/><ellipse cx="673" cy="238" rx="4" ry="13"/></g>
    ${kind === "ending" ? '<path d="m564 306 68-8 5 42-68 8z" fill="#e8e4c5"/><path d="m576 317 42-5m-41 13 32-4" stroke="#9ca68c" stroke-width="2"/><path d="M566 327q-23-12-15-33t-6-24" stroke="#557fa1" stroke-width="5" fill="none"/>' : '<path d="m326 298 14-5 9 25-14 5z" fill="#c7ddd2" stroke="#83ab9a" stroke-width="2" transform="rotate(18 336 308)"/><path d="m332 302 8-2 3 12-8 3z" fill="#e5e3c7"/>'}
    <path d="M0 383q141-15 229 17H0m628 0q113-46 172-26v26" fill="#507d65" opacity=".65"/>`;
  return svg;
}

// webui/story/styles.js
var STYLES = `
.sw{--sw-ink:var(--foreground,#243b38);--sw-muted:var(--muted-foreground,#6a7c76);--sw-line:var(--border,#dfe6df);--sw-paper:var(--surface,#fffefa);--sw-base:var(--background,#f6f7f0);--sw-green:var(--accent,#397568);--sw-soft:color-mix(in srgb,var(--sw-green) 7%,var(--sw-paper));--sw-warm:#b1844b;--sw-error:#b34a45;container-type:inline-size;color:var(--sw-ink);font:14px/1.7 var(--sans,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);max-width:1320px;margin:0 auto;padding:12px 10px 28px;isolation:isolate}
.sw *{box-sizing:border-box}.sw [hidden]{display:none!important}.sw h1,.sw h2,.sw h3,.sw h4,.sw p{margin:0}.sw h2{font-size:20px;font-weight:650;letter-spacing:.02em;line-height:1.5}.sw h3{font-size:16px;font-weight:650}.sw h4{font-size:14px}.sw p{overflow-wrap:anywhere}.sw button,.sw input{font:inherit}.sw button{cursor:pointer}.sw button:disabled{cursor:default;opacity:.5}.sw button:focus-visible,.sw input:focus-visible,.sw summary:focus-visible{outline:3px solid color-mix(in srgb,var(--sw-green) 65%,white);outline-offset:3px}.sw small{font-size:12px}.sw svg{display:block;width:20px;height:20px;flex:none}.sw-muted{color:var(--sw-muted)}.sw-kicker{font-size:11px;font-weight:650;letter-spacing:.16em;color:var(--sw-muted)}.sw-top{display:flex;justify-content:space-between;gap:12px;align-items:center;margin:4px 0 19px}.sw-brand{display:flex;gap:10px;align-items:center}.sw-logo{width:36px;height:36px;background:var(--sw-soft);border:1px solid var(--sw-line);border-radius:12px;display:grid;place-items:center;color:var(--sw-green)}.sw-brand strong{display:block;font-size:16px;letter-spacing:.04em;line-height:1.5}.sw-brand small{display:block;color:var(--sw-muted);font-size:11px}.sw-top-actions{display:flex;align-items:center;gap:10px}.sw-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--sw-green);margin-right:6px}.sw-tabs{display:flex;border-bottom:1px solid var(--sw-line);margin-bottom:22px;gap:22px;overflow:auto;scrollbar-width:none}.sw-tab{border:0;border-bottom:2px solid transparent;background:none;color:var(--sw-muted);display:flex;gap:6px;align-items:center;padding:7px 1px 12px;white-space:nowrap;font-size:13px}.sw-tab svg{width:16px;height:16px}.sw-tab[aria-current=page]{border-bottom-color:var(--sw-green);color:var(--sw-ink);font-weight:650}.sw-count{background:var(--sw-soft);color:var(--sw-muted);border-radius:5px;padding:0 5px;font-size:10px;margin-left:1px}
.sw-btn{border:1px solid var(--sw-line);color:var(--sw-ink);background:var(--sw-paper);border-radius:9px;min-height:39px;padding:7px 13px;display:inline-flex;justify-content:center;align-items:center;gap:7px;font-size:12px;font-weight:550;transition:border-color .15s,background .15s;white-space:normal;text-align:center}.sw-btn svg{width:16px;height:16px}.sw-btn:hover:not(:disabled){border-color:var(--sw-green);background:var(--sw-soft)}.sw-btn-primary{background:var(--sw-green);border-color:var(--sw-green);color:var(--accent-foreground,#fff)}.sw-btn-primary:hover:not(:disabled){background:color-mix(in srgb,var(--sw-green) 88%,black);color:var(--accent-foreground,#fff)}.sw-btn-quiet{background:transparent;border-color:transparent;color:var(--sw-muted)}.sw-btn-small{font-size:11px;padding:4px 9px;min-height:30px}.sw-btn-danger{color:var(--sw-error)}.sw-actions{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.sw-text-link{color:var(--sw-green);background:none;border:0;padding:0;font:inherit;font-size:12px;cursor:pointer}.sw-badge{display:inline-flex;align-items:center;gap:5px;max-width:100%;border-radius:5px;padding:2px 7px;font-size:10px;letter-spacing:.02em;line-height:1.7;background:var(--sw-soft);color:var(--sw-green);border:1px solid color-mix(in srgb,var(--sw-green) 14%,var(--sw-line));overflow-wrap:anywhere}.sw-badge-warm{background:color-mix(in srgb,var(--sw-warm) 9%,var(--sw-paper));color:var(--sw-warm);border-color:color-mix(in srgb,var(--sw-warm) 15%,var(--sw-line))}.sw-section-head{display:flex;justify-content:space-between;gap:12px;align-items:baseline;margin-bottom:12px}.sw-section-head h3{font-size:14px}.sw-section-head p{font-size:11px;color:var(--sw-muted)}.sw-lead{margin:0 0 20px}.sw-lead p{font-size:12px;color:var(--sw-muted);margin-top:4px}.sw-grid{display:grid;grid-template-columns:minmax(0,1fr) 250px;gap:20px}.sw-stack{display:flex;flex-direction:column;gap:20px;min-width:0}.sw-card{background:var(--sw-paper);border:1px solid var(--sw-line);border-radius:13px;overflow:hidden;min-width:0}.sw-card-pad{padding:18px}.sw-card p+p{margin-top:8px}.sw-card-note{font-size:12px;color:var(--sw-muted);line-height:1.8}.sw-card-title{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px}.sw-card-title svg{color:var(--sw-green)}.sw-divider{border:0;border-top:1px solid var(--sw-line);margin:15px 0}.sw-empty{padding:30px 18px;text-align:center;border:1px dashed var(--sw-line);border-radius:12px;background:var(--sw-soft);color:var(--sw-muted)}.sw-empty svg{margin:0 auto 10px;width:29px;height:29px;opacity:.7}.sw-empty strong{display:block;color:var(--sw-ink);font-size:14px;margin-bottom:5px}.sw-empty p{font-size:12px}.sw-empty .sw-actions{justify-content:center;margin-top:13px}
.sw-scene{position:relative;min-height:235px;aspect-ratio:2/1;overflow:hidden;background:#e6ece1;color:#365950}.sw-scene svg.sw-illustration{position:absolute;inset:0;width:100%;height:100%;opacity:.9}.sw-scene>img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}.sw-scene:after{content:'';position:absolute;inset:35% 0 0;background:linear-gradient(transparent,rgba(23,51,44,.55));pointer-events:none}.sw-scene-label{position:absolute;z-index:1;bottom:20px;left:22px;right:22px;color:#fff}.sw-scene-label .sw-kicker{color:rgba(255,255,255,.78);font-size:10px}.sw-scene-label h2{font-size:27px;letter-spacing:.09em;margin:3px 0}.sw-scene-label p{font-size:12px;max-width:440px;color:rgba(255,255,255,.92)}.sw-scene-tag{position:absolute;top:15px;left:17px;z-index:1;backdrop-filter:blur(8px);background:rgba(255,255,255,.78);border:1px solid rgba(255,255,255,.6);padding:3px 9px;border-radius:99px;font-size:10px;color:#365950}.sw-scene-tag:before{content:'';display:inline-block;background:#639b70;width:5px;height:5px;border-radius:50%;margin-right:5px}.sw-scene-art-note{position:absolute;z-index:1;right:13px;top:15px;color:#365950;background:rgba(255,255,255,.65);border-radius:4px;padding:2px 6px;font-size:9px}.sw-home-caption{padding:17px 21px;display:flex;justify-content:space-between;align-items:center;gap:15px}.sw-home-caption strong{display:block;font-size:14px;margin-bottom:3px}.sw-home-caption p{font-size:12px;color:var(--sw-muted)}.sw-quotation{padding:17px 20px;background:var(--sw-soft);border-left:2px solid color-mix(in srgb,var(--sw-green) 40%,transparent);font-size:13px;line-height:1.9;color:var(--sw-ink)}.sw-quotation:before{content:'“';font:32px Georgia,serif;display:block;height:22px;color:var(--sw-green);opacity:.55}.sw-quotation small{display:block;margin-top:9px;font-size:10px;letter-spacing:.05em;color:var(--sw-muted)}.sw-stat-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;padding-top:3px}.sw-stat-row strong{display:block;font-size:23px;font-weight:500;font-variant-numeric:tabular-nums;line-height:1.3}.sw-stat-row span{font-size:11px;color:var(--sw-muted)}.sw-side-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:650;margin-bottom:11px}.sw-side-title svg{width:15px;height:15px;color:var(--sw-green)}.sw-status{font-size:11px;color:var(--sw-muted);display:flex;align-items:center;gap:4px}.sw-status svg{width:13px;height:13px}.sw-story-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(280px,100%),1fr));gap:15px}.sw-story-card .sw-scene{aspect-ratio:2.5/1;min-height:150px}.sw-story-card .sw-scene-label{bottom:15px;left:17px}.sw-story-card .sw-scene-label h2{font-size:20px}.sw-story-info{padding:18px}.sw-story-info h3{font-size:17px;margin:6px 0 7px}.sw-story-info>p{font-size:12px;color:var(--sw-muted);min-height:42px}.sw-story-meta{display:flex;gap:6px;flex-wrap:wrap;margin:12px 0}.sw-story-footer{padding-top:14px;border-top:1px solid var(--sw-line);display:flex;align-items:center;justify-content:space-between;gap:10px}.sw-story-footer small{color:var(--sw-muted);font-size:10px}.sw-preset{display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--sw-muted);margin-top:14px;cursor:pointer}.sw-preset input{accent-color:var(--sw-green);margin-top:5px}.sw-details>summary{cursor:pointer;font-size:12px;color:var(--sw-muted);padding:9px 0}.sw-details[open]>summary{margin-bottom:6px}.sw-note{font-size:11px;color:var(--sw-muted);margin-top:9px;line-height:1.8}.sw-notice{display:flex;gap:10px;align-items:flex-start;border:1px solid var(--sw-line);background:var(--sw-soft);border-radius:10px;padding:11px 13px;margin-bottom:15px;font-size:12px}.sw-notice svg{width:16px;height:16px;margin-top:3px;color:var(--sw-green)}.sw-notice p{flex:1;white-space:pre-wrap}.sw-notice-error{background:color-mix(in srgb,var(--sw-error) 5%,var(--sw-paper));border-color:color-mix(in srgb,var(--sw-error) 28%,var(--sw-line));color:var(--sw-error)}.sw-notice-error svg{color:var(--sw-error)}.sw-notice .sw-btn{flex:none}.sw-loader{height:4px;border-radius:5px;background:linear-gradient(90deg,var(--sw-soft),var(--sw-green),var(--sw-soft));background-size:200% 100%;animation:sw-loading 1.7s linear infinite;margin-bottom:18px;opacity:.55}@keyframes sw-loading{to{background-position:-200% 0}}
.sw-play-head{padding:19px 22px 16px;display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.sw-play-head h2{font-size:20px;margin-top:4px}.sw-play-scene{border-radius:0;min-height:200px;aspect-ratio:2.65/1}.sw-reading{padding:24px}.sw-reading .sw-kicker{margin-bottom:9px}.sw-reading h3{font-size:18px;margin-bottom:12px}.sw-prose{font-size:14px;line-height:2;white-space:pre-wrap;overflow-wrap:anywhere;max-width:70ch}.sw-event-history{padding:0;list-style:none;margin:0}.sw-event-history li+li{border-top:1px dashed var(--sw-line);padding-top:14px;margin-top:14px}.sw-prompt{padding-top:17px;margin-top:17px;border-top:1px solid var(--sw-line)}.sw-choices{display:grid;gap:9px;margin-top:17px}.sw-choice{width:100%;border:1px solid var(--sw-line);border-radius:10px;background:var(--sw-paper);color:var(--sw-ink);padding:13px 15px;display:flex;align-items:center;gap:12px;text-align:left;line-height:1.7;transition:border-color .15s,background .15s}.sw-choice:hover:not(:disabled){background:var(--sw-soft);border-color:var(--sw-green)}.sw-choice-index{width:24px;height:24px;border:1px solid var(--sw-line);border-radius:7px;display:grid;place-items:center;font:11px Georgia,serif;color:var(--sw-muted);flex:none}.sw-choice>span:nth-child(2){flex:1;overflow-wrap:anywhere}.sw-choice svg{width:15px;height:15px;color:var(--sw-muted)}.sw-play-foot{padding:16px 23px;border-top:1px solid var(--sw-line);background:var(--sw-soft);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.sw-mode{display:flex;justify-content:space-between;gap:12px;align-items:center}.sw-mode strong{font-size:13px;display:block}.sw-mode small{font-size:10px;color:var(--sw-muted);display:block;margin-top:2px}.sw-switch{flex:none;position:relative;width:38px;height:22px;border:1px solid var(--sw-line);border-radius:99px;background:color-mix(in srgb,var(--sw-muted) 20%,var(--sw-paper));padding:0;transition:background .15s}.sw-switch:after{content:'';position:absolute;width:16px;height:16px;top:2px;left:3px;background:white;border-radius:50%;box-shadow:0 1px 3px #0002;transition:transform .15s}.sw-switch[aria-checked=true]{background:var(--sw-green);border-color:var(--sw-green)}.sw-switch[aria-checked=true]:after{transform:translateX(15px)}.sw-budget{display:flex;justify-content:space-between;font-size:11px;color:var(--sw-muted);border-top:1px solid var(--sw-line);padding-top:11px;margin-top:12px}.sw-budget b{font-weight:550;color:var(--sw-ink)}.sw-reason{font-size:12px;line-height:1.9;margin-top:13px;padding:11px 12px;border-radius:8px;background:var(--sw-soft)}.sw-route{list-style:none;padding:0;margin:13px 0 0}.sw-route li{position:relative;border-left:1px solid var(--sw-line);padding:0 0 16px 17px;font-size:12px;line-height:1.7;overflow-wrap:anywhere}.sw-route li:last-child{padding-bottom:0;border-left-color:transparent}.sw-route li:before{content:'';position:absolute;left:-4px;top:6px;width:7px;height:7px;border:1px solid color-mix(in srgb,var(--sw-green) 60%,var(--sw-line));border-radius:50%;background:var(--sw-paper)}.sw-route li:last-child:before{background:var(--sw-green);border-color:var(--sw-green)}.sw-route small{display:block;color:var(--sw-muted);font-size:10px;margin-bottom:2px}.sw-route p{white-space:pre-wrap}.sw-choice-record{border-radius:8px;background:var(--sw-soft);padding:12px;margin-top:10px;font-size:12px;white-space:pre-wrap;overflow-wrap:anywhere}.sw-choice-record strong{font-size:12px}.sw-choice-record small{display:block;color:var(--sw-muted);font-size:10px;margin-top:5px}.sw-memory-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(285px,100%),1fr));gap:15px;align-items:start}.sw-memory{position:relative;overflow:hidden}.sw-memory:before{content:'';display:block;height:4px;background:color-mix(in srgb,var(--sw-green) 50%,var(--sw-paper))}.sw-memory>.sw-card-pad{padding:18px 19px}.sw-memory h3{font-size:16px;margin:9px 0 5px}.sw-memory-date{font-size:10px;color:var(--sw-muted);letter-spacing:.02em;margin-top:10px}.sw-memory-place{font-size:11px;color:var(--sw-muted)}.sw-memory-preview{font-size:12px;color:var(--sw-muted);margin:11px 0!important;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}.sw-memory-details{margin-top:11px;border-top:1px dashed var(--sw-line);padding-top:4px}.sw-memory-details>summary{display:flex;gap:7px;align-items:center;list-style:none;color:var(--sw-green)}.sw-memory-details>summary::-webkit-details-marker{display:none}.sw-memory-details>summary svg{width:13px;height:13px;transition:transform .15s}.sw-memory-details[open]>summary svg{transform:rotate(90deg)}.sw-memory-details .sw-route{margin-top:7px}.sw-memory-details .sw-route li{font-size:12px}.sw-filter{display:flex;gap:6px;margin-bottom:17px;flex-wrap:wrap}.sw-filter button{border-radius:99px;font-size:11px;min-height:31px;padding:4px 12px}.sw-filter button[aria-pressed=true]{background:var(--sw-soft);border-color:var(--sw-green);color:var(--sw-green)}.sw-settings-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(250px,100%),1fr));gap:14px}.sw-resource .sw-scene{min-height:130px;aspect-ratio:2/1}.sw-resource .sw-scene-label{left:15px;bottom:12px}.sw-resource .sw-scene-label h2{font-size:17px}.sw-resource .sw-kicker{font-size:9px}.sw-resource .sw-card-pad{padding:15px}.sw-resource code{font:10px ui-monospace,SFMono-Regular,Consolas,monospace;letter-spacing:.01em;color:var(--sw-muted);overflow-wrap:anywhere}.sw-resource .sw-actions{margin-top:12px}.sw-resource p{font-size:11px;color:var(--sw-muted);margin-top:5px}.sw-bottom-note{text-align:center;font-size:10px;color:var(--sw-muted);margin-top:24px;padding-top:15px;border-top:1px solid var(--sw-line);letter-spacing:.04em}.sw-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap}.sw-main{min-width:0}.sw [aria-busy=true]{cursor:progress}
@container (max-width:820px){.sw-grid{grid-template-columns:minmax(0,1fr) 215px;gap:14px}.sw-reading{padding:20px}.sw-card-pad{padding:15px}.sw-scene{min-height:215px}}
@container (max-width:650px){.sw-grid{grid-template-columns:1fr}.sw-stack.sw-aside{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(245px,100%),1fr));gap:14px}.sw-scene{min-height:210px}.sw-top{margin-bottom:15px}.sw-tabs{gap:19px;margin-bottom:18px}.sw-top-actions .sw-status{display:none}.sw-play-head{padding:16px 18px}.sw-reading{padding:19px}.sw-play-foot{padding:14px 18px}.sw-home-caption{padding:15px 17px}.sw-side-secondary{display:none}}
@container (max-width:400px){.sw-tabs{gap:0;justify-content:space-between}.sw-tab{font-size:12px;padding-bottom:10px;gap:4px}.sw-tab svg{width:14px;height:14px}.sw-brand strong{font-size:14px}.sw-brand small{font-size:10px}.sw-logo{width:32px;height:32px}.sw-top-actions{gap:1px}.sw-top-actions .sw-btn{padding:4px 7px}.sw-home-caption{align-items:flex-start;flex-direction:column}.sw-home-caption .sw-btn{width:100%}.sw-scene{min-height:205px}.sw-scene-label{left:18px;right:18px}.sw-scene-label h2{font-size:24px}.sw-scene-label p{font-size:11px}.sw-notice{flex-wrap:wrap}.sw-notice .sw-btn{margin-left:25px}.sw-story-footer{align-items:flex-start}.sw-memory>.sw-card-pad{padding:16px}.sw-play-head .sw-badge{font-size:9px}.sw-reading{padding:17px}.sw-play-foot .sw-actions{width:100%}.sw-play-foot .sw-actions .sw-btn{flex:1}}
.sw-private-settings{min-width:0}.sw-settings-stack{display:flex;flex-direction:column;gap:16px;min-width:0}.sw-private-settings-card,.sw-settings-image-card{min-width:0}.sw-private-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(230px,100%),1fr));gap:12px}.sw-setting-field{display:flex;flex-direction:column;gap:5px;min-width:0;font-size:12px;margin:10px 0}.sw-setting-field input,.sw-delegation{display:block;min-width:0;width:100%;max-width:100%;padding:8px 10px;border:1px solid var(--sw-line);border-radius:8px;background:var(--sw-paper);color:var(--sw-ink);font:inherit}.sw-private-settings-card .sw-actions{margin-top:12px}.sw-private-settings h3{margin-top:20px}.sw-settings-error{color:var(--sw-error);font-size:12px;overflow-wrap:anywhere}.sw-generated-image{display:block;max-width:100%;height:auto;border-radius:10px;margin-top:12px}.sw-delegation{font:12px/1.6 ui-monospace,Consolas,monospace;resize:vertical;margin-top:10px}.sw-authoring-view{min-width:0;width:100%}.sw-main{min-width:0}.sw-tab{flex-shrink:0}.sw-image-result{min-width:0}.sw-tabs{max-width:100%}.sw-settings-card-head,.sw-settings-subhead{display:flex;justify-content:space-between;align-items:center;gap:12px;min-width:0;padding-bottom:12px;border-bottom:1px solid var(--sw-line);margin-bottom:14px}.sw-settings-card-title{display:flex;align-items:center;gap:10px;min-width:0}.sw-settings-card-title>svg{color:var(--sw-green)}.sw-settings-card-title h3,.sw-settings-subhead h3{font-size:15px;line-height:1.4}.sw-card-summary{color:var(--sw-muted);font-size:12px;line-height:1.55;margin-top:3px}.sw-settings-subhead{margin-top:20px;padding-bottom:8px;margin-bottom:10px}.sw-settings-help{margin:8px 0 12px;border:1px solid color-mix(in srgb,var(--sw-line) 80%,transparent);border-radius:9px;background:var(--sw-soft);overflow:hidden}.sw-settings-help>summary{cursor:pointer;list-style:none;padding:7px 10px;color:var(--sw-green);font-size:11.5px;font-weight:600}.sw-settings-help>summary::-webkit-details-marker{display:none}.sw-settings-help>summary:before{content:'ⓘ';margin-right:7px}.sw-settings-help[open]>.sw-note{margin:0;padding:0 10px 10px;line-height:1.65}.sw-settings-actions{position:sticky;bottom:8px;z-index:4;padding:9px;border:1px solid var(--sw-line);border-radius:10px;background:color-mix(in srgb,var(--sw-paper) 94%,transparent);backdrop-filter:blur(10px);box-shadow:0 6px 18px color-mix(in srgb,var(--sw-ink) 12%,transparent)}.sw-settings-actions .sw-actions{margin:0}.sw-private-settings .sw-setting-field{margin:7px 0}.sw-private-settings .sw-setting-field input{height:36px;padding:7px 10px;border-radius:8px}.sw-settings-error{padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--sw-error) 8%,var(--sw-paper))}.sw-settings-card-head .sw-badge{white-space:nowrap}@media(max-width:520px){.sw-settings-card-head,.sw-settings-subhead{align-items:flex-start}.sw-settings-card-head{gap:8px}.sw-settings-card-title{align-items:flex-start}.sw-settings-actions{bottom:4px;padding:7px}.sw-settings-actions .sw-actions{gap:6px}.sw-settings-actions .sw-btn{flex:1;min-width:0;padding-inline:7px;font-size:11px}.sw-private-grid{gap:6px}}
.sw-settings-card-head,.sw-settings-subhead{display:flex;justify-content:space-between;align-items:center;gap:12px;min-width:0;padding-bottom:12px;border-bottom:1px solid var(--sw-line);margin-bottom:14px}.sw-settings-card-title{display:flex;align-items:center;gap:10px;min-width:0}.sw-settings-card-title>svg{color:var(--sw-green)}.sw-settings-card-title h3,.sw-settings-subhead h3{font-size:15px;line-height:1.4}.sw-card-summary{color:var(--sw-muted);font-size:12px;line-height:1.55;margin-top:3px}.sw-settings-subhead{margin-top:20px;padding-bottom:8px;margin-bottom:10px}.sw-settings-state{flex:none}.sw-settings-state-on{color:var(--sw-green)}.sw-settings-help{margin:8px 0 12px;border:1px solid color-mix(in srgb,var(--sw-line) 80%,transparent);border-radius:9px;background:var(--sw-soft);overflow:hidden}.sw-settings-help>summary{cursor:pointer;list-style:none;padding:7px 10px;color:var(--sw-green);font-size:11.5px;font-weight:600}.sw-settings-help>summary::-webkit-details-marker{display:none}.sw-settings-help>summary:before{content:'ⓘ';margin-right:7px}.sw-settings-help[open]>.sw-note{margin:0;padding:0 10px 10px;line-height:1.65}.sw-settings-actions{position:sticky;bottom:8px;z-index:4;padding:9px;border:1px solid var(--sw-line);border-radius:10px;background:color-mix(in srgb,var(--sw-paper) 94%,transparent);backdrop-filter:blur(10px);box-shadow:0 6px 18px color-mix(in srgb,var(--sw-ink) 12%,transparent)}.sw-settings-actions .sw-actions{margin:0}.sw-private-settings .sw-setting-field{margin:7px 0}.sw-private-settings .sw-setting-field input{height:36px;padding:7px 10px;border-radius:8px}.sw-settings-error{padding:8px 10px;border-radius:8px;background:color-mix(in srgb,var(--sw-error) 8%,var(--sw-paper))}.sw-settings-card-head .sw-badge{white-space:nowrap}
@media (max-width:520px){.sw-settings-card-head,.sw-settings-subhead{align-items:flex-start}.sw-settings-card-head{gap:8px}.sw-settings-card-title{align-items:flex-start}.sw-settings-actions{bottom:4px;padding:7px}.sw-settings-actions .sw-actions{gap:6px}.sw-settings-actions .sw-btn{flex:1;min-width:0;padding-inline:7px;font-size:11px}.sw-private-grid{gap:6px}}
@media (prefers-reduced-motion:reduce){.sw *{animation:none!important;transition:none!important}.sw-loader{background:var(--sw-soft)}}
.sw-trash{margin-top:18px}.sw-trash>summary{cursor:pointer;font-size:12px;color:var(--sw-muted);padding:9px 0;list-style:none}.sw-trash>summary::-webkit-details-marker{display:none}.sw-trash>summary:before{content:'›';display:inline-block;margin-right:6px;transition:transform .15s}.sw-trash[open]>summary:before{transform:rotate(90deg)}.sw-trash-body{margin-top:8px}.sw-trash-list{display:flex;flex-direction:column;gap:10px;margin:10px 0}.sw-trash-row{display:flex;justify-content:space-between;gap:12px;align-items:center;flex-wrap:wrap;border-top:1px dashed var(--sw-line);padding-top:10px}.sw-trash-row:first-child{border-top:0;padding-top:0}.sw-trash-meta{display:flex;flex-direction:column;gap:3px;min-width:0}.sw-trash-meta small{color:var(--sw-muted);font-size:10px}.sw-trash-meta .sw-badge{align-self:flex-start}
.sw-free-log{list-style:none;padding:0;margin:0}.sw-free-log li+li{border-top:1px dashed var(--sw-line);padding-top:14px;margin-top:14px}.sw-free-log small{display:block;color:var(--sw-muted);font-size:10px;margin-bottom:5px}.sw-free-say{font-size:13px;color:var(--sw-green);margin-bottom:6px;overflow-wrap:anywhere}.sw-free-state .sw-story-meta{margin-top:6px}.sw-free-input{width:100%;min-height:76px;resize:vertical;font:inherit;font-size:13px;line-height:1.7;padding:10px 12px;border:1px solid var(--sw-line);border-radius:9px;background:var(--sw-paper);color:var(--sw-ink)}.sw-free-compose{align-items:flex-start}.sw-free-compose .sw-stack{flex:1;min-width:min(100%,260px)}
/* 出游页 · 对话式（默认）：头尾钉住，只有中间那段滚 */
.sw-play{--sw-play-h:min(74vh,780px)}
.sw-play>article.sw-card{display:flex;flex-direction:column;min-height:0;height:var(--sw-play-h);overflow:hidden}
.sw-play .sw-play-head{flex:none}
.sw-play .sw-play-context{flex:none;display:flex;gap:7px;align-items:center;padding:0 22px 10px;color:var(--sw-muted);font-size:11px}
.sw-dot-sep{opacity:.5}
.sw-play .sw-play-strip{flex:none;height:84px;min-height:84px;aspect-ratio:auto;border-radius:0}
.sw-play .sw-play-strip .sw-scene-label{bottom:12px;left:18px;right:18px}
.sw-play .sw-play-strip .sw-scene-label h2{font-size:16px;margin:0}
.sw-play .sw-reading{flex:1 1 0;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding-bottom:10px;-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 18px);mask-image:linear-gradient(180deg,transparent 0,#000 18px)}
.sw-play .sw-play-action{flex:0 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;scrollbar-width:thin;display:flex;flex-direction:column;gap:7px;padding:13px 22px 12px;border-top:1px solid var(--sw-line);background:color-mix(in srgb,var(--sw-green) 4%,var(--sw-paper))}
/* 选项多（v2 最多 4 个）或窗口矮时：先收装饰性的场景条与一行元信息，让选项和正文都有地方；
   底部这一块自己滚，绝不裁掉最后一个选项。 */
@media (max-height:860px){.sw-play .sw-play-strip,.sw-play .sw-play-context{display:none}}
.sw-play .sw-play-action .sw-choices{margin-top:0}
.sw-play .sw-play-action .sw-prose{font-size:13px;line-height:1.8;max-width:none}
.sw-play .sw-play-foot{flex:none}
.sw-btn-block{width:100%}
.sw-play>.sw-aside{position:sticky;top:12px;align-self:start;max-height:var(--sw-play-h);overflow-y:auto;overscroll-behavior:contain;padding-right:2px}
/* 沉浸：一屏一幕，历史收进「回看」 */
.sw-imm{position:relative;display:flex;flex-direction:column;gap:14px}
.sw-imm .sw-scene{min-height:240px;max-height:min(46vh,430px);aspect-ratio:2.4/1;border-radius:16px}
.sw-imm-body{display:flex;flex-direction:column;gap:6px;padding:0 6px}
.sw-imm-lead{font-size:17px;line-height:1.95;max-width:80ch}
.sw-imm-ask{font-size:14px;line-height:1.8;color:var(--sw-muted);max-width:80ch}
.sw-imm-choices{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(300px,100%),1fr));gap:12px}
.sw-imm-choices .sw-choice{padding:15px 16px;font-size:14px;align-items:flex-start}
.sw-imm-choices .sw-choice>span:nth-child(2){font-weight:600}
.sw-imm-solo .sw-btn{min-height:46px}
.sw-imm-compose{display:flex;flex-direction:column;gap:9px}
.sw-imm-bar{position:sticky;bottom:6px;display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;padding:9px 12px;border:1px solid var(--sw-line);border-radius:12px;background:color-mix(in srgb,var(--sw-paper) 93%,transparent);backdrop-filter:blur(10px)}
.sw-imm-bar-mode{display:flex;gap:8px;align-items:center;color:var(--sw-muted);font-size:11px}
.sw-imm-bar-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.sw-drawer{position:absolute;inset:0;z-index:8;display:flex;flex-direction:column;min-height:0;border:1px solid var(--sw-line);border-radius:16px;background:var(--sw-paper);box-shadow:0 24px 60px color-mix(in srgb,var(--sw-ink) 22%,transparent)}
.sw-drawer-head{flex:none;display:flex;justify-content:space-between;align-items:center;gap:10px;padding:12px 16px;border-bottom:1px solid var(--sw-line)}
.sw-drawer-body{flex:1 1 auto;min-height:0;overflow-y:auto;padding:14px 18px 18px}
@container (max-width:650px){.sw-play{--sw-play-h:min(72vh,680px)}.sw-play>.sw-aside{position:static;max-height:none;overflow:visible}.sw-imm .sw-scene{min-height:220px}.sw-imm-lead{font-size:15px}}
@media (prefers-contrast:more){.sw{--sw-muted:var(--sw-ink)}.sw-badge,.sw-btn,.sw-card{border-width:2px}}
/* 自定义工作流：折叠区 + 等宽 textarea */
.sw-settings-workflow{margin:12px 0 0;border:1px solid var(--sw-line);border-radius:10px;padding:11px 13px;background:var(--sw-soft)}
.sw-settings-workflow>summary{cursor:pointer;font-weight:650;font-size:13px;display:flex;align-items:center;gap:8px;list-style:none}
.sw-settings-workflow>summary::-webkit-details-marker{display:none}
.sw-settings-workflow>summary .sw-badge{margin-left:auto;font-weight:500}
.sw-settings-workflow[open]>summary{margin-bottom:8px}
.sw-workflow-json{margin-top:6px;width:100%;min-height:150px;border:1px solid var(--sw-line);border-radius:8px;background:var(--sw-paper);color:inherit;font:12px/1.55 ui-monospace,Consolas,monospace;padding:8px 10px;resize:vertical}
.sw-workflow-json:focus-visible{outline:3px solid color-mix(in srgb,var(--sw-green) 65%,white);outline-offset:2px}
.sw-settings-image-card .sw-setting-field{margin-bottom:0}
/* 共同决定：两席各一票，票面摆在选项上方，谁还没投一眼看得见 */
.sw-votes{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:14px 0 4px}
.sw-vote{border:1px dashed var(--sw-line);border-radius:9px;padding:8px 11px;background:var(--sw-paper);min-width:0}
.sw-vote small{display:block;font-size:10px;letter-spacing:.04em;color:var(--sw-muted)}
.sw-vote strong{display:block;font-size:12px;margin-top:2px;overflow-wrap:anywhere}
.sw-vote-done{border-style:solid;border-color:color-mix(in srgb,var(--sw-green) 38%,var(--sw-line));background:var(--sw-soft)}
.sw-imm .sw-votes{grid-template-columns:1fr 1fr;max-width:520px;margin:12px auto 0}
/* 设置页的分区：一节只讲一件事，标题是名词，副句说人话 */
.sw-settings-part{display:flex;flex-direction:column;gap:12px;min-width:0}
.sw-settings-part-head h3{font-size:15px;letter-spacing:.01em}
.sw-settings-part-head p{font-size:11.5px;line-height:1.7;color:var(--sw-muted);margin-top:4px;max-width:64ch}
.sw-settings-part+.sw-settings-part{padding-top:20px;border-top:1px solid color-mix(in srgb,var(--sw-line) 70%,transparent)}
`;

// webui/story/panel.js
function node(tag, attrs, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs ?? {})) {
    if (value === void 0 || value === null || value === false) continue;
    if (name === "class") element.className = value;
    else if (name === "text") element.textContent = String(value);
    else if (name === "disabled" || name === "checked" || name === "open") element[name] = Boolean(value);
    else if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
    else element.setAttribute(name, String(value));
  }
  for (const child of children.flat(Infinity)) {
    if (child === null || child === void 0 || child === false) continue;
    element.appendChild(typeof child === "string" || typeof child === "number" ? document.createTextNode(String(child)) : child);
  }
  return element;
}
var text = (value, fallback = "") => typeof value === "string" || typeof value === "number" ? String(value) : fallback;
var list = (value) => Array.isArray(value) ? value : [];
var badge = (label2, warm2 = false) => node("span", { class: `sw-badge${warm2 ? " sw-badge-warm" : ""}` }, label2);
var actionRow = (...children) => node("div", { class: "sw-actions" }, children);
var note = (message) => node("p", { class: "sw-note" }, message);
var sectionHead = (title, suffix) => node("div", { class: "sw-section-head" }, node("h3", {}, title), suffix);
function button(label2, handler, options = {}) {
  return node(
    "button",
    {
      type: "button",
      class: `sw-btn ${options.primary ? "sw-btn-primary " : ""}${options.quiet ? "sw-btn-quiet " : ""}${options.small ? "sw-btn-small " : ""}${options.danger ? "sw-btn-danger " : ""}${options.block ? "sw-btn-block " : ""}`,
      onclick: handler,
      disabled: options.disabled,
      "data-focus": options.key,
      "aria-label": options.ariaLabel,
      "aria-pressed": options.pressed === void 0 ? void 0 : String(options.pressed)
    },
    options.icon ? icon(options.icon) : null,
    label2
  );
}
var date = (value) => {
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(parsed) : "时间未记录";
};
var actor = (value) => value === "fish" ? "鱼选择" : value === "owner" ? "你选择" : "选择者未标注";
function mountPanel(root, ctx) {
  if (!root?.replaceChildren) throw new Error("故事面板缺少有效的 DOM 根。");
  const t = storyText(ctx.language);
  let disposed = false;
  let controller;
  let authorRoot;
  let authorPanel;
  let advancedSettings;
  let imageBusy = false;
  let imageResult;
  let autoImageBusy = false;
  let autoImageNotice = "";
  const imageOutput = node("div", { class: "sw-image-result", role: "status" });
  async function ownCall(method, payload) {
    if (typeof ctx.storyCall === "function") return ctx.storyCall(method, payload, { signal: ctx.signal, timeoutMs: method === "storyImage" ? 65e3 : 2e4 });
    if (typeof ctx.invoke === "function") return ctx.invoke(method, payload === void 0 ? [] : [payload]);
    throw new Error("Story adapter unavailable");
  }
  function authorView() {
    if (!authorRoot) {
      authorRoot = node("div", { class: "sw-authoring-view" });
      authorPanel = mountStories({ ...ctx, root: authorRoot, invoke: (method, args = []) => ownCall(`author${method[0].toUpperCase()}${method.slice(1)}`, args[0]) });
    }
    return authorRoot;
  }
  function openAuthor(expand = false) {
    navigate("author");
    if (expand) authorPanel?.expand();
  }
  let view = "home";
  let memoryFilter = "all";
  let autoPreset = true;
  let immersive = false;
  let drawerOpen = false;
  let playScroll = { key: "", top: 0, atBottom: true };
  let localNotice = "";
  let localError = "";
  const openDetails = /* @__PURE__ */ new Set();
  const shell2 = node("section", { class: "sw", "aria-label": "故事工坊" });
  const style = node("style", { text: STYLES });
  const top = node("header", { class: "sw-top" });
  const nav = node("nav", { class: "sw-tabs", "aria-label": "故事世界导航" });
  const feedback3 = node("div", { "aria-live": "polite", "aria-atomic": "true" });
  const main = node("main", { class: "sw-main", id: "story-panel-content" });
  shell2.append(style, top, nav, feedback3, main, node("footer", { class: "sw-bottom-note" }, "在熟悉的日常里，留一点位置给新的故事。"));
  root.replaceChildren(shell2);
  const artwork = createArtworkStore(ctx, () => render());
  const locationCovers = /* @__PURE__ */ new Map();
  function locationCover(art) {
    if (!art?.id || !art.cover || typeof ctx.storyCall !== "function") return null;
    if (!locationCovers.has(art.cover)) {
      if (locationCovers.size >= 8) locationCovers.delete(locationCovers.keys().next().value);
      locationCovers.set(art.cover, Promise.resolve().then(() => ctx.storyCall("locationCover", { id: art.id })).then(({ ok, image }) => ok && image?.cover === art.cover && /^data:image\/(?:png|jpe?g|gif|webp);base64,/.test(image.dataUrl) ? image.dataUrl : null).catch(() => null));
    }
    return locationCovers.get(art.cover);
  }
  function navigate(next) {
    view = next;
    localNotice = "";
    localError = "";
    if (next !== "play") drawerOpen = false;
    render();
  }
  function scene(slot, title, description, options = {}) {
    const home2 = slot === "home-day";
    const element = node("div", { class: `sw-scene ${options.class ?? ""}`, "data-resource-slot": slot });
    element.append(illustration(home2 ? "home" : slot === "creek-letter-ending" ? "ending" : "creek"));
    const source = slot ? artwork.get(slot) : null;
    if (source) {
      const image = node("img", { src: source, alt: `${title}的本地插画`, decoding: "async" });
      image.addEventListener("error", () => {
        image.remove();
        artwork.markFailed(slot);
        const marker = element.querySelector(".sw-scene-art-note");
        if (marker) marker.textContent = "图片未能加载 · 文字场景";
      }, { once: true });
      element.append(image);
    }
    const shared = options.preferSlot && source ? null : locationCover(options.location);
    if (shared) void shared.then((dataUrl) => {
      if (!dataUrl || disposed || ctx.signal?.aborted || !shell2.contains(element)) return;
      const image = node("img", { src: dataUrl, alt: `${title}的地点封面`, decoding: "async" });
      const focus = options.location.coverFocus;
      if (Number.isFinite(focus?.x) && Number.isFinite(focus?.y)) image.style.objectPosition = `${focus.x}% ${focus.y}%`;
      image.addEventListener("error", () => image.remove(), { once: true });
      element.append(image);
    });
    element.append(
      node("span", { class: "sw-scene-tag" }, options.tag ?? (home2 ? "此刻 · 在家" : "故事场景")),
      node("span", { class: "sw-scene-art-note" }, source ? "本地插画" : "文字场景 · 原创示意"),
      node("div", { class: "sw-scene-label" }, node("h2", {}, title), description ? node("p", {}, description) : null)
    );
    return element;
  }
  function trackedDetails(key, summary, ...content) {
    const element = node("details", { class: "sw-details", open: openDetails.has(key), "data-details": key }, summary, content);
    element.addEventListener("toggle", () => {
      if (element.open) openDetails.add(key);
      else openDetails.delete(key);
    });
    return element;
  }
  function conflict(snapshot) {
    return text(snapshot?.conflict);
  }
  function canAct(state) {
    return state.ready && !state.loading && !state.busy && !state.recovering && !state.autoAuthorized && !state.autoRunning;
  }
  async function startStory(story) {
    if (!controller || !canAct(controller.state)) return;
    const wantsAuto = autoPreset;
    await controller.mutate("start", { packId: story.id, revision: story.revision });
    if (disposed || ctx.signal?.aborted) return;
    if (controller.state.snapshot?.trip) {
      view = "play";
      render();
      if (wantsAuto && !controller.state.error && controller.state.snapshot.trip.state === "active") await controller.setMode(true);
    }
  }
  function timeline(items, empty2 = "还没有发生的片段。") {
    if (!list(items).length) return note(empty2);
    return node("ol", { class: "sw-route" }, list(items).map((item) => node(
      "li",
      {},
      item.area ? node("small", {}, text(item.area)) : null,
      node("p", {}, text(item.text))
    )));
  }
  function choiceRecords(items) {
    return list(items).map((choice) => node(
      "div",
      { class: "sw-choice-record" },
      node("strong", {}, text(choice.label, text(choice.option, "已确认选择"))),
      choice.result ? node("p", {}, text(choice.result)) : null,
      node("small", {}, actor(choice.actor)),
      choice.reason ? node("p", { class: "sw-note" }, `当时的想法：${text(choice.reason)}`) : null
    ));
  }
  function empty(title, message, action) {
    return node("div", { class: "sw-empty" }, icon("book"), node("strong", {}, title), node("p", {}, message), action ? actionRow(action) : null);
  }
  function storyCard(story, state, compact = false) {
    const snapshot = state.snapshot;
    const playable = story.available;
    const blockedByTrip = Boolean(snapshot.trip) || Boolean(conflict(snapshot));
    const card = node("article", { class: "sw-card sw-story-card" });
    card.append(scene(null, text(story.placeName, "故事地点"), "", { location: story.locationArt, tag: t.storyEnabled }));
    const info = node(
      "div",
      { class: "sw-story-info" },
      node("h3", {}, text(story.title, "未命名故事")),
      node("p", {}, text(story.description, "从这个地方，开始一段新的经历。"))
    );
    if (!compact && story.placeDescription) info.append(trackedDetails(
      `place-${story.id}`,
      node("summary", {}, "看看这个地方"),
      node("p", { class: "sw-card-note" }, text(story.placeDescription))
    ));
    info.append(node(
      "div",
      { class: "sw-story-meta" },
      badge(text(story.placeName, "地点待配置")),
      story.style ? badge(text(story.style), true) : null,
      story.mode === "free" ? badge("自由模式", true) : null,
      badge(t.storyCustom, true)
    ));
    if (story.metadata) info.append(
      node(
        "p",
        { class: "sw-card-note" },
        `作者：${text(story.metadata.author)} · 版本：${text(story.metadata.release)} · 类型：${text(story.metadata.genre)} · ${story.participation === "duo" ? "双人" : "单人"} · 时长：${story.durationMinutes == null ? "未知" : `${story.durationMinutes} 分钟`}`
      ),
      list(story.metadata.requirements).length ? note(`能力要求：${story.metadata.requirements.join("；")}`) : note("能力要求：无额外要求")
    );
    else info.append(note("作者与类型未标注 · 单人 · 时长未知"));
    if (story.problem) info.append(note(text(story.problem)));
    const primary = button(
      blockedByTrip ? t.storyContinue : t.storyStart,
      () => blockedByTrip ? navigate("play") : startStory(story),
      { icon: "arrow", primary: true, disabled: blockedByTrip ? !snapshot.trip : !playable || !canAct(state), key: `start-${story.id}` }
    );
    info.append(node("div", { class: "sw-story-footer" }, node("small", {}, playable ? t.storyProgress : t.storyBlocked), primary));
    card.append(info);
    return card;
  }
  function home(state) {
    const snapshot = state.snapshot;
    const current = snapshot.trip;
    const memories2 = list(snapshot.memories);
    const left = node("div", { class: "sw-stack" });
    const hero = node(
      "article",
      { class: "sw-card" },
      scene("home-day", snapshot.home?.name || "鱼的家", snapshot.home?.desc || (current ? "有一段旅程，还等着继续。" : "门外有新的故事，家里也有安稳的日常。"), { location: snapshot.home, tag: current ? "住所 · 行程未结束" : "此刻 · 在家" }),
      node(
        "div",
        { class: "sw-home-caption" },
        node(
          "div",
          {},
          node("strong", {}, current ? "上次的故事，还在这里" : "今天，想去哪里走走？"),
          node("p", {}, current ? `${text(current.placeName)} · ${text(current.area, "等待继续")}` : "选一个地方，亲自出发；也可以让鱼自己走一趟。")
        ),
        button(current ? "继续这趟故事" : "看看地点与故事", () => navigate(current ? "play" : "stories"), { primary: true, icon: "arrow", key: "home-primary" })
      )
    );
    left.append(hero);
    const firstStory = list(snapshot.catalog)[0];
    left.append(firstStory ? node("section", {}, sectionHead(t.storyCatalogTitle), storyCard(firstStory, state, true)) : empty(t.storyEmptyTitle, t.storyEmptyBody, button(t.storyWrite, () => openAuthor(true), { primary: true, icon: "book", key: "home-write" })));
    const right = node("aside", { class: "sw-stack sw-aside", "aria-label": "在家小记" });
    right.append(node(
      "section",
      { class: "sw-card sw-card-pad" },
      node("div", { class: "sw-side-title" }, icon("leaf"), "家里的小记"),
      node("div", { class: "sw-quotation" }, "有些故事不用走很远。沿着溪水，或者坐一会儿，就会遇见。", node("small", {}, "写给下一次出发")),
      node("hr", { class: "sw-divider" }),
      node(
        "div",
        { class: "sw-stat-row" },
        node("div", {}, node("strong", {}, memories2.length), node("span", {}, "趟已留下的回忆")),
        node("div", {}, node("strong", {}, memories2.filter((memory) => memory.complete).length), node("span", {}, "趟完整的故事"))
      )
    ));
    const latest = memories2[0];
    right.append(node(
      "section",
      { class: "sw-card sw-card-pad" },
      node("div", { class: "sw-side-title" }, icon("book"), "最近的回忆"),
      latest ? node(
        "div",
        {},
        node("h4", {}, text(latest.title, latest.placeName)),
        node("p", { class: "sw-card-note" }, text(list(latest.timeline).at(-1)?.text, "这段经历已被妥善收好。")),
        node("p", { class: "sw-memory-date" }, date(latest.endedAt)),
        node("hr", { class: "sw-divider" }),
        button("翻开回忆", () => navigate("memories"), { small: true, icon: "arrow", key: "latest-memory" })
      ) : node("div", {}, node("p", { class: "sw-card-note" }, "第一趟出游结束后，走过的地方、真实发生的事和做过的选择，会留在这里。"))
    ));
    right.append(node(
      "section",
      { class: "sw-card sw-card-pad sw-side-secondary" },
      node("div", { class: "sw-side-title" }, icon("clock"), "关于日程与日常"),
      node("p", { class: "sw-card-note" }, "今天的安排仍在「鱼的每一天」中查看。故事需要你明确出发，不会到了时间自动开始。"),
      note("读书、视频与其他居家活动，继续从对应 World 或会话入口使用。")
    ));
    return node("div", { class: "sw-grid" }, left, right);
  }
  function stories(state) {
    const snapshot = state.snapshot;
    const all = list(snapshot.catalog);
    const intro = node("div", { class: "sw-lead" }, node("h2", {}, t.storyCatalogTitle), node("p", {}, t.storyCatalogIntro));
    const preset = node(
      "section",
      { class: "sw-card sw-card-pad" },
      node(
        "div",
        { class: "sw-mode" },
        node("div", {}, node("strong", {}, "这次，想让鱼自己游玩吗？"), node("small", {}, "默认让鱼自己往下走；出发后你随时可以接管。")),
        node("button", {
          type: "button",
          class: "sw-switch",
          role: "switch",
          "aria-label": "出发后开启鱼自己游玩",
          "aria-checked": String(autoPreset),
          disabled: !snapshot.autonomy.available || Boolean(snapshot.trip),
          "data-focus": "auto-preset",
          onclick: () => {
            autoPreset = !autoPreset;
            render();
          }
        })
      ),
      note(snapshot.autonomy.available ? "可以随时接管。关闭窗口、切走页面或遇到错误时会暂停。" : text(snapshot.autonomy.reason, "自主游玩暂不可用，手动玩法不受影响。"))
    );
    return node(
      "div",
      { class: "sw-stack" },
      intro,
      preset,
      all.length ? node("div", { class: "sw-story-grid" }, all.map((story) => storyCard(story, state))) : empty(t.storyEmptyTitle, t.storyEmptyBody),
      node(
        "section",
        { class: "sw-card sw-card-pad" },
        node("div", { class: "sw-side-title" }, icon("settings"), t.storyWrite),
        node("p", { class: "sw-card-note" }, t.storyAuthorHint),
        button(t.storyWrite, () => openAuthor(true), { primary: true, key: "stories-write" })
      )
    );
  }
  function play(state) {
    const current = state.snapshot?.trip;
    if (!current) return empty("故事还没有开始", "先选一篇故事，确认后再出发。已结束的行程可以在回忆里翻看。", button("去看看故事", () => navigate("stories"), { primary: true, icon: "arrow", key: "empty-play" }));
    if (current.mode === "free") return immersive ? playFreeImmersive(state, current) : playFree(state, current);
    return immersive ? playImmersive(state, current) : playChat(state, current);
  }
  function pendingPicker(state, current, cls) {
    const pending = current.pending;
    const isDraft = current.state === "draft";
    const manually = canAct(state) && !state.snapshot.autonomy.enabled;
    const joint = pending?.actor === "joint" ? current.joint : null;
    const ownerTurn = manually && (joint ? joint.canVote?.owner === true : current.actor !== "fish");
    const canSubstitute = !joint && !isDraft && current.step === "choose" && !state.autoAuthorized && state.snapshot.autonomy.canSubstitute === true;
    const pick = async (option) => {
      if (!canSubstitute) return controller.mutate("choose", { choiceId: pending.id, optionId: option.id });
      const label2 = text(option.label, option.id);
      const confirmed = ctx.ui?.confirm ? await ctx.ui.confirm({ title: `替鱼选「${label2}」？`, body: "鱼这一步没法自己决定（额度用完，或者两次都没给出有效选项）。选了会记为「由你替选」，进度照常推进。" }) : globalThis.confirm?.(`替鱼选「${label2}」？会记为「由你替选」。`);
      if (confirmed && !disposed) await controller.substitute(option.id);
    };
    const block = node("div", { class: cls }, list(pending.options).map((option, index) => node(
      "button",
      {
        type: "button",
        class: "sw-choice",
        disabled: !(ownerTurn || canSubstitute) || isDraft || current.step !== "choose",
        "data-focus": `option-${option.id}`,
        onclick: () => {
          void pick(option);
        }
      },
      node("span", { class: "sw-choice-index", "aria-hidden": "true" }, String(index + 1).padStart(2, "0")),
      node("span", {}, text(option.label, option.id)),
      icon("arrow")
    )));
    return { block, canSubstitute, ownerTurn, manually, isDraft };
  }
  function optionsHint(state, current, canSubstitute) {
    if (current.state === "draft") return "先继续行程，再选择下一步。";
    if (state.autoAuthorized) return "鱼正在考虑这些有效选项。你可以随时关闭右侧开关接管。";
    if (current.pending?.actor === "joint" && current.joint?.hint) return current.joint.hint;
    if (canSubstitute) return "鱼这一步没法自己决定：你可以替她选一个，点下去会先问你确认；也可以先收尾，或者点右侧「再来一段」。";
    return "选一条你想走的路。点击后会等待保存确认。";
  }
  function jointBoard(joint) {
    const seats = list(joint?.seats);
    return node("div", { class: "sw-votes", "aria-label": "共同决定的两席票" }, seats.map((seat) => node(
      "div",
      { class: `sw-vote${seat.voted ? " sw-vote-done" : ""}` },
      node("small", {}, seat.name),
      node("strong", {}, seat.label || "还没投")
    )));
  }
  function advanceButton(state, current, opts = {}) {
    const manually = canAct(state) && !state.snapshot.autonomy.enabled;
    const ownerTurn = manually && current.actor !== "fish";
    if (current.state === "draft" || current.step === "resume") return button("继续这趟行程", () => controller.mutate("resume"), { primary: true, icon: "arrow", disabled: !manually, key: "resume", block: opts.block });
    if (current.step === "move") return button(current.nextArea ? `前往${text(current.nextArea)}` : "向前走一走", () => controller.mutate("move"), { primary: true, icon: "arrow", disabled: !ownerTurn, key: "move", block: opts.block });
    if (current.step === "close") return button("回家，收好这段回忆", () => controller.mutate("close"), { primary: true, icon: "home", disabled: !manually, key: "close-complete", block: opts.block });
    return null;
  }
  function closeEarlyButton(state, opts = {}) {
    const manually = canAct(state) && !state.snapshot.autonomy.enabled;
    return button("先回家", async () => {
      const confirmed = ctx.ui?.confirm ? await ctx.ui.confirm({ title: "现在先回家吗？", body: "按已经发生的片段结束这一趟。未走到的结局不会记入回忆。" }) : globalThis.confirm?.("按已经发生的片段结束这一趟？未走到的结局不会记入回忆。");
      if (confirmed && !disposed) await controller.mutate("close");
    }, { quiet: opts.quiet ?? true, small: opts.small, disabled: !manually, key: "close-early" });
  }
  function autoplaySwitch(state) {
    const checked = state.autoplay === true;
    const busy = state.busy === "正在开启自主游玩" || state.busy === "正在关闭自主游玩";
    const trip = state.snapshot?.trip;
    return node("button", {
      type: "button",
      class: "sw-switch",
      role: "switch",
      "aria-label": "鱼自己游玩",
      "aria-checked": String(checked),
      disabled: busy || !checked && (!state.snapshot.autonomy.available || trip?.state === "draft" || !state.ready || state.loading || state.recovering || Boolean(state.busy)),
      "data-focus": "trip-mode",
      onclick: () => controller.setMode(!checked)
    });
  }
  function autoImageSwitch(snapshot) {
    const images = snapshot?.images ?? {};
    const masterOn = images.masterOn === true;
    const hasTrip = Boolean(snapshot?.trip);
    const allowed = masterOn && hasTrip;
    const checked = allowed && images.auto === true;
    const reason = !masterOn ? t.settingsAutoImageMasterOff : !hasTrip ? t.settingsAutoImageNoTrip : t.settingsAutoImageHint;
    const noteText = allowed ? autoImageNotice : reason;
    return node(
      "div",
      { class: "sw-top-switch-wrap" },
      node("span", { class: "sw-top-switch-label" }, t.settingsAutoImage),
      node("button", {
        type: "button",
        class: "sw-switch sw-top-switch",
        role: "switch",
        "aria-checked": String(checked),
        "aria-label": t.settingsAutoImage,
        title: reason,
        "data-focus": "auto-images",
        disabled: autoImageBusy || !allowed,
        onclick: () => void toggleAutoImages(!images.auto)
      }),
      node("span", { class: "sw-top-switch-note", role: "status", "aria-live": "polite" }, noteText)
    );
  }
  async function toggleAutoImages(next) {
    const state = controller?.state;
    const images = state?.snapshot?.images;
    if (autoImageBusy || !images || images.masterOn !== true || !state?.snapshot?.trip) return;
    const previous = images.auto === true;
    autoImageBusy = true;
    autoImageNotice = "";
    images.auto = next;
    render();
    try {
      const result = await ownCall("saveStoryAutoImages", { auto: next });
      if (disposed || ctx.signal?.aborted) return;
      if (!result?.ok) throw new Error(result?.error || "");
      autoImageNotice = result.autoImages ? t.settingsAutoImageOn : t.settingsAutoImageOff;
      await controller.refresh();
    } catch {
      images.auto = previous;
      autoImageNotice = t.settingsAutoImageFailed;
    } finally {
      autoImageBusy = false;
      if (!disposed) render();
    }
  }
  function historyDrawer(state, current) {
    const body = node("div", { class: "sw-drawer-body" });
    const events = list(current.events);
    const choices = list(current.choices);
    if (events.length) body.append(node("ul", { class: "sw-event-history" }, events.map((event) => node("li", {}, node("p", { class: "sw-prose" }, text(event))))));
    else body.append(note("还没有发生的片段。"));
    if (choices.length) body.append(...choiceRecords(choices));
    for (const reference of list(current.references)) body.append(note(reference));
    return node(
      "div",
      { class: "sw-drawer", role: "dialog", "aria-label": "这一趟的回看" },
      node(
        "div",
        { class: "sw-drawer-head" },
        node("div", {}, node("div", { class: "sw-kicker" }, "这一趟"), node("strong", {}, `回看 · ${events.length} 个片段 · ${choices.length} 次选择`)),
        button("回到此刻", () => {
          drawerOpen = false;
          render();
        }, { small: true, key: "imm-drawer-close" })
      ),
      body
    );
  }
  function immersiveBar(state, current, ...primary) {
    const events = list(current.events);
    return node(
      "div",
      { class: "sw-imm-bar" },
      button(`回看 ${events.length}`, () => {
        drawerOpen = !drawerOpen;
        render();
      }, { small: true, key: "imm-history", pressed: drawerOpen }),
      node("div", { class: "sw-imm-bar-mode" }, node("small", {}, "鱼自己游玩"), autoplaySwitch(state)),
      node("div", { class: "sw-imm-bar-actions" }, ...primary, current.step === "close" ? null : closeEarlyButton(state, { small: true }))
    );
  }
  function playFree(state, current) {
    const isDraft = current.state === "draft";
    const free = current.free ?? { turn: 0, maxTurns: 0, log: [], summary: "", facts: {}, flags: {}, counters: {}, ended: null };
    const turnsLeft = Number.isInteger(free.turnsLeft) ? free.turnsLeft : Math.max(0, Number(free.maxTurns) - Number(free.turn));
    const capped = !free.ended && turnsLeft === 0;
    const left = node("article", { class: "sw-card sw-play-main" });
    left.append(node(
      "div",
      { class: "sw-play-head" },
      node(
        "div",
        {},
        node("div", { class: "sw-kicker" }, isDraft ? "等待继续" : "自由模式 · 场景包"),
        node("h2", {}, text(current.title, text(current.placeName, "自由故事")))
      ),
      badge(free.ended ? "已收尾" : capped ? `第 ${text(free.segment, 1)} 段 · 这段说完了` : `第 ${text(free.segment, 1)} 段 · 还剩 ${turnsLeft} 回合`, !free.ended)
    ));
    left.append(node(
      "div",
      { class: "sw-play-context" },
      `此刻 · ${text(current.areaName, text(current.placeName))}`,
      node("span", { class: "sw-dot-sep", "aria-hidden": "true" }, "·"),
      `第 ${text(free.turn, 0)} / ${text(free.limit, free.maxTurns)} 回合`
    ));
    left.append(scene(null, text(current.placeName), "", { location: current.locationArt, class: "sw-play-scene sw-play-strip", tag: "场景包" }));
    const reading = node("div", { class: "sw-reading", "data-focus": "play-reading" });
    if (free.summary) reading.append(note(`到目前为止：${free.summary}`));
    const log = list(free.log);
    if (!log.length) reading.append(node("p", { class: "sw-prose" }, "开场已经在那里了。说一句想做的事，故事就会往下走。"));
    else {
      const render2 = (entry) => node(
        "li",
        {},
        node("small", {}, text(entry.from, "这一回合")),
        entry.say ? node("p", { class: "sw-free-say" }, `「${text(entry.say)}」`) : null,
        node("p", { class: "sw-prose" }, text(entry.narration))
      );
      const earlier = log.slice(0, -6);
      if (earlier.length) reading.append(trackedDetails(
        "free-earlier",
        node("summary", {}, `更早的 ${earlier.length} 回合`),
        node("ol", { class: "sw-free-log" }, earlier.map(render2))
      ));
      reading.append(node("ol", { class: "sw-free-log" }, log.slice(-6).map(render2)));
    }
    const chips = node("div", { class: "sw-story-meta" });
    for (const [id, value] of Object.entries(free.facts ?? {})) chips.append(badge(`${id} · ${text(value)}`, true));
    for (const [id, value] of Object.entries(free.flags ?? {})) if (value) chips.append(badge(id, true));
    for (const [id, value] of Object.entries(free.counters ?? {})) chips.append(badge(`${id} ${text(value)}`, true));
    if (chips.childNodes.length) reading.append(node("div", { class: "sw-free-state" }, node("div", { class: "sw-kicker" }, "正在起作用的状态"), chips));
    if (list(current.blocked).length || current.blocked) reading.append(node("div", { class: "sw-notice sw-notice-error" }, icon("info"), node("p", {}, text(current.blocked))));
    left.append(reading);
    const input = node("textarea", { class: "sw-free-input", rows: "2", placeholder: capped ? "这一段说完了，可以再来一段。" : "这一回合你想做什么？", "aria-label": "这一回合做什么", disabled: isDraft || Boolean(free.ended) || capped });
    const send = button("说这一句", async () => {
      const say = input.value.trim();
      if (!say || !canAct(state)) return;
      await controller.mutate("say", { say });
    }, { primary: true, key: "free-say", disabled: !canAct(state) || isDraft || Boolean(free.ended) || capped });
    left.append(node(
      "div",
      { class: "sw-play-action sw-free-compose" },
      input,
      actionRow(send, free.canContinue ? button(
        `再来一段 · 还能 ${text(free.segmentsLeft, 0)} 段`,
        () => controller.continueSegment(),
        { primary: true, icon: "arrow", key: "free-segment", disabled: !canAct(state) || state.loading || state.recovering || Boolean(state.busy) }
      ) : null)
    ));
    left.append(node(
      "div",
      { class: "sw-play-foot" },
      node("div", { class: "sw-status", role: "status" }, icon(state.busy ? "clock" : "check"), state.busy || "实际进度已同步"),
      actionRow(
        free.ended ? button("收起这一段", () => controller.mutate("close"), { primary: true, icon: "home", disabled: !canAct(state), key: "free-close" }) : null,
        !free.ended ? button("先收起", () => controller.mutate("close"), { quiet: true, disabled: !canAct(state), key: "free-close-early" }) : null,
        Number(free.turn) > 0 ? button("退回上一回合", async () => {
          const question = "退回上一回合？这一回合发生的事会撤回，已经花掉的模型调用不退。";
          const confirmed = ctx.ui?.confirm ? await ctx.ui.confirm({ title: "退回上一回合？", body: question }) : globalThis.confirm?.(question);
          if (confirmed && !disposed) await controller.mutate("rewind");
        }, { quiet: true, disabled: !canAct(state), key: "free-rewind" }) : null
      )
    ));
    const right = node("aside", { class: "sw-stack sw-aside", "aria-label": "自由模式说明" });
    right.append(node(
      "section",
      { class: "sw-card sw-card-pad" },
      node("div", { class: "sw-side-title" }, icon("book"), "这一段怎么走"),
      note("作者只定下大方向和不能改的事实；每一回合怎么演，交给主持。你随时可以停。"),
      free.ended ? note("这一段已经收尾：收起后会按实际发生的内容存进回忆。") : capped ? note(`这一段的 ${free.maxTurns} 回合说完了。可以「再来一段」接着走（这一趟最多三段，已经走到第 ${text(free.segment, 1)} 段），也可以收起进回忆。`) : note(`这一段的第 ${text(free.segment, 1)} 段，还剩 ${turnsLeft} 回合。`)
    ));
    if (list(current.ends).length) right.append(node(
      "section",
      { class: "sw-card sw-card-pad sw-side-secondary" },
      node("div", { class: "sw-side-title" }, icon("pin"), "可能的收尾"),
      node("ul", { class: "sw-route" }, list(current.ends).map((end) => node("li", {}, node("p", {}, text(end.text)))))
    ));
    right.append(node(
      "section",
      { class: "sw-card sw-card-pad sw-side-secondary" },
      node("div", { class: "sw-side-title" }, icon("clock"), "和选项式故事的区别"),
      node("p", { class: "sw-card-note" }, "选项式故事由作者写好分支，你从选项里挑；自由模式只写设定与收尾条件，每一步由你用自己的话说。")
    ));
    return node("div", { class: "sw-grid sw-play" }, left, right);
  }
  function playChat(state) {
    const snapshot = state.snapshot;
    const current = snapshot.trip;
    const isDraft = current.state === "draft";
    const pending = current.pending;
    const manually = canAct(state) && !snapshot.autonomy.enabled;
    const joint = pending?.actor === "joint" ? current.joint : null;
    const ownerTurn = manually && (joint ? joint.canVote?.owner === true : current.actor !== "fish");
    const left = node("article", { class: "sw-card sw-play-main" });
    left.append(node("div", { class: "sw-play-head" }, node(
      "div",
      {},
      node("div", { class: "sw-kicker" }, isDraft ? "等待继续" : "当前行程"),
      node("h2", {}, text(current.title, text(current.placeName, "正在出游")))
    ), badge(isDraft ? "等待继续" : current.step === "blocked" ? "暂时受阻" : state.autoAuthorized ? "鱼自己游玩中" : current.actor === "fish" ? "等鱼提交" : "由你亲自选择", isDraft || current.step === "blocked")));
    const events = list(current.events);
    const choices = list(current.choices);
    left.append(node(
      "div",
      { class: "sw-play-context" },
      `此刻 · ${text(current.area, current.placeName)}`,
      node("span", { class: "sw-dot-sep", "aria-hidden": "true" }, "·"),
      `${events.length} 个片段 · ${choices.length} 次选择`
    ));
    left.append(scene(null, text(current.area, current.placeName), "", { location: current.locationArt, class: "sw-play-scene sw-play-strip", tag: text(current.placeName, "当前地点") }));
    const reading = node("div", { class: "sw-reading", "data-focus": "play-reading" });
    reading.append(node("div", { class: "sw-kicker" }, "已经发生的片段"));
    if (choices.length) reading.append(trackedDetails("play-choices", node("summary", {}, `这趟的 ${choices.length} 次选择`), ...choiceRecords(choices)));
    if (events.length) {
      const earlier = events.slice(0, -3);
      if (earlier.length) reading.append(trackedDetails(
        "play-earlier",
        node("summary", {}, `更早的 ${earlier.length} 条片段`),
        node("ul", { class: "sw-event-history" }, earlier.map((event) => node("li", {}, node("p", { class: "sw-prose" }, text(event)))))
      ));
      reading.append(node("ul", { class: "sw-event-history" }, events.slice(-3).map((event) => node("li", {}, node("p", { class: "sw-prose" }, text(event))))));
    } else reading.append(node("p", { class: "sw-prose" }, current.step === "move" ? "路就在眼前。走近一点，看看会遇见什么。" : "这一趟的故事，将随着真实的行动在这里展开。"));
    if (current.actor) {
      const who = (joint?.seat ?? current.actor) === "fish" ? "鱼" : "你";
      const jointLine = joint ? ` · 共同决定：${joint.resolutionNote}${joint.seatsText ? ` · ${joint.seatsText}` : ""}` : "";
      reading.append(note(`当前行动者：${who}${jointLine}。等待不会当作同意。`));
    }
    for (const reference of list(current.references)) reading.append(note(reference));
    if (current.blocked) reading.append(node("div", { class: "sw-notice sw-notice-error" }, icon("info"), node("p", {}, text(current.blocked, "当前无法推进，请核对场所与故事条件。"))));
    if (current.complete) reading.append(node("div", { class: "sw-reason" }, "这一段故事已经走到结尾。确认回家后，会按实际发生的内容收进回忆。"));
    left.append(reading);
    const action = node("div", { class: "sw-play-action", "aria-label": "当前这一步" });
    if (pending) {
      const { block, canSubstitute } = pendingPicker(state, current, "sw-choices");
      action.append(node("div", { class: "sw-kicker" }, joint ? joint.headline : "现在轮到你了"));
      if (pending.prompt) action.append(node("p", { class: "sw-prose" }, text(pending.prompt)));
      if (joint) action.append(jointBoard(joint));
      action.append(block, note(optionsHint(state, current, canSubstitute)));
      if (joint?.seat === "fish" && canAct(state)) {
        action.append(actionRow(button(
          "刷新，看鱼投了没",
          () => {
            void controller.refresh();
          },
          { small: true, quiet: true, key: "joint-refresh", disabled: Boolean(state.busy) }
        )));
      }
    } else {
      const advance = advanceButton(state, current, { block: true });
      action.append(node("div", { class: "sw-kicker" }, isDraft || current.step === "resume" ? "下一步" : current.step === "close" ? "收尾" : "下一处"));
      if (advance) action.append(advance);
      if (current.step === "blocked" && !current.blocked) action.append(note("这一步暂时没有可用的动作。"));
    }
    left.append(action);
    left.append(node(
      "div",
      { class: "sw-play-foot" },
      node("div", { class: "sw-status", role: "status" }, icon(state.busy ? "clock" : "check"), state.busy || (state.autoAuthorized ? "正在逐步继续这趟旅程" : "实际进度已同步")),
      actionRow(current.step !== "close" ? closeEarlyButton(state, { quiet: true }) : null)
    ));
    const right = node("aside", { class: "sw-stack sw-aside", "aria-label": "行程控制" });
    const modeCard = node("section", { class: "sw-card sw-card-pad" });
    const checked = state.autoplay === true;
    const running = state.autoAuthorized === true;
    const stopped = Boolean(snapshot.autonomy.stop);
    const modeSubtitle = stopped ? snapshot.autonomy.canContinue ? "这一段走完了，可以再来一段" : "这一段走完了，等你收尾" : running ? "这一趟，由鱼自己决定" : checked ? (joint?.seat ?? current.actor) === "owner" ? "轮到你选择；选完鱼会接着走" : "鱼会接着往下走" : (joint?.seat ?? current.actor) === "fish" ? "这一步等鱼提交，可以去聊天里让她说" : "下一步，等你来选择";
    modeCard.append(node(
      "div",
      { class: "sw-mode" },
      node("div", {}, node("strong", {}, "鱼自己游玩"), node("small", {}, modeSubtitle)),
      autoplaySwitch(state)
    ));
    modeCard.append(note(checked ? "这是一次持久偏好：轮到你时会暂停，你选完鱼会接着走；切走页面只暂停当下。关掉开关即可接管。" : "打开后鱼会自己往下走；轮到你时暂停，随时可以接管。"));
    if (snapshot.autonomy.reason && snapshot.autonomy.available) modeCard.append(note(snapshot.autonomy.reason));
    if (snapshot.autonomy.remaining !== void 0) modeCard.append(node("div", { class: "sw-budget" }, node("span", {}, "本趟剩余预算"), node("b", {}, `${text(snapshot.autonomy.remaining)} 步${Number.isInteger(snapshot.autonomy.remainingCalls) ? ` · ${snapshot.autonomy.remainingCalls} 次决定` : ""}${Number.isInteger(snapshot.autonomy.segment) ? ` · 第 ${snapshot.autonomy.segment} 段` : ""}`)));
    if (snapshot.autonomy.canContinue) {
      modeCard.append(button(
        `再来一段（鱼自己玩）· 还能 ${snapshot.autonomy.segmentsLeft} 段`,
        () => controller.continueSegment(),
        { small: true, primary: true, key: "segment", disabled: !snapshot.autonomy.available || !canAct(state) || state.loading || state.recovering || Boolean(state.busy) }
      ));
      modeCard.append(note("再来一段会把这一段的步数和决定次数都归零，已经发生的事和回忆不动；一趟最多三段，要你亲手点。"));
    }
    if (state.reason) modeCard.append(node("div", { class: "sw-reason" }, node("div", { class: "sw-kicker" }, "鱼此刻的想法"), node("p", {}, state.reason)));
    right.append(modeCard);
    const dm = snapshot.dm;
    if (dm) {
      const dmCard = node(
        "section",
        { class: "sw-card sw-card-pad" },
        node("div", { class: "sw-side-title" }, icon("book"), "可选文本主持"),
        note(dm.message),
        note("主持文字是待确认的提议。鱼的偏好与用户选择各自提交；自由聊天不改变进度。")
      );
      if (dm.enabled) {
        dmCard.append(
          node("div", { class: "sw-budget" }, node("span", {}, "本趟主持额度"), node("b", {}, `${dm.remainingCalls} 次剩余`)),
          note(`已发起 ${dm.budget?.calls ?? 0} 次 · 已报告 ${dm.budget?.totalTokens ?? 0} token · ${dm.budget?.unknownUsageCalls ?? 0} 次用量未知`),
          actionRow(
            button(
              state.dmBusy ? "主持正在提议…" : "请主持提议",
              () => controller.proposeDM(),
              { small: true, disabled: !canAct(state) || !dm.available || isDraft || current.step !== "choose" || state.dmBusy || snapshot.autonomy.enabled || dm.remainingCalls <= 0, key: "dm-propose" }
            ),
            state.dmBusy || dm.pending || dm.proposal ? button("取消主持提议", () => controller.cancelDM(), { small: true, quiet: true, key: "dm-cancel" }) : null
          )
        );
        if (dm.proposal) {
          const label2 = pending?.options.find((option) => option.id === dm.proposal.optionId)?.label ?? dm.proposal.optionId;
          dmCard.append(
            node(
              "div",
              { class: "sw-reason" },
              node("div", { class: "sw-kicker" }, "主持提议 · 尚未发生"),
              node("p", {}, dm.proposal.narration),
              node("p", {}, `建议选项：${label2}`)
            ),
            button("明确采用这个选项", () => controller.applyDM(), { small: true, primary: true, disabled: !ownerTurn || isDraft || state.dmBusy || current.step !== "choose", key: "dm-apply" })
          );
        }
      }
      right.append(dmCard);
    }
    right.append(node(
      "section",
      { class: "sw-card sw-card-pad" },
      node("div", { class: "sw-side-title" }, icon("pin"), "这一趟的足迹"),
      timeline(current.timeline),
      note("这里只记录已经发生的片段。")
    ));
    return node("div", { class: "sw-grid sw-play" }, left, right);
  }
  function playImmersive(state, current) {
    const isDraft = current.state === "draft";
    const pending = current.pending;
    const joint = pending?.actor === "joint" ? current.joint : null;
    const events = list(current.events);
    const wrap = node("div", { class: "sw-imm" });
    wrap.append(scene(null, text(current.area, current.placeName), "", { location: current.locationArt, class: "sw-imm-scene", tag: text(current.placeName, "当前地点") }));
    wrap.append(node(
      "div",
      { class: "sw-imm-body" },
      node("div", { class: "sw-kicker" }, isDraft ? "等待继续" : `此刻 · ${text(current.area, current.placeName)}`),
      node("p", { class: "sw-imm-lead" }, text(events.at(-1), current.step === "move" ? "路就在眼前。走近一点，看看会遇见什么。" : "这一趟的故事，将随着真实的行动在这里展开。")),
      pending?.prompt ? node("p", { class: "sw-imm-ask" }, text(pending.prompt)) : null,
      joint ? note(joint.note) : null
    ));
    if (pending) {
      const { block, canSubstitute } = pendingPicker(state, current, "sw-imm-choices");
      if (joint) wrap.append(jointBoard(joint));
      wrap.append(block, note(optionsHint(state, current, canSubstitute)));
    } else {
      const advance = advanceButton(state, current, { block: true });
      if (advance) wrap.append(node("div", { class: "sw-imm-solo" }, advance));
    }
    wrap.append(immersiveBar(state, current));
    if (drawerOpen) wrap.append(historyDrawer(state, current));
    return wrap;
  }
  function playFreeImmersive(state, current) {
    const free = current.free ?? { turn: 0, maxTurns: 0, log: [], summary: "", ended: null };
    const turnsLeft = Number.isInteger(free.turnsLeft) ? free.turnsLeft : Math.max(0, Number(free.maxTurns) - Number(free.turn));
    const capped = !free.ended && turnsLeft === 0;
    const isDraft = current.state === "draft";
    const log = list(free.log);
    const last = log.at(-1);
    const wrap = node("div", { class: "sw-imm" });
    wrap.append(scene(null, text(current.placeName), "", { location: current.locationArt, class: "sw-imm-scene", tag: "场景包" }));
    wrap.append(node(
      "div",
      { class: "sw-imm-body" },
      node("div", { class: "sw-kicker" }, free.ended ? "已收尾" : `第 ${text(free.segment, 1)} 段 · 还剩 ${turnsLeft} 回合`),
      node("p", { class: "sw-imm-lead" }, text(last?.narration, "开场已经在那里了。说一句想做的事，故事就会往下走。")),
      last?.say ? node("p", { class: "sw-imm-ask" }, `你刚才说：「${text(last.say)}」`) : null,
      free.summary ? note(`到目前为止：${free.summary}`) : null
    ));
    const input = node("textarea", { class: "sw-free-input", rows: "2", placeholder: capped ? "这一段说完了，可以再来一段。" : "这一回合你想做什么？", "aria-label": "这一回合做什么", disabled: isDraft || Boolean(free.ended) || capped });
    const send = button("说这一句", async () => {
      const say = input.value.trim();
      if (!say || !canAct(state)) return;
      await controller.mutate("say", { say });
    }, { primary: true, key: "free-say", disabled: !canAct(state) || isDraft || Boolean(free.ended) || capped });
    wrap.append(node(
      "div",
      { class: "sw-imm-compose" },
      input,
      actionRow(send, free.canContinue ? button(
        `再来一段 · 还能 ${text(free.segmentsLeft, 0)} 段`,
        () => controller.continueSegment(),
        { primary: true, icon: "arrow", key: "free-segment", disabled: !canAct(state) || state.loading || state.recovering || Boolean(state.busy) }
      ) : null)
    ));
    wrap.append(node(
      "div",
      { class: "sw-imm-bar" },
      button(`回看 ${log.length}`, () => {
        drawerOpen = !drawerOpen;
        render();
      }, { small: true, key: "imm-history", pressed: drawerOpen }),
      node(
        "div",
        { class: "sw-imm-bar-actions" },
        free.ended ? button("收起这一段", () => controller.mutate("close"), { primary: true, icon: "home", disabled: !canAct(state), key: "free-close" }) : button("先收起", () => controller.mutate("close"), { small: true, quiet: true, disabled: !canAct(state), key: "free-close-early" })
      )
    ));
    if (drawerOpen) {
      const body = node("div", { class: "sw-drawer-body" });
      if (log.length) body.append(node("ol", { class: "sw-free-log" }, log.map((entry) => node(
        "li",
        {},
        node("small", {}, text(entry.from, "这一回合")),
        entry.say ? node("p", { class: "sw-free-say" }, `「${text(entry.say)}」`) : null,
        node("p", { class: "sw-prose" }, text(entry.narration))
      ))));
      else body.append(note("还没有发生的回合。"));
      wrap.append(node(
        "div",
        { class: "sw-drawer", role: "dialog", "aria-label": "这一段的回看" },
        node(
          "div",
          { class: "sw-drawer-head" },
          node("div", {}, node("div", { class: "sw-kicker" }, "这一段"), node("strong", {}, `回看 · ${log.length} 回合`)),
          button("回到此刻", () => {
            drawerOpen = false;
            render();
          }, { small: true, key: "imm-drawer-close" })
        ),
        body
      ));
    }
    return wrap;
  }
  async function askConfirm(title, body) {
    if (ctx.ui?.confirm) return Boolean(await ctx.ui.confirm({ title, body }));
    if (typeof globalThis.confirm === "function") return Boolean(globalThis.confirm(body));
    return true;
  }
  async function removeMemory(memory) {
    if (!await askConfirm("移到回收站？", `把《${text(memory.title, "这条回忆")}》移到回收站？这趟行程会从回忆和纪念册里消失，可以在回收站恢复。`)) return;
    try {
      await ownCall("deleteMemory", { memoryId: memory.id });
      localNotice = "已移到回收站，可以在那里恢复。";
      localError = "";
      await controller.refresh();
    } catch (error) {
      localError = error?.message ?? "删除失败，请重试。";
      localNotice = "";
      render();
    }
  }
  async function restoreTrash(entry) {
    try {
      await ownCall("restoreMemory", { trashId: entry.id });
      localNotice = "这条回忆已经放回纪念册。";
      localError = "";
      await controller.refresh();
    } catch (error) {
      localError = error?.message ?? "恢复失败，请重试。";
      localNotice = "";
      render();
    }
  }
  async function purgeTrash(entry) {
    if (!await askConfirm("彻底删除？", `《${text(entry.title, "这条回忆")}》会从回收站里彻底删掉，不能恢复。`)) return;
    try {
      await ownCall("purgeMemory", { trashId: entry.id });
      localNotice = "已彻底删除。";
      localError = "";
      await controller.refresh();
    } catch (error) {
      localError = error?.message ?? "删除失败，请重试。";
      localNotice = "";
      render();
    }
  }
  async function emptyTrash() {
    if (!await askConfirm("清空回收站？", "回收站里的回忆会全部彻底删除，不能恢复。")) return;
    try {
      await ownCall("emptyTrash");
      localNotice = "回收站已清空。";
      localError = "";
      await controller.refresh();
    } catch (error) {
      localError = error?.message ?? "清空失败，请重试。";
      localNotice = "";
      render();
    }
  }
  function trashSection(trash) {
    const rows = trash.length ? trash.map((entry) => node(
      "div",
      { class: "sw-trash-row" },
      node(
        "div",
        { class: "sw-trash-meta" },
        node("strong", {}, text(entry.title, "一条回忆")),
        node("small", {}, `${text(entry.placeName)} · 删除于 ${date(entry.deletedAt)}`),
        entry.complete ? badge("当时已完结") : null
      ),
      actionRow(
        button("恢复", () => void restoreTrash(entry), { small: true, key: `restore-${entry.id}` }),
        button("彻底删除", () => void purgeTrash(entry), { small: true, quiet: true, danger: true, key: `purge-${entry.id}` })
      )
    )) : [note("回收站是空的。")];
    return node(
      "details",
      { class: "sw-details sw-trash" },
      node("summary", {}, `回收站（${trash.length}）`),
      node(
        "div",
        { class: "sw-card sw-card-pad sw-trash-body" },
        node("p", { class: "sw-card-note" }, "删掉的回忆先放这里；可以恢复，也可以彻底删除。纪念品架是独立账本，不跟着这一趟消失。"),
        node("div", { class: "sw-trash-list" }, rows),
        trash.length ? actionRow(button("清空回收站", () => void emptyTrash(), { small: true, quiet: true, danger: true, key: "empty-trash" })) : null
      )
    );
  }
  function memories(state) {
    const items = list(state.snapshot.memories);
    const trash = list(state.snapshot.trash);
    const filtered = items.filter((item) => memoryFilter === "all" || (memoryFilter === "complete" ? item.complete : !item.complete));
    const fragment = node(
      "div",
      {},
      node("div", { class: "sw-lead" }, node("h2", {}, "走过的路，都有回声"), node("p", {}, "只收录真实发生的片段。每次出发，都会留下自己的一页。")),
      node("div", { class: "sw-filter", "aria-label": "筛选回忆" }, [["all", `全部 ${items.length}`], ["complete", "完整故事"], ["partial", "中途回家"]].map(([id, title]) => node("button", { type: "button", class: "sw-btn", "aria-pressed": String(memoryFilter === id), "data-focus": `filter-${id}`, onclick: () => {
        memoryFilter = id;
        render();
      } }, title)))
    );
    if (!filtered.length) {
      fragment.append(empty(items.length ? "这里暂时没有这样的回忆" : "纪念册的第一页，留给下一次出发", items.length ? "换一个筛选条件看看。" : "完成一趟短短的旅程，或中途回家，已经发生的片段都会留在这里。", button("看看故事", () => navigate("stories"), { icon: "arrow", primary: true, key: "memories-start" })));
      fragment.append(trashSection(trash));
      return fragment;
    }
    fragment.append(node("div", { class: "sw-memory-grid" }, filtered.map((memory) => {
      const details = trackedDetails(`memory-${memory.id}`, node("summary", {}, icon("chevron"), "翻开这一页"), timeline(memory.timeline, "这趟没有记录到事件片段。"), choiceRecords(memory.choices));
      details.classList.add("sw-memory-details");
      const actions = [];
      if (memory.summary) actions.push(button("复制事实摘要", async () => {
        try {
          const clipboard = root.ownerDocument?.defaultView?.navigator?.clipboard;
          if (!clipboard?.writeText) throw new Error("剪贴板不可用");
          await clipboard.writeText(memory.summary);
          localNotice = "已复制事实摘要；没有写入日程或长期记忆。";
          localError = "";
          render();
        } catch {
          localNotice = "复制不可用。事实摘要可从下方文本中手动复制；没有写入日程或长期记忆。";
          localError = "";
          render();
        }
      }, { small: true, key: `copy-recap-${memory.id}` }));
      const forkable = (memory.checkpoints ?? []).filter((checkpoint) => checkpoint.resumable === true);
      if (forkable.length && !state.snapshot.trip) actions.push(button("从最近可继续检查点开分支", () => {
        const checkpoint = forkable.at(-1);
        if (!checkpoint) return;
        void controller.fork(memory.id, checkpoint.id).then((created) => {
          if (created && !disposed) navigate("play");
        });
      }, { small: true, key: `fork-${memory.id}` }));
      actions.push(button("移到回收站", () => void removeMemory(memory), { small: true, quiet: true, danger: true, key: `delete-${memory.id}` }));
      return node("article", { class: "sw-card sw-memory" }, node(
        "div",
        { class: "sw-card-pad" },
        badge(memory.complete ? "故事完成" : "中途回家", !memory.complete),
        node("h3", {}, text(memory.title, "这一趟的回忆")),
        node("div", { class: "sw-memory-place" }, text(memory.placeName)),
        node("p", { class: "sw-memory-preview" }, text(memory.summary, list(memory.timeline).at(-1)?.text ?? "按实际发生的经历收好，未发生的结局不会补写。")),
        memory.sourceRunId ? note(`分支来源 runId：${memory.sourceRunId} · ${memory.canonical ? "正史" : "隔离分支"}`) : null,
        node("div", { class: "sw-memory-date" }, date(memory.endedAt)),
        actionRow(...actions),
        details
      ));
    })));
    fragment.append(trashSection(trash));
    return fragment;
  }
  function buildAdvancedSettings() {
    const mask = "••••••••";
    const model = {
      saved: false,
      supported: true,
      loaded: false,
      busy: "",
      revision: 0,
      workflow: "",
      workflowTouched: false,
      imagesEnabled: false,
      direct: false,
      apiKey: { value: "", touched: false, revision: 0 }
    };
    const status = node("p", { class: "sw-note", role: "status", "aria-live": "polite" });
    const error = node("p", { class: "sw-settings-error", role: "alert" });
    const support = note("");
    const saved = node("span", { class: "sw-badge", "data-settings-saved": "" });
    const imageBadge = node("span", { class: "sw-badge sw-settings-state", "data-settings-image-state": "" });
    const keyInput = node("input", {
      type: "password",
      autocomplete: "new-password",
      spellcheck: "false",
      "data-focus": "settings-apiKey",
      "aria-label": t.storyDmApiKey,
      "data-private-setting": "apiKey"
    });
    const repaintKey = () => {
      keyInput.value = model.apiKey.value || model.saved ? mask : "";
    };
    keyInput.addEventListener("input", () => {
      model.apiKey.value = keyInput.value;
      model.apiKey.touched = true;
      ++model.apiKey.revision;
      ++model.revision;
      paint();
    });
    keyInput.addEventListener("focus", () => {
      if (keyInput.value === mask) keyInput.value = "";
    });
    keyInput.addEventListener("blur", repaintKey);
    const workflow = node("textarea", {
      rows: "6",
      spellcheck: "false",
      class: "sw-workflow-json",
      "data-focus": "settings-workflow",
      "aria-label": t.storyImageWorkflowLabel,
      placeholder: t.storyImageWorkflowPlaceholder
    });
    workflow.addEventListener("input", () => {
      model.workflow = workflow.value;
      model.workflowTouched = true;
      paint();
    });
    const workflowBadge = node("span", { class: "sw-badge sw-settings-state", "data-settings-workflow-state": "" });
    const workflowBox = node(
      "details",
      { class: "sw-settings-workflow" },
      node("summary", {}, node("span", {}, t.storyImageWorkflowTitle), workflowBadge),
      node("p", { class: "sw-card-note" }, t.storyImageWorkflowSummary),
      node("label", { class: "sw-setting-field" }, t.storyImageWorkflowLabel, workflow),
      note(t.storyImageWorkflowHint)
    );
    const manualButton = button(t.storyImageManual, () => void requestImage(), { key: "story-image" });
    const save = button(t.settingsSave, async () => {
      if (model.busy) return;
      const args = {};
      if (model.apiKey.touched) args.apiKey = model.apiKey.value.trim();
      if (model.workflowTouched) {
        args.workflow = model.workflow.trim();
        if (args.workflow) {
          try {
            JSON.parse(args.workflow);
          } catch {
            error.textContent = t.storyImageWorkflowInvalid;
            return;
          }
          if (!args.workflow.includes("{{prompt}}")) {
            error.textContent = t.storyImageWorkflowNoPrompt;
            return;
          }
          if (args.workflow.length > 32 * 1024) {
            error.textContent = t.storyImageWorkflowInvalid;
            return;
          }
        }
      }
      const revision = model.revision;
      const keyRevision = model.apiKey.revision;
      model.busy = "save";
      status.textContent = t.settingsSaving;
      error.textContent = "";
      paint();
      repaintKey();
      try {
        const result = await ownCall("saveStorySettings", args);
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok) {
          if (result) applySafeView(result);
          if (result?.partial === "dm") {
            clearPrivate();
            model.apiKey.touched = false;
          }
          error.textContent = result?.partial === "dm" ? t.settingsPartialDm : result?.error || t.settingsFailure;
          return;
        }
        applySafeView(result);
        if (model.apiKey.revision === keyRevision) {
          model.apiKey.value = "";
          model.apiKey.touched = false;
        }
        if (Object.hasOwn(args, "workflow") && model.workflow.trim() === args.workflow) {
          model.workflowTouched = false;
          workflow.value = model.workflow = savedWorkflow;
        }
        status.textContent = t.settingsSaved;
        if (revision === model.revision) error.textContent = "";
      } catch {
        if (!disposed) error.textContent = t.settingsFailure;
      } finally {
        if (!disposed) {
          model.busy = "";
          paint();
          repaintKey();
        }
      }
    }, { primary: true, key: "settings-save" });
    const cancel = button(t.settingsCancel, () => {
      clearPrivate();
      model.workflowTouched = false;
      workflow.value = model.workflow = savedWorkflow;
      ++model.revision;
      error.textContent = "";
      status.textContent = t.settingsCancelled;
      paint();
    }, { quiet: true, key: "settings-cancel" });
    const clear = button(t.storyDmApiClear, async () => {
      if (model.busy) return;
      clearPrivate();
      ++model.revision;
      model.busy = "clear";
      error.textContent = "";
      status.textContent = t.settingsClearing;
      paint();
      try {
        const result = await ownCall("clearStoryKey");
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok) throw new Error();
        applySafeView(result);
        model.saved = false;
        clearPrivate();
        status.textContent = t.settingsCleared;
      } catch {
        if (!disposed) error.textContent = t.settingsClearFailure;
      } finally {
        if (!disposed) {
          model.busy = "";
          paint();
          repaintKey();
        }
      }
    }, { danger: true, key: "settings-clear" });
    const reload = button(t.settingsReload, () => void load(), { quiet: true, key: "settings-reload" });
    let savedWorkflow = "";
    function applySafeView(result) {
      if (typeof result.dm?.saved === "boolean") model.saved = result.dm.saved;
      if (typeof result.dm?.supported === "boolean") model.supported = result.dm.supported;
      if (typeof result.imageWorkflow === "string") {
        savedWorkflow = result.imageWorkflow;
        if (!model.workflowTouched) workflow.value = model.workflow = savedWorkflow;
      }
      if (typeof result.imagesEnabled === "boolean") setImageState({ enabled: result.imagesEnabled });
    }
    function clearPrivate() {
      model.apiKey.value = "";
      model.apiKey.touched = false;
      repaintKey();
    }
    function paint() {
      const dirty = model.apiKey.touched || model.workflowTouched;
      saved.textContent = dirty ? t.storyDmApiPending : model.saved ? t.storyDmApiSaved : t.storyDmApiUnset;
      support.textContent = model.supported ? "" : t.storyDmApiUnsupported;
      save.disabled = Boolean(model.busy) || !model.loaded || !dirty;
      clear.disabled = Boolean(model.busy) || !model.loaded || !model.saved;
      cancel.disabled = Boolean(model.busy) || !dirty;
      reload.disabled = Boolean(model.busy);
      keyInput.disabled = !model.supported;
      const hasWorkflow = Boolean(model.workflow.trim());
      workflowBadge.textContent = hasWorkflow ? t.storyImageWorkflowOn : t.storyImageWorkflowOff;
      workflowBadge.className = hasWorkflow ? "sw-badge sw-settings-state sw-settings-state-on" : "sw-badge sw-settings-state";
      imageBadge.textContent = model.imagesEnabled ? t.storyImageOn : t.storyImageOff;
      imageBadge.className = model.imagesEnabled ? "sw-badge sw-settings-state sw-settings-state-on" : "sw-badge sw-settings-state";
      manualButton.disabled = Boolean(model.busy) || imageBusy || !model.imagesEnabled;
      manualButton.textContent = imageBusy ? t.storyImagePending : t.storyImageManual;
      manualCard.hidden = !model.direct;
      container.setAttribute("aria-busy", String(Boolean(model.busy)));
    }
    function setImageState({ enabled, direct } = {}) {
      if (typeof enabled === "boolean") model.imagesEnabled = enabled;
      if (typeof direct === "boolean") model.direct = direct;
      paint();
    }
    async function load() {
      if (model.busy) return;
      model.busy = "read";
      status.textContent = t.settingsLoading;
      error.textContent = "";
      paint();
      try {
        const result = await ownCall("storySettings");
        if (disposed || ctx.signal?.aborted) return;
        if (!result?.ok) throw new Error();
        applySafeView(result);
        model.loaded = true;
        status.textContent = "";
        repaintKey();
      } catch {
        if (!disposed) error.textContent = t.settingsLoadFailure;
      } finally {
        if (!disposed) {
          model.busy = "";
          paint();
        }
      }
    }
    const saveBar = node("div", { class: "sw-settings-actions" }, actionRow(save, cancel, clear, reload));
    const keyCard = node(
      "section",
      { class: "sw-card sw-card-pad sw-private-settings-card" },
      node(
        "div",
        { class: "sw-settings-card-head" },
        node("div", { class: "sw-settings-card-title" }, icon("settings"), node("div", {}, node("h3", {}, t.settingsKeyTitle), node("p", { class: "sw-card-summary" }, t.settingsKeySummary))),
        saved
      ),
      node("label", { class: "sw-setting-field" }, t.storyDmApiKey, keyInput),
      note(t.settingsKeyHint),
      support,
      node("details", { class: "sw-settings-help" }, node("summary", {}, t.storyDmHelpSummary), note(t.storyDmApiHint))
    );
    const manualCard = node(
      "section",
      { class: "sw-card sw-card-pad sw-settings-manual" },
      node("div", { class: "sw-settings-subhead" }, node("div", {}, node("h3", {}, t.settingsImageManualTitle), node("p", { class: "sw-card-summary" }, t.settingsImageManualSummary)), imageBadge),
      node("p", { class: "sw-card-note" }, t.settingsImageManualHint),
      node("div", { class: "sw-settings-actions" }, actionRow(manualButton)),
      imageOutput,
      workflowBox
    );
    manualCard.hidden = true;
    const container = node("div", { class: "sw-settings-stack sw-private-settings" }, keyCard, manualCard, saveBar, status, error);
    paint();
    return { node: container, load, clear: clearPrivate, setImageState };
  }
  async function requestImage() {
    if (imageBusy) return;
    const previousImage = imageOutput.querySelector(".sw-generated-image");
    const previousDelegation = imageOutput.querySelector(".sw-delegation");
    const show = (message) => imageOutput.replaceChildren(note(message), ...[previousDelegation, previousImage].filter(Boolean));
    imageBusy = true;
    show(t.storyImagePending);
    render();
    try {
      const result = await ownCall("storyImage");
      if (disposed || ctx.signal?.aborted) return;
      if (!result?.ok || !result.image) throw new Error();
      imageResult = result.image;
      const image = imageResult;
      show(image.status === "delegated" ? t.storyImageDelegated : image.status === "ready" ? t.storyImageDirect : t.storyImageUnavailable);
      if (image.message) imageOutput.append(note(text(image.message)));
      if (image.status === "delegated") {
        const output = node("textarea", { class: "sw-delegation", rows: "7", readonly: "", "aria-label": t.storyImageParams });
        output.value = JSON.stringify({ source: image.source, scene: image.scene, outfits: image.outfits, prompt: image.prompt }, null, 2);
        previousDelegation?.remove();
        imageOutput.append(output);
      }
      if (image.status === "ready" && image.imageId) {
        const read = await ownCall("storyImageRead", { id: image.imageId });
        if (disposed || ctx.signal?.aborted) return;
        if (!read?.ok || !/^data:image\/(?:png|jpe?g|webp);base64,[A-Za-z\d+/]+=*$/.test(read.image?.dataUrl ?? "")) throw new Error();
        const picture = node("img", { class: "sw-generated-image", src: read.image.dataUrl, alt: t.storyImageAlt });
        picture.addEventListener("error", () => {
          picture.remove();
          show(t.storyImageFailed);
        }, { once: true });
        previousImage?.remove();
        imageOutput.append(picture);
      }
    } catch {
      if (!disposed) show(t.storyImageFailed);
    } finally {
      imageBusy = false;
      if (!disposed) render();
    }
  }
  function settings(state) {
    if (!advancedSettings) {
      advancedSettings = buildAdvancedSettings();
      void advancedSettings.load();
    }
    const images = state?.snapshot?.images ?? {};
    advancedSettings.setImageState({ enabled: images.enabled === true, direct: images.sourceKind === "comfyui" });
    return node(
      "div",
      { class: "sw-stack" },
      node("div", { class: "sw-lead" }, node("h2", {}, t.settingsTitle), node("p", {}, t.settingsIntro)),
      advancedSettings.node,
      node(
        "section",
        { class: "sw-settings-part" },
        node("div", { class: "sw-settings-part-head" }, node("h3", {}, t.settingsPartElsewhere)),
        node(
          "section",
          { class: "sw-card sw-card-pad" },
          node("div", { class: "sw-side-title" }, icon("settings"), t.settingsElsewhereTitle),
          node(
            "ul",
            { class: "sw-where-list" },
            node("li", {}, t.settingsWhereLength),
            node("li", {}, t.settingsWhereArtwork)
          ),
          node("p", { class: "sw-card-note" }, t.settingsElsewhereNote)
        )
      )
    );
  }
  const playKey = (current) => current ? `${current.id}:${text(current.stamp)}:${list(current.events).length}:${list(current.free?.log).length}` : "";
  function render() {
    if (disposed || ctx.signal?.aborted) return;
    const state = controller?.state;
    const snapshot = state?.snapshot;
    const focused = root.ownerDocument?.activeElement;
    const focusKey = shell2.contains(focused) ? focused?.getAttribute?.("data-focus") : null;
    for (const detail of main.querySelectorAll("details[data-details]")) {
      if (detail.open) openDetails.add(detail.getAttribute("data-details"));
      else openDetails.delete(detail.getAttribute("data-details"));
    }
    const scroller = main.querySelector('[data-focus="play-reading"]');
    if (scroller) {
      const top2 = Number(scroller.scrollTop) || 0;
      const height = Number(scroller.clientHeight) || 0;
      const total = Number(scroller.scrollHeight) || 0;
      playScroll = { key: playKey(snapshot?.trip), top: top2, atBottom: top2 + height >= total - 24 };
    } else if (view !== "play") {
      playScroll = { key: "", top: 0, atBottom: true };
    }
    top.replaceChildren(
      node("div", { class: "sw-brand" }, node("span", { class: "sw-logo" }, icon("fish")), node("div", {}, node("strong", {}, "故事工坊"), node("small", {}, "把日常，慢慢过成故事"))),
      node(
        "div",
        { class: "sw-top-actions" },
        node("span", { class: "sw-status" }, node("span", { class: "sw-dot" }), snapshot?.trip ? "旅途进行中" : "欢迎回家"),
        autoImageSwitch(snapshot),
        button(
          immersive ? "沉浸中" : "沉浸",
          () => {
            immersive = !immersive;
            drawerOpen = false;
            render();
          },
          { quiet: !immersive, primary: immersive, small: true, icon: immersive ? "book" : "image", key: "immersive", pressed: immersive, ariaLabel: immersive ? "退出沉浸模式，回到对话式" : "切换沉浸模式：一屏一幕" }
        ),
        button("刷新", () => controller?.refresh(), { quiet: true, small: true, icon: "refresh", disabled: !state || state.loading || Boolean(state.busy) || state.recovering, key: "refresh" })
      )
    );
    nav.replaceChildren(...[["home", "鱼的家", "home"], ["stories", "作品库", "leaf"], ["play", "出游", "pin"], ["memories", "行程回忆", "book"], ["settings", t.settingsTab, "image"], ["author", t.storyWrite, "book"]].map(([id, title, glyph]) => node(
      "button",
      { type: "button", class: "sw-tab", "aria-current": view === id ? "page" : void 0, "aria-controls": "story-panel-content", "data-focus": `nav-${id}`, onclick: () => navigate(id) },
      icon(glyph),
      title,
      id === "memories" && list(snapshot?.memories).length ? node("span", { class: "sw-count" }, list(snapshot.memories).length) : null
    )));
    const notices = [];
    if (state?.loading || state?.recovering) notices.push(node("div", { class: "sw-loader", role: "progressbar", "aria-label": state.recovering ? "正在核对实际进度" : "正在读取故事状态" }));
    for (const [message, error] of [[state?.error, true], [localError, true], [conflict(snapshot), true], [localNotice || state?.notice, false]]) {
      if (!message) continue;
      notices.push(node(
        "div",
        { class: `sw-notice${error ? " sw-notice-error" : ""}`, role: error ? "alert" : "status" },
        icon("info"),
        node("p", {}, message),
        error ? button("读取最新进度", () => controller?.refresh(), { small: true, disabled: state?.loading || Boolean(state?.busy) || state?.recovering, key: "retry-status" }) : null
      ));
    }
    feedback3.replaceChildren(...notices);
    if (view === "author") main.replaceChildren(authorView());
    else if (view === "settings") main.replaceChildren(settings(state));
    else if (!snapshot) main.replaceChildren(empty(state?.loading ? "正在打开故事世界" : "暂时没有读到故事状态", state?.loading ? "从实际记录中，找回这一刻。" : "请检查故事调用适配器或服务连接，再读取最新进度。"));
    else main.replaceChildren(({ home, stories, play, memories }[view] ?? home)(state));
    main.setAttribute("aria-busy", String(Boolean(state?.loading || state?.recovering)));
    const nextScroller = main.querySelector('[data-focus="play-reading"]');
    if (nextScroller) {
      const key = playKey(snapshot?.trip);
      const fresh = key !== playScroll.key;
      if (fresh || playScroll.atBottom) nextScroller.scrollTop = Number(nextScroller.scrollHeight) || 0;
      else nextScroller.scrollTop = playScroll.top;
      playScroll = { key, top: Number(nextScroller.scrollTop) || 0, atBottom: fresh || playScroll.atBottom };
    }
    if (focusKey) for (const candidate of shell2.querySelectorAll("[data-focus]")) {
      if (candidate.getAttribute("data-focus") === focusKey && !candidate.disabled) {
        candidate.focus({ preventScroll: true });
        break;
      }
    }
  }
  controller = createStoryController(ctx, render);
  render();
  function dispose() {
    if (disposed) return;
    advancedSettings?.clear();
    controller.dispose();
    disposed = true;
    ctx.signal?.removeEventListener("abort", dispose);
    if (shell2.parentNode === root) shell2.remove();
  }
  ctx.signal?.addEventListener("abort", dispose, { once: true });
  return { dispose, refresh: () => controller.refresh() };
}

// webui/story-mount.js
var PAUSE_PATH = "/api/webui/providers/world%3Afun/panels/story/pause";
function mountFishStory(ctx) {
  async function storyCall(method, payload, options = {}) {
    const args = payload === void 0 ? [] : [payload];
    if (method === "pause" && options.keepalive) {
      const response = await fetch(PAUSE_PATH, {
        method: "POST",
        keepalive: true,
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ args })
      });
      if (!response.ok) throw new Error(`暂停请求失败（HTTP ${response.status}）`);
      return response.json();
    }
    let timer;
    try {
      return await Promise.race([
        ctx.invoke(method, args),
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error("宿主请求超时，请重新读取进度。")), options.timeoutMs ?? 2e4);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }
  return mountPanel(ctx.root, { ...ctx, storyCall });
}

// webui/places/helpers.js
var list2 = (value) => Array.isArray(value) ? value : [];
function dom(document2) {
  function node2(tag, attributes, ...children) {
    const element = document2.createElement(tag);
    for (const [name, value] of Object.entries(attributes ?? {})) {
      if (value == null) continue;
      if (name === "class") element.className = value;
      else if (["checked", "disabled", "required", "selected"].includes(name)) element[name] = Boolean(value);
      else if (name.startsWith("on")) element.addEventListener(name.slice(2), value);
      else element.setAttribute(name, String(value));
    }
    for (const child of children.flat(Infinity)) {
      if (child != null && child !== false) element.append(typeof child === "object" ? child : String(child));
    }
    return element;
  }
  const row = (...children) => node2("div", { class: "fpl-row" }, children);
  const note2 = (content) => node2("p", { class: "fpl-muted fpl-wrap" }, content);
  const button2 = (text2, callback, attrs = {}) => node2("button", { type: "button", onclick: callback, ...attrs }, text2);
  const field = (label2, control, hint) => node2("label", { class: "fpl-field" }, label2, control, hint ? note2(hint) : null);
  const option = (value, label2) => node2("option", { value }, label2);
  const chip = (text2) => node2("span", { class: "fpl-chip" }, text2);
  return { node: node2, row, note: note2, button: button2, field, option, chip };
}
function styleDescription(place) {
  if (place.styleSource === "place" || place.style?.trim()) return "地点画风";
  if (place.styleSource === "source-default") return "补录的旧世界默认画风";
  if (place.effectiveStyle) return "从0开始的肥鱼大冒险默认画风";
  return "未设置";
}
function hasSafeImage(dataUrl) {
  return typeof dataUrl === "string" && /^data:image\/(?:png|jpeg|jpg|gif|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(dataUrl);
}
function selectedMappings(items, decisions) {
  const usedTargets = /* @__PURE__ */ new Set();
  return items.map((item) => {
    const choice = decisions.get(item.sourceId);
    if (!choice || !["new", "bind", "skip"].includes(choice.action)) throw new Error(`请选择「${item.name}」的迁入方式。`);
    if (choice.action !== "bind") return { sourceId: item.sourceId, action: choice.action };
    if (!choice.targetId) throw new Error(`请为「${item.name}」选择接收地点。`);
    if (usedTargets.has(choice.targetId)) throw new Error("同一个本地地点只能接收一条来源记录。");
    usedTargets.add(choice.targetId);
    return { sourceId: item.sourceId, action: choice.action, targetId: choice.targetId, policy: choice.policy === "overwrite" ? "overwrite" : "keep" };
  });
}
function pictureData(file, maxBytes, FileReaderClass = globalThis.FileReader) {
  const supported = /^(?:image\/(?:png|jpeg|jpg|gif|webp))$/;
  if (!file || !file.size || file.size > maxBytes) throw new Error(`请选择大小在 ${maxBytes / (1024 * 1024)} MiB 以内的图片。`);
  if (file.type && !supported.test(file.type)) throw new Error("请选择 PNG、JPEG、GIF 或 WebP 图片。");
  return new Promise((resolve, reject) => {
    const reader = new FileReaderClass();
    reader.onload = () => {
      let result = reader.result;
      if (typeof result === "string" && result.startsWith("data:application/octet-stream;base64,")) {
        const mime = { png: "png", jpg: "jpeg", jpeg: "jpeg", gif: "gif", webp: "webp" }[file.name?.toLowerCase().split(".").at(-1)];
        if (mime) result = result.replace("application/octet-stream", `image/${mime}`);
      }
      if (hasSafeImage(result)) resolve(result);
      else reject(new Error("没有读到受支持的图片。"));
    };
    reader.onerror = () => reject(new Error("无法读取这张图片。"));
    reader.onabort = () => reject(new Error("图片读取已取消。"));
    reader.readAsDataURL(file);
  });
}

// webui/home/layout.js
var HOME_LAYOUT = Object.freeze({
  idle: { x: 0.52, y: 0.93, scale: 0.4 },
  reading: { x: 0.4, y: 0.92, scale: 0.3 },
  watching: { x: 0.6, y: 0.93, scale: 0.3 },
  cards: { x: 0.34, y: 0.93, scale: 0.3 },
  gaming: { x: 0.5, y: 0.955, scale: 0.28 },
  chatting: { x: 0.62, y: 0.93, scale: 0.32 },
  cooking: { x: 0.13, y: 0.93, scale: 0.4 },
  painting: { x: 0.3, y: 0.93, scale: 0.36 },
  looking_outside: { x: 0.21, y: 0.93, scale: 0.4 },
  sleeping: { x: 0.45, y: 0.94, scale: 0.26 }
});
var HOME_FALLBACK = Object.freeze({ x: 0.52, y: 0.93, scale: 0.4 });
var positionOf = (activity) => HOME_LAYOUT[activity] ?? HOME_FALLBACK;

// webui/home/styles.js
var HOME_STYLES = `
/* 自己的主题 token：家是第一块页签，宿主可能只挂载这一块，
   不能指望别的面板先把 .fun 那层样式注进来。 */
.fhm{--f-line:var(--border,#e3e4e3);--f-ink:var(--foreground,#1b1a1e);--f-dim:var(--muted-foreground,#5c5c60);
  --f-card:var(--surface,#fbfbfb);--f-soft:color-mix(in srgb,var(--surface,#fbfbfb) 92%,var(--foreground,#1b1a1e));
  --f-accent:var(--accent,#00a870);--f-warm:#e0862f;--f-mint:#00a870;
  font:13px/1.6 var(--sans,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);
  color:var(--f-ink,#1b1a1e);max-width:1040px;margin:0 auto;padding:4px 2px 22px}
.fhm *{box-sizing:border-box}
.fhm-head{padding:2px 2px 10px}
.fhm-kicker{margin:0;font-size:11.5px;letter-spacing:.06em;color:var(--f-dim,#6b6b70)}
.fhm-title{margin:3px 0 0;font-size:22px;line-height:1.25;font-weight:650;letter-spacing:.01em}
.fhm-sub{margin:5px 0 0;font-size:12.5px;line-height:1.6;color:var(--f-dim,#6b6b70)}
.fhm-feedback{min-height:18px;font-size:12px;line-height:1.5;margin:2px 2px 8px;color:var(--f-dim,#6b6b70)}
.fhm-feedback[data-tone="error"]{color:#c0453c}
.fhm-feedback[data-tone="ok"]{color:var(--f-mint,#00a870)}

.fhm-stage{position:relative;aspect-ratio:16/9;max-height:min(62vh,600px);min-height:190px;border:1px solid var(--f-line,#e3e4e3);border-radius:14px;overflow:hidden;background:var(--f-soft,#f3efe9);isolation:isolate}
.fhm-stage:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}
.fhm-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;z-index:0;display:block}
.fhm-room{position:absolute;inset:0;z-index:0;
  background:
    linear-gradient(180deg,color-mix(in srgb,var(--f-warm,#e0862f) 10%,var(--f-soft,#f3efe9)) 0%,var(--f-soft,#f3efe9) 62%),
    linear-gradient(180deg,transparent 61%,color-mix(in srgb,var(--f-warm,#e0862f) 18%,var(--f-card,#fbfbfb)) 62%,color-mix(in srgb,var(--f-warm,#e0862f) 10%,var(--f-card,#fbfbfb)) 100%)}
.fhm-window{position:absolute;left:6%;top:14%;width:22%;height:42%;border-radius:8px 8px 4px 4px;
  background:linear-gradient(160deg,color-mix(in srgb,#cfe6f3 60%,var(--f-card,#fbfbfb)),color-mix(in srgb,#eaf4f8 45%,var(--f-card,#fbfbfb)) 60%,color-mix(in srgb,#f6fbfd 35%,var(--f-card,#fbfbfb)));
  border:3px solid color-mix(in srgb,var(--f-line,#e3e4e3) 80%,transparent);
  box-shadow:inset 0 0 22px color-mix(in srgb,#ffeebe 45%,transparent)}
.fhm-window::after{content:"";position:absolute;left:50%;top:0;bottom:0;width:3px;transform:translateX(-50%);background:color-mix(in srgb,var(--f-line,#e3e4e3) 85%,transparent)}
.fhm-sofa{position:absolute;right:9%;bottom:22%;width:30%;height:22%;border-radius:12px 12px 8px 8px;
  background:linear-gradient(180deg,color-mix(in srgb,var(--f-warm,#e0862f) 22%,var(--f-card,#fbfbfb)),color-mix(in srgb,var(--f-warm,#e0862f) 30%,var(--f-card,#fbfbfb)))}
.fhm-sofa::before{content:"";position:absolute;left:4%;right:4%;top:-30%;height:34%;border-radius:12px 12px 4px 4px;background:color-mix(in srgb,var(--f-warm,#e0862f) 18%,var(--f-card,#fbfbfb))}
.fhm-sofa::after{content:"";position:absolute;left:50%;top:8%;bottom:10%;width:1px;transform:translateX(-50%);
  background:color-mix(in srgb,var(--f-warm,#e0862f) 26%,transparent)}
.fhm-baseboard{position:absolute;left:0;right:0;bottom:22%;height:2px;background:color-mix(in srgb,var(--f-line,#e3e4e3) 70%,transparent)}
.fhm-rug{position:absolute;left:28%;bottom:6%;width:34%;height:16%;border-radius:50%;
  background:color-mix(in srgb,var(--f-warm,#e0862f) 14%,var(--f-card,#fbfbfb));border:1px dashed color-mix(in srgb,var(--f-line,#e3e4e3) 90%,transparent)}
.fhm-room-note{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);margin:0;font-size:11.5px;color:var(--f-dim,#6b6b70);text-align:center;line-height:1.7;z-index:1;pointer-events:none;width:80%}
.fhm-room-note b{display:block;font-weight:600;color:var(--f-ink,#1b1a1e);font-size:12.5px;margin-bottom:3px}

.fhm-light{position:absolute;inset:0;z-index:1;pointer-events:none;transition:background 240ms ease,opacity 240ms ease}
.fhm-light[data-phase="morning"]{background:linear-gradient(160deg,rgba(255,214,150,.20),rgba(255,236,205,.06));opacity:.7}
.fhm-light[data-phase="day"]{background:linear-gradient(160deg,rgba(255,246,224,.08),transparent 60%);opacity:.5}
.fhm-light[data-phase="dusk"]{background:linear-gradient(180deg,rgba(224,134,47,.22),rgba(120,60,90,.12));opacity:.7}
.fhm-light[data-phase="night"]{background:linear-gradient(180deg,rgba(38,52,92,.34),rgba(20,28,52,.28));opacity:.8}
.fhm-foreground{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:3;pointer-events:none}
.fhm-painting{position:absolute;z-index:1;left:34%;top:37%;width:12%;max-height:30%;object-fit:contain;
  transform:translateX(-50%);border-radius:2px;box-shadow:0 2px 6px rgba(24,24,30,.18)}

.fhm-char{position:absolute;z-index:2;max-width:46%;object-fit:contain;transform:translateX(-50%);
  filter:drop-shadow(0 10px 16px rgba(24,24,30,.14));transition:none;animation:fhm-char-in 180ms ease-out both}
.fhm-char-shadow{position:absolute;z-index:1;height:8%;min-height:14px;transform:translate(-50%,50%);
  border-radius:50%;pointer-events:none;
  background:radial-gradient(ellipse at center,rgba(24,24,30,.28),rgba(24,24,30,.12) 46%,transparent 72%);
  filter:blur(1.5px)}
@keyframes fhm-char-in{from{opacity:.25;transform:translateX(-50%) translateY(2px)}to{opacity:1;transform:translateX(-50%)}}
.fhm-char-hint{position:absolute;left:50%;bottom:7%;transform:translateX(-50%);margin:0;font-size:11px;color:var(--f-dim,#6b6b70);z-index:3;white-space:nowrap}

.fhm-status{position:absolute;left:10px;top:10px;margin:0;z-index:3;padding:3px 9px;border-radius:999px;font-size:11.5px;
  background:color-mix(in srgb,var(--f-card,#fbfbfb) 82%,transparent);color:var(--f-ink,#1b1a1e);backdrop-filter:blur(2px)}
.fhm-place{position:absolute;right:10px;top:10px;margin:0;z-index:3;padding:3px 9px;border-radius:999px;font-size:11.5px;
  background:color-mix(in srgb,var(--f-card,#fbfbfb) 82%,transparent);color:var(--f-dim,#6b6b70);max-width:46%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.fhm-place[data-out="1"]{color:var(--f-warm,#e0862f)}
.fhm-note{position:absolute;left:12px;bottom:12px;right:12px;margin:0;z-index:3;padding:6px 10px;border-radius:10px;font-size:12px;line-height:1.5;
  background:color-mix(in srgb,var(--f-card,#fbfbfb) 86%,transparent);color:var(--f-ink,#1b1a1e)}
.fhm-spot{position:absolute;z-index:4;width:26px;height:26px;border-radius:50%;transform:translate(-50%,-50%);
  border:1px solid color-mix(in srgb,var(--f-accent,#00a870) 60%,transparent);
  background:color-mix(in srgb,var(--f-accent,#00a870) 20%,var(--f-card,#fbfbfb));
  color:var(--f-accent,#00a870);font:inherit;font-size:18px;line-height:1;padding:0;cursor:pointer}
.fhm-spot:hover{border-color:var(--f-accent,#00a870);background:color-mix(in srgb,var(--f-accent,#00a870) 30%,var(--f-card,#fbfbfb))}
.fhm-spot:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}
.fhm-spot-bubble{position:absolute;z-index:6;transform:translate(-50%,-130%);max-width:74%;padding:4px 8px;border-radius:8px;
  font-size:11px;line-height:1.5;color:var(--f-ink,#1b1a1e);background:color-mix(in srgb,var(--f-card,#fbfbfb) 94%,transparent);
  border:1px solid var(--f-line,#e3e4e3);white-space:normal;pointer-events:none}
.fhm-spot-bubble[hidden]{display:none}

.fhm-keepsake{position:absolute;z-index:1;transform:translate(-50%,-50%);width:30px;height:30px;border-radius:50%;
  border:1px solid color-mix(in srgb,var(--f-line,#e3e4e3) 80%,transparent);cursor:pointer;font-size:15px;line-height:1;
  background:color-mix(in srgb,var(--f-card,#fbfbfb) 78%,transparent);padding:0}
.fhm-keepsake:hover{border-color:var(--f-accent,#00a870)}
.fhm-keepsake:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}
.fhm-keepsake-bubble{position:absolute;z-index:5;transform:translate(-50%,-120%);max-width:74%;padding:4px 8px;border-radius:8px;
  font-size:11px;line-height:1.5;color:var(--f-ink,#1b1a1e);background:color-mix(in srgb,var(--f-card,#fbfbfb) 94%,transparent);
  border:1px solid var(--f-line,#e3e4e3);white-space:normal;pointer-events:none}
.fhm-keepsake-bubble[hidden]{display:none}
.fhm-draft{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 2px 0;padding:8px 11px;border-radius:12px;
  border:1px dashed color-mix(in srgb,var(--f-warm,#e0862f) 55%,var(--f-line,#e3e4e3));
  background:color-mix(in srgb,var(--f-warm,#e0862f) 7%,var(--f-card,#fbfbfb))}
.fhm-draft-text{margin:0;font-size:12px;color:var(--f-ink,#1b1a1e)}
.fhm-draft button{font:inherit;font-size:11.5px;padding:3px 11px;border-radius:999px;cursor:pointer;border:1px solid var(--f-accent,#00a870);
  background:var(--f-accent,#00a870);color:#fff}
.fhm-draft button:disabled{opacity:.55;cursor:default}
.fhm-wish{margin:8px 2px 0;font-size:11.5px;line-height:1.6;color:var(--f-dim,#6b6b70)}
.fhm-plan{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 2px 0}
.fhm-plan-label{font-size:12px;color:var(--f-ink,#1b1a1e)}
.fhm-plan textarea{flex:1 1 240px;min-width:0;min-height:30px;resize:vertical;font:inherit;font-size:12px;line-height:1.5;
  padding:5px 9px;border:1px solid var(--f-line,#e3e4e3);border-radius:10px;background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}
.fhm-plan textarea:focus{border-color:var(--f-accent,#00a870);outline:none}
.fhm-plan button{font:inherit;font-size:12px;padding:4px 12px;border-radius:999px;cursor:pointer;border:1px solid var(--f-line,#e3e4e3);
  background:var(--f-card,#fbfbfb);color:var(--f-ink,#1b1a1e)}
.fhm-plan button:hover{border-color:var(--f-accent,#00a870)}
.fhm-plan .fhm-fine{margin-left:0}

.fhm-snaps{margin:10px 2px 0;border-top:1px dashed var(--f-line,#e3e4e3);padding-top:8px}
.fhm-snaps-head{display:flex;align-items:center;gap:8px}
.fhm-snaps-head button,.fhm-snap-row button{font:inherit;font-size:11px;padding:3px 9px;border-radius:999px;cursor:pointer;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-card,#fbfbfb);color:var(--f-ink,#1b1a1e)}
.fhm-snaps-head button:hover,.fhm-snap-row button:hover{border-color:var(--f-accent,#00a870)}
.fhm-snap-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:3px 0;font-size:11.5px;color:var(--f-ink,#1b1a1e)}
.fhm-snap-main{flex:1 1 220px;min-width:0;word-break:break-word}
.fhm-snap-missing{font-size:10.5px;color:#c0453c}
.fhm-deps-empty{font-size:11px;color:var(--f-dim,#6b6b70);margin:3px 0}
.fhm-import{display:inline-flex;align-items:center;gap:6px;font-size:11px;color:var(--f-dim,#6b6b70);cursor:pointer}
.fhm-import input{font-size:10.5px;max-width:150px}
.fhm-snaps textarea{width:100%;margin-top:6px;font:inherit;font-size:11px;padding:5px 8px;border-radius:8px;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}

.fhm-pending{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 2px 0;padding:7px 10px;border-radius:10px;
  border:1px solid var(--f-line,#e3e4e3);background:color-mix(in srgb,var(--f-card,#fbfbfb) 88%,var(--f-soft,#f3efe9))}
.fhm-pending-label{font-size:11px;letter-spacing:.04em;color:var(--f-dim,#6b6b70)}
.fhm-pending-text{flex:1 1 260px;min-width:0;font-size:12px;line-height:1.5;color:var(--f-ink,#1b1a1e);word-break:break-word}
.fhm-pending button{font:inherit;font-size:11.5px;padding:3px 10px;border-radius:999px;cursor:pointer;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-card,#fbfbfb);color:var(--f-ink,#1b1a1e)}
.fhm-pending button:hover{border-color:var(--f-accent,#00a870)}
.fhm-pending textarea{flex:1 1 100%;min-height:30px;font:inherit;font-size:12px;padding:4px 8px;border-radius:8px;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e);resize:vertical}

.fhm-chips{display:flex;gap:6px;flex-wrap:nowrap;overflow-x:auto;padding:10px 2px 4px;scrollbar-width:thin}
.fhm-chip{flex:none;font-size:12px;line-height:1.5;padding:4px 11px;border-radius:999px;cursor:pointer;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-card,#fbfbfb);color:var(--f-dim,#6b6b70);font:inherit;font-size:12px}
.fhm-chip:hover{border-color:var(--f-accent,#00a870);color:var(--f-ink,#1b1a1e)}
.fhm-chip[aria-pressed="true"]{color:var(--f-ink,#1b1a1e);border-color:var(--f-accent,#00a870);
  background:color-mix(in srgb,var(--f-accent,#00a870) 12%,var(--f-card,#fbfbfb))}
.fhm-chip:disabled{opacity:.5;cursor:default}
.fhm-chip:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}

.fhm-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap;padding:6px 2px 0}
.fhm-actions button{font:inherit;font-size:12px;padding:4px 11px;border-radius:999px;cursor:pointer;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-card,#fbfbfb);color:var(--f-ink,#1b1a1e)}
.fhm-actions button:hover{border-color:var(--f-accent,#00a870)}
.fhm-actions button:focus-visible{outline:2px solid var(--f-accent,#00a870);outline-offset:2px}
.fhm-fine{margin-left:auto;font-size:11px;color:var(--f-dim,#6b6b70);line-height:1.5}
.fhm-foot{margin:8px 2px 0;font-size:11.5px;color:var(--f-dim,#6b6b70);line-height:1.6}

.fhm-dress{margin-top:10px;border:1px solid var(--f-line,#e3e4e3);border-radius:14px;padding:12px 13px;background:var(--f-card,#fbfbfb);max-width:760px}
.fhm-dress[hidden]{display:none}
.fhm-dress h3{margin:0 0 4px;font-size:14px;font-weight:600}
.fhm-dress-note{margin:0 0 10px;font-size:11.5px;line-height:1.6;color:var(--f-dim,#6b6b70)}
.fhm-dress-section{margin-top:12px;padding-top:10px;border-top:1px dashed var(--f-line,#e3e4e3)}
.fhm-dress-section h4{margin:0 0 4px;font-size:13px;font-weight:600}
.fhm-hotspot-row,.fhm-place-row{display:grid;grid-template-columns:84px minmax(0,1fr) 60px;gap:6px;align-items:center;padding:4px 0}
.fhm-hotspot-row{grid-template-columns:minmax(0,1fr) minmax(0,1.4fr) 54px}
.fhm-place-row{grid-template-columns:64px 70px 70px 78px 54px}
.fhm-hotspot-row input,.fhm-place-row input{font:inherit;font-size:11.5px;min-width:0;padding:3px 7px;border-radius:8px;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}
.fhm-hotspot-row button,.fhm-place-row button,.fhm-row-actions button{font:inherit;font-size:11px;padding:3px 9px;border-radius:999px;cursor:pointer;
  border:1px solid var(--f-line,#e3e4e3);background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}
.fhm-hotspot-row button:hover,.fhm-place-row button:hover,.fhm-row-actions button:hover{border-color:var(--f-accent,#00a870)}
.fhm-row-actions{display:flex;gap:6px;flex-wrap:wrap;padding-top:6px}
.fhm-row{display:grid;grid-template-columns:84px minmax(0,1fr) 54px 54px;gap:8px;align-items:center;padding:5px 0;border-top:1px dashed var(--f-line,#e3e4e3)}
.fhm-row:first-of-type{border-top:none}
.fhm-row.fhm-batch{grid-template-columns:84px minmax(0,1fr)}
.fhm-batch-result{margin:2px 0 6px;font-size:11px;line-height:1.6;color:var(--f-dim,#6b6b70);word-break:break-word}
.fhm-row-name{font-size:12px;color:var(--f-ink,#1b1a1e)}
.fhm-row input[type=file]{font:inherit;font-size:11px;min-width:0;color:var(--f-dim,#6b6b70)}
.fhm-row button{font:inherit;font-size:11.5px;padding:3px 9px;border-radius:999px;cursor:pointer;border:1px solid var(--f-line,#e3e4e3);background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}
.fhm-row button:hover{border-color:var(--f-accent,#00a870)}
.fhm-row button:disabled{opacity:.45;cursor:default}
.fhm-note-form{display:flex;gap:8px;align-items:flex-start;flex-wrap:wrap;margin-top:4px;padding-top:10px;border-top:1px dashed var(--f-line,#e3e4e3)}
.fhm-note-form textarea{flex:1;min-width:180px;min-height:52px;resize:vertical;font:inherit;font-size:12px;line-height:1.55;padding:6px 9px;
  border:1px solid var(--f-line,#e3e4e3);border-radius:10px;background:var(--f-soft,#f3efe9);color:var(--f-ink,#1b1a1e)}
.fhm-note-form textarea:focus{border-color:var(--f-accent,#00a870);outline:none}
.fhm-note-form button{font:inherit;font-size:12px;padding:5px 12px;border-radius:999px;cursor:pointer;border:1px solid var(--f-accent,#00a870);background:var(--f-accent,#00a870);color:#fff}
.fhm-note-form button:disabled{opacity:.55;cursor:default}

@media (max-width:560px){
  .fhm-title{font-size:19px}
  .fhm-stage{max-height:40vh;min-height:170px}
  .fhm-fine{margin-left:0;flex-basis:100%}
  .fhm-row{grid-template-columns:1fr;gap:4px}
  .fhm-row button{justify-self:start}
}
@media (prefers-reduced-motion:reduce){
  .fhm *{transition:none !important;animation:none !important}
}
`;

// webui/home/webui.js
var MAX_IMAGE_BYTES2 = 8 * 1024 * 1024;
var ACCEPT = "image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp";
var PICKER_EXTENSIONS = [".png", ".jpg", ".jpeg", ".gif", ".webp"];
var artCache = /* @__PURE__ */ new Map();
var SHOW_KEEPSAKES = false;
var KEEPSAKE_SLOTS = {
  ticket: { left: 50, top: 40, icon: "🎫" },
  shelf: { left: 55, top: 44, icon: "🧩" },
  cup: { left: 47, top: 70, icon: "☕" },
  doll: { left: 85, top: 72, icon: "🧸" },
  plant: { left: 16, top: 58, icon: "🪴" }
};
function monthDay(day) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(day ?? ""));
  return match ? `${Number(match[2])} 月 ${Number(match[3])} 日` : "";
}
function classifyHomeFile(name) {
  const base = String(name ?? "").toLowerCase().replace(/\.[a-z0-9]+$/, "");
  if (!base) return null;
  if (base.startsWith("bg-")) return { kind: "background" };
  if (base.startsWith("ch-idle")) return { kind: "character", activity: "idle" };
  if (!base.startsWith("act-")) return null;
  const rest = base.slice(4);
  const ids = Object.keys(HOME_LAYOUT).filter((id) => id !== "idle").sort((a, b) => b.length - a.length);
  for (const id of ids) {
    if (rest === id || rest.startsWith(`${id}-`) || rest.startsWith(`${id}_`)) {
      return { kind: "character", activity: id };
    }
  }
  if (rest === "outside" || rest.startsWith("outside-") || rest.startsWith("outside_")) {
    return { kind: "character", activity: "looking_outside" };
  }
  return null;
}
var el2 = elIn;
function relativeTime(minutes) {
  if (minutes === null || minutes === void 0) return "";
  if (minutes < 1) return "刚开始";
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分` : `${hours} 小时`;
}
function statusOf(snapshot) {
  const trip = snapshot.trip ?? { mode: "home" };
  if (trip.mode === "out") {
    const walked = trip.total ? `（逛了 ${trip.visited}/${trip.total}）` : "";
    return `出门中 · ${trip.placeName}${walked}`;
  }
  if (trip.mode === "draft") return `还没逛完 · ${trip.placeName}`;
  const label2 = snapshot.room?.label ?? "发呆";
  const time = relativeTime(snapshot.room?.elapsedMinutes);
  return time ? `${label2} · ${time}` : label2;
}
function placeOf(snapshot) {
  if (snapshot.trip?.mode === "out") return { text: `在外 · ${snapshot.trip.placeName}`, out: true };
  if (snapshot.place?.name) return { text: snapshot.place.name, out: false };
  return { text: "还没设住所", out: false };
}
function mountHome(ctx) {
  const root = ctx.root;
  const document2 = root.ownerDocument ?? globalThis.document;
  const section = el2(document2, "section", { class: "fun fhm", "aria-label": "鱼的家" });
  const style = el2(document2, "style");
  style.textContent = HOME_STYLES;
  section.append(style);
  root.replaceChildren(section);
  let disposed = false;
  let busy = false;
  let snapshot = null;
  let ticker = null;
  const view = {
    editing: false,
    noteDraft: null,
    planDraft: null,
    feedback: "",
    tone: "",
    batch: null,
    copyFallback: "",
    placements: null,
    hotspots: null,
    snapshots: [],
    exportText: ""
  };
  const live = () => !disposed && !ctx.signal?.aborted;
  function call(method, payload) {
    return ctx.invoke(method, payload === void 0 ? [] : [payload]);
  }
  function accept(result) {
    if (result && Array.isArray(result.activities) && result.room) snapshot = result;
    return snapshot;
  }
  function tell(text2, tone = "") {
    view.feedback = text2;
    view.tone = tone;
  }
  async function loadArt(slot, activity) {
    const key = slot === "background" ? snapshot?.art?.background : slot === "foreground" ? snapshot?.art?.foreground : slot === "painting" ? snapshot?.art?.painting : snapshot?.art?.characters?.[activity] ?? snapshot?.art?.characters?.idle;
    const builtin = snapshot?.art?.builtin ?? [];
    const useBuiltin = slot === "character" && !key && (builtin.includes(activity) || builtin.includes("idle"));
    if (!key && !useBuiltin) return null;
    const cacheKey = key || `builtin:${activity}`;
    if (artCache.has(cacheKey)) return artCache.get(cacheKey);
    try {
      const result = await call("art", { slot, activity });
      const image = result?.image?.dataUrl ?? null;
      if (image) artCache.set(cacheKey, image);
      return image;
    } catch {
      return null;
    }
  }
  async function loadSnapshots() {
    try {
      const result = await call("snapshotList");
      view.snapshots = result?.ok === true && Array.isArray(result.items) ? result.items : [];
    } catch {
      view.snapshots = [];
    }
  }
  async function refresh() {
    if (disposed) return;
    try {
      accept(await call("state"));
      tell("");
    } catch (error) {
      tell(error?.message ?? "房间暂时读不出来。", "error");
    }
    await loadSnapshots();
    render();
  }
  async function write(method, payload, okText = "") {
    if (busy || !live()) return null;
    busy = true;
    section.setAttribute("aria-busy", "true");
    try {
      const result = await call(method, payload);
      if (result?.ok === false) throw new Error(result.error || "宿主拒绝了这次修改。");
      if (result?.ok !== true) throw new Error("宿主没有返回结果。");
      accept(result);
      tell(okText, okText ? "ok" : "");
      return result;
    } catch (error) {
      tell(error?.message ?? "这次修改没成功。", "error");
      return null;
    } finally {
      busy = false;
      section.setAttribute("aria-busy", "false");
      if (!view.editing) render();
      else render({ keepFocus: true });
    }
  }
  async function tick() {
    if (!live() || busy || view.editing) return;
    try {
      const result = await call("state");
      if (result?.ok === false) return;
      accept(result);
      if (refs.status) refs.status.textContent = statusOf(snapshot);
      if (refs.place) {
        const place = placeOf(snapshot);
        refs.place.textContent = place.text;
        refs.place.setAttribute("data-out", place.out ? "1" : "0");
      }
    } catch {
    }
  }
  const refs = {};
  const clamp01 = (value) => Math.min(1, Math.max(0, value));
  const round3 = (value) => Math.round(value * 1e3) / 1e3;
  function effectiveSpot(activity) {
    const base = positionOf(activity);
    const override = (view.placements ?? snapshot.placements ?? {})[activity];
    return override ? { ...base, ...override } : base;
  }
  function placementDraft() {
    return { ...view.placements ?? snapshot.placements ?? {} };
  }
  function setPlacement(activity, next) {
    const base = positionOf(activity);
    const draft = placementDraft();
    const same = Math.abs(next.x - base.x) < 5e-4 && Math.abs(next.y - base.y) < 5e-4 && Math.abs(next.scale - base.scale) < 5e-4;
    if (same) delete draft[activity];
    else draft[activity] = { x: round3(next.x), y: round3(next.y), scale: round3(next.scale) };
    view.placements = draft;
  }
  function savePlacementsDraft() {
    void write("savePlacements", { placements: placementDraft(), revision: snapshot.revision }, "位置存好了。");
  }
  function hotspotDraft() {
    return (view.hotspots ?? snapshot.art?.hotspots ?? []).map((item) => ({ ...item }));
  }
  function saveHotspotsDraft() {
    void write("saveHotspots", { hotspots: hotspotDraft(), revision: snapshot.revision }, "热点存好了。");
  }
  function stagePoint(stage, event) {
    const rect2 = stage?.getBoundingClientRect?.();
    if (!rect2?.width || !rect2?.height) return null;
    return { x: clamp01((event.clientX - rect2.left) / rect2.width), y: clamp01((event.clientY - rect2.top) / rect2.height) };
  }
  function attachCharacterDrag(img, activity, shadow) {
    let drag = null;
    img.addEventListener("pointerdown", (event) => {
      if (!view.editing || busy) return;
      drag = { rect: img.parentNode?.getBoundingClientRect?.() ?? null };
      event.preventDefault?.();
    });
    const move = (event) => {
      if (!drag) return;
      const rect2 = drag.rect;
      if (!rect2?.width || !rect2?.height) return;
      const x = clamp01((event.clientX - rect2.left) / rect2.width);
      const y = clamp01((event.clientY - rect2.top) / rect2.height);
      const next = { x, y, scale: effectiveSpot(activity).scale };
      setPlacement(activity, next);
      img.style.left = `${(x * 100).toFixed(2)}%`;
      img.style.bottom = `${((1 - y) * 100).toFixed(2)}%`;
      shadow.style.left = `${(x * 100).toFixed(2)}%`;
      shadow.style.bottom = `${((1 - y) * 100).toFixed(2)}%`;
    };
    const up = () => {
      if (!drag) return;
      drag = null;
      savePlacementsDraft();
    };
    img.addEventListener("pointermove", move);
    img.addEventListener("pointerup", up);
    img.addEventListener("pointercancel", up);
  }
  function attachHotspotDrag(node2, id, stage) {
    let drag = null;
    node2.addEventListener("pointerdown", (event) => {
      if (!view.editing || busy) return;
      drag = true;
      event.preventDefault?.();
    });
    const move = (event) => {
      if (!drag) return;
      const point = stagePoint(stage, event);
      if (!point) return;
      view.hotspots = hotspotDraft().map((item) => item.id === id ? { ...item, x: round3(point.x), y: round3(point.y) } : item);
      node2.style.left = `${(point.x * 100).toFixed(2)}%`;
      node2.style.top = `${(point.y * 100).toFixed(2)}%`;
    };
    const up = () => {
      if (!drag) return;
      drag = null;
      saveHotspotsDraft();
    };
    node2.addEventListener("pointermove", move);
    node2.addEventListener("pointerup", up);
    node2.addEventListener("pointercancel", up);
  }
  function renderStage() {
    const stage = el2(document2, "div", {
      class: "fhm-stage",
      tabindex: "0",
      role: "img",
      "aria-label": `鱼的家，正在${snapshot.room.label}`
    });
    const bgRef = snapshot.art?.background;
    if (bgRef) {
      const img = el2(document2, "img", { class: "fhm-bg", alt: "", decoding: "async" });
      stage.append(img);
      loadArt("background").then((src) => {
        if (src && live()) img.setAttribute("src", src);
      });
    } else {
      stage.append(el2(
        document2,
        "div",
        { class: "fhm-room" },
        el2(document2, "div", { class: "fhm-window" }),
        el2(document2, "div", { class: "fhm-baseboard" }),
        el2(document2, "div", { class: "fhm-sofa" }),
        el2(document2, "div", { class: "fhm-rug" }),
        el2(
          document2,
          "p",
          { class: "fhm-room-note" },
          el2(document2, "b", { text: "还没有房间图" }),
          "点「布置房间」换一张。没有她的图也行，一样看得到她在做什么。"
        )
      ));
    }
    const status = el2(document2, "p", { class: "fhm-status", text: statusOf(snapshot) });
    const place = placeOf(snapshot);
    const placeNode = el2(document2, "p", { class: "fhm-place", "data-out": place.out ? "1" : "0", text: place.text });
    refs.status = status;
    refs.place = placeNode;
    stage.append(status, placeNode);
    stage.append(el2(document2, "div", {
      class: "fhm-light",
      "data-phase": snapshot.phase ?? "day",
      "aria-hidden": "true"
    }));
    if (snapshot.art?.painting) {
      const frame = el2(document2, "img", { class: "fhm-painting", alt: "画架上的画", decoding: "async" });
      stage.append(frame);
      loadArt("painting").then((src) => {
        if (src && live()) frame.setAttribute("src", src);
      });
    }
    const builtin = snapshot.art?.builtin ?? [];
    const hasCharacter = Boolean(snapshot.art?.characters?.[snapshot.room.activity] ?? snapshot.art?.characters?.idle) || builtin.includes(snapshot.room.activity) || builtin.includes("idle");
    const spot = effectiveSpot(snapshot.room.activity);
    const shadow = el2(document2, "div", {
      class: "fhm-char-shadow",
      "aria-hidden": "true",
      style: `left:${(spot.x * 100).toFixed(2)}%;bottom:${((1 - spot.y) * 100).toFixed(2)}%;width:${(spot.scale * 62).toFixed(2)}%`
    });
    stage.append(shadow);
    if (hasCharacter) {
      const char = el2(document2, "img", {
        class: "fhm-char",
        alt: `鱼在家的样子：${snapshot.room.label}`,
        decoding: "async",
        // 站位：水平居中、底边落在 y 上；高度按角色高度/舞台高。不再有 76% 硬上限。
        style: `left:${(spot.x * 100).toFixed(2)}%;bottom:${((1 - spot.y) * 100).toFixed(2)}%;height:${(spot.scale * 100).toFixed(2)}%`
      });
      stage.append(char);
      loadArt("character", snapshot.room.activity).then((src) => {
        if (src && live()) char.setAttribute("src", src);
      });
      if (view.editing) attachCharacterDrag(char, snapshot.room.activity, shadow);
    }
    if (snapshot.art?.foreground) {
      const front = el2(document2, "img", { class: "fhm-foreground", alt: "", decoding: "async" });
      stage.append(front);
      loadArt("foreground").then((src) => {
        if (src && live()) front.setAttribute("src", src);
      });
    }
    const spotBubbles = [];
    for (const item of snapshot.art?.hotspots ?? []) {
      const bubble = el2(document2, "span", {
        class: "fhm-spot-bubble",
        hidden: true,
        text: `${item.label || item.id}${item.note ? `：${item.note}` : ""}`,
        style: `left:${(item.x * 100).toFixed(2)}%;top:${(item.y * 100).toFixed(2)}%`
      });
      spotBubbles.push(bubble);
      const dot = el2(document2, "button", {
        type: "button",
        class: "fhm-spot",
        "aria-label": `房间热点：${item.label || item.id}`,
        title: item.label || item.id,
        text: "·",
        style: `left:${(item.x * 100).toFixed(2)}%;top:${(item.y * 100).toFixed(2)}%`,
        onclick: () => {
          if (view.editing) return;
          const open = bubble.hidden;
          for (const other of spotBubbles) other.hidden = true;
          bubble.hidden = !open;
        }
      });
      stage.append(dot, bubble);
      if (view.editing) attachHotspotDrag(dot, item.id, stage);
    }
    if (snapshot.room.note) stage.append(el2(document2, "p", { class: "fhm-note", text: snapshot.room.note }));
    const used = {};
    const bubbles = [];
    for (const item of SHOW_KEEPSAKES ? snapshot.keepsakes ?? [] : []) {
      const slot = KEEPSAKE_SLOTS[item.category] ?? KEEPSAKE_SLOTS.shelf;
      const offset = used[item.category] ?? 0;
      used[item.category] = offset + 1;
      const left = slot.left + offset * 3;
      const top = slot.top + offset * 3;
      const bubble = el2(document2, "span", {
        class: "fhm-keepsake-bubble",
        hidden: true,
        text: `${item.name} · 来自${item.placeName}${monthDay(item.day) ? ` · ${monthDay(item.day)}` : ""}`,
        style: `left:${left}%;top:${top}%`
      });
      bubbles.push(bubble);
      stage.append(el2(document2, "button", {
        type: "button",
        class: "fhm-keepsake",
        "aria-label": `${item.name}，来自${item.placeName}`,
        title: `${item.name} · 来自${item.placeName}`,
        text: slot.icon,
        style: `left:${left}%;top:${top}%`,
        onclick: () => {
          const open = bubble.hidden;
          for (const other of bubbles) other.hidden = true;
          bubble.hidden = !open;
        }
      }), bubble);
    }
    return stage;
  }
  function renderChips() {
    const row = el2(document2, "div", { class: "fhm-chips", role: "group", "aria-label": "她在家的样子" });
    for (const activity of snapshot.activities) {
      const current = activity.id === snapshot.room.activity;
      row.append(el2(document2, "button", {
        type: "button",
        class: "fhm-chip",
        "aria-pressed": current ? "true" : "false",
        title: activity.hint,
        disabled: Boolean(snapshot.damaged) || busy,
        onclick: () => {
          if (activity.id === snapshot.room.activity) return;
          void write(
            "setActivity",
            { activity: activity.id, revision: snapshot.revision },
            `换成「${activity.label}」了。`
          );
        }
      }, activity.label));
    }
    return row;
  }
  function renderActions() {
    const row = el2(
      document2,
      "div",
      { class: "fhm-actions" },
      el2(document2, "button", {
        type: "button",
        text: view.editing ? "收起布置" : "布置房间",
        onclick: () => {
          view.editing = !view.editing;
          if (view.editing) {
            view.noteDraft = snapshot.room.note;
            view.placements = { ...snapshot.placements ?? {} };
            view.hotspots = (snapshot.art?.hotspots ?? []).map((item) => ({ ...item }));
          } else {
            view.placements = null;
            view.hotspots = null;
          }
          render();
        }
      }),
      el2(document2, "button", {
        type: "button",
        text: "恢复默认",
        disabled: Boolean(snapshot.damaged) || busy,
        onclick: () => {
          if (typeof globalThis.confirm === "function" && !globalThis.confirm("把活动、备注、热点和位置恢复默认？活动会改回「随时段变」，已上传的图片会保留。")) return;
          void write("resetRoom", { revision: snapshot.revision }, "已恢复默认。");
        }
      }),
      el2(document2, "span", { class: "fhm-fine", text: "ⓘ 这里显示的是房间里的样子，不是记录" })
    );
    return row;
  }
  async function upload(kind, activity, input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = "";
    try {
      const dataUrl = await pictureData(file, MAX_IMAGE_BYTES2, document2.defaultView?.FileReader ?? globalThis.FileReader);
      if (kind === "background") await write("setBackground", { dataUrl, revision: snapshot.revision }, "背景换好了。");
      else if (kind === "foreground") await write("setForeground", { dataUrl, revision: snapshot.revision }, "前景换好了。");
      else await write("setCharacter", { activity, dataUrl, revision: snapshot.revision }, "这张图换好了。");
    } catch (error) {
      tell(error?.message ?? "这张图没读出来。", "error");
      render();
    }
  }
  async function importMany(input) {
    const files = [...input?.files ?? []];
    input.value = "";
    if (!files.length) return;
    const placed = [];
    const unused = [];
    const failed = [];
    for (const file of files) {
      const slot = classifyHomeFile(file.name);
      if (!slot) {
        unused.push(file.name);
        continue;
      }
      try {
        const dataUrl = await pictureData(file, MAX_IMAGE_BYTES2, document2.defaultView?.FileReader ?? globalThis.FileReader);
        const result = slot.kind === "background" ? await write("setBackground", { dataUrl, revision: snapshot.revision }, "") : await write("setCharacter", { activity: slot.activity, dataUrl, revision: snapshot.revision }, "");
        if (result) placed.push(file.name);
        else failed.push(file.name);
      } catch {
        failed.push(file.name);
      }
    }
    view.batch = { placed, unused, failed };
    const bits = [`批量导入 ${files.length} 张：${placed.length} 张已就位`];
    if (unused.length) bits.push(`${unused.length} 张未使用（${unused.join("、")}）`);
    if (failed.length) bits.push(`${failed.length} 张失败（${failed.join("、")}）`);
    tell(bits.join("；") + "。", failed.length ? "error" : "ok");
    render();
  }
  async function choosePainting() {
    if (typeof ctx.pickPath !== "function") {
      tell("这个宿主不支持选本地图片。", "error");
      render();
      return;
    }
    try {
      const picked = await ctx.pickPath({ kind: "file", title: "选一张图挂到画架", extensions: PICKER_EXTENSIONS });
      const path = typeof picked === "string" ? picked : picked?.path ?? picked?.filePath ?? "";
      if (!path) return;
      await write("setPainting", { path, revision: snapshot.revision }, "挂到画架上了。");
    } catch (error) {
      tell(error?.message ?? "这张图没选成。", "error");
      render();
    }
  }
  async function saveSnapshotNow() {
    const result = await write("snapshotSave", {}, "快照存好了。");
    if (result) await loadSnapshots();
    render();
  }
  async function removeSnapshotNow(id) {
    const result = await write("snapshotRemove", { id }, "快照删掉了。");
    if (result) await loadSnapshots();
    render();
  }
  function downloadJson(data) {
    const text2 = JSON.stringify(data, null, 2);
    try {
      const blob = new Blob([text2], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document2.createElement("a");
      link.href = url;
      link.download = "fish-home-export.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL?.(url), 0);
      tell("备份已导出（只有引用，没有图片字节）。", "ok");
    } catch {
      view.exportText = text2;
      tell("浏览器不给下载，备份内容放进下面的文本框了。", "");
    }
    render();
  }
  async function exportBackup() {
    try {
      const result = await call("exportRoom");
      if (result?.ok !== true) throw new Error(result?.error ?? "导出失败。");
      downloadJson(result);
    } catch (error) {
      tell(error?.message ?? "导出失败。", "error");
      render();
    }
  }
  async function importBackup(input) {
    const file = input?.files?.[0];
    if (!file) return;
    input.value = "";
    try {
      const text2 = await new Promise((resolve, reject) => {
        const Reader = document2.defaultView?.FileReader ?? globalThis.FileReader;
        if (!Reader) {
          reject(new Error("这个环境读不了文件。"));
          return;
        }
        const reader = new Reader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () => reject(reader.error ?? new Error("读不了这个文件。"));
        reader.readAsText(file);
      });
      let data;
      try {
        data = JSON.parse(text2);
      } catch {
        throw new Error("这不是一份备份 JSON。");
      }
      await write("importRoom", { data, revision: snapshot.revision }, "导入完成。");
    } catch (error) {
      tell(error?.message ?? "导入失败。", "error");
      render();
    }
  }
  function snapshotWhen(at) {
    if (!Number.isFinite(at)) return "";
    const date2 = new Date(at);
    const pad = (value) => String(value).padStart(2, "0");
    return `${date2.getMonth() + 1} 月 ${date2.getDate()} 日 ${pad(date2.getHours())}:${pad(date2.getMinutes())}`;
  }
  function renderSnapshots() {
    const box = el2(
      document2,
      "div",
      { class: "fhm-snaps" },
      el2(
        document2,
        "div",
        { class: "fhm-snaps-head" },
        el2(document2, "span", { class: "fhm-plan-label", text: "快照" }),
        el2(document2, "button", { type: "button", text: "存快照", onclick: () => {
          void saveSnapshotNow();
        } })
      ),
      el2(document2, "p", { class: "fhm-fine", text: "只记那一刻的房间；图按 digest 引用，不复制字节。删快照不影响当前房间。" })
    );
    if (!view.snapshots.length) {
      box.append(el2(document2, "p", { class: "fhm-deps-empty", text: "还没有快照。" }));
    } else {
      for (const item of view.snapshots) {
        box.append(el2(
          document2,
          "div",
          { class: "fhm-snap-row" },
          el2(document2, "span", { class: "fhm-snap-main", text: `${snapshotWhen(item.at)} · ${item.label || "发呆"}${item.note ? ` · ${item.note}` : ""}` }),
          item.missing ? el2(document2, "span", { class: "fhm-snap-missing", text: "这张图不在了" }) : null,
          el2(document2, "button", {
            type: "button",
            text: "删除",
            "aria-label": `删除快照 ${item.id}`,
            onclick: () => {
              void removeSnapshotNow(item.id);
            }
          })
        ));
      }
    }
    box.append(el2(
      document2,
      "div",
      { class: "fhm-row-actions" },
      el2(document2, "button", { type: "button", text: "导出备份", onclick: () => {
        void exportBackup();
      } }),
      el2(
        document2,
        "label",
        { class: "fhm-import" },
        "导入备份",
        el2(document2, "input", {
          type: "file",
          accept: ".json,application/json",
          "aria-label": "导入房间备份",
          onchange: (event) => {
            void importBackup(event.target);
          }
        })
      )
    ));
    if (view.exportText) {
      const out = el2(document2, "textarea", { readonly: "", rows: "3", "aria-label": "导出内容" });
      out.value = view.exportText;
      box.append(out);
    }
    return box;
  }
  function renderDress() {
    if (!view.editing) return null;
    const box = el2(
      document2,
      "div",
      { class: "fhm-dress" },
      el2(document2, "h3", { text: "布置房间" }),
      el2(document2, "p", {
        class: "fhm-dress-note",
        text: "没传角色图时用内置的 Q 版立绘（十个活动都有，透明边已裁掉）；想换就传自己的图。背景 1920×1080；角色图十个活动同一张画布、底边对齐。单张不超过 8 MiB，支持 PNG / JPG / WebP / GIF。批量导入按文件名认领：bg-* 背景、ch-idle* 待机、act-<活动>* 对应活动；chibi-* 与其他会列进未使用（内置已经有了，不用再导）。"
      })
    );
    const bgRow = el2(
      document2,
      "div",
      { class: "fhm-row" },
      el2(document2, "span", { class: "fhm-row-name", text: "房间背景" }),
      el2(document2, "input", { type: "file", accept: ACCEPT, "aria-label": "选择房间背景", onchange: (event) => {
        void upload("background", "", event.target);
      } }),
      el2(document2, "span", { class: "fhm-row-name", text: snapshot.art?.background ? "已设置" : "未设置" }),
      el2(document2, "button", {
        type: "button",
        text: "清空",
        disabled: !snapshot.art?.background || busy,
        "aria-label": "清空房间背景",
        onclick: () => {
          void write("clearBackground", { revision: snapshot.revision }, "背景清掉了。");
        }
      })
    );
    box.append(bgRow);
    box.append(el2(
      document2,
      "div",
      { class: "fhm-row" },
      el2(document2, "span", { class: "fhm-row-name", text: "前景层（可选）" }),
      el2(document2, "input", {
        type: "file",
        accept: ACCEPT,
        "aria-label": "选择前景层图片",
        onchange: (event) => {
          void upload("foreground", "", event.target);
        }
      }),
      el2(document2, "span", { class: "fhm-row-name", text: snapshot.art?.foreground ? "已设置" : "未设置" }),
      el2(document2, "button", {
        type: "button",
        text: "清空",
        disabled: !snapshot.art?.foreground || busy,
        "aria-label": "清空前景层图片",
        onclick: () => {
          void write("clearForeground", { revision: snapshot.revision }, "前景清掉了。");
        }
      })
    ));
    box.append(el2(
      document2,
      "div",
      { class: "fhm-row" },
      el2(document2, "span", { class: "fhm-row-name", text: "画架 / 相框" }),
      el2(document2, "button", {
        type: "button",
        text: "选一张本地图",
        "aria-label": "选一张本地图挂到画架",
        onclick: () => {
          void choosePainting();
        }
      }),
      el2(document2, "span", { class: "fhm-row-name", text: snapshot.art?.painting ? "已设置" : "未设置" }),
      el2(document2, "button", {
        type: "button",
        text: "清空",
        disabled: !snapshot.art?.painting || busy,
        "aria-label": "清空画架图片",
        onclick: () => {
          void write("clearPainting", { revision: snapshot.revision }, "画架清空了。");
        }
      })
    ));
    box.append(el2(
      document2,
      "div",
      { class: "fhm-row fhm-batch" },
      el2(document2, "span", { class: "fhm-row-name", text: "批量导入" }),
      el2(document2, "input", {
        type: "file",
        multiple: "",
        accept: ACCEPT,
        "aria-label": "批量导入房间素材",
        onchange: (event) => {
          void importMany(event.target);
        }
      })
    ));
    if (view.batch) {
      const bits = [`已就位 ${view.batch.placed.length} 张`];
      if (view.batch.unused.length) bits.push(`未使用：${view.batch.unused.join("、")}`);
      if (view.batch.failed.length) bits.push(`失败：${view.batch.failed.join("、")}`);
      box.append(el2(document2, "p", { class: "fhm-batch-result", text: bits.join("；") }));
    }
    for (const activity of snapshot.activities) {
      const has = Boolean(snapshot.art?.characters?.[activity.id]);
      const usingBuiltin = !has && ((snapshot.art?.builtin ?? []).includes(activity.id) || (snapshot.art?.builtin ?? []).includes("idle"));
      box.append(el2(
        document2,
        "div",
        { class: "fhm-row" },
        el2(document2, "span", { class: "fhm-row-name", text: activity.label }),
        el2(document2, "input", {
          type: "file",
          accept: ACCEPT,
          "aria-label": `选择「${activity.label}」的角色图`,
          onchange: (event) => {
            void upload("character", activity.id, event.target);
          }
        }),
        el2(document2, "span", { class: "fhm-row-name", text: has ? "已设置" : usingBuiltin ? "内置 Q 版" : "未设置" }),
        el2(document2, "button", {
          type: "button",
          text: "清空",
          disabled: !has || busy,
          "aria-label": `清空「${activity.label}」的角色图`,
          onclick: () => {
            void write("clearCharacter", { activity: activity.id, revision: snapshot.revision }, "这张图清掉了。");
          }
        })
      ));
    }
    const hotspotList = view.hotspots ?? [];
    const spotRows = hotspotList.map((item) => {
      const label2 = el2(document2, "input", { type: "text", maxlength: "24", "aria-label": "热点名称" });
      label2.value = item.label ?? "";
      label2.addEventListener("input", () => {
        item.label = label2.value;
      });
      const noteInput = el2(document2, "input", { type: "text", maxlength: "60", "aria-label": "热点那句话" });
      noteInput.value = item.note ?? "";
      noteInput.addEventListener("input", () => {
        item.note = noteInput.value;
      });
      return el2(
        document2,
        "div",
        { class: "fhm-hotspot-row" },
        label2,
        noteInput,
        el2(document2, "button", {
          type: "button",
          text: "删除",
          "aria-label": `删除热点 ${item.label || item.id}`,
          onclick: () => {
            view.hotspots = hotspotList.filter((row) => row.id !== item.id);
            render();
          }
        })
      );
    });
    const spotSection = el2(
      document2,
      "div",
      { class: "fhm-dress-section" },
      el2(document2, "h4", { text: "热点" }),
      el2(document2, "p", { class: "fhm-dress-note", text: "家具名 + 一句说明；点画面上的圆点能看，布置时能拖；最多 12 个。" }),
      ...spotRows,
      el2(
        document2,
        "div",
        { class: "fhm-row-actions" },
        el2(document2, "button", {
          type: "button",
          text: "添加热点",
          disabled: hotspotList.length >= 12 || busy,
          onclick: () => {
            const list3 = hotspotList;
            let n = 1;
            const ids = new Set(list3.map((row) => row.id));
            while (ids.has(`spot-${n}`)) n += 1;
            view.hotspots = [...list3, { id: `spot-${n}`, x: 0.5, y: 0.5, label: "新热点", note: "" }];
            render();
          }
        }),
        el2(document2, "button", {
          type: "button",
          text: "保存热点",
          disabled: busy,
          onclick: () => {
            saveHotspotsDraft();
          }
        })
      )
    );
    box.append(spotSection);
    const placementRows = snapshot.activities.map((activity) => {
      const current = effectiveSpot(activity.id);
      const makeNumber = (key, value, min, max, step) => {
        const input = el2(document2, "input", {
          type: "number",
          min: String(min),
          max: String(max),
          step: String(step),
          "aria-label": `「${activity.label}」${key}`
        });
        input.value = String(value);
        return input;
      };
      const x = makeNumber("x", current.x, 0, 1, 1e-3);
      const y = makeNumber("y", current.y, 0, 1, 1e-3);
      const scale = makeNumber("scale", current.scale, 0.1, 2, 1e-3);
      const update = () => {
        const next = { x: Number(x.value), y: Number(y.value), scale: Number(scale.value) };
        if (!Number.isFinite(next.x) || !Number.isFinite(next.y) || !Number.isFinite(next.scale)) return;
        setPlacement(activity.id, next);
      };
      x.addEventListener("input", update);
      y.addEventListener("input", update);
      scale.addEventListener("input", update);
      return el2(
        document2,
        "div",
        { class: "fhm-place-row" },
        el2(document2, "span", { class: "fhm-row-name", text: activity.label }),
        x,
        y,
        scale,
        el2(document2, "button", {
          type: "button",
          text: "还原",
          "aria-label": `还原「${activity.label}」的位置`,
          onclick: () => {
            const draft = placementDraft();
            delete draft[activity.id];
            view.placements = draft;
            render();
          }
        })
      );
    });
    const placeSection = el2(
      document2,
      "div",
      { class: "fhm-dress-section" },
      el2(document2, "h4", { text: "位置微调" }),
      el2(document2, "p", { class: "fhm-dress-note", text: "x / y / 缩放（x、y 是 0–1，缩放 0.1–2）。也可以直接在画面上拖角色。只保存和默认站位不同的。" }),
      ...placementRows,
      el2(
        document2,
        "div",
        { class: "fhm-row-actions" },
        el2(document2, "button", {
          type: "button",
          text: "全部还原",
          onclick: () => {
            view.placements = {};
            render();
          }
        }),
        el2(document2, "button", {
          type: "button",
          text: "保存位置",
          disabled: busy,
          onclick: () => {
            savePlacementsDraft();
          }
        })
      )
    );
    box.append(placeSection);
    const note2 = el2(document2, "textarea", {
      maxlength: "120",
      placeholder: "一句房间里的备注，比如「在沙发上翻一本旧书」",
      "aria-label": "房间备注"
    });
    note2.value = view.noteDraft ?? snapshot.room.note;
    note2.addEventListener("input", () => {
      view.noteDraft = note2.value;
    });
    box.append(el2(
      document2,
      "div",
      { class: "fhm-note-form" },
      note2,
      el2(document2, "button", {
        type: "button",
        text: "保存备注",
        disabled: busy,
        onclick: () => {
          void write("setNote", { note: note2.value, revision: snapshot.revision }, "备注记下了。").then(() => {
            view.noteDraft = null;
          });
        }
      })
    ));
    return box;
  }
  async function copyPending() {
    const text2 = snapshot.pendingLine;
    if (!text2) return;
    try {
      const clipboard = document2.defaultView?.navigator?.clipboard ?? globalThis.navigator?.clipboard;
      if (!clipboard?.writeText) throw new Error("no clipboard");
      await clipboard.writeText(text2);
      view.copyFallback = "";
      tell("已复制「待记一条」。", "ok");
    } catch {
      view.copyFallback = text2;
      tell("剪贴板用不了，这行可以直接选中复制。", "");
    }
    render();
  }
  function renderPending() {
    if (!snapshot.pendingLine) return null;
    const row = el2(
      document2,
      "div",
      { class: "fhm-pending" },
      el2(document2, "span", { class: "fhm-pending-label", text: "待记一条" }),
      el2(document2, "span", { class: "fhm-pending-text", text: snapshot.pendingLine }),
      el2(document2, "button", { type: "button", text: "记一笔", onclick: () => {
        void copyPending();
      } }),
      el2(document2, "span", { class: "fhm-fine", text: "只复制文本，不会自动记录" })
    );
    if (view.copyFallback) {
      const box = el2(document2, "textarea", { readonly: "", rows: "1", "aria-label": "待记一条文本" });
      box.value = view.copyFallback;
      row.append(box);
    }
    return row;
  }
  function renderEntry() {
    const nodes = [];
    if (snapshot.resume) {
      const r = snapshot.resume;
      nodes.push(el2(
        document2,
        "div",
        { class: "fhm-draft" },
        el2(document2, "p", {
          class: "fhm-draft-text",
          text: `还留着一趟 · ${r.placeName}（逛了 ${r.visited}/${r.total}）`
        }),
        el2(document2, "button", {
          type: "button",
          text: "继续",
          disabled: busy,
          onclick: () => {
            void write("resume", { id: r.id }, "接着逛这趟。");
          }
        }),
        el2(document2, "span", { class: "fhm-fine", text: "只接着逛；回不回家由你决定" })
      ));
    }
    if (snapshot.wish) {
      const w = snapshot.wish;
      nodes.push(el2(document2, "p", {
        class: "fhm-wish",
        text: `心愿 · ${w.placeName}${w.target ? ` · ${w.target}` : ""}${w.reason ? `：${w.reason}` : ""}`
      }));
    }
    return nodes;
  }
  function renderPlan() {
    const plan = el2(document2, "textarea", {
      maxlength: "60",
      rows: "1",
      placeholder: "今天想做什么？写一句，比如「想读半小时书」",
      "aria-label": "今天想做什么"
    });
    plan.value = view.planDraft ?? snapshot.room.plan ?? "";
    plan.addEventListener("input", () => {
      view.planDraft = plan.value;
    });
    return el2(
      document2,
      "div",
      { class: "fhm-plan" },
      el2(document2, "span", { class: "fhm-plan-label", text: "今天想做什么" }),
      plan,
      el2(document2, "button", {
        type: "button",
        text: "保存",
        disabled: busy,
        onclick: () => {
          void write("setPlan", { plan: plan.value, revision: snapshot.revision }).then((result) => {
            if (result) {
              view.planDraft = null;
              render();
            }
          });
        }
      }),
      el2(document2, "span", { class: "fhm-fine", text: "只显示你写的，不会自动变成她做过的事" })
    );
  }
  function render() {
    if (disposed || !snapshot) return;
    const head = el2(
      document2,
      "header",
      { class: "fhm-head" },
      el2(document2, "p", { class: "fhm-kicker", text: "从0开始的肥鱼大冒险 · 回家看看" }),
      el2(document2, "h2", { class: "fhm-title", text: "鱼的家" }),
      el2(document2, "p", { class: "fhm-sub", text: "她此刻在家做什么，换一个姿势，或者看看她在不在外面。" })
    );
    const feedback3 = el2(document2, "div", {
      class: "fhm-feedback",
      role: view.tone === "error" ? "alert" : "status",
      "data-tone": view.tone,
      text: snapshot.warning || view.feedback
    });
    const nodes = [head, feedback3, renderStage(), ...renderEntry(), renderChips(), renderActions(), renderPlan(), renderSnapshots(), renderPending()];
    const dress = renderDress();
    if (dress) nodes.push(dress);
    nodes.push(el2(document2, "p", { class: "fhm-foot", text: "出门在「去哪儿」，故事在「出游」。这里只记她在家里的样子。" }));
    section.replaceChildren(style, ...nodes);
    section.setAttribute("aria-busy", busy ? "true" : "false");
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    if (typeof ticker === "function") ticker();
    ctx.signal?.removeEventListener("abort", dispose);
  }
  ctx.signal?.addEventListener("abort", dispose, { once: true });
  if (typeof ctx.interval === "function") {
    const handle = ctx.interval(tick, 6e4);
    if (typeof handle === "function") ticker = handle;
    else if (handle && typeof handle.dispose === "function") ticker = () => handle.dispose();
  }
  const ready = refresh();
  return { refresh, dispose, ready };
}

// webui/places/migration.js
var BACKUP_LIMIT = 64 * 1024 * 1024;
var actionNames = { new: "新建地点", bind: "绑定已有地点", skip: "跳过" };
var coverNames = { ready: "可迁入", valid: "可迁入", present: "可迁入", missing: "缺少图片", none: "无封面", invalid: "图片无效" };
var issueNames = { id: "ID 冲突", name: "同名", mapped: "已建立映射", sameId: "ID 冲突", sameName: "同名" };
var bytes = (size) => size >= 1024 ? `${(size / 1024).toLocaleString("zh-CN", { maximumFractionDigits: 1 })} KiB` : `${size ?? 0} B`;
var sourceIdentity = /^[^\u0000-\u001f\u007f/\\]{1,120}$/u;
function createMigrationView({ document: document2, places, snapshot, run, call, tell, render: redraw, refreshSnapshot, live }) {
  const { node: node2, row, note: note2, button: button2, field, option } = dom(document2);
  let file;
  let sourceId = "";
  let bundle;
  let preview;
  let review;
  let receipt;
  let useHome = false;
  let defaultStyle = "";
  let showRecovery = false;
  let recoveryRevision;
  const decisions = /* @__PURE__ */ new Map();
  function resetPreview() {
    bundle = void 0;
    preview = void 0;
    review = void 0;
    receipt = void 0;
    defaultStyle = "";
    useHome = false;
    decisions.clear();
  }
  function clearFile() {
    file = void 0;
    resetPreview();
    redraw();
  }
  function currentInputs() {
    return { bundle, sourceId: sourceId.trim(), ...defaultStyle.trim() ? { defaultStyle: defaultStyle.trim() } : {} };
  }
  async function inspect() {
    if (!file) {
      tell("请选择小世界导出的 JSON 文件。", true);
      return;
    }
    if (!sourceIdentity.test(sourceId.trim())) {
      tell("请为这个旧世界输入来源标识，例如「鱼的旧家」。", true);
      return;
    }
    await run(async () => {
      if (!file.size || file.size > BACKUP_LIMIT) throw new Error("请选择非空的小世界备份，最大 64 MiB。");
      let parsed;
      try {
        parsed = JSON.parse(await file.text());
      } catch {
        throw new Error("无法读取该文件，请选择小世界导出的 JSON 备份。");
      }
      if (parsed?.format !== "little-world" || parsed.version !== 1) throw new Error("请选择 little-world v1 导出文件。");
      if (!live()) return;
      const result = await call("previewImport", { bundle: parsed, sourceId: sourceId.trim() });
      if (!live()) return;
      resetPreview();
      bundle = parsed;
      preview = result;
      showRecovery = false;
      redraw();
      documentFocus("fpl-plan-heading");
    });
  }
  let focusTarget;
  function documentFocus(key) {
    if (focusTarget?.id === key) focusTarget.focus();
  }
  function sourceForm() {
    const picked = node2("input", { type: "file", accept: "application/json,.json", onchange: (event) => {
      file = event.currentTarget.files?.[0];
      resetPreview();
      redraw();
    } });
    const origin = node2("input", {
      value: sourceId,
      required: true,
      maxlength: 120,
      placeholder: "例如：鱼的旧家",
      oninput: (event) => {
        sourceId = event.currentTarget.value;
      }
    });
    return node2(
      "form",
      { class: "fpl-card fpl-stack", onsubmit: (event) => {
        event.preventDefault();
        void inspect();
      } },
      node2("h4", {}, "1. 选择旧备份"),
      field("小世界导出的 JSON", picked),
      file ? note2(`已选 ${file.name} · ${bytes(file.size)}`) : null,
      field("来源标识", origin, "同一个旧世界重复迁入时，填写同一个标识。不同旧世界分别命名，不填写文件路径。"),
      row(node2("button", { type: "submit", class: "fpl-primary" }, "检查备份并预览"), file ? button2("清除文件", clearFile) : null)
    );
  }
  function impactBlock(data) {
    const impact = data.impact;
    const messages = list2(impact).filter((item) => typeof item === "string");
    if (typeof impact === "string") messages.push(impact);
    if (impact && typeof impact === "object" && !Array.isArray(impact)) {
      const names = { activeTrip: "进行中行程", storyBindings: "故事绑定", memories: "回忆", references: "现有引用" };
      for (const [key, value] of Object.entries(impact)) {
        if (typeof value === "string" && value) messages.push(names[key] ? `${names[key]}：${value}` : value);
      }
    }
    return node2(
      "div",
      { class: "fpl-stack" },
      note2("已有故事引用、行程和回忆继续使用本地 ID。绑定并覆盖会更新地点基础内容，供之后的浏览和新行程使用。"),
      messages.length ? node2("ul", {}, messages.map((line2) => node2("li", {}, line2))) : null,
      list2(data.warnings).length ? node2("div", {}, node2("h4", {}, "校验提示"), node2("ul", {}, data.warnings.map((line2) => node2("li", {}, typeof line2 === "string" ? line2 : line2?.message || "请检查该条记录。")))) : null
    );
  }
  function recordFacts(item) {
    const primary = item.place ?? item;
    return node2(
      "div",
      { class: "fpl-stack" },
      note2([`源 ID：${item.sourceId}`, `封面：${coverNames[item.coverStatus] || item.coverStatus || "无封面"}${item.coverBytes ? `（${bytes(item.coverBytes)}）` : ""}`].join(" · ")),
      item.desc || primary.desc ? node2("p", { class: "fpl-wrap" }, item.desc || primary.desc) : null,
      note2(`有效画风：${item.effectiveStyle || primary.effectiveStyle || item.style || primary.style || "未设置"}（${styleDescription({ ...primary, style: item.style ?? primary.style, effectiveStyle: item.effectiveStyle ?? primary.effectiveStyle })}）`),
      item.legacyFunVenue ? note2(`旧 funVenue 提示：${item.legacyFunVenue}。请自行判断是否为同一地点。`) : null,
      item.existingTargetId ? note2(`已记录的本地映射：${places().find((p) => p.id === item.existingTargetId)?.name ?? item.existingTargetId}`) : null,
      list2(item.missingRelations).length ? note2(`关联目标缺失：${item.missingRelations.map((relation) => typeof relation === "string" ? relation : relation?.placeId ?? relation?.targetId).filter(Boolean).join("、")}`) : null,
      list2(item.conflicts).length ? node2("ul", {}, item.conflicts.map((conflict) => node2(
        "li",
        {},
        typeof conflict === "string" ? conflict : `${issueNames[conflict.type] || conflict.type || "冲突"}：${conflict.name || conflict.targetId || "请核对候选地点"}`
      ))) : null
    );
  }
  function decisionRow(item) {
    const saved = decisions.get(item.sourceId) ?? {};
    const action = node2("select", {}, option("", "选择处理方式"), ...Object.entries(actionNames).map(([key, label2]) => option(key, label2)));
    action.value = saved.action || "";
    const target = node2("select", {}, option("", "选择已有地点"), places().map((p) => option(p.id, `${p.name} (${p.id})`)));
    const policy = node2("select", {}, option("keep", "保留本地内容"), option("overwrite", "用旧备份覆盖基础内容"));
    const targetFields = node2("div", { class: "fpl-grid" }, field("接收地点", target), field("绑定处理", policy));
    if (saved.targetId) target.value = saved.targetId;
    policy.value = saved.policy || "keep";
    const update = () => {
      targetFields.hidden = action.value !== "bind";
      target.disabled = policy.disabled = targetFields.hidden;
      decisions.set(item.sourceId, { action: action.value, targetId: target.value, policy: policy.value });
    };
    [action, target, policy].forEach((control) => control.addEventListener("change", update));
    update();
    return node2("article", { class: "fpl-import-row fpl-stack" }, node2("h4", {}, item.name), recordFacts(item), field("处理方式", action), targetFields);
  }
  async function reviewPlan() {
    await run(async () => {
      const mappings = selectedMappings(list2(preview.items), decisions);
      const importedHome = mappings.find((entry) => entry.sourceId === preview.sourceHomeId);
      if (useHome && (!importedHome || importedHome.action === "skip" && !list2(preview.items).find((item) => item.sourceId === preview.sourceHomeId)?.existingTargetId)) {
        throw new Error("要迁入旧住所，请为这处地点选择新建、绑定或保留既有映射。");
      }
      if (!useHome && mappings.every((entry) => entry.action === "skip")) throw new Error("请至少选择一处要迁入的地点或选用可映射的旧住所。");
      const updated = await call("previewImport", { ...currentInputs(), mappings, useImportedHome: useHome });
      if (!live()) return;
      if (!updated.previewId) throw new Error("宿主未返回可确认的迁入预览。");
      review = { data: updated, mappings, useHome };
      redraw();
      documentFocus("fpl-review-heading");
    });
  }
  function choices() {
    const home = list2(preview.items).find((item) => item.sourceId === preview.sourceHomeId);
    const style = node2("textarea", { rows: 2, maxlength: 160, oninput: (event) => {
      defaultStyle = event.currentTarget.value;
    } }, defaultStyle);
    const homeChoice = node2("input", { type: "checkbox", checked: useHome, disabled: !home, onchange: (event) => {
      useHome = event.currentTarget.checked;
    } });
    focusTarget = node2("h4", { id: "fpl-plan-heading", tabindex: -1 }, "2. 逐项选择");
    return node2(
      "section",
      { class: "fpl-card fpl-stack" },
      focusTarget,
      note2(`little-world v1 · 来源 ${preview.sourceId || sourceId.trim()} · ${preview.placeCount ?? list2(preview.items).length} 处地点 · ${preview.coverCount ?? 0} 张封面（${bytes(preview.coverBytes)}）`),
      note2(`旧住所：${home?.name || "无可迁入的住所"}。本地住所：${places().find((place) => place.id === snapshot()?.homeId)?.name || "未设置"}。`),
      preview.alreadyImported ? note2("此来源已迁入过。请核对既有映射后选择处理方式。") : null,
      impactBlock(preview),
      list2(preview.items).map(decisionRow),
      node2("label", { class: "fpl-check" }, homeChoice, home ? `将「${home.name}」设为本地住所` : "此备份没有可选的住所"),
      field("从旧世界补录默认画风（可选）", style, "旧导出不包含全局画风。补录只用于所选旧地点的空白画风，不会更改从0开始的肥鱼大冒险的全局画风。"),
      row(button2("查看迁入结果预览", reviewPlan, { class: "fpl-primary" }), button2("更换备份", clearFile))
    );
  }
  async function commit() {
    const confirmed = review;
    if (!confirmed) return;
    await run(async () => {
      const result = await call("commitImport", { previewId: confirmed.data.previewId, mappings: confirmed.mappings, useImportedHome: confirmed.useHome });
      if (!live()) return;
      resetPreview();
      file = void 0;
      receipt = result;
      redraw();
      try {
        await refreshSnapshot();
      } catch {
        if (live()) tell("已收到迁入回执。刷新可重新读取地点和恢复点。", true);
        return;
      }
      if (live()) redraw();
    }, { write: true, onError: () => {
      review = void 0;
      redraw();
    } });
  }
  function describeChange(field2, value) {
    if (value == null || value === "" || Array.isArray(value) && !value.length) return "空";
    if (field2 === "cover") return "有封面";
    if (field2 === "coverFocus") return `${value.x}% × ${value.y}%`;
    if (Array.isArray(value)) return value.map((item) => typeof item === "string" ? item : `${places().find((place) => place.id === item.placeId)?.name ?? item.placeId}：${item.note}`).join("；");
    return String(value);
  }
  function fieldChanges(change) {
    const labels = { name: "名称", aliases: "别名", tags: "标签", kind: "分类", desc: "描写", style: "画风", scene: "场景名", relations: "关联", cover: "封面", coverFocus: "封面焦点" };
    const displayed = list2(change?.fields).filter((entry) => entry.changed || entry.authoritative && entry.incoming && JSON.stringify(entry.local) !== JSON.stringify(entry.incoming));
    return displayed.length ? node2("ul", {}, displayed.map((entry) => node2(
      "li",
      { class: "fpl-wrap" },
      `${labels[entry.field] || entry.field}：${describeChange(entry.field, entry.local)} → ${describeChange(entry.field, entry.result)}${entry.authoritative ? "（以娱乐场所为准）" : ""}`
    ))) : note2("基础内容保持原样。");
  }
  function reviewPanel() {
    const { data, mappings } = review;
    const proposed = data.proposed;
    const results = list2(proposed?.mappings);
    const resultFor = (mapping) => results.find((item) => item.sourceId === mapping.sourceId) ?? { ...mapping, result: mapping.action };
    const homeId = proposed?.homeId;
    const homeSource = list2(data.items).find((item) => item.sourceId === results.find((item2) => item2.targetId === homeId)?.sourceId);
    const approvedHome = places().find((place) => place.id === homeId)?.name ?? homeSource?.name ?? homeId;
    focusTarget = node2("h4", { id: "fpl-review-heading", tabindex: -1 }, "3. 核对并确认");
    const approve = node2("input", { type: "checkbox", onchange: (event) => {
      commitButton.disabled = !event.currentTarget.checked;
    } });
    const commitButton = button2("确认迁入", commit, { class: "fpl-primary", disabled: true });
    const counts = (kind) => mappings.filter((item) => resultFor(item).result === kind).length;
    return node2(
      "section",
      { class: "fpl-card fpl-stack" },
      focusTarget,
      node2("p", {}, `来源 ${data.sourceId || sourceId} · ${counts("new")} 处新建 · ${counts("bind")} 处绑定 · ${counts("skip")} 处跳过 · ${counts("existing")} 处沿用既有映射`),
      proposed?.duplicate ? note2("此方案与已处理的迁入一致。") : null,
      node2("ul", {}, mappings.map((mapping) => {
        const result = resultFor(mapping);
        const item = list2(data.items).find((entry) => entry.sourceId === mapping.sourceId);
        const change = list2(proposed?.changes).find((entry) => entry.sourceId === mapping.sourceId);
        const target = places().find((p) => p.id === result.targetId)?.name || result.targetId;
        const decision = result.result === "existing" ? `沿用已有映射「${target}」` : result.result === "bind" ? `${actionNames.bind}「${target}」 · ${mapping.policy === "overwrite" ? "覆盖可迁入的基础内容" : "保留本地值，仅补空白项"}` : actionNames[result.result];
        return node2("li", {}, `${item?.name ?? mapping.sourceId}：${decision}`, fieldChanges(change));
      })),
      note2(review.useHome ? `住所将设为「${approvedHome ?? preview.sourceHomeId}」。` : "保留本地住所。"),
      note2(defaultStyle.trim() ? `用「${defaultStyle.trim()}」补充所选旧地点的空白画风；保留本地全局画风设置。` : "未提供旧默认画风；保留本地全局画风设置。"),
      impactBlock({ ...data, warnings: proposed?.warnings ?? data.warnings }),
      node2("label", { class: "fpl-check" }, approve, "我已核对地点选择、住所和画风，确认写入从0开始的肥鱼大冒险。"),
      row(commitButton, button2("返回修改选择", () => {
        review = void 0;
        redraw();
        documentFocus("fpl-plan-heading");
      }))
    );
  }
  function recovery() {
    const current = snapshot();
    const pendingRead = receipt && Number.isSafeInteger(receipt.revision) && receipt.revision > (current?.revision ?? -1);
    const recoveryId = pendingRead ? receipt.recoveryId : current?.recoveryId;
    if (!recoveryId) return receipt?.recoveryId ? note2("该迁入恢复点已不可用，后续地点编辑不会被覆盖。") : null;
    async function restore() {
      await run(async () => {
        await call("restoreImport", { recoveryId, revision: recoveryRevision });
        if (!live()) return;
        receipt = void 0;
        showRecovery = false;
        resetPreview();
        await refreshSnapshot();
        if (live()) {
          redraw();
          tell("已恢复到迁入前的地点状态。");
        }
      }, { write: true, onError: () => {
        showRecovery = false;
        redraw();
      } });
    }
    return node2(
      "section",
      { class: "fpl-card fpl-stack" },
      node2("h4", {}, "迁入恢复点"),
      note2("可以恢复到该次迁入前的地点状态。若之后编辑过地点，宿主会阻止恢复以保留新编辑。"),
      showRecovery ? row(button2("确认恢复", restore, { class: "fpl-primary" }), button2("取消", () => {
        showRecovery = false;
        redraw();
      })) : row(button2("恢复到迁入前", () => {
        recoveryRevision = snapshot()?.revision;
        showRecovery = true;
        redraw();
      }))
    );
  }
  function migrationReceipt() {
    if (!receipt) return null;
    const records = list2(receipt.mappings);
    return node2(
      "section",
      { class: "fpl-card fpl-stack" },
      node2("h4", {}, receipt.duplicate ? "这份迁入已处理" : "迁入完成"),
      note2(records.length ? `已处理 ${records.length} 条地点映射。` : "状态已由从0开始的肥鱼大冒险保存。"),
      records.length ? node2("ul", {}, records.map((entry) => node2("li", {}, `${entry.sourceId}${entry.targetId ? ` → ${places().find((p) => p.id === entry.targetId)?.name ?? entry.targetId}` : ` · ${actionNames[entry.action] || "已处理"}`}`))) : null,
      list2(receipt.warnings).map((warning) => note2(typeof warning === "string" ? warning : warning?.message))
    );
  }
  function render() {
    focusTarget = void 0;
    return node2(
      "section",
      { class: "fpl-stack" },
      node2("h3", { tabindex: -1 }, "从鱼的小世界迁入"),
      note2("使用鱼的小世界导出的 little-world v1 文件。地点和封面会写入从0开始的肥鱼大冒险，旧世界仍保留原样。草稿、视图偏好和历史图片归档不在这份迁入范围内。"),
      migrationReceipt(),
      review ? reviewPanel() : preview ? choices() : sourceForm(),
      recovery()
    );
  }
  return { render };
}

// webui/places/styles.js
var STYLES2 = `
.fpl {
  --fpl-ink: var(--foreground, #211e24);
  --fpl-muted: var(--muted-foreground, #615c65);
  --fpl-card: var(--surface, #fbfbfb);
  --fpl-line: var(--border, #dedbe0);
  --fpl-accent: var(--accent, #087f5b);
  --fpl-soft: color-mix(in srgb, var(--fpl-accent) 7%, var(--fpl-card));
  --fpl-round: 12px;
  color: var(--fpl-ink);
  font: 14px/1.6 var(--sans, system-ui, "PingFang SC", "Microsoft YaHei", sans-serif);
  padding: 8px 4px 24px;
  overflow-wrap: anywhere;
}
.fpl * { box-sizing: border-box; }
.fpl h2, .fpl h3, .fpl h4, .fpl p { margin: 0; }
.fpl h2 { font-size: 20px; }
.fpl h3 { font-size: 17px; }
.fpl h4 { font-size: 14px; }
.fpl-header { border-bottom: 1px solid var(--fpl-line); padding-bottom: 12px; margin-bottom: 12px; }
.fpl-kicker { margin: 0 0 6px; font-size: 11px; letter-spacing: .14em; color: var(--fpl-muted); }
.fpl-header h2 { font-size: 30px; line-height: 1.35; letter-spacing: .05em; margin-bottom: 7px; }
.fpl-nav { margin-bottom: 14px; }
.fpl-row { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.fpl-stack { display: grid; gap: 12px; min-width: 0; }
.fpl-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 210px), 1fr)); }
.fpl-card, .fpl-empty, .fpl-feedback:not(:empty) { border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); padding: 13px; }
.fpl-card { background: var(--fpl-card); min-width: 0; }
.fpl-empty { border-style: dashed; background: var(--fpl-soft); }
.fpl-feedback:not(:empty) { margin-bottom: 12px; background: var(--fpl-soft); }
.fpl-feedback[role=alert] { border-color: var(--destructive, #ae4141); }
.fpl-muted { color: var(--fpl-muted); font-size: 12px; }
.fpl-wrap { white-space: pre-wrap; }
.fpl label.fpl-field { display: grid; gap: 4px; align-content: start; min-width: 0; font-weight: 600; }
.fpl .fpl-check { display: flex; align-items: start; gap: 7px; }
.fpl button, .fpl input:not([type=checkbox]), .fpl textarea, .fpl select {
  min-height: 34px;
  padding: 5px 9px;
  border: 1px solid var(--fpl-line);
  border-radius: var(--radius-sm, 6px);
  background: var(--fpl-card);
  color: var(--fpl-ink);
  font: inherit;
}
.fpl input:not([type=checkbox]), .fpl textarea, .fpl select { width: 100%; }
.fpl input[type=range], .fpl input[type=checkbox] { accent-color: var(--fpl-accent); }
.fpl textarea { resize: vertical; }
.fpl button { cursor: pointer; }
.fpl button:hover:not(:disabled), .fpl button[aria-current=page] { border-color: var(--fpl-accent); background: var(--fpl-soft); }
.fpl button.fpl-primary { background: var(--fpl-accent); border-color: var(--fpl-accent); color: var(--accent-foreground, #fff); font-weight: 600; }
.fpl button.fpl-primary:hover:not(:disabled) { background: var(--fpl-accent); filter: brightness(1.08); }
.fpl button:disabled { opacity: .58; cursor: default; }
.fpl :is(button, input, select, textarea, a, summary):focus-visible { outline: 2px solid var(--fpl-accent); outline-offset: 2px; }
.fpl fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
.fpl legend { padding: 0; margin: 0 0 8px; font-weight: 650; }
.fpl .fpl-tile { width: 100%; height: 100%; padding: 13px; display: grid; align-content: start; gap: 6px; text-align: start; border-radius: var(--fpl-round); }
.fpl-tile strong { font-size: 15px; }
.fpl-tile p { display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fpl-chip { border: 1px solid var(--fpl-line); background: var(--fpl-soft); border-radius: 999px; padding: 0 8px; font-size: 12px; }
.fpl-filters { display: flex; flex-wrap: wrap; gap: 6px; }
.fpl button.fpl-chip-toggle { min-height: 0; padding: 3px 11px; border-radius: 999px; font-size: 12px; line-height: 1.6; }
.fpl button.fpl-chip-toggle[aria-pressed="true"] { background: var(--fpl-accent); border-color: var(--fpl-accent); color: var(--accent-foreground, #fff); font-weight: 600; }
.fpl-cover { display: grid; place-items: center; overflow: hidden; border: 1px solid var(--fpl-line); border-radius: 8px; aspect-ratio: 16 / 7; background: var(--fpl-soft); }
.fpl-cover > img { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
.fpl-original { display: block; max-width: 100%; max-height: 60vh; object-fit: contain; margin: 8px auto 0; }
.fpl summary { cursor: pointer; color: var(--fpl-accent); }
.fpl ul { padding-left: 1.3em; margin: 0; }
.fpl .fpl-relation + .fpl-relation, .fpl .fpl-import-row + .fpl-import-row { border-top: 1px solid var(--fpl-line); padding-top: 12px; }
.fpl-artwork-grid { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr)); }
.fpl-artwork-card { display: grid; gap: 9px; align-content: start; }
.fpl-artwork-preview { display: grid; place-items: center; overflow: hidden; border: 1px solid var(--fpl-line); border-radius: 8px; aspect-ratio: 16 / 9; background: var(--fpl-soft); }
.fpl-artwork-preview > img { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
.fpl-artwork-card code { font-size: 11px; color: var(--fpl-muted); }
.fpl-notice { border: 1px solid var(--fpl-line); border-radius: 8px; padding: 8px 10px; background: var(--fpl-soft); }
.fpl-error { color: var(--destructive, #ae4141); }
@media (max-width: 420px) {
  .fpl { padding-inline: 0; }
  .fpl-card { padding: 10px; }
  .fpl-grid { grid-template-columns: 1fr; }
}

/* ── 地点册版式：左栏「我的地点册 / 整理与设置」+ 右侧封面列表 ── */
.fpl-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin: 4px 0 7px; }
.fpl-heading h2 { margin: 0; }
.fpl-shell { display: grid; grid-template-columns: 224px minmax(0, 1fr); gap: 26px; align-items: start; min-width: 0; }
.fpl-rail { min-width: 0; border-right: 1px solid var(--fpl-line); padding-right: 22px; }
.fpl-rail-group + .fpl-rail-group { border-top: 1px solid var(--fpl-line); margin-top: 18px; padding-top: 16px; }
.fpl-rail-title { margin: 0 0 8px; font-size: 10px; letter-spacing: .14em; font-weight: 600; color: var(--fpl-muted); }
.fpl-rail-list { display: grid; gap: 2px; min-width: 0; }
.fpl-rail-item { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-height: 34px; padding: 7px 12px; border: 1px solid transparent; border-radius: 7px; background: none; color: var(--fpl-ink); font-size: 12.5px; text-align: start; position: relative; }
.fpl button.fpl-rail-item { border-color: transparent; background: none; }
.fpl-rail-item:hover:not(:disabled) { background: var(--fpl-soft); }
.fpl-rail-item.on { background: var(--fpl-soft); color: var(--fpl-accent); font-weight: 600; }
.fpl-rail-item.on::before { content: ""; position: absolute; left: 0; top: 9px; bottom: 9px; width: 2px; border-radius: 2px; background: var(--fpl-accent); }
.fpl-rail-count { font-size: 11.5px; font-weight: 500; color: var(--fpl-muted); font-variant-numeric: tabular-nums; }
.fpl-rail-item.on .fpl-rail-count { color: var(--fpl-accent); }
.fpl-rail-set { display: block; width: 100%; min-height: 34px; padding: 7px 12px; border: 1px solid transparent; border-radius: 7px; background: none; color: var(--fpl-muted); font-size: 12px; text-align: start; }
.fpl button.fpl-rail-set { border-color: transparent; background: none; }
.fpl-rail-set:hover:not(:disabled) { background: var(--fpl-soft); color: var(--fpl-accent); }
.fpl-rail-set.on { background: var(--fpl-soft); color: var(--fpl-accent); font-weight: 600; }
.fpl-rail-refresh { margin-top: 8px; border-top: 1px dashed var(--fpl-line); border-radius: 0; padding-top: 10px; }
.fpl-pane { min-width: 0; }

.fpl-toolbar { display: flex; gap: 10px; margin-bottom: 14px; }
.fpl-search { display: flex; align-items: center; flex: 1; min-width: 0; }
.fpl-search input { width: 100%; min-width: 0; padding: 10px 12px; border: 1px solid var(--fpl-line); border-radius: 9px; background: var(--fpl-card); }
.fpl-toolbar select { flex: none; width: 132px; max-width: 100%; padding: 9px 10px; border: 1px solid var(--fpl-line); border-radius: 9px; background: var(--fpl-card); }
.fpl-panehead { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 10px; }
.fpl-pane-count { margin: 0; font-size: 11px; color: var(--fpl-muted); }
.fpl-viewtoggle { min-height: 0; padding: 4px 8px; border: 1px solid transparent; border-radius: 7px; background: none; color: var(--fpl-muted); font-size: 11.5px; }
.fpl button.fpl-viewtoggle { border-color: transparent; background: none; }
.fpl-viewtoggle:hover:not(:disabled) { border-color: var(--fpl-line); color: var(--fpl-accent); }
.fpl-viewtoggle[aria-pressed="true"] { border-color: color-mix(in srgb, var(--fpl-accent) 30%, var(--fpl-line)); background: var(--fpl-soft); color: var(--fpl-accent); }

.fpl-row-list { display: grid; border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); overflow: hidden; background: var(--fpl-card); }
.fpl-listrow { display: grid; grid-template-columns: 112px minmax(0, 1fr) auto; gap: 16px; align-items: center; padding: 12px 16px; border-top: 1px solid var(--fpl-line); min-width: 0; }
.fpl-listrow:first-child { border-top: 0; }
.fpl-thumb { width: 112px; aspect-ratio: 5 / 3; border-radius: 8px; overflow: hidden; background: var(--fpl-soft); display: grid; place-items: center; }
.fpl-thumb img { width: 100%; height: 100%; min-width: 0; min-height: 0; object-fit: cover; }
.fpl-thumb-empty { font-size: 10px; color: var(--fpl-muted); }
.fpl-listrow-main { min-width: 0; display: grid; gap: 4px; }
.fpl-listrow-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.fpl-name { min-height: 0; padding: 0; border: 0; background: none; color: var(--fpl-ink); font-size: 14.5px; font-weight: 600; letter-spacing: .02em; text-align: start; border-radius: 4px; }
.fpl button.fpl-name { border-color: transparent; background: none; padding: 0; }
.fpl-name:hover:not(:disabled) { background: none; color: var(--fpl-accent); text-decoration: underline; }
.fpl-badge { display: inline-flex; align-items: center; padding: 2px 7px; border: 1px solid var(--fpl-line); border-radius: 5px; font-size: 10px; line-height: 1.6; white-space: nowrap; color: var(--fpl-muted); }
.fpl-badge.warm { border-color: color-mix(in srgb, #b4762f 30%, var(--fpl-line)); background: color-mix(in srgb, #b4762f 8%, var(--fpl-card)); color: color-mix(in srgb, #b4762f 70%, var(--fpl-ink)); }
.fpl-listrow-desc { margin: 0; font-size: 12px; line-height: 1.7; color: var(--fpl-muted); overflow-wrap: anywhere; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.fpl-listrow-meta { display: flex; gap: 12px; flex-wrap: wrap; font-size: 11px; color: var(--fpl-muted); }
.fpl-edit { align-self: center; white-space: nowrap; padding: 8px 14px; border: 1px solid var(--fpl-line); border-radius: 9px; background: var(--fpl-card); color: var(--fpl-ink); font-size: 12px; }
.fpl-edit:hover:not(:disabled) { border-color: var(--fpl-accent); background: var(--fpl-soft); color: var(--fpl-accent); }
.fpl-pane-hint { margin: 14px 0 0; font-size: 11px; color: var(--fpl-muted); }
.fpl [hidden] { display: none !important; }
.fpl-tile:hover { border-color: var(--fpl-accent); background: var(--fpl-soft); }

/* 编辑器：这些规则原先只在共享主题层里，地点册单独挂载时吃不到，挪到这里。 */
.fpl-editor { display: grid; gap: 20px; min-width: 0; }
@media (min-width: 900px) { .fpl-editor { grid-template-columns: 200px minmax(0, 1fr); align-items: start; } }
.fpl-editnav { display: grid; gap: 4px; align-content: start; min-width: 0; }
.fpl-editnav .fpl-editnav-cover { margin-bottom: 12px; }
.fpl-editnav button { text-align: start; width: 100%; border: 1px solid transparent; background: transparent; min-height: 38px; padding: 9px 12px; font-size: 12.5px; border-radius: var(--fpl-round); }
.fpl-editnav button[aria-current=page] { background: var(--fpl-soft); border-color: color-mix(in srgb, var(--fpl-accent) 30%, var(--fpl-line)); font-weight: 650; }
.fpl-editnav .fpl-step { color: var(--fpl-muted); margin-right: 10px; font-variant-numeric: tabular-nums; }
.fpl-savebar { position: sticky; bottom: 8px; z-index: 3; display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-top: 18px; padding: 12px 16px; border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); background: color-mix(in srgb, var(--fpl-card) 94%, transparent); backdrop-filter: blur(10px); box-shadow: 0 8px 26px color-mix(in srgb, var(--fpl-ink) 10%, transparent); }
.fpl-savebar-status { font-size: 11.5px; color: var(--fpl-muted); display: flex; align-items: center; gap: 7px; min-width: 0; }
.fpl-savebar-status[data-dirty=true] { color: var(--fpl-accent); font-weight: 600; }
.fpl-dirty-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; flex: none; }
.fpl-formgroup { border: 1px solid var(--fpl-line); border-radius: var(--fpl-round); padding: 16px; background: var(--fpl-card); min-width: 0; }
.fpl-grouphead { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; margin-bottom: 12px; }
.fpl-grouphead h4 { font-size: 14px; margin: 0; }
.fpl-grouphead small { font-size: 11px; color: var(--fpl-muted); }

@media (max-width: 760px) {
  .fpl-shell { display: block; }
  .fpl-rail { border: 0; padding: 0; margin: 0 0 14px; }
  .fpl-rail-group + .fpl-rail-group { border-top: 0; margin-top: 10px; padding-top: 0; }
  .fpl-rail-title { margin: 0 0 6px 2px; }
  .fpl-rail-list { display: flex; gap: 6px; overflow-x: auto; padding: 0 0 3px; scrollbar-width: none; }
  .fpl-rail-list::-webkit-scrollbar { display: none; }
  /* 右侧渐隐：提示第一排筛选还能往右滑（我的地点 / 住所常在屏幕外） */
  .fpl-rail-filters { -webkit-mask-image: linear-gradient(90deg, #000 calc(100% - 26px), transparent); mask-image: linear-gradient(90deg, #000 calc(100% - 26px), transparent); }
  .fpl-rail-item { flex: none; width: auto; min-height: 30px; gap: 6px; padding: 4px 11px; border: 1px solid var(--fpl-line); border-radius: 999px; background: var(--fpl-card); font-size: 12px; }
  .fpl-rail-item.on { border-color: color-mix(in srgb, var(--fpl-accent) 40%, var(--fpl-line)); }
  .fpl-rail-item.on::before { display: none; }
  .fpl-rail-set { flex: none; width: auto; min-height: 30px; padding: 4px 11px; border: 1px solid var(--fpl-line); border-radius: 999px; font-size: 11.5px; }
  .fpl-rail-refresh { margin: 0; border-top: 0; padding-top: 4px; }
  .fpl-toolbar { flex-wrap: wrap; margin-bottom: 12px; }
  .fpl-search { flex: 1 1 100%; }
  .fpl-toolbar select { width: 100%; }
  .fpl-editor { display: block; }
  .fpl-editnav { display: flex; gap: 6px; overflow-x: auto; margin-bottom: 16px; padding-bottom: 4px; scrollbar-width: none; }
  .fpl-editnav::-webkit-scrollbar { display: none; }
  .fpl-editnav button { width: auto; flex: none; white-space: nowrap; border-color: var(--fpl-line); }
  .fpl-editnav .fpl-editnav-cover, .fpl-editnav .fpl-editnav-meta { display: none; }
  .fpl-formgroup { padding: 14px; }
  .fpl-listrow { grid-template-columns: 84px minmax(0, 1fr); gap: 6px 12px; padding: 13px 14px; align-items: start; }
  .fpl-thumb { width: 84px; grid-row: 1 / span 3; }
  .fpl-edit { grid-column: 2; justify-self: start; padding: 6px 11px; font-size: 11.5px; }
  .fpl-header h2 { font-size: 22px; }
}
`;

// webui/places/webui.js
var split = (value) => [...new Set(value.split(/[\n，、,；;]+/u).map((item) => item.trim()).filter(Boolean))];
var MAX_IMAGE_BYTES3 = 8 * 1024 * 1024;
var kinds = { home: "家", around: "附近", frequent: "常去", travel: "旅行", venue: "娱乐场所", place: "普通地点" };
var kindLabel = (place) => place.kindLabel || kinds[place.kind] || place.kind || (place.playable ? "自填场所" : "普通地点");
var CATEGORY_GROUPS = [
  ["玩乐与热闹", ["amusement", "arcade", "ktv", "cinema", "con", "templefair", "market", "bathhouse", "thrift", "venue"]],
  ["自然与户外", ["zoo", "park", "nature"]],
  ["文化与展馆", ["aquarium", "museum", "library"]],
  ["吃喝与休息", ["food", "catcafe"]],
  ["故事地点", ["story"]],
  ["其他地点", ["__none__", "home", "around", "frequent", "travel", "place"]]
];
var categoryValue = (place) => place.kind || "__none__";
var RAIL_FILTERS = [
  ["", "全部地点"],
  ["playable", "可玩场所"],
  ["plain", "只是地点"],
  ["story", "故事地点"],
  ["mine", "我的地点"],
  ["home", "住所"]
];
var RAIL_SETTINGS = [
  ["settings", "住所与默认画风"],
  ["artwork", "本地插画"],
  ["migration", "从小世界迁入"]
];
var BROWSE_VIEWS = ["browse", "detail", "edit", "create", "cover"];
var quickMatch = (place, quick) => {
  switch (quick) {
    case "story":
      return place.storyBound === true;
    case "playable":
      return place.playable === true;
    case "plain":
      return place.playable !== true;
    case "mine":
      return place.userPlace === true;
    case "home":
      return place.isHome === true;
    default:
      return true;
  }
};
function mountPlaces(ctx) {
  const root = ctx.root;
  const document2 = root.ownerDocument;
  const { node: node2, row, note: note2, button: button2, field, option, chip } = dom(document2);
  const section = node2("section", { class: "fpl", "aria-label": "地点册" });
  const feedback3 = node2("div", { class: "fpl-feedback", role: "status" });
  const railFilters = node2("div", { class: "fpl-rail-list fpl-rail-filters", role: "group", "aria-label": "地点筛选" });
  const railSettings = node2("div", { class: "fpl-rail-list" });
  const rail = node2(
    "aside",
    { class: "fpl-rail", "aria-label": "我的地点册" },
    node2("section", { class: "fpl-rail-group" }, node2("p", { class: "fpl-rail-title" }, "我的地点册"), railFilters),
    node2("section", { class: "fpl-rail-group" }, node2("p", { class: "fpl-rail-title" }, "整理与设置"), railSettings)
  );
  const main = node2("div", { class: "fpl-pane" });
  const shell2 = node2("div", { class: "fpl-shell" }, rail, main);
  const addPlace = button2("添加地点", () => {
    tell();
    go("create");
  }, { class: "fpl-primary" });
  const heading2 = node2("div", { class: "fpl-heading" }, node2("h2", {}, "把喜欢的地方，记在这里。"), addPlace);
  section.append(
    node2("style", {}, STYLES2),
    node2(
      "header",
      { class: "fpl-header" },
      node2("p", { class: "fpl-kicker" }, "从0开始的肥鱼大冒险 · 把喜欢的地方，记在这里。"),
      heading2,
      note2("管理地点、游玩内容、封面与关联。")
    ),
    feedback3,
    shell2
  );
  root.replaceChildren(section);
  let snapshot;
  let view = "browse";
  let busy = false;
  let disposed = false;
  let focusAfterRender = false;
  let browseFilter = { text: "", kind: "", quick: "" };
  let browseMode = ctx.memo?.get("fpl-browse-view", "list") === "grid" ? "grid" : "list";
  const coverCache = /* @__PURE__ */ new Map();
  let detailId;
  let detail;
  let editRevision;
  let image;
  let imageError;
  let confirmAction;
  let artworkBusy = "";
  let artworkNotice = "";
  let artworkError = "";
  const artworkFailed = /* @__PURE__ */ new Set();
  const artwork = createArtworkStore(ctx, () => {
    if (live() && view === "artwork") render();
  });
  const live = () => !disposed && !ctx.signal?.aborted;
  const places = () => list2(snapshot?.places);
  const find = (id) => places().find((place) => place.id === id);
  const isHome = (place) => Boolean(place && (place.isHome || snapshot?.homeId === place.id));
  const tell = (message = "", error = false) => {
    feedback3.setAttribute("role", error ? "alert" : "status");
    feedback3.textContent = message;
  };
  async function call(method, payload) {
    const response = await ctx.invoke(method, payload === void 0 ? [] : [payload]);
    if (response?.ok === false) throw new Error(response.error || "宿主拒绝了请求。");
    if (response?.ok !== true) throw new Error("宿主未返回有效结果。");
    return response;
  }
  function accept(result) {
    const next = result.snapshot ?? result;
    if (Array.isArray(next.places)) {
      snapshot = next;
      coverCache.clear();
    }
  }
  async function refreshSnapshot() {
    const result = await call("list");
    if (!Array.isArray((result.snapshot ?? result).places)) throw new Error("没有收到地点列表。");
    accept(result);
  }
  function lock(value) {
    busy = value;
    section.setAttribute("aria-busy", String(value));
    const controls = section.querySelectorAll("button, input, select, textarea");
    for (const control of controls) {
      if (value && !control.disabled) {
        control.disabled = true;
        control.dataset.fplLocked = "true";
      } else if (!value && control.dataset.fplLocked) {
        control.disabled = false;
        delete control.dataset.fplLocked;
      }
    }
  }
  async function run(operation, { write = false, onError } = {}) {
    if (busy || !live()) return;
    tell();
    lock(true);
    try {
      await operation();
    } catch (error) {
      if (!live()) return;
      if (write) {
        try {
          await refreshSnapshot();
        } catch {
        }
      }
      if (!live()) return;
      onError?.();
      tell(`${error?.message || "操作失败。"}${write ? " 请核对当前地点与恢复点，系统不会自动重试写入。" : ""}`, true);
    } finally {
      if (live()) lock(false);
    }
  }
  async function readDetail(id) {
    const result = await call("get", { id });
    if (!live()) return;
    detail = result.place;
    if (!detail) throw new Error("这处地点已找不到。");
    image = void 0;
    imageError = "";
    if (detail.cover) {
      try {
        const result2 = await call("cover", { id });
        if (hasSafeImage(result2.image?.dataUrl)) image = result2.image.dataUrl;
        else imageError = "封面文件暂不可用。";
      } catch {
        imageError = "封面暂时无法读取。";
      }
    }
  }
  function open(id) {
    void run(async () => {
      await readDetail(id);
      if (!live()) return;
      detailId = id;
      go("detail");
    });
  }
  async function submit(method, payload, message, onSuccess) {
    await run(async () => {
      const data = typeof payload === "function" ? await payload() : payload;
      if (!live()) return;
      const result = await call(method, { ...data, revision: editRevision ?? snapshot?.revision });
      if (!live()) return;
      accept(result);
      await onSuccess?.(result);
      if (!live()) return;
      tell(message);
    }, { write: true });
  }
  function go(next) {
    if (!live()) return;
    view = next;
    editRevision = ["edit", "create", "cover", "settings"].includes(next) ? snapshot?.revision : void 0;
    confirmAction = void 0;
    focusAfterRender = true;
    render();
  }
  function thumbnail(place) {
    const badges = [place.playable ? "可玩场所" : "只是地点", kindLabel(place)];
    if (isHome(place)) badges.unshift("住所");
    return node2(
      "button",
      { type: "button", class: "fpl-tile", onclick: () => open(place.id) },
      node2("strong", {}, place.name),
      row(badges.map(chip)),
      place.desc ? note2(place.desc) : note2("还没有地点描写")
    );
  }
  function listRow(place) {
    const badges = [];
    if (isHome(place)) badges.push(["住所", ""]);
    if (place.storyBound) badges.push(["有故事", "warm"]);
    badges.push(place.playable ? ["可玩场所", ""] : ["只是地点", ""]);
    const meta = [
      kindLabel(place),
      `${place.hours?.open || "—"}–${place.hours?.close || "—"}`,
      place.style ? "有地点画风" : snapshot?.defaultStyle ? "使用默认画风" : "未设画风",
      list2(place.relations).length ? `${list2(place.relations).length} 条关联` : null
    ].filter(Boolean);
    const thumb = node2("div", { class: "fpl-thumb", "aria-hidden": "true" });
    if (!place.cover) thumb.append(node2("span", { class: "fpl-thumb-empty" }, "暂无封面"));
    const rowNode = node2(
      "article",
      { class: "fpl-listrow", "data-place-id": place.id },
      thumb,
      node2(
        "div",
        { class: "fpl-listrow-main" },
        node2(
          "div",
          { class: "fpl-listrow-head" },
          button2(place.name, () => open(place.id), { class: "fpl-name" }),
          ...badges.map(([text2, tone]) => node2("span", { class: `fpl-badge${tone ? ` ${tone}` : ""}` }, text2))
        ),
        place.desc ? node2("p", { class: "fpl-listrow-desc" }, place.desc) : note2("还没有地点描写"),
        node2("div", { class: "fpl-listrow-meta" }, meta.map((item) => node2("span", {}, item)))
      ),
      button2("编辑地点", () => {
        detail = place;
        detailId = place.id;
        go("edit");
      }, { class: "fpl-edit" })
    );
    return { place, thumb, rowNode };
  }
  function hydrateCovers(rows) {
    const targets = rows.filter((entry) => entry.place.cover);
    if (!targets.length) return;
    const load = async ({ place, thumb }) => {
      let url = coverCache.get(place.id);
      if (url === void 0) {
        try {
          const result = await call("cover", { id: place.id });
          url = hasSafeImage(result.image?.dataUrl) ? result.image.dataUrl : null;
        } catch {
          url = null;
        }
        coverCache.set(place.id, url);
      }
      if (!live() || !url) return;
      const picture = node2("img", { src: url, alt: `${place.name}的封面`, decoding: "async", loading: "lazy" });
      picture.addEventListener("error", () => {
        coverCache.delete(place.id);
        picture.remove();
      }, { once: true });
      thumb.replaceChildren(picture);
    };
    for (const entry of targets.slice(0, 12)) void load(entry);
    const lazy = targets.slice(12);
    if (!lazy.length) return;
    const Observer = document2.defaultView?.IntersectionObserver;
    if (typeof Observer !== "function") {
      for (const entry of lazy) void load(entry);
      return;
    }
    const observer = new Observer((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const found = lazy.find((item) => item.thumb === entry.target);
        if (found) void load(found);
      }
    });
    for (const entry of lazy) observer.observe(entry.thumb);
  }
  function browse() {
    const search = node2("input", { type: "search", value: browseFilter.text, placeholder: "搜索名称、别名或标签", "aria-label": "搜索地点" });
    const present = [...new Set(places().map(categoryValue))];
    const labelFor = (key) => {
      const place = places().find((item) => categoryValue(item) === key);
      return place ? kindLabel(place) : key === "__none__" ? "普通地点" : key;
    };
    const used = /* @__PURE__ */ new Set();
    const groups = [];
    for (const [label2, keys] of CATEGORY_GROUPS) {
      const entries = keys.filter((key) => present.includes(key));
      if (!entries.length) continue;
      for (const key of entries) used.add(key);
      groups.push(node2("optgroup", { label: label2 }, entries.map((key) => option(key, labelFor(key)))));
    }
    const rest = present.filter((key) => !used.has(key)).sort();
    if (rest.length) groups.push(node2("optgroup", { label: "其他地点" }, rest.map((key) => option(key, labelFor(key)))));
    const category = node2("select", { "aria-label": "按分类筛选" }, option("", "所有分类"), groups);
    category.value = browseFilter.kind;
    const listResults = node2("div", { class: "fpl-row-list" });
    const tileResults = node2("div", { class: "fpl-grid" });
    const count = node2("p", { class: "fpl-pane-count", role: "status" });
    const viewToggle = button2("列表视图", () => {
      browseMode = browseMode === "list" ? "grid" : "list";
      try {
        ctx.memo?.set("fpl-browse-view", browseMode);
      } catch {
      }
      display();
    }, { class: "fpl-viewtoggle", "aria-pressed": "false" });
    const paintView = () => {
      const grid = browseMode === "grid";
      viewToggle.textContent = grid ? "卡片视图" : "列表视图";
      viewToggle.setAttribute("aria-pressed", String(grid));
      listResults.hidden = grid;
      tileResults.hidden = !grid;
    };
    const display = () => {
      const query = browseFilter.text.trim().toLocaleLowerCase();
      const matches = places().filter((place) => quickMatch(place, browseFilter.quick) && (!browseFilter.kind || categoryValue(place) === browseFilter.kind) && (!query || [place.name, place.desc, ...list2(place.aliases), ...list2(place.tags)].some((text2) => String(text2 ?? "").toLocaleLowerCase().includes(query))));
      const filtered = browseFilter.quick || browseFilter.kind || browseFilter.text.trim();
      count.textContent = filtered ? `${matches.length} 处地点（共 ${places().length} 处）` : `${matches.length} 处地点 · 按分类浏览`;
      const rows = matches.map(listRow);
      listResults.replaceChildren(...matches.length ? rows.map((entry) => entry.rowNode) : [node2("p", { class: "fpl-empty" }, "没有符合条件的地点。")]);
      tileResults.replaceChildren(...matches.length ? matches.map(thumbnail) : [node2("p", { class: "fpl-empty" }, "没有符合条件的地点。")]);
      paintView();
      hydrateCovers(rows);
    };
    search.addEventListener("input", () => {
      browseFilter.text = search.value;
      display();
    });
    category.addEventListener("change", () => {
      browseFilter.kind = category.value;
      display();
    });
    display();
    return node2(
      "section",
      { class: "fpl-stack" },
      node2("div", { class: "fpl-toolbar" }, node2("label", { class: "fpl-search" }, search), category),
      node2("div", { class: "fpl-panehead" }, count, viewToggle),
      listResults,
      tileResults,
      node2("p", { class: "fpl-pane-hint" }, "有「能逛的」就是可玩场所，留空也能作为地点保留。")
    );
  }
  function confirm(label2, message, action) {
    return button2(label2, () => {
      confirmAction = { label: label2, message, action };
      render();
      main.querySelector("[data-confirm]")?.focus();
    });
  }
  function confirmation() {
    if (!confirmAction) return null;
    const entry = confirmAction;
    return node2(
      "section",
      { class: "fpl-card fpl-stack", "aria-label": entry.label },
      node2("p", {}, entry.message),
      row(
        button2(`确认${entry.label}`, () => {
          confirmAction = void 0;
          render();
          void entry.action();
        }, { class: "fpl-primary", "data-confirm": "" }),
        button2("取消", () => {
          confirmAction = void 0;
          render();
          main.querySelector("h3")?.focus();
        })
      )
    );
  }
  function coverPreview(place) {
    const preview = node2("div", { class: "fpl-cover" });
    if (!image) {
      preview.append(note2(imageError || "没有封面 · 仍可阅读地点描写"));
      return preview;
    }
    const picture = node2("img", { src: image, alt: `${place.name}的封面`, decoding: "async" });
    const original = node2("details", {}, node2("summary", {}, "查看原图"), node2("img", { class: "fpl-original", src: image, loading: "lazy", alt: `${place.name}的完整封面` }));
    picture.style.objectPosition = `${place.coverFocus?.x ?? 50}% ${place.coverFocus?.y ?? 50}%`;
    picture.addEventListener("error", () => {
      preview.replaceChildren(note2("封面无法显示。"));
      original.remove();
    }, { once: true });
    preview.append(picture);
    return node2("div", { class: "fpl-stack" }, preview, original);
  }
  function coverEditor(place) {
    const file = node2("input", { type: "file", accept: "image/png,image/jpeg,image/gif,image/webp,.png,.jpg,.jpeg,.gif,.webp" });
    const focalX = node2("input", { type: "range", min: 0, max: 100, value: place.coverFocus?.x ?? 50 });
    const focalY = node2("input", { type: "range", min: 0, max: 100, value: place.coverFocus?.y ?? 50 });
    const readFocus = () => ({ x: Number(focalX.value), y: Number(focalY.value) });
    const focusStatus = note2("");
    const preview = coverPreview(place);
    const updatePreview = () => {
      const { x, y } = readFocus();
      focusStatus.textContent = `裁切焦点 ${x}% 横向，${y}% 纵向`;
      const cover = preview.querySelector("img");
      if (cover) cover.style.objectPosition = `${x}% ${y}%`;
    };
    focalX.addEventListener("input", updatePreview);
    focalY.addEventListener("input", updatePreview);
    updatePreview();
    const reload = async () => {
      await readDetail(place.id);
      if (live()) {
        editRevision = snapshot?.revision;
        render();
      }
    };
    const upload = button2(place.cover ? "替换封面" : "上传封面", () => {
      const chosen = file.files?.[0];
      if (!chosen) {
        tell("请选择要上传的封面图片。", true);
        return;
      }
      void submit("setCover", async () => ({ id: place.id, dataUrl: await pictureData(chosen, MAX_IMAGE_BYTES3, document2.defaultView?.FileReader), coverFocus: readFocus() }), "已保存封面。", reload);
    });
    return node2(
      "section",
      { class: "fpl-card fpl-stack" },
      node2("h4", {}, "编辑封面"),
      preview,
      field("选择图片", file, "PNG、JPEG、GIF 或 WebP，最大 8 MiB。"),
      node2("div", { class: "fpl-grid" }, field("水平焦点", focalX), field("垂直焦点", focalY)),
      focusStatus,
      row(
        upload,
        place.cover ? button2("保存焦点", () => submit("update", { id: place.id, patch: { coverFocus: readFocus() } }, "已保存封面焦点。", reload)) : null,
        place.coverFocus ? button2("重置焦点", () => submit("update", { id: place.id, patch: { coverFocus: null } }, "封面已恢复默认居中。", reload)) : null,
        place.cover ? confirm("清空封面", `清空「${place.name}」当前展示的封面？`, () => submit("clearCover", { id: place.id }, "已清空封面。", reload)) : null,
        button2("返回地点", () => go("detail"))
      )
    );
  }
  const CROWD_LABEL = { quiet: "人不多", normal: "人不算多", packed: "人很多" };
  function editorValues(place, controls) {
    if (!controls) {
      return {
        name: place?.name ?? "",
        aliases: list2(place?.aliases),
        tags: list2(place?.tags),
        desc: place?.desc ?? "",
        scene: place?.scene ?? "",
        kind: place?.kind ?? "",
        hours: place?.hours ?? null,
        crowd: place?.crowd ?? "normal",
        outfit: place?.recommendedOutfit ?? "",
        areas: list2(place?.areas),
        souvenirs: list2(place?.souvenirs),
        photoSpots: list2(place?.photoSpots),
        randomEvents: list2(place?.randomEvents),
        food: place?.food ?? null,
        style: place?.style ?? "",
        relations: list2(place?.relations)
      };
    }
    const {
      name,
      aliases,
      tags,
      desc,
      scene,
      kind,
      open: open2,
      close,
      crowd,
      outfit,
      areas,
      souvenirs,
      photoSpots,
      randomEvents,
      foodVerb,
      foodItems,
      style,
      relationRows
    } = controls;
    return {
      name: name.value.trim(),
      aliases: split(aliases.value),
      tags: split(tags.value),
      desc: desc.value.trim(),
      scene: scene.value.trim(),
      kind: kind.value.trim(),
      hours: { open: open2.value.trim(), close: close.value.trim() },
      crowd: crowd.value,
      outfit: outfit.value.trim(),
      areas: split(areas.value),
      souvenirs: split(souvenirs.value),
      photoSpots: split(photoSpots.value),
      randomEvents: split(randomEvents.value),
      food: foodVerb.value === "none" ? null : { verb: foodVerb.value, items: split(foodItems.value) },
      style: style.value.trim(),
      relations: relationRows.map(({ target, annotation }) => ({ placeId: target.value, note: annotation.value.trim() }))
    };
  }
  const lines = (value) => list2(value).join("\n");
  const GROUPS = [
    ["基础资料", "先说明这是一处什么样的地方。"],
    ["游玩内容", "开放时间、能逛的地方与收获都在这儿。"],
    ["画风与封面", "这一处看起来是什么样子。"],
    ["地点关联", "记录两处地点之间的联系。"]
  ];
  function detailSection(title, items) {
    return list2(items).length ? node2("div", { class: "fpl-stack" }, node2("h4", {}, title), node2("ul", { class: "fpl-list" }, items.map((item) => node2("li", {}, item)))) : null;
  }
  function describePlace(place) {
    const facts = [
      isHome(place) ? "住所" : "",
      place.playable ? "可玩场所" : "只是地点",
      kindLabel(place),
      place.overridden ? "改过预设" : ""
    ].filter(Boolean);
    const food = place.food && list2(place.food.items).length ? node2(
      "div",
      { class: "fpl-stack" },
      node2("h4", {}, place.food.verb === "喝" ? "能喝的" : "能吃的"),
      row(place.food.items.map(chip))
    ) : null;
    return node2(
      "section",
      { class: "fpl-card fpl-stack" },
      row(node2("h3", { tabindex: -1 }, place.name), ...facts.map(chip)),
      coverPreview(place),
      node2("p", { class: "fpl-wrap" }, place.desc || "还没有地点描写。"),
      node2(
        "div",
        { class: "fpl-stack" },
        note2(`开放时间：${place.hours?.open || "—"}–${place.hours?.close || "—"} · ${CROWD_LABEL[place.crowd] ?? "人不算多"}`),
        place.recommendedOutfit ? note2(`推荐穿搭：${place.recommendedOutfit}`) : null,
        place.scene ? note2(`场景名：${place.scene}`) : null,
        list2(place.aliases).length ? note2(`别名：${place.aliases.join("、")}`) : null,
        list2(place.tags).length ? row(place.tags.map(chip)) : null,
        node2("p", { class: "fpl-wrap" }, `有效画风：${place.effectiveStyle || place.style || "未设置"}`, place.effectiveStyle || place.style ? `（${styleDescription(place)}）` : ""),
        list2(place.relations).length ? node2("div", {}, node2("h4", {}, "地点关联"), node2("ul", {}, place.relations.map((relation) => node2("li", {}, `${find(relation.placeId)?.name ?? relation.placeId} · ${relation.note}`)))) : null,
        node2(
          "div",
          { class: "fpl-grid" },
          detailSection("能逛的", place.areas),
          detailSection("纪念品", place.souvenirs),
          detailSection("拍照点", place.photoSpots),
          detailSection("可能碰上的小事", place.randomEvents),
          food
        ),
        note2(`地点 ID：${place.id}`)
      ),
      row(
        button2("编辑地点", () => go("edit"), { class: "fpl-primary" }),
        button2("编辑封面", () => go("cover")),
        isHome(place) ? confirm("取消住所", `取消把「${place.name}」设为住所？`, () => submit("setHome", { id: null }, "已取消住所。", () => {
          detail = find(place.id) ?? detail;
          render();
        })) : confirm("设为住所", `将「${place.name}」设为住所？当前出游位置会保持原样。`, () => submit("setHome", { id: place.id }, "已更新住所。", () => {
          detail = find(place.id) ?? detail;
          render();
        })),
        !place.preset ? confirm("删除这处", `删除「${place.name}」？它会从地点表里移除，历史行程与回忆不受影响。`, () => submit("remove", { id: place.id }, "已删除地点。", () => {
          detail = void 0;
          detailId = void 0;
          go("browse");
        })) : null,
        place.preset && place.overridden ? confirm("恢复预设", `把「${place.name}」恢复成预设？你改过的字段会丢掉。`, () => submit("reset", { id: place.id }, "已恢复预设。", async () => {
          await readDetail(place.id);
          render();
        })) : null,
        button2("返回浏览", () => go("browse"))
      )
    );
  }
  function editor(place) {
    const locked = Boolean(place?.preset);
    const name = node2("input", { value: place?.name || "", required: true, maxlength: 40 });
    const aliases = node2("input", { value: list2(place?.aliases).join("、") });
    const kind = node2("input", { value: place?.kind || "", placeholder: "例如：附近", maxlength: 40, ...locked ? { readonly: "" } : {} });
    const desc = node2("textarea", { rows: 4, maxlength: 400 }, place?.desc || "");
    const tags = node2("input", { value: list2(place?.tags).join("、") });
    const scene = node2("input", { value: place?.scene || "", maxlength: 40, ...locked ? { readonly: "" } : {} });
    const open2 = node2("input", { value: place?.hours?.open || "09:00", placeholder: "HH:MM", maxlength: 5 });
    const close = node2("input", { value: place?.hours?.close || "21:00", placeholder: "HH:MM", maxlength: 5 });
    const crowd = node2("select", {}, option("quiet", "人不多"), option("normal", "人不算多"), option("packed", "人很多"));
    crowd.value = place?.crowd ?? "normal";
    const outfit = node2("input", { value: place?.recommendedOutfit || "", maxlength: 40, placeholder: "可选，例如「外出外套」" });
    const areas = node2("textarea", { rows: 4, placeholder: "一行一处，至少一处才算能逛的场所" }, lines(place?.areas));
    const souvenirs = node2("textarea", { rows: 2, placeholder: "一行一样" }, lines(place?.souvenirs));
    const photoSpots = node2("textarea", { rows: 2, placeholder: "一行一处" }, lines(place?.photoSpots));
    const randomEvents = node2("textarea", { rows: 2, placeholder: "一行一条，可选" }, lines(place?.randomEvents));
    const foodVerb = node2("select", {}, option("none", "没有"), option("喝", "喝的"), option("吃", "吃的"));
    foodVerb.value = place?.food?.verb === "喝" ? "喝" : place?.food?.verb === "吃" ? "吃" : "none";
    const foodItems = node2("textarea", { rows: 2, placeholder: "品类名，一行一样；别写味道" }, lines(place?.food?.items));
    const style = node2("textarea", { rows: 2, maxlength: 160 }, place?.style || "");
    const relations = node2("div", { class: "fpl-stack" });
    const relationRows = [];
    const addRelation = (existing) => {
      const target = node2("select", { required: true }, option("", "选择已登记的地点"), places().filter((item) => item.id !== place?.id).map((item) => option(item.id, `${item.name} (${item.id})`)));
      target.value = existing?.placeId ?? "";
      const annotation = node2("input", { value: existing?.note ?? "", required: true });
      const entry = { target, annotation };
      relationRows.push(entry);
      const line2 = node2(
        "div",
        { class: "fpl-relation fpl-stack" },
        node2("div", { class: "fpl-grid" }, field("关联地点", target), field("关联说明", annotation)),
        row(button2("移除这条关联", () => {
          relationRows.splice(relationRows.indexOf(entry), 1);
          line2.remove();
          addButton.focus();
        }))
      );
      relations.append(line2);
      return target;
    };
    const addButton = button2("添加地点关联", () => addRelation()?.focus(), { disabled: !places().some((item) => item.id !== place?.id) });
    for (const existing of list2(place?.relations)) addRelation(existing);
    let group = 0;
    const panels = [];
    const statusText = node2("span", {});
    const statusLine = node2("div", { class: "fpl-savebar-status" }, node2("span", { class: "fpl-dirty-dot" }), statusText);
    const nav = node2("nav", { class: "fpl-editnav", "aria-label": "编辑分组" });
    const headTitle = node2("h4", {});
    const headNote = node2("small", {});
    const body = node2("div", { class: "fpl-stack" }, node2("div", { class: "fpl-grouphead" }, headTitle, headNote));
    const savebar = node2("div", { class: "fpl-savebar" });
    const groupPanel = (index, ...content) => {
      const panel = node2("section", { class: "fpl-formgroup fpl-stack", "data-group": String(index) }, ...content);
      panels.push(panel);
      return panel;
    };
    const controls = () => ({
      name,
      aliases,
      tags,
      desc,
      scene,
      kind,
      open: open2,
      close,
      crowd,
      outfit,
      areas,
      souvenirs,
      photoSpots,
      randomEvents,
      foodVerb,
      foodItems,
      style,
      relationRows
    });
    const initial = JSON.stringify(editorValues(place));
    const dirty = () => JSON.stringify(editorValues(place, controls())) !== initial;
    function paint() {
      for (const [index, panel] of panels.entries()) panel.hidden = index !== group;
      headTitle.textContent = GROUPS[group][0];
      headNote.textContent = GROUPS[group][1];
      statusText.textContent = dirty() ? "有未保存的修改" : "还没有改动";
      statusLine.setAttribute("data-dirty", String(dirty()));
    }
    nav.append(...GROUPS.map(([label2], index) => button2(`${index + 1}. ${label2}`, () => {
      group = index;
      paint();
    }, { "aria-current": group === index ? "page" : null })));
    const form = node2("form", { class: "fpl-stack", onsubmit: (event) => {
      event.preventDefault();
      const relationValues = relationRows.map(({ target, annotation }) => ({ placeId: target.value, note: annotation.value.trim() }));
      if (!name.value.trim() || relationValues.some((rel) => !rel.note || !rel.placeId)) {
        group = name.value.trim() ? 3 : 0;
        paint();
        tell("请补全地点名称和关联说明。", true);
        return;
      }
      if (new Set(relationValues.map((item) => item.placeId)).size !== relationValues.length) {
        group = 3;
        paint();
        tell("请为每个关联地点保留一条说明。", true);
        return;
      }
      const venue = {
        name: name.value.trim(),
        aliases: split(aliases.value),
        tags: split(tags.value),
        desc: desc.value.trim(),
        scene: scene.value.trim(),
        hours: { open: open2.value.trim(), close: close.value.trim() },
        crowd: crowd.value,
        recommendedOutfit: outfit.value.trim(),
        areas: split(areas.value),
        souvenirs: split(souvenirs.value),
        photoSpots: split(photoSpots.value),
        randomEvents: split(randomEvents.value),
        food: foodVerb.value === "none" ? null : { verb: foodVerb.value, items: split(foodItems.value) }
      };
      if (!locked) venue.kind = kind.value.trim();
      const values = { venue, style: style.value.trim(), relations: relationValues };
      void submit(
        place ? "update" : "create",
        place ? { id: place.id, patch: values } : { input: { ...venue, style: values.style, relations: values.relations } },
        place ? "已保存地点。" : "已添加地点。",
        async (result) => {
          const id = place?.id ?? result.place?.id ?? result.id;
          if (!id) {
            go("browse");
            return;
          }
          await readDetail(id);
          if (live()) {
            detailId = id;
            go("detail");
          }
        }
      );
    } });
    body.append(
      groupPanel(
        0,
        node2("div", { class: "fpl-grid" }, field("名字", name), field("别名", aliases, "用顿号或逗号分隔。"), field("分类", kind, locked ? "预设分类由内置定义决定。" : null), field("标签", tags, "用顿号或逗号分隔。")),
        field("描写", desc, "只写空间与陈设，别写她在干什么。"),
        field("场景名（可选）", scene, locked ? "预设的场景名由内置素材决定。" : "素材库里的正名；不知道就留空。"),
        locked ? note2("这是预设地点：改名、描写、时间、能逛的、纪念品这些会存成覆盖层，预设本身不动；分类和场景名由内置定义决定。") : null
      ),
      groupPanel(
        1,
        node2("div", { class: "fpl-grid" }, field("开门时间", open2, "HH:MM"), field("关门时间", close, "HH:MM"), field("人多不多", crowd), field("推荐穿搭", outfit)),
        field("能逛的", areas, "一行一处。至少一处才算可玩场所；留空就是地图上的一个点。"),
        node2("div", { class: "fpl-grid" }, field("纪念品", souvenirs), field("拍照点", photoSpots)),
        field("可能碰上的小事", randomEvents),
        node2("div", { class: "fpl-grid" }, field("能吃能喝", foodVerb), field("能吃能喝的品类", foodItems, "只写品类名，味道归「鱼的每一天」。"))
      ),
      groupPanel(
        2,
        field("地点画风", style, "留空时使用全局默认画风。画风更新后，封面仍使用已保存的图片。"),
        note2("封面在浏览列表里打开一处地点后点「编辑封面」上传；这里只改画风。")
      ),
      groupPanel(
        3,
        note2("以文字记录两处地点的联系，不生成路线或距离。"),
        relations,
        row(addButton)
      )
    );
    for (const control of [name, aliases, tags, desc, scene, kind, open2, close, crowd, outfit, areas, souvenirs, photoSpots, randomEvents, foodVerb, foodItems, style]) {
      control.addEventListener?.("input", paint);
      control.addEventListener?.("change", paint);
    }
    savebar.append(
      statusLine,
      row(
        node2("button", { type: "submit", class: "fpl-primary" }, place ? "保存地点" : "添加地点"),
        place?.preset && place.overridden ? button2("恢复预设", () => confirm("恢复预设", `把「${place.name}」恢复成预设？你改过的字段会丢掉。`, () => submit("reset", { id: place.id }, "已恢复预设。", async () => {
          await readDetail(place.id);
          render();
        }))) : null,
        !place?.preset && place ? button2("删除这处", () => confirm("删除这处", `删除「${place.name}」？它会从地点表里移除，历史行程与回忆不受影响。`, () => submit("remove", { id: place.id }, "已删除地点。", () => {
          detail = void 0;
          detailId = void 0;
          go("browse");
        }))) : null,
        button2("取消编辑", () => go(place ? "detail" : "browse"))
      )
    );
    form.append(body, savebar);
    const wrapper = node2(
      "div",
      { class: "fpl-editor" },
      node2(
        "div",
        { class: "fpl-stack" },
        node2(
          "div",
          { class: "fpl-editnav-meta" },
          node2("h3", { tabindex: -1 }, place ? `编辑地点：${place.name}` : "添加地点"),
          note2(place ? `${place.preset ? "预设地点" : "自己的地点"} · ${place.playable ? "可玩场所" : "只是地点"}` : "填名字就能存；填了「能逛的」才算可玩场所。"),
          place?.preset ? note2("改的是覆盖层：只存你真改过的字段，预设本身不动；分类和场景名由内置定义决定。") : null
        ),
        nav
      ),
      form
    );
    paint();
    return wrapper;
  }
  async function importArtwork(slot, input) {
    const picked = input.files?.[0];
    if (!picked || artworkBusy) return;
    artworkBusy = slot.id;
    artworkError = "";
    artworkNotice = "";
    render();
    try {
      const result = await artwork.import(slot.id, picked);
      if (!live()) return;
      artworkFailed.delete(slot.id);
      artworkNotice = result?.persistent ? "插画已应用，并保存在这台浏览器里。" : "插画已应用；这个浏览器不允许长期保存，刷新后会没有。";
    } catch (error) {
      if (!live()) return;
      artworkError = error?.message || "图片导入失败。";
    } finally {
      artworkBusy = "";
      if (live()) render();
    }
  }
  function artworkView() {
    const slots = RESOURCE_SLOTS.filter((slot) => slot.id !== "creek-letter-ending");
    const cards = slots.map((slot) => {
      const saved = artwork.get(slot.id);
      const failed = artworkFailed.has(slot.id);
      const hasArt = Boolean(saved || failed);
      const file = node2("input", { type: "file", accept: "image/png,image/jpeg,image/webp", hidden: true, "aria-label": `导入${slot.title}插画` });
      file.addEventListener("change", () => void importArtwork(slot, file));
      const preview = node2("div", { class: "fpl-artwork-preview" });
      if (saved) {
        const picture = node2("img", { src: saved, alt: `${slot.title}的本地插画`, decoding: "async" });
        picture.addEventListener("error", () => {
          artwork.markFailed(slot.id);
          artworkFailed.add(slot.id);
          artworkError = "这张图没能显示，已回到示意场景。";
          if (live()) render();
        }, { once: true });
        preview.append(picture);
      } else {
        preview.append(node2("p", { class: "fpl-muted" }, failed ? "图片未能加载 · 默认示意场景" : "默认示意场景"));
      }
      return node2(
        "section",
        { class: "fpl-card fpl-artwork-card" },
        node2("div", {}, node2("h4", {}, slot.title), node2("p", { class: "fpl-muted" }, slot.description)),
        preview,
        node2("code", {}, `story-artwork-v1:${slot.id}`),
        row(
          button2(artworkBusy === slot.id ? "正在读取…" : saved ? "换一张本地图" : "选择本地图", () => file.click(), { disabled: Boolean(artworkBusy) }),
          hasArt ? button2("恢复示意", () => {
            artwork.clear(slot.id);
            artworkFailed.delete(slot.id);
            artworkError = "";
            artworkNotice = "已恢复示意场景。";
            render();
          }) : null
        ),
        file
      );
    });
    return node2(
      "section",
      { class: "fpl-stack" },
      node2("h3", { tabindex: -1 }, "本地插画"),
      note2("只存在这台浏览器里，不上传；换浏览器或清缓存会没有。导入后回到这里、或重新进一次出游面板就能看到。"),
      artworkNotice ? node2("p", { class: "fpl-notice", role: "status" }, artworkNotice) : null,
      artworkError ? node2("p", { class: "fpl-error", role: "alert" }, artworkError) : null,
      node2("div", { class: "fpl-artwork-grid" }, cards),
      node2(
        "section",
        { class: "fpl-card fpl-stack" },
        node2("h4", {}, "关于本地插画"),
        node2("p", {}, "仅接受 PNG、JPEG、WebP，每张不超过 2 MB、1600 万像素；会检查文件类型与内容，不接受 SVG。图片不会上传，请只导入你有权使用的素材。"),
        note2("清理浏览器数据可能移除插画；图片加载失败时会回到文字与示意场景，操作入口照常保留。")
      )
    );
  }
  function settings() {
    editRevision = snapshot.revision;
    const style = node2("textarea", { rows: 3 }, snapshot.defaultStyle || "");
    const home = find(snapshot.homeId);
    const overridden = places().filter((place) => place.overridden).length;
    const card = node2(
      "section",
      { class: "fpl-card fpl-stack" },
      node2("h3", { tabindex: -1 }, "住所与画风"),
      node2("p", {}, `当前住所：${home?.name ?? "未设置"}`),
      note2("打开一个地点即可设置住所。故事首页会展示住所，出游位置单独记录。"),
      node2(
        "form",
        { class: "fpl-stack", onsubmit: (event) => {
          event.preventDefault();
          void submit("setDefaultStyle", { style: style.value.trim() }, "已保存默认画风。", render);
        } },
        field("全局默认画风", style, "仅在地点画风留空时使用。清空后保存即可移除默认画风。"),
        row(node2("button", { type: "submit", class: "fpl-primary" }, "保存默认画风"))
      )
    );
    if (!overridden) return card;
    return node2(
      "div",
      { class: "fpl-stack" },
      card,
      node2(
        "section",
        { class: "fpl-card fpl-stack" },
        node2("h4", {}, "预设地点"),
        note2(`有 ${overridden} 处预设被改过。打开那一处可以单独恢复；也可以一次全部恢复。`),
        row(confirm(
          `恢复全部预设（${overridden} 处）`,
          "把所有改过的预设恢复成插件自带的版本？你自己加的地点不受影响。",
          () => submit("resetAll", {}, "已恢复全部预设。", render)
        ))
      )
    );
  }
  const migration = createMigrationView({ document: document2, places, snapshot: () => snapshot, run, call, tell, render, refreshSnapshot, live });
  function railButton(label2, count, active, onclick) {
    return node2(
      "button",
      { type: "button", class: `fpl-rail-item${active ? " on" : ""}`, "aria-current": active ? "true" : null, onclick },
      node2("span", { class: "fpl-rail-label" }, label2),
      node2("b", { class: "fpl-rail-count" }, String(count))
    );
  }
  function renderRail() {
    const browsing = BROWSE_VIEWS.includes(view);
    const counts = new Map(RAIL_FILTERS.map(([key]) => [key, snapshot ? places().filter((place) => quickMatch(place, key)).length : "—"]));
    railFilters.replaceChildren(...RAIL_FILTERS.map(([key, label2]) => railButton(
      label2,
      counts.get(key),
      browsing && browseFilter.quick === key,
      () => {
        tell();
        browseFilter.quick = key;
        browseFilter.text = "";
        browseFilter.kind = "";
        go("browse");
      }
    )));
    railSettings.replaceChildren(
      ...RAIL_SETTINGS.map(([id, label2]) => node2("button", {
        type: "button",
        class: `fpl-rail-set${view === id ? " on" : ""}`,
        "aria-current": view === id ? "true" : null,
        onclick: () => {
          tell();
          go(id);
        }
      }, label2)),
      node2("button", { type: "button", class: "fpl-rail-set fpl-rail-refresh", onclick: () => void refresh() }, "刷新")
    );
  }
  function render() {
    if (!live()) return;
    renderRail();
    addPlace.hidden = !BROWSE_VIEWS.includes(view);
    let contents;
    if (!snapshot) contents = node2("p", { class: "fpl-empty" }, "正在读取地点库…");
    else if (view === "settings") contents = settings();
    else if (view === "artwork") contents = artworkView();
    else if (view === "migration") contents = migration.render();
    else if (view === "create") contents = editor();
    else if (view === "edit" && detail) contents = editor(detail);
    else if (view === "cover" && detail) contents = coverEditor(detail);
    else if (view === "detail" && detail) contents = describePlace(detail);
    else contents = browse();
    const pending = confirmation();
    main.replaceChildren(...pending ? [pending, contents] : [contents]);
    if (busy) lock(true);
    if (focusAfterRender) {
      focusAfterRender = false;
      main.querySelector("h3")?.focus();
    }
  }
  async function refresh() {
    await run(async () => {
      await refreshSnapshot();
      if (!live()) return;
      if (detailId && view === "detail") {
        if (find(detailId)) await readDetail(detailId);
        else {
          detail = void 0;
          detailId = void 0;
          view = "browse";
        }
      }
      if (live() && !["create", "edit", "cover"].includes(view)) render();
    }, { onError: () => {
      if (!snapshot) main.replaceChildren(node2("p", { class: "fpl-empty" }, "暂时读不到地点库，请刷新重试。"));
    } });
  }
  function dispose() {
    disposed = true;
    ctx.signal?.removeEventListener("abort", dispose);
    if (section.parentNode === root) section.remove();
  }
  ctx.signal?.addEventListener("abort", dispose, { once: true });
  render();
  void refresh();
  return { refresh, dispose };
}

// webui/webui.js
var CSS2 = `
.fun{--f-line:var(--border,#e3e4e3);--f-ink:var(--foreground,#1b1a1e);--f-dim:var(--muted-foreground,#5c5c60);--f-card:var(--surface,#fbfbfb);--f-soft:color-mix(in srgb,var(--surface,#fbfbfb) 92%,var(--foreground,#1b1a1e));--f-accent:var(--accent,#00a870);--f-warm:#e0862f;--f-mint:#00a870;font:13px/1.6 var(--sans,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif);color:var(--f-ink);padding:4px 2px 24px}
.fun *{box-sizing:border-box}
.fun-bar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.fun input,.fun select,.fun button{font:inherit;color:inherit;background:var(--f-card);border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:5px 9px;outline:none}
.fun input:focus,.fun select:focus{border-color:var(--f-accent)}
.fun-search{flex:1;min-width:140px}
.fun button{cursor:pointer;transition:background .12s,border-color .12s}
.fun button:hover{border-color:var(--f-accent)}
.fun-btn-primary{background:var(--f-accent);border-color:var(--f-accent);color:#fff;font-weight:600}
.fun-btn-primary:hover{filter:brightness(1.06)}
.fun-btn-primary[disabled]{opacity:.55;cursor:default;filter:none}
.fun-dim{color:var(--f-dim)}
.fun-sec{font-weight:600;margin:14px 0 7px;font-size:12px;letter-spacing:.04em;color:var(--f-dim);text-transform:none}
.fun-sec:first-child{margin-top:2px}

/* 正在逛的那一趟 */
.fun-draft{border:1px solid var(--f-line);border-left:3px solid var(--f-warm);border-radius:var(--radius-sm,6px);padding:12px 14px;margin-bottom:12px;background:var(--f-card)}
.fun-draft h3{margin:0 0 4px;font-size:15px;font-weight:600}
.fun-draft-actions{display:flex;gap:8px;flex-wrap:wrap;margin-top:10px}
.fun-choice{border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:9px 11px;margin-top:9px;background:var(--f-soft)}
.fun-choice-title{font-size:12px;font-weight:600}
.fun-choice .fun-list{margin-top:4px}
.fun-choice-note{font-size:11.5px;color:var(--f-dim);margin:7px 0 0;line-height:1.5}
.fun-upcoming-wish{margin:-6px 0 12px;padding:8px 11px;border-radius:var(--radius-sm,6px);background:var(--f-soft);color:var(--f-dim);font-size:12px}

.fun-live{border:1px solid var(--f-line);border-left:3px solid var(--f-accent);border-radius:var(--radius-sm,6px);padding:9px 12px;margin-bottom:12px;background:var(--f-card)}
.fun-live-idle{border-left-color:var(--f-line)}
.fun-live h3{margin:0 0 3px;font-size:14px;font-weight:600}
.fun-live .fun-meta{font-size:12px;color:var(--f-dim);margin-bottom:6px}
.fun-chips{display:flex;gap:6px;flex-wrap:wrap;margin-top:6px}
.fun-chip{font-size:12px;padding:2px 8px;border-radius:999px;border:1px solid var(--f-line);background:var(--f-soft);color:var(--f-dim)}
.fun-chip-on{color:var(--f-ink);border-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 14%,transparent)}
.fun-chip-ate{color:var(--f-ink);border-color:var(--f-warm);background:color-mix(in srgb,var(--f-warm) 14%,transparent)}
.fun-chip-phase{color:var(--f-ink);border-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 10%,transparent);font-size:11px}
.fun-phases{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.fun-detail-desc{font-size:12.5px;line-height:1.65;margin:0 0 7px}
.fun-hint{font-size:11.5px;color:var(--f-dim);margin:0 0 9px;line-height:1.55}
.fun-form{border:1px solid var(--f-accent);border-radius:var(--radius-sm,6px);padding:12px 13px;margin-bottom:12px;background:var(--f-soft)}
.fun-form-title{font-weight:600;font-size:14px;margin-bottom:4px}
.fun-form-note{font-size:11.5px;color:var(--f-dim);line-height:1.55;margin-bottom:9px}
.fun-form-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:8px;margin-bottom:8px}
.fun-field{display:flex;flex-direction:column;gap:3px;margin-bottom:7px;min-width:0}
.fun-field-label{font-size:11.5px;color:var(--f-dim);font-weight:600}
.fun input,.fun select,.fun textarea{font:inherit;color:inherit;background:var(--f-card);border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:5px 9px;outline:none;width:100%}
.fun textarea{resize:vertical;line-height:1.5}
.fun input:focus,.fun select:focus,.fun textarea:focus{border-color:var(--f-accent)}
.fun-form-actions{display:flex;gap:8px;align-items:center;margin-top:9px;flex-wrap:wrap}
.fun-form-error{color:#d9534f;font-size:12px;margin-bottom:7px;min-height:1em}
.fun-danger{margin-left:auto;border-color:#d9534f;color:#d9534f}
.fun-detail-actions{display:flex;gap:6px;align-items:center}
.fun-detail-edit{font-size:11.5px;padding:2px 9px;cursor:pointer;background:transparent;border:1px solid var(--f-accent);border-radius:999px;color:var(--f-accent)}
.fun-detail-edit:hover{background:color-mix(in srgb,var(--f-accent) 10%,transparent)}
.fun-note{font-size:11.5px;color:var(--f-dim);margin-top:5px;line-height:1.5}
.fun-stale{color:var(--f-warm)}

/* 场所卡 */
.fun-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(232px,1fr));gap:9px;align-items:start}
.fun-cell{display:flex;flex-direction:column;gap:0;min-width:0}
/* 展开的那一格跨满整行：详情太窄会被挤成一条，读起来比原来更难受。 */
.fun-cell-open{grid-column:1/-1}
.fun-card{border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:9px 11px;background:var(--f-card);cursor:pointer;transition:border-color .12s,background .12s}
.fun-card:hover{border-color:var(--f-accent)}
.fun-card:focus-visible{outline:2px solid var(--f-accent);outline-offset:2px}
.fun-card-closed{opacity:.62}
.fun-card-open{border-left:3px solid var(--f-mint)}
.fun-card-soon{border-left:3px solid var(--f-warm)}
.fun-card-active{border-color:var(--f-accent);border-left-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 7%,var(--f-card));border-bottom-left-radius:0;border-bottom-right-radius:0}
.fun-card-active .fun-card-desc{-webkit-line-clamp:2}
.fun-card-head{display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.fun-card-name{font-weight:600;font-size:13.5px}
.fun-card-state{font-size:11.5px;color:var(--f-dim);white-space:nowrap;margin-left:auto}
.fun-card-state-open{color:var(--f-mint)}
.fun-card-state-soon{color:var(--f-warm)}
.fun-card-arrow{font-size:11px;color:var(--f-dim);width:11px;text-align:center;flex:none}
.fun-card-active .fun-card-arrow{color:var(--f-accent)}
.fun-card-desc{font-size:12px;color:var(--f-dim);margin-top:4px;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.fun-card-foot{display:flex;gap:6px;flex-wrap:wrap;margin-top:7px;font-size:11.5px;color:var(--f-dim)}

/* 详情：紧贴它那张卡、占满整行（不再跑到列表末尾） */
.fun-detail{border:1px solid var(--f-accent);border-top:none;border-radius:0 0 var(--radius-sm,6px) var(--radius-sm,6px);padding:10px 13px 11px;background:var(--f-card)}
.fun-detail-top{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:5px}
.fun-detail h4{margin:0;font-size:14px}
.fun-detail-close{font-size:11.5px;padding:2px 8px;cursor:pointer;background:transparent;border:1px solid var(--f-line);border-radius:999px;color:var(--f-dim)}
.fun-detail-close:hover{border-color:var(--f-accent);color:var(--f-ink)}
.fun-detail p{margin:0 0 6px;font-size:12.5px}
.fun-detail-cols{display:grid;grid-template-columns:minmax(150px,1fr) minmax(150px,1.2fr);gap:14px;align-items:start}
.fun-detail-col{min-width:0}
.fun-detail-cols .fun-sec{margin-top:0}
@media (max-width:560px){.fun-detail-cols{grid-template-columns:1fr;gap:6px}}
.fun-list{margin:5px 0 0;padding-left:17px;font-size:12.5px}
.fun-list li{margin:2px 0}
.fun-scene{font-size:12px;padding:5px 9px;border-radius:var(--radius-sm,6px);background:var(--f-soft);border:1px solid var(--f-line);margin-top:8px}
.fun-scene b{font-weight:600}

/* 纪念册 */
.fun-trip{border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);padding:9px 12px;margin-bottom:8px;background:var(--f-card)}
.fun-trip-head{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
.fun-trip-name{font-weight:600}
.fun-trip-auto{font-size:10.5px;padding:1px 7px;border-radius:999px;color:#7a5a26;
  background:color-mix(in srgb,var(--f-warm,#e0862f) 16%,transparent);border:1px solid color-mix(in srgb,var(--f-warm,#e0862f) 40%,transparent)}
.fun-trip-when{font-size:11.5px;color:var(--f-dim);white-space:nowrap}
.fun-trip-sum{margin-top:3px;font-size:12.5px}
.fun-trip-extras{margin-top:5px;font-size:12px;color:var(--f-dim)}
.fun-trip-actions{display:flex;gap:8px;align-items:center;margin-top:7px}
 .fun-trip-actions{display:flex;gap:6px;align-items:center;margin-top:7px}
 .fun-trip-error{font-size:12px;color:#d9534f}
 .fun-toggle[aria-pressed="true"]{border-color:var(--f-accent);background:color-mix(in srgb,var(--f-accent) 12%,var(--f-card))}
.fun-stats{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:12px;padding:9px 12px;border:1px solid var(--f-line);border-radius:var(--radius-sm,6px);background:var(--f-card)}
.fun-stat b{display:block;font-size:17px;font-weight:600;line-height:1.25}
.fun-stat span{font-size:11.5px;color:var(--f-dim)}
.fun-empty{padding:22px 12px;text-align:center;color:var(--f-dim);font-size:12.5px}
.fun-err{border:1px solid #d9534f;border-radius:var(--radius-sm,6px);padding:10px 12px;color:#d9534f;background:color-mix(in srgb,#d9534f 10%,transparent);font-size:12.5px}
/* 轻手账：跟随宿主主题，只用少量色彩区分内容层次。 */
.fun{font-size:14px;line-height:1.65;padding:8px 4px 24px;--f-round:12px}
.fun button,.fun input,.fun select{min-height:34px}
.fun button:focus-visible,.fun input:focus-visible,.fun select:focus-visible,.fun textarea:focus-visible,.fun summary:focus-visible{outline:2px solid var(--f-accent);outline-offset:3px}
.fun button:disabled{cursor:default;opacity:.6}
.fun .fun-btn-primary{background:var(--f-accent);border-color:var(--f-accent);color:var(--accent-foreground,#fff)}
.fun-heading{margin-bottom:16px;padding:4px 0 12px;border-bottom:1px solid var(--f-line)}
.fun-heading h2{font-size:20px;line-height:1.4;margin:0 0 4px;letter-spacing:.03em}
.fun-heading p{margin:0;color:var(--f-dim);font-size:12.5px}
.fun-kicker{margin:0 0 6px!important;font-size:11px!important;letter-spacing:.14em;color:var(--f-dim)}
.fun-heading-lead{font-size:12.5px!important;line-height:1.8}
.fun-live,.fun-trip,.fun-stats,.fun-form{border-radius:var(--f-round);padding:14px 16px}
.fun-live{background:linear-gradient(120deg,color-mix(in srgb,var(--f-accent) 8%,var(--f-card)),var(--f-card));margin-bottom:16px}
.fun-live h3{font-size:16px}
.fun-grid{grid-template-columns:repeat(auto-fill,minmax(min(232px,100%),1fr));gap:12px}
.fun-card{padding:14px;border-radius:var(--f-round);min-height:136px;background:linear-gradient(180deg,color-mix(in srgb,var(--f-accent) 4%,var(--f-card)),var(--f-card) 65%)}
.fun-card-name{font-size:15px}.fun-card-head{flex-wrap:wrap}.fun-card-desc{line-height:1.7;margin-top:8px}
.fun-detail{padding:16px;border-radius:0 0 var(--f-round) var(--f-round)}
.fun-card-active{border-bottom-left-radius:0;border-bottom-right-radius:0;background:color-mix(in srgb,var(--f-accent) 7%,var(--f-card))}
.fun-tabs,.fun-filters{display:flex;gap:7px;flex-wrap:wrap;margin:12px 0 16px}
.fun-tabs button,.fun-filters button{border-radius:999px;padding:5px 13px;background:transparent}
.fun-tabs button[aria-pressed="true"],.fun-filters button[aria-pressed="true"]{border-color:var(--f-accent);color:var(--f-ink);background:color-mix(in srgb,var(--f-accent) 12%,var(--f-card));font-weight:600}
.fun-stats{gap:18px;background:var(--f-soft);border:none}.fun-stat b{font-size:21px}.fun-stat span{font-size:12px}
.fun-trip-head{flex-wrap:wrap}.fun-trip-name{font-size:14px}.fun-trip-when{white-space:normal}
.fun-date{margin:20px 0 10px;font-size:12px;color:var(--f-dim);font-weight:600;display:flex;align-items:center;gap:10px}
.fun-date:after{content:'';height:1px;background:var(--f-line);flex:1}
.fun-ticket{position:relative;border-left:3px solid color-mix(in srgb,var(--f-accent) 55%,var(--f-line));margin-bottom:12px}
.fun-trip-detail{border-top:1px dashed var(--f-line);margin-top:12px;padding-top:4px}
.fun-trip-detail .fun-sec{margin-top:10px}.fun-trip-detail p{margin:4px 0;font-size:13px;white-space:pre-wrap;overflow-wrap:anywhere}
.fun-wish-history{margin-top:14px}.fun-wish-history>summary{cursor:pointer;padding:8px 0;color:var(--f-dim)}
.fun-shelf-cabinet{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(180px,100%),1fr));gap:10px;margin-top:12px}
.fun-keepsake{border:1px solid var(--f-line);border-radius:10px;padding:12px;background:var(--f-soft);min-width:0}
.fun-keepsake>summary{cursor:pointer;line-height:1.7;overflow-wrap:anywhere}.fun-keepsake>summary strong{display:block;color:var(--f-ink);font-weight:600}
.fun-keepsake .fun-trip-sum{border-top:1px dashed var(--f-line);margin-top:9px;padding-top:9px}
.fun-progress{display:block;width:100%;height:7px;margin:10px 0;accent-color:var(--f-accent);border:0;border-radius:8px;overflow:hidden;background:var(--f-line)}
.fun-progress::-webkit-progress-bar{background:var(--f-line);border-radius:8px}.fun-progress::-webkit-progress-value{background:var(--f-accent);border-radius:8px}.fun-progress::-moz-progress-bar{background:var(--f-accent);border-radius:8px}
.fun-feedback:empty{display:none}.fun-feedback{margin:10px 0}.fun-feedback .fun-err{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.fun-loading{padding:18px;color:var(--f-dim);font-size:13px}.fun-empty{border:1px dashed var(--f-line);border-radius:var(--f-round);margin:10px 0;background:var(--f-soft)}
@media(max-width:420px){.fun{padding-inline:0}.fun-live,.fun-trip,.fun-form{padding:12px}.fun-stats{gap:12px}.fun-detail-cols,.fun-form-grid{grid-template-columns:1fr}.fun-detail-top{flex-wrap:wrap}.fun-trip-actions{flex-wrap:wrap}}
.fun-art{display:block;color:color-mix(in srgb,var(--f-ink) 64%,var(--f-card));background:color-mix(in srgb,var(--f-accent) 5%,var(--f-card));border-radius:8px;margin-bottom:10px;overflow:hidden;pointer-events:none}.fun-art svg{display:block;width:100%;height:116px}.fun-art-detail svg{height:160px}.fun-icon{display:inline-flex;vertical-align:middle;flex:none;width:22px;height:22px;color:var(--f-dim);margin-right:5px}.fun-icon svg{width:100%;height:100%}.fun-keepsake>summary .fun-icon{width:32px;height:32px;margin-bottom:5px}.fun-recommendations{margin:18px 0 20px}.fun-recommendations h3{font-size:16px;margin:0 0 3px}.fun-recommend-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(218px,100%),1fr));gap:12px;margin-top:10px}.fun-recommend-card{padding:13px;border:1px solid var(--f-line);border-radius:var(--f-round);background:var(--f-card);cursor:pointer;transition:border-color .15s,background .15s}.fun-recommend-card:hover{border-color:var(--f-accent)}.fun-recommend-card:focus-visible{outline:2px solid var(--f-accent);outline-offset:3px}.fun-recommend-name{font-weight:650;font-size:15px}.fun-recommend-reason{margin-top:7px;color:var(--f-dim);font-size:12px}.fun-management{margin:16px 0;color:var(--f-dim);font-size:12px}.fun-management>summary{cursor:pointer;padding:6px 0}.fun-management .fun-bar{margin-top:8px}.fun-detail-actions{flex-wrap:wrap}.fun-detail-edit{border-color:var(--f-line);color:var(--f-dim)}.fun-album-filters{display:grid;grid-template-columns:minmax(160px,2fr) minmax(130px,1fr) minmax(130px,1fr);gap:8px;margin:14px 0}.fun-route{padding:10px 13px;border:1px dashed var(--f-line);border-radius:10px;margin:10px 0;font-size:12px}.fun-route-stops{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:5px}.fun-link{background:transparent!important;color:var(--f-accent)!important;font-size:12px!important;min-height:30px!important}.fun-inspector{margin-top:10px;padding:12px;border:1px solid var(--f-line);border-radius:10px;background:var(--f-soft)}.fun-inspector h4{margin:0 0 4px}.fun-inline-status{font-size:12px;color:var(--f-dim);padding:8px 0}.fun-timeline{list-style:none;padding:0;margin:8px 0}.fun-timeline-block{border-left:2px solid var(--f-line);padding:0 0 12px 13px;margin-left:4px}.fun-timeline-block:last-child{padding-bottom:2px}.fun-timeline-area{font-size:13px;font-weight:600;margin-bottom:5px}.fun-timeline-row{display:grid;grid-template-columns:minmax(78px,auto) 1fr;gap:10px;font-size:12.5px;margin:5px 0;overflow-wrap:anywhere}.fun-timeline-time{color:var(--f-dim);font-size:11px;font-variant-numeric:tabular-nums}.fun-timeline-choice{border-left:2px solid color-mix(in srgb,var(--f-accent) 40%,var(--f-line));margin:5px 0 5px 10px;padding-left:8px}.fun-timeline-event{margin:6px 0}.fun-timeline-source{font-size:11px;color:var(--f-dim)}.fun-recommend-card,.fun-inspector,.fun-feedback,.fun-outing-result{animation:fun-appear .16s ease-out}@keyframes fun-appear{from{opacity:.4;transform:translateY(3px)}to{opacity:1;transform:translateY(0)}}.fun-trip-detail,.fun-detail,.fun-inspector{overflow-wrap:anywhere}.fun{--f-art-warm:color-mix(in srgb,#e9b97e 63%,var(--f-card));--f-art-mint:color-mix(in srgb,#79b7a6 62%,var(--f-card));--f-art-blue:color-mix(in srgb,#7cacc2 62%,var(--f-card));--f-art-pink:color-mix(in srgb,#ce91af 56%,var(--f-card))}@media(max-width:560px){.fun-album-filters{grid-template-columns:1fr}.fun-timeline-row{grid-template-columns:78px 1fr}.fun-art-detail svg{height:128px}}@media(prefers-reduced-motion:reduce){.fun *{transition:none!important;animation:none!important;scroll-behavior:auto!important}}



/* ─────────────────────────────────────────────────────────────
   旅行手账主题层（0.4.3）
   在既有类名之上统一配色、圆角、间距与层级；不改 DOM 契约。
   ───────────────────────────────────────────────────────────── */
.fun,.fpl,.sw{
  --f-paper:var(--surface,#fffef9);--f-paper-soft:color-mix(in srgb,var(--f-accent,#3d7462) 5%,var(--surface,#fffef9));
  --f-warm:#a17b4b;--f-round:14px;--f-round-sm:10px;
}
.fun-heading{border-bottom:1px solid var(--f-line);padding-bottom:14px;margin-bottom:20px}
.fun-heading h2{font-size:25px;letter-spacing:.04em;font-weight:650;line-height:1.3;margin:0 0 7px}
.fun-heading p{font-size:12.5px;line-height:1.75}
.fun-tabs button,.fun-filters button{min-height:32px;font-size:12.5px;padding:6px 14px}
.fun-tabs button[aria-pressed="true"],.fun-filters button[aria-pressed="true"]{box-shadow:inset 0 0 0 1px color-mix(in srgb,var(--f-accent) 35%,transparent)}
.fun-card{border-radius:var(--f-round);box-shadow:0 1px 0 color-mix(in srgb,var(--f-ink) 4%,transparent)}
.fun-card:focus-visible{outline:3px solid color-mix(in srgb,var(--f-accent) 55%,transparent);outline-offset:2px}
.fun-stats{border-radius:var(--f-round);background:var(--f-soft);padding:16px 20px}
.fun-stat{min-width:64px}
.fun-stat b{font:26px/1.3 Georgia,serif;font-weight:600;letter-spacing:.02em}
.fun-stat span{font-size:11.5px;letter-spacing:.02em}
.fun-ticket{border-left:3px solid color-mix(in srgb,var(--f-accent) 50%,var(--f-line));border-radius:var(--f-round);padding:16px 18px}
.fun-ticket .fun-trip-head{align-items:center}
.fun-trip-name{font-size:15px;letter-spacing:.02em}
.fun-trip-sum{font-size:13px;line-height:1.8;color:color-mix(in srgb,var(--f-ink) 88%,var(--f-dim))}
.fun-detail{border-radius:0 0 var(--f-round) var(--f-round);padding:18px;border-top:0}
.fun-detail h4{font-size:15.5px;letter-spacing:.02em}
.fun-detail .fun-sec{margin-top:12px;font-size:11px;letter-spacing:.12em;text-transform:uppercase}
.fun-live{border-left:3px solid var(--f-accent);border-radius:var(--f-round);padding:16px 18px}
.fun-live-idle{border-left-color:var(--f-line)}
/* 纪念品架：展示柜网格（跨地点一格一件）与进度卡片 */
.fun-shelf-cabinet{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(198px,100%),1fr));gap:14px;margin-top:12px}
.fun-shelf-cabinet .fun-keepsake{border-radius:var(--f-round);padding:0;background:var(--f-paper);overflow:hidden;transition:border-color .15s,background .15s}
.fun-shelf-cabinet .fun-keepsake:hover,.fun-shelf-cabinet .fun-keepsake[open]{border-color:color-mix(in srgb,var(--f-accent) 45%,var(--f-line))}
.fun-shelf-cabinet .fun-keepsake>summary{display:grid;grid-template-columns:minmax(0,1fr);justify-items:center;gap:3px;padding:18px 14px 14px;text-align:center;border-bottom:1px solid transparent}
.fun-shelf-cabinet .fun-keepsake[open]>summary{border-bottom-color:var(--f-line)}
.fun-shelf-cabinet .fun-keepsake>summary .fun-icon{width:46px;height:46px;margin:0 0 7px;color:var(--f-warm)}
.fun-shelf-cabinet .fun-keepsake>summary strong{font-size:14px;letter-spacing:.02em}
.fun-keepsake-place{font-size:10.5px;color:var(--f-dim);line-height:1.55;overflow-wrap:anywhere}
.fun-keepsake-count{width:100%;margin-top:7px;padding-top:8px;border-top:1px dashed var(--f-line);font-size:10.5px;color:var(--f-dim)}
.fun-shelf-cabinet .fun-keepsake>.fun-note,.fun-shelf-cabinet .fun-keepsake>.fun-trip-sum{padding:0 14px}
.fun-shelf-cabinet .fun-keepsake>.fun-note{padding-top:12px}
.fun-shelf-cabinet .fun-keepsake>.fun-trip-sum:last-child{padding-bottom:14px}
.fun-shelf-places{margin-top:14px}
.fun-sec-row{display:flex;justify-content:space-between;align-items:baseline;gap:12px;flex-wrap:wrap;margin:20px 0 4px}
.fun-sec-row .fun-sec{margin:0}
.fun-sec-row .fun-note{margin:0;font-size:11.5px}
.fun-progress-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(320px,100%),1fr));gap:14px;margin-top:12px}
.fun-progress-card{margin-bottom:0}
.fun-progress-card .fun-trip-sum{margin-top:8px}
.fun-empty{border-radius:var(--f-round);padding:34px 16px}
.fun-form{border-radius:var(--f-round);border-width:1px}
.fun-form-title{font-size:15px;letter-spacing:.03em}
.fun-field-label{font-size:11.5px;letter-spacing:.04em}
.fun input,.fun select,.fun textarea{border-radius:9px}
.fun-chip{border-radius:6px;letter-spacing:.02em}
.fun-recommend-card{box-shadow:0 1px 0 color-mix(in srgb,var(--f-ink) 4%,transparent)}
.fun-art-detail svg{height:180px}
/* 去哪儿：推荐主卡（有推荐时放宽成一张大卡） */
.fun-hero{border:1px solid var(--f-line);border-radius:var(--f-round);overflow:hidden;margin:0 0 18px;background:var(--f-paper)}
.fun-hero-body{padding:22px 24px}
.fun-hero h3{font-size:19px;letter-spacing:.03em;margin:8px 0 6px}
.fun-hero p{font-size:13px;line-height:1.85;color:var(--f-dim);margin-bottom:14px;max-width:52ch}
.fun-hero .fun-art{margin:0;border-radius:0}
.fun-hero .fun-art svg{height:150px}
@media(min-width:720px){
  .fun-hero{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);align-items:stretch}
  .fun-hero .fun-art{order:2;display:flex;align-items:center;margin:0;border-left:1px solid var(--f-line)}
  .fun-hero .fun-art svg{height:100%;min-height:150px}
  .fun-hero-body{order:1}
}
/* 纪念册：票笺日期列 */
.fun-ticket{display:grid;gap:0}
@media(min-width:641px){
  .fun-book-results .fun-ticket{grid-template-columns:86px minmax(0,1fr);align-items:start}
  .fun-book-results .fun-ticket>.fun-ticket-date{border-right:1px dashed var(--f-line);padding-right:16px;margin-right:16px;text-align:center}
  .fun-ticket-date b{display:block;font:34px/1.1 Georgia,serif;letter-spacing:.01em}
  .fun-ticket-date small{display:block;font-size:10.5px;color:var(--f-dim);margin-top:4px}
  .fun-book-results .fun-ticket>.fun-ticket-main{min-width:0}
}
@media(max-width:640px){
  .fun-ticket-date{display:flex;gap:8px;align-items:baseline;margin-bottom:6px}
  .fun-ticket-date b{font:22px/1.2 Georgia,serif}
}
/* 纪念册：主列 + 右侧心愿栏 */
.fun-with-rail{display:grid;gap:20px}
@media(min-width:960px){.fun-with-rail{grid-template-columns:minmax(0,1fr) 276px;align-items:start}}
.fun-book-main{min-width:0}
.fun-rail{border:1px solid var(--f-line);border-radius:var(--f-round);padding:18px;background:var(--f-paper);min-width:0}
.fun-rail h3{font-size:14px;letter-spacing:.03em;margin:0 0 10px}
.fun-rail p{font-size:12px;line-height:1.85;color:var(--f-dim)}
.fun-rail-wish p{font-size:12.5px;line-height:1.9;color:var(--f-ink);margin:0 0 10px;white-space:pre-line}
.fun-rail-wish .fun-chip{display:inline-block;font-size:11px;line-height:1.6}
.fun-rail-more{margin-top:10px!important;font-size:11.5px!important}
.fun-rail .fun-quote{margin-top:18px;padding-top:16px;border-top:1px dashed var(--f-line);font-size:12px;line-height:1.95;color:var(--f-dim);white-space:pre-line}
/* 没有右侧那一栏时（窄屏），摘要留在主列里，不要被 CSS 顺手藏掉。 */
@media(min-width:960px){.fun-wish-summary{display:none}}
@media(max-width:959px){.fun-rail{display:none}}
@media(max-width:640px){
  .fun-album-filters{grid-template-columns:minmax(0,1fr) minmax(0,1fr)}
  .fun-album-filters .fun-book-search{grid-column:1/-1}
  /* 统计改三列：五条数在一块里排整齐，不用挤成 4+1。 */
  .fun-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px 14px}
  /* 票笺窄屏已经横排，进门时间在内容列里还会再出现一次。 */
  .fun-book-results .fun-ticket>.fun-ticket-date small:last-child{display:none}
}
.fun-quickstats{display:flex;gap:10px;flex-wrap:wrap;margin:0 0 16px}
.fun-quickstat{flex:1 1 120px;border:1px solid var(--f-line);border-radius:var(--f-round-sm);padding:12px 14px;background:var(--f-paper-soft);min-width:0}
.fun-quickstat b{display:block;font:20px/1.3 Georgia,serif}
.fun-quickstat span{font-size:11px;color:var(--f-dim)}
/* 故事：底部提示与作品库卡片 */
.sw-bottom-note{font-size:11px;color:var(--sw-muted);text-align:center;padding:22px 0 6px;border-top:1px solid var(--sw-line);margin-top:26px}
.sw-story-card{overflow:hidden}
.sw-story-info{padding:16px 18px}
.sw-story-info h3{font-size:16px;letter-spacing:.02em}
.sw-story-info p{font-size:12.5px;line-height:1.8;color:var(--sw-muted);margin-top:6px}
@media(max-width:420px){
  .fun-heading h2{font-size:20px}
  .fun-hero-body{padding:18px}
  .fun-hero h3{font-size:17px}
  .fun-stat b{font:22px/1.3 Georgia,serif}
  .fun-shelf-cabinet{grid-template-columns:repeat(auto-fill,minmax(min(140px,100%),1fr));gap:10px}
  .fun-shelf-cabinet .fun-keepsake>summary{padding:14px 10px 11px}
  .fun-shelf-cabinet .fun-keepsake>summary .fun-icon{width:38px;height:38px}
  .fun-progress-grid{grid-template-columns:minmax(0,1fr)}
}
@media(prefers-reduced-motion:reduce){
  .fun *,.fpl *,.sw *{transition:none!important;animation:none!important;scroll-behavior:auto!important}
}
@media(prefers-contrast:more){
  .fun,.fpl,.sw{--f-line:currentColor}
}
`;
function ensureStyle(root) {
  if (root.querySelector("style.fun-style")) return;
  root.appendChild(el("style", { class: "fun-style", text: CSS2 }));
}
function shell(root) {
  ensureStyle(root);
  const box = el("div", { class: "fun" });
  root.appendChild(box);
  return box;
}
function sceneArt(place, detail = false) {
  return el("div", {
    class: `fun-art${detail ? " fun-art-detail" : ""}`,
    "aria-hidden": "true",
    "data-artwork": place.userVenue ? "custom" : place.id,
    html: venueArtwork(place.userVenue ? "" : place.id)
  });
}
function itemIcon(name) {
  return el("span", { class: "fun-icon", "aria-hidden": "true", "data-category": souvenirCategory(name), html: souvenirArtwork(name) });
}
function rememberFocus(container) {
  const active = document.activeElement;
  let parent = active;
  while (parent && parent !== container) parent = parent.parentNode;
  const key = parent ? active?.getAttribute?.("data-focus-key") : null;
  const start = active?.selectionStart;
  const end = active?.selectionEnd;
  return () => {
    if (!key) return;
    const target = [...container.querySelectorAll("input"), ...container.querySelectorAll("select")].find((node2) => node2.getAttribute("data-focus-key") === key);
    target?.focus?.();
    if (typeof start === "number" && typeof target?.setSelectionRange === "function" && target.type !== "date") {
      try {
        target.setSelectionRange(start, end);
      } catch {
      }
    }
  };
}
var routeStatus = { planned: "待出发", active: "行程中", between: "站间歇脚", completed: "已完成", cancelled: "已取消" };
function routeSummary(route, trips = [], selectTrip) {
  const node2 = el(
    "section",
    { class: "fun-route", "data-route-id": route.id, "aria-label": "联程记录" },
    el("strong", { text: `联程 · ${routeStatus[route.status] ?? "状态未知"}` }),
    el("div", { class: "fun-route-stops", text: (route.stops ?? []).map((stop) => stop.placeName || stop.placeId).join(" → ") })
  );
  const retained = (route.tripIds ?? []).map((id) => trips.find((trip) => trip.id === id)).filter(Boolean);
  if (selectTrip && retained.length) node2.appendChild(el("div", { class: "fun-route-stops" }, retained.map((trip) => el("button", {
    type: "button",
    class: "fun-link",
    "data-trip-id": trip.id,
    onclick: () => selectTrip(trip)
  }, `${trip.routeOrder ? `第 ${trip.routeOrder} 站 · ` : ""}${trip.placeName} · ${trip.day || "日期不详"}`))));
  if (selectTrip && (route.tripIds ?? []).length > retained.length) node2.appendChild(el("div", { class: "fun-note", text: "较早行程仅保留联程归属，详细记录已归档。" }));
  return node2;
}
function tripDetails(trip) {
  const detail = el("section", { class: "fun-trip-detail", "aria-label": `${trip.placeName}行程详情` });
  if (trip.company) detail.appendChild(el("p", { text: `同行 · ${trip.company}` }));
  if (trip.timelineTruncated) detail.appendChild(el("p", { class: "fun-note", text: "这趟记录较长，时间线保留进门与最近的活动；较早的逐项细节已省略。" }));
  if (trip.routeId) detail.appendChild(el("p", { class: "fun-note", text: `联程${trip.routeOrder ? ` · 第 ${trip.routeOrder} 站` : ""}`, "data-route-id": trip.routeId }));
  const supplied = Array.isArray(trip.timeline) && trip.timeline.length > 0;
  const timeline = supplied ? trip.timeline : [
    ...(trip.visited ?? []).map((area) => ({ kind: "area", text: typeof area === "string" ? area : area.area, area: typeof area === "string" ? area : area.area, at: null })),
    ...(trip.events ?? []).map((text2) => ({ kind: "event", text: text2, event: text2, at: null })),
    ...(trip.choices ?? []).map((choice) => ({ kind: "choice", text: choice.result, event: choice.event, at: null })),
    ...(trip.souvenirs ?? []).map((text2) => ({ kind: "buy", text: text2, at: null })),
    ...(trip.photos ?? []).map((text2) => ({ kind: "photo", text: text2, at: null })),
    ...(trip.ate ?? []).map((item) => ({ kind: "consume", text: `${item.verb}了 ${item.item}`, at: null }))
  ];
  if (timeline.length) {
    detail.appendChild(el("div", { class: "fun-sec", text: "沿途时间线" }));
    if (!supplied) detail.appendChild(el("p", { class: "fun-note", text: "这趟旧记录没有保存逐项时间，以下均标为时间不详。" }));
    const list3 = el("ol", { class: "fun-timeline" });
    const blocks = [];
    let current = null;
    const block = (area) => {
      const node2 = el("li", { class: "fun-timeline-block", "data-area": area || "" }, el("div", { class: "fun-timeline-area", text: area || "途中记录（区域未记）" }));
      const value = { area, node: node2, events: [] };
      blocks.push(value);
      list3.appendChild(node2);
      return value;
    };
    const labels = { enter: "进门", area: "逛到", event: "小事", choice: "选择", buy: "带回", photo: "拍照", consume: "吃喝", close: "回家" };
    for (const entry of timeline) {
      const known = typeof entry.at === "number" && Number.isFinite(entry.at);
      const clock = known ? [entry.day, entry.hm].filter(Boolean).join(" ") || "时间未标注" : "时间不详";
      const row = el(
        "div",
        { class: "fun-timeline-row", "data-kind": entry.kind, "data-at": known ? String(entry.at) : "unknown" },
        el("span", { class: "fun-timeline-time", text: clock }),
        el("span", null, entry.kind === "buy" ? itemIcon(entry.text) : null, `${labels[entry.kind] ?? "记录"} · ${entry.text || (entry.kind === "area" ? entry.area : "") || "未记内容"}`)
      );
      if (entry.kind === "enter" || entry.kind === "close") {
        current = block(entry.kind === "enter" ? "出发与进门" : "回家");
        current.node.appendChild(row);
        current = null;
        continue;
      }
      const source = entry.kind === "choice" ? [...blocks].reverse().flatMap((group) => [...group.events].reverse()).find((event) => entry.event && event.name === entry.event && (!entry.area || event.area === entry.area)) : null;
      if (source && current === source.group && current.lastNode === source.node) {
        source.node.appendChild(el("div", { class: "fun-timeline-choice", "data-event": entry.event }, row));
        continue;
      }
      const area = entry.area || "";
      if (!current || area !== current.area) current = block(area);
      if (entry.kind === "event") {
        const event = el("div", { class: "fun-timeline-event", "data-event": entry.event || entry.text }, row);
        current.events.push({ name: entry.event || entry.text, area: current.area, group: current, node: event });
        current.node.appendChild(event);
        current.lastNode = event;
      } else {
        if (entry.kind === "choice" && entry.event) {
          row.appendChild(el("span", { class: "fun-timeline-source", text: `对应小事：${entry.event}` }));
          const choice = el("div", { class: "fun-timeline-choice", "data-event": entry.event }, row);
          current.node.appendChild(choice);
          current.lastNode = choice;
        } else {
          current.node.appendChild(row);
          current.lastNode = row;
        }
      }
    }
    detail.appendChild(list3);
  }
  if (trip.note) detail.appendChild(el("p", { text: `回家备注 · ${trip.note}` }));
  if (trip.scene) detail.appendChild(el("p", { class: "fun-dim", text: `生图 scene：${trip.scene}${trip.outfit ? ` · outfits：${trip.outfit}` : ""}` }));
  return detail;
}
function tripLookup(ctx, method, parameter, label2) {
  const states = /* @__PURE__ */ new Map();
  const views = /* @__PURE__ */ new Map();
  const redraw = (id) => {
    for (const view of views.get(id) ?? []) {
      if (view.host.isConnected === false) views.get(id).delete(view);
      else view.paint();
    }
  };
  return (id) => {
    const state = states.get(id) ?? { opened: false, pending: false, trips: null, error: "" };
    states.set(id, state);
    const host = el("section", { class: "fun-history", "data-lookup-id": id });
    const paint = () => {
      let focused = document.activeElement;
      while (focused && focused !== host) focused = focused.parentNode;
      host.replaceChildren(el(
        "button",
        {
          type: "button",
          class: "fun-link fun-history-toggle",
          "aria-expanded": String(state.opened),
          disabled: state.pending ? "disabled" : null,
          onclick: () => {
            if (state.pending) return;
            state.opened = !state.opened;
            if (state.opened && state.trips === null) void load();
            else redraw(id);
          }
        },
        state.pending ? "读取中…" : state.opened ? "收起回看" : label2
      ));
      const restore = () => {
        if (!focused) return;
        if (state.pending) {
          host.setAttribute("tabindex", "-1");
          host.focus?.();
        } else host.querySelector(".fun-history-toggle")?.focus?.();
      };
      if (!state.opened) {
        restore();
        return;
      }
      const content = el("div", { class: "fun-history-content", "aria-live": "polite" });
      host.appendChild(content);
      if (state.pending) content.appendChild(el("div", { class: "fun-inline-status", role: "status", text: "正在找这段回忆…" }));
      if (state.error) content.appendChild(el("div", { class: "fun-err", role: "alert" }, el("span", { text: state.error }), el("button", { type: "button", onclick: () => {
        void load();
      } }, "重试")));
      if (state.trips?.length === 0) content.appendChild(el("div", { class: "fun-note", text: "没有可回看的详细行程；较早记录可能已经归档。" }));
      for (const trip of state.trips ?? []) content.appendChild(el(
        "details",
        { class: "fun-inspector", open: state.trips.length === 1 ? "open" : null, "data-trip-id": trip.id },
        el("summary", { text: `${trip.placeName} · ${trip.day || "日期不详"} · ${trip.summary || "行程记录"}` }),
        tripDetails(trip)
      ));
      restore();
    };
    const load = async () => {
      if (state.pending) return;
      state.pending = true;
      state.error = "";
      redraw(id);
      try {
        const result = await ctx.invoke(method, [{ [parameter]: id }]);
        if (!result?.ok) throw new Error(result?.error ?? "详细行程暂时读不到");
        if (!Array.isArray(result.trips)) throw new Error("详细行程格式不正确");
        state.trips = result.trips;
      } catch (error) {
        state.error = error?.message ?? String(error);
      } finally {
        state.pending = false;
        if (!ctx.signal?.aborted) redraw(id);
      }
    };
    if (!views.has(id)) views.set(id, /* @__PURE__ */ new Set());
    views.get(id).add({ host, paint });
    paint();
    return host;
  };
}
function mountPlaces2(ctx) {
  const root = ctx.root;
  root.replaceChildren();
  const box = shell(root);
  const body = el("div");
  box.appendChild(body);
  let keyword = "";
  let quickFilter = "全部";
  let expanded = null;
  let expandedOrigin = "list";
  const historyView = tripLookup(ctx, "history", "placeId", "回看这里的行程");
  let outingAction = "";
  let notice = null;
  let loadSequence = 0;
  let currentData = null;
  const status = feedback(box);
  body.appendChild(el("div", { class: "fun-loading", role: "status", text: "正在看看有哪些地方开着…" }));
  const render = (data) => {
    const restoreFocus = rememberFocus(body);
    currentData = data;
    body.replaceChildren(heading("今天，想去哪儿？", "有些地方适合热闹，有些地方适合慢慢待着。"));
    const pendingChoice = (choice) => choice ? el(
      "div",
      { class: "fun-choice" },
      el("div", { class: "fun-choice-title", text: choice.prompt || "待选择事件" }),
      el("ul", { class: "fun-list" }, choice.options.map((option) => el("li", { text: option.label }))),
      el("p", { class: "fun-choice-note", text: "她可以选一项，也可以略过。" })
    ) : null;
    const draft = data.draft;
    if (draft) {
      const draftAction = (method, label2) => el("button", {
        type: "button",
        disabled: outingAction || method === "resume" && draft.canResume === false ? "disabled" : null,
        onclick: () => resolveDraft(method, draft.id)
      }, outingAction === method ? "处理中…" : label2);
      body.appendChild(el(
        "section",
        { class: "fun-draft" },
        el("h3", { text: `未逛完 · ${draft.placeName}` }),
        el("div", { class: "fun-meta", text: `最后活动 ${draft.lastDay ? `${draft.lastDay} ` : ""}${draft.lastHm} · 逛了 ${draft.visited.length} 处` }),
        el("div", { class: "fun-meta", text: draft.visited.length ? `逛过：${draft.visited.map((v) => v.area).join("、")}` : "还没逛到哪儿" }),
        pendingChoice(draft.pendingChoice),
        draft.canResume === false ? el("div", { class: "fun-meta", text: "这处已不在地点清单中，可以按已有记录回家。" }) : null,
        el("div", { class: "fun-draft-actions" }, draftAction("resume", "继续逛"), draftAction("closeDraft", "按已有记录回家"))
      ));
    }
    if (data.session) {
      const s = data.session;
      const venue = data.places.find((p) => p.id === s.placeId);
      const leftAreas = venue ? venue.areas.filter((a) => !s.visited.some((v) => v.area === a)) : [];
      const leftText = venue?.state === "closed" ? "这处已经打烊" : leftAreas.length ? `还能逛：${leftAreas.slice(0, 5).join("、")}` : "这会儿开放的都逛过了";
      const progress = s.venueAreaCount ? `${s.visited.length}/${s.venueAreaCount}` : String(s.visited.length);
      body.appendChild(el(
        "div",
        { class: "fun-live" },
        el("h3", { text: `正在${s.placeName}逛` }),
        el(
          "div",
          { class: "fun-meta" },
          `${s.enteredHm} 进门 · 待了 ${s.stayedMin} 分钟 · 逛了 ${progress} 处`,
          s.stale ? el("span", { class: "fun-stale", text: " · 这一趟挂得有点久了" }) : null
        ),
        el("div", { class: "fun-meta", text: `逛过：${s.visited.length ? s.visited.map((v) => v.area).join("、") : "还没逛到哪儿"}` }),
        s.souvenirs.length ? el("div", { class: "fun-chips" }, s.souvenirs.map((x) => el("span", { class: "fun-chip fun-chip-on", text: `买了 ${x}` }))) : null,
        s.photos.length ? el("div", { class: "fun-chips" }, s.photos.map((x) => el("span", { class: "fun-chip", text: `📷 ${x}` }))) : null,
        s.ate && s.ate.length ? el("div", { class: "fun-chips" }, s.ate.map((x) => el("span", { class: "fun-chip fun-chip-ate", text: `${x.verb}了 ${x.item}` }))) : null,
        s.events.length ? el("ul", { class: "fun-list" }, s.events.slice(-3).map((e) => el("li", { text: e }))) : null,
        venue ? el("div", { class: "fun-meta", text: leftText }) : null,
        pendingChoice(s.pendingChoice)
      ));
    } else if (!draft) {
      body.appendChild(el(
        "div",
        { class: "fun-live fun-live-idle" },
        el("h3", { text: "这会儿没在逛" }),
        el("div", { class: "fun-meta", text: `现在 ${data.nowHm} · ${data.total} 处地方里 ${data.openCount} 处开着` }),
        el("div", { class: "fun-meta fun-dim", text: "她会自己挑一处进去；你在下面点一张卡也能看细节。" })
      ));
    }
    if (notice) body.appendChild(el("div", {
      class: "fun-meta fun-outing-result",
      role: notice.error ? "alert" : "status",
      tabindex: "-1",
      text: notice.text
    }));
    if (data.upcomingWish) body.appendChild(el("div", { class: "fun-upcoming-wish", text: data.upcomingWish }));
    if (data.route) body.appendChild(routeSummary(data.route));
    const recommendBox = el("section", { class: "fun-recommendations", "aria-label": "此刻推荐" });
    body.appendChild(recommendBox);
    body.appendChild(el("div", { class: "fun-sec", text: "全部地方 · 找一处看看" }));
    const management = el("details", { class: "fun-management" }, el("summary", { text: "地点管理与说明" }));
    const input = el("input", {
      class: "fun-search",
      type: "search",
      placeholder: "搜地方名、别名或标签（庙会 / 室内 / 夜…）",
      "aria-label": "搜索全部地方",
      "data-focus-key": "places-search",
      value: keyword
    });
    input.addEventListener("input", () => {
      keyword = input.value;
      renderList();
    });
    body.appendChild(el("div", { class: "fun-bar" }, input));
    management.appendChild(el(
      "div",
      { class: "fun-hint" },
      `这里只负责看和出发。要改地点（名字、描写、时间、能逛的、纪念品、画风、封面、关联）或添加新地点，请到「地点册」。　预设 ${data.total - data.userVenueCount} 处，自己加了 ${data.userVenueCount} 处。` + (data.overriddenCount ? `　已改过 ${data.overriddenCount} 处预设，可在地点册恢复。` : "") + (data.feast ? "　吃喝的味道会去「鱼的每一天」拿（可在配置里关掉）。" : "　吃喝只记名字、不描述味道（可在配置里打开「去鱼的每一天拿」）。")
    ));
    const filterBar = el("div", { class: "fun-filters", role: "group", "aria-label": "地点快捷筛选" });
    const filterButtons = [];
    for (const label2 of ["全部", "现在开着", "室内", "户外", "夜游", "我的地点"]) {
      const button2 = el("button", { type: "button", "aria-pressed": String(quickFilter === label2), onclick: () => {
        quickFilter = label2;
        for (const item of filterButtons) item.button.setAttribute("aria-pressed", String(item.label === label2));
        renderList();
      } }, label2);
      filterButtons.push({ label: label2, button: button2 });
      filterBar.appendChild(button2);
    }
    body.appendChild(filterBar);
    const listBox = el("div");
    body.appendChild(listBox);
    body.appendChild(management);
    function renderList() {
      listBox.replaceChildren();
      const kw = keyword.trim().toLowerCase();
      recommendBox.replaceChildren();
      const recommendations = [...new Set(data.recommendationIds ?? [])].map((id) => data.places.find((p) => p.id === id && p.state !== "closed")).filter(Boolean).slice(0, 3);
      if (!kw && quickFilter === "全部" && recommendations.length) {
        const [hero, ...rest] = recommendations;
        const heroOpen = expanded === hero.id && expandedOrigin === "recommend";
        const heroCard = el(
          "div",
          {
            class: `fun-recommend-card fun-hero${heroOpen ? " fun-card-active" : ""}`,
            role: "button",
            tabindex: "0",
            "aria-expanded": heroOpen ? "true" : "false",
            "aria-label": `${hero.name}，${hero.stateLabel}，查看详情`,
            "data-place-id": hero.id,
            onclick: () => toggle(hero.id, true),
            onkeydown: (ev) => {
              if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
                ev.preventDefault?.();
                toggle(hero.id, true, true);
              }
            }
          },
          el(
            "div",
            { class: "fun-hero-body" },
            el(
              "div",
              { class: "fun-chips" },
              el("span", { class: "fun-chip fun-chip-on", text: "此刻推荐" }),
              hero.crowdLabel ? el("span", { class: "fun-chip", text: hero.crowdLabel }) : null,
              hero.phase ? el("span", { class: "fun-chip", text: hero.phase }) : null
            ),
            el("h3", { class: "fun-recommend-name", text: hero.name }),
            el("p", { class: "fun-recommend-reason", text: hero.wishReason || hero.revisitReason || `${hero.hours.open}–${hero.hours.close} · ${hero.crowdLabel} · ${hero.stateLabel}` }),
            el(
              "div",
              { class: "fun-chips" },
              el("span", { class: "fun-chip", text: `${hero.hours.open}–${hero.hours.close}` }),
              el("span", { class: "fun-chip", text: hero.stateLabel }),
              hero.tags?.length ? el("span", { class: "fun-chip", text: hero.tags[0] }) : null
            )
          ),
          sceneArt(hero)
        );
        recommendBox.appendChild(heroCard);
        if (heroOpen) recommendBox.appendChild(detail(hero));
        if (rest.length) {
          recommendBox.appendChild(el("p", { class: "fun-note", text: "几处开着的地方，点开只看细节；出发与选择仍由她自己决定。" }));
          recommendBox.appendChild(el("div", { class: "fun-recommend-grid" }, rest.map((p) => {
            const selected = expanded === p.id && expandedOrigin === "recommend";
            const cell2 = el("div", { class: selected ? "fun-cell fun-cell-open" : "fun-cell" }, card(p, true));
            if (selected) cell2.appendChild(detail(p));
            return cell2;
          })));
        }
      }
      const filtered = data.places.filter((p) => {
        const tags = p.tags ?? [];
        if (quickFilter === "现在开着") return p.state !== "closed";
        if (quickFilter === "我的地点") return p.userVenue;
        if (quickFilter === "室内") return tags.some((tag) => tag.includes("室内"));
        if (quickFilter === "户外") return tags.some((tag) => /户外|室外/.test(tag));
        if (quickFilter === "夜游") return tags.some((tag) => /夜/.test(tag));
        return true;
      });
      const matched = kw ? filtered.filter((p) => p.name.toLowerCase().includes(kw) || p.aliases.some((a) => a.toLowerCase().includes(kw)) || p.tags.some((t) => t.toLowerCase().includes(kw))) : filtered;
      const open = matched.filter((p) => p.state !== "closed");
      const closed = matched.filter((p) => p.state === "closed");
      const cell = (p) => {
        const isOpen = expanded === p.id && expandedOrigin === "list";
        const wrap = el("div", { class: isOpen ? "fun-cell fun-cell-open" : "fun-cell" });
        wrap.appendChild(card(p));
        if (isOpen) wrap.appendChild(detail(p));
        return wrap;
      };
      const section = (title, items) => {
        if (!items.length) return;
        listBox.appendChild(el("div", { class: "fun-sec", text: title }));
        listBox.appendChild(el("div", { class: "fun-grid" }, items.map(cell)));
      };
      section(kw || quickFilter !== "全部" ? `筛选结果 · 开着的（${open.length}）` : `开着的（${open.length}）`, open);
      section("已经关了", closed);
      if (!matched.length) {
        listBox.appendChild(el("div", { class: "fun-empty", text: kw ? `没有匹配「${keyword}」的地方，试试其他筛选。` : "这个筛选下还没有地方，换一项看看。" }));
      }
    }
    const card = (p, recommended = false) => {
      const selected = expanded === p.id && expandedOrigin === (recommended ? "recommend" : "list");
      const cls = [recommended ? "fun-recommend-card" : "fun-card"];
      if (p.state === "closed") cls.push("fun-card-closed");
      else if (p.state === "closingSoon") cls.push("fun-card-soon");
      else cls.push("fun-card-open");
      if (selected) cls.push("fun-card-active");
      const stateCls = p.state === "open" ? "fun-card-state-open" : p.state === "closingSoon" ? "fun-card-state-soon" : "";
      const node2 = el(
        "div",
        {
          class: cls.join(" "),
          role: "button",
          tabindex: "0",
          "aria-expanded": selected ? "true" : "false",
          "aria-label": `${p.name}，${p.stateLabel}，查看详情`,
          "data-place-id": p.id,
          onclick: () => toggle(p.id, recommended),
          onkeydown: (ev) => {
            if (ev.key === "Enter" || ev.key === " " || ev.key === "Spacebar") {
              ev.preventDefault?.();
              toggle(p.id, recommended, true);
            }
          }
        },
        sceneArt(p),
        el(
          "div",
          { class: "fun-card-head" },
          el("span", { class: recommended ? "fun-recommend-name" : "fun-card-name", text: p.name }),
          p.phase ? el("span", { class: "fun-chip fun-chip-phase", text: p.phase }) : null,
          el("span", { class: `fun-card-state ${stateCls}`, text: p.stateLabel }),
          el("span", { class: "fun-card-arrow", text: selected ? "⌃" : "⌄" })
        ),
        recommended ? el("div", { class: "fun-recommend-reason", text: p.wishReason || p.revisitReason || `${p.hours.open}–${p.hours.close} · ${p.crowdLabel} · ${p.phase || p.tags?.slice(0, 2).join(" / ") || "现在开着"}` }) : null,
        recommended ? null : el("div", { class: "fun-card-desc", text: p.desc }),
        !recommended && p.wishReason ? el("div", { class: "fun-meta", text: p.wishReason }) : null,
        !recommended && p.revisitReason ? el("div", { class: "fun-meta", text: p.revisitReason }) : null,
        el(
          "div",
          { class: "fun-card-foot" },
          el("span", { text: `${p.hours.open}–${p.hours.close}` }),
          el("span", { text: p.crowdLabel }),
          el("span", { text: `${p.areaCount} 处可逛` }),
          p.food ? el("span", { class: "fun-chip fun-chip-ate", text: p.food.verb === "喝" ? "能喝" : "能吃" }) : null,
          p.visitCount > 0 ? el("span", { class: "fun-chip", text: `去过 ${p.visitCount} 次` }) : null,
          p.recent ? el("span", { class: "fun-chip", text: "刚去过" }) : null
        )
      );
      return node2;
    };
    function toggle(id, recommended = false, keyboard = false) {
      const origin = recommended ? "recommend" : "list";
      const wasOpen = expanded === id && expandedOrigin === origin;
      expanded = wasOpen ? null : id;
      expandedOrigin = origin;
      renderList();
      if (keyboard) [...(recommended ? recommendBox : listBox).querySelectorAll(recommended ? ".fun-recommend-card" : ".fun-card")].find((node2) => node2.getAttribute("data-place-id") === id)?.focus?.();
      if (!wasOpen) {
        const active = (recommended ? recommendBox : listBox).querySelector(".fun-card-active");
        const target = active?.parentNode ?? active;
        if (target && typeof target.scrollIntoView === "function") {
          target.scrollIntoView({ block: "nearest", behavior: "auto" });
        }
      }
    }
    const detail = (p) => {
      const d = el(
        "div",
        { class: "fun-detail" },
        el(
          "div",
          { class: "fun-detail-top" },
          el(
            "h4",
            { text: p.name },
            p.overridden ? el("span", { class: "fun-chip fun-chip-on", text: "已改", style: { marginLeft: "6px" } }) : null
          ),
          el(
            "div",
            { class: "fun-detail-actions" },
            el("button", {
              class: "fun-detail-close",
              type: "button",
              title: "收起",
              onclick: (ev) => {
                ev?.stopPropagation?.();
                expanded = null;
                renderList();
              }
            }, "收起")
          )
        ),
        sceneArt(p, true),
        el("p", { class: "fun-dim", text: `${p.kindLabel} · ${p.crowdLabel} · ${p.hours.open}–${p.hours.close} · ${p.stateLabel}` }),
        // 此刻的那段描写：有阶段的场所显示的是「这会儿的样子」，不是通用那段。
        el("p", { class: "fun-detail-desc", text: p.desc }),
        // 时段一览：让她和主人都看得出「换个时间来是另一副样子」。
        p.phases && p.phases.length > 1 ? el(
          "div",
          {},
          el("div", { class: "fun-sec", text: "不同时段" }),
          el("div", { class: "fun-phases" }, p.phases.map((ph) => el("span", {
            class: ph.label === p.phase ? "fun-chip fun-chip-phase fun-chip-on" : "fun-chip",
            title: `${ph.from}–${ph.to}`,
            text: `${ph.label} ${ph.from}–${ph.to}`
          })))
        ) : null,
        // 三块并成一排：能逛的 / 纪念品 / 拍照点，省纵向高度（原来三个小节摞起来很高）。
        el(
          "div",
          { class: "fun-detail-cols" },
          el(
            "div",
            { class: "fun-detail-col" },
            el("div", { class: "fun-sec", text: "能逛的" }),
            el("ul", { class: "fun-list" }, p.areas.map((a) => el("li", { text: a })))
          ),
          el(
            "div",
            { class: "fun-detail-col" },
            el("div", { class: "fun-sec", text: "纪念品" }),
            el("div", { class: "fun-chips" }, p.souvenirs.map((s) => el("span", { class: "fun-chip" }, itemIcon(s), s))),
            el("div", { class: "fun-sec", text: "拍照点" }),
            el("div", { class: "fun-chips" }, p.photoSpots.map((s) => el("span", { class: "fun-chip", text: s }))),
            p.food ? el(
              "div",
              {},
              el("div", { class: "fun-sec", text: `能${p.food.verb}的` }),
              el("div", { class: "fun-chips" }, p.food.items.map((s) => el("span", { class: "fun-chip", text: s }))),
              el("div", { class: "fun-note", text: `味道不在这儿——装了「鱼的每一天」才有九维口感，没装就只知道${p.food.verb}了什么。` })
            ) : null
          )
        ),
        el(
          "div",
          { class: "fun-scene" },
          p.hasScene ? el("span", {}, "生图时 ", el("b", { text: `scene 填「${p.scene}」` }), `，outfits 建议「${p.outfit}」`) : el("span", {}, "素材库里没有这处的场景，生图时 ", el("b", { text: "scene 不用填" }), "，把地方写进 prompt 就行")
        ),
        el("div", { class: "fun-note", text: "要改这处地点（名字、描写、时间、能逛的、纪念品、画风、封面、关联），请到「地点册」——那里是唯一的编辑器。" })
      );
      d.appendChild(historyView(p.id));
      return d;
    };
    renderList();
    restoreFocus();
  };
  const load = async () => {
    const sequence = ++loadSequence;
    try {
      const data = await ctx.invoke("list");
      if (sequence !== loadSequence || ctx.signal?.aborted) return;
      if (!data?.ok) throw new Error(data?.error ?? "返回不正常");
      status.replaceChildren();
      render(data);
    } catch (err) {
      if (sequence !== loadSequence || ctx.signal?.aborted) return;
      if (!currentData) body.replaceChildren();
      status.replaceChildren(errorCard(err, load, Boolean(currentData)));
    }
  };
  async function resolveDraft(method, id) {
    if (outingAction) return;
    outingAction = method;
    notice = null;
    render(currentData);
    try {
      const result = await ctx.invoke(method, [{ id }]);
      if (!result?.ok) throw new Error(result?.error ?? "行程更新失败");
      notice = { text: result.text || "行程已更新。" };
      currentData = { ...currentData, draft: null };
    } catch (err) {
      notice = { text: err?.message ?? String(err), error: true };
    } finally {
      outingAction = "";
      if (ctx.signal?.aborted) return;
      render(currentData);
      await load();
      body.querySelector(".fun-outing-result")?.focus?.();
    }
  }
  void load();
  ctx.interval(() => {
    void load();
  }, 6e4);
  return { refresh: load };
}
function mountBook(ctx) {
  const root = ctx.root;
  root.replaceChildren();
  const box = shell(root);
  const body = el("div");
  box.appendChild(body);
  let bookTab = "all";
  let bookKeyword = "";
  let bookPlace = "";
  let bookDate = "";
  let wishFormOpen = false;
  const expandedTrips = /* @__PURE__ */ new Set();
  const status = feedback(box);
  body.appendChild(el("div", { class: "fun-loading", role: "status", text: "正在翻开纪念册…" }));
  const pending = /* @__PURE__ */ new Set();
  const errors = /* @__PURE__ */ new Map();
  let currentData = null;
  let wishDraft = { placeId: "", type: "", target: "", reason: "" };
  const wishPending = /* @__PURE__ */ new Set();
  const wishErrors = /* @__PURE__ */ new Map();
  const wishTypes = { visit: "去看看", area: "逛一处", phase: "在某个时段去", souvenir: "带回纪念品" };
  const renderWishes = (data) => {
    const places = data.places ?? [];
    const wishes = data.wishes ?? [];
    const adding = wishPending.has("add");
    const section = el("section", { class: "fun-wishes", "aria-label": "出游心愿" });
    section.appendChild(el(
      "div",
      { class: "fun-bar" },
      el("span", { class: "fun-sec", text: "出游心愿" }),
      el("button", { type: "button", "aria-expanded": String(wishFormOpen), disabled: adding ? "disabled" : null, onclick: () => {
        wishFormOpen = !wishFormOpen;
        render(currentData);
      } }, wishFormOpen ? "收起表单" : "记个心愿")
    ));
    const field = (label2, input) => el(
      "label",
      { class: "fun-field" },
      el("span", { class: "fun-field-label", text: label2 }),
      input
    );
    const select = (className, placeholder, options, value) => {
      const input = el(
        "select",
        { class: className, disabled: adding ? "disabled" : null },
        el("option", { value: "", text: placeholder }),
        options.map(([id, name]) => el("option", { value: id, text: name }))
      );
      input.value = value;
      return input;
    };
    const place = places.find((p) => p.id === wishDraft.placeId);
    const targets = place ? (wishDraft.type === "area" ? place.areas : wishDraft.type === "phase" ? place.phaseNames : wishDraft.type === "souvenir" ? place.souvenirs : []) ?? [] : [];
    const placeInput = select("fun-wish-place", "请选择地点", places.map((p) => [p.id, p.name]), wishDraft.placeId);
    const typeInput = select("fun-wish-type", "请选择心愿类型", Object.entries(wishTypes), wishDraft.type);
    const targetInput = select(
      "fun-wish-target",
      wishDraft.type === "visit" ? "去看看无需目标" : !place || !wishDraft.type ? "先选择地点和类型" : targets.length ? "请选择目标" : "此地点没有可选目标",
      targets.map((target) => [target, target]),
      wishDraft.target
    );
    targetInput.disabled = adding || !targets.length;
    const reasonInput = el("input", { class: "fun-wish-reason", type: "text", placeholder: "可选，记下为什么想去", disabled: adding ? "disabled" : null });
    reasonInput.value = wishDraft.reason;
    placeInput.addEventListener("change", () => {
      wishDraft.placeId = placeInput.value;
      wishDraft.target = "";
      wishErrors.delete("add");
      render(currentData);
    });
    typeInput.addEventListener("change", () => {
      wishDraft.type = typeInput.value;
      wishDraft.target = "";
      wishErrors.delete("add");
      render(currentData);
    });
    targetInput.addEventListener("change", () => {
      wishDraft.target = targetInput.value;
    });
    reasonInput.addEventListener("input", () => {
      wishDraft.reason = reasonInput.value;
    });
    const errorNode = el("div", { class: "fun-form-error", role: "alert", text: wishErrors.get("add") ?? "" });
    const save = async () => {
      if (wishPending.has("add")) return;
      const payload = {
        action: "add",
        placeId: placeInput.value,
        type: typeInput.value,
        target: typeInput.value === "visit" ? "" : targetInput.value,
        reason: reasonInput.value.trim()
      };
      const chosenPlace = (currentData.places ?? []).find((p) => p.id === payload.placeId);
      const validTargets = chosenPlace ? (payload.type === "area" ? chosenPlace.areas : payload.type === "phase" ? chosenPlace.phaseNames : chosenPlace.souvenirs) ?? [] : [];
      if (!chosenPlace || !Object.hasOwn(wishTypes, payload.type) || payload.type !== "visit" && !validTargets.includes(payload.target)) {
        const message = "请选择地点、心愿类型及对应目标。";
        wishErrors.set("add", message);
        errorNode.textContent = message;
        return;
      }
      wishDraft = { placeId: payload.placeId, type: payload.type, target: payload.target, reason: reasonInput.value };
      await changeWish("add", payload, data);
    };
    if (wishFormOpen) section.appendChild(el(
      "div",
      { class: "fun-form fun-wish-form" },
      el("div", { class: "fun-form-note", text: "由你选择想去的地方，按保存才记下心愿；心愿不保证立即出发。" }),
      el("div", { class: "fun-form-grid" }, field("地点", placeInput), field("心愿类型", typeInput), field("目标", targetInput)),
      field("缘由（可选）", reasonInput),
      errorNode,
      el("button", { class: "fun-btn-primary", type: "button", disabled: adding ? "disabled" : null, onclick: save }, adding ? "保存中…" : "保存心愿")
    ));
    if (!wishes.length) section.appendChild(el("div", { class: "fun-note", text: "还没有出游心愿，想好了再记下。" }));
    const statusNames = { active: "待实现", paused: "已暂缓", completed: "已实现", cancelled: "已取消" };
    const history = el("details", {
      class: "fun-wish-history",
      open: wishes.some((w) => w.status !== "active" && (wishErrors.has(`wish:${w.id}`) || wishPending.has(`wish:${w.id}`))) ? "open" : null
    }, el("summary", { text: `已实现、暂缓与取消（${wishes.filter((w) => w.status !== "active").length}）` }));
    for (const wish of wishes) {
      const key = `wish:${wish.id}`;
      const busy = wishPending.has(key);
      const state = wish.status;
      const actions = el("div", { class: "fun-trip-actions" });
      if (state === "active" || state === "paused") {
        actions.appendChild(el("button", {
          type: "button",
          disabled: busy ? "disabled" : null,
          onclick: () => changeWish(key, { action: state === "paused" ? "resume" : "pause", id: wish.id }, data)
        }, state === "paused" ? "恢复" : "暂缓"));
        actions.appendChild(el("button", {
          type: "button",
          disabled: busy ? "disabled" : null,
          onclick: () => changeWish(key, { action: "cancel", id: wish.id }, data)
        }, "取消"));
      }
      if (busy) actions.appendChild(el("span", { class: "fun-dim", text: "保存中…" }));
      if (wishErrors.has(key)) actions.appendChild(el("span", { class: "fun-trip-error", role: "alert", text: wishErrors.get(key) }));
      (state === "active" ? section : history).appendChild(el(
        "div",
        { class: "fun-wish fun-trip" },
        el(
          "div",
          { class: "fun-trip-head" },
          el("span", { class: "fun-trip-name", text: wish.placeName ?? places.find((p) => p.id === wish.placeId)?.name ?? wish.placeId }),
          el("span", { class: "fun-wish-status fun-dim", text: statusNames[state] ?? state ?? "状态未知" })
        ),
        el("div", { class: "fun-trip-sum", text: `${wishTypes[wish.type] ?? wish.type}${wish.target ? ` · ${wish.target}` : ""}` }),
        wish.reason ? el("div", { class: "fun-wish-note fun-note", text: `缘由：${wish.reason}` }) : null,
        actions
      ));
    }
    if (wishes.some((w) => w.status !== "active")) section.appendChild(history);
    body.appendChild(section);
  };
  const changeWish = async (key, payload, data) => {
    if (wishPending.has(key)) return;
    wishPending.add(key);
    wishErrors.delete(key);
    render(currentData ?? data);
    let saved = false;
    try {
      const result = await ctx.invoke("wish", [payload]);
      if (!result?.ok) throw new Error(result?.error ?? "心愿保存失败");
      saved = true;
      if (key === "add") {
        wishDraft = { placeId: "", type: "", target: "", reason: "" };
        wishFormOpen = false;
      }
      await load(true);
    } catch (error) {
      wishErrors.set(key, `${saved ? "已保存，但列表刷新失败：" : ""}${error?.message ?? String(error)}`);
      if (key === "add") wishFormOpen = true;
    } finally {
      wishPending.delete(key);
      render(currentData ?? data);
    }
  };
  const bookRail = (activeWishes) => el(
    "aside",
    { class: "fun-rail fun-book-rail", "aria-label": "下次想去" },
    el("h3", { text: "下次想去" }),
    activeWishes.length ? [
      el(
        "div",
        { class: "fun-rail-wish" },
        el("p", { text: activeWishes[0].reason || `${wishTypes[activeWishes[0].type] ?? "想去"}${activeWishes[0].target ? ` · ${activeWishes[0].target}` : ""}，${activeWishes[0].placeName ?? activeWishes[0].placeId}` }),
        el("span", { class: "fun-chip", text: `${activeWishes[0].placeName ?? activeWishes[0].placeId} · ${wishTypes[activeWishes[0].type] ?? activeWishes[0].type}` })
      ),
      activeWishes.length > 1 ? el("p", { class: "fun-rail-more", text: `另外还记着 ${activeWishes.length - 1} 个心愿，去「心愿」页签里看。` }) : null
    ] : el("p", { text: "还没有记下的心愿。在「心愿」页签里记一个，她出门时会顺路想着。" }),
    el("div", { class: "fun-quote", text: "心愿只作提醒。\n什么时候出门，由她决定。" })
  );
  const render = (data) => {
    const restoreFocus = rememberFocus(body);
    currentData = data;
    body.replaceChildren(heading("那些一起出门的日子。", "每一趟都留在这里，想起时再翻一翻。"));
    if (data.session) body.appendChild(el(
      "div",
      { class: "fun-live" },
      el("h3", { text: "正在逛 · " + data.session.placeName }),
      el("div", { class: "fun-trip-sum", text: data.session.summary })
    ));
    else if (data.trips?.length) body.appendChild(el(
      "div",
      { class: "fun-live" },
      el("div", { class: "fun-meta", text: "最近一趟 · " + data.trips[0].day }),
      el("h3", { text: data.trips[0].placeName }),
      el("div", { class: "fun-trip-sum", text: data.trips[0].summary })
    ));
    const tabs = el("nav", { class: "fun-tabs", "aria-label": "纪念册分类" });
    for (const [id, label2] of [["all", "全部行程"], ["kept", "珍藏"], ["wishes", "心愿"]]) tabs.appendChild(el("button", {
      type: "button",
      "aria-pressed": String(bookTab === id),
      onclick: () => {
        bookTab = id;
        render(currentData);
      }
    }, label2));
    if (bookTab === "wishes") {
      body.appendChild(tabs);
      renderWishes(data);
      restoreFocus();
      return;
    }
    if (!data.total && !(data.keepsakeCount > 0)) {
      body.appendChild(tabs);
      body.appendChild(el("div", { class: "fun-empty", text: "纪念册还是空的——她收一次摊，这里就有一趟。" }));
      restoreFocus();
      return;
    }
    body.appendChild(el(
      "div",
      { class: "fun-stats" },
      stat(data.totalRecent ?? data.total, "近期行程"),
      stat(data.keepsakeCount ?? 0, "珍藏"),
      stat(data.visitedAreaCount, "处逛过"),
      stat(data.souvenirCount, "件纪念品"),
      stat(data.photoCount, "张照片")
    ));
    if (data.mostVisited?.length) body.appendChild(el(
      "details",
      { class: "fun-wish-history" },
      el("summary", { text: "常去的" }),
      el("div", { class: "fun-chips" }, data.mostVisited.slice(0, 8).map((m) => el("span", { class: "fun-chip", text: `${m.name} ×${m.times}` })))
    ));
    const activeWishes = (data.wishes ?? []).filter((w) => w.status === "active");
    if (activeWishes.length) body.appendChild(el(
      "div",
      { class: "fun-note fun-wish-summary" },
      `记着 ${activeWishes.length} 个心愿：${activeWishes.slice(0, 3).map((w) => w.placeName ?? w.placeId).join("、")}${activeWishes.length > 3 ? " 等" : ""}。什么时候出门，由她决定。`
    ));
    const layout = el("div", { class: "fun-with-rail" });
    const main = el("div", { class: "fun-book-main" });
    layout.appendChild(main);
    layout.appendChild(bookRail(activeWishes));
    body.appendChild(layout);
    main.appendChild(tabs);
    const search = el("input", { class: "fun-book-search", type: "search", placeholder: "搜地点、同行人、日期、备注或沿途回忆", value: bookKeyword, "aria-label": "搜索纪念册", "data-focus-key": "book-search" });
    const placeOptions = new Map((data.trips ?? []).map((trip) => [trip.placeId, trip.placeName]));
    const place = el(
      "select",
      { class: "fun-book-place", "aria-label": "按地点筛选行程", "data-focus-key": "book-place" },
      el("option", { value: "", text: "所有地点" }),
      [...placeOptions].map(([id, name]) => el("option", { value: id, text: name }))
    );
    place.value = bookPlace;
    const days = [...new Set((data.trips ?? []).map((trip) => trip.day || "unknown"))];
    const date2 = el(
      "select",
      { class: "fun-book-date", "aria-label": "按日期筛选行程", "data-focus-key": "book-date" },
      el("option", { value: "", text: "所有日期" }),
      days.map((day) => el("option", { value: day, text: day === "unknown" ? "日期不详" : day }))
    );
    date2.value = bookDate;
    main.appendChild(el("div", { class: "fun-album-filters" }, search, place, date2));
    const results = el("div", { class: "fun-book-results" });
    main.appendChild(results);
    const allTrips = data.trips ?? [];
    const textFor = (trip) => [
      trip.placeName,
      trip.company,
      trip.day,
      trip.note,
      trip.summary,
      ...(trip.visited ?? []).map((area) => typeof area === "string" ? area : area.area),
      ...trip.events ?? [],
      ...trip.souvenirs ?? [],
      ...trip.photos ?? [],
      ...(trip.choices ?? []).map((choice) => choice.event + " " + choice.result),
      ...(trip.timeline ?? []).map((entry) => entry.text)
    ].filter(Boolean).join(" ").toLowerCase();
    const renderResults = () => {
      results.replaceChildren();
      const keyword = bookKeyword.trim().toLowerCase();
      const trips = allTrips.filter((trip) => {
        if (bookTab === "kept" && !trip.kept) return false;
        if (bookPlace && trip.placeId !== bookPlace) return false;
        if (bookDate && (trip.day || "unknown") !== bookDate) return false;
        if (!keyword) return true;
        const route = (data.routes ?? []).find((group) => group.id === trip.routeId);
        const linked = route ? allTrips.filter((member) => (route.tripIds ?? []).includes(member.id)) : [];
        const linkedText = route ? [(route.stops ?? []).map((stop) => stop.placeName).join(" "), ...linked.map(textFor)].join(" ").toLowerCase() : "";
        return textFor(trip).includes(keyword) || linkedText.includes(keyword);
      });
      if (keyword || bookPlace || bookDate) results.appendChild(el("div", { class: "fun-note", role: "status", text: "找到 " + trips.length + " 趟行程；联程同时检索相连的地点与记录。" }));
      const appendTrip = (trip, parent) => {
        const open = expandedTrips.has(trip.id);
        const toggleKeep = async () => {
          if (pending.has(trip.id)) return;
          pending.add(trip.id);
          errors.delete(trip.id);
          renderResults();
          try {
            const result = await ctx.invoke("favorite", [{ id: trip.id, keep: !trip.kept }]);
            if (!result?.ok) throw new Error(result?.error ?? "珍藏状态保存失败");
            await load(true);
          } catch (error) {
            errors.set(trip.id, error?.message ?? String(error));
          } finally {
            pending.delete(trip.id);
            render(currentData ?? data);
          }
        };
        const card = el(
          "article",
          { class: "fun-trip fun-ticket", "data-trip-id": trip.id },
          el(
            "div",
            { class: "fun-ticket-date" },
            el("b", { text: String(Number(String(trip.day ?? "").slice(-2)) || "—") }),
            el("small", { text: (trip.day || "").slice(0, 7) || "日期不详" }),
            el("small", { text: trip.enteredHm || "时间不详" })
          ),
          el(
            "div",
            { class: "fun-ticket-main" },
            el(
              "div",
              { class: "fun-trip-head" },
              el("span", { class: "fun-trip-name", text: trip.placeName }),
              trip.auto ? el("span", { class: "fun-trip-auto", text: "自己出门" }) : null,
              el("span", { class: "fun-trip-when", text: (trip.enteredHm || "时间不详") + "–" + (trip.leftHm || "时间不详") + (trip.stayedMin ? " · " + trip.stayedMin + " 分钟" : "") })
            ),
            el("div", { class: "fun-trip-sum", text: trip.summary }),
            trip.company ? el("div", { class: "fun-trip-extras", text: `同行 · ${trip.company}` }) : null,
            trip.routeOrder ? el("div", { class: "fun-note", text: "联程 · 第 " + trip.routeOrder + " 站" }) : null,
            el(
              "div",
              { class: "fun-trip-actions" },
              el("button", { type: "button", class: "fun-detail-toggle", "data-trip-id": trip.id, "aria-expanded": String(open), onclick: () => {
                if (open) expandedTrips.delete(trip.id);
                else expandedTrips.add(trip.id);
                renderResults();
                [...results.querySelectorAll(".fun-detail-toggle")].find((button2) => button2.getAttribute("data-trip-id") === trip.id)?.focus?.();
              } }, open ? "收起详情" : "查看详情"),
              el("button", { type: "button", disabled: pending.has(trip.id) ? "disabled" : null, onclick: toggleKeep }, pending.has(trip.id) ? "保存中…" : trip.kept ? "取消珍藏" : "珍藏"),
              errors.has(trip.id) ? el("span", { class: "fun-trip-error", role: "alert", text: errors.get(trip.id) }) : null
            )
          )
        );
        if (open) card.querySelector(".fun-ticket-main").appendChild(tripDetails(trip));
        parent.appendChild(card);
      };
      const drawnRoutes = /* @__PURE__ */ new Set();
      let previousDay = null;
      for (const trip of trips) {
        const route = trip.routeId && (data.routes ?? []).find((group) => group.id === trip.routeId);
        if (route) {
          if (drawnRoutes.has(route.id)) continue;
          drawnRoutes.add(route.id);
          const group = el("section", { class: "fun-route-group", "data-route-id": route.id });
          group.appendChild(routeSummary(route, allTrips, (selected) => {
            expandedTrips.add(selected.id);
            bookKeyword = "";
            bookPlace = "";
            bookDate = "";
            bookTab = "all";
            render(currentData);
            [...body.querySelectorAll(".fun-detail-toggle")].find((button2) => button2.getAttribute("data-trip-id") === selected.id)?.focus?.();
          }));
          const members = (route.tripIds ?? []).map((id) => trips.find((member) => member.id === id)).filter(Boolean);
          for (const member of members) {
            group.appendChild(el("div", { class: "fun-date", text: member.day || "日期不详" }));
            appendTrip(member, group);
          }
          results.appendChild(group);
          previousDay = null;
        } else {
          if (trip.day !== previousDay) {
            results.appendChild(el("div", { class: "fun-date", text: trip.day || "日期不详" }));
            previousDay = trip.day;
          }
          appendTrip(trip, results);
        }
      }
      if (!trips.length) results.appendChild(el("div", { class: "fun-empty", text: bookKeyword || bookPlace || bookDate ? "没有匹配的行程，试试其他地点、日期或搜索词。" : bookTab === "kept" ? "还没有珍藏的行程。" : "还没有可回看的行程。" }));
    };
    search.addEventListener("input", () => {
      bookKeyword = search.value;
      renderResults();
    });
    place.addEventListener("change", () => {
      bookPlace = place.value;
      renderResults();
    });
    date2.addEventListener("change", () => {
      bookDate = date2.value;
      renderResults();
    });
    renderResults();
    restoreFocus();
  };
  const stat = (n, label2) => el(
    "div",
    { class: "fun-stat" },
    el("b", { text: String(n) }),
    el("span", { text: label2 })
  );
  const load = async (propagate = false) => {
    try {
      const data = await ctx.invoke("list");
      if (!data?.ok) throw new Error(data?.error ?? "返回不正常");
      status.replaceChildren();
      render(data);
    } catch (err) {
      if (propagate) throw err;
      if (!currentData) body.replaceChildren();
      status.replaceChildren(errorCard(err, load, Boolean(currentData)));
    }
  };
  void load();
  return { refresh: load };
}
function mountShelf(ctx) {
  const root = ctx.root;
  root.replaceChildren();
  const box = shell(root);
  const body = el("div");
  box.appendChild(body);
  const status = feedback(box);
  let currentData = null;
  body.appendChild(el("div", { class: "fun-loading", role: "status", text: "正在整理纪念品架…" }));
  const stat = (n, label2) => el(
    "div",
    { class: "fun-stat" },
    el("b", { text: String(n) }),
    el("span", { text: label2 })
  );
  const pct = (part) => `${part.done}/${part.total}`;
  const memoryTrip = tripLookup(ctx, "trip", "id", "回看这趟行程");
  const shelfKeepsakes = (data) => {
    if (Array.isArray(data.items) && data.items.length) return data.items;
    return (data.byPlace ?? []).flatMap((group) => (group.items ?? []).map((item) => ({ ...item, placeName: item.placeName || group.placeName })));
  };
  const keepsakeCard = (it) => el(
    "details",
    { class: "fun-keepsake" },
    el(
      "summary",
      null,
      itemIcon(it.name),
      el("strong", { text: it.name }),
      el("span", { class: "fun-keepsake-place", text: `${it.placeName || "未记地点"}${it.firstDay ? ` · ${it.firstDay}` : ""}` }),
      el("span", { class: "fun-keepsake-count", text: it.times > 1 ? `收藏 ${it.times} 次` : "收藏 1 次" })
    ),
    it.archivedCount ? el("div", { class: "fun-note", text: `${it.archivedCount} 次收藏仅保留账本，详细行程已不在近期记录中。` }) : null,
    ...(it.memories ?? []).map((m) => el(
      "div",
      { class: "fun-trip-sum" },
      el("div", { text: `${m.day || "日期不详"} · ${m.summary}` }),
      m.note ? el("div", { text: `你记的：${m.note}` }) : null,
      m.id ? memoryTrip(m.id) : null
    ))
  );
  const render = (data) => {
    currentData = data;
    body.replaceChildren(heading("带回来的小东西。", "一件纪念品，连着一处地方，也连着那一天。"));
    if (!data.total) {
      body.appendChild(el("div", { class: "fun-empty", text: "架子上还什么都没有——她买过纪念品，这里就有了。" }));
    }
    body.appendChild(el(
      "div",
      { class: "fun-stats" },
      stat(data.total, "样东西"),
      stat(data.pieces, "件"),
      stat(data.places, "处地方"),
      stat(data.completePlaces, "处逛遍")
    ));
    body.appendChild(el("div", { class: "fun-note", text: "收藏账本长期保留；详细行程可查看最近 40 趟与珍藏行程。进度按当前场所清单统计，移除或改名不删除旧回忆。" }));
    const keepsakes = shelfKeepsakes(data);
    const shelves = (data.byPlace ?? []).filter((group) => (group.items ?? []).length);
    if (keepsakes.length) {
      body.appendChild(el("div", { class: "fun-sec", text: "展示柜" }));
      body.appendChild(el("div", { class: "fun-shelf-cabinet" }, keepsakes.map(keepsakeCard)));
      if (shelves.length) body.appendChild(el(
        "div",
        { class: "fun-chips fun-shelf-places" },
        shelves.map((group) => el("span", { class: "fun-chip", text: `${group.placeName} ${group.items.length} 样` }))
      ));
    }
    const visited = (data.progress ?? []).filter((p) => p.visits > 0);
    if (visited.length) {
      body.appendChild(el(
        "div",
        { class: "fun-sec-row" },
        el("div", { class: "fun-sec", text: "快要逛遍的地方" }),
        el("span", { class: "fun-note", text: `逛过的 ${visited.length} 处 · 按当前地点内容统计` })
      ));
      body.appendChild(el("div", { class: "fun-progress-grid" }, visited.map((p) => {
        const left = p.areas.left.length;
        return el(
          "div",
          { class: "fun-trip fun-progress-card" },
          el(
            "div",
            { class: "fun-trip-head" },
            el("span", { class: "fun-trip-name", text: p.placeName }),
            el("span", { class: "fun-trip-when", text: `去过 ${p.visits} 次 · ${p.percent}%` })
          ),
          el("progress", { class: "fun-progress", max: "100", value: String(p.percent), "aria-label": `${p.placeName}探索进度 ${p.percent}%` }),
          el("div", { class: "fun-meta", text: `逛过 ${pct(p.areas)}${p.souvenirs.total ? ` · 纪念品 ${pct(p.souvenirs)}` : ""}${p.photos.total ? ` · 拍过 ${pct(p.photos)}` : ""}` }),
          p.phases?.length ? el("div", { class: "fun-note fun-visited-phases", text: `去过的时段：${p.phases.join("、")}` }) : null,
          left ? el("div", { class: "fun-trip-sum", text: `还差：${p.areas.left.slice(0, 6).join("、")}${left > 6 ? ` 等 ${left} 处` : ""}` }) : el("div", { class: "fun-trip-sum", text: "这一处已经逛遍了。" })
        );
      })));
    }
  };
  const load = async () => {
    try {
      const data = await ctx.invoke("list");
      if (!data?.ok) throw new Error(data?.error ?? "返回不正常");
      status.replaceChildren();
      render(data);
    } catch (err) {
      if (!currentData) body.replaceChildren();
      status.replaceChildren(errorCard(err, load, Boolean(currentData)));
    }
  };
  void load();
  return { refresh: load };
}
function mergedPanel(ctx, sections, initial = 0) {
  const doc = ctx.root.ownerDocument;
  const nav = doc.createElement("div");
  nav.className = "fun-panel-tabs";
  nav.setAttribute("role", "tablist");
  const panes = sections.map((section, index) => {
    const pane = doc.createElement("section");
    pane.hidden = index !== initial;
    pane.setAttribute("role", "tabpanel");
    const button2 = doc.createElement("button");
    button2.type = "button";
    button2.textContent = section.title;
    button2.setAttribute("role", "tab");
    button2.setAttribute("aria-selected", index === initial ? "true" : "false");
    button2.addEventListener("click", () => {
      sections.forEach((_, i) => {
        panes[i].hidden = i !== index;
        nav.children[i].setAttribute("aria-selected", i === index ? "true" : "false");
      });
    });
    nav.appendChild(button2);
    ctx.root.appendChild(pane);
    const childCtx = { ...ctx, root: pane, invoke: (method, args = []) => ctx.invoke(method, [...args, { __panelSource: section.source }]) };
    section.mount(childCtx);
    return pane;
  });
  ctx.root.prepend(nav);
}
function mountOuting(ctx) {
  mergedPanel(ctx, [
    { title: "此刻去逛", source: "places", mount: mountPlaces2 },
    { title: "地点册", source: "locations", mount: mountPlaces }
  ]);
}
function mountJournal(ctx) {
  mergedPanel(ctx, [
    { title: "行程手账", source: "book", mount: mountBook },
    { title: "珍藏柜", source: "shelf", mount: mountShelf }
  ]);
}
function mountStoryJournal(ctx) {
  const doc = ctx.root.ownerDocument;
  const main = doc.createElement("section");
  const more = doc.createElement("details");
  more.className = "fun-more-stories";
  const summary = doc.createElement("summary");
  summary.textContent = "更多故事";
  const authors = doc.createElement("div");
  more.append(summary, authors);
  ctx.root.replaceChildren(main, more);
  mountFishStory({ ...ctx, root: main });
  mountStories({ ...ctx, root: authors });
}
var testMounts = { home: mountHome, places: mountPlaces2, locations: mountPlaces, story: mountFishStory, stories: mountStories, book: mountBook, shelf: mountShelf };
var webui_default = {
  panels: {
    home: { mount: mountHome },
    outing: { mount: mountOuting },
    story: { mount: mountStoryJournal },
    journal: { mount: mountJournal }
  }
};
export {
  webui_default as default,
  testMounts
};
