# 猫猫小窝 · 猫猫判官

暖色猫咪养成网站。支持喂食、摸摸、逗猫、休息、改名和双人养猫；首页左下角的「猫猫判官」进入独立审理界面。

## 本地运行

需要 Node.js 22（最低 22.13）。

```sh
npm ci
cp .env.example .env
# 在本机编辑 .env，填入 OPENAI_API_KEY
npm run dev
```

打开终端显示的 `http://localhost:5173`。此命令同时启动前端和 8787 端口的审理服务，Vite 自动转发 `/api` 请求。手机与电脑在同一 Wi-Fi 时，可以使用终端显示的 Network 地址。

不填 API 密钥也可以创建案件、邀请对方、选择角色、上传截图和提交陈词；双方提交后会明确显示「判官尚未连接」，不会生成假判词。配置密钥并重启服务后，可在原案件重试。

```sh
npm test
npm run build
npm start
```

生产模式由 Node 同时托管 `dist/` 和审理 API，默认地址 `http://localhost:8787`。只有前端预览时可用 `npm run dev:client`；单独启动审理服务可用 `npm run dev:server`。

## 3D 小猫与互动模式

小窝中的小猫采用本地 Three.js 三维模型，支持呼吸、眨眼、转头、耳朵微动和摆尾。摸摸会眯眼蹭蹭，逗猫会追玩具并抬爪，喂食会低头咀嚼，休息会趴下闭眼；横向滑动可以旋转观看。

点击小猫状态卡里的「随心互动」可打开底部面板，选择随心、摸摸、逗猫或休息模式。模式只影响本机点击小猫时的动作；每次明确点击只提交一次原有互动，继续通过同一条云存档与双人同步链路。低活力时会优先安排休息，睡着后再点击可叫醒。

待机动作不会写入云存档。模型以 30 帧/秒为上限，页面隐藏或打开弹窗时暂停，并尊重系统「减少动态效果」设置；WebGL 无法使用时保留可交互的小猫插画。

## 猫猫判官

1. 点击小窝左下角「猫猫判官」，发起审理。
2. 双方打开同一个案件邀请链接，分别选择 A 方和 B 方；同一角色只能由一人认领。
3. 填写经过、感受、诉求，上传截图作为证据。对方可以看到在线与正在输入状态；未提交的草稿保留在自己的设备。
4. 每轮双方都提交后才启动一次审理。判官参考双方证词和截图，说明事实、证据局限、责任、修复行动及避免重演的约定。
5. 对判词有异议时可以继续陈词、补充证据。复审同样等待双方提交，结合之前每一轮证据和判词重新判断，并保留历史记录。

判官语气公正、温柔，带一点猫猫的可爱。不会为了和气强行各打五十大板，也不会将片段截图当成完整事实；遇到威胁和暴力时优先保护当事人，避免强迫和好。

模型默认 `gpt-6-astra`，推理强度固定为 `high`，使用 OpenAI Responses API；支持图片输入。可以在服务端设置 `OPENAI_MODEL`。模型能力与参数参考 [OpenAI 模型文档](https://developers.openai.com/api/docs/models) 和 [Responses API](https://developers.openai.com/api/reference/resources/responses/methods/create)。截图及已提交证词会发送给 OpenAI 进行分析，API 使用 `store: false`。

## 存档和同步

- **养猫云存档**由 Render 服务写入私有 `stevencheninfilm/cat-nest-data` 仓库，每次成功互动先提交 GitHub，再确认保存并用 SSE 同步给两位猫友。关闭网页后，使用同一猫窝链接会恢复云端进度；请收藏链接以便跨设备找回。失败的待保存操作保留在本机并自动重试，界面明确显示保存状态。未配置 `VITE_API_URL` 的本机预览保留浏览器存档与 PeerJS 演示，不能宣称已云端保存。完整配置见 [宠物云存档说明](README-pet-cloud.md)。
- **审理案件**由服务器保存到 `COURT_DATA_FILE`（默认 `.cat-court/rooms.json`），包括已提交证词、图片、角色凭据和判词。部署时应使用持久化磁盘，并保护该目录及备份。当前版本面向单服务进程，多个实例不能共同写同一个 JSON 文件。
- **角色凭据**保存在当前浏览器标签页的 sessionStorage。刷新可继续使用原角色；请勿清除此案件的浏览器会话数据，清除后不能仅凭昵称重新领取已占用角色。
- **输入状态**经服务器同步；双方无需同时在线提交。提交后的陈词和证据不可直接覆盖，补充内容进入下一轮，便于核对审理依据。
- 案件邀请允许对方认领空闲角色；已认领角色的凭据用于保护案件内容和提交权限。不要公开案件链接或角色凭据。当前版本没有账户系统、角色找回或自动清理服务端案件。

## 部署

### 前端和 API 一起部署

适合支持 Node.js 22 的服务器或容器平台。设置服务端 `OPENAI_API_KEY`，运行 `npm ci --include=dev && npm run build`，启动命令 `npm start`。平台应提供 HTTPS，端口由 `PORT` 指定；为 `COURT_DATA_FILE` 挂载持久化磁盘。

项目也包含 Dockerfile：

```sh
docker build -t cat-nest .
docker run -p 8787:8787 --env-file .env -v cat-court:/data -e COURT_DATA_FILE=/data/rooms.json cat-nest
```

API 密钥只通过服务器环境变量传入。不要使用 `VITE_OPENAI_API_KEY`，也不要把 `.env`、案件文件或备份放入公开仓库。

### 保留 GitHub Pages

现有仓库目标为 `stevencheninfilm/cat-nest`，`.github/workflows/deploy.yml` 会测试、构建并部署 `dist/`。GitHub Pages 运行静态前端，Render 的 `https://cat-nest-api.onrender.com` 提供宠物云存档与判官 API。GitHub 写入凭证只保存在 Render 的服务器环境变量。

1. Render 运行 `node server/index.mjs`，设置 `GITHUB_TOKEN`（仅私有数据仓库 Contents 读写）、`GITHUB_REPOSITORY`。宠物进度保存在 GitHub，不依赖 Render 的临时磁盘。
2. 在 GitHub 仓库 **Settings → Secrets and variables → Actions → Variables** 设置 `VITE_API_URL` 与 `VITE_COURT_API_URL` 为 `https://cat-nest-api.onrender.com`。
3. 在 API 服务器设置 `CORS_ORIGIN` 与 `COURT_ALLOWED_ORIGINS` 为前端的确切 origin，例如 `https://stevencheninfilm.github.io`；多个 origin 用逗号分隔，不包含路径、不使用通配符。
4. 重新运行 Pages 工作流。前端会连接此 API；同源部署无需上述两项配置。

没有配置可访问的判官服务时，已部署的静态网站会保留养猫功能，并明确提示判官服务未连接。

## 验证范围

`npm test` 包括养猫状态、GitHub 存档并发合并/失败恢复、SSE 双人同步、客户端确认保存队列、PeerJS 演示同步、判官角色权限、双方提交门槛、截图输入、并发审理、复审上下文和存档恢复。判官接口测试使用隔离的模拟 OpenAI 响应验证调用协议，不替代配置真实 API 密钥后的端到端验收。
