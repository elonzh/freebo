<picture style="align-items: center; display: flex; justify-content: center;">
  <source media="(prefers-color-scheme: dark)" srcset="assets/brand/freebo/svg/logo-on-dark.svg" />
  <img src="assets/brand/freebo/svg/logo.svg" width="280" alt="Freebo" />
</picture>

[![English](https://img.shields.io/badge/English-193C35?style=flat&logo=googletranslate&logoColor=white)](README.en.md)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-193C35?style=flat)](LICENSE)
[![下载 Freebo](https://img.shields.io/badge/%E4%B8%8B%E8%BD%BD-Freebo-193C35?style=flat)](https://github.com/elonzh/freebo/releases/latest)
[![macOS, Windows, Linux](https://img.shields.io/badge/Platforms-macOS%20%C2%B7%20Windows%20%C2%B7%20Linux-193C35?style=flat)](#功能)
[![产品官网](https://img.shields.io/badge/%E5%AE%98%E7%BD%91-Freebo-193C35?style=flat)](https://elonzh.cn/toys/freebo)
[![更新说明](https://img.shields.io/badge/%E6%9B%B4%E6%96%B0%E8%AF%B4%E6%98%8E-193C35?style=flat)](CHANGELOG.md)

**免费开源的桌面影音客户端。在熟悉的媒体库里浏览，用喜欢的本地播放器观看。**

Freebo(福瑞播) 的 **Free** 既是免费，也是自由选择播放器。软件没有订阅或播放格式解锁费用，支持 macOS、Windows 和 Linux。添加服务器，在网页中登录，点击播放即可打开本地播放器。

## 为什么做 Freebo

媒体库已经整理好了影片，电脑上也有喜欢的播放器。做 Freebo，就是想把它们连接起来，让找影片、看片和续播顺畅衔接。保留媒体服务器的网页浏览体验，用自己选好的播放器观看，并将观看进度同步回媒体库。

## 功能

- 支持 Emby、Jellyfin 和 Plex，多服务器标签页分别保留登录会话。
- 电影、剧集和视频播放列表，支持续播、连续播放与观看进度同步。
- 沿用媒体库的音轨、字幕和视频版本选择。
- 播放浮窗提供暂停、进度跳转和列表切换。
- 自动查找已安装的播放器，也可手动选择路径。
- 中英双语、浅色与深色外观，记住窗口大小和位置。
- 关闭主窗口后继续后台播放，通过托盘恢复窗口或退出。

| 系统    | 播放器                                       |
| ------- | -------------------------------------------- |
| macOS   | IINA、mpv、VLC                               |
| Windows | mpv.net、PotPlayer、MPC-HC、MPC-BE、mpv、VLC |
| Linux   | mpv、VLC                                     |

音乐和直播继续使用服务器网页播放。

## 快速开始

1. [下载安装包](https://github.com/elonzh/freebo/releases/latest)，打开 Freebo，在首次配置中选择已安装的播放器。
2. 选择 Emby、Jellyfin 或 Plex，添加媒体服务器地址，在服务器网页中登录。
3. 在媒体库中点击播放，用地址栏旁的播放按钮打开控制浮窗。

服务器和播放器可随时在设置中修改。服务器名称可留空；Emby、Jellyfin 按需保存的账号密码会自动填入登录页，Plex 使用网页登录会话。Plex 地址应填写媒体服务器地址（例如 `http://192.168.1.10:32400`）。便携版播放器可手动指定路径，服务器地址支持端口和反向代理子路径。

支持自动更新的安装版会自动检查并下载新版本，在「设置 → 关于」选择重启安装；其他版本可从该页面前往下载。支持范围见 [架构文档](docs/architecture.md#构建与升级)。

## 开发指引

源码运行、检查与提交、Emby／Jellyfin／Plex 集成测试、打包流程见 [开发流程](docs/development.md)。

## 致谢

感谢 [embyToLocalPlayer](https://github.com/kjtsune/embyToLocalPlayer) 提供协议与行为参考。
