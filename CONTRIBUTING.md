# 参与开发

感谢参与 LO 卡查工具箱的维护。界面与卡查开发可以直接使用仓库离线数据；需要最新卡库或完整账号流程时，再申请对应的测试环境。

## 开发流程

1. 先用 Issue 说明问题或改动目标；修复问题时附上复现步骤和使用设备。
2. 在独立分支开发，每个提交保持明确的改动范围。不要将格式化、业务修复和数据更新混在一次提交中。
3. 更新相关文档与测试，运行与改动有关的检查；提交 Pull Request 时写清结果和未覆盖的范围。
4. 交由维护者审核并合并。公开仓库的 `main` 会触发自动发布，提交记录也会出现在站内公告中。

仅文档或维护更新若无需公告，可在公开提交正文独立一行写 `Announcement: skip`；提交仍会触发自动发布，但不会显示在公告列表中。

环境版本以 [package.json](package.json)为准，使用 `npm ci` 安装依赖。Vue 组件沿用 `<script setup>` 和 Composition API，卡牌与构筑逻辑优先放在 `shared/`，服务端配置和数据库连接保留在 `server/`。

## 代码目录

| 目录 | 内容 |
| --- | --- |
| `app/` | 页面、组件、样式和浏览器交互 |
| `server/` | API、卡库读取、账号代理与个人内容存储 |
| `shared/` | 卡牌检索、构筑校验、攻略等领域逻辑 |
| `data/` | 可离线使用的卡库及来源清单 |
| `services/auth/` | 独立邮箱验证码账号服务 |
| `maintenance/` | 卡库和图片维护任务 |
| `deploy/` | 服务器配置和发布工具 |

完整开发环境另有 `tests/`，包含 Vitest、Playwright 和 Python 维护脚本测试。公开运行源码仓库未附带完整测试资料，需要维护相关功能时请向维护者索取。

## 本地配置

开发服务器会读取项目根目录的 `.env`。以下为不连接远程数据库、不开启账号服务的基础配置：

```dotenv
NUXT_CATALOG_SOURCE=assets
NUXT_WORKFLOW_DATABASE_PATH=.data/workflow.sqlite
NUXT_WORKFLOW_PUBLIC_ORIGIN=http://127.0.0.1:3000
NUXT_WORKFLOW_AUTH_MODE=local
NUXT_WORKFLOW_AUTH_ORIGIN=
```

- `NUXT_CATALOG_SOURCE`：`assets` 使用离线 JSON，`postgres` 使用 PostgreSQL 卡库。
- `NUXT_WORKFLOW_DATABASE_PATH`：本地个人内容数据库，每个开发者独立保存，不使用服务器正式文件。
- `NUXT_WORKFLOW_PUBLIC_ORIGIN`：当前本地网站的来源地址，端口变化时同步调整。
- `NUXT_WORKFLOW_AUTH_MODE=local`：使用独立账号服务的模式，不会自动创建账号或启动认证服务。
- `NUXT_WORKFLOW_AUTH_ORIGIN`：独立测试账号服务地址；为空时登录、云端保存和投稿不可用。

其他配置以 [nuxt.config.ts](nuxt.config.ts)为准。修改 `.env` 后重新启动开发服务。直接启动构建产物时，需要单独注入环境变量，具体见 README。

## 选择测试数据源

| 使用方式 | 适用任务 | 准备工作 |
| --- | --- | --- |
| 仓库离线卡库 | 页面、搜索、筛选、构筑和导出 | 安装依赖即可；不含正式账号和个人数据 |
| 个人只读身份 + SSH 隧道 | 核对最新卡库、复现公开卡组读取问题 | 维护者开通限定数据范围的个人身份 |
| 独立测试数据库 | 多人协作、迁移、后台任务和写入测试 | 单独部署，提供可重置数据和独立测试账号 |

团队长期协作推荐第三种方式：由维护者定期将允许共享的数据同步到独立测试库，参与者只连接测试环境。当前仓库已支持离线卡库和 PostgreSQL 只读读取；独立测试库、自动同步、个人账号发放及测试认证服务仍需单独建设。

## 通过 SSH 使用最新数据

先向维护者提供**本人的 SSH 公钥**和所需的数据范围。每位参与者使用独立的 SSH 身份与数据库只读账号，权限可以单独撤销。服务器 PostgreSQL 保持只监听内网或回环地址，不开放公网 5432 端口。

接入前由维护者确认数据库权限，并通过可信渠道提供服务器公钥指纹、数据库名及个人连接值。数据库权限应限制到允许共享的表或视图，不能只依赖应用查询中的筛选条件。

在本机核实并登记服务器公钥后，启动隧道：

```sh
ssh -N -T -o ExitOnForwardFailure=yes -o StrictHostKeyChecking=yes -o ServerAliveInterval=30 -L 127.0.0.1:55432:127.0.0.1:5432 DEV_SSH_USER@DEV_SSH_HOST
```

将 `DEV_SSH_USER`、`DEV_SSH_HOST` 替换为分配的 SSH 用户和主机。此例将服务器回环的 5432 映射到本机 55432；数据库在其他内部地址或端口时，以维护者给出的目标为准。保持隧道窗口运行，在另一个终端启动应用。

以下 `.env` 示例假定维护者已准备好独立测试库 `lycee_v2_stage_20261105`，所有大写连接字段都是占位值：

```dotenv
NUXT_CATALOG_SOURCE=postgres
NUXT_WORKFLOW_LEGACY_SOURCE=postgres
NUXT_LEGACY_DATABASE_URL="postgresql://DEV_DB_USER:URL_ENCODED_PASSWORD@127.0.0.1:55432/lycee_v2_stage_20261105"
NUXT_WORKFLOW_DATABASE_PATH=.data/workflow.sqlite
NUXT_WORKFLOW_PUBLIC_ORIGIN=http://127.0.0.1:3000
NUXT_WORKFLOW_AUTH_MODE=local
NUXT_WORKFLOW_AUTH_ORIGIN=
```

`NUXT_WORKFLOW_LEGACY_SOURCE=postgres` 控制既有公开卡组的读取来源，名称沿用兼容配置。仅有卡库权限时，只启用 `NUXT_CATALOG_SOURCE=postgres`；这不提供公开卡组查询所需的数据和权限。

当前 [数据库适配器](server/utils/tencent-database.ts)仅接受 `127.0.0.1`、`localhost`，数据库名仅接受 `lycee_v2` 或 `lycee_v2_stage_<数字>`。共享测试库需要沿用这一命名，连接值中的密码应进行 URL 编码。应用的 PostgreSQL 通道默认只读，授予写权限不会自动开启写入测试。

临时读取生产数据时，也须先限定数据库可见范围，并使用个人只读账号。SSH 隧道仅负责传输，不能代替数据库权限控制。维护者现有的 `scripts/preview_remote.py` 依赖特定服务器权限和固定 reader 配置，不作为贡献者通用启动器，也不要求贡献者读取服务器正式环境文件。

连接失败时先检查隧道、本机端口、账号权限与数据库名，不通过切换到管理员账号解决。连接值仅保存在个人 `.env` 或本机进程环境中，不放进提交、截图或 Issue；不要共享生产私钥、管理员账号或通用生产连接串。

## 准备可共享的测试库

建议维护者按以下方式提供团队测试环境：

1. **限定数据范围**：从卡牌和允许共享的公开内容建立数据集，不直接分发整库备份。卡库读取需要 `toolbox_catalog_cards` 和 `toolbox_catalog_meta`；公开卡组查询还有关联表，结构以 [读取代码](server/utils/legacy-postgres.ts)为准。
2. **清理个人信息**：排除正式账号、邮箱、会话、验证码、私有卡组、未发布攻略和正式个人 SQLite。公开卡组也应检查关联身份、作者资料和自由文本，使用测试身份替代非必要的真实信息。
3. **提供可重置基线**：记录数据版本、生成时间和表结构版本，在独立环境中恢复并检查后供开发者使用。定期同步不会覆盖其他人的实验数据；写入和迁移测试使用每人独立的数据库或副本。
4. **分配最小权限**：普通页面和读取测试使用个人只读角色，迁移或后台任务使用限定在本人测试库内的角色；保留可单独撤销的访问记录。
5. **隔离账号与任务**：认证服务使用独立密钥、测试账号和测试邮件服务。定时任务默认不启动，测试发送、抓取、上传等外部操作时使用测试目标。

个人卡组和攻略写入主要位于本地 SQLite，认证服务使用独立 PostgreSQL 连接。仅复制卡库不能得到完整登录与投稿环境；需要测试这些流程时，应同时准备隔离的账号服务和个人存储。不要运行生产账号迁移脚本来创建测试用户。

## 提交与验证

提交前运行相关检查，在 Pull Request 中列出实际执行的结果。文档修改检查链接、命令和配置示例；业务修改补充对应测试，再按影响范围运行类型检查、单元测试或浏览器测试。

不要提交 `.env`、密钥、`.data/`、数据库备份或真实个人数据。需要附测试数据时，提供最小且已清理的样例，并说明它复现了什么问题。
