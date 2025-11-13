# 睡眠日记数据格式规范

> 版本: 1.0
> 最后更新: 2025-11-13

本文档描述了睡眠日记应用的数据格式规范，用于指导前端、小程序和后端的数据交互与存储。

## 1. 数据导出格式

### 1.1 JSON导出格式 (主格式)

```json
{
  "version": 1,
  "diaries": [...],
  "questionnaires": [...],
  "weeklySummary": {
    "rangeStart": "2025-11-01",
    "rangeEnd": "2025-11-07",
    "avgTSTMinutes": 420,
    "avgSEPercent": 85.5
  }
}
```

**字段说明**

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| version | number | 是 | 数据格式版本号，当前为1 |
| diaries | array | 是 | 睡眠日记记录数组 |
| questionnaires | array | 否 | 问卷记录数组 |
| weeklySummary | object | 否 | 本周统计数据 |

### 1.2 CSV导出格式

**文件编码**: UTF-8 with BOM

**列顺序**:

1. 日期 (YYYY-MM-DD)
2. 上床时间 (HH:MM)
3. 入睡潜伏期(分钟)
4. 觉醒次数
5. 觉醒持续时间(分钟)
6. 醒来时间 (HH:MM)
7. 起床时间 (HH:MM)
8. 睡眠总时长(分钟)
9. 睡眠效率(%)
10. 睡眠质量 (1-5)
11. 日间警觉性 (1-5)
12. 备注

**示例行**:
```csv
2025-11-01,23:30,15,2,30,07:00,07:30,420,87.5,4,4,"喝了咖啡，运动30分钟"
```

**文件头部注释行**（前5行为元数据，以#开头）:
```csv
# 睡眠日记数据导出
# 导出时间: 2025-11-13 15:30:45
# 周报期间: 2025-11-01 至 2025-11-07
# 平均TST: 420 分钟
# 平均SE: 85.5%
```

## 2. 日记数据结构 (Diary Entry)

### 2.1 字段定义

| 字段 | 类型 | 必填 | 单位/格式 | 示例 | 说明 |
|------|------|------|-----------|------|------|
| date | string | 是 | YYYY-MM-DD | "2025-11-01" | 日记日期 |
| bedtime | string | 是 | HH:MM | "23:30" | 上床准备睡觉时间 |
| sleepLatencyMin | number | 否 | 分钟 | 15 | 从上床到入睡的时间 |
| awakeningsCount | number | 否 | 次 | 2 | 夜间觉醒次数 |
| awakeningsDurationMin | number | 否 | 分钟 | 30 | 夜间觉醒总时长 |
| wakeTime | string | 是 | HH:MM | "07:00" | 最终醒来时间 |
| outOfBedTime | string | 是 | HH:MM | "07:30" | 起床离开床时间 |
| notes | string | 否 | - | "喝了咖啡" | 备注信息 |
| factors | object | 否 | - | {} | 影响因素标记 |
| sleepQuality | string | 否 | 1-5 | "4" | 睡眠质量评分(1=很差,5=很好) |
| daytimeAlertness | string | 否 | 1-5 | "4" | 日间警觉性评分(1=很疲惫,5=非常充沛) |
| metrics | object | 是 | - | {} | 计算出的睡眠指标 |
| version | number | 是 | - | 1 | 数据版本 |

### 2.2 影响因素标记 (factors)

| 字段 | 类型 | 说明 |
|------|------|------|
| caffeine | boolean | 是否摄入咖啡因 |
| caffeineDetail | string | 咖啡因摄入详情 |
| alcohol | boolean | 是否饮酒 |
| alcoholDetail | string | 饮酒详情 |
| medication | boolean | 是否服药 |
| medicationDetail | string | 药物详情 |
| exercise | boolean | 是否运动 |
| exerciseDetail | string | 运动详情 |
| daytimeDrowsiness | boolean | 日间是否困倦 |
| daytimeDrowsinessDetail | string | 日间困倦详情 |

### 2.3 计算指标 (metrics)

| 字段 | 类型 | 单位 | 计算公式 | 说明 |
|------|------|------|----------|------|
| TIB | number | 小时 | (outOfBedTime - bedtime)/60 | 卧床时间 |
| TST | number | 小时 | TIB - (SL + WASO + 醒后卧床) | 总睡眠时间 |
| SL | number | 小时 | sleepLatencyMin/60 | 入睡潜伏期 |
| WASO | number | 小时 | awakeningsDurationMin/60 | 睡后觉醒时间 |
| SE | number | % | (TST/TIB)*100 | 睡眠效率 |
| wasoMinutes | number | 分钟 | awakeningsDurationMin | 睡后觉醒分钟数 |
| awakeInBedMinutes | number | 分钟 | (outOfBedTime - wakeTime) | 醒后卧床分钟数 |

**计算示例**:
```javascript
bedtime = "23:30" (1410分钟)
outOfBedTime = "07:30" (450分钟 + 1440 = 1890分钟)
sleepLatencyMin = 15
awakeningsDurationMin = 30
wakeTime = "07:00" (420 + 1440 = 1860分钟)

TIB = (1890 - 1410)/60 = 8 小时
SL = 15/60 = 0.25 小时
WASO = 30/60 = 0.5 小时
醒后卧床 = (1890 - 1860)/60 = 0.5 小时
TST = 8 - (0.25 + 0.5 + 0.5) = 6.75 小时 (405分钟)
SE = (6.75/8)*100 = 84.4%
```

### 2.4 数据示例

```json
{
  "date": "2025-11-01",
  "bedtime": "23:30",
  "sleepLatencyMin": 15,
  "awakeningsCount": 2,
  "awakeningsDurationMin": 30,
  "wakeTime": "07:00",
  "outOfBedTime": "07:30",
  "notes": "喝了咖啡，运动30分钟",
  "factors": {
    "caffeine": true,
    "caffeineDetail": "下午3点，美式咖啡",
    "exercise": true,
    "exerciseDetail": "晚上7点，慢跑30分钟"
  },
  "sleepQuality": "4",
  "daytimeAlertness": "4",
  "metrics": {
    "TIB": 8.0,
    "TST": 6.75,
    "SL": 0.25,
    "WASO": 0.5,
    "SE": 84.4,
    "wasoMinutes": 30,
    "awakeInBedMinutes": 30
  },
  "version": 1
}
```

## 3. 问卷数据结构 (Questionnaire)

### 3.1 通用字段

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| id | string | 是 | 唯一标识符 |
| questionnaireId | string | 是 | 问卷类型ID (psqi, isi) |
| date | string | 是 | 填写日期 (YYYY-MM-DD) |
| answers | object | 是 | 答案对象 |
| scoring | object | 否 | 评分结果 |
| derived | object | 否 | 派生数据 |
| createdAt | string | 是 | ISO 8601格式 |
| updatedAt | string | 是 | ISO 8601格式 |
| version | number | 是 | 数据版本 (当前为2) |

### 3.2 PSQI (匹兹堡睡眠质量指数)

**问卷ID**: `psqi`

**评分范围**: 0-21分

**等级划分**:
- 0-5分: 睡眠质量好
- 6-10分: 睡眠质量中等
- 11-15分: 睡眠质量较差
- 16-21分: 睡眠质量很差

**components字段**:
```json
{
  "subjectiveQuality": 2,
  "sleepLatency": 1,
  "sleepDuration": 0,
  "habitualEfficiency": 3,
  "sleepDisturbance": 1,
  "medicationUse": 0,
  "daytimeDysfunction": 1
}
```

### 3.3 ISI (失眠严重指数)

**问卷ID**: `isi`

**评分范围**: 0-28分

**等级划分**:
- 0-7分: 无失眠
- 8-14分: 轻度失眠
- 15-21分: 中度失眠
- 22-28分: 重度失眠

## 4. 版本历史

### Version 1 (当前)
- 日记数据格式基础版本
- 支持核心睡眠参数记录
- 包含计算指标和影响因素标记

### Version 0 (旧版本兼容)
- 以日期为key的对象格式
- 直接存储在localStorage中
- 缺少统一version字段

## 5. 数据验证规则

### 5.1 必填字段验证

**日记记录**: `date`, `bedtime`, `wakeTime`, `outOfBedTime`

**问卷记录**: `id`, `questionnaireId`, `date`, `answers`

### 5.2 格式验证

- **日期格式**: 必须符合 `YYYY-MM-DD` (正则: `/^\d{4}-\d{2}-\d{2}$/`)
- **时间格式**: 必须符合 `HH:MM` (正则: `/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/`)
- **评分范围**: sleepQuality, daytimeAlertness 必须为 "1"-"5"

### 5.3 数值范围

- `sleepLatencyMin`: 0-300 (分钟)
- `awakeningsCount`: 0-50 (次)
- `awakeningsDurationMin`: 0-600 (分钟)

## 6. 导入导出兼容策略

### 6.1 向后兼容

- 支持导入旧版本数据（version < 1）
- 自动转换旧格式（日期为key的对象）
- 缺失字段使用默认值填充

### 6.2 向前兼容

- 拒绝导入高于当前版本的数据
- 显示版本不匹配错误提示

### 6.3 冲突处理

**检测到冲突时**:
1. 统计新增记录数
2. 统计覆盖记录数
3. 列出冲突日期（最多显示3个）
4. 用户确认后执行导入

## 7. 使用示例

### 7.1 导出数据

```javascript
// 获取日记数据
const payload = diaryStore.toJSON();
// { version: 1, diaries: [...] }

// 添加问卷数据
payload.questionnaires = questionnaireStore.getAll();

// 添加周报汇总
payload.weeklySummary = {
  rangeStart: "2025-11-01",
  rangeEnd: "2025-11-07",
  avgTSTMinutes: 420,
  avgSEPercent: 85.5
};

// 导出JSON
const jsonData = JSON.stringify(payload, null, 2);
```

### 7.2 导入数据

```javascript
// 读取文件
const importedData = JSON.parse(fileContent);

// 版本校验
if (importedData.version > DATA_VERSION) {
  throw new Error('文件版本过高');
}

// 字段验证
const requiredFields = ['bedtime', 'wakeTime', 'outOfBedTime'];

// 执行导入
diaryStore.fromJSON(importedData);
```

## 8. API参考

### 8.1 diaryStore API

```javascript
// 导出所有日记
diaryStore.toJSON() // => { version: 1, diaries: [...] }

// 导入日记
diaryStore.fromJSON(payload) // => { imported: n, overwritten: n }

// 获取所有日记
diaryStore.getMap() // => { "2025-11-01": {...}, ... }
```

### 8.2 questionnaireStore API

```javascript
// 获取所有问卷
questionnaireStore.getAll() // => [...]

// 导入单个问卷
questionnaireStore.upsertFromImport(entry)
```

## 9. 数据备份建议

1. **定期导出**: 建议每周导出一次数据备份
2. **文件命名**: 使用时间戳命名，如 `sleep_diary_20251113_153000.json`
3. **存储位置**: 保存到云盘或外部存储设备
4. **版本记录**: 保留旧版本备份，便于问题追溯

## 10. 常见问题

**Q: 如何迁移数据到新设备？**
A: 在原设备上导出JSON，然后在新设备上导入即可。

**Q: 导入时出现版本错误怎么办？**
A: 检查应用版本，如果文件版本过高，需要更新应用；如果版本过低，可以正常导入，部分字段可能丢失。

**Q: 数据丢失如何恢复？**
A: 使用最近导出的备份文件重新导入。

---

*本文档适用于睡眠日记应用 v1.0+*
