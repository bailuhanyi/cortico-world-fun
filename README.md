# 娱乐时间（cortico-world-fun）

给 Coo（Coopanion）桌宠**十二处真能去逛的地方**：游乐场、海洋馆、庙会、漫展、电影院、动物园、公园、电玩城、KTV、博物馆、猫咖、爬山。

她一直「有地方可去，但没有真的去成」：发动态、刷视频、逛客厅都是零碎的，没有一趟**有头有尾**的出门。这个 World 补的就是这一趟：

- `fun_places` 看今天哪几处开着、人多不多（按开放时段和拥挤度排，不是随机给）；
- `fun_go` 进门，回执是进门那一下看到的样子和这一处能逛什么；
- `fun_wander` 一处一处地逛：过山车、鲸豚湾、捞金鱼、同人展台；顺手能买纪念品、拍张照；
- `fun_home` 收摊，回执把这一趟收成一句话，**交给她 `feast_life_play` 记进自己的日程**，并告诉生图该填哪个场景名。

十二处场所、每处 5–8 个可逛的项目、纪念品、拍照点和随机小事件都是**内置**的，装完就能用，不依赖任何别的扩展。

## 装

先把 Coo **完全退出**，然后：

```powershell
# 预演
powershell -ExecutionPolicy Bypass -File .\install.ps1 -CooRoot "E:\Coopanion" -DryRun

# 真装
powershell -ExecutionPolicy Bypass -File .\install.ps1 -CooRoot "E:\Coopanion"
```

装完重启 Coo，面板 → 世界 →「娱乐时间」应为 `active`，配置页有 3 项。

## 它和别的 World 是怎么联动的

**不调别的 World 的工具、不读别人的状态或日程文件**（World 契约的红线）。联动借的是 `IMGGEN-联动方案.md` 那套思路，但**不绑定它的素材库**：

1. **共享文件约定（能对上就用，对不上就不提）**：十二处里只有四处（游乐场 / 海洋馆 / 庙会 / 漫展）在 `imggen-library/scenes/` 里有对应场景，那四处的收摊回执会说「`scene` 填「X」」。另外八处素材库里没有，回执就明说「`scene` 不用填」——**绝不替她编一个库里没有的名字**（那会提示「库里没找到」，那一项等于白填）。
   这个 World **完全不读**那个库，`scene` 只是条目上的一个字符串。
2. **提示词各写一句指向对方**：本插件 `ENV_PROMPT.md` 里指向 `feast_life_now` / `feast_life_play` / `imggen_draw`；鱼的每一天那边靠 `lifeFreeMenu` 加一行。
3. **鱼的每一天官方预留的 `lifeFreeMenu` 配置槽**：改一个配置值（不是代码），她就进得了「自己的时间」。

```
娱乐时间 ──「出门前/逛完查 feast」──→ 鱼的每一天
鱼的每一天 ──「lifeFreeMenu 列 fun_*」──→ 娱乐时间
娱乐时间 ──「有对应场景时，发图填这个名字」──→ 生图工作室（可选）
鱼的每一天 ──（0.7.1 已有）──→ 生图工作室
```

她**自己在同一回合里**把这些串起来，不是代码替她填参数。**没装生图工作室也照常能逛**——只是少了发图那一句。

## 配置（`worlds.fun`，只有 3 项）

| 键 | 默认 | 管什么 |
|---|---|---|
| `funOn` | `true` | 总开关。关掉=不注入场所清单，工具和面板照旧可用 |
| `funSessionTTLMin` | `90` | 一趟挂多久就不再算「正在逛」；**不会催她收摊，也不替她记** |
| `funAskReport` | `true` | 收摊回执要不要提醒她 `feast_life_play` 记一笔、跟主人说一句 |

**没有「叫醒档位」这类配置**，这个 World **不推任何事件**。她什么时候出门，由「鱼的每一天」的 `lifeFreeSlots` 叫醒时那一行 `lifeFreeMenu` 顺手一提，或者她自己 `fun_start`——两套叫醒会互相抢时间轴，那是方案 B 的事。

## 工具

| 工具 | 用途 |
|---|---|
| `fun_places` | 今天能去哪儿（开放时段 / 拥挤度 / 刚去过的地方排后面）；`all: true` 列全十二处，`kind` 只看一类 |
| `fun_go` | 进门（`place` 填地方名，别名也认） |
| `fun_wander` | 逛一处（可选 `buy` 买纪念品、`photo` 拍照点；不是这处的东西会被拦下） |
| `fun_home` | 收摊，把这一趟收成一句话 |
| `fun_start` | 不等叫醒，现在就想出门 |
| `fun_view` | 纪念册：以前逛过哪些趟 |

## 自己验

```powershell
node test/venues.test.mjs
node test/state.test.mjs
node test/world.test.mjs
```

（不要用 `node --test`：在某些受限沙箱里它要 spawn 子进程，会被 EPERM 挡住。）

## 配套的两个脚本

都**默认预演**，加 `--write` 才落盘；都是幂等的，跑两遍结果一样。

```powershell
# D 补库：scenes/ 加「游乐场」「漫展」，神社补「庙会/夏日祭/夏夜祭」
node tools/apply-library.mjs --root "E:\Coopanion\data\home\companion\data\imggen-library"
node tools/apply-library.mjs --root "…" --write

# 鱼的每一天：lifeFreeMenu 补一行 fun_*（改配置值，不是改代码）
node tools/patch-lifeFreeMenu.mjs --config "E:\Coopanion\data\home\companion\config.json"
node tools/patch-lifeFreeMenu.mjs --config "…" --write
```

`apply-library.mjs` 里 `水族馆` 那条会报「别名齐了，跳过」——它的别名里**本来就有**「海洋馆」，定稿文档里那句「补别名」落地时发现已经补过了。

**这两步都已在本机实跑过**（`--write`，2026-11-15）：场景 14 → 16，神社别名补齐，`lifeFreeMenu` 追加了「出门逛逛」那一行，各带一份 `.bak-fun-*` 备份。

## 降级

库挪走了、鱼的每一天没装、生图工作室没装、甚至 `funOn` 关着：

- **逛照常**：十二处场所库是内置的，`fun_go` / `fun_wander` / `fun_home` 全都不依赖外部文件；
- **日程照常、生图照常**：收摊回执里那两句话只是提醒，她不做也没人管；素材库里没有的场所连 `scene` 都不会提；
- **绝不报错、绝不卸载任何 World**：`envPromptVars()` 全程 try/catch，工具内部异常兜成 `failed: true`。

## 卸载

删掉 `data\extensions\node_modules\cortico-world-fun`（链接）和 `data\extensions\vendor\cortico-world-fun`（真身），
把安装时生成的 `package.json.bak-*` / `config.json.bak-*` 改名回去；或手动从两份 JSON 里删掉 `fun`。
`lifeFreeMenu` 里那一行手动删掉即可（不删也只是指向一堆不存在的工具，她会自己跳过）。

## 许可

MIT。
