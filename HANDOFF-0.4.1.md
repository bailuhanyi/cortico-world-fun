# 娱乐时间 0.4.1 · 交接（2026-11-22 中午）

> **下一步在 [HANDOFF-2026-11-22-地点册C.md](HANDOFF-2026-11-22-地点册C.md)**：地点册/去哪儿合并（方案 C）做到一半，源码当前不绿；本机 Coo 与群友包仍是重构前的 0.4.1。这份记录 0.4.1 已发布的全部内容。

接在 `HANDOFF-0.4.0.md` 之后。0.4.0 的内容仍然有效，这份只记**这次改了什么、验到哪、还差什么**。

## 1. 为什么有这一版

0.4.0 把「鱼自己游玩」做成了持久偏好，但每趟 20 步 / 6 次决定的额度还是写死的常量。
真实撞上时（本机 11:06 那一趟，`foldtide-reply-lite`，`budget.calls` 6/6、`steps` 9/20）
面板只给一句「自主游玩暂告一段落，额度已用完，请手动继续」，而那句话是做不到的：
鱼回合的选项用户提交不了（`#choiceTool` 拒 `submitter !== 'fish'`），所以在那个待选事件上，
唯一出口是收尾。11:10 从那份回忆**分支**出来的新一段又继承了 6/6（分支按设计保留已花预算），
一出生就没有决定额度，19 秒就收尾了。

## 2. 改了什么

| 项 | 位置 | 说明 |
|---|---|---|
| 额度可配 | `worlds.fun.funAutoSteps` / `funAutoCalls` | 默认 20 / 6（就是旧常量），上限 200 / 120；`autoLimits()` 现读配置，坏值回落默认，不会变无限 |
| 分因子的提示 | `src/story-panel.js` `#stopNote` | 步数用满、决定次数用满、同一步两次重试失败，各一句话并报数字；`view.stop` 是 `'steps' \| 'calls' \| 'attempts'` |
| 再来一段 | `StoryAutonomy.continueSegment` + RPC `segment` | 只在真走不动、且还有段数时成立；重置这一段的 `steps`/`calls`/`attempts`，`segment+1`，必须 `confirm: true`；一趟最多 `AUTO_SEGMENTS = 3` 段；没用完再点会被拒（所以双击不会白烧一段） |
| 我替她选 | `world.js` `#choiceTool` + `#fishCannotDecide` | 只在鱼确实不能决定时（`calls` 用满 / 本步两次失败 / 宿主没有 cognition）接受 `substitute: true`；回执 `substituted: true`，选择记录 `actor: owner` + `substituted: true`；`normalizeChoices` 保留这个字段 |
| 面板 | `webui/story/panel.js` / `controller.js` | 显示「N 步 · M 次决定 · 第 X 段」；`stop` 时出现「再来一段（鱼自己玩）· 还能 K 段」；鱼走不动时选项才可点，且先弹确认；额度用满后不再自动续开（不反复弹「操作未获确认」），也不反复发注定失败的 `mode` |
| 段号与计数 | `story-reliability.js` `storyBudget` | `segment` 随预算一起落盘、随检查点/分支复制；`storyBudget` 的钳位改成硬上限 200/120，否则把上限调大后旧存档会被误判 |
| 自由模式也照样续段 | `src/story-free.js` + `world.js` `#freeSegment` | 同一条 RPC `segment` 分流：`free.turnBase` 记本段起点、`free.segment` 记段号，用完只把下限抬到当前回合，回合数/日志/状态都不重置；`funStoryFreeTurns` 语义改为「每段多少回合」，调用上限按段累计；面板在说完时收起输入框、给「再来一段 · 还能 K 段」，并补了一个「先收起」（落地前自由模式中途没法结束） |
| 出游页改版（默认对话式） | `webui/story/panel.js` `playChat` / `playFree` + `styles.js` | 左边一张卡固定高度（`min(68vh,760px)`）：头、场景条（96px）、当前这一步（`.sw-play-action`，选项钉在这里）、页脚各钉住，只有 `.sw-reading[data-focus="play-reading"]` 自己滚；历史只展开最近 3 条片段 / 2 次选择，更早的用 `trackedDetails` 折成一行；右列 sticky 并在 68vh 内自滚 |
| 沉浸模式（一屏一幕） | `panel.js` `playImmersive` / `playFreeImmersive` / `historyDrawer` | 顶栏 `data-focus="immersive"` 开关（`immersive` 只存在面板会话里）；一屏只有大图 + 本回合正文 + 选项（`.sw-imm-choices`，宽屏两列）+ 底栏（回看 / 鱼自己游玩 / 回家）；历史进 `.sw-drawer` 覆盖层，`imm-history` 开合、`imm-drawer-close` 关闭 |
| 滚动位置 | `panel.js` `render()` + `playKey` | 重建前记 `scrollTop` 与「是否贴底」，重建后同一步（stamp 不变）回到原位；有新一步（stamp/片段数变）才滚到底，用户正在上翻时不抢 |

## 3. 验证现状

- **`npm test` 退 0，32 套全绿**：node 测试 31 套共 435 条（0.4.0 是 422，这次 +13），面板套件 68/68，`webui/story` 41、`webui/places` 8。`npm run verify` 通过（describe 仍是 22 个工具；`funAutoSteps`/`funAutoCalls` 已进配置 schema）。
- 新增用例：`story-panel` 3 条（额度来自设置并报原因、两次失败可代选、续段只重置本段且最多三段）、`story-stages` 2 条（配置的 1 步生效 + `segment` 需确认并落盘重启仍在；只在鱼不能决定时可代选并记 `substituted`）、`story-free` 2 条（续段只抬本段下限且最多三段；面板里显式续段并落盘）、`webui/story` 6 条（代选与续段按钮的点击链路、`stop` 时不自动重开、自由模式说完后收起输入框并给续段、对话式钉住当前步并折叠历史、刷新保留滚动位置、沉浸开关与回看抽屉）。
- **坑（给下一个 agent）**：`test/story-config.test.mjs` 的 DPAPI 用例要 `spawn` `powershell.exe` 并走管道；在受限沙箱里一定返回 `SECRET_CRYPTO`（与 fun 代码无关，单跑 `StorySecrets.save` 就能复现）。放开沙箱后 7/7 通过，所以这类失败先看是不是沙箱。

## 4. 还没做

1. **本机 Coo 已装 0.4.1（file: vendor，2026-11-22 12:16）**：用群友包里的 `install.ps1` 装的，不再是 `link:` 镜像。`data/extensions/package.json` 里是 `file:E:/Coopanion/data/extensions/vendor/cortico-world-fun`；备份是 `data/extensions/package.json.bak-20261122-121654` 和 `data/home/companion/config.json.bak-20261122-121654`。`/api/extensions` 报 `0.4.1 loaded`，`/assets/extensions/cortico-world-fun/0.4.1/webui.js` 是 351,220 字节；`panels/story/status` 返回 ok、9 条回忆、`autonomy.limit 20/6`。
   - 由此带来的变化：**改源码不会再自动出现在 Coo 里**，要重新跑一次安装（或改回 `link:` 到 `story-world/artifacts/local-install-story.2/package`，那份还是 0.4.0 的旧镜像，别再拿它当本机安装）。
   - 从本会话的 shell 直接 `Start-Process Coopanion.exe` 会立刻退出（exit 9）；用 `explorer.exe <exe>` 启动才正常。
2. **发布还没做**：`npm publish`、市场刷新、卸载重装都要等用户明确同意。发布用的 tgz 已备好：`story-world/artifacts/release-0.4.1/cortico-world-fun-0.4.1.tgz`（SHA256 `18F06C9F…3060D1`），`verify-published` 通过。
3. **文字通道仍不计这 6 次预算**：`fun_story_act` 在鱼回合直接 `requestStoryDecision`，不经过 `StoryAutonomy`，所以 QQ 侧没有这个上限（也没有「再来一段」的概念）。要不要统一，需要先定规则——统一就等于收紧 QQ 侧。
4. **自由模式的续段只用面板**：文字通道的回合说完后仍只提示「到面板点再来一段」（`fun_story_act` 没有 segment 的入口）。要不要给工具一个 `intent: 'segment'`，需要先定。
5. **沉浸模式还没在真浏览器里量过**：固定高度用 `min(68vh,760px)`，宿主面板如果很矮（或手机横屏）要实测再调；抽屉没有 Esc 关闭与焦点陷阱，只有「回到此刻」按钮；沉浸偏好在面板会话里，重开面板回到对话式。
6. 未做真实模型联调；`substitute`、选项式 `segment`、自由模式 `segment` 都只用固定决策器与面板桩验证过。
7. **视觉预览工具**：`E:\deep seek\tmp-ui-mock\` 里有 `preview.html` / `preview.js`（把 dist 里的面板用一份假快照挂起来）和 `mock.py`（三张设计示意图）。用法：在 `E:\deep seek` 起 `python -m http.server 8765`，再用 Edge/Chrome `--headless=new --screenshot` 打开 `http://127.0.0.1:8765/tmp-ui-mock/preview.html`（加 `?imm=1` 看沉浸、`&drawer=1` 看回看、`?debug` 看调用日志）。注意面板的宿主适配只认 `ctx.invoke`，`ctx.storyCall` 会被 `story-mount.js` 覆盖。

## 5. 新对话开场

> 读 `E:\deep seek\fun-world\HANDOFF-0.4.1.md`（再读 0.4.0 那份补背景）。源码 **0.4.1**：自主游玩额度移进设置（`funAutoSteps` 20 / `funAutoCalls` 6，上限 200/120）、分因子提示、显式「再来一段」×3 段（选项式与自由模式共用 `segment`）、显式代选（回执记 `substituted`）、出游页对话式 + 顶栏「沉浸」一屏一幕 + 回看抽屉。`npm test` 32 套全绿、`npm run verify` 通过。**本机 Coo 已用群友包 install.ps1 装成 0.4.1（file: vendor，12:16）**；群友包与 tgz 在 `story-world/artifacts/release-0.4.1/`。**npm 未发布**：发布、卸载重装、市场刷新都要先明确同意；下一步是等用户实测反馈，再发布并市场重装验收。
