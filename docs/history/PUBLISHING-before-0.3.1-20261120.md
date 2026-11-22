# 娱乐时间 0.3.0 发布说明

本次为**发布准备**。准备本地版本与待发布包，不代表已经上传 npm、同步 GitHub、收录市场或安装到 Coo。

## 当前版本

- 包名：`cortico-world-fun`。
- 待发版本：**0.3.0**。本轮已升版，不要再运行 `npm version` 重复升版。
- 2026-11-19 21:52（Asia/Shanghai）查询官方 npm registry：线上 `latest` 为 **0.2.1**，尚无 0.3.0。发布前应再次查询；线上状态会变化。
- 本版新增用户自填剧情包、两站路线、未完行程恢复、长期探索、检索与时间线，以及原创地点/纪念品图案。运行时 14 个工具、4 个面板，World API 6、Node >=22。
- 市场展示的更新内容在 [CHANGELOG.md](CHANGELOG.md) 的 `## 0.3.0` 中。

## 用户数据与升级

插件代码与用户数据分别存放。正常升级只替换插件包，不要复制开发夹具或删除用户数据目录。

```text
<dataDir>/fun/state.json      出游、草稿、探索、路线、收藏、心愿
<dataDir>/fun/venues.json     用户地点与预设覆盖层
<dataDir>/fun/stories.json    用户剧情与启停设置
```

用户自填为主，只附带三个可分别停用的原创剧情示例。没有剧情的自填地点仍能普通游玩。启动不写回覆盖用户剧情；同 ID 更新须明确确认。清空行程状态不删除地点和剧情配置。地图没有包含在本版中。

首次实机升级前，先在 Coo 完全退出后备份上述数据。要回退时应同时考虑恢复升级前的数据备份，不能假定旧代码能保留全部新字段。

## 发布前验证

在仓库根目录运行：

```powershell
npm run prepublishOnly
npm run verify
node tools/verify-tarball.mjs
git diff --check
```

`prepublishOnly` 按文件直接运行全部测试，最后执行在线版本占用检查。不要改为受限环境中会另起测试子进程的 `node --test`。测试数量以实际输出为准。

检查点：生成描述与代码一致；所有本地模块随包分发；没有其他 World 的运行时依赖；运行时数据、测试、工具、日志不进入 npm 包。若在线检查未完成而仅给警告，应重新核对 registry，不能把警告当成版本已确认可用。

## 实际待发布包

本轮产物位置：

```text
.tmp/release-0.3.0/cortico-world-fun-0.3.0.tgz
.tmp/release-0.3.0/artifact.json
.tmp/release-0.3.0/registry-check.json
```

`artifact.json` 记录实际压缩包的摘要、文件清单和大小。与 npm 包一起交接的外部说明是仓库中的 [HANDOFF.md](HANDOFF.md)。它不会被打入用户安装包。

如修改了包内文件，应重新生成描述、运行验证、打包并核对摘要，不能沿用旧压缩包：

```powershell
node tools/make-describe.mjs
npm run prepublishOnly
node tools/verify-tarball.mjs
npm pack --json --pack-destination .tmp/release-0.3.0 --cache .tmp/npm-cache
node tools/verify-published.mjs --file .tmp/release-0.3.0/cortico-world-fun-0.3.0.tgz
```

`verify-tarball.mjs` 校验按白名单复制出的安装形态；`verify-published.mjs --file` 解开**实际 .tgz**，检查版本、文件、工具与面板，并运行一趟出游。这两者都不等于 Coo 实机视觉验收。

## Git 与发布范围

本轮没有自动提交、推送或打标签。发布源码前应审查现有改动和新文件，特别是新的剧情、探索、路线模块与客户端文件。不要使用未经检查的 `git add -A`，也不要提交本地验证日志或缓存。

本地待发包可能没有新 Git 提交对应的 `gitHead`。不能把当前 HEAD 当作本次全部改动的提交标识。实际包以交接中的文件摘要为准；源码同步状态需独立核对。

历史发布说明已保存在 [docs/history](docs/history)，其中旧版本号、旧测试数和旧待办不是本轮发布状态。

## 正式发布

用户决定正式发布后，在已认证终端中操作。先确认目标 0.3.0 仍不存在，并核对实际压缩包的 SHA-256 与交接一致：

```powershell
Get-FileHash .tmp/release-0.3.0/cortico-world-fun-0.3.0.tgz -Algorithm SHA256
npm publish .tmp/release-0.3.0/cortico-world-fun-0.3.0.tgz
```

按 npm 的实际提示完成认证。恢复码不能当作 OTP；不要把令牌、恢复码或验证码写进文档、日志或对话。这里的命令仅供正式发布阶段使用，本轮不会执行。

## 发布后核验

```powershell
npm view cortico-world-fun@0.3.0 version
npm view cortico-world-fun dist-tags
node tools/verify-published.mjs 0.3.0
```

确认线上版本、完整包下载、运行时工具、四个面板取数与客户端导出匹配。发布后的线上包验证是独立步骤，不能用本地测试或 registry 元数据代替。

如需请求市场同步，请查看官方索引仓当前说明与模板：

- [Coo 扩展索引](https://github.com/Pal-AI-Lab/cortico-extensions)
- [当前 issue 模板](https://github.com/Pal-AI-Lab/cortico-extensions/issues/new/choose)

本文不固定旧 sync issue 的标题、格式或收录时延，也不会自动替用户提交 issue。

## 尚未完成的实机项目

Coo 实机视觉验收与市场截图仍未完成。截图必须来自真实运行界面，不使用测试 DOM 或模拟预览冒充。后续若增加包内截图或修改功能，应重新检查版本与打包。
