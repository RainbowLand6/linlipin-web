# 邻里拼前端

SvelteKit 3 + Svelte 5 + TypeScript，关闭 SSR，adapter-static 输出 build/200.html，动态路由由浏览器渲染。可将此目录独立上传为 GitHub 仓库。

## 本地启动

需要 Node.js 24。先启动 Go API，再在本目录运行：

```sh
npm ci
npm run dev
```

默认 http://127.0.0.1:5173，/api 代理到 http://127.0.0.1:8080。需要改地址时复制 .env.example 为 .env.local，修改 DEV_API_TARGET。不要混用 localhost 与 127.0.0.1。

```sh
npm run check
npm test
npm run build
npm run preview
```

preview 仅预览静态文件，不提供开发 API 代理。要联调构建结果，在构建前设置 VITE_API_BASE_URL 为本地 API 的来源，并让后端 ALLOWED_ORIGINS 包含预览来源。

## Cloudflare Pages

连接独立前端仓库，根目录留空，构建命令 npm ci && npm run build，输出目录 build，Node 版本 24。不要选需要 Workers 的服务器适配器。

在 Pages 构建环境配置 VITE_API_BASE_URL=https://api.example.com，绑定自定义域名 https://group.example.com。后端配置 PUBLIC_BASE_URL=https://group.example.com、API_BASE_URL=https://api.example.com、ALLOWED_ORIGINS=https://group.example.com、COOKIE_SECURE=true。Cookie 保存在 API 主机，所有 API 请求携带 credentials。

使用七牛时再设置 VITE_PUBLIC_MEDIA_ORIGIN 与 VITE_PRIVATE_MEDIA_ORIGIN 为准确 HTTPS 来源。VITE_ 是公开配置，禁止放密钥、数据库密码或邀请码。变更这些值后必须重新构建。

static/_redirects 提供深层路由到 /200.html 的回退。构建脚本按实际启动脚本生成 CSP 哈希与来源白名单，写入 build/_headers；带指纹资源缓存一年。不要用会自动改写 HTML/内联脚本的优化功能破坏 CSP 哈希。无 Pages Functions、服务端路由或前端数据库连接。

登录默认七天固定有效期，记住密码单独交给浏览器密码管理器；应用存储只保存手机号和偏好。浏览器是否允许保存/自动填充由浏览器设置和用户决定。临时密码不进入凭据库。

网络结果不明的业务操作保留原幂等键与原内容，页面提示原样重试。当前恢复记录保存在页面内存，刷新或关闭页面后应先查询业务现状，不能直接重复提交。购物车草稿也不跨刷新保存。

个人信息展示当前账号手机号且不可编辑；平台管理员根据用户注册手机号重置密码。重置请求为 POST /platform/users/reset-password（phone + reason），与旧按 ID 路由不兼容，本次前后端须一起更新。社区邀请页面和海报使用通用社区文案。

主要页面：/、/me、/products、/pool/:id、/cart、/orders、/orders/pending、/groups、/groups/:id、/c/:token、/g/:token。页面结构、全局与页面样式以原 Vue 版本为参照，包含紧凑商品卡、头像菜单、选品单选列表、购物车确认弹窗、订单票据与 800×1100 PNG 分享海报。移动端底部导航和桌面侧栏保持原布局。

外观验收覆盖 15 个页面的 390×844 与 1440×1000 尺寸，使用同一 Go API、同一预览数据比较两套前端。详情见交付目录 docs/UI-PARITY.md。浏览器字体、系统缩放和抗锯齿仍可能产生像素差异。


本轮交互：可见且在线的首页、商品详情、购物车、领团候选、认购详情和订单页面每 12–15 秒错峰读取状态，离开页面停止定时器，隐藏/离线暂停。后台刷新不清空搜索词、购物车数量或领团表单，不静默替换选购快照；库存/版本冲突仍由数据库提交校验。购物车仍只在内存中，整页刷新即清空。登录繁忙/限流按 Retry-After 显示倒计时，保留已填密码且不自动重试。管理员临时密码显示基于 server_time 的倒计时、复制按钮及成功/失败提示，过期清除显示；凭据仍为 15 分钟一次性使用。列表使用固定缩略图，详情保留大图，沿用原 UI 样式。
