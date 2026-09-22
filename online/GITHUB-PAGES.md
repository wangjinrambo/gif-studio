# GIF Studio · GitHub Pages 网页版

在 Mac 或 Windows 浏览器中将视频转换为 GIF，支持截取时段、调整尺寸、按目标大小压缩、实时片段预览和下载。视频在浏览器内处理，无需转换服务器。

## 首次发布

1. 在 GitHub 创建一个仓库，例如 `gif-studio`。GitHub Free 用户使用公开仓库；这会公开工具源码，选入工具的视频不会因此上传。
2. 解压 `GIF-Studio-GitHub-Source.zip`，将**解压后的所有文件和目录**提交到仓库根目录的 `main` 分支。必须包含 `.github/workflows/pages.yml`、`package.json`、`package-lock.json`、`web`、`online` 和 `packaging/licenses`；不要只上传 ZIP，也不要把这些文件多套在一层文件夹里。文件管理器看不到 `.github` 时请显示隐藏文件；可用 GitHub Desktop 添加整个解压目录。
3. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**。
4. 打开 **Actions → Deploy GIF Studio to GitHub Pages → Run workflow**，选择 `main` 并运行。如果初次提交已触发但因尚未开启 Pages 失败，完成第 3 步后重新运行即可。
5. 等待 `build` 和 `deploy` 都成功，点击部署结果中的网站地址。普通项目地址为 `https://你的用户名.github.io/仓库名/`，以 GitHub 显示的地址为准。

以后向 `main` / `master` 推送修改会自动更新网页。其他默认分支请同步修改 `.github/workflows/pages.yml` 中的分支列表，以及 Pages 的环境分支限制。工作流使用 GitHub 自动提供的令牌，无需填写个人 Token 或部署密钥。

## 为什么上传源码包

GitHub Actions 会下载固定版本的 FFmpeg WASM 并生成静态站点，只发布 `dist/web-online`。源码包不含用户视频、导出的 GIF、桌面程序或本地缓存。约 31 MB 的 WASM 文件由工作流构建时获取，避免在 GitHub 网页端手工上传大文件。

所有程序、Worker 和示例资源使用相对路径，支持仓库子路径和自定义域名。转换引擎使用单线程版本，不需要设置 GitHub Pages 不支持的自定义跨域隔离响应头。

## 本地检查（可选）

安装 Node.js 24 后，在解压目录打开终端：

```sh
npm ci
npm run build:web
npm run verify:web
npm run preview:web
```

然后打开 `http://127.0.0.1:4320/`。不能直接双击 `index.html` 使用。

## 使用说明

- 首次转换需下载约 31 MB 的转换程序，请等待加载完成。
- 单文件最大 200 MB；一次截取最长 120 秒。很大的尺寸、帧率和时长组合需要调小设置，转换期间保持页面打开。
- 建议在 Mac / Windows 使用 Chrome 或 Edge。支持文件夹选择的浏览器可授权导出目录；Safari / Firefox 等使用“下载 GIF”，保存位置由浏览器决定。目标平台兼容性仍需在实际设备上确认。
- 刷新前请下载结果。视频与结果保留在当前页面内存，不会由工具上传到 GitHub。
- GitHub Pages 是静态托管，不提供后台转换；网站访问和程序下载受 GitHub Pages 服务配额及网络可达性影响。

如果页面空白或转换引擎加载失败，请先检查 Actions 是否成功、Pages 网站地址是否完整（包括仓库名）、浏览器网络面板中 JS / WASM 是否返回 200，以及是否保留完整的 `vendor` 目录。不要打开源码仓库中的 HTML 文件链接来使用工具。

第三方许可随构建站点放在 `licenses` 目录中。

官方说明：[GitHub Pages 自定义工作流](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。
