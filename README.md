# 一叶一石 · 品牌介绍网站

lim tê 翎茶 与 山下夆 的本地品牌介绍站。一个页面里装着两个品牌世界，用 iOS 26 / Liquid Glass 的材质与动效语言组织：玻璃层、弹簧、动量、可打断的转场。

## 打开方式

- 双击 `打开网站.cmd`（推荐）
- 或直接用 Chrome / Edge 打开 `index.html`
- 无需服务器、无需联网；所有字体、图片都在 `assets/` 里

建议使用较新的 Chromium 内核浏览器（Chrome / Edge 120+），以完整获得：
View Transitions 跨世界转场、圆形外观切换、backdrop-filter 液态玻璃。Safari / Firefox 会降级为淡入淡出与半透明材质，内容与交互不受影响。

## 站点结构

```
一叶一石（联合首页）
├─ 两种材料 · 共同的三件事 · 茶席 · 两本品牌书
├─ 翎茶
│  ├─ 三层名字（手风琴）
│  ├─ 气质句（滚动擦除）
│  ├─ 配方卡（可拖拽、可倾斜、三面切换）
│  ├─ 产品五层（横向拖拽、动量吸附）
│  ├─ 小程序 V1 界面（玻璃分段器 + 灵动岛）
│  ├─ 空间体验四步 · 数字
└─ 山下夆
   ├─ 名字拆解（山下 + 夆 = 峯）
   ├─ 一石一器（六个 SKU，拖拽浏览）
   ├─ 石席平面示意
   ├─ 石料身世卡（点击翻面）
   ├─ 色彩（点击复制 HEX）
   └─ 山里 → 溪里 → 席上
```

## 交互与动效（iOS 26 取向）

- **响应**：所有按钮在 pointer-down 即给反馈（scale 0.965–0.99），不等 click。
- **弹簧**：`js/spring.js` 是自写的零依赖弹簧引擎，参数按 Apple 的 *response + damping* 建模（默认 response 0.4s / damping 1.0；拖拽释放才用 0.86–0.9 的轻微回弹）。
- **动量投影**：抽屉、配方卡、横向卡片的松手落点用 Apple 的指数衰减投影 `(v/1000)·d/(1−d), d≈0.998`，再吸附到最近档位。
- **可打断**：手势驱动组件全部是「从当前屏幕值重定向」，任何时刻都能抓住反向拖，不会等动画播完。
- **1:1 跟手**：Pointer Events + `setPointerCapture`，保留抓取偏移；边界处 `rubberband` 渐进抵抗，不硬停。
- **材质**：玻璃层 = 半透明背景 + `backdrop-filter: blur() saturate()` + 高光描边 + 随指针移动的 specular（`--mx/--my`）+ 顶部亮边/底部暗边，模拟真实玻璃受光。
- **转场**：跨品牌用 View Transitions（旧页淡出+轻微缩焦，新页淡入），外观切换用从点击位置扩散的圆形揭示（clip-path circle）。
- **滚动编排**：大标题随滚动淡出上移；导航收起（compact）；进度线；材质视差；气质句擦除；时间线进度；IntersectionObserver 分段落入场（90ms 步进 stagger）。
- **底部抽屉**：拖动把手可拉，橡皮筋边界 + 动量吸附到「开/关」档位；背景压暗、缩放、去饱和；Esc / 点击遮罩 / 关闭按钮均可退出；打开时把主内容设为 `inert`，Tab 焦点锁在抽屉内。
- **灵动岛**：切换小程序界面时，手机内的灵动岛会展开显示当前页面，再收回。
- **降级与可达性**：`prefers-reduced-motion`、`prefers-reduced-transparency`、`prefers-contrast` 三套媒体查询；应用内「减少动态效果」开关与外观（自动/浅色/深色）都会写进 localStorage。全部控件可键盘操作，focus-visible 环、跳转链接、aria 状态齐全。

## 内容说明

- 页面里的价格、产量、数字与门店信息都是**示例**；小程序界面来自 2026-11 的 V1 原型（15 页可点击原型），不是已上线产品。
- 「品牌资料」抽屉里的两份 PDF 链接指向同级目录 `../品牌书_交付_2026-11-25/`，即本次交付的两本品牌书。
- 品牌事实以《lim tê 翎茶｜品牌书 V3.0》《山下夆｜品牌书 V1.0》为准；山下夆标识按「夆印主线＋墨脊器物线」两套 V1.0 表达呈现。

## 技术栈

- 原生 HTML / CSS / JS，无框架、无构建步骤、无网络请求。
- 字体：思源宋体（Noto Serif SC）、Cormorant Garamond（均为 SIL OFL），已按站点用字子集化并转为 woff2（合计约 290 KB）。
- 浏览器能力：CSS backdrop-filter、View Transitions API、Pointer Events、IntersectionObserver、CSS grid-template-rows 动画、CSS clamp()/color-mix()。
- 目录：
  - `assets/lingcha/` 标志与小程序截图
  - `assets/shanxiafeng/` 标志、夆印、墨脊
  - `assets/textures/` 程序生成的米粒石纹理
  - `assets/covers/` 两本品牌书封面缩略图
  - `assets/fonts/` 子集字体
  - `styles/` tokens → base → glass → sections
  - `js/` spring → app（路由/滚动/抽屉/外观） → interactions（手势/倾斜/轮播/手风琴）
  - `预览/` 精选截图

## 修改指引

- 改文案：直接改 `index.html`；若新增了生僻字，需要重新子集字体（见 `_qa/subset-fonts.py`）。
- 改颜色：`styles/tokens.css` 里按 `body[data-world]` 与 `[data-theme]` 分组。
- 改动效参数：弹簧参数在 `js/spring.js`（response/damping）与各交互模块里；曲线 token 在 `tokens.css`。
- 加一个世界：在 `index.html` 增加 `.screen`，在 `js/app.js` 的 `screens/scrollers` 里注册，并在顶部导航与 tabbar 加按钮即可。

## 本地质量记录

- `_qa/` 里有 Playwright 自动化脚本：三个世界逐屏截图、配方卡拖拽、轮播拖拽、抽屉开关、深浅外观、hash 路由、移动端 390×844 视图；最近一次运行无控制台错误。
- 已验证：PDF 链接可达；字体加载约 0.9s（本机）；移动端 tabbar 与安全区正常。
