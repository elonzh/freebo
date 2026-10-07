# Freebo 品牌素材页

本页用于预览和下载已选 Atma 品牌，规范见 [品牌说明](../README.md)，应用设计系统见 [界面设计](../../design.md)。入口是 `index.html` 与兼容原地址的 `brand.html`，共用同一页面实现。

页面保持深松绿 `#193C35`、青柠绿 `#BDE64D` 与浅底 `#FBFCF9`。辅助文字使用 `#52675B`，深色页头辅助文字使用 `#DCE8D0`，分隔线使用 `#D8E1D3`。控件沿用应用的 shadcn Button。

正文为系统无衬线 15px，章节标题 25px。品牌介绍允许使用 Atma 600、字距 −0.015em、行高 1.15：桌面 42px，900px 以下 33px，620px 以下 36px。素材名称与说明为 11–14px。应用中的 Atma 使用仍仅限产品名称。

主容器最大宽度 1450px，桌面横向留白 5vw，窄屏为 20px。桌面介绍为两列，标志网格三列；900px 以下网格两列，620px 以下各区转为单列。图标样例行独立横向滚动。主标志舞台圆角 16px，色样 10px，标志样例与封面 12px。

标志保持正式源文件的比例、颜色与透明镂空。下载直接指向 `assets/brand/freebo/` 的文件，Vite 将其作为公共素材目录；不保留第二套完整素材。颜色复制提供可访问状态反馈，所有下载链接和桌面/窄屏布局由 [验证脚本](../../../scripts/brand/verify-kit.cjs) 检查。

维护入口：[页面](src/BrandKit.tsx)、[样式](src/brand-kit.css)、[基础样式](src/style.css)、[构建配置](vite.config.ts)、[PDF 页面源](brand-guide.html)。
