# 站名占位符·LO卡查工具箱

面向 Lycee Overture 玩家的非官方中文工具站，提供卡牌查询、卡组构筑、社区分享与常用导出工具。支持桌面和手机浏览，以及日间、夜间主题。

[在线使用](https://www.lycee-toolbox.top/concepts/orbit) · [预览站](https://v2.preview.lycee-toolbox.top/concepts/orbit) · [反馈邮箱](mailto:lyceetoolbox@163.com)

## 主要功能

- **卡牌查询**：中日文关键词搜索，按系列、属性、类型、费用和数值筛选，查看完整卡号及异画。
- **卡组构筑**：选牌、数量调整、草稿恢复与本地保存；登录后可同步个人卡组，发布到卡组社区。
- **卡组工具**：导出 TTS JSON、带中文效果的卡表 PDF，以及按数量排版的卡图打印 PDF。三个工具均支持导入官网卡组链接和 `lyc.ee` 短链接。
- **起手模拟**：以卡牌动画展示抽取过程，查看本次抽取结果并重新洗牌。
- **规则与攻略**：规则网页、原稿 PDF 下载、玩家攻略阅读与富文本写作。
- **玩家交流**：浏览公开卡组和玩家社群，通过更新公告了解网站变化。

## 技术栈

| 部分 | 技术 |
| --- | --- |
| 应用框架 | Nuxt 4、Vue 3、TypeScript |
| 界面与动效 | Tailwind CSS、Reka UI、GSAP、Three.js |
| 卡牌检索 | FlexSearch |
| 数据存储 | PostgreSQL 卡库、SQLite 个人内容存储、浏览器本地存储 |
| 账号服务 | Better Auth、邮箱验证码 |
| 文档与图片处理 | Tiptap、jsPDF、sharp |

## 快速开始

需要 **Node.js 24.14+（24.x）** 和 **npm 11**。

```sh
git clone https://github.com/Inferno-Dragon123/Lycee-Overture-.git
cd Lycee-Overture-
npm ci
cp .env.example .env
npm run dev
```

打开 [本地开发页面](http://127.0.0.1:3000/concepts/orbit)。Windows PowerShell 可用 `Copy-Item .env.example .env` 复制配置。

默认使用仓库中的离线卡库，可以直接进行卡查和本地构筑，无需先连接服务器数据库。卡图加载、官网链接解析等功能仍需要网络。未配置独立账号服务时，登录、云端保存和投稿功能不可用；`local` 账号模式不会自动创建测试账号。

## 配置与协作开发

[参与开发](CONTRIBUTING.md)介绍环境变量、目录结构和数据库测试方案。初次参与可使用离线卡库；需要最新数据时，向维护者申请个人只读身份，通过 SSH 隧道连接。需要迁移或写入测试时，应使用独立测试环境。

线上卡库从 PostgreSQL 读取，仓库 JSON 是离线基线，两者的收录数量可能不同。账号、个人卡组、攻略、上传资料和数据库备份不存放在本仓库。

提交修改前，至少完成类型检查和构建，并说明改动的验证方式：

```sh
npm run typecheck
npm run build
```

本仓库提供应用与运行维护源码。完整开发环境还包含单元和浏览器测试；需要参与相关逻辑维护时，请联系维护者获取相应测试资料。

## 构建与运行

```sh
npm run build
npm run preview
```

服务默认监听 3000 端口，可通过 `HOST` 和 `PORT` 设置监听地址。构建后的服务不自动加载 `.env`，请由进程管理器注入配置，或使用 Node.js 的 `--env-file` 参数：

```sh
node --env-file=.env .output/server/index.mjs
```

独立账号服务位于 `services/auth/`，需要单独安装依赖并配置测试数据库、会话密钥和邮件服务；它不会随 `npm run dev` 自动启动。

## 发布维护

`main` 的提交会进入更新公告，并触发服务器自动发布。服务器约每 90 秒检查新提交，依次安装依赖、检查类型、构建、隔离预检、备份和切换版本；失败时保留上一版本。请使用分支提交 Pull Request，避免将调试提交直接推送至 `main`。

数据库、账号配置、图片镜像和备份位于发布目录之外。应用发布不会自动执行数据库迁移或安装 systemd、Nginx 配置。服务器已有的私有配置应独立维护，不用仓库示例覆盖。

## 反馈与版权

问题反馈：[GitHub Issues](https://github.com/Inferno-Dragon123/Lycee-Overture-/issues) 或 [lyceetoolbox@163.com](mailto:lyceetoolbox@163.com)。

本项目为非官方玩家工具。卡牌名称、原文、卡图及规则稿的权利属于 Lycee Overture 官方与相应权利人，中文辅助译文和第三方依赖的说明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
