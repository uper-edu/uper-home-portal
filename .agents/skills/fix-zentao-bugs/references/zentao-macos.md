# macOS：zsh / bash 禅道操作参考

适用于 macOS 默认 zsh 和系统自带 bash。先读取主文件确认模式、当前单与授权，再执行所需片段。下列示例兼容两种 shell，不需要 PowerShell、jq 或 GNU 专属命令；使用项目已有 Node.js 和系统 curl。Windows 请使用 [PowerShell 与共用规则](zentao-api.md)。

## 配置与凭据

在项目根目录检查 `node --version`、`curl --version`。六项配置读取项目根目录 `.zentao.local.json`，格式见 [主文件配置说明](../SKILL.md#本机禅道配置)，环境变量可覆盖；产品必须核实；负责人可留空，按当前 BUG 提单人自动确定，不能使用占位符执行业务操作。解决版本默认主干 `trunk`，无需用户每次填写；只有用户明确指定其他解决版本时才覆盖，实际部署版本仍单独核验。真实凭据从已忽略的 `.zentao.credentials.local.json` 或环境变量读取，已跟踪的 `.zentao.local.json` 账号密码保持为空，不把密码写进命令历史、仓库或日志，不启用 `set -x`。

```bash
# 从项目根目录运行。仅解析 JSON，不执行配置，不打印凭据。
zentao_config_value() {
  node -e '
    try {
      const fs=require("node:fs");
      const cfg=fs.existsSync(".zentao.local.json") ? JSON.parse(fs.readFileSync(".zentao.local.json","utf8").replace(/^\uFEFF/,"")) : {};
      if (!cfg || Array.isArray(cfg) || typeof cfg!=="object") throw new Error();
      const key=process.argv[1], variable=process.argv[2];
      const credentialKey=key==="zentaoAccount" || key==="zentaoPassword";
      const secrets=credentialKey && fs.existsSync(".zentao.credentials.local.json") ? JSON.parse(fs.readFileSync(".zentao.credentials.local.json","utf8").replace(/^\uFEFF/,"")) : {};
      if (!secrets || Array.isArray(secrets) || typeof secrets!=="object") throw new Error();
      let value=process.env[variable] || (credentialKey && secrets[key]) || cfg[key];
      if (key==="zentaoAssignee") {
        value=[process.env[variable],cfg[key]].find(v=>typeof v==="string" && v.trim())?.trim() || "";
      }
      if (!value && key==="mcpUrl" && fs.existsSync(".mcp.json")) {
        value=JSON.parse(fs.readFileSync(".mcp.json","utf8").replace(/^\uFEFF/,"")).mcpServers?.mcp_zentao?.url;
      }
      if (!value) value=process.argv[3] || "";
      if (typeof value!=="string") throw new Error();
      process.stdout.write(value);
    } catch { console.error("禅道配置格式或字段类型有误，请检查本机配置（不回显敏感值）"); process.exitCode=1; }
  ' "$1" "$2" "${3:-}"
}

zentao_load_config() {
  ZENTAO_BASE=$(zentao_config_value zentaoBase ZENTAO_BASE 'https://zentao.uper.monite.cn') || return 1
  ZENTAO_MCP_URL=$(zentao_config_value mcpUrl ZENTAO_MCP_URL 'https://zentao-mcp.uper.monite.cn/zentao/mcp') || return 1
  ZENTAO_ACCOUNT=$(zentao_config_value zentaoAccount ZENTAO_ACCOUNT) || return 1
  ZENTAO_PASSWORD=$(zentao_config_value zentaoPassword ZENTAO_PASSWORD) || return 1
  ZENTAO_PRODUCT_ID=$(zentao_config_value zentaoProductId ZENTAO_PRODUCT_ID) || return 1
  ZENTAO_ASSIGNEE=$(zentao_config_value zentaoAssignee ZENTAO_ASSIGNEE) || return 1
  ZENTAO_RESOLVED_BUILD="${ZENTAO_RESOLVED_BUILD:-trunk}"
  export ZENTAO_BASE ZENTAO_MCP_URL ZENTAO_ACCOUNT ZENTAO_PASSWORD
  export ZENTAO_PRODUCT_ID ZENTAO_ASSIGNEE ZENTAO_RESOLVED_BUILD
}

zentao_load_config
```

已有可用 `ZENTAO_TOKEN` 时先做授权范围内的只读校验；token 失效再登录。下列函数只定义操作，定义后不会自行访问网络。配置加载失败时停止后续操作；本机缺少登录账号时仍可使用已有有效 token 读单，固定负责人无需提供，指派前逐单读取提单人；只有提单人缺失或无法指派时才说明阻塞并请用户决定替代对象。

## 登录获取 token

```bash
zentao_login() {
  local login_body login_raw login_token
  if [ -z "${ZENTAO_ACCOUNT:-}" ] || [ -z "${ZENTAO_PASSWORD:-}" ]; then
    printf '%s\n' '请先通过环境变量或安全配置提供禅道账号密码' >&2
    return 1
  fi
  login_body=$(node -e 'process.stdout.write(JSON.stringify({account:process.env.ZENTAO_ACCOUNT,password:process.env.ZENTAO_PASSWORD}))') || return 1
  login_raw=$(printf '%s' "$login_body" | curl --fail --silent --show-error \
    --max-time 30 -H 'Content-Type: application/json' \
    --data-binary @- "${ZENTAO_BASE}/api.php/v1/tokens") || return 1
  login_token=$(printf '%s' "$login_raw" | node -e '
    let input=""; process.stdin.on("data", c => input+=c).on("end", () => {
      try {
        const value=JSON.parse(input);
        if (typeof value.token!=="string" || !value.token.trim()) throw new Error();
        process.stdout.write(value.token);
      } catch { console.error("禅道登录失败，请检查凭据与脱敏后的响应"); process.exitCode=1; }
    });') || return 1
  export ZENTAO_TOKEN="$login_token"
}
```

需要登录时执行 `zentao_login` 并检查退出码；失败不继续业务调用。请求体经标准输入提交，密码不拼进 curl 命令行。token 不打印；认证再次失败时至多重新登录一次后重试只读操作，写操作先查远端实际结果再判断是否重试。

## JSON-RPC 与工具发现

JSON 参数通过 Node.js 生成和校验，不把未经转义的评论、引号或换行直接拼进 JSON。函数输出解析后的业务 JSON；RPC 错误、工具错误和明确的鉴权失败返回非零。HTTP/SSE 格式不匹配时停止解析并按实际服务协议处理，不能把未解析响应当作成功。

```bash
zentao_rpc() {
  local rpc_payload rpc_raw
  if [ -z "${ZENTAO_TOKEN:-}" ]; then
    printf '%s\n' 'ZENTAO_TOKEN 未设置' >&2
    return 1
  fi
  rpc_payload=$(node -e '
    try {
      process.stdout.write(JSON.stringify({jsonrpc:"2.0",id:1,method:process.argv[1],params:JSON.parse(process.argv[2])}));
    } catch { console.error("JSON-RPC 参数不是有效 JSON"); process.exitCode=1; }
  ' "$1" "$2") || return 1
  rpc_raw=$(printf '%s' "$rpc_payload" | curl --fail --silent --show-error \
    --max-time 30 -H "Token: $ZENTAO_TOKEN" \
    -H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream' \
    --data-binary @- "$ZENTAO_MCP_URL") || return 1
  printf '%s' "$rpc_raw" | node -e '
    let input=""; process.stdin.on("data", c => input+=c).on("end", () => {
      try {
        const rpc=JSON.parse(input);
        if (rpc.error || rpc.result?.isError || !rpc.result) throw new Error();
        const parts=rpc.result.content || [];
        const part=parts.find(p => typeof p.text==="string" && /^[\s]*[\[{]/.test(p.text));
        const value=part ? JSON.parse(part.text) : rpc.result;
        if (value?.status==="fail" || value?.message==="Not allowed") throw new Error();
        process.stdout.write(JSON.stringify(value,null,2)+"\n");
      } catch { console.error("禅道 RPC/业务调用失败或响应格式不受支持；请检查脱敏响应"); process.exitCode=1; }
    });'
}

zentao_tool() {
  local tool_params
  tool_params=$(node -e '
    try { process.stdout.write(JSON.stringify({name:process.argv[1],arguments:JSON.parse(process.argv[2])})); }
    catch { console.error("工具参数不是有效 JSON"); process.exitCode=1; }
  ' "$1" "$2") || return 1
  zentao_rpc 'tools/call' "$tool_params"
}
```

按需调用，下列只读示例互不依赖；每次检查退出码，失败先诊断，不接着执行状态变更：

```bash
zentao_rpc 'tools/list' '{}'

list_args=$(node -e 'process.stdout.write(JSON.stringify({productID:process.env.ZENTAO_PRODUCT_ID,browseType:"unclosed",recPerPage:200,pageID:1}))') && \
  zentao_tool 'get_products_productID_bugs' "$list_args"

export ZENTAO_BUG_ID='123'
bug_args=$(node -e 'process.stdout.write(JSON.stringify({bugID:process.env.ZENTAO_BUG_ID}))') && \
  zentao_tool 'get_bugs_bugID' "$bug_args"
```

列表例子仅展示一页的调用方式；实际按主文件拉完分页、去重并筛选。工具 schema 若要求数字 ID，按真实 schema 转换并校验，不因示例使用字符串就照搬。`tools/list` 可用不等于 token 的数据权限有效。

## 备注和状态变更

comment、close、terminate、activate 等工具先通过 `tools/list` 核实名称、参数与状态约束；不得猜工具或枚举。用户用自然语言决定，AI 组装请求并重查实际结果。完整授权、幂等核验与部分失败规则见 [共用规则](zentao-api.md)。

仅当当前单满足完整 fixed 证据及用户授权条件后，才使用下面的 resolve 示例。`ZENTAO_COMMENT` 由已确认的说明草稿在运行时注入；含引号、多行或中文均由 JSON.stringify 处理，不使用 `eval`。非缺陷处理需明确依据和对应授权，按实际 schema 改为相应 resolution，不套用 fixed。

```bash
bug_args=$(node -e 'process.stdout.write(JSON.stringify({bugID:process.env.ZENTAO_BUG_ID}))') && \
bug_details=$(zentao_tool 'get_bugs_bugID' "$bug_args") && \
resolve_args=$(printf '%s' "$bug_details" | node -e '
  let input=""; process.stdin.on("data",c=>input+=c).on("end",()=>{
    try {
      const env=process.env, details=JSON.parse(input);
      if (![env.ZENTAO_BUG_ID,env.ZENTAO_COMMENT].every(Boolean)) throw new Error();
      const openedBy=details.bug?.openedBy;
      const reporter=typeof openedBy==="string" ? openedBy : openedBy?.account;
      const assignee=(env.ZENTAO_ASSIGNEE || "").trim() || (typeof reporter==="string" ? reporter.trim() : "");
      if (!assignee) throw new Error();
      process.stdout.write(JSON.stringify({bugID:env.ZENTAO_BUG_ID,payload:{
        resolution:"fixed",resolvedBuild:env.ZENTAO_RESOLVED_BUILD || "trunk",
        assignedTo:assignee,comment:env.ZENTAO_COMMENT
      }}));
    } catch { console.error("缺少当前单/备注，或无法取得提单人账号；请核对详情，不猜指派对象"); process.exitCode=1; }
  });
') && zentao_tool 'put_bugs_bugID_resolve' "$resolve_args"
```

负责人每单重新计算，不能把提单人回写 `ZENTAO_ASSIGNEE` 导致下一单误用。先核实目标账号可指派；成功后重新调用详情，核对 status、resolution、assignedTo 等于本单有效负责人及 actions；不能只凭请求没有报错就称已解决。

## 下载与上传截图

临时目录兼容 macOS `TMPDIR`，使用独立目录避免不同 BUG/会话互相覆盖；不要硬编码 Windows 路径或删除其他任务的临时目录。

```bash
zentao_evidence_dir=$(mktemp -d "${TMPDIR:-/tmp}/zbugs.XXXXXX")
file_id='232'
screenshot_file="$zentao_evidence_dir/$file_id.png"

curl --fail --silent --show-error --max-time 30 \
  -H "Token: $ZENTAO_TOKEN" \
  "${ZENTAO_BASE}/api.php/v1/files/${file_id}" -o "$screenshot_file" && \
  test -s "$screenshot_file"
```

确认下载成功后用当前可用图片工具查看；失败先排查权限/文件接口，不能凭空判断图上内容。浏览器修后截图保存到已创建的目录，例如 `test_screenshot="$zentao_evidence_dir/bug${ZENTAO_BUG_ID}-test-ok.png"`。**该赋值不生成截图**，必须由浏览器实际截图并检查结果。

仅在真实成功证据已生成、具备上传授权且该 REST 接口已核实时执行：

```bash
if [ -s "$test_screenshot" ]; then
  curl --fail --silent --show-error --max-time 30 \
    -H "Token: $ZENTAO_TOKEN" \
    -F "files[]=@${test_screenshot}" \
    -F 'objectType=bug' -F "objectID=${ZENTAO_BUG_ID}" \
    "${ZENTAO_BASE}/api.php/v1/files"
else
  printf '%s\n' '缺少实际生成的测试环境截图，不能上传或宣称验证完成' >&2
fi
```

上传后重查当前 BUG 附件/actions，失败保留本地路径并报告，不能 resolve=fixed。不要将完整客户数据、token 或登录响应当成证据上传。构建/启动/部署遵循项目脚本和当前 macOS 环境；两种模式的确认点、剩余计数和下一单展示完全一致。
