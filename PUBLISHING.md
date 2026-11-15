# 发布到 Coo 扩展市场

口径沿用 `feed-world/PUBLISHING.md`（那边已发过 13 个版本），只写本插件不同的部分。

市场不自己收包。它读两处：

1. **npm**：包本身。市场 Action 每 30 分钟搜一次 npm 上带 `cortico-world` 关键字的包，解包读 `cortico` 块、`describe.json`、`CHANGELOG.md`、图标与截图，把结果写进索引仓。
2. **GitHub 索引仓** [`Pal-AI-Lab/cortico-extensions`](https://github.com/Pal-AI-Lab/cortico-extensions)。

所以「发布到 Coo」= **发一个 npm 包**，剩下的市场自动收。认证（盾牌）是另一件事。

---

## 0. 发版前自查

```powershell
cd 'E:\deep seek\fun-world'

node test/venues.test.mjs        # 10 项
node test/state.test.mjs         # 13 项
node test/world.test.mjs         # 24 项
node tools/check-prompt.mjs      # 模板变量与 envPromptVars 对上
node tools/smoke.mjs             # dry-mount：按宿主顺序真加载一遍
node tools/make-describe.mjs --check
node tools/publish-check.mjs --online   # 市场收录口径 + npm 包名占用
```

`prepublishOnly` 已经把上面这一串（除 `--online` 外）都串起来了，`npm publish` 之前自动跑一遍，任何一处失败就发不出去。

当前状态（0.1.1）：**25 项通过、0 失败、1 警告**（没截 `screenshots`）；**59 个单测全绿**
（venues 10 · state 13 · world 24 · panels 12）；打包 **14 个文件**，解包 190KB。

---

## 1. 仓库地址

`package.json` 顶层已有三行（指向 `bailuhanyi/cortico-world-fun`）。**必须写在顶层**，Action 不读 `cortico` 块。

仓库要在 GitHub 上先建好（这台机器没装 `gh`，走网页建空仓，**不要**勾 README/LICENSE/gitignore）：

```powershell
cd 'E:\deep seek\fun-world'
git init
git add -A
git commit -m "娱乐时间 0.1.0：十二处能真去逛的地方，带完整出游 session"
git branch -M main
git remote add origin https://github.com/bailuhanyi/cortico-world-fun.git
git push -u origin main
```

`.gitignore` 已排掉 `fun/`（运行时状态）、`node_modules/`、`*.bak-*`。

---

## 2. npm 登录与 2FA

```powershell
npm login
npm whoami
npm config get registry   # 应是 https://registry.npmjs.org/
```

**`npm publish` 必须在交互式终端里跑。** 它只在真 TTY 里才弹验证提示，
在 agent 的非 TTY shell 里直接抛 `EOTP`。**agent 能做的到 `publish-check` 为止**，最后那一下由你在自己的 PowerShell 里敲。

- 要么 2FA + `--otp 123456`（6 位数字，30 秒滚一次，人手输）
- 要么建 granular access token 勾「bypass 2FA」

> ⚠️ npm 的**恢复码**（一长串 64 位 hex）只能用于网页登录，**千万别传给 `--otp`**：会当场消耗一个，
> 并触发 **72 小时安全封禁**，期间不能发布、不能建 token、无法提前解除。

---

## 3. 看一眼要发出去的东西

```powershell
npm pack --dry-run
```

0.1.1 应该是 **14 个文件**、解包约 190KB：

```
package.json  README.md  CHANGELOG.md  PUBLISHING.md  describe.json
assets/icon.png
dist/webui.js          # 面板（去哪儿 / 纪念册）
src/index.js  src/definition.js  src/config.js  src/venues.js  src/state.js  src/world.js  src/ENV_PROMPT.md
```

`test/`、`tools/`、`install.ps1` 都在 `files` 之外，不会发出去——测试、图标生成器、装机脚本是我们的工具，不是用户要的东西。
`dist/` 必须在 `files` 里：`cortico.webUiClient` 声明了它，漏了的话装到 Coo 里点面板是一片空白（`publish-check` 会拦）。

---

## 4. 发

```powershell
npm publish --otp 123456
```

**这是首发**（`cortico-world-fun` 在 npm 上还是 404），所以不需要 `--access public`
（那是作用域包 `@you/xxx` 才要）。`latest` 会从无到 **0.1.0**。

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

Action 平时每 30 分钟扫一次，GitHub 定时任务常推迟。想立刻进，去索引仓开一个 `[同步]` issue：

<https://github.com/Pal-AI-Lab/cortico-extensions/issues/new>

```
标题：[同步] cortico-world-fun
正文：package: cortico-world-fun
```

**发完就开一个**，别等 Action 自己那一趟（0.2.0 那次没开，等了几天）。

---

## 6. 截图（唯一还缺的东西）

1. 装好插件、重启 Coo，世界页开「娱乐时间」
2. 面板截一张（能看到「正在逛」徽章和场所数最好）
3. 存成 `assets/screenshot-1.png`（每张 ≤2MB，最多 8 张）
4. `package.json` 的 `cortico` 块里加 `"screenshots": ["assets/screenshot-1.png"]`
5. 截图改了就必须**发新版本**——市场按版本扫包

> 0.1.1 起**有面板页了**（`dist/webui.js`，两张：去哪儿 / 纪念册），所以现在能截：
> Coo 世界页的「娱乐时间」卡片、**「去哪儿」面板**（十二处 + 正在逛那条）、**「纪念册」面板**、配置页。

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
- `high-cost` — 6 个工具，一天用不了几次。

如果以后加了面板页、或者开始维护跨趟的记忆，`internal-state` 就该照实声明。

---

## 认证（以后再说）

要求全部满足才给盾牌：没有错误标签、版本表现稳定、**World 不直接依赖其他 World**、
**至少有过一次后续更新**。最后一条意味着至少要发两个版本才能申请。

本插件在「不依赖其他 World」这条上是干净的：不调别人的工具、不读别人的状态/日程，
素材库**完全不读**，`scene` 只是条目上的字符串。

申请：开一个 `[认证] cortico-world-fun` issue，正文 `package: cortico-world-fun`。

---

## 之后发新版本

```powershell
# 1. 改代码
# 2. 更新 CHANGELOG.md（市场按 ## 标题切段）
# 3. npm version patch
# 4. node tools/make-describe.mjs     # 改过 ENV_PROMPT 或工具描述必须重跑
# 5. node tools/publish-check.mjs --online
# 6. npm publish --otp 123456
# 7. 想马上进市场就开 [同步] issue
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
