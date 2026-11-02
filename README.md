# Lycee Overture 卡查工具箱（二代）

Nuxt 4 / Vue 3 前端与服务端、本机邮箱验证码账号服务、卡库及维护任务。

预览站：<https://v2.preview.lycee-toolbox.top/concepts/orbit>。

本仓库仅保留部署必需源码、静态资源、锁文件和运行维护脚本。卡库日常更新在腾讯服务器完成；Git 内 JSON 是可构建的离线基线。用户账号、个人卡组、攻略、上传图片、数据库备份、环境文件和密钥均不在 Git 中。`deployment-source.json`记录开发源码基线与导出时的文件摘要，不携带开发仓库历史。

## 构建

需要 Node.js 24.14+（24.x）、npm 11 与 Python 3。

```sh
npm ci
npm run typecheck
npm run build
node .output/server/index.mjs
```

账号服务另在`services/auth`执行`npm ci --omit=dev`。生产配置保留在服务器`/etc/lycee-v2/`，不要上传或用`.env.example`替换它们。本机演示可按`.env.example`自行配置。

## 腾讯服务器自动发布

`main`推送后，腾讯服务器约每90秒检查一次仓库。新版本会以独立低权限账号拉取、安装依赖、检查类型、构建，并使用隔离数据副本检查本机接口；通过后备份并切换版本。检查失败保留当前站点，约5分钟后重试；下一次新提交可立即重新尝试。

当前仍仅发布预览域名，不自动绑定`lycee-toolbox.top`。数据库、账号配置、卡图镜像及维护工作区位于发布目录之外，不从 Git 覆盖。回退通过切换已验证发布目录完成，不回滚数据库。

服务器已有的手调`orbit.css`保留为独立覆盖，未上传其未提交版本。若仓库修改同一文件，发布器使用三方合并；冲突时停止发布并保留旧站。每次发布清单同时记录 GitHub 提交和实际样式哈希。

自动发布只更新应用与既有账号服务代码，不安装仓库中的 systemd/Nginx 配置或自动执行数据库迁移。以 root 执行的备份/部署脚本经安装时固定摘要保护，其变更需管理员检查后显式更新。

服务器查看状态：

```sh
systemctl status lycee-v2-github-deploy.timer
sudo cat /var/lib/lycee-v2-deploy/status.json
sudo journalctl -u lycee-v2-github-deploy.service -n 50
```

服务入口：`deploy/tencent/github-auto-deploy.py`；systemd 模板在同目录。当前服务器已经配置好，不需重新初始化账号或数据库。仓库无需服务器私钥，也无需 GitHub Actions 部署密钥。

卡牌资料、翻译、图片和规则稿的权利说明见[第三方说明](THIRD_PARTY_NOTICES.md)。
