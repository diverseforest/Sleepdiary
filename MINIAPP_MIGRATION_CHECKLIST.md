# 微信小程序迁移检查清单

> 版本: 1.0
> 最后更新: 2025-11-13

本清单用于指导将睡眠日记 Web SPA 应用迁移到微信小程序平台的完整流程。

## 一、环境准备

### ✅ 开发环境

- [ ] 安装 [微信开发者工具](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)
  - [ ] 版本要求: 1.06.2409130 或更高
  - [ ] 使用稳定版 (Stable Build)

- [ ] 注册微信小程序账号
  - [ ] 个人开发者账号或企业账号
  - [ ] 获取 AppID (必需)
  - [ ] 开通云开发环境 (可选但推荐)

- [ ] 创建小程序项目
  - [ ] 选择"不使用云服务"或"使用云服务"
  - [ ] 配置项目名称和目录
  - [ ] 启用"增强编译"和"使用 npm 模块"

### ✅ 项目初始化

- [ ] 初始化 Git 仓库（可选）
  ```bash
  git init
  git add .
  git commit -m "Initial commit"
  ```

- [ ] 安装依赖（如有）
  ```bash
  npm init -y
  npm install --save miniprogram-api-typings  # TypeScript 支持（可选）
  ```

## 二、项目结构改造

### ✅ 创建基础目录结构

```
miniprogram/
├── pages/                    # 页面目录
│   ├── index/               # 首页 - 数据录入
│   ├── charts/              # 图表页面
│   ├── weekly/              # 周报页面
│   ├── history/             # 历史记录
│   └── questionnaire/       # 量表页面
├── components/              # 组件目录
│   ├── diary-form/          # 日记表单组件
│   ├── weekly-chart/        # 周图表组件
│   └── questionnaire-form/  # 量表表单组件
├── utils/                   # 工具函数
├── services/                # 服务层
├── app.js                   # 小程序入口
├── app.json                 # 全局配置
├── app.wxss                 # 全局样式
└── project.config.json      # 项目配置
```

- [ ] 创建 `pages/index/` 目录及基础文件
  - [ ] index.wxml
  - [ ] index.wxss
  - [ ] index.js
  - [ ] index.json

- [ ] 创建 `pages/charts/` 目录及基础文件
- [ ] 创建 `pages/weekly/` 目录及基础文件
- [ ] 创建 `pages/questionnaire/` 目录及基础文件
- [ ] 创建 `components/` 目录结构

### ✅ 配置 app.json

```json
{
  "pages": [
    "pages/index/index",
    "pages/weekly/weekly",
    "pages/charts/charts",
    "pages/questionnaire/questionnaire",
    "pages/history/history"
  ],
  "window": {
    "backgroundTextStyle": "light",
    "navigationBarBackgroundColor": "#2c3e50",
    "navigationBarTitleText": "睡眠日记",
    "navigationBarTextStyle": "white"
  },
  "tabBar": {
    "list": [
      {
        "pagePath": "pages/index/index",
        "text": "录入",
        "iconPath": "images/icon_edit.png",
        "selectedIconPath": "images/icon_edit_active.png"
      },
      {
        "pagePath": "pages/weekly/weekly",
        "text": "周报",
        "iconPath": "images/icon_chart.png",
        "selectedIconPath": "images/icon_chart_active.png"
      },
      {
        "pagePath": "pages/questionnaire/questionnaire",
        "text": "量表",
        "iconPath": "images/icon_form.png",
        "selectedIconPath": "images/icon_form_active.png"
      }
    ]
  }
}
```

- [ ] 配置页面路径
- [ ] 配置窗口样式
- [ ] 配置底部 TabBar
- [ ] 配置导航栏

## 三、核心功能迁移

### ✅ 存储层迁移

**文件**: `utils/storage.js`

- [ ] 封装 `wx.setStorageSync()` / `wx.getStorageSync()`
- [ ] 实现 diaryStore 模块
  - [ ] `set(key, value)`
  - [ ] `get(key)`
  - [ ] `getAll()`
  - [ ] `remove(key)`
  - [ ] `clear()`
  - [ ] `export()`
  - [ ] `import(data)`
- [ ] 实现 questionnaireStore 模块
  - [ ] 类似 diaryStore 的 API
- [ ] 数据版本迁移逻辑
- [ ] 错误处理（try-catch）

**测试**: 数据存储
- [ ] 测试数据保存
- [ ] 测试数据读取
- [ ] 测试数据导出
- [ ] 测试数据导入

### ✅ 表单处理模块迁移

**文件**: `components/diary-form/diary-form.js`

- [ ] 迁移 FormHandler 模块
  - [ ] `normalizeEntry()`
  - [ ] `calculateMetrics()`
  - [ ] `validate()`
  - [ ] `formatMetricsForDisplay()`
- [ ] 实现表单数据绑定
  - [ ] 使用 `data: { formData: {} }`
  - [ ] 使用 `bindinput` 绑定输入事件
- [ ] 实现时间计算器
  - [ ] `parseTimeToMinutes()`
  - [ ] `addMinutes()`
- [ ] 实现影响因素标记
  - [ ] 复选框组件
  - [ ] 详情输入框

**WXML 组件**:
```xml
<view class="form-group">
  <text>上床时间</text>
  <picker mode="time" value="{{bedtime}}" bindchange="bindBedtimeChange">
    <view class="picker">{{bedtime}}</view>
  </picker>
</view>
```

### ✅ 周报模块迁移

**文件**: `pages/weekly/weekly.js`

- [ ] 迁移 WeeklyRenderer 模块
  - [ ] `getWeekRange()`
  - [ ] `aggregateWeek()`
  - [ ] `detectAnomalies()`
  - [ ] `prepareWeeklyChartData()`
- [ ] 实现周导航（上一周/下一周）
- [ ] 实现 KPI 卡片
  - [ ] 平均 TST
  - [ ] 平均 SE
  - [ ] 平均入睡时间
  - [ ] 平均起床时间
- [ ] 实现异常检测显示

**图表渲染** (重点):
- [ ] 创建 Canvas 组件
  ```xml
  <canvas type="2d" id="weeklyChart" canvas-id="weeklyChart"></canvas>
  ```
- [ ] 实现 `drawWeeklyChart()` 方法
  - [ ] 绘制柱状图（TST）
  - [ ] 绘制折线图（SE）
  - [ ] 绘制基准线
  - [ ] 添加坐标轴和标签
- [ ] 处理 Canvas 尺寸适配
- [ ] 实现触摸交互（可选）

### ✅ 量表模块迁移

**文件**: `components/questionnaire-form/questionnaire-form.js`

- [ ] 迁移 questionnaires 配置对象
  - [ ] PSQI 配置
  - [ ] ISI 配置
- [ ] 实现问卷动态渲染
  - [ ] 单选题（radio）
  - [ ] 多选题（checkbox）
  - [ ] 文本输入
- [ ] 实现评分算法
  - [ ] `calculateScore()`
  - [ ] 分值映射
  - [ ] 等级划分
- [ ] 实现量表历史
  - [ ] 列表展示
  - [ ] 详情查看
  - [ ] 删除功能

**WXML 结构**:
```xml
<view class="questionnaire">
  <block wx:for="{{questions}}" wx:key="id">
    <view class="question-item">
      <text class="question-title">{{item.text}}</text>
      <radio-group bindchange="bindAnswerChange" data-question-id="{{item.id}}">
        <label wx:for="{{item.options}}" wx:for-item="option">
          <radio value="{{option.value}}" />{{option.text}}
        </label>
      </radio-group>
    </view>
  </block>
</view>
```

### ✅ 图表页面迁移

**文件**: `pages/charts/charts.js`

- [ ] 迁移睡眠趋势图表
- [ ] 使用 Canvas 重写渲染逻辑
- [ ] 实现数据筛选（时间范围）
- [ ] 实现图表交互
- [ ] 优化性能（大数据量）

### ✅ 历史记录页面迁移

**文件**: `pages/history/history.js`

- [ ] 实现历史列表
- [ ] 实现分页加载（`loadMore`）
- [ ] 实现条目点击查看详情
- [ ] 实现条目删除功能
- [ ] 实现搜索/筛选（可选）

## 四、导入导出功能改造

### ✅ 数据导出

**实现方案**: 保存到用户目录

- [ ] JSON 导出
  ```javascript
  const fs = wx.getFileSystemManager();
  const filePath = `${wx.env.USER_DATA_PATH}/sleep_diary.json`;
  fs.writeFileSync(filePath, jsonStr, 'utf8');
  wx.saveFileToDisk({ filePath });
  ```
- [ ] CSV 导出
  - [ ] 构建 CSV 字符串
  - [ ] 添加 BOM (UTF-8)
  - [ ] 写入文件并保存
- [ ] 导出成功提示 (wx.showToast)

### ✅ 数据导入

**需求分析**: 小程序不支持文件选择

**实现方案一**: 云同步（推荐）
- [ ] 集成微信云开发
- [ ] 实现数据上传/下载
- [ ] 实现版本冲突处理

**实现方案二**: 二维码导入
- [ ] 将数据编码为二维码
- [ ] 使用 `wx.scanCode()` 扫描二维码
- [ ] 解析数据并导入

**实现方案三**: 分享导入
- [ ] 监听 `onShareAppMessage`
- [ ] 通过分享链接传递数据
- [ ] 在 `onLoad` 中解析导入数据

**实现方案四**: 剪贴板
- [ ] 导出到剪贴板（`wx.setClipboardData`）
- [ ] 从剪贴板导入（`wx.getClipboardData`）

### ✅ 备份提醒

- [ ] 使用 `wx.showModal` 提示用户备份
- [ ] 定期提醒（每 7 天）
- [ ] 提供"不再提示"选项

## 五、同步服务接入（可选）

### ✅ 微信云开发

**开通步骤**:
- [ ] 在小程序管理后台开通云开发
- [ ] 创建云开发环境
- [ ] 记录环境 ID

**配置项目**:
- [ ] 在 `app.js` 中初始化云开发
  ```javascript
  wx.cloud.init({
    env: 'your-env-id',
    traceUser: true
  });
  ```

**实现 syncService**:
- [ ] 实现 `authenticate()` - 微信登录
- [ ] 实现 `syncToCloud()` - 上传数据
- [ ] 实现 `syncFromCloud()` - 下载数据
- [ ] 实现冲突处理策略

**数据库设计**:
- [ ] diaries 集合（日记数据）
  - `_id`, `date`, `bedtime`, ...
  - 索引: `date`, `userId`
- [ ] questionnaires 集合（量表数据）
  - `_id`, `questionnaireId`, `date`, ...
  - 索引: `date`, `userId`, `questionnaireId`
- [ ] users 集合（用户信息）
  - `_id`, `openid`, `lastSyncTime`

**安全规则**:
```javascript
// diaries 集合
{
  "read": "doc._openid == auth.openid",
  "write": "doc._openid == auth.openid"
}
```

### ✅ 用户登录

- [ ] 使用 `wx.login()` 获取 code
- [ ] 发送到后端换取 openid/session_key
- [ ] 存储登录态（storage）
- [ ] 实现登录过期处理
- [ ] 提供"退出登录"功能

## 六、UI/UX 适配

### ✅ 视觉设计

- [ ] 配色方案调整
  - [ ] 主色调（推荐蓝色系）
  - [ ] 辅助色（绿色/红色）
  - [ ] 背景色（#f5f5f5）
- [ ] 字体大小
  - [ ] 标题: 32rpx
  - [ ] 正文: 28rpx
  - [ ] 提示: 24rpx
- [ ] 间距系统
  - [ ] 基础单位: 8rpx
  - [ ] 组件间距: 16rpx
  - [ ] 区块间距: 32rpx

### ✅ 交互优化

- [ ] 按钮尺寸 ≥ 88x44px
- [ ] 点击区域适当扩大
- [ ] 添加点击反馈（hover-class）
- [ ] 加载状态显示（wx.showLoading）
- [ ] 错误提示（wx.showToast）
- [ ] 空状态设计
- [ ] 加载更多动画

### ✅ 表单优化

- [ ] 输入框聚焦时自动上推页面（`adjust-position`）
- [ ] 键盘类型优化
  - [ ] 数字输入: `type="digit"`
  - [ ] 时间选择: `type="time"`
- [ ] 表单验证提示（红色边框 + 文字）
- [ ] 必填项标记（红色 *）

### ✅ 页面跳转

- [ ] 配置所有页面路径（app.json）
- [ ] 使用 `wx.navigateTo()` 跳转到子页面
- [ ] 使用 `wx.redirectTo()` 替换当前页面
- [ ] 使用 `wx.switchTab()` 跳转到 tabBar 页面
- [ ] 添加页面跳转动画（可选）

## 七、测试与调试

### ✅ 功能测试

- [ ] 表单提交（正常情况）
- [ ] 表单提交（边界情况）
  - [ ] 空数据
  - [ ] 不完整数据
  - [ ] 无效时间格式
- [ ] 数据存储（localStorage）
- [ ] 数据加载
- [ ] 数据编辑
- [ ] 数据删除
- [ ] 数据导出
- [ ] 数据导入（如果实现）
- [ ] 周数据计算
- [ ] 异常检测
- [ ] 量表评分
- [ ] 历史记录分页

### ✅ 兼容性测试

- [ ] 不同屏幕尺寸
  - [ ] iPhone SE (4")
  - [ ] iPhone 14 (6.1")
  - [ ] iPhone 14 Pro Max (6.7")
  - [ ] Android 全面屏
- [ ] 不同微信版本
  - [ ] iOS 微信 8.0+
  - [ ] Android 微信 8.0+
- [ ] 不同系统版本
  - [ ] iOS 14+
  - [ ] Android 9+

### ✅ 性能测试

- [ ] 大数据量测试（> 1000 条记录）
- [ ] 图表渲染性能
- [ ] 页面加载时间
- [ ] 内存占用检测
- [ ] 使用开发者工具 Performance 面板分析

### ✅ 真机调试

- [ ] 预览小程序（开发者工具）
- [ ] 真机扫码调试
- [ ] 查看 Console 日志
- [ ] 查看 Network 请求
- [ ] 查看 Storage 数据
- [ ] 使用真机调试面板

## 八、发布准备

### ✅ 代码审核

- [ ] 移除所有 console.log（生产环境）
- [ ] 检查 hardcode 的测试数据
- [ ] 检查 API 密钥和敏感信息
- [ ] 代码格式化（ESLint）
- [ ] 代码注释完整性

### ✅ 项目配置

- [ ] 配置 `project.config.json`
  - [ ] appid
  - [ ] projectname
  - [ ] minified（代码压缩）
- [ ] 配置 `app.json`
  - [ ] pages（所有页面路径）
  - [ ] window（窗口样式）
  - [ ] tabBar（底部导航）
  - [ ] networkTimeout（网络超时）

### ✅ 上传代码

- [ ] 使用开发者工具"上传"
- [ ] 填写版本号（如: 1.0.0）
- [ ] 填写项目备注
- [ ] 确认上传成功

### ✅ 提交审核

- [ ] 登录 [小程序管理后台](https://mp.weixin.qq.com)
- [ ] 进入"版本管理"
- [ ] 选择开发版本
- [ ] 点击"提交审核"
- [ ] 填写审核信息:
  - [ ] 功能说明
  - [ ] 测试账号（如需要）
  - [ ] 测试备注
- [ ] 等待审核结果（通常 1-7 天）

### ✅ 发布上线

- [ ] 审核通过后
- [ ] 进入"版本管理"->"审核版本"
- [ ] 点击"发布"
- [ ] 确认发布
- [ ] 小程序正式上线

## 九、上线后检查

### ✅ 线上验证

- [ ] 搜索小程序
- [ ] 扫码进入
- [ ] 测试核心流程
- [ ] 监控错误日志（小程序后台）
- [ ] 查看用户反馈
- [ ] 性能监控

### ✅ 数据监控

- [ ] 查看访问数据
  - [ ] 访问人数
  - [ ] 访问次数
  - [ ] 平均访问时长
- [ ] 查看用户画像
  - [ ] 地域分布
  - [ ] 设备分布
- [ ] 错误监控
  - [ ] JavaScript 错误
  - [ ] 接口错误

## 十、参考文档

- [ ] [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [ ] [微信小程序 API 文档](https://developers.weixin.qq.com/miniprogram/dev/api/)
- [ ] [微信小程序云开发文档](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/basis/getting-started.html)
- [ ] [小程序 Canvas 文档](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/CanvasContext.html)
- [ ] [本项目 DATA_SCHEMA.md](./DATA_SCHEMA.md)
- [ ] [本项目 README.md](./README.md)

## 常见问题

### Q: 迁移需要多长时间？
A: 根据功能复杂度，约 40-60 小时（1-2 周）。

### Q: 最大的难点是什么？
A: 图表重写（Canvas）和 DOM 操作改为数据绑定。

### Q: 需要重写多少代码？
A: 约 60-70% 的业务逻辑可以复用，UI 层需要重写。

### Q: 可以同时维护 Web 和小程序版本吗？
A: 可以，但建议逐步迁移到小程序，停止 Web 版本更新。

### Q: 数据可以互通吗？
A: 通过云开发可以实现数据同步，但需要考虑版本兼容性。

---

## 使用说明

1. **逐项检查**: 建议按顺序逐项完成检查
2. **打勾标记**: 完成后在 [ ] 中标记 ✅
3. **团队协作**: 多人协作时可分配不同模块
4. **迭代更新**: 发现问题及时更新清单
5. **版本控制**: 初次发布使用 v1.0，记录修改历史

## 历史版本

- 2025-11-13: v1.0 初版

---

**最后更新**: 2025-11-13
**维护者**: Your Name
