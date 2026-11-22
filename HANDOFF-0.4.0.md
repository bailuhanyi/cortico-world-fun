# 娱乐时间 0.4.0 · 交接（2026-11-22 上午）

> 已被 [HANDOFF-0.4.1.md](HANDOFF-0.4.1.md) 接续（额度可配、再来一段、显式代选）。这份留作 0.4.0 的背景。

给下一个对话的起点。本文件只记**当前真实状态**。

## 1. 现在是什么状态

| 项 | 值 |
|---|---|
| 源码 | `E:\deep seek\fun-world`，版本 **0.4.0** |
| 发布 | **未发布**（npm 上最新仍是 0.3.1） |
| 本机 Coo | **已安装 0.4.0 并重启加载**：`data/extensions/package.json` 里是 `link:E:/deep seek/story-world/artifacts/local-install-story.2/package`，镜像已更新到 0.4.0（面板 bundle 330,920 字节） |
| 施工前备份 | `backups/fun-world-pre-dual-20261122-101832`（src/webui/test/tools/docs + 主要配置）；镜像备份 `story-world/artifacts/coo-backup-fun-link-20261122-103950` |
| 测试 | `npm test` 32 套 / 422 条全绿；新增 `story-free` / `memory-trash` / `story-text` 三套 |
| 校验 | `npm run verify` 通过；`describe.json` 已按 22 个工具重新生成 |
| 群友测试包 | `story-world/artifacts/release-0.4.0/cortico-world-fun-0.4.0-群友测试包.zip`（含 `安装.cmd` / `install.ps1` / `安装说明.md`） |
| 改到的其它仓库 | `feed-world` 三处文档口径（GUIDE.md / README.md / STORY-QUERY-CONTRACT-F3-F5.md），**未改 feed-world 代码** |

**一句话**：双模式（选项式 + 自由场景包）、文字通道与三个开关、自由 DM 运行时、按回合身份提交、持久化的鱼自主游玩、回忆回收站、精确的「走不动」提示都已实现、跑通测试并装进本机 Coo；差发布、真实模型与群友实测。

## 2. 三个开关（`worlds.fun`）

| 键 | 默认 | 作用 |
| --- | --- | --- |
| `funStoryTextOn` | `false` | 允许文字通道开局/推进（`fun_story_start` / `fun_story_act`）。关掉时两个工具明确报未开启，只读查询不受影响；面板永远可玩 |
| `funStoryFree` | `false` | 允许 v3 场景包进入候选与开局 |
| `funStoryFreeTurns` | `40` | 自由模式单趟回合上限；与场景包 `metadata.maxTurns` 取较小值，硬上限 200 |

**为什么不能做成「只对 QQ 生效」**：`WorldHost` 不给工具调用来源，World 无法区分 QQ 与控制台。所以语义是「允许文字通道」，不是「只允许 QQ」。接 P0 时已核实过；若宿主以后加了来源字段，可以再细分。

## 3. 两个新工具

### `fun_story_start`

```
{ packId, revision, startStamp, confirm: true }
```

- 校验顺序：开关 → `confirm` → 没有进行中的故事 → `startStamp` 与当前一致 → 卡可用。开始即开一趟出门（复用 `#goTool`）。
- 返回 JSON：`tripId / stamp / mode / title / placeName / step / opening（自由模式）/ free{ turn, maxTurns } / receipt`。

### `fun_story_act`

```
{ tripId, stamp, intent: "say"|"close", say?, proposalId?, optionId?, from?, confirm? }
```

- `tripId` / `stamp` 与当前不一致：返回 `STALE` + 最新 `stamp`，不自动重试。
- **选项式**（按当前回合身份提交，内部 `as` 只由文字通道设置）：
  - 用户回合：原话包含某个选项 label（去空白后包含，反向也认）或明确序号（「选第二个」「就 2」）→ **按用户名义提交**，回执记 `owner`，`how` 写命中方式；
  - 轮到鱼（duo fish 回合）：以 `fish` 身份提交；用户没指定时，鱼用 `requestStoryDecision` 按自己角色决定；
  - 说「略过/算了/skip」→ 提交 `skip`；
  - 都不中 → 主持映射一次，返回 `needConfirm: true` + `proposalId`，**不提交**；确认后带 `proposalId` + `optionId` 再调一次；
  - 提议 10 分钟过期、进度变了就作废；
  - `step === 'move'` / `'resume'` 时会先走一步再回传新的待选项。
- **自由模式**：一次 `say` = 一回合；同一 `tripId + stamp + say` 重放返回原回执，不双推进。
- `intent: "close"` 必须 `confirm: true`；等价面板 `close`，会存回忆。

## 4. 自由模式（v3 场景包）

- 校验器：`validateStoryPack` 见到 `version: 3` 走 `validateFreePack`（`src/story-packs.js`）。字段：`premise / canon(3–12) / forbidden / cast / locations / opening / flags / counters / facts / goals / ends / beats`；没有 `start`/`nodes`；`metadata.mode` 必须是 `free`。
- 运行时：`src/story-free.js`（纯函数）。`freeTurn` 合并一回合；`parseFreeOutput` 只认 `narration(12–900) / delta / endRequest / summary(≤200)`。
- 主持契约：`requestFreeTurn` → `cognition.request`，失败或超时都返回 `{ok:false}`，不写盘；每回合最多重试 1 次（每次调用都计入 `freeCalls`，上限 `maxTurns*2+4`）。
- 四道闸：canon 每回合注入且不进可变状态；delta 白名单（未登记/类型错/越界整份拒绝，单回合 ≤8 项）；结局由 `checkEnd` 按声明式条件判定（不满足只记 `endRejected`，这一回合照常发生）；每 6 回合重写摘要（主持自己给，程序只截断到 200 字）。
- 状态：`session.storyRun.free = { turn, facts, flags, counters, summary, log(≤40), ended }`，检查点里也带 `free`；`storyRun.freeCalls` 记调用数。
- 回合上限用尽：拒绝继续 say，提示用 `close` 收尾；不自动续段。
- 结束：`ended` 后 `step` 变 `close`，`close` 时按实际发生写回忆（`describeMemory` 有 free 分支）。

## 5. 面板与作者

- 面板 `play` 识别 `current.mode === 'free'`，渲染回合日志、状态徽章（facts/flags/counters）、输入框 + 「说这一句」、「收起这一段」、`free.turn > 0` 时的「退回上一回合」（走 `rewind`，从检查点恢复 `free` 快照，额度不退）；故事卡显示「自由模式」。
- 面板 RPC 新增 `say`（`payload: {tripId, stamp, say}`），返回完整 status + `lastSay`；**不受 `funStoryTextOn` 限制**（面板本来就允许）。
- 作者视图：新增「选项式故事 / 自由场景包」切换。自由模式有结构化表单四组（作品资料 / 大方向与正史 / 人物与地点 / 状态与收尾）：正史按行填（≥3 条）、flag / counter / fact 各一个、收尾阈值与文案。保存、预览、隔离试玩都走同一套 RPC；「自由模式模板」与 JSON 编辑器保留。
- `fun_story` 工具新增 `mode` 参数；`template` 支持 `mode: 'free'`。
- **自由模式生图**：`#requestStoryImage` 遇到 v3 时用最后一条 `free.log` 的叙述 + 场景包地点描写拼 prompt（不再拿选项事件），scene 取地点名兜底；文字仍不等图片。

- **文字通道按回合身份**：`fun_story_act` 的 payload 带内部 `as`（owner/fish）。用户回合按用户原话（含「第二个」序号）替用户提交并记 `owner`；双人 fish 回合以 `fish` 提交。含糊的话仍只返回 proposal，不提交。
- **鱼自己游玩是持久偏好**：`storyRun.autoplay` 由 `mode` 写入（用户回合也先记住，不发 token）；面板 `state.autoplay` 控制开关显示，`maybeResume` 在轮到鱼、且在可见页面时自动续租约；重启后偏好仍在。
- **回忆回收站**：`story` 面板新增 `deleteMemory` / `restoreMemory` / `purgeMemory` / `emptyTrash`；`state.trash` 存完整行程快照（含 from 来源：trips 或 keepsakeTrips，最多 30 条），重启保留。面板「回忆」页每张卡有「移到回收站」，底部有回收站列表（恢复 / 彻底删除 / 清空）。纪念品账本不跟随删除，`storyCanon` 不回退。
- **被时段挡住的说明**：`storyStepBlock` 会说出下一步要去的区域几点开、当前时段、还差几次到访或时间窗未到；不再只报「不满足条件」。
- **默认预设**：故事面板「鱼自己游玩」默认开启，仍然先 start 成功再 mode。

## 6. 验证现状

- `test/story-free.test.mjs` 16 条、`test/story-text.test.mjs` 4 条、`test/memory-trash.test.mjs` 3 条、`webui/story/webui.test.mjs` 35 条；全量 `npm test` 32 套 / 422 条全绿。
- `npm run verify` 通过（6 面板单文件加载、隔离审计、describe 一致）。
- 本机 Coo：`/api/extensions` 显示 `cortico-world-fun 0.4.0 / loaded`；`/assets/extensions/cortico-world-fun/0.4.0/webui.js` 已是 330,920 字节的新面板。
- `verify-published --file` 对 `cortico-world-fun-0.4.0.tgz` 通过（安装形态 45 文件、6 面板可加载）。
- 未做：真实模型跑自由模式、群友实机安装、QQ 群并发实测、真实 ComfyUI 出图。

## 7. 测试包与安装

| 文件 | 用途 |
| --- | --- |
| `story-world/artifacts/release-0.4.0/cortico-world-fun-0.4.0-群友测试包.zip` | 发给群友：解压 → 完全退出 Coo → 双击 `安装.cmd` 填 Coo 目录 → 重开 |
| `story-world/artifacts/release-0.4.0/cortico-world-fun-0.4.0.tgz` | npm 发布 / 本地核验用；`node tools/verify-published.mjs --file <tgz>` |

群友包用 `install.ps1`（复制到 `data\extensions\vendor\cortico-world-fun` + junction + `file:` 依赖）。本机 Coo 用的是 `link:` 镜像，两条路内容同源；若要让本机与群友完全一致，可在 Coo 关闭时跑同一个 `install.ps1`。

## 8. 已知限制 / 下一步

1. **发布 0.4.0 需要明确同意**：`npm publish`、市场刷新、卸载重装都按老规矩来；本机装的是 `link:` 镜像，发布后按「卸载本地 → 市场重装」走一遍。
2. **QQ 群多人**目前只是「单一写者 + `stamp` 冲突 + `from` 归属」；「这一回合收谁的话」由主对话自己合并，程序不投票、不等待。若要更强仲裁，需要先定规则再动代码。
3. **自由模式的结构化表单**只覆盖「一个 flag / 一个 counter / 一个 fact / 一个人物 / 一个地点 / 一个目标 / 一个收尾」；更多人物、多个计数器、条件组合仍去 JSON 编辑器。表单不填 `forbidden`、`beats`、`requirements`，这些也在 JSON 里补。
4. **自由模式图片**现在只解决"提示词取哪段"；真实出图（委派主对话或直连 ComfyUI）和选项式共用同一条通道，未做真实模型/ComfyUI 验收。
5. **`fun_story_act` 的 `from`** 只进日志，不参与权限；不可逆操作（close）仍要求 `confirm: true`。
6. **自主游玩仍有每趟 20 步 / 6 次决策的预算**：持久偏好只解决"不用每次手点"，用完后仍需用户手动继续或收尾；租约现在「用过就顺延」，闲置 45 秒才过期。
7. feed-world 的 `lifeStoryOn` 语义没变：它只控制「提不提故事」，真正权限在 fun 的 `funStoryTextOn`。

## 9. 相关文档

- 设计稿：[设计-娱乐时间-双模式-QQ入口-20261122.md](<../../设计-娱乐时间-双模式-QQ入口-20261122.md>)（含实施记录与偏差）
- 改造分析：[分析-娱乐时间-自由跑团改造-20261122.md](<../../分析-娱乐时间-自由跑团改造-20261122.md>)
- 0.3.3 历史交接：[HANDOFF-0.3.3.md](HANDOFF-0.3.3.md)
- 本机安装镜像：`story-world/artifacts/local-install-story.2/package`

## 10. 新对话开场

> 读 `E:\deep seek\fun-world\HANDOFF-0.4.0.md`。源码与**本机 Coo 都已装 0.4.0**（link 镜像，已重启加载，panel bundle 330,920 字节）。功能：双模式（v1/v2 选项式 + v3 自由场景包）、三个开关、`fun_story_start` / `fun_story_act`（按回合身份提交、序号命中、鱼自己决定）、持久化的鱼自主游玩、回忆回收站、精确的「走不动」提示、自由模式结构化作者表单与生图取景。`npm test` 32 套全绿、`npm run verify` 通过。**未发布 npm**。发布/市场重装/卸载要我先明确同意；群友测试包在 `story-world/artifacts/release-0.4.0/`。下一步通常是：真实模型联调 → 群友实测反馈 → 发布并市场重装验收。
