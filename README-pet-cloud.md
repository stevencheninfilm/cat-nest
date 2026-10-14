# 猫猫小窝：GitHub 云存档部署

网站前端由 GitHub Pages 托管；独立 Node.js 后端负责双人实时同步和写入 GitHub 私有存档库。后端部署、凭据配置和前端 API 地址均完成后，才具备云端保存能力。仅发布 GitHub Pages 不会启动后端。

## 两个仓库

| 仓库 | 可见性 | 用途 |
| --- | --- | --- |
| `stevencheninfilm/cat-nest` | 公开 | 网站代码、图片、Pages 构建与后端代码 |
| `stevencheninfilm/cat-nest-data` | 私有 | `rooms/` 下的房间 JSON 存档及提交历史 |

保留私有存档库，避免将用户昵称和互动历史公开到网站源码仓库。邀请链接提供房间访问权，请只分享给信任的人；此版本不提供账户登录或找回邀请链接的服务。

## 1. 配置 GitHub 写入权限

由仓库所有者在 GitHub 创建 fine-grained personal access token：只选择 `cat-nest-data` 仓库，授予 **Contents: Read and write** 权限，并设置合理的到期时间。

将 token 直接填入 Render 的 `GITHUB_TOKEN` 环境变量。不要把 token 发到聊天、写入代码、提交到 GitHub、填入 `VITE_` 变量或放进网页。前端只接收后端的公开 URL。

## 2. 部署 Render 免费后端

本仓库使用独立配置文件 `render-pet.yaml`，启动入口为 `server/pet-server.mjs`。

1. 登录 Render，选择 **New → Blueprint**，连接源代码仓库 `stevencheninfilm/cat-nest`。
2. 分支选择 `main`，**Blueprint Path** 填 `render-pet.yaml`，核对服务计划为 **Free**。
3. 填入下列环境变量，再创建服务。GitHub 连接权限和密钥由账户所有者在平台界面完成。

| 环境变量 | 值 |
| --- | --- |
| `GITHUB_TOKEN` | 仅保存在 Render 的 GitHub token |
| `GITHUB_REPOSITORY` | `stevencheninfilm/cat-nest-data` |
| `GITHUB_BRANCH` | `main` |
| `CORS_ORIGIN` | 网站的实际 origin，如 `https://stevencheninfilm.github.io`；如 Pages 使用自定义域名，应填实际域名；多个允许的 origin 用逗号分隔，不含路径或末尾 `/` |
| `PORT` | Render 自动提供，无需手动设置 |

若手动创建 Web Service，使用 Node.js 22、构建命令 `npm ci`、启动命令 `node server/pet-server.mjs`、健康检查路径 `/api/health`，并保持单实例。

服务上线后记录 Render 提供的 HTTPS 地址。访问 `https://服务域名/api/health` 可检查配置是否就绪；健康检查本身不会验证 token 是否真的有仓库写权限，仍需完成下方验收。

Render 免费服务在连续 15 分钟无入站请求后会休眠；再次访问通常需要约一分钟唤醒，也可能重启。免费服务的本地文件会丢失，因此永久进度写入 GitHub，不能依赖后端内存或本地磁盘。详见 [Render 免费服务限制](https://render.com/docs/free)。

## 3. 连接 GitHub Pages 前端

1. 在源代码仓库进入 **Settings → Secrets and variables → Actions → Variables**。
2. 新增 repository variable **`VITE_API_URL`**，值为后端 HTTPS origin，例如 `https://你的服务.onrender.com`，不含 `/api` 路径。
3. 在 **Settings → Pages** 选择 **Source: GitHub Actions**，然后重跑网站部署 workflow。

部署 workflow 已将此变量传给 Vite。该 URL 会出现在网页构建结果中，这是预期行为；GitHub token 不会传给前端。后端地址变更后，需要更新变量并重新构建。

## 4. 验收自动保存和双人同步

1. 打开网站，建立小窝，执行一次喂食，等待网页明确显示云端保存成功。
2. 在私有 `cat-nest-data` 仓库确认出现相应房间存档与新提交。
3. 关闭网页，再通过同一个邀请链接进入，确认猫咪进度恢复。
4. 用第二部手机打开邀请链接，确认双方互动同步；让第一部手机退出后，第二部手机仍可继续操作并保存。

网络断开、后端休眠或 GitHub 限流期间，不应把本机反馈当成保存成功；以网页的云端保存状态为准。手机锁屏和后台暂停会中断实时连接，回到前台后需要重新连接。GitHub API 配额适合此版本的小规模同养，较多用户上线时应改用数据库并另行做备份。

## 本地后端

将环境变量设到本机进程后启动：

```sh
node server/pet-server.mjs
```

前端开发环境设置 `VITE_API_URL=http://localhost:10000`，后端 `CORS_ORIGIN` 包含 Vite 实际 origin。将本机密钥保存在不提交的环境文件或系统环境中，勿提交任何真实凭据。

官方参考：[Render Blueprints 自定义路径](https://render.com/docs/infrastructure-as-code)、[Render 环境变量与密钥](https://render.com/docs/configure-environment-variables)。

## 当前整合部署

同一个 Render 服务运行 `node server/index.mjs`，同时提供宠物 `/api/rooms`、`/api/health` 与判官 `/api/court`；构建命令为 `npm ci && npm run build`。独立宠物服务仍可使用 `node server/pet-server.mjs`。判官真实分析需要另行配置服务器端 `OPENAI_API_KEY`，不影响宠物 GitHub 存档。

Render 的 `NODE_ENV=production` 会让 npm 默认省略构建工具。共享网站服务的构建命令必须使用 `npm ci --include=dev && npm run build`。

## 成长气泡的共享云存档

喂食、摸摸、玩耍和入睡生成的气泡保存在共同小窝的 `state.pendingGrowth`，随互动写入同一份 GitHub 私有存档。气泡没有到期时间；等待页面显示「已保存」后，刷新、服务重启或在新设备选择男方／女方，都会从共同小窝恢复同一批未领取气泡。

双方都可以领取任意气泡。客户端只提交气泡 ID，服务器使用存档中的金额，在一次提交中完成「移除气泡＋增加成长值＋保存领取凭证」，随后通过实时事件同步完整存档。两个设备同时点击时只有一次提交能成功，另一端立即读取最新云存档；丢失实时事件或重试请求不会再次增加成长值。

服务器另外保留永久的 `claimedGrowth` 领取凭证，避免旧互动请求在最近 100 条操作记录之外重放时，重新生成已领取的相同气泡。这些凭证不受日记长度、冷却时间或时间流逝影响，也不会传入网页界面。

跨设备验收时，先在一端生成气泡但不领取，等保存成功后，用另一设备进入同一共同小窝；确认两端显示同一气泡。任意一端领取后，确认两端气泡同步消失、成长值只增加对应金额；同时点击、断线恢复和刷新后，结果应保持一致。未配置 `VITE_API_URL` 的本机前端属于本地预览，不具备跨设备云存档能力。
