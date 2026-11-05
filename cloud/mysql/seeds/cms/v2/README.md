# MySQL CMS 初始化包 v2（COS 资源）

本包包含8类、106条初始CMS内容和208张WebP图片。首页项目图集包含HSK 3张、CSCA 2张、赴华留学咨询2张和中国研学2张。每组首张为封面，三语共用图集。

- `bundle.json` 保存内容及最终永久HTTPS资源URL，导入后存入 `cms_collections`。
- `media/` 保留按SHA-256命名的源图片，供离线核验和恢复；新初始化不再把图片二进制写入数据库。
- `cms_media` 保存 `cos_url`、`object_key`、`byte_size`、`storage_type=cos`，新记录的 `content` 为NULL。
- `preview.json` 是动态统计的基线；`SHA256SUMS` 校验包内文件。

## COS 目标

- 桶：`uper-portal-public-20261104191752-1433456541`
- 地域：`ap-jakarta`
- 对象：`cms/<SHA256>.webp`
- URL：`https://uper-portal-public-20261104191752-1433456541.cos.ap-jakarta.myqcloud.com/cms/<SHA256>.webp`

服务端配置 `PORTAL_COS_BUCKET`、`PORTAL_COS_REGION`、`PORTAL_COS_PREFIX`、`PORTAL_COS_SECRET_ID`、`PORTAL_COS_SECRET_KEY`，使用临时凭据时另设 `PORTAL_COS_SECURITY_TOKEN`。不得使用VITE前缀、提交真实密钥或公开私有环境文件。桶需要对这些CMS公开资源允许匿名GET；工具不会修改ACL、策略或CORS。

## 离线预检

在仓库根目录执行，不连接数据库、不上传：

```sh
node cloud/mysql/seeds/cms/v2/import.mjs preview
(cd cloud/mysql/seeds/cms/v2 && sha256sum -c SHA256SUMS)
```

## 显式发布资源

取得目标桶写入授权后执行，参数为私有环境配置和新的回执位置，不把密钥放进命令行：

```sh
node scripts/cms-seed-publish.mjs PRIVATE_ENV PRIVATE_RECEIPT.json
```

逐个核验或上传，禁止覆盖不同内容；匿名GET后检查SHA-256与字节数。进度回执支持网络中断后继续。全部成功后才更新bundle URL及校验清单。原始文件保留，不自动删除任何COS对象。

## 导入空白开发CMS

1. 使用当前应用schema（至少v16）建表并创建8个空集合。
2. 准备私有 `.env.dev`，使用获准的本地开发配置，或明确受控的远端开发配置。
3. 执行：

```sh
node cloud/mysql/seeds/cms/v2/import.mjs import-empty
```

导入前重新验证匿名资源可读；事务内写入内容和媒体URL元数据。已有不同的非空内容会拒绝，完全相同内容可以重入且不更新集合版本。应用启动不会自动上传或导入这个包。

## 现有库和生产初始化

现有库不能用 `import-empty` 强行覆盖。先执行只读比对和私有备份，再按已批准范围使用增量工具；保留业务内容与账号权限，媒体引用修改遵循版本控制。参见 `docs/operations/cms-cos-bootstrap.md`。

生产初始化交付是面向空库的完整DDL+DML，包含账号密码哈希，必须按敏感备份保存，不提交Git。数据库备份不再包含新图片字节；COS需独立设置合适的保留和恢复机制，资源删除不属于本工具能力。旧BLOB仍可读取，不通过回退旧代码直接回滚URL-only新媒体。
