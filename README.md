# dsh-ocean-background

给 DeepSeek Harness（dsh）使用的 ASCII 海洋动态背景插件。视觉与生态模拟改编自
[`stackedlol/ascii-sharks`](https://github.com/stackedlol/ascii-sharks)（MIT）。

## 功能

- 全屏 Canvas 背景：鲨鱼巡游、鱼群避让、尾迹和点击扰动。
- 使用 `shell.overlay` 挂载生命周期，不改写 DSH 的布局 Slot。
- 面板半透明化，让背景实际出现在应用内容后面，而不是盖住文字。
- 支持 `prefers-reduced-motion`：只绘制一张稳定画面，不持续动画。
- 画布离开视口或页面隐藏时暂停，DPR 上限为 2。
- **设置 → 海洋背景** 可启用/关闭、切换鲨鱼场景、配置鲨鱼主体色、调整背景亮度和面板不透明度。
- 自动跟随 **设置 → 通用 → 外观** 的浅色、深色和跟随系统模式，系统外观变化时实时重绘。
- 配置保存在浏览器 `localStorage`，键名 `dsh-ocean-background:config:v1`。

## 安装

在插件目录的父目录执行：

```sh
dsh plugin --profile web add ./dsh-ocean-background
```

安装后重启 `dsh web`，再打开 **设置 → 海洋背景**。

## 场景 API

插件内部保留了原项目的构造方式：

```js
const engine = new OceanEngine(canvas, [
  { kind: "hammerhead", size: 1 },
  { kind: "mako", size: 0.86 },
]);
```

支持的鲨鱼种类：

```text
classic | hammerhead | zebra | tiger
greathammer | mako | thresher | nurse
```

设置页当前提供四组场景：经典鲨群、珊瑚礁、远洋猎手、孤独巡游。

鲨鱼主体色默认跟随主题：深色模式保留原有深海配色，浅色模式使用近白主体和
深色字符纹理。选择自定义颜色后，两种主题都会使用该主体色，并可点击
“跟随主题”恢复默认。

## 实现说明

- `lib/index.js`：空宿主插件，仅用于让 DSH Loader 纳入该 bundle。
- `lib/client.js`：浏览器半侧，包含人工生命模拟、Canvas 渲染、Slot 注册和设置页。
- `cordis.patch.yml`：声明宿主 Loader 插入行。
- `test/client.mjs`：不启动 DSH 的 bundle/Slot 契约检查。

为了把背景放在界面后面，插件会：

1. 在 `#root` 前插入一个 `pointer-events: none` 的 Canvas。
2. 订阅 DSH 的 `ctx.theme`，从 `theme/change` 获取已解析的 `light` / `dark` 配色方案。
3. 给 AppFrame 加临时属性，并把 `--dsw-alias-bg-base`、`--dsw-specific-sidebar-fill` 改为对应主题的半透明值。
4. 卸载时移除 Canvas、属性和临时 CSS 变量。

## 验证

```sh
node --check lib/client.js
node test/client.mjs
dsh plugin --profile web add ./dsh-ocean-background
```

## License

MIT。上游项目及其 MIT 许可见 `THIRD_PARTY_NOTICES.md`、`LICENSE`。
