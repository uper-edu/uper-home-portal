# 禅道 API 与证据操作参考

仅在执行相应禅道任务时读取。主文件中的模式、用户确认、当前 BUG 和动作授权约束始终适用；这里的请求示例不授予操作权限。示例中的 BUG ID 必须按当前单替换；负责人未配置时逐单取提单人；解决版本默认主干 `trunk`。

## 平台选择

本文件的命令块以 **Windows PowerShell** 为主；macOS 默认 zsh 或 bash 请使用 [macOS 操作参考](zentao-macos.md)，其中包含配置、登录、JSON-RPC、工具发现、读单、流转、下载与上传。本文的工作流核验规则和备注模板对两个平台都适用。

## 运行前配置

从项目根目录 `.zentao.local.json` 读取六项配置，格式见 [主文件配置说明](../SKILL.md#本机禅道配置)；环境变量可覆盖。该文件随仓库提交，账号密码字段保持为空；真实凭据另存于已忽略的 `.zentao.credentials.local.json` 或环境变量。产品 ID、环境按当前项目核实；负责人可留空，默认指派给当前 BUG 的提单人；解决版本默认主干 `trunk`，无需逐单填写，只有用户明确指定其他解决版本时才覆盖。实际部署版本另行核验。

```powershell
# 从项目根目录运行；文件仅解析为 JSON，不执行其中的内容。
$zentaoConfig = if (Test-Path -LiteralPath '.zentao.local.json') {
  try { Get-Content -LiteralPath '.zentao.local.json' -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop }
  catch { throw '本机禅道配置不是有效 JSON，请检查格式（不回显配置内容）' }
} else { [pscustomobject]@{} }
$zentaoCredentials = if (Test-Path -LiteralPath '.zentao.credentials.local.json') {
  try { Get-Content -LiteralPath '.zentao.credentials.local.json' -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop }
  catch { throw '本机禅道凭据文件不是有效 JSON，请检查格式（不回显内容）' }
} else { [pscustomobject]@{} }
$zentaoBase = if ($env:ZENTAO_BASE) { $env:ZENTAO_BASE } elseif ($zentaoConfig.zentaoBase) { $zentaoConfig.zentaoBase } else { 'https://zentao.uper.monite.cn' }
$mcpUrl = if ($env:ZENTAO_MCP_URL) { $env:ZENTAO_MCP_URL } elseif ($zentaoConfig.mcpUrl) { $zentaoConfig.mcpUrl } else {
  $projectMcpUrl = if (Test-Path -LiteralPath '.mcp.json') {
    (Get-Content -LiteralPath '.mcp.json' -Raw -Encoding UTF8 | ConvertFrom-Json -ErrorAction Stop).mcpServers.mcp_zentao.url
  }
  if ($projectMcpUrl) { $projectMcpUrl } else { 'https://zentao-mcp.uper.monite.cn/zentao/mcp' }
}
$zentaoAccount = if ($env:ZENTAO_ACCOUNT) { $env:ZENTAO_ACCOUNT } elseif ($zentaoCredentials.zentaoAccount) { $zentaoCredentials.zentaoAccount } else { $zentaoConfig.zentaoAccount }
$zentaoPassword = if ($env:ZENTAO_PASSWORD) { $env:ZENTAO_PASSWORD } elseif ($zentaoCredentials.zentaoPassword) { $zentaoCredentials.zentaoPassword } else { $zentaoConfig.zentaoPassword }
$zentaoProductId = if ($env:ZENTAO_PRODUCT_ID) { $env:ZENTAO_PRODUCT_ID } else { $zentaoConfig.zentaoProductId }
$zentaoAssignee = if (-not [string]::IsNullOrWhiteSpace($env:ZENTAO_ASSIGNEE)) { $env:ZENTAO_ASSIGNEE.Trim() } elseif (-not [string]::IsNullOrWhiteSpace($zentaoConfig.zentaoAssignee)) { $zentaoConfig.zentaoAssignee.Trim() } else { "" }
$zentaoResolvedBuild = if ($env:ZENTAO_RESOLVED_BUILD) { $env:ZENTAO_RESOLVED_BUILD } else { 'trunk' }
```

MCP 地址按环境变量、本机 JSON、项目 `.mcp.json`、默认地址的顺序读取。账户、token、客户数据和完整敏感请求头不得输出到日志或上传到禅道。错误响应应脱敏后摘要，不直接输出登录响应全文。

## MCP 调用

mcp_zentao 的部分工具 schema 缺少路径参数，直接调用会失败。若当前工具存在此问题，用 `curl` 直发 JSON-RPC `tools/call`，把 `productID` / `bugID` 放在 `arguments` 顶层。根据当前平台选择模板：下面为 Windows PowerShell，macOS 使用链接的 zsh/bash 模板。

### 1. 获取 token（实际执行禅道任务时）

mcp_zentao token **短时有效、会过期**：过期后所有数据级调用返回 `{"message":"Not allowed","status":"fail"}`（`tools/list` 仍可用，易误判为连通正常）。有可用环境 token 时先校验；否则登录换新 token，勿依赖 `.mcp.json` 里的旧值。优先级：已有 `$env:ZENTAO_TOKEN` > 已有 `$env:ZENTAO_ACCOUNT/PASSWORD` > 顶部配置的登录账号。

登录账号密码使用顶部配置或环境变量，可自动登录。敏感信息不要输出到终端历史、commit 或关单 comment。

```powershell
$account = if ($env:ZENTAO_ACCOUNT) { $env:ZENTAO_ACCOUNT } else { $zentaoAccount }
$password = if ($env:ZENTAO_PASSWORD) { $env:ZENTAO_PASSWORD } else { $zentaoPassword }
if (-not $account -or -not $password -or $account -eq "<禅道账号>" -or $password -eq "<禅道密码>") { throw "请先配置禅道账号密码" }
$body = @{ account = $account; password = $password } | ConvertTo-Json -Compress
$tokenResp = curl.exe -sk -H "Content-Type: application/json" -X POST "$zentaoBase/api.php/v1/tokens" --max-time 30 --data $body
$env:ZENTAO_TOKEN = ($tokenResp | ConvertFrom-Json).token
if (-not $env:ZENTAO_TOKEN) { throw "禅道 token 获取失败，请检查脱敏后的响应及凭据配置" }
```

macOS 的环境变量、登录与 token 校验见 [macOS 操作参考](zentao-macos.md)，不要混用 PowerShell 变量语法。

若返回 `{"message":"Not allowed","status":"fail"}`，先重取 token；`tools/list` 可用不代表数据接口 token 有效。同一会话内再次出现 `Not allowed`，重跑本步换新 token 即可。

### 2. 通用 JSON-RPC 模板

```powershell
function Invoke-ZentaoTool {
  param(
    [Parameter(Mandatory=$true)][string]$Name,
    [Parameter(Mandatory=$true)][hashtable]$Arguments
  )
  if (-not $env:ZENTAO_TOKEN) { throw "ZENTAO_TOKEN 未设置" }
  $payload = @{
    jsonrpc = "2.0"
    id = 1
    method = "tools/call"
    params = @{ name = $Name; arguments = $Arguments }
  } | ConvertTo-Json -Depth 20 -Compress
  $raw = curl.exe -sk -H "Token: $env:ZENTAO_TOKEN" -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -X POST $mcpUrl --max-time 30 --data $payload
  $rpc = $raw | ConvertFrom-Json
  if ($rpc.error) { throw ("RPC ERROR: " + ($rpc.error | ConvertTo-Json -Depth 10 -Compress)) }
  $texts = @($rpc.result.content | Where-Object { $_.text } | ForEach-Object { $_.text })
  $jsonText = $texts | Where-Object { $_.TrimStart().StartsWith("{") } | Select-Object -First 1
  if (-not $jsonText) { return $rpc }
  return ($jsonText | ConvertFrom-Json)
}
```

### 3. 当前单的有效负责人

固定负责人配置允许为空。先查当前 BUG，再计算有效负责人；不把推导值覆盖 `$zentaoAssignee` 或写回本机配置。`openedBy` 的实际结构与账号可指派性需按当前实例核实，不能用显示昵称替代账号。

```powershell
function Get-ZentaoEffectiveAssignee {
  param([Parameter(Mandatory=$true)]$Bug)
  if (-not [string]::IsNullOrWhiteSpace($zentaoAssignee)) {
    return $zentaoAssignee.Trim()
  }
  $openedBy = $Bug.openedBy
  $reporter = if ($openedBy -is [string]) { $openedBy } else { $openedBy.account }
  if ($reporter -isnot [string] -or [string]::IsNullOrWhiteSpace($reporter)) {
    throw '无法取得当前 BUG 提单人的账号，请核对详情；不要猜测指派对象'
  }
  return $reporter.Trim()
}
```

常用调用：

```powershell
# 列出未关闭 BUG，之后只处理 status=active
Invoke-ZentaoTool -Name "get_products_productID_bugs" -Arguments @{
  productID = $zentaoProductId; browseType = "unclosed"; recPerPage = 200; pageID = 1
}

# BUG 详情，业务字段读 .bug，历史读 .actions
$bugDetails = Invoke-ZentaoTool -Name "get_bugs_bugID" -Arguments @{ bugID = 123 }
$zentaoEffectiveAssignee = Get-ZentaoEffectiveAssignee -Bug $bugDetails.bug

# resolve。业务参数必须嵌 payload，否则会报“解决方案不能为空”
Invoke-ZentaoTool -Name "put_bugs_bugID_resolve" -Arguments @{
  bugID = 123
  payload = @{
    resolution = "fixed"
    resolvedBuild = $zentaoResolvedBuild
    assignedTo = $zentaoEffectiveAssignee
    comment = "..."
  }
}
```

resolve 后必须再查详情，校验：

- `.bug.status == "resolved"`
- `.bug.resolution` 为目标值
- `.bug.assignedTo.account` 或 `.bug.assignedTo` 等于当前单计算出的 `$zentaoEffectiveAssignee`（指定负责人或当前提单人）
- `.actions` 末尾包含 `resolved`


## 下载 BUG 截图

截图下载：

```powershell
$fileId = 232
$dir = Join-Path $env:TEMP "zbugs"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$path = Join-Path $dir "$fileId.png"
curl.exe -sk -H "Token: $env:ZENTAO_TOKEN" "https://zentao.uper.monite.cn/api.php/v1/files/$fileId" --max-time 30 -o $path
if ((Get-Item $path).Length -le 0) { throw "截图下载为空: fileID=$fileId" }
```

下载后用可用的图片读取工具查看。只有 REST 文件接口也失败时，才要求用户补充截图或复现说明。

## 写备注、变更状态前发现能力

1. 查询当前服务的 `tools/list`，读取 comment/note、resolve、close、activate/reopen 及可能的 terminate 工具 schema，核实路径参数、必填字段、枚举和状态前置条件。
2. `terminate` 可能不存在，也可能属于其他对象。不得根据用户口语猜端点、枚举或把它强行等同 close。无对应能力时说明限制并提供当前确实可用的处置方式。
3. 无 MCP 工具时，仅使用已有项目文档或经核实的禅道 REST 接口；不试猜写接口，不用直接改数据库代替工作流。
4. 添加备注后重新查询详情，核对 `.actions` 中的备注内容。状态变更后核对实际 status、resolution、assignedTo、actions；响应“保存成功”不等于已经验证。
5. 评论和状态若需两次请求，分别记录结果。备注成功、状态失败时保留已成功结果，核实后仅重试缺失动作，避免重复评论或重复流转。
6. `resolve` 和 `close` 是不同业务操作；本地修好后交测试通常用 resolve，用户明确结束处理且系统允许时才执行 close。是否需先 resolve、使用哪个 resolution，必须根据真实工作流确认，不能伪造 fixed 作为关闭前置条件。

## 上传验证证据

有页面的 BUG 保存测试环境中正确业务结果的截图；纯接口 BUG 可保存脱敏请求/响应和数据核对证据。HTTP 成功必须同时符合该 BUG 的业务验收标准，不能只看 2xx。

```powershell
$dir = Join-Path $env:TEMP "zbugs"
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$shot = Join-Path $dir "bug123-test-ok.png"
```

先查 MCP 是否支持上传附件；没有时仅在确认部署支持此 REST 接口后使用：

```powershell
curl.exe -sk -H "Token: $env:ZENTAO_TOKEN" --max-time 30 `
  -F "files[]=@$shot" `
  -F "objectType=bug" `
  -F "objectID=$bugId" `
  "$zentaoBase/api.php/v1/files"
```

上传后重查 `.bug.files` 或 `.actions`，核对附件确实挂到当前 BUG；失败时保留本地证据、记录未回传，不标记已完成闭环，不 resolve=fixed。

## resolve comment 模板

`fixed`：

```text
【根因】
<文件:行 + 业务原因>

【修复点】
<文件:行 + 最小改动说明>

【dev 验证】
<复现路径/账号/数据/接口 + 修复后结果 + 测试/构建命令结果>

【test 复验】
<test 域名/API + 请求/页面路径 + 数据核对结果 + 部署 job/build 编号>

【成功截图】
<附件名或 fileID，已 re-query 校验挂载到 BUG>
```

`bydesign`：

```text
【结论】
非生产缺陷，按现有设计/接口契约表现正确。

【核对证据】
<逐层 file:line / 接口契约 / 数据状态 / 前端调用证据>

【测试侧建议】
<需要调整的造数、状态、字段名、权限或脚本>
```

## resolve 参数

每单先按 `$bugId` 重查详情并调用 `Get-ZentaoEffectiveAssignee -Bug $bugDetails.bug` 更新 `$zentaoEffectiveAssignee`；不得沿用上一单的推导值。

生产代码已修：

```powershell
Invoke-ZentaoTool -Name "put_bugs_bugID_resolve" -Arguments @{
  bugID = $bugId
  payload = @{
    resolution = "fixed"
    resolvedBuild = $zentaoResolvedBuild
    assignedTo = $zentaoEffectiveAssignee
    comment = $comment
  }
}
```

非生产缺陷：

```powershell
Invoke-ZentaoTool -Name "put_bugs_bugID_resolve" -Arguments @{
  bugID = $bugId
  payload = @{
    resolution = "bydesign"
    resolvedBuild = $zentaoResolvedBuild
    assignedTo = $zentaoEffectiveAssignee
    comment = $comment
  }
}
```

resolve 成功响应通常只返回“保存成功”，不能凭响应体结束；必须重查详情验证状态、resolution、assignedTo、actions。
