# 前后端同版发布

GitHub Pages 的构建在上传发布产物前，运行 `scripts/wait-backend-release.mjs`：后端 `/version.json` 必须返回与本次 `GITHUB_SHA` 完全一致的提交，且 `/api/health` 的 `ok`、`configured` 都为 `true`。等待最多 15 分钟；超时则停止前端发布，旧页面继续提供服务。

现有 Render 服务关闭了自动部署。正常更新流程为：提交并非强制更新 main 后，核对 main 的准确 SHA，再为 `cat-nest-api` 手动触发一次部署。GitHub Pages 可以提前测试和构建，但会等待这个后端版本实际可用后才上线。不要因等待步骤运行中而重复触发 Render 部署。

此检查只读取公开版本和健康信息，不加入房间、不改动存档、不调用判官 AI。后端地址来自仓库变量 `VITE_API_URL`，缺省使用现有的 `https://cat-nest-api.onrender.com`。

水獭的 `appearance.character` 是可选的新存档字段。新后端兼容旧的四字段猫猫装扮；回退代码时仍须保留这个兼容读取能力，不能靠丢弃或重置存档回退。
