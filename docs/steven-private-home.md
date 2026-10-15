# Steven 私人小窝

公共 `/cat-nest/` 自动进入 `/cat-nest/test/`。私人入口 `/cat-nest/steven/` 与 `/cat-nest/evian/` 共用同一应用与资源。演示版没有私人入口链接，仍仅在内存中运行。

Steven 入口仍通过 `/api/couple/home` 读取原房间，未新建、复制或改写存档。原浏览器的 `catnest.*` 缓存与待提交操作键保持不变；Evian 的 `evian:` 命名空间不变。构建先生成两个命名入口，再用不含应用脚本的跳转页替换公共首页。本地继续使用共享 5174，根入口也跳转演示；`/steven/` 使用原本地预览文件。

## 访问保护

Render 的 `STEVEN_ACCESS_KEY` 是至少 24 字符的私人访问密码，推荐随机生成 32 字节。不能加入公开仓库、VITE_ 构建变量、URL 或日志。缺失配置时拒绝访问原房间，绝不降级开放。

`POST /api/access/steven` 校验密码，受 15 分钟窗口的 IP 与全局尝试次数限制；返回仅限 Steven 房间、有效 30 天的签名会话。浏览器只记住会话，不保存明文密码。轮换服务端密码会撤销旧会话。两位主人共用访问密码，进入后依然选择男方或女方。

`/api/couple/home`、原房间 ID 的 GET/POST 与 SSE 均受保护；单靠旧房间 ID 不能再读取/改写存档。普通 HTTP 使用 Authorization Bearer。实时连接先用授权 POST 换取 60 秒、一次性且绑定角色的随机 ticket，EventSource URL 不带长期会话。重连会重新获取 ticket。身份过期保留待提交操作并要求解锁，不将验证失败当作已丢弃操作。

Evian 保持现有独立访问约定；本次仅保护 Steven 的原个人房间。更换页面路径不能替代后端权限校验。
