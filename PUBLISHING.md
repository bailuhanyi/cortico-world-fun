# 娱乐时间 0.4.3 发布准备说明

0.4.3 的范围是「旅行手账」UI 改造：统一主题层，地点册四组编辑器，去哪儿推荐主卡，纪念册票笺与心愿侧栏，纪念品架展示柜，故事工坊作品库版式与改名。**本轮只改源码、跑测试、生成 0.4.3 本地包并核验**，不发布 npm、不安装/卸载 Coo、不做市场重装、不操作真实用户数据。下面的发布流程留待人工另行确认，不构成本轮执行授权。

## 本版内容

- 统一主题层：`.fun` / `.fpl` / `.sw` 三套样式之上加一层 token（14px 圆角、Georgia 数字、纸色渐变、统一 focus ring），颜色仍走宿主主题变量，明暗两套不另写；`prefers-reduced-motion` 与 `prefers-contrast` 各有分支。未改任何类名。
- 地点册：编辑器按四组分区 + 宽屏侧边分组导航 / 窄屏横排；底部固定保存栏显示未保存、保存中、已保存；切组保留草稿。浏览页宽屏走摘要列表，窄屏回落卡片。标题改为「地点册」。
- 去哪儿：第一处推荐改成主卡（沿用 `fun-recommend-card` / `fun-recommend-name` 类名，键盘与 `aria-expanded` 行为不变），余下仍为小卡；详情与管理说明指向地点册。
- 纪念册：行程票笺（左侧日期列，窄屏转横排）；宽屏主列右侧 276px 只读心愿栏，窄屏收掉并把摘要放回主列。
- 纪念品架：跨地点展示柜网格 + 「快要逛遍的地方」进度卡片；进度统计口径、归档提示与「回看这趟行程」不变。
- 故事工坊：作品库卡片（左图右文）、「全部作品 / 内置故事 / 我的作品」筛选、宽屏右栏三个创作入口与「＋ 编写故事」主按钮；高级 JSON、校验、隔离试玩与未保存草稿保护全部保留。`地点剧情包` / `鱼的故事世界` 全部改名为「故事工坊」。
- 工具 22 个、面板 6 个、World API 6、Node >=22；没有新增工具调用、事件或存储模型变更。

## 数据与安全

- **本版没有数据迁移**：`state.json`、`venues.json`、`stories.json`、`config.json` 的字段与语义均未改动，不写新文件、不改写旧文件。升级不会动用户的地点、故事、行程与回忆。
- 仍然只有只读的面板取数：`book` / `shelf` / `places` / `locations` / `stories` 的 `list` 不写盘。
- 主持密文（`fun/story-secrets.json`）与图片来源（`fun/story-images/`）沿用 0.4.2 的保存方式，本版不涉及。
- `dist/webui.js` 必须由 `npm run build:webui` 生成，不手改；`pretest` 与 `prepack` 会自动构建。

## 离线构建和验证

在 `fun-world` 内运行。已有离线开发依赖时不安装；若缺依赖且不允许联网，应报告缺失，而不是连 registry。

```powershell
# 将临时目录和 npm cache 指向仓库内（仅当前进程环境）
New-Item -ItemType Directory -Force .tmp, .tmp/npm-cache, .tmp/release-0.4.3
$env:TEMP = (Resolve-Path .tmp).Path
$env:TMP = $env:TEMP
$env:TMPDIR = $env:TEMP
$env:npm_config_cache = (Resolve-Path .tmp/npm-cache).Path
$env:npm_config_offline = 'true'
npm test
npm run verify
npm pack --json --pack-destination .tmp/release-0.4.3 --cache .tmp/npm-cache --offline
node tools/verify-published.mjs --file .tmp/release-0.4.3/cortico-world-fun-0.4.3.tgz
Get-FileHash .tmp/release-0.4.3/cortico-world-fun-0.4.3.tgz -Algorithm SHA256
```

`npm test` 自动构建并执行全部既有回归（含面板 67 项、故事面板 41 项、地点册 10 项、自建场所 20 项、world 82 项）；`npm run verify` 检查单入口、提示词、隔离审计、冒烟和 describe 一致性。受限沙箱下 `story-config` 的 DPAPI 用例会假失败，完整权限下 7/7（已知问题）。所有操作只在仓库内执行。

## 界面验收（本轮已完成的部分）

- 真实面板 + 真实夹具数据渲染，Edge 无头，1440 与 412 两种宽度：`reports/fun-ui-proposal-20261122/R1`–`R14`，含纪念册 / 纪念品架 / 故事工坊的暗色与窄屏。逐张核对过 `document.documentElement.scrollWidth` 未超过视口。
- 未做：真实 Coo 宿主内的实际字体、滚动与交互验收（需要人工在宿主里点一遍）。

## 后续人工实机验收（本轮未执行）

真实 Coo 的面板渲染、412px 下的实际滚动、暗色宿主主题、真实长行程与多纪念品数据的观感，需要在人工授权的宿主环境中另行验收。DOM 测试与静态渲染不能替代这一项。

## 后续人工发布（本轮禁止执行）

另行确认后，人工先查询 registry 确保 0.4.3 未占用，再按已核对 SHA256 的 tgz 发布。发布后另行验证 registry 包并确认市场同步；安装、重启 Coo 和用户数据备份均由人单独决定。本轮不会执行 npm view/publish、市场操作或任何装机步骤。

历史发布记录见 `docs/history/`。当前本地验证详情见 `HANDOFF.md` 与本票执行日志。
