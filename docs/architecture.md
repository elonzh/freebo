# Freebo 架构

Freebo 使用服务器原有网页提供浏览与登录，把视频播放交给本地播放器。当前只有 Emby Provider；注册表可扩展到其他服务器，界面不会列出尚未实现的支持项。

## 服务器边界

`electron/providers/types.ts` 定义两个接口：

- `MediaServerProvider`：提供服务器名称、地址归一化、网页入口、资源详情地址、隔离预加载脚本、注入脚本和播放请求解析。
- `PlaybackClient`：解析队列、准备媒体及报告开始、进度、停止事件。

`ProviderRegistry` 负责注册、查找与会话分区。每个服务器记录包含 `providerId`，旧记录缺省为 `emby`。Emby 保留原有浏览器分区名，使升级后的登录会话可以继续使用。

Emby 的网络 DTO、认证、字幕、音轨、版本和网页模块细节仅存在于 `electron/providers/emby/`。播放管理器使用通用的 `PlaybackItem`、`PlaybackSource`、`PreparedMedia` 和 `PlayIntent`，不依赖 Emby 的字段格式。测试使用独立的假 Provider 和假客户端验证这条边界。

## 播放与安全

Emby 网页主世界只暴露窄的播放请求桥。主进程校验请求来源必须是当前服务器的主框架，并校验认证地址属于注册服务器的来源和子路径。网页视图禁用 Node.js，启用 sandbox、context isolation 和 web security。

媒体代理与播放器适配器负责本机传输和播放器通信；播放管理器处理会话切换、队列、断点、跨集轨道匹配和观看进度。新增服务器不需要重写这套播放器生命周期，但需要实现其认证、媒体解析及进度协议。

## 桌面与语言

React 渲染标签栏、工具栏、首次配置、主页和设置。主页只展示服务器；管理操作进入设置。首次进入播放器配置时扫描一次，结果及完成标记持久化；以后按需手动扫描，启动时不重新扫描。

Electron 使用隐藏标题栏配合各平台原生窗口控制。服务器网页保留 88px 顶栏之外的完整区域；服务器或通用错误只在出现时预留 64px。播放信息和列表由地址栏按钮打开独立的原生子窗口，不挤压网页。该窗口使用本地沙箱预加载，通过受校验的 IPC 控制播放器，支持关闭、失焦收起和当前资源详情跳转。

Emby 接管由沙箱预加载在 DOMContentLoaded 时安装。先等待网页自己的登录连接，再加载播放模块；登录页与接管状态区分，初始化超时只自动重新加载一次，避免无限重试。

网页加载状态由 `did-start-loading` / `did-stop-loading` 驱动，DOM 就绪后仍等待资源加载完成才结束标签图标动画。加载时工具栏刷新按钮变为停止，调用 `webContents.stop()`；失败页面保留错误与恢复操作。非激活标签使用完整圆角 hover 背景，内部标题按钮保持透明，激活标签与工具栏连接，关闭按钮保留独立的圆形操作反馈。

标签页监听 Electron `page-favicon-updated`，使用服务器会话读取网站实际提供的图标，转换为图片 data URL 后传给自有界面，保持现有 CSP。图标限制格式、大小、候选数量和读取时间，按服务器 ID 与注册地址保存在内存中；异步结果不会覆盖已切换的网页。加载期间显示转圈图标，尚无有效缓存或图片解码失败时显示通用网站图标。

## 账号密码

添加或编辑服务器时直接显示账号密码表单，填写账号后保存即可记住，留空可仅保存服务器。`CredentialStore` 将账号和密码一起加密，存入用户数据目录的 `credentials.json`，不写入 `settings.json`、广播的 `AppState` 或诊断日志。文件采用原子替换和 `0600` 权限，写入串行化；加密或解密失败不会降级为明文。当前使用 Electron [safeStorage 异步接口](https://www.electronjs.org/docs/latest/api/safe-storage)，Linux 缺少系统密钥存储时禁用保存。

凭据绑定服务器 ID、Provider 和完整注册地址。主进程只向当前网页主框架的隔离预加载世界返回凭据，并检查来源和反向代理子路径；等待系统密钥读取期间若页面发生导航，则丢弃结果。凭据读取接口不暴露给网页主世界。

Emby 预加载在登录路由观察延迟出现的表单，兼容 `startup/manuallogin.html` 等部署路径和动态字段 ID，只填写可见的账号及现有密码字段，发送 `input` / `change` 事件，不自动提交。已输入的其他账号、密码及密码创建字段保持原样。退出登录只清除网页会话，保存的账号密码仍可自动填入；清空字段或点击清除后保存会忘记凭据，移除服务器同时移除凭据。修改服务器地址会清空表单中的旧凭据，需要明确重新填写后才会保存到新地址。

测试连接通过自有页面 IPC 调用 Provider，主进程规范化地址，使用 Electron Session 请求 Emby 的公开信息接口；填写账号时再调用 [Users/AuthenticateByName](https://dev.emby.media/doc/restapi/User-Authentication.html)。密码只放在请求体中，不跟随重定向。测试成功后尝试注销测试令牌，仅向渲染端返回服务器名称与是否通过认证，不保存凭据或更改网页登录会话。测试失败不会将上游响应体或网络异常中的敏感内容写入诊断；表单修改后清除旧测试结果。

```mermaid
sequenceDiagram
    participant UI as Freebo 服务器表单
    participant Main as Electron 主进程
    participant Vault as 系统加密与本地凭据文件
    participant Preload as Emby 隔离预加载
    participant Page as Emby 登录表单
    UI->>Main: 保存服务器及可选凭据
    Main->>Vault: 加密并原子写入
    Preload->>Main: 请求当前服务器凭据
    Main->>Main: 校验主框架、来源、路径及导航状态
    Main->>Vault: 解密
    Main-->>Preload: 账号密码
    Preload->>Page: 填写空白字段并触发输入事件
    Note over Page: 用户确认并提交登录
```

中文和英文文案由 `src/shared/i18n.ts` 管理。主进程返回带键和参数的错误，渲染端按当前语言翻译，因此切换语言也会更新已经显示的错误。服务器网页自身的语言由服务器控制。

## 界面组件与样式

通用控件使用 shadcn/ui，源码保存在 `src/components/ui/`；`components.json` 配置组件生成路径，Vite 接入 Tailwind CSS v4。按钮、输入框、标签、开关、单选组、进度条和折叠区共享组件实现。`OptionSelect` 组合 shadcn Select，统一主题、语言、Provider 和向导服务器选择，菜单通过 Portal 展示并继承根节点主题。

页面布局使用 Tailwind。`src/style.css` 仅保留主题变量、基础排版、Electron 标题栏及地址栏规则和减少动态效果设置。系统外观变化同步 `.dark` 类，保证页面控件与弹出菜单一致；组件状态样式由 shadcn 管理，避免页面 CSS 覆盖下拉选项或禁用状态。

## 构建与升级

开发和生产共同使用 `scripts/build-electron.mjs`，先清理编译目录，再生成固定的 `main.cjs`、`preload.cjs`、`emby-preload.cjs`，避免移动源文件后误加载旧桥接脚本。

更名后用户数据目录为 `Freebo`。首次启动仅在新目录不存在时复制旧应用配置及浏览器会话，不覆盖现有目录，也不删除旧目录。配置新增的语言和 Provider 字段均有默认值。
