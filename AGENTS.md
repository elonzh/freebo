
## 技术栈

- pnpm
- Electron
- react
- typescript
- oxlint/oxformat
- shadcn
- vitest
- prek

## 开发指引

- Git 提交消息遵循约定式提交（Conventional Commits）规范，并使用中文说明
- 使用 prek 作为 precommit 检查工具
- 使用 shadcn 提供的组件和样式，只保留必要的 CSS 样式，保持 UI 风格一致
- 更新版本号时确保打上 git 标签, 对比上个版本的变更并更新发布日志
- 如果需要连接调试, 请连接 Electron 浏览器引擎而不是使用普通浏览器, 因为程序依赖 IPC 调用

## 文档说明

- 面向开发者、被版本控制的正式文档统一放在 `docs/` 下
- 系统设计文档优先使用 Mermaid Chart 绘图，不使用 ASCII 图
