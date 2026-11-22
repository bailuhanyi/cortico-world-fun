# 娱乐时间 0.3.3 · 交接（2026-11-21 深夜）

给下一个对话的起点。本文件只记**当前真实状态**；历史过程见文末链接。

## 1. 现在是什么状态

| 项 | 值 |
|---|---|
| 源码 | `E:\deep seek\fun-world`，版本 **0.3.3**，`main` @ `277adac`（未提交，约 50 个改动） |
| 已装进 Coo | 已安装本轮构建：44 个文件，含四篇内置故事、故事节点上限与地点图鉴分类/筛选；Coo 已重启并确认 `/assets/extensions/cortico-world-fun/0.3.3/webui.js` 为 305188 字节的新 bundle |
| 安装方式 | `link:E:/deep seek/story-world/artifacts/local-install-story.2/package` |
| 已安装 bundle | `87AF5A620C3A09C8F88E59AE6D5484A83CAA9C4A726A7924800A6D30D77888BB`（`dist/webui.js` SHA-256） |
| 安装前备份 | `story-world/artifacts/coo-backup-fun-20261122-1015`（旧 41 文件包，旧 bundle `CFE499…284C`） |
| 源码 bundle | `dist/webui.js` 由当前源码构建；源码与安装包一致 |
| npm 上最新 | `0.3.1`（0.3.2 / 0.3.3 **都没发**） |
| 本地待发包 | 旧包 `fun-world/.tmp/release-builtin-final/cortico-world-fun-0.3.3.tgz`，SHA-256 `87F32352857037DF759461670B1363DA56F0501C7400E4C33A6100FC6C47778D`（**不含节点上限与新两篇故事**） |
| 本轮验证包 | `fun-world/.tmp/release-new-stories/cortico-world-fun-0.3.3.tgz`，44 个文件，SHA-256 `FA8E8EC7936DCBCC4C24AD3D1FC7FA70BF91CD1C3FA3BFA61754AD49370AD991`（含节点上限、四篇内置故事与地点图鉴筛选，已安装到 Coo，未发布） |

**一句话**：当前源码已完整（F1–F5 + UI 美化 + 四篇内置故事 + 节点上限 + 地点图鉴筛选），并已装进本机 Coo 供体验。下一步按用户计划：体验 → 发布 0.3.3 → 卸载本地链接安装 → 从市场重装新版本。发布、卸载、市场重装仍须用户明确同意后执行。

## 2. 这一版都做了什么

### F1 · 故事可靠性（0.3.2 起）
手动与鱼自主共用同一趟行程；同一步同动作返回原回执不重复推进；预算先落盘再请求模型；关窗/重启/接管不恢复旧授权；损坏存档只读不覆盖；单趟 20 步自主、6 次模型请求。

### F2 · 地点册并入同一 World
住所、画风、封面、地点关系独立存在 `fun/place-library/`；可玩场所名称与玩法仍以「去哪儿」为权威；迁入只接受用户显式提供的导出，逐项确认、留恢复点。

### F3–F5 · 作者与双人（0.3.2 起的本地开发版）
- v2 作品元数据、作者表单、隔离试玩
- 六个只读查询：`fun_story_places` / `candidates` / `detail` / `current` / `recap` / `schedule`
- `references` 按区域+实际节点+选项分 player/fish/dm 投影
- 双人示例与 owner/fish/joint 回合；可选文本主持（默认关）
- 检查点与隔离分支（新 runId，不动源回忆）
- 剧情图片默认关，无正式通道时明说不可用

### 0.3.3 · 设置与作者体验
- **文本主持可填 API**：地址 + API Key（密码框、失焦掩码、DPAPI CurrentUser 加密存 `fun/story-secrets.json`）+ **模型名（可留空）**。留空不发送 `model` 字段，由接口用自己的默认模型——**不再硬编码任何厂商模型**。
- **剧情图片一个来源框**：留空=委派主对话调 `imggen_draw`；填 loopback URL=本插件直连 ComfyUI；填其他文字=委派给指定插件。
- **编写故事可折叠**：默认收起（`fun:story-editor:v2:` 键），从列表点编辑自动展开。
- **清空旧五篇**：旧预设与样章入口/场所移除，仅按固定 ID 一次性备份迁移。
- **UI 美化（完整方案已实现）**：设置页拆两张卡（主持 / 图片）+ 状态徽章 + 可展开长说明 + 粘性操作条；作者表单分四组（作品信息 / 故事起点 / 分支选项 / 触发时段）+ 填写进度 + 缺项红点 + 粘性保存条；窄屏单列。

### 最后一轮 · 两篇故事转内置
- `折潮港的第七封回信·简编版`（`foldtide-reply-lite`，16 节点）+ 地点 `折潮港 user-ezfvd`
- `雨停前的小小清单`（`drizzled-list`，10 节点）+ 地点 `折角巷 user-f3u9p`
- 正文从用户存档逐字复制；两个地点补了纪念品/拍照点/随机事件/完整描写/插画
- 内置作品**可停用、不可删除、不可同 ID 覆盖导入**
- 老存档迁移：先备份，只移除与内置定义**逐字段一致**的副本；改写过的同名作品保留

### 交接后补充 · 用户自定故事节点数（本地未发布改动）
- 「鱼的故事世界 → 设置」页最上方新增简易「故事节点上限」卡片：默认 `16`，用户可输入任意非负整数；填 `0` 表示不限制节点数。
- 此上限用于新故事的校验、预览、试玩和导入；修改设置不会删除或阻断已有故事。设置保存在 `fun/story-node-limit.json`，重启后保留。
- `0` 仅取消节点数限制；每篇 JSON 仍受 32 KB 限制，其他字段、图结构、选择项和自定义故事数量约束不变。
- 当前改动尚未发布，也没有改变版本号或既有内置故事正文。

### 交接后补充 · 两篇新内置故事（本地未发布改动）
- `桥底下的回声`（`bridge-echo-solo`，9 节点）绑定既有地点「江边」；`被换掉的说明牌`（`swapped-plaque-riddle`，13 节点）绑定既有地点「博物馆」。两篇均为用户提供的 v1 JSON，正文保持原样。
- 原始 JSON 随源码保存为 `src/bridge-echo-solo.json` 与 `src/swapped-plaque-riddle.json`，并在统一校验后进入 `BUILTIN_STORY_PACKS`。
- 新增独立升级标记：先逐字段比较、只移除与两篇新内置定义完全一致的用户副本，并写原文备份；改写副本和停用选择保留。旧两篇的 0.3.3 迁移标记继续有效。
- 当前 `release-builtin-final` 旧 tgz 不包含上一轮节点上限改动或本轮两篇新故事；要验装必须从当前源码重建。

### 交接后补充 · 地点图鉴分类与筛选（本地未发布改动）
- 「地点图鉴」分类下拉不再显示英文 kind：服务端在 `locations.list` 里补 `kindLabel`，客户端按「玩乐与热闹 / 自然与户外 / 文化与展馆 / 吃喝与休息 / 故事地点 / 其他地点」分组显示中文。
- 新增快捷筛选 chips：全部、故事地点、我的故事地点、常规地点、可玩场所、我的地点、住所。快捷筛选与分类、搜索可叠加。
- 服务端同时补 `storyBound` / `builtinStoryBound` / `customStoryBound` / `userPlace`，按当前故事目录实际绑定的 `placeId` 计算；停用故事仍算绑定。
- 本轮改动需要重新构建 `dist/webui.js` 才进安装包。

## 3. 验证现状

- `npm test`：**除一条外全绿**
- 唯一失败：`test/story-config.test.mjs` 的 `real DPAPI settings survive restart…` —— **沙箱拦了插件 spawn 的 PowerShell**，不是代码缺陷。真实 Coo 进程里应可解密，但仍需人验一次。
- 本轮四篇内置故事定向测试：`story-packs` 15/15、`story-migration` 7/7、`story-panel` 14/14、`test/panels.test.mjs` 68/68、`webui/story/webui` 32/32 通过；`story-config` 除 DPAPI 外通过。
- 全部其余套件（journal-world、story-stages、story-dm、story-world、branches、journeys、exploration、venues、state、events、memories、phases、keepsakes、user-venues、aquarium、wishes、choices、world、place-library、webui/places）均已单独跑通。
- `test/journal-world.test.mjs` 的江边分支测试先停用 `bridge-echo-solo`：该内置故事会在「步道」自动开场，测试验证的是普通分支后续，不是故事；这不是放宽断言。
- `npm run verify`：通过（20 工具、6 面板、提示词、隔离审计、describe 一致）
- `npm run describe` 已重新生成，`describe.json` 与代码一致。
- 本轮已从当前源码重建本地 tgz 并 `verify-published --file` 通过：44 个文件，含 `src/bridge-echo-solo.json`、`src/swapped-plaque-riddle.json`，安装形态确认四篇内置故事；已解包镜像到 `local-install-story.2/package` 并重启 Coo，服务端返回的 `webui.js` 为新 bundle（305188 字节）。**未发布**。
- 未做：真实 Coo 里的 DPAPI 往返、真实模型调用、真实 ComfyUI 出图、真实用户资料迁入

## 4. 备份与回退

| 用途 | 位置 |
|---|---|
| 合并 F3–F5 前的源码 | `backups/fun-world-pre-f5-20261121-193032` |
| 上 0.3.3 前的源码 | `backups/fun-world-pre-033-20261121-210457` |
| 装 UI 美化前的安装包 | `story-world/artifacts/coo-backup-ui-20261121-221555` |
| 上 0.3.3 前的安装包 | `story-world/artifacts/coo-backup-032-package-20261121-210733` |
| 安装本轮构建前的安装包 | `story-world/artifacts/coo-backup-fun-20261122-1015`（旧 41 文件包） |
| 更早的 story.2 备份 | `story-world/artifacts/coo-backup-story.2-20261121-110113-092` |

Coopanion 的 `core/persona.ts` 仍用本机兼容补丁（提供 `WorldHost.cognition`）。**Coopanion 本体升级会覆盖它**；市场包不含该补丁，没它只能手动游玩。

## 5. 下一步（按优先级）

1. **体验当前安装**：Coo 已装本轮构建并重启；打开「地点册」看中文分组与快捷筛选，打开「鱼的故事世界」看四篇内置故事和节点上限设置。
2. **人验 DPAPI**：设置里填假 Key → 保存只见掩码 → 重启仍可用 → 清除后失效。若报「无法解密」才是真 bug。
3. **按用户计划发布再重装**：体验确认后 `npm publish 0.3.3`（版本号已定死，npm 不能覆盖）→ 市场刷新 → 卸载本机 `link:` 安装 → 从市场重装 0.3.3 → 验收。发布、卸载和市场重装均须用户明确同意；卸载前先备份 `<dataDir>/fun/`。
4. 之后才是 F5 剩余（连续故事、真实自动生图）、D2 契约交付给「鱼的每一天」。

## 6. 环境注意

- 沙箱禁止写 `E:\Coopanion\data`，**Coo 进程必须用户手动启动**；重启用 `POST http://127.0.0.1:17788/api/run/restart`。
- `ELECTRON_RUN_AS_NODE=1` 会让 Coopanion.exe 以 node 模式秒退；从本机 shell 启动前要清掉。
- npm 默认 cache 在 `C:\Users\asus\AppData\Local\npm-cache`，沙箱拒绝写入；统一加 `--cache "E:\deep seek\.tmp\npm-cache"`。
- PowerShell 写入易带 UTF-8 BOM，`package.json` 有 BOM 会让验包报 `Unexpected token ''`；改完用 `[System.IO.File]::WriteAllText(..., UTF8Encoding($false))`。
- 不要用 `node --test`（子进程 `spawn EPERM`）；项目脚本都是直接 `node test/*.mjs`。

## 7. 相关文档

- [0.3.3 需求](<../../docs/娱乐时间-0.3.3-配置与作者体验-需求-20261121.md>)
- [设置页 UI 美化方案](<../../docs/娱乐时间-设置页UI美化方案-20261121.md>)
- [F1/F2 交接](<../../HANDOFF-2026-11-21-娱乐时间-F1F2.md>)
- [故事世界 README](<../../story-world/README.md>)
- [鱼的每一天 D1/D2 输入清单](<../../superagent-daily/state/work/complete-feed-integration-5911d28f5e63/INPUTS.md>)

## 8. 新对话开场

> 读 `E:\deep seek\fun-world\HANDOFF-0.3.3.md`。源码与本机 Coo 安装已是四篇内置故事、故事节点上限和地点图鉴中文分类/快捷筛选；下一步是用户体验后发布 0.3.3，再卸载本地链接安装并从市场重装。不要重复实现已完成的功能；发布、卸载、市场重装都要先获用户明确同意，卸载前备份 `<dataDir>/fun/`。真实 DPAPI 往返需实机验收。
