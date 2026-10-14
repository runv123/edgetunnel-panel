# EdgeTunnel Panel（独立管理面板）

本项目只放管理面板静态文件，目标部署到单独的 Cloudflare Pages 项目。原 `runv123/edgetunnel` 仓库继续作为内核项目。

## 文件
- `index.html`：管理界面结构
- `style.css`：响应式样式
- `app.js`：调用原内核管理 API

## 重要：目前是面板前端初版，不能直接连接未经修改的原内核

原 `_worker.js` 的管理接口使用同源 `auth` Cookie 进行验证，且目前管理 API 没有为独立面板域名提供完整 CORS 支持。浏览器不能安全、可靠地让另一个 `pages.dev` 域名直接使用原 Cookie。

本面板前端预留的桥接协议为：
- 面板调用 `https://原内核域名/admin/...`
- 请求携带 `X-Admin-Password` 请求头
- 内核必须只允许由环境变量 `PANEL_ORIGIN` 指定的精确面板来源跨域访问
- 内核必须在所有管理 API 路由中验证该请求头的密码，且对 `OPTIONS` 预检请求正确响应
- 不可对管理 API 使用 `Access-Control-Allow-Origin: *` 后再放开凭据；也不可移除管理员验证

在完成并测试内核侧桥接前，不要把这个版本当作可用的管理入口部署使用。密码只保存在页面运行时内存中，不写入 localStorage/sessionStorage；刷新页面后需要重新输入。

## 部署静态面板
1. 新建自己的 GitHub 仓库，例如 `edgetunnel-panel`。
2. 上传这三个前端文件。
3. Cloudflare Pages 连接新仓库；框架预设选 `None`，构建命令留空，输出目录填 `/` 或按 Cloudflare Pages 当前界面要求选择根目录。
4. 部署后记下实际面板 URL，并把这个精确 URL 设为内核的 `PANEL_ORIGIN`。
5. 只有内核桥接已完成并通过验证后，才输入管理员密码连接。

## 当前面板覆盖的接口
- `GET /admin/config.json`、`POST /admin/config.json`
- `GET /admin/cf.json`、`POST /admin/cf.json`
- `GET /admin/tg.json`、`POST /admin/tg.json`
- `GET /admin/ADD.txt`、`POST /admin/ADD.txt`
- `GET /admin/log.json`
- `GET /admin/init`
- `GET /admin/check`
- `GET /admin/getCloudflareUsage`

部分接口字段行为沿用上传的 `_worker.js`；尚未在真实 Cloudflare 部署环境验证。
