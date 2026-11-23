# 共同决定（两席同票）规格

写于 2026-11-23。这份文档是「谁可以投、什么时候前进」的**唯一依据**：代码里的
`src/joint.js` 按它实现，`test/story-text.test.mjs` 的矩阵用例按它断言。改规则先改这里。

- 适用范围：`version: 2`、`metadata.participation: "duo"` 的故事包中 `actor: "joint"` 的节点。
- 不涉及：单人故事、`owner` / `fish` 节点的回合归属（那两套规则没变）。
- 相关代码：`src/joint.js`（纯函数）、`src/world.js`（`#choiceTool` / `#textVoter` /
  `#textStaticPayload`）、`src/story-panel.js`（`describeStoryTrip`）、`src/story-read.js`
  （`fun_story_current`）、`webui/story/panel.js`（只读 `trip.joint`）。

---

## 1. 状态形状

一趟行程的待选择存在 `outing.pendingChoice`，共同决定相关的字段：

| 字段 | 类型 | 含义 |
|---|---|---|
| `id` | string | 这一步的 choiceId，形如 `story:<packId>:<revision>:<nodeId>` |
| `event` | string | 这一步发生了什么 |
| `area` | string | 所在区域（可空） |
| `prompt` | string | 给两席看的提问 |
| `options` | `{id,label,result}[]` | 2–4 个合法选项；`id` 只在本文范围内有效 |
| `actor` | `'owner' \| 'fish' \| 'joint'` | 本步归属；共同决定恒为 `'joint'` |
| `jointResolution` | `'require-agreement' \| 'owner-final' \| 'fish-final'` | 异票时怎么办；由故事包 `metadata.jointResolution` 写入 |
| `votes` | `{ owner?: optionId, fish?: optionId }` | 两席各自的票；没有键 = 这一席还没投 |

归一化（`src/state.js:263-274`）的硬约束：

- `votes` 只保留**同时满足**「键是 `owner` / `fish`」且「值是本步 `options` 里的合法 id」的项；
  其余静默丢弃（脏数据、旧版本残留都不会让判断抛错）。
- `jointResolution` 只接受上表三个值；缺失或非法时**不写这个键**。读取侧（`joint.js`）把缺失
  视为 `require-agreement`，不再像 0.7.6 之前那样隐式按 `fish-final` 前进。
- `options` 为空或 `id` / `event` 缺失时整个 `pendingChoice` 被丢弃。

对外（面板 / 只读查询）另外给三个派生字段，服务端算好，面板不再自己算：

| 字段 | 含义 |
|---|---|
| `trip.actor` | 这一步「该提示谁」：`'owner'` / `'fish'`；`null` 表示不是双人故事 |
| `trip.jointVotes` | `votes` 的副本（仅 joint 步） |
| `trip.jointResolution` | 本步 resolution（仅 joint 步） |
| `trip.joint` | `jointView()` 的输出：`stage` / `seat` / `canVote` / `seats` / 文案（仅 joint 步） |

`trip.actor` 是**提示**，不是权限；权限只看 `trip.joint.canVote`（服务端同源函数
`jointCanVote`）。两者在同一步里可能不同：空票面时 `actor` 是 `owner`（聊天默认主人在说话），
但两席都能先投。

---

## 2. 阶段与迁移

`stage = jointStage(pending)`，只有五个值（非 joint 步返回 `null`）：

| stage | 票面 | 谁还可以投 |
|---|---|---|
| `empty` | `{}` | 两席都可以（**先投顺序不限**） |
| `waiting-owner` | `{ fish }` | 只有 `owner` |
| `waiting-fish` | `{ owner }` | 只有 `fish` |
| `disagree` | `{ owner, fish }` 且不同 | 两席都可以改自己那一票 |
| `agreed` | `{ owner, fish }` 且相同 | 都不投；提交即前进（事务内瞬态） |

迁移表（一行一个动作）：

| # | 动作 | 前置 | 结果 | 票面变化 | 给用户的文案要点 |
|---|---|---|---|---|---|
| 1 | 任一席投第一票 | `stage = empty`，`seat ∈ {owner, fish}`，`optionId` 合法 | `waiting-owner`（鱼先投）或 `waiting-fish`（主人先投）；`ok: true` | 写入该席一票，另一席仍空缺 | 「你的选择已保存（X）。现在等对方自己投那一票」 |
| 2 | 缺的那一席投第二票，两票相同 | `waiting-*` 且 `seat` 正是缺的那一席 | `agreed` → **前进**；`pendingChoice` 清空 | 补上第二票后整步结束 | 「选择已确认：X」 |
| 3 | 缺的那一席投第二票，两票不同，`require-agreement` | 同上 | `disagree` → **不前进**，两票都留 | 补上第二票；谁都不清 | 「两边票不一样（你：X / 鱼：Y）：这一轮不前进，也不清掉任何一席的票」 |
| 4 | 缺的那一席投第二票，两票不同，`owner-final` | 同上 | **前进**，按 `owner` 那一票 | 补齐后整步结束，记录两票 | 「选择已确认：X。」（同票走同一条回执；取哪一票由 resolution 决定，测试钉住） |
| 5 | 缺的那一席投第二票，两票不同，`fish-final` | 同上 | **前进**，按 `fish` 那一票 | 同上 | 「选择已确认：Y。」（同上） |
| 6 | 只有一票时，**另一席**抢先投 | `waiting-*` 且 `seat` 不是缺的那一席 | **拒绝**（`ok: false`，`failed: true`） | 不变 | 「鱼/你那一票已经记下了（X）；这一步等你/鱼自己投」 |
| 7 | 异票时任一席改自己那一票 | `disagree`，只改自己这一席 | 改完仍不同 → 仍是 `disagree`；改到相同 → `agreed` 并前进 | 只替换该席的票，另一席不动 | 「两边票不一样…谁都可以改自己那一票」 |
| 8 | `skip` | 任何 joint 状态 | **拒绝** | 不变 | 「共同选择不能用略过代替双方决定」 |
| 9 | 非法 `optionId` | 任何 joint 状态 | **拒绝**，回选项清单 | 不变 | 事件与选项清单 |
| 10 | `substitute: true`（替一席代投） | 任何 joint 状态 | **拒绝** | 不变 | 「共同决定要两席各投自己那一票，不能由一席代投」 |
| 11 | 非法/缺失 `seat` | 任何 joint 状态 | **拒绝** | 不变 | 「共同选择需要用户或鱼分别提交有效选项」 |
| 12 | `close`（先回家） | 任何 joint 状态，含异票僵住 | 结束行程，按已发生片段收尾 | 不适用（不再有 pending） | 「按已经发生的片段结束这一趟」 |
| 13 | 读取（`status` / `fun_story_current` / 回执） | 任何 | 不修改任何东西 | 不变 | 阶段与两席票面照实给出 |

**拒绝必须是纯拒绝**：不写 `votes`、不刷 `lastAt` / `stamp`、不落 `choices`、不推事件。
矩阵测试对每一条被拒动作都断言「`stamp` 与票面完全没变」。

`close` 与 `step` 无关：异票僵住时也不挡回家（0.7.6 起有回归测试）。

---

## 3. 谁能做什么

拍板规则（2026-11-23，收窄版，**这是最终口径**）：

1. **空票面时两席都能先投**，不规定先后。聊天通道里默认把这一票记成 `owner`（主人在说话），
   鱼先开口时调用方要显式带 `as: "fish"`，否则归属会错。
2. **只剩一席没投时，只有那一席能投**（缺 `owner` = 只有主人能投；缺 `fish` = 只有鱼能投）。
   已投的那一席此时不能改票，也不能连投第二次；代投同样被拒。
3. **两票都在且不同时，两席都可以改自己那一票**，只写自己这一席，永不代投；改成一致立即前进。
4. 两票一致即前进；**等待、超时、重启都不算同意**，不会替任何一席补票。
5. 只有「合法选项 id」能成为票；`skip` 在 joint 里永远非法。

一句话：**先投不限先后；一票在面时等缺的那一席；两票不同时各自可改；一致才前进。**

`jointCanVote(pending, seat)` 就是上表的机器版：

| stage | `owner` | `fish` |
|---|---|---|
| `empty` | true | true |
| `waiting-owner` | true | false |
| `waiting-fish` | false | true |
| `disagree` | true | true |
| `agreed` | false | false |
| 非 joint / `seat` 非法 / `options` 为空 | false | false |

---

## 4. 三种 `jointResolution`

只影响「两票不同」时的结果，其余规则三种完全相同：

| resolution | 两票相同时 | 两票不同时 | 默认 |
|---|---|---|---|
| `require-agreement` | 前进 | 保持待定（`disagree`），两票都留，两席可改自己那一票 | ✅（故事包显式声明的除外） |
| `owner-final` | 前进 | 前进，取 `owner` 的票 | — |
| `fish-final` | 前进 | 前进，取 `fish` 的票 | — |

`jointResolution` 缺失（老存档 / 半截数据）按 `require-agreement` 处理：不静默拿任何一席的票
当双方共识。作者侧的校验（`src/story-packs.js`）要求 duo 包必须显式声明这个字段。

`owner-final` / `fish-final` 下 `disagree` 不会落盘：提交那一刻就前进并清空 `pendingChoice`。
`jointStage` 仍会在纯函数层面把「两票不同」报成 `disagree`，方便测试与文案取用。

---

## 5. 明确不做

- **不做超时判定**：没有「等太久就默认同意 / 默认取消」。时钟推进、重启、切面板都不改票。
- **不把等待当同意**，也不替任何一席补票。
- **不代投**：`substitute` 不适用于 joint（鱼那一步确实没法自己决定时也不行——那属于鱼自己的
  回合 `actor: "fish"`，不是 joint）。
- **异票不写 `choices`**：票面（`pendingChoice.votes`）本身就是记录，不额外推一条「双方意见
  不同」的选择记录；`choices` 只在整步前进时写一条 `actor: "joint"` 并带两席的 `votes`。
- **不改故事包格式 / 存储键 / 面板 id**，不做数据迁移。
- **不引入新依赖**，不重写故事引擎，不改提示词组装。

---

## 6. 已拍板的决定（写进规格，不再是待定）

1. **空票面两席都能先投**（2026-11-23 拍板，属行为变更）：删掉「空票面时只有主人能投」的
   隐含限制。聊天空票面默认 `owner`，但接受 `as: "fish"`。
2. **只剩一席没投时仍由那一席自己投**（同日收窄）：这条是对第 1 条的边界，保留 0.7.6 的
   guard——否则「等鱼自己投」就失去意义。
3. **异票不写 `choices`**（2026-11-23 拍板，保持现状）：只留票面，测试不断言 `choices` 里有
   异票条目。
4. 异票时两席都能改自己那一票（0.7.6 已生效，本次收口只是把它写进规格并集中到 `joint.js`）。

---

## 7. 单一派生

所有「阶段 / 该谁投 / 谁能投 / 给人看的文案」只从 `src/joint.js` 取：

| 使用方 | 用法 |
|---|---|
| `src/world.js#choiceTool` | `jointCanVote` 做 guard；`jointDecision` 决定前进/待定与取哪一票；文案取 `jointView` |
| `src/world.js#textVoter` | `jointActor(pending) ?? 'owner'` |
| `src/world.js#textStaticPayload` | `jointStage` / `jointActor` / `jointView` 生成回执 |
| `src/story-panel.js` | `jointActor` 写 `trip.actor`；`jointView` 写 `trip.joint` |
| `src/story-read.js` | `jointView` 写 `fun_story_current` 的 `joint` 与 `hint`（`pending.votes` / `jointResolution` 保留） |
| `webui/story/panel.js` | 只读 `trip.joint`（`stage` / `seat` / `canVote` / `seats` / 文案），不再自己比对票面 |

规范：`joint.js` 只读入参、不改 `pending`、不依赖 `this` / 时间 / 文件系统；入参缺字段
（老存档、半截数据）按「没有那一票」处理，不抛错。

---

## 8. 验收

```powershell
node test/story-text.test.mjs      # 矩阵 + 三条一致性
node test/story-stages.test.mjs    # duo owner/joint/fish/ending 那条必须原样通过
npm run build:webui                # 面板测试读 dist，先重建
node test/panels.test.mjs
```