# 从0开始的肥鱼大冒险 0.7.6（共同决定修复 + 收口，待发布）交接文档

更新日期：2026-11-23 晚（Asia/Shanghai）。本文是当前接手的入口；**本轮的详细接手（0.7.5 故事工坊 + 0.7.4 地点册、装机步骤、坑）见 [`HANDOFF-2026-11-23-0.7.5-接手.md`](HANDOFF-2026-11-23-0.7.5-接手.md)**；地点册版式重做的过程记录见 [`HANDOFF-2026-11-23-地点册版式-交接.md`](HANDOFF-2026-11-23-地点册版式-交接.md)。

> **发布状态（2026-11-23 21:0x，0.7.6 重打包，取代下面 20:3x 那条）**：0.7.6 = 共同决定异票修复 + 收口（`src/joint.js` 单一派生、`docs/JOINT-DECISION-SPEC.md`、矩阵测试），并含**行为变更：空票面两席都能先投**。代码已本地提交（`881100e`），已重新打包；**未 push、未发 npm**（npm 上 latest 仍是 0.7.5，`publish-check --online` 确认 0.7.6 未被占用）。
> - 产物：`story-world\artifacts\release-0.7.6\`。`cortico-world-fun-0.7.6.tgz` **1,721,527 B** / SHA-256 `73E533C6FABB4E9D09D373AED9C04D46897F694D8BBDF177B409FAC37D779BDB`；安装形态目录 `cortico-world-fun-0.7.6\`（含 `install.ps1` / `安装.cmd` / `安装说明.md`；说明已改成「发到 npm 后…」并补上空票面先投）；`dist/webui.js` **451,318 B** / SHA-256 `CD4D5B70AFE15BAF89FFDFA23D84A59A580C7A8F0CB354FED0AF5C7C4E7BA2AE`（仓库与包内一致）。旧产物（1,716,751 B，20:27）在 `_prev-20261123-2055\`。
> - 打包核验：`node tools/verify-published.mjs --file …tgz` 通过（59 条目、安装形态真加载并跑通、7 个面板 mount 齐全）；`node tools/publish-check.mjs --online` **26 项通过 / 0 失败 / 1 条已知警告**（没截 screenshots，详情页只有图标与文字）。
> - 规则（收窄版，2026-11-23 拍板）：空票面两席都能先投；只剩一席没投时只有那一席能投；两票不同时两席都能改自己那一票；同票才前进。状态与迁移表见 `docs/JOINT-DECISION-SPEC.md`。
> - 测试：全量 `npm test` 37 个套件 **554 条 0 失败**（完整权限下含 DPAPI 10/10）、`npm run verify` 全绿；`test/story-text.test.mjs` **41/41**（3 种 resolution × 主人/鱼先投 × 第二票的矩阵 + 三条一致性）；`test/story-stages.test.mjs` **11/11**。
> - 既存 flake 已修：`8248fb0` 让用例结束前先 `world.stop()` 再删临时目录（并加重试），全量串跑不再随机挂 story-stages。
> - 测试基础设施（紧接着的一轮）：新增 `test/tmp.mjs`（`tempDir` / `trackWorld` / `cleanup(t, dir, world)` / `cleanupAll`），13 个测试文件与 `test/harness.mjs` 统一走它（先 stop World 再删目录，ENOTEMPTY 重试 20 次）；`tools/clean-tmp.mjs` 清掉系统临时目录里 9,441 个历史 `fun-*` 残留（剩 1,172 个是近一小时的，会自然过期）。清理后全量重跑：37 套件 554 条 **0 失败**，临时目录**零新增**。
> - 本机 Coo 的 vendor 仍是 0.7.5（20:31 手工同步过旧的 `src/world.js` + `dist/webui.js`），**版本号没改**；要显示 0.7.6 需在 Coo 完全退出后跑 `install.ps1 -CooRoot E:\Coopanion`。
> - **main 上还有未发版的改动**（2026-11-23 21:3x）：`6bfbddc` 从回忆「从最近可继续检查点开分支」建好后**直接跳到「出游」**（`controller.fork` 返回是否真的建出新行程，面板据此 `navigate('play')`；没建出来就留在原地看错误）。另修对话式出游的布局：**4 个选项不再被裁成 3 个**——`.sw-play-action` 可收缩且内部滚动、`.sw-reading` 改 `flex:1 1 0`、卡片固定 `74vh`，矮屏（≤860px 高）收起装饰性场景条与元信息行。0.7.6 已经发到 npm，这些改动进不了它，**下次发版一起带**；当前未升版本、未重新打包。
> - 代码已 push 到 `origin/main`；**0.7.6 已发 npm**（latest = 0.7.6；`dist.shasum` `feedf3d3d097c4b5da7a363df2cd97dd7b36186c`、`unpackedSize` 2,663,552，与本地 `release-0.7.6\cortico-world-fun-0.7.6.tgz` 同一份字节；`node tools/verify-published.mjs 0.7.6` 对线上包已通过）。真机点选验收（面板、412 窄屏、暗色）没做。
> - **待人工**：装进本机 Coo（当前 vendor 仍是 0.7.5）——退出 Coo 后跑 `install.ps1 -CooRoot E:\Coopanion`，再核对 `/api/extensions`、asset 哈希与 fun 数据快照。

> **发布状态（2026-11-23 15:5x，已装机，取代下面 14:5x 那条）**：0.7.5 **已装进本机 Coo**。装机时间 15:50:13，`npm run verify` 与全量 `npm test` 此前已全绿；源码已本地提交（`44993cd`）。
> - 装机核验：vendor `package.json` = 0.7.5；`/api/extensions` 里 `cortico-world-fun` **0.7.5 / `state=loaded` / `enabled=true` / `webUi=served`**；`/assets/extensions/cortico-world-fun/0.7.5/webui.js` 200、**452,497 B**、SHA-256 `0C879FC80BDFD9B6772C327F2421A3505EFD3BA7604DD436F67547774DE551D3` 与 `dist/webui.js` 一致；日志 `[15:51:24] worlds.fun: 从0开始的肥鱼大冒险已启动`；`node_modules\cortico-world-fun` junction 与 `data\extensions\package.json` 的 `file:` 依赖均指向 vendor。
> - fun 数据：装前 / 装后 / Coo 重启后**三次** 11 个文件 SHA-256 全一致。装前快照留在 `.tmp\fun-preinstall-0.7.5.txt`（`state.json` 779,358 B，比 0.7.4 记录时的 776,553 B 大，是 Coo 那半天自己写的，不是装机造成的）。
> - 备份：`vendor\cortico-world-fun.bak-20261123-155013`、`data\extensions\package.json.bak-20261123-155013`、`data\home\companion\config.json.bak-20261123-155013`。
> - 顺带清理：删掉 0.7.4 起已废弃的 `worlds.fun.funHomeAutoSlots`（`config.json` 17,661 B → 17,614 B，只少这一行；删前备份 `config.json.bak-20261123-155240`）。注意 `config.json` 由 Coo 自己序列化，若它退出时按内存重写，这个键可能被写回——无害，0.7.5 不读它。
> - **已发 npm**（2026-11-23 16:10:51 +08:00 / registry `2026-11-23T08:10:51.045Z`）：`cortico-world-fun@0.7.5`，`dist-tags.latest = 0.7.5`；`dist.shasum` `d0c823665f18ab84226a442734600341350669aa`、`dist.integrity` `sha512-wQWM+TnkTJEeAX0frB2CYl72rRDEmc4M9BLNO9m6ODGPsrdXZtzTsJca1/WavcA0YHWfo25S/t9+xE9/D+CA7A==`、`unpackedSize` 2,654,811。
> - 线上包已下载复核（`npm pack cortico-world-fun@0.7.5`，58 文件）：`assets/icon.png` `DB2E3FC8…C76442`、`dist/webui.js` `0C879FC8…51D3`、`describe.json`、`package.json`、`README.md`、`PUBLISHING.md` 与本地逐字节一致；中英简介都带「鱼的小世界已并入」；`tools/verify-published.mjs` 对线上 tgz 通过。**唯一差异是 `CHANGELOG.md`**：线上那份含 16:02 更新后的产物哈希行，本地 release 目录里的 tgz/群友包是 16:01 打的、那一行还是旧的（1,669,920 B / `BCD13EC6…`），属文案差一行。
> - **仍未 push**（领先 `origin` 10 个提交）；真机点选验收（地点册封面/编辑/插画/412 滚动、故事工坊三个起点/选文件/折叠）仍未做。
> - **产物已在 16:0x 重打**（换新图标 + 补「鱼的小世界已并入」简介之后）：`release-0.7.5\cortico-world-fun-0.7.5.tgz` **1,718,106 B** / SHA-256 `71470950BD6D4D5BAE8AABB082E023FEEFFCAD0FBAA1A87EF11AAF084FEC95A9`；群友包 `…-群友测试包.zip` **1,744,851 B** / `3CBB04A6EF02BAB5CC92DD51ED62A1CA76C9C03BF944D3C034196263C16C14DA`；`dist/webui.js` 仍是 `0C879FC8…51D3`；`assets/icon.png` `DB2E3FC8…C76442`（113,960 B）。`node tools/verify-published.mjs --file …tgz` 通过。**旧产物（1,669,920 B / `BCD13EC6…`）已移到 `release-0.7.5\_prev-20261123-1600\`，下面 14:5x 那条记的哈希作废。**

> **发布状态（2026-11-23 14:5x）**：0.7.5 故事工坊版式收口完成、已本地提交（`44993cd`）、已打包，`npm run verify` 与全量 `npm test` 全绿；**未 push、未发 npm、按用户要求未装 Coo**（本机 Coo 仍是 0.7.4）。
> - 产物：`story-world\artifacts\release-0.7.5\`。`cortico-world-fun-0.7.5.tgz` SHA-256 `BCD13EC6DD7429C6BC260368FE5F13D48A551806D5FA0E17A4358E6BA75441FB`（1,669,920 B）；群友包 `…-群友测试包.zip` SHA-256 `BAC706B576B035C42BAA1F70FE6BBA3C636B5DD4887CAD77BB2B34BC3CC6CB31`（1,696,527 B）；`dist/webui.js` SHA-256 `0C879FC80BDFD9B6772C327F2421A3505EFD3BA7604DD436F67547774DE551D3`（包内与仓库一致）。
> - 内容：故事工坊只留「＋ 编写故事」一个入口，展开后三个起点（选项式 / 自由场景包 / 从文件导入）；右侧「从一个小片段开始」删除；折叠改成小箭头；导入可选 `.json`（≤ 32 KB，粘贴保留）。
> - 验收截图：`reports/fun-stories-redesign-20261123/`（示例 S1–S6 + 真实面板 R1–R5，1440 明/暗、412 窄屏、收起、从文件导入；全部无横向溢出）。装机前先问「Coo 退干净了吗」，再按 `install.ps1 -CooRoot E:\Coopanion` 执行并核对 `/api/extensions`、asset 哈希与 fun 数据快照。

> **发布状态（2026-11-23 14:2x）**：0.7.4 源码完成、已本地提交（`69a49db`）、已打包并装进本机 Coo，`npm run verify` 与全量 `npm test` 全绿；**未 push、未发 npm**。
> - 产物：`story-world\artifacts\release-0.7.4\`。`cortico-world-fun-0.7.4.tgz` SHA-256 `B3BAD6D043078BCA00C9F82FFC2E26655338CCE6F8C653AD5F3C43E98F0B6B98`（1,667,737 B）；群友包 `…-群友测试包.zip` SHA-256 `CCF1F6EF099DDD222FF71D724D0A448519118D8EDC0457E82931D85B055846E7`（1,694,769 B）；`dist/webui.js` SHA-256 `C1CF4FCB0F5E4E81C364AA0A87AFF4AF64BD81488551DC9BEADB2DCB8ADCE0B8`（450,451 B）。
> - 装机核验：vendor `package.json` = 0.7.4；`/api/extensions` 里 `cortico-world-fun` 0.7.4 / `loaded`；`/assets/extensions/cortico-world-fun/0.7.4/webui.js` 200、450,451 B、SHA-256 与 `dist/webui.js` 一致；日志 `worlds.fun: 从0开始的肥鱼大冒险已启动`。装前备份 `vendor\cortico-world-fun.bak-20261123-142537`、`package.json.bak-20261123-142537`、`config.json.bak-20261123-142537`。
> - fun 数据：装机前后 11 个文件 SHA-256 全一致（`state.json` 776,553 B、`venues.json` 1,482 B、`stories.json` 5,667 B、`home/room.json` 384 B 等）。
> - 0.7.3 修复包仍在 `release-0.7.3\`（`A5913F68…A45BDE`），本机现在装的是 0.7.4，不再需要单独装 0.7.3。
> - 0.7.3 状态块（settings 重组、37 脚本 / 520 例）仍在下文保留。

> **发布状态（2026-11-23 14:00）**：0.7.3 设置重组完成、测试全绿（37 脚本 / 520 例）、`npm run verify` 全绿，源码已本地提交，**未 push、未发 npm**。
> - 第一版 0.7.3 曾装进本机 Coo；随后发现并修复了「宿主合并默认值导致旧设置迁移不生效」的问题，**修复后的包已重新打包，但还没重装**（用户说先等等）。重装步骤与校验见上面那份版式交接的 §7。
> - 产物：`story-world\artifacts\release-0.7.3\cortico-world-fun-0.7.3.tgz` SHA-256 `A5913F680A43E6CBE0FBEAF1FE9F079268EB0207600D12896F50AEA3FFA45BDE`；群友包 `…-群友测试包.zip` SHA-256 `FE1780C425A96130FEDB56C1492C329CFCE979070B979BFAF3478116F8260728`。
> - 本机 fun 数据：装机前后 11 个文件的 SHA-256 全一致；`config.json` 的 `worlds.fun` 已通过配置 API 写入 4 个新键（值为默认 `16 / '' / '' / ''`，无 `apiKey`）。
>
> **2026-11-23 中午更新（0.7.2，已 push）**：代码体检整改。六个 `fun_story_*` 只读查询加 10 分钟记忆化（写操作立即失效、`full:true` 重取）；`tools()` 按开关收窄，文字通道默认开（默认 23 件工具），作者工具挂在新开关 `funStoryAuthorInChat`（默认关）；`hmToMin` / `el()` / `feedback` 抽共享模块，六个只读查询拆到 `src/story-read.js`；用户手册/README/CHANGELOG 升到 0.7.2。测试 38 个脚本除 DPAPI 环境用例外全绿，`npm run verify` 全绿。
>

> **2026-11-22 深夜更新（0.7.1，已装机）**：修了画架选图必报「kind 必须是 file 或 directory」（`ctx.pickPath` 没带 `kind`）；「自己出门」回到**方案 B**——`funHomeAutoGo` 是许可、新增 `funHomeAutoSlots`（默认 10:30/15:30/19:30），World 到点推 `fun.home.free` 叫她先看日程再决定，不读 feast 的日程、不挑地方、不替她出门，`undoAutoGo` 与面板撤销按钮已移除；家里没上传角色图时改用随包内置的 **Q 版立绘**（`assets/home/chibi-*.webp`，已裁透明边，默认站位整体调小）。已打包到 `story-world\artifacts\release-0.7.1`（tgz + 群友测试包 zip），并装进本机 Coo（vendor 0.7.1，备份 `cortico-world-fun.bak-20261123-0010`）。
>
> **2026-11-22 夜间更新**：0.7.0 已与当天的「两席同票 / 委派配图 / 设置分区」修复合并（HEAD `879a267`），并已装进本机 Coo（vendor 0.7.0，备份 `cortico-world-fun.bak-20261122-2325`）。
> 这一轮的现状、待办与坑见 **`HANDOFF-2026-11-22-夜间-0.7.0-接手.md`**，本文 M1–M5 的描述仍然有效。

## 这一版（0.7.1）：家面板 P1–P5

- **M1 素材与活气**：十个站位带 `scale`，按素材实测表落地板；脚下接触阴影；`room.source` = `default`（按时段变）/ `panel`（点一下固定）；180ms 转场与减少动画分支；布置页可批量导入并按 `bg-* / ch-idle* / act-*` 分拣，认不出的进「未使用」。0.7.1 起没传角色图时用随包的 Q 版立绘（`assets/home/chibi-*.webp`），默认 `scale` 整体调小。
- **M2 家作为入口**：最新 3–5 件纪念品按类别摆位、只读气泡；未逛完行程票笺 +「继续」（同一趟 id）；第一个未完成心愿只读；手写「今天想做什么」≤60 字，空则文件里没有这个键。
- **M3 工具与待记**：新增只读 `fun_home_state` 与写 `fun_home_activity`（十个固定 id；`expectedRevision` 冲突不自动重试）；服务端拼「待记一条」，面板可复制，拿不到剪贴板退回只读文本；`ENV_PROMPT` 补三句边界。**注意：`fun_home` 仍是「回家」，没有改成只读工具**（重名会破坏既有契约）。
- **M4 时段与位置**：`phase` 色罩；热点渲染/增删改名/拖动/上限 12/键盘可达；`room.placements` 只存改过的；可选前景层；`room.json` v2（v1 懒迁移，第一次写才落 v2）。回滚：删/改名 `room.json` 即回空房间。
- **M5 快照、画架、备份、自己出门**：快照只存 digest、可看可删；`ctx.pickPath` 本地图复制进 `art/` 挂画架；导出/导入（只空房间、逐张校验、失败回滚）。0.7.1 起「自己出门」是方案 B：`worlds.fun.funHomeAutoGo` 允许、`worlds.fun.funHomeAutoSlots` 定叫醒时段（默认 10:30/15:30/19:30），到点推 `fun.home.free` 叫她看日程再决定；不读 feast 的日程、不挑地方、不替她出门，旧的「10:00–20:00 一天一次 / 撤销」已移除。
- **数据边界**：所有房间写入都在 `fun/home/`；普通看房间/切姿势/写计划不碰 `state.json`。例外只有用户点「继续」（复用既有行程工具）。
- **验证**：合并后 36 个测试文件全过（`story-config` 的 DPAPI 用例在受限沙箱里起不了 `powershell.exe`，属环境限制）；`npm run verify` 全绿；`npm pack` 46 文件，SHA-256 `2DE887677CC574595FE435224DE23CC323A4CBE44093C6414B98A00D22C36D92`。
- **没做**：发布 npm、push、群友包；聊天框、跨 World 读取、面板直写生活记录。**已装本机 Coo**（2026-11-22 23:10）。

---

## 0.4.4 基线（原交接正文）

源码已改完、测试已跑过，**未打包、未发布、未重装 Coo**；下面第 1 节起仍是 0.4.3 的基线记录。

- **面板**：`home`，页签名「家」，排在面板数组第 0 位（宿主默认选第一个，所以它成了默认落地页；老用户仍停在上次停留的页签）。抬头是「从0开始的肥鱼大冒险 · 回家看看」+「鱼的家」。
- **能做**：十个活动（发呆 / 读书 / 刷视频 / 打牌 / 打游戏 / 画画 / 做饭 / 看窗外 / 睡觉 / 聊天）点一下换姿势；一句房间备注；`布置房间` 里换背景和每个姿势的图；`恢复默认`（活动回发呆、清备注与热点，**图片保留**）。
- **数据**：全部在 `<dataDir>/fun/home/`——`room.json`（版本 1、递增 revision、字段白名单校验）+ `art/<sha256>.<ext>`（复用地点封面的图片校验，单张 ≤ 8 MiB、≤ 64 个文件、总量 ≤ 128 MiB）。**不写 `state.json` / `venues.json` / `stories.json`**，不新增工具，`describe.json` 与提示词不变。
- **边界**：出门时只读显示「出门中 · 某地（逛了 x/y）」；切姿势不推进、不结束行程；不读「鱼的每一天」、不写生活记录、不自动出发；坏 `room.json` 保留原文件并转只读。
- **降级**：背景 素材 → 住所封面 → 纯 CSS 纸色房间；角色 当前活动 → `idle` → 无（只留活动文字）；缺图不白屏、不出破图标。
- **站位**：十个活动各有一个默认坐标，写在 `webui/home/layout.js`，和 `素材单-鱼的家2D房间/` 里的对齐参考图一一对应。
- **代码**：新增 `src/home-room.js`、`webui/home/{webui.js,styles.js,layout.js}`、`test/home-room.test.mjs`、`webui/home/webui.test.mjs`；改 `src/world.js`（面板声明 + `#invoke` 分支 + `#invokeHome`）、`webui/webui.js`（导出注册）、`test/panels.test.mjs`（面板顺序与标题）、`tools/verify-published.mjs`（`home` 的读方法映射到 `state`）、`package.json`（版本 0.4.4、测试链、市场简介）。
- **验证**：`node test/home-room.test.mjs` 14/14；`node webui/home/webui.test.mjs` 6/6；`node test/panels.test.mjs` 69/69；其余测试文件逐个跑过（`story-config` 的 DPAPI 用例在受限沙箱下仍假失败，已知问题）；`npm run verify` 全绿（单入口、提示词、隔离审计、冒烟、describe 一致）。
- **预览**：`reports/fun-home-preview-20261122/`——`panel-home.html`（真实面板 + 真实形状回执，可切明暗）与 `H1`–`H4` 截图（桌面 / 暗色 / 412 窄屏 / 布置房间）。1439 与 412 下均无横向溢出（`scrollWidth ≤ innerWidth`）。
- **没做**：聊天输入框、模型工具 `fun_home_activity`、热点编辑、位置微调、打包发布装机。

---

## 0.4.3 基线（原交接正文）

上一版入口是 [0.4.1 交接](HANDOFF-0.4.1.md)；0.4.2 的「地点就是场所」重构见 [地点册 C 交接](HANDOFF-2026-11-22-地点册C.md)；上一轮 UI 细节见 [旅行手账 UI 交接](HANDOFF-2026-11-22-旅行手账UI.md)。

## 一句话

「旅行手账」UI 改造**已做完并跑通全部测试**：统一主题层、地点册四组编辑器、去哪儿推荐主卡、纪念册票笺 + 心愿侧栏、纪念品架展示柜、故事工坊作品库版式；页签按方案图排成 **去哪儿 / 地点册 / 出游 / 纪念册 / 纪念品架 / 故事工坊**，每个面板换成「从0开始的肥鱼大冒险 · …」+ 一句抬头 + 一行说明。版本 **0.4.3**，本地包（tgz + 群友测试包 zip）已生成并核验，**本机 Coo 已装 0.4.3 并重启**（宿主已提供新 bundle，`从0开始的肥鱼大冒险已启动`）。**没做**：发布 npm、卸载 / 市场重装——这两件都需要你明确同意。

## 现在的四份东西

| 位置 | 状态 |
|---|---|
| 源码 `E:\deep seek\fun-world` | **0.4.3**，已本地提交（未推送，见 `git log`） |
| 本地包 `story-world\artifacts\release-0.4.3\` | **0.4.3**，tgz + 群友包，已核验 |
| 本机 Coo `E:\Coopanion` | **0.4.3**（2026-11-22 18:52 重装并重启，vendor + junction） |
| 旧的群友包 `release-0.4.2\` | 0.4.2（改造前），保持原样未动 |

## 验证现状

- `npm test` 全绿：面板 `panels` 68/68、故事面板 `story/webui` 41/41、`place-library` 10/10、`user-venues` 20/20、`world` 82/82，其余照旧。受限沙箱下 `story-config` 的 DPAPI 用例会假失败；完整权限下 7/7（已知问题，见旧交接 §6）。
- `npm run verify` 全绿：单入口打包、提示词、隔离审计、冒烟、`describe.json` 一致性（当时是 22 工具 / 0 事件；0.7.1 起 24 工具 / 1 事件，默认只暴露 17 个）。
- `npm pack` → `node tools/verify-published.mjs --file .tmp/release-0.4.3/cortico-world-fun-0.4.3.tgz` 通过：45 个文件、22 处预设场所、六个面板真在包里、单文件入口能加载。
- 真实面板渲染（Edge 无头，真实 `FunWorld` 夹具）：`R1`–`R14`，含纪念册 / 纪念品架 / 故事工坊的**暗色**与 **412px 窄屏**；14 张都核对过 `document.documentElement.scrollWidth ≤ innerWidth`，无横向溢出。
- **本机 Coo 装机核验**：`data\extensions\vendor\cortico-world-fun\package.json` = 0.4.3；`dist\webui.js` 与源码构建产物 SHA-256 一致（`F7C9AA40…A2444`）；宿主 `http://127.0.0.1:17788/assets/extensions/cortico-world-fun/0.4.3/webui.js` 返回同一份字节；日志 `worlds.fun: 从0开始的肥鱼大冒险已启动` / `World 已启动: fun`。
- **数据未动**：安装前后 `fun\state.json` 逐字节相同（`776,553` B），没有新增或改写文件；安装前备份在 `story-world\artifacts\coo-backup-fun-0.4.3-20261122-183219\`。
- **未做**：真实 Coo 里逐个面板的点击验收（字体、滚动、真实长数据观感）。静态渲染和 HTTP 字节比对不能替代这一项。

## 产物与摘要

`E:\deep seek\story-world\artifacts\release-0.4.3\`：

| 文件 | 大小 | 用途 |
|---|---|---|
| `cortico-world-fun-0.4.3.tgz` | 426,662 B | npm 发布 / 本地核验 |
| `cortico-world-fun-0.4.3-群友测试包.zip` | 451,816 B | 发群友（解压 → `安装.cmd`） |
| `cortico-world-fun-0.4.3/` | — | 解包后的安装形态（zip 的内容，含 `install.ps1` / `安装.cmd` / `安装说明.md`） |
| `发送文案.md` / `安装说明.md` / `安装.cmd` | — | 群友包配套文案 |

- tgz SHA-256：`2D4C1BF61A7FFAC321A5E55045363628AE8E7B89B4A49C822C4884A6DC8D2A04`
- zip SHA-256：`B13FFB1429C3536E415C1F0854008C2F9F034EDEF0B50A260983A272BE787699`

发布流程与禁止项见 [PUBLISHING.md](PUBLISHING.md)。

## 这一版改了什么（摘要）

- **统一主题层**（`webui/webui.js` 末尾）：`.fun` / `.fpl` / `.sw` 上一层「旅行手账」token——圆角 14px、Georgia 数字、纸色渐变、统一 focus ring，颜色仍走宿主变量；减少动画 / 高对比偏好各有分支。**没有改类名**。
- **地点册**：编辑器四组（基础资料 / 游玩内容 / 画风与封面 / 地点关联）+ 宽屏侧栏导航 + 底部固定保存栏（未保存 / 保存中 / 已保存）+ 切组保留草稿；浏览页宽屏摘要列表、窄屏卡片。标题改「地点册」。
- **去哪儿**：第一处推荐改成主卡 `.fun-hero`，沿用 `fun-recommend-card` / `fun-recommend-name` 类名。
- **纪念册**：票笺日期列（窄屏横排）；宽屏主列 + 右侧 276px 只读心愿栏（窄屏收掉、摘要回主列）；统计挪到页签上方。
- **纪念品架**：跨地点展示柜网格（线稿 + 名称 + 来自哪里和哪天 + 收藏次数，点开仍是真实关联行程），下方「快要逛遍的地方」进度卡片网格；「按地方」改成一行计数 chip。
- **故事工坊**：标题条 +「＋ 编写故事」主按钮；作品卡左图右文；页签「全部作品 / 内置故事 / 我的作品」只筛列表；宽屏右栏三个创作入口；窄屏收掉右栏。
- **页签与抬头**：面板按方案图排序——去哪儿 / 地点册 / 出游 / 纪念册 / 纪念品架 / 故事工坊；两个故事面板不再同名（游玩的是「出游」，写作的是「故事工坊」）。五个面板的抬头改成「从0开始的肥鱼大冒险 · …」小标题 + 一句大标题 + 一行说明。
- **改名收尾**：`地点剧情包` / `鱼的故事世界` → 故事工坊；`地点与故事` → `作品库`；`回忆` → `行程回忆`。

## 数据与已确定约束

- **本版没有数据迁移**：`state.json` / `venues.json` / `stories.json` / `config.json` 字段与语义未变，不写新文件、不改写旧文件。升级直接读旧数据。
- 面板 `list` 仍然只读，不写盘（有测试守着）。
- `dist/webui.js` 必须由 `npm run build:webui` 生成；`pretest` / `prepack` 自动构建，不手改。
- 不读别的 World 状态，不以其他 World 为内部依赖；不新增自动出发、自动选择或后台模型调用。

## 后续操作（都需另行同意）

1. **发布 npm**：先查 registry 确认 0.4.3 未占用，再发布已核验 SHA-256 的 tgz；`prepublishOnly` 会再跑一遍 `npm test` + `npm run verify` + 在线检查。
2. **市场重装 / 卸载**：需要你同意，且属于独立动作；现在本地装的是 vendor + junction，市场版会覆盖同一条依赖。
3. 实机验收通过后，如需补真实市场截图，改包内内容后必须重新打包并重新核验摘要。
4. 源码已本地提交（含 0.4.0–0.4.3，未推送）。推送远端是独立决定。
5. 安装前的 Coo 数据备份：`story-world\artifacts\coo-backup-fun-0.4.3-20261122-183219\`；`package.json.bak-20261122-183237` / `config.json.bak-20261122-183237` / `vendor\cortico-world-fun.bak-20261122-183237` 是这次装机的回退点，别删。

## 环境说明

Hindsight 记忆服务在本机仍不可用（页面列表为空），本次结论全部依据实际源码、真实渲染、测试与打包核验，没有声称记忆服务可用。
