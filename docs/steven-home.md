# Steven 小窝入口迁移

- 原个人小窝入口由 `/cat-nest/` 调整为 `/cat-nest/steven/`（含尾斜线、无尾斜线和 index.html 均可访问）。
- 公共 `/cat-nest/` 自动跳转独立演示 `/cat-nest/test/`，不保留旧 room/court 查询参数。
- Steven 沿用 `/api/couple/home` 的原房间及浏览器 `catnest.*` 缓存和待提交队列，不复制、不新建、不重置存档。身份选择和云端保存方式不变。
- 用户明确要求不配置密码。本次只调整入口，不增加密码、登录或后端验证。
- Evian 的原固定房间和 `evian:` 命名空间保持不变，继续与 Steven 使用同一套功能资源。
- 构建生成 `dist/steven/index.html` 与 `dist/evian/index.html`，两者通过 base 引用同一份应用资源；公共 dist/index.html 只包含跳转，不加载个人小窝。
- 本地统一复用 127.0.0.1:5174，个人小窝预览在 `/steven/`，公共首页进入 `/test/`。

2026-10-15：所有存档入口已统一为一份应用构建，测试入口不再独立构建。今后以 `shared-save-architecture.md` 为架构与发布约束，原房间及缓存绑定继续保留。
