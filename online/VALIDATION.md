# 网页版验证记录

2026-09-22。

- 静态文件服务在 127.0.0.1:4320 启动，工具不依赖 desktop server.mjs。
- 浏览器载入内置 MP4 示例，设置开始 1 秒、结束 3 秒、宽度 320 px；通过 FFmpeg WebAssembly 在浏览器内完成转换。
- 页面结果：610.3 KB，320 × 180，2.00 秒，12 fps，128 色；生成动画预览和 blob 下载链接，提示尚未保存至磁盘，需点击“下载 GIF”。
- 转换过程中显示首次下载程序状态，完成后设置恢复可操作。
- 静态检查涵盖资源完整性、JS 语法、合法 WASM 模块、无本地上传/抽帧接口依赖、下载链接适配和部署配置。

目标体积压缩的浏览器交互测试被自动审批拦截并报告超时，未完成该次专项实测；不宣称已验证。Mac Safari / Firefox 和目录授权流程没有真机测试。

## GitHub Pages 部署准备

- 已增加 `.github/workflows/pages.yml`：Node.js 24 安装锁定依赖、构建网页、检查静态资源，再发布 `dist/web-online`。
- `npm run build:web`、`npm run verify:web`、`npm run build:github` 全部通过。
- 检查真实 HTML / ESM import / Worker / WASM 资源引用在域名根路径以及两个不同仓库子路径下能解析到完整文件。
- 将 `GIF-Studio-GitHub-Source.zip` 解压到全新临时目录后，独立运行 `npm ci`、`npm run build:web`、`npm run verify:web` 全部通过。构建不需要桌面版二进制文件。
- 源码上传包约 222 KB，按白名单收录网页源码、锁定依赖清单、工作流和许可，不含用户视频、转换结果和本地缓存。

尚无公网部署地址。等待目标 GitHub 仓库及账号访问权限；GitHub 托管环境中的 Actions 执行和公开网站验收尚未进行。
