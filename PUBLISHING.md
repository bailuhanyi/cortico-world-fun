# 发布到 Coo 扩展市场

口径沿用 `feed-world/PUBLISHING.md`（那边已发过 13 个版本），只写本插件不同的部分。

市场不自己收包。它读两处：

1. **npm**：包本身。市场 Action 每 30 分钟搜一次 npm 上带 `cortico-world` 关键字的包，解包读 `cortico` 块、`describe.json`、`CHANGELOG.md`、图标与截图，把结果写进索引仓。
2. **GitHub 索引仓** [`Pal-AI-Lab/cortico-extensions`](https://github.com/Pal-AI-Lab/cortico-extensions)。

所以「发布到 Coo」= **发一个 npm 包**，剩下的市场自动收。认证（盾牌）是另一件事。

---

## 本次准备发布：0.2.1（尚未发布）

2026-11-18（Asia/Shanghai）核对 npm：线上 latest 为 0.2.0，0.2.1 版本端点返回 404。当前本地版本已设为 **0.2.1**，不要再次运行 `npm version patch`。本轮仅准备发布，不执行 npm publish、Git 提交、推送、标签或 Coo 安装。

本版为三个面板的 UI 与交互精修：地点快捷筛选、纪念册分类与行程详情、折叠心愿表单、收藏小卡与探索进度、加载重试和失败保留内容。状态格式、工具和提示词不变。

发布前验证已通过：完整 `prepublishOnly`（面板 42/42、世界集成 75/75）、本地安装形态验证。市场检查为 **26 项通过、0 失败、1 警告**：未配置市场截图。线上可用版本检查已改为直接请求 registry，避免 Windows 非交互子进程导致的误报；若目标版本已存在会阻止重复发布。

修正后的 `verify-published.mjs` 已对 npm 上的 **0.2.0** 完成真实整包验收：下载、解包、三方面工具名称对账、三个面板取数与客户端 ID 对账、海洋馆进门/游逛/购买/收摊及纪念册记录均通过。此结果不代表 0.2.1 已上线；0.2.1 需发布后单独验包。

仍待实机确认：Coo 内的视觉验收与市场截图。此前 Edge 截图进程受权限限制，不能把 DOM 测试当成实机视觉验收。工作树中的修改尚未提交，本地验证日志及 `.tmp` 不应加入提交或发布包。

准备流程：

```powershell
npm run prepublishOnly
node tools/verify-tarball.mjs
npm pack --dry-run
```

用户确认正式发布后，在已认证的终端执行 `npm publish` 并按实际提示完成认证；不要把恢复码作为 OTP，也不要在对话或日志中粘贴令牌。发布后执行：

```powershell
node tools/verify-published.mjs 0.2.1
npm view cortico-world-fun dist-tags
```

下文均为历史流程参考，旧版本、旧提交和旧数量不作为本轮状态。

## 0. 发版前自查

```powershell
cd 'E:\deep seek\fun-world'

# 单测逐个跑（不要 node --test：受限沙箱里 spawn 子进程会 EPERM）
node test/venues.test.mjs
node test/state.test.mjs
node test/world.test.mjs
node test/panels.test.mjs
node test/memories.test.mjs
node test/phases.test.mjs
node test/keepsakes.test.mjs
node test/user-venues.test.mjs
node tools/check-prompt.mjs      # 模板变量与 envPromptVars 对上
node tools/check-isolation.mjs   # 不依赖别的 World、吃喝数据不含味道词
node tools/smoke.mjs             # dry-mount：按宿主顺序真加载一遍
node tools/make-describe.mjs --check
node tools/verify-tarball.mjs    # 按 files 白名单组包、从安装形态真跑
node tools/publish-check.mjs     # 市场收录口径（加 --online 额外查 npm 占用）
```

`prepublishOnly` 已经把上面这一串（除 `verify-tarball` 外）都串起来了，其中 `publish-check` **实际带 `--online`**。`npm publish` 之前会自动跑一遍，任何一处失败就发不出去；`verify-tarball` 需单独执行。

当前状态（0.1.6，**待发**）：**25 项通过、0 失败、1 警告**（没截 `screenshots`）；**199 个单测全绿**
（venues 13 · state 21 · memories 20 · phases 14 · keepsakes 18 · user-venues 19 · world 65 · panels 29）；
打包 **18 个文件**、解包约 367KB。

> 这里曾写「162 项」。那是把 7 个文件的分项加错了一次——逐个数下来是 152，
> 与 `npm test` 实际跑出的一致。以后改测试数量请以实跑结果为准，别照抄文档。

---

## 1. 仓库地址

`package.json` 顶层已有三行（指向 `bailuhanyi/cortico-world-fun`）。**必须写在顶层**，Action 不读 `cortico` 块。

仓库 `bailuhanyi/cortico-world-fun` **已经建好并推过**。当前记录：远端 `main` 为 `b652962`，本地为 `babed2b`，本地领先 **8 个提交，尚未 push**；不能把本地 0.1.6 待发状态写成已经同步到远端。
下面这段是**首次建仓时的历史示例，现在不要再跑**（`git init` / `remote add` 会重复）：

```powershell
# ==== 仅首次建仓时做过一次，已过时，别再执行 ====
cd 'E:\deep seek\fun-world'
git init
git add -A
git commit -m "娱乐时间 0.1.0：十二处能真去逛的地方，带完整出游 session"
git branch -M main
git remote add origin https://github.com/bailuhanyi/cortico-world-fun.git
git push -u origin main
```

已有提交需在发布交接时同步到远端；先检查仓库状态，不要为这 8 个已有提交重复提交。此前这台机器推送时曾遇到 `schannel` 报 `SEC_E_NO_CREDENTIALS`，这是当时的环境故障，不代表 agent 环境永远无法 push；若仍受阻，可由你在自己的 PowerShell 中推送。

`.gitignore` 已排掉 `fun/`（运行时状态）、`node_modules/`、`*.bak-*`。

---

## 2. npm 登录与 2FA

```powershell
npm login
npm whoami
npm config get registry   # 应是 https://registry.npmjs.org/
```

此前在 agent 的非 TTY shell 中发布曾报 `EOTP`，交互验证未能完成，这是当时的环境与认证方式造成的故障，不代表所有非 TTY 发布都会失败。**本次仍建议由你在自己的真实交互式 PowerShell 终端完成发布与验证提示**；能否在其他环境发布取决于实际认证配置。

- 要么 2FA + `--otp 123456`（6 位数字，30 秒滚一次，人手输）
- 要么建 granular access token 勾「bypass 2FA」

> ⚠️ npm 的**恢复码**是账户恢复凭据，**不能作为 `--otp` 使用**；`--otp` 应填写认证器生成的当期验证码。恢复码的用途与安全限制以 npm 当前账户恢复流程为准，不要把此前遇到的限制当成所有账户都会触发的固定规则。

---

## 3. 看一眼要发出去的东西

```powershell
npm pack --dry-run
```

本地待发的 0.1.6 是 **18 个文件**、解包约 367KB，包含 3 个面板、7 个工具：

```
package.json  README.md  CHANGELOG.md  PUBLISHING.md  describe.json
assets/icon.png
dist/webui.js          # 3 个面板：去哪儿 / 纪念册 / 纪念品
src/index.js  src/definition.js  src/config.js  src/venues.js  src/state.js
src/memories.js  src/phases.js  src/keepsakes.js  src/user-venues.js  src/world.js  src/ENV_PROMPT.md
```

`test/`、`tools/`、`install.ps1` 都在 `files` 之外，不会发出去——测试、图标生成器、装机脚本是我们的工具，不是用户要的东西。
`dist/` 必须在 `files` 里：`cortico.webUiClient` 声明了它，漏了的话装到 Coo 里点面板是一片空白（`publish-check` 会拦）。

---

## 4. 发

```powershell
npm publish --otp 123456
```

**这不是首发**：npm 上 `cortico-world-fun` 的 `latest` 目前是 **0.1.5**，本地 **0.1.6 待发**。
本次发布 **0.2.0**，**不要再次运行 `npm version patch` 或其他 `npm version` 命令**，否则会跳号。
不需要 `--access public`（那是作用域包 `@you/xxx` 才要）。将来准备下一版时，先核对本地版本与 npm 已发布版本，再决定是否需要升版；不要手改版本号后又用 `npm version` 重复升版。

发完立刻验：

```powershell
npm view cortico-world-fun version          # 应回当前版本
npm view cortico-world-fun cortico --json   # 能看到 kind/api/displayName/icon/describe/webUiClient/locales
npm view cortico-world-fun dist-tags        # latest 应是当前版本

# 更强的一条：把发出去的包下载下来解包，从安装形态真加载一遍
node tools/verify-published.mjs
```

`npm view` 走 CDN，刚发出去可能滞后几十秒到几分钟，回 `E404` 先等一下。

**`verify-published.mjs` 比 `npm view` 强在哪**：元数据只能证明「声明了 `webUiClient`」，
证明不了「`dist/webui.js` 真在包里」。少了那个文件，装到 Coo 里点面板就是**一片空白**，
而且不会有任何报错。这个脚本会下载线上 tarball、解包、加载、跑一趟出游、再拿线上的
两份东西（服务端声明 + 客户端 bundle）对账面板 id。

---

## 5. 让它马上进市场

Action 平时每 30 分钟扫一次，GitHub 定时任务可能推迟。如需请求同步，先查看索引仓**当前的 issue 模板与说明**：

<https://github.com/Pal-AI-Lab/cortico-extensions/issues/new/choose>

旧版本文曾建议标题 `[同步] cortico-world-fun`、正文 `package: cortico-world-fun`，但交接建议中的 sync issue 写法与本文不一致，目前不能确认哪种仍适用。**以市场当前模板为准**，按模板填写包名与所需信息；不要直接照抄旧格式，也不要保证开 issue 后就会立即收录。

---

## 6. 截图（唯一还缺的东西）

1. 装好插件、重启 Coo，世界页开「娱乐时间」
2. 面板截一张（能看到「正在逛」徽章和场所数最好）
3. 存成 `assets/screenshot-1.png`（每张 ≤2MB，最多 8 张）
4. `package.json` 的 `cortico` 块里加 `"screenshots": ["assets/screenshot-1.png"]`
5. 截图改了就必须**发新版本**——市场按版本扫包

> 0.1.1 起有面板页；本地 0.1.6 的 `dist/webui.js` 现有 **3 个面板：去哪儿 / 纪念册 / 纪念品**。现在能截：
> Coo 世界页的「娱乐时间」卡片、**「去哪儿」面板**（二十处 + 自己加的/改过的 + 正在逛那条）、
> **「纪念册」面板**、**「纪念品」面板**、配置页（4 项）。

---

## 标签：为什么只有 `companion`

作者能声明的只有普通、提示、警示三级；官方标注（`coopanion` 等）由官方给。

| 标签 | 级别 | 为什么 |
| --- | --- | --- |
| `companion` | 普通 | 出门、游玩、陪伴向的主动性 |

**刻意没声明的**：

- `proactive` — **不在市场词表里**，写了等于没写（`publish-check` 会拦）。
- `local` — 那个词的意思是「在本机跑模型、要算力显存」，本插件一行推理都不跑。**用错会误导用户**。
- `internal-state` — 它只在自己的 `dataDir/fun/state.json` 里记当前这一趟和纪念册，不碰 Memory，也不记「她是谁」。不像 feast 那样维护她的日程和口味画像。
- `injection-risk` — 不推任何事件（`describe.events` 是空数组），没有任何正文是别人写的。
- `high-cost` — 7 个工具，一天用不了几次。

当前已有 3 个面板，并维护纪念册与纪念品等跨趟数据；不能再把「以后加面板或跨趟记忆」写成未来条件。`internal-state` 是否适用应依据市场当前标签定义与实际状态用途复核。

---

## 认证（以后再说）

认证需按市场当前规则审核，本文列出的条件包括：没有错误标签、版本表现稳定、**World 不直接依赖其他 World**、
**至少有过一次后续更新**。npm 上已发布的 0.1.5 已不是首版，因此「后续更新」这一项已经满足，**无需等 0.1.6 发布才满足**；这不代表认证一定通过，其他要求与最终审核仍以市场当前规则为准。

本插件在「不依赖其他 World」这条上是干净的：不调别人的工具、不读别人的状态/日程，
素材库**完全不读**，`scene` 只是条目上的字符串。

申请：开一个 `[认证] cortico-world-fun` issue，正文 `package: cortico-world-fun`。

---

## 之后发新版本

```powershell
# 1. 改代码
# 2. 更新 CHANGELOG.md（市场按 ## 标题切段）
# 3. 核对本地与 npm 版本；仅在尚未升版时执行 npm version patch（本次 0.1.6 已备好，跳过）
# 4. node tools/make-describe.mjs     # 改过 ENV_PROMPT 或工具描述必须重跑
# 5. node tools/publish-check.mjs --online
# 6. npm publish --otp 123456
# 7. 如需请求市场同步，按市场当前 issue 模板操作（旧 sync 写法存在交接差异）
```

改过 `src/ENV_PROMPT.md` 或任何工具描述，**一定要重跑 `make-describe.mjs`**——
市场展示的是 `describe.json` 里那份，不是运行时那份。

---

## 出问题怎么办

| 症状 | 原因 | 处理 |
| --- | --- | --- |
| 市场搜不到 | `keywords` 里没有 `cortico-world` | 改完发新版本 |
| 卡片能力摘要空 | 包里有没 `describe.json`，或 `cortico.describe` 没指对 | `node tools/make-describe.mjs` |
| 详情「环境提示词」空 | `describe.json` 的 `prompts` 空了 | 同上；检查 `src/ENV_PROMPT.md` |
| 没有更新说明 | `CHANGELOG.md` 缺当前版本二级标题 | 补 `## x.y.z` |
| 图标不显示 | 不在 `assets/` 下，或超 512KB | `python tools/make-icon.py` |
| 标签没生效 | 写了词表外的标签 | 只写词表里的（本插件用 `publish-check` 拦） |
| 安装后世界不出现 | `cortico.api` 与用户那版 Coo 契约不符 | 当前是 6 |
| `npm publish` 报 403 | 没登录，或包名被占 | `npm whoami`；`node tools/publish-check.mjs --online` |
