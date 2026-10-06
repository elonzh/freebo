export type Locale = "zh" | "en";
export type Language = "system" | Locale;
const messages = {
  brand: ["Freebo", "Freebo"],
  appHome: ["主页", "Home"],
  homeEmptyTitle: ["还没有添加服务器", "No servers yet"],
  homeEmptyDescription: ["添加服务器以打开媒体库。", "Add a server to open your library."],
  serverManagement: ["服务器管理", "Server management"],
  save: ["保存", "Save"],
  signInRequired: ["请在网页中登录", "Sign in on the website"],
  pageReady: ["网页已打开", "Website open"],
  playbackInfo: ["播放信息与列表", "Playback information and queue"],
  openPlayingItem: ["打开正在播放的资源", "Open the playing item"],
  noPlayback: ["还没有播放视频", "No video playing"],
  noPlaybackDescription: ["在服务器网页选择视频播放。", "Play a video on the server website."],
  closePlayback: ["关闭播放浮窗", "Close playback panel"],
  playbackError: ["播放出错", "Playback error"],
  setup: ["快速配置", "Quick setup"],
  setupWelcome: ["欢迎使用 Freebo", "Welcome to Freebo"],
  setupDescription: [
    "连接媒体库，用本地播放器观看。",
    "Connect your library and watch in your local player.",
  ],
  startSetup: ["开始配置", "Start setup"],
  setupLater: ["稍后配置", "Set up later"],
  setupPlayer: ["选择你的播放器", "Choose your player"],
  scanningPlayers: ["正在查找本地播放器…", "Finding local players…"],
  nextStep: ["下一步", "Continue"],
  previousStep: ["上一步", "Back"],
  playerLater: ["稍后选择播放器", "Choose a player later"],
  setupServer: ["添加媒体服务器", "Add a media server"],
  useExistingServer: ["使用已添加的服务器", "Use an existing server"],
  setupComplete: ["配置完成", "Setup complete"],
  openServer: ["打开服务器", "Open server"],
  finishSetup: ["进入主页", "Go to Home"],
  playerNotConfigured: ["播放器尚未配置", "Player not configured"],
  serverNotConfigured: ["服务器尚未添加", "Server not added"],
  servers: ["服务器", "Servers"],
  settings: ["设置", "Settings"],
  addServer: ["添加服务器", "Add server"],
  editServer: ["编辑服务器", "Edit server"],
  chooseServer: ["选择服务器", "Choose a server"],
  closeServerMenu: ["关闭服务器列表", "Close server list"],
  open: ["打开", "Open"],
  back: ["后退", "Back"],
  forward: ["前进", "Forward"],
  reload: ["重新加载", "Reload"],
  home: ["服务器首页", "Server home"],
  address: ["地址", "Address"],
  openSettings: ["打开设置", "Open settings"],
  manageServers: ["管理服务器", "Manage servers"],
  closeTab: ["关闭 {name} 标签页", "Close {name} tab"],
  newTab: ["新建服务器标签页", "New server tab"],
  connecting: ["正在连接…", "Connecting…"],
  connectionFailed: ["连接失败", "Connection failed"],
  ready: ["本地播放已就绪", "Local playback ready"],
  adapterLoading: ["正在准备播放器…", "Preparing playback…"],
  close: ["关闭", "Dismiss"],
  cancel: ["取消", "Cancel"],
  preview: [
    "请打开桌面应用，添加服务器并播放视频。",
    "Open the desktop app to add a server and play videos.",
  ],
  loading: ["正在打开 {name}…", "Opening {name}…"],
  serverDescription: [
    "添加地址，在服务器网页中登录。",
    "Add an address, then sign in on the server website.",
  ],
  emptyTitle: ["添加你的媒体服务器", "Add your media server"],
  emptyDescription: [
    "浏览媒体库，点击播放，自动打开本地播放器。",
    "Browse your library. Click play to open your local player.",
  ],
  supportedServer: ["目前支持 Emby Server", "Currently supports Emby Server"],
  playerFound: ["已找到 {name}", "{name} detected"],
  noPlayerYet: ["尚未找到播放器", "No player detected"],
  installGuide: ["安装与配置指引", "Installation and setup"],
  videos: ["电影、剧集与视频播放列表", "Movies, episodes and video playlists"],
  choosePlayer: ["选择播放器", "Choose a player"],
  players: ["播放器", "Players"],
  playback: ["播放", "Playback"],
  appearance: ["外观与语言", "Appearance and language"],
  diagnostics: ["诊断", "Diagnostics"],
  about: ["关于", "About"],
  scan: ["重新扫描", "Scan again"],
  defaultPlayer: ["默认播放器", "Default player"],
  default: ["默认", "Default"],
  noPlayers: ["还没有找到播放器", "No player detected"],
  noPlayersDescription: [
    "安装播放器后重新扫描，或手动选择。",
    "Install a player and scan again, or select one manually.",
  ],
  iinaGuide: [
    "适合 macOS，支持鼠标操作和 mpv 快捷键。",
    "For macOS, with mouse controls and mpv shortcuts.",
  ],
  mpvnetGuide: ["适合 Windows，带图形界面的 mpv 播放器。", "A graphical mpv player for Windows."],
  mpvGuide: [
    "支持三个平台，主要通过快捷键操作。",
    "Available on all three platforms, mainly controlled with keyboard shortcuts.",
  ],
  vlcGuide: [
    "支持三个平台，提供常用的播放控件。",
    "Available on all three platforms, with familiar playback controls.",
  ],
  potplayerGuide: [
    "适合 Windows，支持队列控制与进度回传。音轨与内嵌字幕请在播放器内选择。",
    "For Windows, with queue controls and progress sync. Select audio and embedded subtitles in the player.",
  ],
  mpcGuide: [
    "适合 Windows，通过原生消息接口控制播放与回传进度。",
    "For Windows, with native playback controls and progress sync.",
  ],
  playerConnection: [
    "无法读取播放器状态，请确认已安装完整播放器，并以相同权限运行 Freebo 和播放器。",
    "Cannot read player status. Install the full player and run it with the same privileges as Freebo.",
  ],
  copyDiagnostics: ["复制诊断信息", "Copy diagnostics"],
  copiedDiagnostics: ["已复制", "Copied"],
  reportIssue: ["反馈问题", "Report an issue"],
  refreshDiagnostics: ["刷新", "Refresh"],
  diagnosticsDescription: [
    "查看运行环境、连接状态和播放进度回传结果。诊断不包含保存的账号密码，日志中的链接与访问令牌会隐藏。",
    "Check the environment, connection and playback sync. Saved credentials are excluded; links and access tokens in logs are hidden.",
  ],
  runtimeInfo: ["运行环境", "Environment"],
  systemInfo: ["系统", "System"],
  connectionInfo: ["连接与播放", "Connection and playback"],
  serverCount: ["已保存服务器", "Saved servers"],
  webState: ["服务器页面", "Server page"],
  adapterState: ["播放接管", "Playback integration"],
  playbackState: ["播放状态", "Playback status"],
  playbackPosition: ["播放位置 / 时长", "Position / duration"],
  syncState: ["进度回传", "Progress sync"],
  syncPending: ["正在回传", "Sending"],
  syncSuccess: ["回传成功", "Sent successfully"],
  serverPlaybackRecord: ["服务器观看记录", "Server watch record"],
  recordUnavailable: [
    "无法读取服务器保存的观看记录",
    "Could not read the saved server watch record",
  ],
  recordPending: [
    "停止播放后核对服务器保存的记录",
    "The saved server record is checked after playback stops",
  ],
  recordPlayCount: ["播放 {count} 次", "Played {count} times"],
  savedResumePosition: ["保存的进度：{position}", "Saved position: {position}"],
  belowResumeThreshold: [
    "此媒体库要求至少播放到 {position} 才保留继续观看进度。",
    "This library retains a resume point only after {position}.",
  ],
  resumePositionCleared: [
    "服务器保存的进度为 0，请检查 Emby 媒体库的继续观看规则。",
    "The server saved a zero position. Check the Emby library's resume rules.",
  ],
  syncFailure: ["回传失败", "Sync failed"],
  syncNone: ["尚未回传", "No reports yet"],
  syncStart: ["开始播放", "Playback started"],
  syncProgress: ["播放进度", "Playback progress"],
  syncStop: ["停止播放", "Playback stopped"],
  passwordStorage: ["系统密码存储", "System credential storage"],
  available: ["可用", "Available"],
  notOpen: ["尚未打开", "Not open"],
  waiting: ["等待就绪", "Waiting"],
  unavailable: ["不可用", "Unavailable"],
  recentEvents: ["最近事件", "Recent events"],
  noEvents: ["尚无诊断事件", "No diagnostic events yet"],
  productPage: ["产品页面", "Product page"],
  githubRepository: ["GitHub 仓库", "GitHub repository"],
  download: ["官网下载安装", "Download from website"],
  manualPlayer: ["手动选择 {name}", "Select {name} manually"],
  manualHint: ["已经安装？选择应用或可执行文件", "Already installed? Select the app or executable"],
  autoNext: ["连续播放", "Continuous playback"],
  autoNextDescription: [
    "自动播放列表中的下一项。",
    "Play the next item in the queue automatically.",
  ],
  fullscreen: ["全屏启动", "Start in fullscreen"],
  theme: ["应用外观", "App appearance"],
  system: ["跟随系统", "System default"],
  light: ["浅色", "Light"],
  dark: ["深色", "Dark"],
  language: ["应用语言", "App language"],
  signOut: ["退出登录", "Sign out"],
  stopLoading: ["停止加载", "Stop loading"],
  credentialsHint: ["保存后自动填写账号密码。", "Autofill saved account and password."],
  testConnection: ["测试连接", "Test connection"],
  testingConnection: ["正在测试…", "Testing…"],
  connectionVerified: [
    "已连接 {name}，账号密码验证成功。",
    "Connected to {name}. Account verified.",
  ],
  serverReachable: ["已连接 {name}。", "Connected to {name}."],
  connectionTestFailed: [
    "无法连接服务器，请检查地址和网络。",
    "Cannot connect. Check the address and network.",
  ],
  connectionTimeout: [
    "连接超时，请检查服务器地址和网络。",
    "Connection timed out. Check the address and network.",
  ],
  credentialsRejected: [
    "账号或密码不正确，或此账号没有登录权限。",
    "The account or password is incorrect, or sign-in is not allowed.",
  ],
  unexpectedServer: [
    "服务器未返回有效的 Emby 数据，请检查地址。",
    "The server did not return valid Emby data. Check the address.",
  ],
  username: ["账号", "Account"],
  password: ["密码", "Password"],
  forgetCredentials: ["清除已保存的账号密码", "Forget saved account and password"],
  credentialsUnavailable: [
    "系统密码存储不可用，暂时无法记住账号密码。请在服务器网页登录。",
    "System password storage is unavailable. Sign in on the server website for now.",
  ],
  credentialsUnreadable: [
    "无法读取保存的账号密码。请清除后重新保存，或在服务器网页登录。",
    "Saved credentials could not be read. Forget them and save again, or sign in on the server website.",
  ],
  remove: ["移除 {name}", "Remove {name}"],
  signOutConfirm: [
    "退出 {name} 的登录？已保存的账号密码会保留。",
    "Sign out of {name}? Saved account and password will be kept.",
  ],
  removeConfirm: [
    "移除 {name}？服务器中的媒体不会被删除。",
    "Remove {name}? Media on the server will be kept.",
  ],
  noServers: ["尚未添加服务器。", "No servers added."],
  log: ["诊断日志", "Diagnostic log"],
  logDescription: [
    "导出时隐藏密码和访问令牌。",
    "Passwords and access tokens are hidden in exports.",
  ],
  exportLog: ["导出日志", "Export log"],
  checkSettings: ["检查设置", "Check settings"],
  preparing: ["正在准备播放…", "Preparing playback…"],
  preparingCount: ["正在准备 {count} 项", "Preparing {count} items"],
  ended: ["播放已结束", "Playback ended"],
  paused: ["已暂停", "Paused"],
  playing: ["正在播放", "Playing"],
  previous: ["上一项", "Previous item"],
  next: ["下一项", "Next item"],
  resume: ["继续播放", "Resume playback"],
  pause: ["暂停播放", "Pause playback"],
  stop: ["停止播放", "Stop playback"],
  position: ["播放进度", "Playback position"],
  queue: ["播放列表", "Play queue"],
  itemCount: ["{count} 项", "{count} items"],
  serverType: ["服务器类型", "Server type"],
  serverAddress: ["服务器地址", "Server address"],
  name: ["名称", "Name"],
  optional: ["可选", "Optional"],
  myServer: ["我的 Emby", "My Emby"],
  saving: ["正在保存…", "Saving…"],
  saveOpen: ["保存并打开", "Save and open"],
  invalidOrigin: ["请求来源无效。", "Invalid request origin."],
  serverMissing: ["服务器不存在，请重新选择。", "Server not found. Choose another server."],
  externalNavigation: [
    "网页尝试打开其他网站。请在浏览器中完成外部操作。",
    "The page tried to open another website. Complete that action in your browser.",
  ],
  webFailed: [
    "服务器页面无法打开（{code}）。请检查地址和网络后重试。",
    "Cannot open the server page ({code}). Check its address and your connection, then reload.",
  ],
  selectPlayerTitle: ["选择 {name}", "Select {name}"],
  playerApp: ["播放器应用", "Player app"],
  playerMissing: ["播放器不存在，请重新扫描。", "Player not found. Scan again."],
  playbackOrigin: ["播放地址与服务器不匹配。", "The playback address does not match the server."],
  noPlayer: [
    "没有找到播放器。请在设置中安装或选择播放器。",
    "No player found. Install or select a player in Settings.",
  ],
  invalidUrl: [
    "请输入 HTTP 或 HTTPS 服务器地址，地址中不要包含用户名和密码。",
    "Enter an HTTP or HTTPS server address without a username or password.",
  ],
  settingsUnreadable: [
    "设置文件无法读取。请保留原文件并通过诊断日志检查原因。",
    "Cannot read the settings file. Keep the original file and check the diagnostic log.",
  ],
  serverDuplicate: [
    "这个服务器已经添加过了。请从主页打开，或在设置中编辑已有服务器。",
    "This server has already been added. Open it from Home or edit the existing server in Settings.",
  ],
  mediaUnreadable: [
    "播放器无法读取视频。请检查网络连接或尝试其他播放器。",
    "The player cannot read this video. Check your connection or try another player.",
  ],
  playerStartFailed: [
    "播放器启动失败。请在设置中重新选择播放器。",
    "The player could not start. Select it again in Settings.",
  ],
  playerClosed: ["播放器已关闭，请重新播放。", "The player has closed. Start playback again."],
  vlcConnection: [
    "无法连接 VLC。请确认 VLC 的 HTTP 接口可用，或选择 mpv 播放器。",
    "Cannot connect to VLC. Check its HTTP interface or choose an mpv player.",
  ],
  vlcNotReady: ["VLC 尚未就绪，请重新播放。", "VLC is not ready. Start playback again."],
  skipItem: [
    "无法准备「{name}」，已跳过。可以稍后在服务器中重试。",
    "Could not prepare “{name}”. It was skipped; try it again from your server later.",
  ],
  playbackFailed: ["播放失败，请重新尝试。", "Playback failed. Try again."],
  syncFailed: [
    "观看进度暂时未同步。请检查服务器连接。",
    "Watch progress has not synced. Check your server connection.",
  ],
  itemMissing: ["播放项不存在，请重新选择。", "Playback item not found. Select it again."],
  positionInvalid: ["播放位置无效。", "Invalid playback position."],
  ipcConnection: [
    "无法连接播放器。请确认支持 mpv IPC，或重新选择播放器。",
    "Cannot connect to the player. Check mpv IPC support or select it again.",
  ],
  ipcClosed: [
    "播放器连接已关闭，请重新播放。",
    "The player connection has closed. Start playback again.",
  ],
  ipcTimeout: ["播放器响应超时，请重新播放。", "The player did not respond. Start playback again."],
  ipcCommand: ["播放器命令失败：{detail}", "Player command failed: {detail}"],
  authExpired: [
    "登录已过期，请在 Emby 网页重新登录。",
    "Your session has expired. Sign in again on the Emby website.",
  ],
  serverRequest: [
    "Emby 请求失败（{code}）。请检查服务器连接。",
    "Emby request failed ({code}). Check your server connection.",
  ],
  queueTooLarge: [
    "播放列表超过一万项，请选择较小的列表。",
    "This playlist exceeds 10,000 items. Choose a smaller playlist.",
  ],
  noVideo: [
    "这个列表中没有可播放的视频。音乐和直播请使用 Emby 网页播放。",
    "There are no playable videos in this list. Play music and live TV on the Emby website.",
  ],
  noSource: [
    "服务器没有返回可播放的视频版本。",
    "The server did not return a playable video version.",
  ],
  sourceMissing: [
    "选择的视频版本已经不可用，请在 Emby 中重新选择。",
    "This video version is no longer available. Select another version in Emby.",
  ],
  providerMissing: ["暂不支持这个服务器类型。", "This server type is not supported yet."],
  invalidInput: ["输入无效，请检查填写内容。", "Invalid input. Check the values you entered."],
  actionFailed: [
    "操作失败，请检查设置或导出诊断日志。",
    "The action failed. Check Settings or export the diagnostic log.",
  ],
  adapterFailed: [
    "播放适配器未就绪，请重新加载服务器页面。",
    "The playback adapter is not ready. Reload the server page.",
  ],
  editMenu: ["编辑", "Edit"],
  viewMenu: ["视图", "View"],
  windowMenu: ["窗口", "Window"],
  quit: ["退出", "Quit"],
  undo: ["撤销", "Undo"],
  redo: ["重做", "Redo"],
  cut: ["剪切", "Cut"],
  copy: ["复制", "Copy"],
  paste: ["粘贴", "Paste"],
  selectAll: ["全选", "Select all"],
  zoomIn: ["放大", "Zoom in"],
  zoomOut: ["缩小", "Zoom out"],
  resetZoom: ["实际大小", "Actual size"],
  toggleFullscreen: ["切换全屏", "Toggle fullscreen"],
  minimize: ["最小化", "Minimize"],
  closeWindow: ["关闭窗口", "Close window"],
  development: ["开发", "Development"],
  capture: ["保存界面截图", "Save screenshot"],
} as const;
export type MessageKey = keyof typeof messages;
export function resolveLocale(language: Language, systemLocale: string): Locale {
  return language === "system" ? (/^zh(?:[-_]|$)/i.test(systemLocale) ? "zh" : "en") : language;
}
export function translate(
  locale: Locale,
  key: MessageKey,
  params: Record<string, string | number> = {},
): string {
  return messages[key][locale === "zh" ? 0 : 1].replace(/\{(\w+)\}/g, (match, name: string) =>
    String(params[name] ?? match),
  );
}
const prefix = "FREEBO_ERROR:";
export function errorToken(key: MessageKey, params: Record<string, string | number> = {}): string {
  return prefix + JSON.stringify({ key, params });
}
export class UserFacingError extends Error {
  constructor(key: MessageKey, params?: Record<string, string | number>) {
    super(errorToken(key, params));
  }
}
export function localizeError(locale: Locale, error: unknown): string {
  const text =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : error == null
          ? ""
          : translate(locale, "actionFailed");
  const marker = text.indexOf(prefix);
  if (marker >= 0) {
    try {
      const { key, params } = JSON.parse(text.slice(marker + prefix.length)) as {
        key: MessageKey;
        params: Record<string, string | number>;
      };
      if (key in messages) return translate(locale, key, params);
    } catch {
      /* Unexpected system errors retain their diagnostic detail. */
    }
  }
  return text.replace(/^Error invoking remote method '[^']+': (?:Error: )?/, "");
}
export const messageKeys = Object.keys(messages) as MessageKey[];
