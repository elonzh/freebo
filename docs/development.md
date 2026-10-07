# Freebo 开发流程

## 环境与源码运行

使用 Node.js 22.12 或更新版本，以及 `package.json` 指定的 pnpm 版本。

```sh
pnpm install
prek install
pnpm dev
```

`pnpm dev` 构建主进程和预加载，启动 Vite 与 Electron。修改 `electron/` 后需重启；React 页面由 Vite 热更新。应用依赖 IPC，连接调试应使用 Electron 的浏览器引擎。

`pnpm start` 先完整构建，再启动本地生产版。单独的 `pnpm dev:web` 和 `pnpm preview` 只服务渲染页面，不能替代 Electron 运行验证。

## 检查与提交

开发中运行与改动相关的正确性检查：

| 命令                              | 用途                                     |
| --------------------------------- | ---------------------------------------- |
| `pnpm typecheck`                  | 应用、集成测试脚本的 TypeScript 类型检查 |
| `pnpm exec vitest run <测试文件>` | 定向单元测试                             |
| `pnpm test`                       | 全部 Vitest 测试，不启动容器             |
| `pnpm build`                      | 渲染页面、主进程与预加载构建             |

测试按被测模块组织，新增测试放入对应目录，跨模块文件按职责拆分：

| 目录                         | 内容                                                                                 |
| ---------------------------- | ------------------------------------------------------------------------------------ |
| `tests/electron/core/`       | 主进程生命周期、设置、播放器、媒体代理等                                             |
| `tests/electron/providers/`  | Provider 注册与边界；Emby、Jellyfin、Plex 各自的客户端和网页适配器测试放入对应子目录 |
| `tests/renderer/components/` | React 组件交互                                                                       |
| `tests/renderer/runtime/`    | 渲染层 IPC 与状态同步；路由测试位于 `tests/renderer/`                                |
| `tests/shared/`              | 共享资源与国际化                                                                     |
| `tests/integration/`         | 集成环境配置的单元测试                                                               |
| `tests/helpers/`             | 多个测试复用的 fixture 与渲染辅助函数                                                |

可按目录运行相关测试，例如 `pnpm exec vitest run tests/electron/providers/emby`。Vitest 递归发现 `tests/**/*.test.ts`；真实媒体服务器的启动与协议检查通过下节的集成测试命令执行。

提交检查由 [prek.toml](../prek.toml) 配置：先由 Oxlint 安全修复可修复的问题，再由 Oxfmt 格式化本次提交的文件；随后分别执行应用类型检查、Vitest、应用构建、品牌页类型检查和品牌页构建。自动修复产生改动时，检查修改并重新暂存后再提交。可用 `prek run --all-files` 检查整个仓库。

纯格式和风格检查由提交钩子兜底。Git 提交使用约定式提交格式，中文说明改动与验证。

## 媒体服务器集成测试

修改服务器认证、网页播放接管、媒体准备、队列、进度回传或媒体代理后，将本节作为开发验收的一环。先通过相关单元测试及类型检查，再运行自动集成检查，最后在 Electron 中验收受影响的网页和播放器行为。纯文案或布局修改按实际影响选择检查范围。

```mermaid
flowchart LR
    Change["相关代码修改"] --> Unit["定向单元测试与类型检查"]
    Unit --> Up["启动 Compose 并初始化媒体库"]
    Up --> API["真实协议与媒体代理检查"]
    API --> App["隔离 Electron 与本地播放器验收"]
    App --> Record["记录验证结果和未验证边界"]
    Record --> Down["停止或重置测试环境"]
```

需要可运行 Linux 容器的 Docker 引擎和 Docker Compose，支持 `service_completed_successfully` 依赖条件。通过 Docker API 兼容的 Podman 引擎也可运行，但应以当前环境的实际验证为准。不需要主机安装 ffmpeg；生成媒体的工具来自 Jellyfin 镜像。

```sh
pnpm integration:up
pnpm test:integration
pnpm integration:app
pnpm integration:down
```

`integration:up` 启动 [Compose 配置](../integration/compose.yaml) 中的服务，等待 HTTP 就绪，完成 Emby、Jellyfin 的首次设置，创建三个服务器的电影与剧集媒体库，并等待测试媒体扫描完成。重复运行保留媒体库和服务器身份，不重新修改已经初始化的账号。

| 服务器   | 默认地址                 | 登录方式                                                   |
| -------- | ------------------------ | ---------------------------------------------------------- |
| Emby     | `http://127.0.0.1:18097` | `freebo` / `freebo-integration-only`                       |
| Jellyfin | `http://127.0.0.1:18096` | `freebo` / `freebo-integration-only`                       |
| Plex     | `http://127.0.0.1:13240` | 测试实例允许本地桥接网络无令牌访问，无需认领或登录云端账号 |

这些账号只属于生成的本地测试数据。Plex 的 Personal Media Agent 使用本地文件信息，不依赖云端元数据匹配。端口仅发布到宿主机回环地址；不启用宿主网络、DLNA 发现、GPU 或硬件转码。

### 测试媒体与持久数据

Compose 的 `media-init` 服务生成四段 10 分钟的 MP4 测试视频，包含两条不同频率、分别标记为英语和中文的音轨，以及英文 SRT 外挂字幕。四段使用不同色相，以免服务器将相同文件去重，分别作为两部电影和同一季的两集剧集使用，便于验证电影、续播和跨集队列。时长用于满足服务器默认的继续观看规则；素材由 ffmpeg 生成，没有外部影视资源。

媒体和服务器配置分别使用项目命名卷。三个服务器以只读方式挂载测试媒体；`plex-init` 仅在首次运行时写入测试 Plex 配置。默认镜像通过多架构摘要固定；更新基线时先调整镜像并重跑验收，不自动跟随 `latest`。

启动脚本将认证状态写入 `.integration/<项目名>/state.json`，权限为 `0600`；自动检查报告写入同目录的 `report.json`，报告不包含令牌。`.integration/` 被 Git 忽略。`integration:app` 完整构建并启动真实 Electron，使用同目录的 `app/` 作为独立用户数据目录，预置三个测试服务器，保留该测试配置中的播放器选择；不会读取或覆盖日常 Freebo 配置。

首次打开测试应用时选择已安装的播放器，再打开相应媒体库。需要连接 Electron 的 CDP 调试时，可设置 `FREEBO_INTEGRATION_DEBUG_PORT=9228` 后运行 `pnpm integration:app`；调试端口绑定回环地址，默认不开启。Emby、Jellyfin 的测试账号在网页中输入；Plex 首次网页设置选择完成配置即可。

测试应用可以与日常 Freebo 同时运行。实例检测的范围和工作原理见 [架构文档](architecture.md#托盘与退出)。

### 自动检查范围

`pnpm test:integration` 使用项目实际的 Provider 和 PlaybackClient，对三个真实服务器逐一检查：

- 电影队列与静态媒体准备。
- 通过实际媒体代理读取 MP4 的 Range 响应。
- 第二条音轨的本地序号映射与外挂字幕读取。
- 模拟开始、暂停、恢复、停止事件，核对服务器持久保存的 150 秒续播点，再重新准备续播。
- 第一集扩展到两集队列，以及下一集的轨道匹配和从零播放。

任一断言失败，命令返回非零状态。重新运行会再次验证媒体读取和服务器记录，不以先前报告为依据。容器的 `healthy` 只表示 HTTP 服务就绪，不表示这些检查或真实播放已通过。

本命令模拟播放器事件，不启动本地播放器，不能代替网页接管、Electron IPC、播放器视频画面与轨道切换的人工验收。它也不覆盖 Plex 云端账号、已认领服务器、代理子路径、跨网络访问、硬件转码或各平台安装包；当前验证范围集中于 [架构文档](architecture.md#验证边界)。

### Electron 验收

运行 `pnpm integration:app` 后，对受影响的服务器检查原生播放／继续播放按钮是否启动选定的本地播放器，网页是否保持浏览状态，播放浮窗是否能暂停、跳转和停止。停止后确认服务器显示继续观看，再次播放从保存的位置恢复；打开第一集检查下一集和字幕／音轨选择。

修改 `electron/` 后关闭测试应用并重跑该命令，确保主进程、预加载和渲染端使用最新构建。记录所用服务器版本、操作系统、播放器和实际通过的步骤；没有操作过的项目保留为未验证。

### 状态、重置与多份检出

```sh
pnpm integration:status
pnpm integration:down
pnpm integration:reset
```

`integration:down` 停止并移除本项目容器和网络，保留命名卷及测试应用配置。`integration:reset` 还会删除本项目命名卷、认证状态、报告和测试应用配置；下次 `integration:up` 重新生成。先停止播放，并通过应用菜单或托盘退出 `integration:app`，再停止或重置服务器。命令只接受 `freebo-integration` 或 `freebo-integration-<后缀>` 的项目名，重置不会操作其他 Compose 项目或日常应用数据。镜像缓存保留以加快下次启动。

端口冲突、并行检出或测试另一组镜像时，可复制 [环境示例](../integration/.env.example) 为 `integration/.env`，修改项目名、端口或镜像，再执行启动命令。脚本从 Compose 实际解析结果取得地址，避免配置和检查使用不同端口。每个项目的本地状态与应用目录分别隔离。

首次拉取失败或初始化失败时，先检查命令输出与 `integration:status`；需要查看服务日志时运行 `docker compose -f integration/compose.yaml logs <服务名>`。若自己更改了测试账号密码或媒体库结构，使用 `integration:reset` 恢复基线。Docker 和媒体服务器日志可能含测试认证信息，不将完整日志或 `state.json` 纳入 Git。

集成测试按相关改动手动运行，不加入每次提交的 prek 或 `pnpm check`，也没有自动加入 CI。无图形环境可执行自动检查，但不能声称完成本地播放器验收。

## 打包与发布

`pnpm package` 构建应用并使用 electron-builder 生成当前平台产物，输出至 `release/`。升级机制与支持范围见 [架构文档](architecture.md#构建与升级)。

[GitHub Actions](../.github/workflows/ci.yml) 对外部 fork 的 Pull Request 执行三平台检查；普通分支推送及仓库内的 Pull Request 不重复检查。推送 `v*` 标签后构建安装包并创建草稿 Release，标签须与 `package.json` 版本一致。

发布时保留安装包、ZIP、blockmap、`latest*.yml` 和校验和；macOS arm64/x64 在同一次 builder 调用中生成，共用一份更新元数据。手动发布草稿后，更新器才会发现版本。

需要重新打包已有标签时，可手动运行同一工作流并指定 `release_tag`。工作流检出该标签并校验应用版本，使用当前工作流配置重新生成产物，无需移动版本标签。macOS 仅在对应 secret 非空时设置签名与公证环境变量；未配置时生成未签名安装包。

macOS 签名与公证使用 GitHub Actions secrets：

- `MAC_CSC_LINK`：Developer ID Application 的 P12 证书；`MAC_CSC_KEY_PASSWORD`：证书密码。
- `APPLE_ID`、`APPLE_APP_SPECIFIC_PASSWORD`、`APPLE_TEAM_ID`：公证凭据。

流水线已接入这些变量，是否已配置及签名安装行为仍需实际验收。本地检查未签名 ZIP 可运行：

```sh
pnpm exec electron-builder --mac zip --arm64 --x64 --publish never --config.mac.identity=null
```

此检查验证打包和更新元数据，不能作为 macOS 自动安装验收。

容器配置参考 [Emby 镜像说明](https://hub.docker.com/r/emby/embyserver)、[Jellyfin 容器文档](https://jellyfin.org/docs/general/installation/container/)、[LinuxServer Plex 镜像说明](https://docs.linuxserver.io/images/docker-plex/)，卷和清理行为参考 [Docker Compose 文档](https://docs.docker.com/reference/cli/docker/compose/down/)。
