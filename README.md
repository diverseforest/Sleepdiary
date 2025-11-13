# 睡眠日记

一款简单实用的睡眠日记 SPA 应用，用于记录和分析睡眠质量数据。

## 功能特性

- ✅ 睡眠数据录入（上床时间、醒来时间、觉醒次数等）
- ✅ 实时睡眠指标计算（TST、SE、WASO 等）
- ✅ 数据可视化（睡眠趋势图表）
- ✅ 周报统计与异常检测
- ✅ PSQI 和 ISI 睡眠测评量表
- ✅ 数据导入导出（JSON、CSV 格式）
- ✅ 本地数据存储（localStorage）

## 技术栈

- **前端**: 纯 HTML + CSS + JavaScript（无框架）
- **图表**: Chart.js
- **存储**: localStorage
- **数据格式**: JSON

## 快速开始

### 本地运行

在 Firefox/Chrome 浏览器中打开 `index.html` 即可使用。

```bash
# 克隆项目
git clone <repository-url>
cd sleepdiary

# 使用 Python 启动本地服务器（推荐）
python -m http.server 8000

# 或使用 Node.js
npx http-server -p 8000
```

然后在浏览器中访问 `http://localhost:8000`

### 数据备份

定期点击顶部"导出JSON"按钮备份数据到本地。

## 微信小程序迁移指南

本文档描述如何将当前 SPA 应用迁移到微信小程序平台。

### 1. 环境差异

| 特性 | Web SPA | 微信小程序 | 说明 |
|------|---------|----------|------|
| 运行环境 | 浏览器 | 微信客户端 | 需要适配微信 API |
| 页面架构 | 单页面 | 多页面 | 需拆分页面 |
| DOM 操作 | 支持 | 受限 | 需改用数据绑定 |
| 事件系统 | DOM Events | 自定义事件 | 需要重新绑定 |

### 2. 依赖评估与替代方案

#### 2.1 Chart.js（图表库）

**当前实现**: 使用 Chart.js 渲染睡眠趋势图表

**小程序替代方案**:
- **推荐**: 微信小程序原生 Canvas API
- **实现方式**: 使用 `<canvas>` 组件的手绘图表
- **迁移步骤**:
  1. 使用 `wx.createCanvasContext()` 创建画布上下文
  2. 将 Chart.js 配置转换为 Canvas 绘制指令
  3. 封装通用图表组件

**代码示例**:
```javascript
// 小程序 Canvas 图表组件
Component({
  properties: {
    chartData: Object
  },
  methods: {
    drawChart() {
      const ctx = wx.createCanvasContext('sleepChart', this);
      // 绘制柱状图和折线图
      this.drawTSTBars(ctx);
      this.drawSELine(ctx);
      ctx.draw();
    }
  }
})
```

**开发成本**: ⭐⭐⭐⭐ (需要重写图表逻辑)

#### 2.2 localStorage（本地存储）

**当前实现**: 使用 `localStorage.setItem()` / `getItem()` 存储数据

**小程序替代方案**:
- **推荐**: 使用 `wx.setStorageSync()` / `wx.getStorageSync()`
- **替代 API**:
  - `localStorage.setItem(key, value)` → `wx.setStorageSync(key, value)`
  - `localStorage.getItem(key)` → `wx.getStorageSync(key)`
  - `localStorage.removeItem(key)` → `wx.removeStorageSync(key)`
  - `localStorage.clear()` → `wx.clearStorageSync()`

**代码示例**:
```javascript
// Web 实现
const diaryStore = {
  set(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  },
  get(key) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  }
};

// 小程序实现
const diaryStore = {
  set(key, value) {
    wx.setStorageSync(key, value); // 自动序列化
  },
  get(key) {
    return wx.getStorageSync(key) || null;
  }
};
```

**开发成本**: ⭐⭐ (简单替换即可)

**注意**: 小程序存储限制为 10MB，比浏览器更大

#### 2.3 文件导入导出

**当前实现**:
- 导出: Blob + a.download 触发下载
- 导入: `<input type="file">` + FileReader

**小程序替代方案**:
- **导出**: 使用 `wx.downloadFile()` + `wx.saveFileToDisk()`
- **导入**: 不支持直接选择文件，改为移动端分享接口

**导出代码示例**:
```javascript
// 导出 JSON
exportData() {
  const jsonStr = JSON.stringify(payload, null, 2);
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/sleep_diary.json`;

  fs.writeFileSync(filePath, jsonStr, 'utf8');

  wx.saveFileToDisk({
    filePath: filePath,
    success: () => {
      wx.showToast({ title: '导出成功' });
    }
  });
}
```

**导入替代方案**:
由于小程序不支持文件选择，建议使用以下方式：
1. **云同步**: 用户登录后自动同步数据（推荐）
2. **分享导入**: 通过微信分享功能传输数据文件
3. **扫码导入**: 将数据编码为二维码扫描导入

**开发成本**: ⭐⭐⭐（需要重新设计导入导出流程）

#### 2.4 DOM 操作

**当前实现**: 大量使用 `document.getElementById()`、`querySelector()`

**小程序替代方案**:
- 使用 WXML 数据绑定 + `setData()`
- 使用 `this.selectComponent()` 获取组件实例

**迁移步骤**:
1. 将 index.html 拆分为多个页面（pages/index/index.wxml 等）
2. 使用 Mustache 语法 `{{variable}}` 替代 DOM 更新
3. 将事件处理器从 `addEventListener` 改为 `bindtap`

**Web 代码**:
```javascript
// 更新指标显示
document.getElementById('metricTST').textContent = `${tstHours} 小时`;
```

**小程序代码**:
```javascript
// page.js
data: {
  metricTST: ''
},
updateMetrics(metrics) {
  this.setData({
    metricTST: `${metrics.tstHours} 小时`
  });
}

// page.wxml
<text>{{metricTST}}</text>
```

**开发成本**: ⭐⭐⭐⭐⭐（需要重写所有 UI 逻辑）

#### 2.5 事件系统

**当前实现**: `addEventListener('click', handler)`

**小程序替代方案**:
- WXML 中使用 `bindtap="handlerName"`
- 事件对象结构不同，需要适配

**Web 代码**:
```javascript
button.addEventListener('click', function(event) {
  const value = event.target.value;
  // ...
});
```

**小程序代码**:
```javascript
// wxml
<button bindtap="handleClick" data-value="{{value}}">点击</button>

// js
handleClick(event) {
  const value = event.currentTarget.dataset.value;
  // ...
}
```

**开发成本**: ⭐⭐ (工作量中等，但重复性高)

#### 2.6 日期选择器

**当前实现**: `<input type="date">` 和 `<input type="time">`

**小程序替代方案**:
- 使用内置组件 `<picker mode="date">` 和 `<picker mode="time">`

**代码示例**:
```xml
<!-- 日期选择器 -->
<picker mode="date" value="{{date}}" bindchange="bindDateChange">
  <view class="picker">{{date}}</view>
</picker>

<!-- 时间选择器 -->
<picker mode="time" value="{{time}}" bindchange="bindTimeChange">
  <view class="picker">{{time}}</view>
</picker>
```

**开发成本**: ⭐⭐ (简单替换)

### 3. 项目结构改造

#### 3.1 当前结构
```
sleepdiary/
├── index.html
├── app.js (2000+ 行)
├── style.css
└── DATA_SCHEMA.md
```

#### 3.2 小程序推荐结构
```
miniprogram/
├── pages/
│   ├── index/              # 主页 - 数据输入
│   │   ├── index.wxml
│   │   ├── index.wxss
│   │   └── index.js
│   ├── weekly/             # 周报页面
│   │   ├── weekly.wxml
│   │   ├── weekly.wxss
│   │   └── weekly.js
│   ├── charts/             # 图表页面
│   │   ├── charts.wxml
│   │   ├── charts.wxss
│   │   └── charts.js
│   └── questionnaire/      # 量表页面
│       ├── questionnaire.wxml
│       ├── questionnaire.wxss
│       └── questionnaire.js
├── components/             # 可复用组件
│   ├── diary-form/         # 日记表单组件
│   │   ├── diary-form.wxml
│   │   └── diary-form.js
│   ├── weekly-chart/       # 周图表组件
│   │   ├── weekly-chart.wxml
│   │   └── weekly-chart.js
│   └── psqi-form/          # PSQI表单组件
│       ├── psqi-form.wxml
│       └── psqi-form.js
├── utils/
│   ├── storage.js          # 存储封装
│   ├── calculation.js      # 计算逻辑
│   ├── format.js           # 格式化工具
│   └── constants.js        # 常量定义
├── services/
│   └── sync.js             # 同步服务
├── app.js                  # 小程序入口
├── app.json                # 小程序配置
├── app.wxss                # 全局样式
├── project.config.json     # 项目配置
└── DATA_SCHEMA.md          # 数据格式文档
```

### 4. 已知兼容性清单

#### 4.1 已预留的接口

当前代码已经为小程庺迁移预留了以下接口：

**1. syncService 同步服务** (app.js:11-52)
- 提供 `authenticate()`、`syncToCloud()` 等接口占位
- 接入小程序 Cloud Base 时直接实现即可

**2. 组件化架构** (app.js:62-287)
- FormHandler、WeeklyRenderer、QuestionnaireRenderer 模块
- 逻辑与 DOM 分离，便于移植

#### 4.2 需要修改的部分

**配置文件**:
- index.html → 拆分为多个 .wxml 页面
- style.css → 拆分为 .wxss 文件，部分样式需调整

**JavaScript**:
- 全局变量改为 Page.data
- DOM 操作改为 setData
- 文件操作改为 wx API

**图表库**:
- Chart.js → 原生 Canvas（需要完全重写）

### 5. 迁移工作量估算

| 模块 | 工作量 | 难度 | 说明 |
|------|--------|------|------|
| 项目结构 | 2 小时 | ⭐⭐ | 创建小程序项目结构 |
| 首页（录入）| 8 小时 | ⭐⭐⭐⭐ | DOM 改数据绑定 |
| 周报页面 | 6 小时 | ⭐⭐⭐ | 图表需要重写 |
| 量表页面 | 4 小时 | ⭐⭐ | 主要是表单转换 |
| 数据存储 | 1 小时 | ⭐ | 简单 API 替换 |
| 导入导出 | 3 小时 | ⭐⭐⭐ | 需重新设计交互 |
| 图表重写 | 12 小时 | ⭐⭐⭐⭐⭐ | Canvas 绘图逻辑 |
| 调试优化 | 4 小时 | ⭐⭐ | 真机调试 |
| **总计** | **~40 小时** | - | 约 1 周工作量 |

### 6. 推荐迁移策略

#### 方案 A: 渐进式迁移（推荐）

1. **阶段 1**: 移植核心功能（数据录入和存储）
   - 保留 Web 版本继续维护
   - 小程序实现基础录入功能
   - ~~2-3 天

2. **阶段 2**: 添加数据分析
   - 移植周报和图表
   - 使用 Canvas 实现图表
   - ~2-3 天

3. **阶段 3**: 增强功能
   - 量表测评
   - 数据导入导出
   - ~1-2 天

**优点**: 风险低，可快速上线 MVP
**缺点**: 需要维护两套代码

#### 方案 B: 全量重写

1. 一次性迁移所有功能
2. 完全重写图表组件
3. 重新设计导入导出

**优点**: 代码统一，维护方便
**缺点**: 周期长，风险高

### 7. 小程序特有优化建议

#### 7.1 利用微信能力

**云开发 Cloud Base**:
```javascript
// 直接使用云数据库
wx.cloud.init();
const db = wx.cloud.database();

// 替代 localStorage
db.collection('diaries').add({ data: diaryEntry });
db.collection('diaries').where({ date: '2025-11-13' }).get();
```

**微信登录**:
```javascript
wx.login({
  success: (res) => {
    // 获取用户唯一标识
    const code = res.code;
    // 发送到后端获取 openid
  }
});
```

**订阅消息**:
```javascript
// 提醒用户记录睡眠
wx.requestSubscribeMessage({
  tmplIds: ['每日提醒模板ID'],
  success: () => {
    // 用户同意订阅
  }
});
```

#### 7.2 UI/UX 适配

- **屏幕适配**: 使用 rpx 单位替代 px
- **交互优化**: 按钮增大到 88x44px 以上（点击区域）
- **键盘**: 使用 `type="digit"` 优化数字输入
- **反馈**: 使用 `wx.showToast()` 替代 alert

#### 7.3 性能优化

- **分包加载**: 图表页面和量表页面可设为分包
- **懒加载**: 历史记录使用分页加载
- **本地缓存**: 使用 `wx.setStorageSync()` 缓存计算结果

### 8. 参考资源

- [微信小程序官方文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [微信小程序云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [Canvas API 参考](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html)

### 9. 开发规划与部署路线

以下路线聚焦把当前 Web SPA 迭代成果迁入微信小程序直至可发布版本，可与 `MINIAPP_MIGRATION_CHECKLIST.md` 联动跟踪：

- **阶段 0（1 天，环境与脚手架）**：安装微信开发者工具，创建含 `pages/`、`components/`、`services/`、`utils/` 的基础目录，移植 `FormHandler`、`WeeklyRenderer`、`QuestionnaireRenderer` 内的纯逻辑方法到 `utils/`，并用 `syncService` 定义的数据接口占位 `services/storageService.js` 与 `services/syncService.js`。
- **阶段 1（3 天，录入 MVP）**：实现 `pages/index/`（日记录入）与 `components/diary-form/`，将本地 `localStorage` 操作替换为 `wx.setStorageSync`/`wx.getStorageSync`，完成表单校验、指标计算与历史列表；编写至少 5 条单元测试覆盖核心计算函数。
- **阶段 2（3 天，统计与图表）**：落地 `pages/weekly/` 与 `components/weekly-chart/`，把 Chart.js 配置翻译为 Canvas 绘制流程，抽象 `utils/chartAdapter.js` 按 `prepareWeeklyChartData` 的数据协议输出，同时提供异常检测和周范围切换。
- **阶段 3（2 天，量表与扩展）**：实现 `pages/questionnaire/` 与 `components/questionnaire-form/`，把 `QuestionnaireRenderer` 的题库/评分逻辑拆到 JSON + 评分函数；补齐导入导出、数据备份提示，并在 `syncService` 里接入真实云存储或保留 no-op。
- **阶段 4（1 天，预发布与测试）**：依据 `MINIAPP_MIGRATION_CHECKLIST.md` 完成真机调试、性能分析、无障碍/分辨率适配，清理 console 调试信息，输出发布包与版本说明。
- **持续交付要求**：每个阶段结束必须更新 README 中的兼容性说明、同步 `迭代计划`、并在小程序后台上传当前构建为体验版，供产品与测试验证。

---

## 数据格式

详细的数据格式规范见 [DATA_SCHEMA.md](./DATA_SCHEMA.md)

## 开发规范

### 分支管理

- `main`: 主分支，稳定版本
- `develop`: 开发分支
- `feature/xxx`: 功能分支
- `hotfix/xxx`: 紧急修复

### 提交信息

使用 [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: 添加 CSV 导出功能
fix: 修复日期选择器默认值
refactor: 拆分表单处理模块
```

## 许可证

MIT License

---

**注意**: 当前版本为 Web SPA，计划迁移到微信小程序。迁移指南详见上文。
