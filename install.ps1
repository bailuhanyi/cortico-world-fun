# install.ps1 ---- 把「娱乐时间」装进 Coo（Windows）
#
# 用法：
#   powershell -ExecutionPolicy Bypass -File .\install.ps1 -CooRoot "E:\Coopanion"
#   预演：... -DryRun      只打印会做什么，不写任何文件
#
# 做的事：
#   1. 校验 CooRoot 是 Coo 目录
#   2. 检查 Coo 没在运行（它会在内存里改写 config.json）
#   3. 备份 data\extensions\package.json 和 companion\config.json
#   4. 复制到 data\extensions\vendor\cortico-world-fun，再建 node_modules 下的 junction
#   5. 在 data\extensions\package.json 登记 file: 依赖
#   6. 在 data\home\companion\config.json 建 worlds.fun（只补缺的键，不动别的）
#   7. 写回自检（无 BOM、可解析）
#
# 注意：本文件必须以「UTF-8 with BOM」保存，否则 Windows PowerShell 5.1 会按 GBK 读中文乱码。

[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$CooRoot,
  [Alias('DryRun')][switch]$WhatIf,
  [switch]$SkipRunningCheck
)

$ErrorActionPreference = 'Stop'
$SelfDir = $PSScriptRoot
$PluginDir = $SelfDir
$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)

function Say($msg) { Write-Host $msg }
function Die($msg) { Write-Host "X $msg" -ForegroundColor Red; exit 1 }
function WriteJsonNoBom($path, $text) { [System.IO.File]::WriteAllText($path, $text, $Utf8NoBom) }

# ---------- 0. 读元数据 ----------
$metaPath = Join-Path $PluginDir 'package.json'
if (-not (Test-Path $metaPath)) { Die "找不到 $metaPath" }
$meta = Get-Content $metaPath -Raw -Encoding UTF8 | ConvertFrom-Json
if ($meta.name -ne 'cortico-world-fun') { Die "包名不对：$($meta.name)" }

# ---------- 1. 校验 Coo ----------
if (-not (Test-Path $CooRoot)) { Die "CooRoot 不存在：$CooRoot" }
$hasApp = Test-Path (Join-Path $CooRoot 'resources\app')
$hasExe = Test-Path (Join-Path $CooRoot 'Coopanion.exe')
if (-not ($hasApp -or $hasExe)) { Die "$CooRoot 看起来不是 Coo 的安装目录" }

$cooExtDir = Join-Path $CooRoot 'data\extensions'
$vendorDir = Join-Path $cooExtDir 'vendor'
$destDir = Join-Path $vendorDir 'cortico-world-fun'
$linkDir = Join-Path $cooExtDir 'node_modules\cortico-world-fun'
$extPkg = Join-Path $cooExtDir 'package.json'
$companionCfg = Join-Path $CooRoot 'data\home\companion\config.json'
$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

$pluginPath = (Resolve-Path $PluginDir).Path.TrimEnd('\')
$vendorPath = $destDir.TrimEnd('\')
if ($pluginPath -ieq $vendorPath) { Die "当前目录就是已安装的扩展本体，别自己装自己。" }

Say "插件版本     : v$($meta.version)"
Say "Coo 安装目录 : $CooRoot"
Say "扩展本体     : $destDir"
Say "node_modules : $linkDir（junction）"
Say "配置写入     : $companionCfg"

# ---------- 2. 检查是否在运行 ----------
if (-not $SkipRunningCheck) {
  $running = Get-Process -Name 'Coopanion' -ErrorAction SilentlyContinue
  if ($running) {
    Say ""
    Say "!!  Coo 可能还在运行（PID $($running.Id -join ',')）。"
    Say "    请先完全退出 Coo 再装，脚本才能确保改的是真文件；确认已退出可加 -SkipRunningCheck。"
    exit 2
  }
}

# ---------- 3. 备份 ----------
if ($WhatIf) {
  Say "[DryRun] 会备份 package.json / config.json 为 .bak-$stamp"
} else {
  if (Test-Path $extPkg) { Copy-Item $extPkg "$extPkg.bak-$stamp" -Force; Say "已备份 $extPkg.bak-$stamp" }
  if (Test-Path $companionCfg) { Copy-Item $companionCfg "$companionCfg.bak-$stamp" -Force; Say "已备份 $companionCfg.bak-$stamp" }
}

# ---------- 4. 复制到 vendor + junction ----------
$skipTop = @('node_modules', '.git', '.tmp', 'test', 'backups', '*.bak*')
if ($WhatIf) {
  Say "[DryRun] 会复制 $PluginDir -> $destDir（排除 test/node_modules/.git），再建 junction"
} else {
  New-Item -ItemType Directory -Path $vendorDir -Force | Out-Null
  if (Test-Path $destDir) {
    $bak = "$destDir.bak-$stamp"
    Say "已存在旧版本，先改名备份：$bak"
    Move-Item $destDir $bak
  }
  New-Item -ItemType Directory -Path $destDir -Force | Out-Null
  $items = Get-ChildItem -Path $PluginDir -Force | Where-Object { $_.Name -notin $skipTop -and $_.Name -notlike '*.bak*' }
  foreach ($it in $items) { Copy-Item -Path $it.FullName -Destination $destDir -Recurse -Force }
  Say "已复制到 $destDir（$(@($items).Count) 个顶层项）"

  if (Test-Path $linkDir) {
    $linkItem = Get-Item $linkDir -Force
    $isLink = ($linkItem.LinkType -ne $null) -and ($linkItem.LinkType -ne '')
    if ($isLink) {
      & cmd /c rmdir "$linkDir" 2>$null | Out-Null
      if ([System.IO.Directory]::Exists($linkDir)) { [System.IO.Directory]::Delete($linkDir, $false) }
    } else {
      Move-Item $linkDir "$linkDir.bak-$stamp" -Force
    }
  }
  New-Item -ItemType Junction -Path $linkDir -Target $destDir | Out-Null
  Say "已建立链接：$linkDir -> $destDir"
}

# ---------- 5. 登记依赖 ----------
if (-not (Test-Path $extPkg)) {
  if (-not $WhatIf) { WriteJsonNoBom $extPkg '{"name":"extensions","private":true,"version":"1.0.0","dependencies":{}}' }
}
if ($WhatIf) {
  Say "[DryRun] 会在 $extPkg 的 dependencies 里加 `"cortico-world-fun`": `"file:$destDir`""
} else {
  $pkg = Get-Content $extPkg -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not (@($pkg.PSObject.Properties.Name) -contains 'dependencies')) {
    $pkg | Add-Member -MemberType NoteProperty -Name dependencies -Value ([pscustomobject]@{})
  }
  $depPath = 'file:' + ($destDir -replace '\\', '/')
  $pkg.dependencies | Add-Member -MemberType NoteProperty -Name 'cortico-world-fun' -Value $depPath -Force
  WriteJsonNoBom $extPkg ($pkg | ConvertTo-Json -Depth 30)
  Say "已在 $extPkg 登记依赖"
}

# ---------- 6. 建 worlds.fun ----------
# 只补缺的键，已有值一律保留；enabled 显式设 true（装就是要用）。
$defaults = [ordered]@{
  enabled           = $true
  funOn             = $true
  funSessionTTLMin  = 90
  funAskReport      = $true
}
if (-not (Test-Path $companionCfg)) {
  Say "WARN 没找到 $companionCfg（Coo 还没初始化过？先启动一次 Coo 再装）"
} elseif ($WhatIf) {
  Say "[DryRun] 会在 $companionCfg 的 worlds.fun 里补缺失键并设 enabled=true（已有值保留）"
} else {
  $cfg = Get-Content $companionCfg -Raw -Encoding UTF8 | ConvertFrom-Json
  if (-not (@($cfg.PSObject.Properties.Name) -contains 'worlds')) {
    $cfg | Add-Member -MemberType NoteProperty -Name worlds -Value ([pscustomobject]@{})
  }
  if (@($cfg.worlds.PSObject.Properties.Name) -contains 'fun') {
    $sec = $cfg.worlds.fun
  } else {
    $sec = [pscustomobject]@{}
    $cfg.worlds | Add-Member -MemberType NoteProperty -Name fun -Value $sec
  }
  foreach ($k in $defaults.Keys) {
    $has = @($sec.PSObject.Properties.Name) -contains $k
    if (-not $has) { $sec | Add-Member -MemberType NoteProperty -Name $k -Value $defaults[$k] -Force }
  }
  $sec | Add-Member -MemberType NoteProperty -Name enabled -Value $true -Force
  WriteJsonNoBom $companionCfg ($cfg | ConvertTo-Json -Depth 60)
  Say "已写入 worlds.fun（缺失键已补，已有值保留）"
}

# ---------- 7. 写回自检 ----------
if (-not $WhatIf) {
  foreach ($f in @($extPkg, $companionCfg)) {
    if (-not (Test-Path $f)) { continue }
    $bytes = [System.IO.File]::ReadAllBytes($f)
    $hasBom = ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF)
    $parseOk = $true
    try { Get-Content $f -Raw -Encoding UTF8 | ConvertFrom-Json | Out-Null } catch { $parseOk = $false }
    if ($hasBom -or -not $parseOk) { Say "FAIL $f（BOM=$hasBom，可解析=$parseOk）" } else { Say "OK   $f（无 BOM、可解析）" }
  }
}

Say ""
Say "下一步（这三步是联动的另一半，脚本不会替你自动做）："
Say "  1) 重启 Coo（完全退出再打开），面板 → 世界 →「娱乐时间」应为 active"
Say "  2) 补素材库场景：node tools/apply-library.mjs --root <素材库> --write"
Say "  3) 鱼那边加一行：node tools/patch-lifeFreeMenu.mjs --config <config.json> --write"
Say ""
Say "不想要了：删 $linkDir 和 $destDir，把 *.bak-$stamp 改名回去，并从两份 JSON 里删掉 fun。"
