# 娱乐时间插件 0.2.0 交接文档

- 更新时间：2026-11-18 13:00（Asia/Shanghai）
- 工作目录：`E:\deep seek\fun-world`
- 包名：`cortico-world-fun`
- 本地版本：`0.2.0`
- 运行要求：Node `>=22`、ESM；Coo World API `6`

## 1. 当前结论

**0.2.0 已发布到 npm，`latest` 已指向 0.2.0。** 本次交接现场查询以下两个端点均返回 HTTP 200、版本 0.2.0：

- [npm 0.2.0 元数据](https://registry.npmjs.org/cortico-world-fun/0.2.0)
- [npm latest 元数据](https://registry.npmjs.org/cortico-world-fun/latest)

上一轮发布准备时曾查到 0.2.0 为 404；那是发布前状态，已被本次查询结果更新。**不要重复发布 0.2.0，也不要为了完成这次交接再次升版。**

已完成 Token 与上下文优化、版本定为 0.2.0、更新日志整理和发布前验证。当前还有未提交的源码、测试、文档及新文件；不能把“npm 已发布”理解成“Git 已提交并同步”。

本会话没有执行 Coo 安装或重启验收。Coo 当前是否已安装 0.2.0、扩展市场是否已收录，均未核实。线上包的完整下载、解包、运行验收也尚未完成，相关脚本存在旧断言，见下一节。

## 2. 接手后优先处理

1. 修正 [verify-published.mjs](<E:/deep seek/fun-world/tools/verify-published.mjs>) 的过时检查，再运行线上包验证。当前第 141 行写死“6 个工具”，第 151 行写死“2 个面板”；0.2.0 实际是 **11 个工具、3 个面板**。这两条会对当前版本误报。应核对工具名称、包内描述与运行时声明，以及客户端/服务端面板 ID 的一致性，不要只依赖旧的固定数量。
2. 修正后执行 `node tools/verify-published.mjs 0.2.0`，确认线上包可下载、面板文件存在、从安装形态能够跑完出游。当前只有 npm 元数据核实及发布前的本地安装形态验证通过，不能写成线上整包验收已通过。
3. 核对工作树并整理 0.2.0 的 Git 提交、推送及标签。当前发布包的 `gitHead` 仍指向 0.1.6 的提交，新增功能在未提交工作树里。提交前逐项审查文件，不要直接把本地日志一起提交。
4. 如需 Coo 实机验收，先确认本机安装版本；本地安装前阅读 [安装脚本](<E:/deep seek/fun-world/install.ps1>)，先执行 `-DryRun`，再按需关闭 Coo、安装并重启验收。npm 发布与本地安装是两项独立状态。
5. 核对扩展市场收录情况。市场截图尚未配置；这在发布检查中是非阻断警告。如后续需要截图或其他包内内容变更，应另行准备新版本。

本轮只更新交接与发布状态说明，没有改动上述线上验包脚本，也没有执行发布、Git 提交或部署。

## 3. 发布包与 Git 状态

### npm 产物

- 已发布版本：`cortico-world-fun@0.2.0`。
- [发布 tarball](https://registry.npmjs.org/cortico-world-fun/-/cortico-world-fun-0.2.0.tgz)。
- 文件数：23。
- 解包大小：419,041 字节（npm 显示约 419.0 kB）。
- 发布前 `npm pack --dry-run` 显示压缩约 190.2 kB。
- npm `dist.shasum`：`821c5bd39b2f0cd2aae6e4a8c8709d58a4202e54`，与本会话发布前打包预览记录一致。
- npm `gitHead`：`074bc353c04844101663fc5a46b3408b0a48edff`。它不能代表未提交工作树里的全部 0.2.0 变更。
- 包含 11 个工具、0 个主动推送事件、1 份环境提示词；3 个面板 ID 为 `places`、`book`、`shelf`。
- 发布白名单包含源码、面板 bundle、图标、描述文件和发布文档；不包含测试、工具脚本、安装脚本、运行时数据或本交接文件。

### 本地 Git 快照

- 分支：`main`；跟踪分支：`origin/main`。
- HEAD：`074bc35`，提交说明“娱乐时间 0.1.6：关联纪念品行程、统一历史日期与发布收尾”。
- origin：[bailuhanyi/cortico-world-fun](https://github.com/bailuhanyi/cortico-world-fun.git)。
- 本次没有 fetch 或查询远端 HEAD；`git status` 中的跟踪信息不证明远端实时状态。
- 已修改文件涉及更新日志、发布说明、README、包描述、面板 bundle、包版本、提示词、World/状态/收藏/地点代码、相关测试及验证脚本。
- 未跟踪的新源码：[aquarium.js](<E:/deep seek/fun-world/src/aquarium.js>)、[choices.js](<E:/deep seek/fun-world/src/choices.js>)、[events.js](<E:/deep seek/fun-world/src/events.js>)、[names.js](<E:/deep seek/fun-world/src/names.js>)、[wishes.js](<E:/deep seek/fun-world/src/wishes.js>)。
- 对应新测试：[aquarium.test.mjs](<E:/deep seek/fun-world/test/aquarium.test.mjs>)、[choices.test.mjs](<E:/deep seek/fun-world/test/choices.test.mjs>)、[events.test.mjs](<E:/deep seek/fun-world/test/events.test.mjs>)、[wishes.test.mjs](<E:/deep seek/fun-world/test/wishes.test.mjs>)。
- 本交接文件及 [verification-token.log](<E:/deep seek/fun-world/verification-token.log>) 也未跟踪；后者是本地验证产物，不是发布必需文件。

保留已有工作树，不要 `git reset --hard`、清理未跟踪源码或用旧版本覆盖当前实现。

## 4. 本轮 Token 与上下文优化的最终行为

原计划已经实施，下面记录最终实现，不再保留“尚未开始”的旧计划。

- [ENV_PROMPT.md](<E:/deep seek/fun-world/src/ENV_PROMPT.md>) 已精简，目前为 1,410 字节 UTF-8；保留出游流程、精确名称约束、选择 ID、心愿非催促语义、图片/食物事实红线、日程联动及预设只能恢复的规则。未做模型 tokenizer 测量，不把字符或字节变化当作精确 Token 节省率。
- `envPromptVars()` 返回 `{ fun_places_block: '' }`，不再常驻注入地点名称、别名及 scene。模板中的占位符保留并替换为空，地点由 `fun_places` 按需查询。
- 工具描述已压缩，“地点名列在环境提示词里”的旧说法已移除；[definition.js](<E:/deep seek/fun-world/src/definition.js>) 的摘要同步更新，[describe.json](<E:/deep seek/fun-world/describe.json>) 已重新生成。
- `fun_places` 继续按当前营业状态等规则返回推荐，支持 `all` 和 `kind`，可显示当前可实现心愿的缘由。
- `fun_go` 集中给出当前时段可逛项目、完整纪念品与拍照点清单、餐食品类；保留当前地点相关历史及尚未逛过的项目提示。
- `fun_wander` 给出本次区域、事件、实际买/拍/吃结果、错误反馈、完成的心愿和必要提醒；保留 `choiceId` 与选项 ID。不再每次重列整套候选、历史到访次数和整趟已逛清单。吃喝联动提示在实际有吃喝回执时提供。
- `fun_start` 缩短为推荐地点及简短下一步提示，不展开各地点项目清单。
- `fun_view` 保留按需查询的行程 ID、同行人和收摊备注；`fun_shelf` 与 `fun_wishes` 仍是收藏和心愿查询入口。
- `fun_home` 保持本次摘要、准确的 scene/outfits 指引和日程提示，不展开全部旧行程。

优化只减少进入模型上下文的文字。本地事件过滤、名称归一、心愿判定、收藏账本、选择持久化和旧状态兼容均保留。

## 5. 0.2.0 功能与状态模型

### 工具与出游流程

基本流程：`fun_places → fun_go → fun_wander → fun_home`。待选择事件先用 `fun_choice` 处理，再继续游逛。

| 工具 | 用途 |
| --- | --- |
| `fun_places` | 动态地点查询、分类筛选和全部地点清单 |
| `fun_go` | 进门开始行程，提供当前地点清单 |
| `fun_wander` | 逛一个项目，可记录购买、拍照和吃喝 |
| `fun_choice` | 按回执 ID 处理待选择事件 |
| `fun_home` | 收摊、保存行程并返回本次摘要 |
| `fun_start` | 出门前查看推荐 |
| `fun_view` | 按需查看近期及珍藏行程 |
| `fun_wishes` | 查看心愿和状态 |
| `fun_wish` | 新增、暂缓、恢复或取消心愿 |
| `fun_keepsake` | 珍藏或取消珍藏已结束行程 |
| `fun_shelf` | 长期收藏与进度查询 |

### 地点和事件

- 内置 20 个地点，支持别名、自填地点和预设覆盖层。
- 营业状态优先排序；同状态下保留自填优先、近期到访降权等规则，可实现心愿也参与推荐。
- 时段可改变描写、开放项目和事件池。
- 自动逛与指定项目使用一致的事件筛选：先确定项目和有效收获，再按事实前置条件选事件。
- 显式空池不回退通用事件；历史候选耗尽时允许没有事件。
- 海洋馆 6 个区域有专属空间与事件细节。
- 购买、拍照、吃喝先精确匹配；唯一简称归为正名，多义输入列候选，不猜测，不模糊迁移旧记录。

### 持久化

默认数据位置：

```text
<dataDir>/fun/state.json
<dataDir>/fun/venues.json
```

核心状态：

| 字段 | 作用 |
| --- | --- |
| `session` | 当前行程及待选择事件、选择记录 |
| `trips` | 最近 40 趟详细行程 |
| `collection` | 独立长期纪念品账本：地点、首次日期、累计次数、关联行程 |
| `keepsakeTrips` | 用户明确珍藏的完整行程，不受 40 趟窗口限制 |
| `wishes` | 出游心愿及状态 |

旧状态由 `normalizeState()` / `normalizeSession()` 兼容。长期收藏可从仍保留的旧行程初始化；旧版本已裁掉的历史无法恢复，不猜补。没有 `leftDay` 的旧记录按插件时区读取时间戳，不改写历史。

心愿支持地点、项目、时段、纪念品四类，状态为 `active / paused / completed / cancelled`；最多 100 条，活动及暂缓心愿去重。只由真实动作完成，不自动催促，不用旧行程倒推完成。

结构化选择目前用于鲸影经过海底隧道、水母缸停留、企鹅喂食等少量事件。游逛回执给 `choiceId`、选项 ID 和标签；调用 `fun_choice({ choiceId, optionId })` 后返回结果。`pendingChoice` 和 `choices` 可在重启后恢复，收摊保存选择记录；不会凭空生成纪念品。

## 6. 验证记录与复查命令

### 已有证据

| 检查 | 结果与范围 |
| --- | --- |
| `npm test` | 前一实施阶段全部通过；世界集成 75/75、面板 36/36 |
| `npm run verify` | 前一阶段最终退出码 0；包含提示词、隔离、冒烟与描述一致性检查 |
| `node tools/make-describe.mjs --check` | 本次交接再次运行通过：11 个工具、0 个事件 |
| `git diff --check` | 前一阶段通过；CRLF 提示是行尾警告，不是测试失败 |
| `node tools/verify-tarball.mjs` | 0.2.0 发布准备阶段通过；按白名单复制成安装目录后真实跑通 |
| `node tools/publish-check.mjs --online` | 发布前 25 项通过、0 失败、2 警告：未配截图、线上查询无结果 |
| `npm pack --dry-run` | 发布前通过：23 个文件，约 190.2 kB 压缩、419.0 kB 解包 |
| npm 0.2.0 / latest 查询 | 本次交接均为 200，版本 0.2.0，弥补此前线上查询未得到结果的问题 |
| `node tools/verify-published.mjs 0.2.0` | 尚未完成；先修正旧的 6 工具/2 面板断言 |

本次写交接没有重新跑全部测试。不要把发布前本地验证或元数据查询写成 Coo 实机验收、线上 tarball 运行验收。

需要复查时，在仓库目录执行：

```powershell
npm test
npm run verify
node tools/make-describe.mjs --check
node tools/verify-tarball.mjs
git diff --check
```

线上验包脚本修正后：

```powershell
node tools/verify-published.mjs 0.2.0
```

测试脚本逐文件运行；不要改成受限环境下 `node --test` 汇总执行。[smoke.mjs](<E:/deep seek/fun-world/tools/smoke.mjs>) 与 [verify-tarball.mjs](<E:/deep seek/fun-world/tools/verify-tarball.mjs>) 已将常驻地点断言同步为“环境列表为空、工具仍可按需查询”。

此前 npm 打包预览需要写工作区外的用户缓存，被沙箱拒绝后经一次权限批准重试成功。后续遇到同类拒绝，应按实际权限处理，不代表包构建有错，也不要绕过沙箱。

## 7. 代码入口与约束

| 文件 | 作用 |
| --- | --- |
| [world.js](<E:/deep seek/fun-world/src/world.js>) | 工具声明与处理、回执、面板数据、状态持久化入口 |
| [state.js](<E:/deep seek/fun-world/src/state.js>) | 归一化、进门/游逛/购买/收摊、行程与收藏写入 |
| [venues.js](<E:/deep seek/fun-world/src/venues.js>) / [user-venues.js](<E:/deep seek/fun-world/src/user-venues.js>) | 内置地点、自填地点与预设覆盖层 |
| [events.js](<E:/deep seek/fun-world/src/events.js>) / [phases.js](<E:/deep seek/fun-world/src/phases.js>) | 事件前置条件、区域过滤、时段配置 |
| [memories.js](<E:/deep seek/fun-world/src/memories.js>) | 历史记忆、重复过滤、事件抽取 |
| [keepsakes.js](<E:/deep seek/fun-world/src/keepsakes.js>) / [names.js](<E:/deep seek/fun-world/src/names.js>) | 收藏与进度、精确名称归一 |
| [wishes.js](<E:/deep seek/fun-world/src/wishes.js>) / [choices.js](<E:/deep seek/fun-world/src/choices.js>) | 心愿与结构化选择纯函数 |
| [aquarium.js](<E:/deep seek/fun-world/src/aquarium.js>) | 海洋馆专属描写 |
| [webui.js](<E:/deep seek/fun-world/dist/webui.js>) | 3 个面板的客户端 bundle |
| [ENV_PROMPT.md](<E:/deep seek/fun-world/src/ENV_PROMPT.md>) / [definition.js](<E:/deep seek/fun-world/src/definition.js>) | 运行时提示词、World 元信息与工具摘要 |
| [describe.json](<E:/deep seek/fun-world/describe.json>) | 生成产物，工具与环境提示词的市场描述 |

维护约束：

- 提示词或工具描述改动后，运行 `node tools/make-describe.mjs`，不要手工长期维护生成产物。
- 面板 bundle 改动后，至少运行 `node --check dist/webui.js` 和 `npm test`。
- 不新增其他 World 的运行时依赖，不读取其状态、日程或素材库。联动靠提示词和用户配置。
- 食物仅记录品类；未经外部实际吃喝，不编味道。scene/outfits 必须有事实来源，不编素材库没有的名称。
- `create()` 保持纯；`envPromptVars()` 不抛错；旧状态兼容和真实动作判定不因省 Token 被删除。

## 8. 文档与环境说明

- [CHANGELOG.md](<E:/deep seek/fun-world/CHANGELOG.md>) 已有 `## 0.2.0`，包含 Token 优化、心愿、选择、长期收藏和事实校验改动；旧版本段落是历史说明，不代表当前行为。
- [PUBLISHING.md](<E:/deep seek/fun-world/PUBLISHING.md>) 本次更新顶部状态为已发布；其后保留的旧版本测试数、包大小和提交记录仍只供历史参考，以本交接的当前快照为准。该更正只在本地工作树；已发布的 0.2.0 包仍携带发布前文档，不会因本地编辑而改变。
- Hindsight 在本次交接时连接 `127.0.0.1:9077` 被拒绝，未取得页面内容。之前也出现过缺少 API key 的 401；不能声称本轮已保存远端记忆。当前交接依据实际文件、Git 状态、此前执行记录和 npm 实时元数据。
