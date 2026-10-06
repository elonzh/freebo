<picture style="align-items: center; display: flex; justify-content: center;">
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/freebo/svg/logo-on-dark.svg" />
  <img src="assets/brand/freebo/svg/logo.svg" width="280" alt="Freebo" />
</picture>

[![English](https://img.shields.io/badge/English-193C35?style=flat&logo=googletranslate&logoColor=white)](README.en.md)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-193C35?style=flat)](LICENSE)
[![macOS, Windows, Linux](https://img.shields.io/badge/Platforms-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-193C35?style=flat)](#功能)
[![产品官网](https://img.shields.io/badge/%E5%AE%98%E7%BD%91-Freebo-193C35?style=flat)](https://elonzh.cn/toys/freebo)
[![更新说明](https://img.shields.io/badge/%E6%9B%B4%E6%96%B0%E8%AF%B4%E6%98%8E-193C35?style=flat)](CHANGELOG.md)

在熟悉的 Emby 网页里浏览，用喜欢的本地播放器观看。

Freebo 将服务器管理、播放器选择和视频播放放在一个桌面应用中。添加服务器，在网页中登录，点击播放即可打开本地播放器。

## 功能

- 多服务器标签页，分别保留登录会话。
- 电影、剧集和视频播放列表，支持续播、连续播放与观看进度同步。
- 沿用 Emby 的音轨、字幕和视频版本选择。
- 播放浮窗提供暂停、进度跳转和列表切换。
- 自动查找已安装的播放器，也可手动选择路径。
- 中英双语、浅色与深色外观，记住窗口大小和位置。

| 系统    | 播放器                                       |
| ------- | -------------------------------------------- |
| macOS   | IINA、mpv、VLC                               |
| Windows | mpv.net、PotPlayer、MPC-HC、MPC-BE、mpv、VLC |
| Linux   | mpv、VLC                                     |

音乐和直播继续使用 Emby 网页播放。

## 快速开始

1. 打开 Freebo，在首次配置中选择已安装的播放器。
2. 添加 Emby 服务器地址，在服务器网页中登录。
3. 在媒体库中点击播放，用地址栏旁的播放按钮打开控制浮窗。

服务器和播放器可随时在设置中修改。服务器名称可留空；按需保存的账号密码会自动填入登录页。便携版播放器可手动指定路径，服务器地址支持端口和反向代理子路径。

## 从源码运行

```sh
pnpm install
pnpm dev
```

## 开发指引

### 环境与启动

使用 Node.js 22.12 或更新版本，以及 `package.json` 指定的 pnpm 版本。

```sh
pnpm install
prek install
pnpm dev
```

`pnpm dev` 构建主进程和预加载，启动 Vite 与 Electron。修改 `electron/` 后需重启；React 页面由 Vite 热更新。应用依赖 IPC，连接调试应使用 Electron 的浏览器引擎。

`pnpm start` 先完整构建，再启动本地生产版。单独的 `pnpm dev:web` 和 `pnpm preview` 只服务渲染页面，不能替代 Electron 运行验证。

### 检查与提交

开发中运行与改动相关的正确性检查：

| 命令                              | 用途                         |
| --------------------------------- | ---------------------------- |
| `pnpm typecheck`                  | TypeScript 类型检查          |
| `pnpm exec vitest run <测试文件>` | 定向测试                     |
| `pnpm test`                       | 全部 Vitest 测试             |
| `pnpm build`                      | 渲染页面、主进程与预加载构建 |

提交检查由 [prek.toml](prek.toml) 配置：先由 Oxlint 安全修复可修复的问题，再由 Oxfmt 格式化本次提交的文件；随后分别执行应用类型检查、Vitest、应用构建、品牌页类型检查和品牌页构建。自动修复产生改动时，检查修改并重新暂存后再提交。可用 `prek run --all-files` 检查整个仓库。

纯格式和风格检查由提交钩子兜底。Git 提交使用约定式提交格式，中文说明改动与验证。

### 打包与发布

`pnpm package` 构建应用并使用 electron-builder 生成当前平台产物，输出至 `release/`。

## 致谢

感谢 [embyToLocalPlayer](https://github.com/kjtsune/embyToLocalPlayer) 提供协议与行为参考。
