# Freebo 品牌规范与素材

本文件是已选品牌的使用和复现依据。Freebo 使用友好的导盲犬标识与真实 Atma SemiBold 字标；应用设计系统见 [界面设计](../design.md)。正式素材位于 `assets/brand/freebo/`。

![Freebo](../../assets/brand/freebo/svg/logo.svg)

## 名称、字体与颜色

所有语言和品牌素材统一写作 **Freebo**，首字母大写。中文昵称只用于非正式交流，不进入标志、封面、图标或字标。项目路径继续使用 `freebo`。

| 项目      | 已定规范                                    |
| --------- | ------------------------------------------- |
| 字体      | Atma SemiBold，真实字重 600                 |
| 字距      | −0.015em；禁止合成粗体或手绘字母            |
| Deep Pine | `#193C35`：标识轮廓、字标与结构色           |
| Lime      | `#BDE64D`：标识亮点、分享素材与深色界面动作 |
| Paper     | `#FBFCF9`：品牌浅底与留白                   |
| 标识内部  | 三色平涂矢量；白色面部保持指定形状          |
| 正文      | 系统无衬线；Atma 只用于 Freebo 名称         |

字体来源为 [Google Fonts 的固定修订](https://github.com/google/fonts/tree/7085eb89a950e85db5b166b7a58d414544b4140c/ofl/atma)，修订号 `7085eb89a950e85db5b166b7a58d414544b4140c`。原始 [TTF](../../assets/brand/freebo/fonts/Atma-SemiBold.ttf)、由该 TTF 转换的 [WOFF2](../../assets/brand/freebo/fonts/Atma-SemiBold.woff2) 与 [SIL OFL 1.1 原文](../../assets/brand/freebo/fonts/OFL.txt) 一并交付。版权声明为 Copyright 2010 The Atma Project Authors (https://github.com/BlackFoundryCom/Atma)。分发字体时保留许可证；应用打包同时保留 [Atma-OFL.txt](../licenses/Atma-OFL.txt)。应用代码许可证仍为 Apache-2.0。

## 主稿与组合

- [source/mark.svg](../../assets/brand/freebo/source/mark.svg)：可编辑路径主稿；来源信息保留于 SVG 元数据，主稿为纯路径。
- [source/wordmark-editable.svg](../../assets/brand/freebo/source/wordmark-editable.svg) 与 [source/logo-editable.svg](../../assets/brand/freebo/source/logo-editable.svg)：保留真实字体文字并内嵌对应字体的编辑源；它们是排版源，不是手绘字母。
- [svg/logo.svg](../../assets/brand/freebo/svg/logo.svg) 等便携 SVG：用 HarfBuzz 排字、fontTools 转字形路径，无字体安装依赖，也不嵌入位图。
- [brand.json](../../assets/brand/freebo/brand.json)：字体摘要、配色、组合几何和 PNG 渲染任务的机器可读记录。

横向组合中，犬头高度为字标**可见字形高度**的 1.1 倍，间距为该高度的 0.1 倍。按可见边界中心垂直对齐，保留犬头宽高比、非对称耳朵与表情。不要以 CSS 行高替代字形高度，也不要分别缩放犬头与名称。

组合外留白至少为犬头高度的四分之一。横向标志宽度至少 120px，独立犬头至少 24px；16px 使用专用应用图标。空间适合竖向时使用已生成的 stacked 版本。保持比例，不添加模糊、阴影、描边、新颜色或中文文字。

系统托盘使用独立的 [小尺寸矢量源](../../resources/tray/mark.svg)，按主稿保留一立一垂的耳朵、向右伸出的口鼻、长下颌与面部白斑，省略细碎毛边。不要将脸型改成正面圆脸，也不要将完整犬头直接缩小到托盘尺寸。托盘符号仅用于系统状态区，不替代品牌主稿；macOS 模板以外轮廓和面部白斑为不透明区，鼻子、嘴和深色毛发为透明区，避免深色菜单栏将毛发显示成大片白色。Windows/Linux 使用松绿与青柠色版本。`pnpm tray:generate` 用 Electron 导出 20px 与 40px（Retina）PNG，运行时读取 `resources/tray/`，打包时随资源复制。

## 交付素材

[完整 ZIP](../../assets/brand/freebo/Freebo-brand-kit.zip) 包含矢量主稿、字体与许可、导出素材和本说明。[单页 PDF 指南](../../assets/brand/freebo/Freebo-brand-guide.pdf) 用于快速查阅。[manifest.json](../../assets/brand/freebo/manifest.json) 记录 58 份素材的大小和 SHA-256；清单不包含它自身与 ZIP。

| 用途           | 文件与规则                                                                                                                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 浅底主标志     | [SVG](../../assets/brand/freebo/svg/logo.svg) / [PNG](../../assets/brand/freebo/png/logo.png)                                                                                                                                                   |
| 深松绿底       | [SVG](../../assets/brand/freebo/svg/logo-on-dark.svg) / [PNG](../../assets/brand/freebo/png/logo-on-dark.png)；使用浅色字标                                                                                                                     |
| 单色印刷       | [pine mono](../../assets/brand/freebo/svg/logo-mono.svg)、[black](../../assets/brand/freebo/svg/logo-black.svg)、[white](../../assets/brand/freebo/svg/logo-white.svg)；面部为真实透明镂空，不用灰度滤镜替代                                    |
| 上下组合       | [浅底](../../assets/brand/freebo/svg/logo-stacked.svg) / [深底](../../assets/brand/freebo/svg/logo-stacked-on-dark.svg)，对应 PNG 在 `png/`                                                                                                     |
| 独立标识与名称 | `svg/mark-{color,pine,white,black}.svg`、`svg/wordmark-{pine,white,black,lime}.svg`，对应 PNG 在 `png/`                                                                                                                                         |
| 应用图标       | [SVG](../../assets/brand/freebo/icons/app-icon.svg)、16/24/32/48/64/128/256/512/[1024px PNG](../../assets/brand/freebo/icons/icon-1024.png)、[ICO](../../assets/brand/freebo/icons/icon.ico)、[ICNS](../../assets/brand/freebo/icons/icon.icns) |
| 分享封面       | [1280 × 640](../../assets/brand/freebo/social/social.png) / [1600 × 900](../../assets/brand/freebo/social/cover-16x9.png)，均保留 SVG                                                                                                           |
| 桌面壁纸       | 2560 × 1440：[深松绿](../../assets/brand/freebo/wallpapers/wallpaper-pine.png) / [浅底](../../assets/brand/freebo/wallpapers/wallpaper-paper.png)，均保留 SVG                                                                                   |

下载页实现为 [BrandKit.tsx](brand-kit/src/BrandKit.tsx)。应用通过 [Brand.tsx](../../src/components/Brand.tsx) 使用便携组合，名称使用本地 Atma WOFF2。生成过程同步 `public/brand/`、`public/fonts/`、`public/icon.*`、`resources/`与 `docs/assets/social.png`。这些副本应重新生成，不应各自修改。下载预览直接读取 `assets/brand/freebo/`，不另存一份完整品牌素材。

## 复现与预览

在仓库根目录运行；需要现有 pnpm/Electron 依赖、Python 3.10 或更新版本和 `uv`。Python 脚本用内联依赖声明管理 fontTools、HarfBuzz、Brotli 与 Pillow。

```sh
pnpm install
pnpm brand:generate
pnpm brand:preview
```

`brand:generate` 依次运行 `uv run scripts/generate-brand.py`、Electron 渲染和 `uv run scripts/package-brand.py`：从路径主稿和固定字体生成便携/编辑 SVG、栅格 PNG、PDF、原生图标容器、清单与 ZIP，并同步运行副本。`source/mark.svg`、`fonts/Atma-SemiBold.ttf` 和 `fonts/OFL.txt` 是保留的正式输入，是生成素材的输入。

路径调整应先编辑 `source/mark.svg`，再运行完整生成并核对导出。

[品牌下载页](http://127.0.0.1:5186/brand.html) 与根地址均展示正式素材。执行 `pnpm brand:check` 检查下载页类型并构建静态产物，输出在忽略的 `docs/brand/brand-kit/dist/`。

PDF 页面源为 [brand-guide.html](brand-kit/brand-guide.html)。PDF、PNG 使用 Electron Chromium 渲染；修改指南或品牌源后重新运行 `pnpm brand:generate`。清单用于验证现有输出，PDF 的重新生成不承诺二进制逐字节一致。

ZIP 内目录直接包含 `source/`、`fonts/`、`svg/` 等素材。本说明中的仓库链接以 `docs/brand/README.md` 为相对位置；脱离仓库阅读时按 ZIP 内同名路径查找文件。
