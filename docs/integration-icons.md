# 服务器与播放器图标

图标作为本地静态资源随应用分发，按服务器的 `providerId` 与播放器的 `kind` 映射，不依赖访问服务器或在线下载。未注册的服务器类型使用 Lucide 通用图标。标签页优先显示服务器提供的 favicon，加载失败时回退到类型图标。

| 类型      | 资源                                        | 来源                                                                                                                                     |
| --------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Emby      | `public/integrations/servers/emby.svg`      | [Simple Icons 的 Emby 图标](https://github.com/simple-icons/simple-icons/blob/develop/icons/emby.svg)，CC0                               |
| Jellyfin  | `public/integrations/servers/jellyfin.svg`  | [Simple Icons 的 Jellyfin 图标](https://github.com/simple-icons/simple-icons/blob/develop/icons/jellyfin.svg)，CC0                       |
| Plex      | `public/integrations/servers/plex.svg`      | [Simple Icons 的 Plex 图标](https://github.com/simple-icons/simple-icons/blob/develop/icons/plex.svg)，CC0                               |
| IINA      | `public/integrations/players/iina.png`      | [IINA 官方仓库应用图标](https://github.com/iina/iina/blob/master/iina/Assets.xcassets/AppIcon.appiconset/icon_512x512.png)，缩放至 128px |
| mpv       | `public/integrations/players/mpv.svg`       | [Simple Icons 的 mpv 图标](https://github.com/simple-icons/simple-icons/blob/develop/icons/mpv.svg)，CC0                                 |
| mpv.net   | `public/integrations/players/mpvnet.png`    | [mpv.net 官方仓库应用图标](https://github.com/mpvnet-player/mpv.net/blob/main/src/MpvNet.Windows/mpv-icon.ico)，由 ICO 导出 PNG          |
| VLC       | `public/integrations/players/vlc.svg`       | [VideoLAN 官方图标](https://images.videolan.org/images/icons-VLC/vlc.mini.svg)                                                           |
| PotPlayer | `public/integrations/players/potplayer.png` | [PotPlayer 官网图标](https://t1.kakaocdn.net/potplayer/main/img/favicon.ico)，由 ICO 导出 PNG                                            |
| MPC-HC    | `public/integrations/players/mpc-hc.png`    | [MPC-HC 官方仓库应用图标](https://github.com/clsid2/mpc-hc/blob/develop/src/mpc-hc/res/icon.ico)，由 ICO 导出 PNG                        |
| MPC-BE    | `public/integrations/players/mpc-be.png`    | [MPC-BE 官方仓库应用图标](https://github.com/Aleksoid1978/MPC-BE/blob/master/src/apps/mplayerc/res/icon.ico)，由 ICO 导出 PNG            |

图标用于识别对应的第三方软件，其商标与图标权利属于原作者，不表示 Freebo 与这些项目有合作关系。
