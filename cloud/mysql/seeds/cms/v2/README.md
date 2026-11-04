# MySQL CMS 初始化包 v2

本包包含 8 类、106 条初始 CMS 内容和 208 张 WebP 图片。首页项目图集包含 HSK 3 张、CSCA 2 张、赴华留学咨询 2 张和中国研学 2 张。每组首张为封面，三语共用图集。

- `bundle.json` 保存内容和图片引用，导入后存入 `cms_collections`。
- `media/` 保存按 SHA-256 命名的图片，导入后存入 `cms_media`。
- `preview.json` 记录基线数量，`SHA256SUMS` 用于校验包内文件。

## 预检

在仓库根目录运行以下命令。预检读取本包文件，校验图片摘要和内容引用。

```sh
node cloud/mysql/seeds/cms/v2/import.mjs preview
(cd cloud/mysql/seeds/cms/v2 && shasum -a 256 -c SHA256SUMS)
```

## 导入空白本地开发库

1. 经授权后，使用当前应用版本为本地开发库建表并创建 CMS 空集合。
2. 从仓库根目录运行以下命令。导入器使用 `.env.dev` 和应用的本地数据库校验。

   ```sh
   node cloud/mysql/seeds/cms/v2/import.mjs import-empty
   ```

3. 在 CMS 中检查内容数量和图集。内容与图片在同一事务中写入。若数据库已有不同的 CMS 内容，导入会中止。重复导入相同内容会保留条目版本。

当前导入器仅支持本地开发库。应用启动时只创建空集合，测试和生产环境的导入需单独配置并核验目标。日常 CMS 编辑保存在各环境的数据库中，由数据库备份保护。
