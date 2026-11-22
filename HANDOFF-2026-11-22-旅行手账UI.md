# 旅行手账 UI · 完成记录（2026-11-22）

## 0. 一句话

「旅行手账」UI 改造**做完了**：六个面板统一主题层，地点册四组编辑器，去哪儿推荐主卡，纪念册票笺 + 心愿侧栏，纪念品架展示柜，故事工坊作品库版式，品牌名统一成「故事工坊」。`npm test` 与 `npm run verify` 全绿，版本升到 0.4.3，本地包已生成并核验。**发布、装本机 Coo、市场重装都还没做**，要另行同意。

## 1. 现在的四份东西

| 位置 | 状态 |
|---|---|
| 源码 `E:\deep seek\fun-world` | **0.4.3**，已本地提交（未推送） |
| 本地包 `story-world\artifacts\release-0.4.3\` | **0.4.3**，tgz + 群友包，已核验 |
| 本机 Coo `E:\Coopanion` | **0.4.3**（18:35 安装并重启，宿主已提供新 bundle） |
| 旧的群友包 `release-0.4.2\` | 0.4.2（改造前），原样保留 |

## 2. 做了什么

### 2.1 统一主题层（`webui/webui.js` 末尾）

在 `.fun` / `.fpl` / `.sw` 三套样式之上加一层「旅行手账」token：圆角 14px、Georgia 数字、纸色渐变、统一 focus ring、`prefers-reduced-motion` / `prefers-contrast` 分支。**没有改 DOM 契约**，所有既有类名保留。

### 2.2 地点册（`webui/places/webui.js`）

- 浏览页：宽屏 `.fpl-row-list` 摘要列表（`listRow()`），窄屏回落 `.fpl-tile` 卡片；两套都渲染，CSS 切显隐。
- 编辑器：四组 `.fpl-editor`（基础资料 / 游玩内容 / 画风与封面 / 地点关联），侧边 `.fpl-editnav` 导航、窄屏横排；底部 `.fpl-savebar` 固定保存栏，带「有未保存的修改 / 还没有改动」提示。
- 草稿：`editorValues()` 比对载入值 vs 当前值，切组不丢内容。
- 标题：`地点图鉴` → `地点册`。

### 2.3 去哪儿（`webui/webui.js`）

- 第一处推荐做成主卡 `.fun-hero`（左文右图），沿用 `fun-recommend-card` / `fun-recommend-name`，键盘与 `aria-expanded` 契约不变；余下推荐仍是小卡。
- 详情与管理说明指到「地点册」。

### 2.4 纪念册（`webui/webui.js`）

- 行程票笺：左侧 `.fun-ticket-date` 日期列（日 / 年月 / 进门时间），右侧 `.fun-ticket-main`；窄屏日期转横排（并隐藏重复的进门时间）。
- **宽屏侧栏**：`.fun-with-rail` 主列 + 276px `.fun-rail`「下次想去」——只读显示第一个心愿的缘由与类型 chip、`另外还记着 N 个心愿`，底下一句「心愿只作提醒。什么时候出门，由她决定。」；窄屏（<960px）收掉侧栏，`.fun-wish-summary` 摘要回到主列。
- 统计条挪到页签上方（和方案一致）；窄屏统计改三列，不再挤成 4+1。
- 空册子仍然保留页签——心愿是第一件能记下的事。

### 2.5 纪念品架（`webui/webui.js`）

- 展示柜 `.fun-shelf-cabinet`：跨地点、按带回日期排开，一格一件——线稿、名称、`来自哪里 · 哪天`、`收藏 N 次`；点开仍是真实关联行程、归档提示与「回看这趟行程」。
- 原来的「按地方归着」分块改成一行计数 chip（`海洋馆 1 样`），信息不丢、版面不占。
- 「快要逛遍的地方」改成进度卡片网格（`.fun-progress-grid`），还差哪些仍逐项写出。
- 服务端 `items` 优先；老夹具只有 `byPlace` 时自动摊平并补 `placeName`。

### 2.6 故事工坊（`webui/stories.js`）

- 标题条：kicker「故事 · 写在地点上的小篇」+ `故事工坊` + 说明，右侧「＋ 编写故事」主按钮。
- 版式 `.fun-story-layout`：宽屏 `主列 + 276px 右栏`，窄屏（<1000px）收掉右栏。
- 作品卡 `.fun-story-pack`：左边 132px 是该地点原创线稿（`venueArtwork(pack.placeId)`），右边标题、内置/启用徽章、元信息、简介、操作；窄屏线稿转横条（74px 高）。
- 页签「全部作品 / 内置故事 / 我的作品」：只重画列表，不重建创作区、不清 JSON 草稿，`aria-pressed` 同步。
- 右栏「从一个小片段开始」：新建选项式故事 / 新建自由场景包 / 导入完整 JSON，各接到已有动作（`setAuthorMode` + `setExpanded` + `advanced.open`）。
- 改名收尾：`地点剧情包` / `鱼的故事世界` → 故事工坊；`地点与故事` → `作品库`；`回忆` → `行程回忆`。

## 3. 验收

真实面板 + 真实夹具（`reports\fun-ui-proposal-20261122\`，Edge 无头）：

| 图 | 内容 |
|---|---|
| `R1`–`R5` | 六个面板 1440 浅色 |
| `R6` | 地点册暗色 |
| `R7`–`R11` | 去哪儿 / 地点册 / 纪念册 / 纪念品架 / 故事工坊 412 窄屏 |
| `R12`–`R14` | 纪念册 / 纪念品架 / 故事工坊 1440 暗色 |

14 张都核过 `document.documentElement.scrollWidth ≤ innerWidth`（1440 下 1425/1440 是滚动条宽度）。逐张看过：暗色下新卡片、侧栏、展示柜都跟着宿主变量走，线稿在暗色里不再是白底。

## 4. 验证现状

- `npm test` 通过（`panels` 67/67、`story/webui` 41/41、`place-library` 10/10、`user-venues` 20/20、`world` 82/82）。
- `npm run verify` 全部通过，`describe.json` 与代码一致。
- `node tools/verify-published.mjs --file .tmp/release-0.4.3/cortico-world-fun-0.4.3.tgz` 通过（45 个文件、22 处预设、六面板取数、单文件入口）。
- 受限沙箱下 `story-config` 的 DPAPI 用例假失败；完整权限下 7/7（已知问题，见旧交接 §6）。

## 5. 坑（这两轮踩到的）

- **不要在 `.fun-*` 里再用同名按钮文案**：列表行曾用「编辑地点」，与详情页按钮重名，`findByText` 命中错的那个。改成「编辑这处」后恢复。这次加「＋ 编写故事」时特意带前缀，避免与空态里的「编写故事」按钮撞名。
- **测试桩不支持 `removeAttribute` / `dataset` / `closest`**：编辑器切组用 `panel.hidden = ...`。
- **测试桩 `querySelectorAll` 不支持后代选择器**：`.fun-rail .fun-wish` 这种写法在桩里永远匹配不到。这一轮的侧栏全用单类名，没有用后代选择器；面板代码本身也没用它。
- **空册子要保留页签**：把页签挪进主列后，空册子提前 return 会把「心愿」页签也吞掉，四条心愿测试直接超时。现在空态先画页签再画空提示。
- **`.fun-stories` 里没有 `--f-card`**：原创线稿用的是 `var(--f-card,#fbfbfb)`，故事面板没定义这个变量，暗色下线稿会是刺眼的白底。在 `.fun-story-cover` 上补了 `--f-card: color-mix(...)` 与 `color`，明暗都跟着走。
- **改结构时同步改测试断言**：`shelf` 里两条 `waitFor(.fun-trip > N)` 是把「按地方分块」当锚点，分块没了就等不到。改成等 `.fun-keepsake` / `.fun-progress-card`，断言更贴近现在的结构。
- **Edge 无头截图需要完整权限**：受限沙箱下 `OpenProcess: 拒绝访问`，启动不了浏览器。渲染脚本 `reports/fun-ui-proposal-20261122/render-real.mjs`。

## 6. 预览怎么看

`reports\fun-ui-proposal-20261122\`：

| 文件 | 内容 |
|---|---|
| `preview-real.html` | **真实面板 + 真实数据**，六个面板可切换、可切明暗 |
| `panel-*.html` | 单面板直开，方便截图 |
| `R1`–`R14*.png` | 真实渲染图（桌面 / 暗色 / 412 窄屏） |
| `preview.html` | 早期的纯设计稿（非真实面板，留着对比） |
| `UI优化方案.md` | 完整方案文档 |
| `fixtures.mjs` / `build-real.mjs` / `render-real.mjs` | 夹具生成（含两个真心愿）、页面构建、截图脚本 |

预览数据由 `fixtures.mjs` 用临时目录跑真实 `FunWorld` 生成（3 趟行程、2 个心愿、1 个自建地点），**不碰任何用户数据**。

## 7. 新对话开场

> 读 `E:\deep seek\fun-world\HANDOFF.md`。「旅行手账」UI 改造已完成，源码 **0.4.3**（已本地提交（未推送））、`npm test` 与 `npm run verify` 全绿，`story-world\artifacts\release-0.4.3\` 的 tgz 与群友包已核验，本机 Coo 已装 **0.4.3** 并重启（宿主 serving 的 bundle 与构建产物 SHA-256 一致）。还没做：发布 npm、卸载 / 市场重装——都要先明确同意。下一步通常是：在 Coo 里逐个面板点一遍实机验收 → 确认后发布 npm。
