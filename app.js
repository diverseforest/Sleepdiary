const DATA_VERSION = 1;
const DIARY_STORAGE_KEY = 'sleepDiaryEntries';
const LEGACY_ARRAY_KEY = 'sleepDiaries';
const QUESTIONNAIRE_STORAGE_KEY = 'sleepQuestionnaires';
const QUESTIONNAIRE_DATA_VERSION = 2;

// ============================================================================
// 核心服务层 - 为未来云同步预留接口
// ============================================================================

const syncService = {
    /**
     * 同步服务占位符 - 当前为 no-op
     * 未来接入云存储或登录体系时只需实现以下接口
     */

    isOnline: function() {
        // 检查网络连接状态
        // 小程序实现: 使用 wx.getNetworkType()
        return navigator.onLine || false;
    },

    authenticate: async function(credentials) {
        // 用户认证
        // 小程序实现: 调用微信登录 wx.login()
        console.log('Sync: authenticate (no-op)');
        return { success: true, token: 'placeholder' };
    },

    syncToCloud: async function(payload) {
        // 上传数据到云端
        // 小程序实现: 使用 wx.cloud.callFunction()
        console.log('Sync: syncToCloud (no-op)', payload);
        return { success: true };
    },

    syncFromCloud: async function() {
        // 从云端下载数据
        // 小程序实现: 使用 wx.cloud.callFunction()
        console.log('Sync: syncFromCloud (no-op)');
        return { success: true, data: null };
    },

    getSyncStatus: function() {
        // 获取同步状态
        // 返回值: { isSynced: boolean, lastSyncTime: string }
        return {
            isSynced: false,
            lastSyncTime: null
        };
    }
};

// ============================================================================
// 组件层 - 模块化封装，逻辑与 DOM 分离
// ============================================================================

/**
 * 表单处理模块
 * 负责日记表单的加载、验证、计算和保存，不包含 DOM 操作
 */
const FormHandler = {
    /**
     * 从表单数据收集并标准化日记条目
     * @param {Object} formData - 原始表单数据
     * @returns {Object} 标准化后的日记条目
     */
    normalizeEntry: function(formData) {
        return normalizeEntry(formData);
    },

    /**
     * 计算睡眠指标
     * @param {Object} entry - 日记条目
     * @returns {Object} 计算出的睡眠指标
     */
    calculateMetrics: function(entry) {
        return calculateMetrics(entry);
    },

    /**
     * 验证表单数据的完整性
     * @param {Object} entry
     * @returns {Object} { isValid: boolean, errors: string[] }
     */
    validate: function(entry) {
        const errors = [];
        const requiredFields = ['date', 'bedtime', 'wakeTime', 'outOfBedTime'];

        requiredFields.forEach(field => {
            if (!entry[field]) {
                errors.push(`缺少必需字段: ${field}`);
            }
        });

        // 时间格式验证
        const timeFields = ['bedtime', 'wakeTime', 'outOfBedTime'];
        const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        timeFields.forEach(field => {
            if (entry[field] && !timeRegex.test(entry[field])) {
                errors.push(`时间格式错误: ${field} = ${entry[field]}`);
            }
        });

        return {
            isValid: errors.length === 0,
            errors
        };
    },

    /**
     * 格式化指标显示文本
     * @param {Object} metrics
     * @returns {Object} 格式化后的显示对象
     */
    formatMetricsForDisplay: function(metrics) {
        const format = (val, unit) => typeof val === 'number' ? `${val.toFixed(1)} ${unit}` : '-';

        return {
            tibDisplay: format(metrics.tibMinutes / 60, '小时'),
            tstDisplay: format(metrics.tstMinutes / 60, '小时'),
            seDisplay: format(metrics.sePercent, '%'),
            slDisplay: typeof metrics.sleepLatencyMinutes === 'number' ? `${metrics.sleepLatencyMinutes} 分钟` : '-',
            wasoDisplay: typeof metrics.wasoMinutes === 'number' ? `${metrics.wasoMinutes} 分钟` : '-',
            awakeInBedDisplay: typeof metrics.awakeInBedMinutes === 'number' ? `${metrics.awakeInBedMinutes} 分钟` : '-',
            sleepStartDisplay: metrics.sleepStartTime || '-'
        };
    }
};

/**
 * 周报渲染模块
 * 负责周报数据计算、图表渲染（逻辑层，不包含DOM操作）
 */
const WeeklyRenderer = {
    /**
     * 获取周的日期范围
     * @param {number} offset - 周偏移（0=本周，-1=上周，以此类推）
     * @returns {{start: Date, end: Date, startStr: string, endStr: string}}
     */
    getWeekRange: function(offset) {
        return getWeekRange(offset);
    },

    /**
     * 聚合周数据
     * @param {Array|Object} entries
     * @returns {Object} 聚合结果
     */
    aggregateWeek: function(entries) {
        const result = aggregateWeek(entries);
        const last7Count = result.count || 0;

        if (last7Count === 0) {
            return { count: 0 };
        }

        return {
            count: last7Count,
            avgTST: result.avgTSTMinutes,
            avgSE: result.avgSEPercent,
            anomalies: result.anomalies || []
        };
    },

    /**
     * 检测异常数据
     * @param {Array} diaryEntries
     * @returns {Array} 异常记录数组
     */
    detectAnomalies: function(diaryEntries) {
        const anomalies = [];
        diaryEntries.forEach(entry => {
            if (entry.metrics && entry.metrics.SE < 85) {
                anomalies.push({
                    date: entry.date,
                    message: `睡眠效率偏低 (${entry.metrics.SE.toFixed(1)}%)`
                });
            }
        });
        return anomalies;
    },

    /**
     * 渲染周报图表的数据准备
     * @param {Object} diaryMap - 日记数据对象
     * @param {number} offset - 周偏移
     * @returns {Object} 图表配置数据
     */
    prepareWeeklyChartData: function(diaryMap, offset) {
        const range = this.getWeekRange(offset);
        const labels = [];
        const tstHours = [];
        const sePercents = [];

        const color = (v, good) => v !== null ? (v >= good ? '#22c55e' : '#ef4444') : '#e5e7eb';

        for (let i = 0; i < 7; i++) {
            const d = new Date(range.start);
            d.setDate(range.start.getDate() + i);
            labels.push(d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));

            const key = formatDateKey(d);
            const entry = diaryMap[key];

            if (entry && entry.metrics) {
                const tst = typeof entry.metrics.TST === 'number' ? entry.metrics.TST : null;
                const se = typeof entry.metrics.SE === 'number' ? entry.metrics.SE : null;
                tstHours.push(tst);
                sePercents.push(se);
            } else {
                tstHours.push(null);
                sePercents.push(null);
            }
        }

        return {
            labels,
            tstHours,
            sePercents,
            rangeStart: range.startStr,
            rangeEnd: range.endStr
        };
    }
};

/**
 * 量表渲染模块
 * 负责问卷展示、评分、历史记录管理
 */
const QuestionnaireRenderer = {
    /**
     * 获取指定问卷配置
     * @param {string} id - 问卷ID (psqi, isi)
     * @returns {Object} 问卷配置
     */
    getQuestionnaire: function(id) {
        return questionnaires[id];
    },

    /**
     * 计算问卷分数
     * @param {string} id - 问卷ID
     * @param {Object} answers - 答案对象
     * @returns {Object} 评分结果
     */
    calculateScore: function(id, answers) {
        const q = this.getQuestionnaire(id);
        if (!q || !q.scoringFn) {
            return { score: null, severity: null };
        }
        return q.scoringFn(answers);
    },

    /**
     * 获取问卷历史记录
     * @returns {Array} 按时间排序的问卷历史
     */
    getHistory: function() {
        return questionnaireStore.getAll()
            .sort((a, b) => new Date(b.date) - new Date(a.date));
    },

    /**
     * 获取指定日期的问卷结果
     * @param {string} questionnaireId
     * @param {string} date
     * @returns {Object|null}
     */
    getByDate: function(questionnaireId, date) {
        const all = questionnaireStore.getAll();
        return all.find(entry => entry.questionnaireId === questionnaireId && entry.date === date) || null;
    },

    /**
     * 格式化问卷结果显示
     * @param {Object} entry
     * @returns {string}
     */
    formatResult: function(entry) {
        if (!entry) return '-';
        const q = this.getQuestionnaire(entry.questionnaireId);
        const name = q ? q.title : (entry.questionnaireId || '问卷');
        const score = entry.scoring?.score ?? entry.score;
        const severity = entry.scoring?.severity ?? entry.severity;
        const date = entry.date || ((entry.updatedAt || '').split('T')[0]) || '-';
        const scoreText = score != null ? `${score}分` : '-';
        const severityText = severity ? `（${severity}）` : '';
        return `${date} · ${name}: ${scoreText}${severityText}`;
    }
};

function generateId(prefix = 'id') {
    return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function parseTimeToMinutes(t) {
    if (!t || typeof t !== 'string' || !t.includes(':')) return null;
    const [h, m] = t.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
}

function addMinutes(timeStr, minutes) {
    const base = parseTimeToMinutes(timeStr);
    if (base === null) return null;
    const total = (base + minutes) % (24 * 60);
    const h = String(Math.floor(total / 60)).padStart(2, '0');
    const m = String(total % 60).padStart(2, '0');
    return `${h}:${m}`;
}

function formatDateKey(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function normalizeEntry(raw) {
    const date = raw.date;
    const bedtime = raw.bedTime || '';
    const sleepLatencyMin = raw.sleepLatency === '' ? null : (parseInt(raw.sleepLatency, 10) || 0);
    const awakeningsCount = raw.awakeningsCount === '' ? null : (parseInt(raw.awakeningsCount, 10) || 0);
    const awakeningsDurationMin = raw.awakeningsDuration === '' ? null : (parseInt(raw.awakeningsDuration, 10) || 0);
    const wakeTime = raw.wakeUpTime || '';
    const outOfBedTime = raw.outOfBedTime || '';
    const notes = raw.notes || '';
    const factors = raw.factors || {};
    const sleepQuality = raw.sleepQuality || '';
    const daytimeAlertness = raw.daytimeAlertness || '';
    return { date, bedtime, sleepLatencyMin, awakeningsCount, awakeningsDurationMin, wakeTime, outOfBedTime, notes, factors, sleepQuality, daytimeAlertness, version: DATA_VERSION };
}

function calculateMetrics(entry) {
    const bedM = parseTimeToMinutes(entry.bedtime);
    const outM = parseTimeToMinutes(entry.outOfBedTime);
    const wakeM = parseTimeToMinutes(entry.wakeTime);
    const sl = typeof entry.sleepLatencyMin === 'number' ? entry.sleepLatencyMin : null;
    const waso = typeof entry.awakeningsDurationMin === 'number' ? entry.awakeningsDurationMin : null;
    let tib = null;
    if (bedM !== null && outM !== null) {
        tib = outM >= bedM ? (outM - bedM) : ((24 * 60 - bedM) + outM);
    }
    let sleepStartM = null;
    if (bedM !== null && sl !== null) {
        sleepStartM = (bedM + sl) % (24 * 60);
    }
    let asleepMins = null;
    if (sleepStartM !== null && wakeM !== null) {
        asleepMins = wakeM >= sleepStartM ? (wakeM - sleepStartM) : ((24 * 60 - sleepStartM) + wakeM);
    }
    let tst = null;
    if (asleepMins !== null && waso !== null) {
        tst = asleepMins - waso;
        if (tst < 0) tst = 0;
    }
    let se = null;
    if (tst !== null && tib !== null && tib > 0) {
        se = (tst / tib) * 100;
    }
    let awakeInBed = null;
    if (wakeM !== null && outM !== null) {
        awakeInBed = outM >= wakeM ? (outM - wakeM) : ((24 * 60 - wakeM) + outM);
    }
        return {
            tibMinutes: tib,
            tstMinutes: tst,
            wasoMinutes: waso,
            sePercent: se,
            awakeInBedMinutes: awakeInBed,
            sleepStartTime: sleepStartM !== null ? `${String(Math.floor(sleepStartM / 60)).padStart(2, '0')}:${String(sleepStartM % 60).padStart(2, '0')}` : null,
            sleepLatencyMinutes: sl
        };
    }

function aggregateWeek(entries) {
    const arr = Array.isArray(entries) ? entries : Object.values(entries || {});
    const valid = arr.filter(e => e && e.date);
    const byDate = valid.sort((a, b) => new Date(a.date) - new Date(b.date));
    const last7 = byDate.slice(-7);
    if (last7.length === 0) return { count: 0 };
    let sumTST = 0, sumSE = 0, cntTST = 0, cntSE = 0, anomalies = [];
    for (const e of last7) {
        const normalized = e.normalized ? e.normalized : normalizeEntry({
            date: e.date,
            bedTime: e.bedTime,
            sleepLatency: e.sleepLatency,
            awakeningsCount: e.awakeningsCount,
            awakeningsDuration: e.awakeningsDuration,
            wakeUpTime: e.wakeUpTime,
            outOfBedTime: e.outOfBedTime,
            notes: e.notes,
            factors: e.factors,
            sleepQuality: e.sleepQuality,
            daytimeAlertness: e.daytimeAlertness
        });
        const m = calculateMetrics(normalized);
        if (typeof m.tstMinutes === 'number') { sumTST += m.tstMinutes; cntTST++; }
        if (typeof m.sePercent === 'number') { sumSE += m.sePercent; cntSE++; if (m.sePercent < 85) anomalies.push({ date: e.date, type: 'SE', value: m.sePercent }); }
    }
    return {
        count: last7.length,
        avgTSTMinutes: cntTST ? sumTST / cntTST : null,
        avgSEPercent: cntSE ? sumSE / cntSE : null,
        anomalies
    };
}

const diaryStore = {
    ensureMigrated: function() {
        const current = localStorage.getItem(DIARY_STORAGE_KEY);
        const legacy = localStorage.getItem(LEGACY_ARRAY_KEY);
        if (!current && legacy) {
            let parsed;
            try { parsed = JSON.parse(legacy); } catch { parsed = []; }
            const map = {};
            const arr = Array.isArray(parsed) ? parsed : Object.values(parsed || {});
            for (const e of arr) {
                if (e && e.date) map[e.date] = e;
            }
            localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(map));
            localStorage.removeItem(LEGACY_ARRAY_KEY);
        }
        const raw = localStorage.getItem(DIARY_STORAGE_KEY);
        if (!raw) return;
        let obj;
        try { obj = JSON.parse(raw); } catch { obj = {}; }
        let changed = false;
        for (const k of Object.keys(obj)) {
            const e = obj[k];
            if (!e || e.version) continue;
            const normalized = normalizeEntry({
                date: e.date,
                bedTime: e.bedTime,
                sleepLatency: e.sleepLatency,
                awakeningsCount: e.awakeningsCount,
                awakeningsDuration: e.awakeningsDuration,
                wakeUpTime: e.wakeUpTime,
                outOfBedTime: e.outOfBedTime,
                notes: e.notes,
                factors: e.factors,
                sleepQuality: e.sleepQuality,
                daytimeAlertness: e.daytimeAlertness
            });
            const m = calculateMetrics(normalized);
            const tstHours = typeof m.tstMinutes === 'number' ? parseFloat((m.tstMinutes / 60).toFixed(2)) : 0;
            const sePct = typeof m.sePercent === 'number' ? parseFloat(m.sePercent.toFixed(1)) : 0;
            const tstText = typeof m.tstMinutes === 'number' ? `${Math.floor(m.tstMinutes / 60)}小时 ${m.tstMinutes % 60}分钟` : '-';
            const seText = typeof m.sePercent === 'number' ? `${sePct.toFixed(1)} %` : '-';
            obj[k] = {
                ...e,
                normalized,
                metrics: {
                    ...e.metrics,
                    TST: tstHours,
                    SE: sePct,
                    tst_display: tstText,
                    se_display: seText,
                    waso: typeof m.wasoMinutes === 'number' ? `${m.wasoMinutes} 分钟` : '-',
                    timeAwakeInBed: typeof m.awakeInBedMinutes === 'number' ? `${m.awakeInBedMinutes} 分钟` : '-'
                },
                version: DATA_VERSION
            };
            changed = true;
        }
        if (changed) localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(obj));
    },
    getMap: function() {
        const raw = localStorage.getItem(DIARY_STORAGE_KEY);
        if (!raw) return {};
        try {
            const obj = JSON.parse(raw);
            return typeof obj === 'object' && obj ? obj : {};
        } catch { return {}; }
    },
    get: function(date) {
        const all = this.getMap();
        return all[date] || null;
    },
    set: function(date, entry) {
        const all = this.getMap();
        all[date] = entry;
        localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(all));
    },
    remove: function(date) {
        const all = this.getMap();
        delete all[date];
        localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(all));
    },
    toJSON: function() {
        const map = this.getMap();
        return { version: DATA_VERSION, diaries: Object.values(map) };
    },
    fromJSON: function(payload) {
        if (!payload || typeof payload !== 'object') return { imported: 0, overwritten: 0 };
        const diaries = Array.isArray(payload.diaries) ? payload.diaries : [];
        const all = this.getMap();
        let imported = 0, overwritten = 0;
        for (const e of diaries) {
            if (!e || !e.date) continue;
            if (all[e.date]) overwritten++; else imported++;
            all[e.date] = e;
        }
        localStorage.setItem(DIARY_STORAGE_KEY, JSON.stringify(all));
        return { imported, overwritten };
    }
};

const questionnaireStore = {
    ensureMigrated: function() {
        const raw = localStorage.getItem(QUESTIONNAIRE_STORAGE_KEY);
        if (!raw) {
            localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, '[]');
            return;
        }
        let parsed;
        try {
            parsed = JSON.parse(raw);
        } catch {
            localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, '[]');
            return;
        }
        if (Array.isArray(parsed)) {
            return;
        }
        if (parsed && typeof parsed === 'object') {
            const converted = [];
            Object.values(parsed).forEach(entry => {
                if (entry && entry.date && entry.questionnaireId) {
                    converted.push({
                        id: entry.id || generateId(entry.questionnaireId || 'qn'),
                        questionnaireId: entry.questionnaireId,
                        date: entry.date,
                        answers: entry.answers || {},
                        score: entry.score ?? null,
                        severity: entry.severity ?? null,
                        components: entry.components || null,
                        derived: entry.derived || null,
                        createdAt: entry.createdAt || `${entry.date}T00:00:00.000Z`,
                        updatedAt: entry.updatedAt || `${entry.date}T00:00:00.000Z`,
                        version: entry.version || QUESTIONNAIRE_DATA_VERSION
                    });
                }
            });
            localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(converted));
            return;
        }
        localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, '[]');
    },
    getAll: function() {
        const raw = localStorage.getItem(QUESTIONNAIRE_STORAGE_KEY);
        if (!raw) return [];
        try {
            const arr = JSON.parse(raw);
            return Array.isArray(arr) ? arr : [];
        } catch {
            return [];
        }
    },
    saveAll: function(entries) {
        localStorage.setItem(QUESTIONNAIRE_STORAGE_KEY, JSON.stringify(entries));
    },
    get: function(id) {
        return this.getAll().find(e => e.id === id) || null;
    },
    add: function(entry) {
        const entries = this.getAll();
        entries.push(entry);
        this.saveAll(entries);
        return entry;
    },
    update: function(entry) {
        const entries = this.getAll();
        const idx = entries.findIndex(e => e.id === entry.id);
        if (idx !== -1) {
            entries[idx] = entry;
            this.saveAll(entries);
        }
        return entry;
    },
    remove: function(id) {
        const entries = this.getAll().filter(e => e.id !== id);
        this.saveAll(entries);
    },
    latestWithinRange: function(questionnaireId, start, end) {
        const entries = this.getAll();
        let latest = null;
        entries.forEach(entry => {
            if (!entry || entry.questionnaireId !== questionnaireId || !entry.date) return;
            const d = new Date(entry.date);
            d.setHours(0, 0, 0, 0);
            if (d < start || d > end) return;
            const entryTime = new Date(entry.updatedAt || entry.createdAt || entry.date).getTime();
            if (!latest || entryTime > new Date(latest.updatedAt || latest.createdAt || latest.date).getTime()) {
                latest = entry;
            }
        });
        return latest;
    },
    upsertFromImport: function(entry) {
        if (!entry || !entry.date || !entry.questionnaireId) return;
        const normalized = {
            id: entry.id || generateId(entry.questionnaireId || 'qn'),
            questionnaireId: entry.questionnaireId,
            date: entry.date,
            answers: entry.answers || {},
            score: entry.score ?? null,
            severity: entry.severity ?? null,
            components: entry.components || null,
            derived: entry.derived || null,
            createdAt: entry.createdAt || entry.updatedAt || new Date().toISOString(),
            updatedAt: entry.updatedAt || entry.createdAt || new Date().toISOString(),
            version: entry.version || QUESTIONNAIRE_DATA_VERSION
        };
        const entries = this.getAll();
        const idx = entries.findIndex(e => e.id === normalized.id);
        if (idx !== -1) {
            entries[idx] = normalized;
        } else {
            entries.push(normalized);
        }
        this.saveAll(entries);
    }
};

// 等待整个 HTML 文档加载完成后再执行脚本
document.addEventListener('DOMContentLoaded', () => {
    // --- DOM 元素获取 ---
    // 日期选择器
    const datePicker = document.getElementById('datePicker');

    // 睡眠时段输入框
    const bedTimeInput = document.getElementById('bedTime'); // A. 准备睡觉时间
    const sleepLatencyInput = document.getElementById('sleepLatency'); // B. 入睡耗时
    const awakeningsCountInput = document.getElementById('awakeningsCount'); // C. 夜间觉醒次数
    const awakeningsDurationInput = document.getElementById('awakeningsDuration'); // D. 夜间觉醒总时长
    const wakeUpTimeInput = document.getElementById('wakeUpTime'); // E. 最终清醒时间
    const outOfBedTimeInput = document.getElementById('outOfBedTime'); // F. 离开卧床时间

    // 睡眠时段即时反馈元素
    const calculatedSleepTimeDisplay = document.getElementById('calculatedSleepTime'); // 估算入睡时间点
    const timeAwakeInBedDisplay = document.getElementById('timeAwakeInBed'); // 醒后卧床时长

    // 关键影响因素复选框和详情输入框
    const factorCheckboxes = {
        caffeine: document.getElementById('factorCaffeine'),
        alcohol: document.getElementById('factorAlcohol'),
        medication: document.getElementById('factorMedication'),
        exercise: document.getElementById('factorExercise'),
        daytimeDrowsiness: document.getElementById('factorDaytimeDrowsiness'),
    };
    const factorDetailInputs = {
        caffeine: document.getElementById('factorCaffeineDetail'),
        alcohol: document.getElementById('factorAlcoholDetail'),
        medication: document.getElementById('factorMedicationDetail'),
        exercise: document.getElementById('factorExerciseDetail'),
        daytimeDrowsiness: document.getElementById('factorDaytimeDrowsinessDetail'),
    };

    // 主观评价选择框
    const sleepQualitySelect = document.getElementById('sleepQuality');
    const daytimeAlertnessSelect = document.getElementById('daytimeAlertness');

    // 备注输入框
    const notesTextarea = document.getElementById('notes');

    // 操作按钮
    const saveDiaryBtn = document.getElementById('saveDiaryBtn');
    const clearFormBtn = document.getElementById('clearFormBtn');
    const deleteDiaryBtn = document.getElementById('deleteDiaryBtn');

    // 顶部全局操作按钮
    const exportDataBtn = document.getElementById('exportDataBtn');
    const exportCSVBtn = document.getElementById('exportCSVBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importFileElement = document.getElementById('importFile'); // 隐藏的文件选择框

    // 指标展示区域
    const metricTIBDisplay = document.getElementById('metricTIB'); // 卧床时间
    const metricSLDisplay = document.getElementById('metricSL'); // 入睡潜伏期
    const metricActualSleepTimeDisplay = document.getElementById('metricActualSleepTime'); // 实际入睡时间点
    const metricWASODisplay = document.getElementById('metricWASO'); // 睡后觉醒时长
    const metricTSTDisplay = document.getElementById('metricTST'); // 睡眠总时长
    const metricSEDisplay = document.getElementById('metricSE'); // 睡眠效率
    const metricTimeAwakeInBedDisplayOutput = document.getElementById('metricTimeAwakeInBedDisplay'); // 指标区-醒后卧床时长

    // 历史日记列表区域
    const historyListDiv = document.getElementById('historyList');

    // --- 应用程序状态 ---
    let currentEditingDate = null; // 用于跟踪当前正在编辑的日记的日期
    let sleepChartInstance = null; // 新增：用于存储Chart.js图表实例
    let lastCalculatedTSTHours = 0; // 新增：用于存储上次计算的睡眠总时长（小时，数值型）
    let lastCalculatedSEPercentage = 0; // 新增：用于存储上次计算的睡眠效率（百分比，数值型）
    let historyPageSize = 7; // 新增：历史记录每页显示的条数
    let historyCurrentPage = 1; // 新增：当前显示的历史记录页码

    // 初始化函数
    function initializeApp() {
        diaryStore.ensureMigrated();
        questionnaireStore.ensureMigrated();
        // 1. 设置日期选择器默认值为今天
        const today = new Date();
        // 格式化日期为 YYYY-MM-DD，以匹配 <input type="date"> 的 value 格式
        // toISOString() 返回类似 "2024-05-15T10:00:00.000Z" 的格式，我们取前面的日期部分
        datePicker.value = today.toISOString().split('T')[0];
        currentEditingDate = datePicker.value; // 初始化当前编辑日期

        // 2. 为影响因素的复选框添加事件监听，控制详情输入框的显示/隐藏
        for (const factor in factorCheckboxes) {
            factorCheckboxes[factor].addEventListener('change', (event) => {
                factorDetailInputs[factor].style.display = event.target.checked ? 'inline-block' : 'none';
            });
        }

        // 3. 为“夜间觉醒次数”输入框添加事件监听，控制“夜间觉醒总时长”的可用性
        awakeningsCountInput.addEventListener('input', () => {
            const count = parseInt(awakeningsCountInput.value, 10);
            if (count === 0) {
                awakeningsDurationInput.value = '0'; // 如果觉醒0次，时长也设为0
                awakeningsDurationInput.disabled = true; // 禁用时长输入
            } else {
                awakeningsDurationInput.disabled = false; // 启用时长输入
            }
            calculateAndDisplayMetrics(); // 重新计算指标
        });
        // 初始化时也检查一次
        awakeningsDurationInput.disabled = parseInt(awakeningsCountInput.value, 10) === 0;


        // 4. 为睡眠时段相关输入框添加事件监听，实时计算指标
        [bedTimeInput, sleepLatencyInput, awakeningsDurationInput, wakeUpTimeInput, outOfBedTimeInput].forEach(input => {
            input.addEventListener('input', calculateAndDisplayMetrics);
            input.addEventListener('change', calculateAndDisplayMetrics); // 'change' 确保时间选择器关闭后也触发
        });

        // 5. 为日期选择器添加事件监听，加载对应日期的日记
        datePicker.addEventListener('change', handleDateChange);

        // 6. 为操作按钮添加事件监听
        saveDiaryBtn.addEventListener('click', saveDiary);
        clearFormBtn.addEventListener('click', clearForm);
        deleteDiaryBtn.addEventListener('click', deleteDiary);

        // 7. 为导入导出按钮添加事件监听 (功能后续实现)
        exportDataBtn.addEventListener('click', exportData);
        exportCSVBtn.addEventListener('click', exportCSV);
        importDataBtn.addEventListener('click', () => importFileElement.click()); // 点击按钮时触发隐藏的文件输入框
        importFileElement.addEventListener('change', importData);
        const prevW = document.getElementById('prevWeekBtn');
        const nextW = document.getElementById('nextWeekBtn');
        if (prevW) prevW.addEventListener('click', () => { currentWeekOffset -= 1; renderWeeklySummary(); });
        if (nextW) nextW.addEventListener('click', () => { currentWeekOffset = Math.min(currentWeekOffset + 1, 0); renderWeeklySummary(); });
        const psqiBtn=document.getElementById('psqiTabBtn');
        const isiBtn=document.getElementById('isiTabBtn');
        if(psqiBtn) psqiBtn.addEventListener('click',()=>renderQuestionnaireForm('psqi'));
        if(isiBtn) isiBtn.addEventListener('click',()=>renderQuestionnaireForm('isi'));
        const saveQ=document.getElementById('saveQuestionnaireBtn');
        const delQ=document.getElementById('deleteQuestionnaireBtn');
        if(saveQ) saveQ.addEventListener('click', saveCurrentQuestionnaire);
        if(delQ) delQ.addEventListener('click', deleteCurrentQuestionnaire);
        renderQuestionnaireForm('psqi');


        // 8. 加载当天的日记（如果存在）
        loadDiaryForDate(currentEditingDate);

        // 9. 渲染历史日记列表
        renderHistoryList();

        // 新增：应用初始化时渲染图表
        // 确保在DOM完全加载后再渲染图表
        setTimeout(() => {
            const initialDiaries = getAllDiariesFromLocalStorage();
            renderSleepChart(initialDiaries);
            console.log('图表初始化完成');
        }, 100);

        renderWeeklySummary();

        // 添加：渲染量表历史
        renderQuestionnaireHistory();

        console.log('睡眠日记应用已初始化完毕！');
    }

    // --- 事件处理函数 ---

    // 处理日期选择器变化
    function handleDateChange() {
        currentEditingDate = datePicker.value;
        console.log(`日期已更改为: ${currentEditingDate}`);
        loadDiaryForDate(currentEditingDate);
        // 当日期改变时，也需要更新指标显示，因为可能加载了新数据或清空了表单
        calculateAndDisplayMetrics();
    }

    // 清空表单
    function clearForm(setTodayAsDate = true) {
        console.log('清空表单...');
        if (setTodayAsDate) {
            const today = new Date().toISOString().split('T')[0];
            datePicker.value = today;
            currentEditingDate = today;
        }
        // 清空睡眠时段输入
        bedTimeInput.value = '';
        sleepLatencyInput.value = '';
        awakeningsCountInput.value = '0';
        awakeningsDurationInput.value = '0';
        awakeningsDurationInput.disabled = true; // 因为觉醒次数为0
        wakeUpTimeInput.value = '';
        outOfBedTimeInput.value = '';

        // 清空影响因素
        for (const factor in factorCheckboxes) {
            factorCheckboxes[factor].checked = false;
            factorDetailInputs[factor].value = '';
            factorDetailInputs[factor].style.display = 'none';
        }

        // 清空主观评价
        sleepQualitySelect.value = '';
        daytimeAlertnessSelect.value = '';

        // 清空备注
        notesTextarea.value = '';

        // 重置按钮状态
        saveDiaryBtn.textContent = '保存日记';
        deleteDiaryBtn.style.display = 'none';

        // 清空即时反馈和指标显示
        calculateAndDisplayMetrics(); // 这会根据空值重置指标显示
        console.log('表单已清空。');
    }


    // --- 核心功能函数 (占位符或初步实现) ---

    // 计算并显示睡眠指标
    function calculateAndDisplayMetrics() {
        console.log('正在计算睡眠指标...');

        const bedTime = bedTimeInput.value; // "HH:MM"
        const sleepLatency = parseInt(sleepLatencyInput.value, 10) || 0; // 分钟
        const awakeningsDuration = parseInt(awakeningsDurationInput.value, 10) || 0; // 分钟
        const wakeUpTime = wakeUpTimeInput.value; // "HH:MM"
        const outOfBedTime = outOfBedTimeInput.value; // "HH:MM"

        // 重置所有指标显示
        metricTIBDisplay.textContent = '-';
        metricSLDisplay.textContent = '-';
        metricActualSleepTimeDisplay.textContent = '-';
        metricWASODisplay.textContent = '-';
        metricTSTDisplay.textContent = '-';
        metricSEDisplay.textContent = '-';
        metricTimeAwakeInBedDisplayOutput.textContent = '-';
        calculatedSleepTimeDisplay.textContent = '估算入睡时间点：--:--';
        timeAwakeInBedDisplay.textContent = '醒后卧床：- 分钟';

        // 重置临时存储的数值指标
        lastCalculatedTSTHours = 0;
        lastCalculatedSEPercentage = 0;

        // 1. 计算估算入睡时间点 (A + B)
        if (bedTime && sleepLatencyInput.value !== '') { // 确保入睡耗时有输入（可以是0）
            const bedTimeDate = new Date(`1970-01-01T${bedTime}:00`); // 使用一个固定日期来处理时间
            const actualSleepDate = new Date(bedTimeDate.getTime() + sleepLatency * 60000); // 毫秒转换
            const hours = String(actualSleepDate.getHours()).padStart(2, '0');
            const minutes = String(actualSleepDate.getMinutes()).padStart(2, '0');
            const actualSleepTimeFormatted = `${hours}:${minutes}`;
            calculatedSleepTimeDisplay.textContent = `估算入睡时间点：${actualSleepTimeFormatted}`;
            metricActualSleepTimeDisplay.textContent = actualSleepTimeFormatted;
        }

        // 2. 入睡潜伏期 (SL) (B)
        if (sleepLatencyInput.value !== '') {
            metricSLDisplay.textContent = `${sleepLatency} 分钟`;
        }

        // 3. 睡后觉醒时长 (WASO) (D)
        if (awakeningsDurationInput.value !== '') {
             metricWASODisplay.textContent = `${awakeningsDuration} 分钟`;
        }


        // 4. 计算醒后卧床时长 (F - E)
        if (wakeUpTime && outOfBedTime) {
            const wakeUpDate = new Date(`1970-01-02T${wakeUpTime}:00`); // 假设是第二天早上
            const outOfBedDate = new Date(`1970-01-02T${outOfBedTime}:00`);

            if (outOfBedDate > wakeUpDate) {
                const diffMs = outOfBedDate - wakeUpDate;
                const diffMins = Math.round(diffMs / 60000);
                timeAwakeInBedDisplay.textContent = `醒后卧床：${diffMins} 分钟`;
                metricTimeAwakeInBedDisplayOutput.textContent = `${diffMins} 分钟`;
            } else if (outOfBedTime === wakeUpTime) {
                 timeAwakeInBedDisplay.textContent = `醒后卧床：0 分钟`;
                 metricTimeAwakeInBedDisplayOutput.textContent = `0 分钟`;
            } else {
                timeAwakeInBedDisplay.textContent = '醒后卧床：离开时间早于醒来时间';
                metricTimeAwakeInBedDisplayOutput.textContent = '-';
            }
        }

        // 5. 计算卧床时间 (TIB) (F - A)
        // 6. 计算睡眠总时长 (TST) ((E - (A+B)) - D)
        // 7. 计算睡眠效率 (SE) (TST / TIB * 100)
        if (bedTime && outOfBedTime) {
            // 假设 bedTime 是前一天，outOfBedTime 是当天
            // 为了简化计算，我们将所有时间都转换为相对于某个基准点（比如前一天的午夜）的分钟数
            const [bedH, bedM] = bedTime.split(':').map(Number); // 将卧床时间字符串 "HH:MM" 分割为小时和分钟
            const [outH, outM] = outOfBedTime.split(':').map(Number); // 将离开卧床时间字符串 "HH:MM" 分割为小时和分钟

            // 将时间转换为从午夜开始的分钟数
            // 如果 bedTime 是晚上 (e.g., 23:00)，outOfBedTime 是早上 (e.g., 07:00)
            // 卧床时间 = (24*60 - (bedH*60 + bedM)) + (outH*60 + outM)
            // 如果 bedTime 和 outOfBedTime 都在同一天 (例如午睡记录，虽然本应用主要针对夜间)
            // 则 outOfBedTimeMin > bedTimeMin
            let bedTimeInMinutes = bedH * 60 + bedM; // 将卧床时间转换为当天的总分钟数
            let outOfBedTimeInMinutes = outH * 60 + outM; // 将离开卧床时间转换为当天的总分钟数

            let tibMinutes; // 用于存储计算出的卧床总分钟数

            // 典型情况：昨晚上床，今早起床 (跨天)
            // 或者，同一天内上床和离开卧床 (例如午睡，但这里主要处理夜间睡眠)
            // 下面的 if 条件判断是否跨天
            // 如果离开卧床的分钟数小于上床的分钟数 (例如 07:00 < 23:00)，则认为是跨天
            // 或者如果分钟数相同，但离开卧床的原始时间字符串大于等于上床时间字符串 (例如 "08:00" >= "08:00" 这种情况其实是同一时间，但逻辑上包含在内以处理边缘情况，主要还是靠分钟数判断)
            // 注意：这里的 outOfBedTime >= bedTime 比较的是字符串，可能不是最稳健的跨天判断，
            // 主要依赖于 outOfBedTimeInMinutes < bedTimeInMinutes。
            // 更稳健的跨天判断是：如果 outOfBedTime 的小时数小于 bedTime 的小时数，或者小时数相同但分钟数小于 bedTime 的分钟数，则为跨天。
            // 不过，当前逻辑 `outOfBedTimeInMinutes < bedTimeInMinutes` 已经能正确处理典型的夜间睡眠跨天。
            if (outOfBedTimeInMinutes < bedTimeInMinutes || (outOfBedTimeInMinutes === bedTimeInMinutes && outOfBedTimeInput.value >= bedTimeInput.value && bedTimeInput.value !== outOfBedTimeInput.value )) { // 跨天了 (例如 23:00 上床, 07:00 起床)
                                                                                                                                                                                          // 或者同一时间但不同日期（虽然不太可能通过UI输入）
                                                                                                                                                                                          // 修正：确保比较的是原始输入值，并且它们不完全相同（避免0分钟卧床被错误判断为跨天）
                tibMinutes = (24 * 60 - bedTimeInMinutes) + outOfBedTimeInMinutes; // (午夜前的分钟数) + (午夜后的分钟数)
            } else { // 同一天内 (例如 13:00 上床, 14:00 起床 - 午睡场景)
                tibMinutes = outOfBedTimeInMinutes - bedTimeInMinutes;
            }

            if (tibMinutes > 0) {
                metricTIBDisplay.textContent = `${Math.floor(tibMinutes / 60)}小时 ${tibMinutes % 60}分钟`;

                if (wakeUpTime && bedTime && sleepLatencyInput.value !== '') {
                    const actualSleepTimeFormatted = metricActualSleepTimeDisplay.textContent;
                    if (actualSleepTimeFormatted !== '-' && actualSleepTimeFormatted !== '--:--' && actualSleepTimeFormatted.includes(':')) {
                        const [actualSleepH, actualSleepM] = actualSleepTimeFormatted.split(':').map(Number);
                        const [wakeUpH, wakeUpM] = wakeUpTime.split(':').map(Number);

                        let actualSleepTimeTotalMinutes = actualSleepH * 60 + actualSleepM;
                        let wakeUpTimeTotalMinutes = wakeUpH * 60 + wakeUpM;
                        let timeInBedSleepingMinutes;

                        if (wakeUpTimeTotalMinutes < actualSleepTimeTotalMinutes || (wakeUpTimeTotalMinutes === actualSleepTimeTotalMinutes && wakeUpTime >= actualSleepTimeFormatted.substring(0,5))) {
                             timeInBedSleepingMinutes = (24*60 - actualSleepTimeTotalMinutes) + wakeUpTimeTotalMinutes;
                        } else {
                            timeInBedSleepingMinutes = wakeUpTimeTotalMinutes - actualSleepTimeTotalMinutes;
                        }

                        if (timeInBedSleepingMinutes >= 0) {
                            const tstMinutes = timeInBedSleepingMinutes - awakeningsDuration;
                            if (tstMinutes >= 0) {
                                metricTSTDisplay.textContent = `${Math.floor(tstMinutes / 60)}小时 ${tstMinutes % 60}分钟`;
                                lastCalculatedTSTHours = parseFloat((tstMinutes / 60).toFixed(2)); // 更新数值TST (小时)

                                // 计算睡眠效率 SE
                                if (tibMinutes > 0) { // 确保卧床时间大于0，避免除以0
                                    const seValue = (tstMinutes / tibMinutes) * 100;
                                    metricSEDisplay.textContent = `${seValue.toFixed(1)} %`;
                                    lastCalculatedSEPercentage = parseFloat(seValue.toFixed(1)); // 更新数值SE (%)
                                } else {
                                    metricSEDisplay.textContent = '0.0 %'; // TIB为0，则SE为0
                                    lastCalculatedSEPercentage = 0;
                                }
                            } else {
                                metricTSTDisplay.textContent = '计算错误'; // 觉醒时长大于睡眠时长
                                metricSEDisplay.textContent = '-';
                                lastCalculatedTSTHours = 0; // 重置
                                lastCalculatedSEPercentage = 0; // 重置
                            }
                        } else {
                             metricTSTDisplay.textContent = '计算错误'; // 醒来时间早于入睡时间
                             metricSEDisplay.textContent = '-';
                             lastCalculatedTSTHours = 0; // 重置
                             lastCalculatedSEPercentage = 0; // 重置
                        }
                    }
                }
            } else if (tibMinutes === 0) {
                metricTIBDisplay.textContent = '0分钟';
                metricTSTDisplay.textContent = '0分钟';
                metricSEDisplay.textContent = '0.0 %';
                lastCalculatedTSTHours = 0; // TIB为0，TST也为0
                lastCalculatedSEPercentage = 0; // TIB为0，SE也为0
            } else {
                metricTIBDisplay.textContent = '计算错误'; // 离开卧床时间早于上床时间
                // 其他指标也应设为错误或默认值
                metricTSTDisplay.textContent = '-';
                metricSEDisplay.textContent = '-';
                lastCalculatedTSTHours = 0;
                lastCalculatedSEPercentage = 0;
            }
        }
    }


    // 加载指定日期的日记
    function loadDiaryForDate(dateString) {
        console.log(`尝试加载日期 ${dateString} 的日记...`);
        const diaryData = getDiaryFromLocalStorage(dateString);

        if (diaryData) {
            console.log('找到日记数据:', diaryData);
            // 填充表单
            bedTimeInput.value = diaryData.bedTime || '';
            sleepLatencyInput.value = diaryData.sleepLatency || '';
            awakeningsCountInput.value = diaryData.awakeningsCount || '0';
            awakeningsDurationInput.value = diaryData.awakeningsDuration || '0';
            awakeningsDurationInput.disabled = parseInt(awakeningsCountInput.value, 10) === 0;
            wakeUpTimeInput.value = diaryData.wakeUpTime || '';
            outOfBedTimeInput.value = diaryData.outOfBedTime || '';

            for (const factor in factorCheckboxes) {
                if (diaryData.factors && diaryData.factors[factor]) {
                    factorCheckboxes[factor].checked = true;
                    factorDetailInputs[factor].value = diaryData.factors[factor].detail || '';
                    factorDetailInputs[factor].style.display = 'inline-block';
                } else {
                    factorCheckboxes[factor].checked = false;
                    factorDetailInputs[factor].value = '';
                    factorDetailInputs[factor].style.display = 'none';
                }
            }

            sleepQualitySelect.value = diaryData.sleepQuality || '';
            daytimeAlertnessSelect.value = diaryData.daytimeAlertness || '';
            notesTextarea.value = diaryData.notes || '';

            saveDiaryBtn.textContent = '更新日记';
            deleteDiaryBtn.style.display = 'inline-block'; // 或 'block' 根据CSS布局
        } else {
            console.log(`日期 ${dateString} 无日记数据，清空表单。`);
            clearForm(false); // 清空表单，但不改变日期选择器的值
            saveDiaryBtn.textContent = '保存日记';
            deleteDiaryBtn.style.display = 'none';
        }
        // 无论加载成功与否，都重新计算一次指标（对于空表单，指标会显示为'-'）
        calculateAndDisplayMetrics();
    }

    // 保存当前日记 (到 localStorage) - 使用 FormHandler 重构
    function saveDiary() {
        const date = datePicker.value;
        if (!date) {
            alert('请先选择一个日期！');
            return;
        }

        // 在保存前确保最新的指标已计算并存入lastCalculated...变量
        calculateAndDisplayMetrics();

        // 1. 收集原始表单数据
        const rawFormData = {
            date: date,
            bedTime: bedTimeInput.value,
            sleepLatency: sleepLatencyInput.value,
            awakeningsCount: awakeningsCountInput.value,
            awakeningsDuration: awakeningsDurationInput.value,
            wakeUpTime: wakeUpTimeInput.value,
            outOfBedTime: outOfBedTimeInput.value,
            sleepQuality: sleepQualitySelect.value,
            daytimeAlertness: daytimeAlertnessSelect.value,
            notes: notesTextarea.value,
            factors: {}
        };

        // 收集影响因素
        for (const factor in factorCheckboxes) {
            if (factorCheckboxes[factor].checked) {
                rawFormData.factors[factor] = {
                    checked: true,
                    detail: factorDetailInputs[factor].value
                };
            }
        }

        // 2. 使用 FormHandler 标准化数据
        const normalizedEntry = FormHandler.normalizeEntry(rawFormData);

        // 3. 使用 FormHandler 验证数据
        const validation = FormHandler.validate(normalizedEntry);
        if (!validation.isValid) {
            alert(`数据验证失败，请检查以下问题：\n\n${validation.errors.join('\n')}`);
            return;
        }

        // 4. 使用 FormHandler 计算指标
        const metrics = FormHandler.calculateMetrics(normalizedEntry);
        const formattedMetrics = FormHandler.formatMetricsForDisplay(metrics);

        // 5. 构建完整日记条目
        const diaryEntry = {
            // 保留原始表单数据字段（大驼峰），供 saveDiaryToLocalStorage 重新标准化
            date: rawFormData.date,
            bedTime: rawFormData.bedTime,
            sleepLatency: rawFormData.sleepLatency,
            awakeningsCount: rawFormData.awakeningsCount,
            awakeningsDuration: rawFormData.awakeningsDuration,
            wakeUpTime: rawFormData.wakeUpTime,
            outOfBedTime: rawFormData.outOfBedTime,
            sleepQuality: rawFormData.sleepQuality,
            daytimeAlertness: rawFormData.daytimeAlertness,
            notes: rawFormData.notes,
            factors: rawFormData.factors,
            // 同时保存标准化数据供逻辑层使用
            normalized: normalizedEntry,
            // 存储指标（文本格式用于直接显示）
            metrics: {
                tib: formattedMetrics.tibDisplay,
                sl: formattedMetrics.slDisplay,  // 修复：从 seDisplay 改为 slDisplay
                actualSleepTime: metricActualSleepTimeDisplay.textContent,
                waso: formattedMetrics.wasoDisplay,
                tst_display: metricTSTDisplay.textContent,
                se_display: metricSEDisplay.textContent,
                timeAwakeInBed: metricTimeAwakeInBedDisplayOutput.textContent,
                // 数值格式用于图表和计算
                TST: lastCalculatedTSTHours,
                SE: lastCalculatedSEPercentage
            }
        };

        console.log(`准备保存日期 ${date} 的日记:`, diaryEntry);

        // 6. 保存到存储
        saveDiaryToLocalStorage(date, diaryEntry);

        alert('日记已保存！');

        // 7. 刷新界面
        renderHistoryList();
        const allDiaries = getAllDiariesFromLocalStorage();
        renderSleepChart(allDiaries);
        renderWeeklySummary();

        // 更新按钮状态
        saveDiaryBtn.textContent = '更新日记';
        deleteDiaryBtn.style.display = 'inline-block';
    }

    // 删除当前日记 (从 localStorage)
    function deleteDiary() {
        if (!currentEditingDate) {
            alert('没有选中要删除的日记日期。');
            return;
        }

        if (confirm(`确定要删除日期 ${currentEditingDate} 的日记吗？`)) {
            deleteDiaryFromLocalStorage(currentEditingDate);
            alert('日记已删除。');
            clearForm(false); // 清空表单，保持当前日期
            loadDiaryForDate(currentEditingDate); // 会重置按钮状态并清空指标
            renderHistoryList(); // 刷新历史列表

            // 新增：删除后更新图表
            const allDiaries = getAllDiariesFromLocalStorage();
            renderSleepChart(allDiaries);
            renderWeeklySummary();
        }
    }

    // 渲染历史日记列表
    function renderHistoryList() {
        console.log('正在渲染历史日记列表...');
        historyListDiv.innerHTML = ''; // 清空现有列表
        const allDiaries = getAllDiariesFromLocalStorage(); // 获取所有日记

        // 按日期倒序排序 (最新的在前面)
        const sortedDates = Object.keys(allDiaries).sort((a, b) => new Date(b) - new Date(a));

        if (sortedDates.length === 0) {
            historyListDiv.innerHTML = '<p>暂无历史记录。</p>';
            return;
        }

        // 计算当前页应显示的记录
        const startIndex = 0;
        const endIndex = historyPageSize * historyCurrentPage;
        const currentPageDates = sortedDates.slice(startIndex, endIndex);

        currentPageDates.forEach(date => {
            const entry = allDiaries[date];
            const listItem = document.createElement('div');
            listItem.classList.add('history-item');
            listItem.dataset.date = date; // 存储日期，方便点击时加载

            // 根据设计稿，显示 日期 | TST | SE | 品质
            // 修正：使用正确的属性名称获取保存的指标
            const tst = entry.metrics?.tst_display || '-'; 
            const se = entry.metrics?.se_display || '-';   
            let qualityText = '-';
            if (entry.sleepQuality) {
                const qualityOption = sleepQualitySelect.querySelector(`option[value="${entry.sleepQuality}"]`);
                qualityText = qualityOption ? qualityOption.textContent.split(' - ')[1] : entry.sleepQuality; // 显示 "很好" 而不是 "5 - 很好"
            }

            listItem.innerHTML = `
                <div>
                    <span class="history-item-date">${date}</span>
                    <span class="history-item-tst">TST: ${tst}</span>
                    <span class="history-item-se">SE: ${se}</span>
                    <span class="history-item-quality">品质: ${qualityText}</span>
                </div>
                <div class="history-item-actions">
                    <button class="delete-history-item-btn" data-date="${date}" title="删除此条记录">×</button>
                </div>
            `;

            // 点击历史条目加载到编辑区
            listItem.querySelector('div:first-child').addEventListener('click', () => {
                datePicker.value = date; // 更新日期选择器
                handleDateChange(); // 触发加载逻辑
            });

            // 点击小删除按钮删除记录
            listItem.querySelector('.delete-history-item-btn').addEventListener('click', (event) => {
                event.stopPropagation(); // 防止触发父元素的点击事件（加载日记）
                const dateToDelete = event.target.dataset.date;
                if (confirm(`您确定要删除 ${dateToDelete} 的睡眠日记吗？`)) {
                    deleteDiaryFromLocalStorage(dateToDelete);
                    renderHistoryList(); // 重新渲染列表
                    // 如果删除的是当前正在编辑的日记，则清空表单

                    if (datePicker.value === dateToDelete) {
                        clearForm(false); // 清空表单，但不改变日期
                        // 当删除当前编辑的日记后，指标也应该基于空表单重新计算并显示
                        calculateAndDisplayMetrics();
                    }
                    // 删除后也需要更新图表
                    const updatedDiaries = getAllDiariesFromLocalStorage();
                    renderSleepChart(updatedDiaries);
                    renderWeeklySummary();
                    alert(`日记 ${dateToDelete} 已删除。`);
                }
            });

            historyListDiv.appendChild(listItem);
        });

        // 如果还有更多记录未显示，添加"加载更多"按钮
        if (sortedDates.length > endIndex) {
            const loadMoreBtn = document.createElement('button');
            loadMoreBtn.id = 'loadMoreHistoryBtn';
            loadMoreBtn.textContent = '加载更多';
            loadMoreBtn.classList.add('load-more-btn');
            loadMoreBtn.addEventListener('click', () => {
                historyCurrentPage++;
                renderHistoryList();
            });
            historyListDiv.appendChild(loadMoreBtn);
        }
    }

    // 导出数据（JSON格式）
    function exportData() {
        const payload = diaryStore.toJSON();
        if (!Array.isArray(payload.diaries) || payload.diaries.length === 0) {
            alert('没有数据可以导出。');
            return;
        }
        const weeklyRange = getWeekRange(0);
        const map = getAllDiariesFromLocalStorage();
        let sumTstMin = 0, cntTst = 0, sumSe = 0, cntSe = 0;
        for (let i=0;i<7;i++) {
            const d = new Date(weeklyRange.start);
            d.setDate(weeklyRange.start.getDate()+i);
            const y = d.getFullYear();
            const m = String(d.getMonth()+1).padStart(2,'0');
            const day = String(d.getDate()).padStart(2,'0');
            const key = `${y}-${m}-${day}`;
            const e = map[key];
            if (e) {
                const tstH = typeof e.metrics?.TST === 'number' ? e.metrics.TST : null;
                const seP = typeof e.metrics?.SE === 'number' ? e.metrics.SE : null;
                if (typeof tstH === 'number') { sumTstMin += tstH*60; cntTst++; }
                if (typeof seP === 'number') { sumSe += seP; cntSe++; }
            }
        }
        payload.weeklySummary = {
            rangeStart: weeklyRange.startStr,
            rangeEnd: weeklyRange.endStr,
            avgTSTMinutes: cntTst ? Math.round(sumTstMin/cntTst) : null,
            avgSEPercent: cntSe ? parseFloat((sumSe/cntSe).toFixed(1)) : null
        };
        payload.questionnaires = questionnaireStore.getAll();
        const jsonData = JSON.stringify(payload, null, 2);
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, -4);
        a.download = `my_sleep_diary_export_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('JSON数据已导出！');
    }

    // 导出CSV格式数据
    function exportCSV() {
        const payload = diaryStore.toJSON();
        if (!Array.isArray(payload.diaries) || payload.diaries.length === 0) {
            alert('没有数据可以导出。');
            return;
        }

        // CSV表头
        const headers = [
            '日期', '上床时间', '入睡潜伏期(分钟)', '觉醒次数',
            '觉醒持续时间(分钟)', '醒来时间', '起床时间',
            '睡眠总时长(分钟)', '睡眠效率(%)',
            '睡眠质量', '日间警觉性', '备注'
        ];

        // 转换数据行
        const rows = payload.diaries.map(entry => {
            const tstMinutes = entry.metrics?.TST ? Math.round(entry.metrics.TST * 60) : '';
            const sePercent = entry.metrics?.SE ? entry.metrics.SE : '';

            return [
                entry.date,
                entry.bedtime || '',
                entry.sleepLatencyMin ?? '',
                entry.awakeningsCount ?? '',
                entry.awakeningsDurationMin ?? '',
                entry.wakeTime || '',
                entry.outOfBedTime || '',
                tstMinutes,
                sePercent,
                entry.sleepQuality || '',
                entry.daytimeAlertness || '',
                `"${(entry.notes || '').replace(/"/g, '""')}"` // CSV转义双引号
            ];
        });

        // 添加周报KPI作为注释行
        const weeklyRange = getWeekRange(0);
        const map = getAllDiariesFromLocalStorage();
        let sumTstMin = 0, cntTst = 0, sumSe = 0, cntSe = 0;
        for (let i=0;i<7;i++) {
            const d = new Date(weeklyRange.start);
            d.setDate(weeklyRange.start.getDate()+i);
            const key = formatDateKey(d);
            const e = map[key];
            if (e && typeof e.metrics?.TST === 'number') {
                sumTstMin += e.metrics.TST * 60;
                cntTst++;
            }
            if (e && typeof e.metrics?.SE === 'number') {
                sumSe += e.metrics.SE;
                cntSe++;
            }
        }
        const avgTST = cntTst ? Math.round(sumTstMin / cntTst) : 0;
        const avgSE = cntSe ? (sumSe / cntSe).toFixed(1) : 0;

        const csvLines = [
            '# 睡眠日记数据导出',
            `# 导出时间: ${new Date().toLocaleString('zh-CN')}`,
            `# 周报期间: ${weeklyRange.startStr} 至 ${weeklyRange.endStr}`,
            `# 平均TST: ${avgTST} 分钟`,
            `# 平均SE: ${avgSE}%`,
            headers.join(','),
            ...rows.map(row => row.join(','))
        ];

        const csvContent = csvLines.join('\n');
        const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, -4);
        a.download = `my_sleep_diary_export_${timestamp}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('CSV数据已导出！');
    }

    // 导入数据（增强版，包含校验和详细冲突处理）
    function importData(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);

                // 1. 基础格式校验
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('文件内容不是有效的JSON对象。');
                }

                // 2. 版本校验（向后兼容旧版本）
                const fileVersion = importedData.version || 0;
                if (fileVersion > DATA_VERSION) {
                    throw new Error(`文件版本(${fileVersion})高于当前应用支持的版本(${DATA_VERSION})，请更新应用后再尝试导入。`);
                }
                if (fileVersion < DATA_VERSION) {
                    if (!confirm(`检测到旧版本数据（版本 ${fileVersion}），当前版本为 ${DATA_VERSION}。\n\n旧版本数据可以自动转换，但可能会有部分字段丢失。\n\n是否继续导入？`)) {
                        importFileElement.value = '';
                        return;
                    }
                }

                // 3. 字段完整性验证和预览
                let importCount = 0;
                let overwriteCount = 0;
                let questionnaireImportCount = 0;
                const existingDiaries = getAllDiariesFromLocalStorage();
                const conflicts = [];

                // 验证日记数据
                if (Array.isArray(importedData.diaries)) {
                    for (const diary of importedData.diaries) {
                        if (!diary || !diary.date) continue;

                        // 验证必需字段完整性
                        const requiredFields = ['bedtime', 'wakeTime', 'outOfBedTime'];
                        const missingFields = requiredFields.filter(field => !diary[field]);
                        if (missingFields.length > 0) {
                            console.warn(`日记 ${diary.date} 缺少字段: ${missingFields.join(', ')}`);
                        }

                        if (existingDiaries[diary.date]) {
                            overwriteCount++;
                            conflicts.push(diary.date);
                        } else {
                            importCount++;
                        }
                    }
                } else if (!importedData.diaries) {
                    // 兼容旧格式：直接以日期为key的对象
                    for (const dateKey in importedData) {
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof importedData[dateKey] === 'object') {
                            if (existingDiaries[dateKey]) {
                                overwriteCount++;
                                conflicts.push(dateKey);
                            } else {
                                importCount++;
                            }
                        }
                    }
                }

                // 验证问卷数据
                if (Array.isArray(importedData.questionnaires)) {
                    for (const q of importedData.questionnaires) {
                        if (q && q.date && q.questionnaireId) {
                            questionnaireImportCount++;
                        }
                    }
                }

                // 4. 详细冲突处理提示
                let confirmMessage = `即将导入数据:\n\n`;
                if (importCount > 0) {
                    confirmMessage += `新增日记记录: ${importCount} 条\n`;
                }
                if (overwriteCount > 0) {
                    confirmMessage += `⚠️ 覆盖现有日记: ${overwriteCount} 条${conflicts.length > 0 ? ` (${conflicts.slice(0, 3).join(', ')}${conflicts.length > 3 ? '...' : ''})` : ''}\n`;
                }
                if (questionnaireImportCount > 0) {
                    confirmMessage += `量表记录: ${questionnaireImportCount} 条\n`;
                }
                confirmMessage += `\n请选择继续或取消。`;

                if (!confirm(confirmMessage)) {
                    importFileElement.value = '';
                    return;
                }

                // 5. 执行导入
                let actualImported = 0;
                let actualOverwritten = 0;

                if (Array.isArray(importedData.diaries)) {
                    const res = diaryStore.fromJSON(importedData);
                    actualImported = res.imported;
                    actualOverwritten = res.overwritten;
                } else {
                    // 兼容旧格式
                    for (const dateKey in importedData) {
                        if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof importedData[dateKey] === 'object') {
                            if (existingDiaries[dateKey]) {
                                actualOverwritten++;
                            } else {
                                actualImported++;
                            }
                            saveDiaryToLocalStorage(dateKey, importedData[dateKey]);
                        }
                    }
                }

                let actualQImported = 0;
                if (Array.isArray(importedData.questionnaires)) {
                    for (const q of importedData.questionnaires) {
                        if (q && q.date && q.questionnaireId) {
                            questionnaireStore.upsertFromImport(q);
                            actualQImported++;
                        }
                    }
                }

                alert(`数据导入完成！\n\n新增: ${actualImported} 条\n覆盖: ${actualOverwritten} 条\n量表: ${actualQImported} 条`);

                // 6. 刷新界面
                renderHistoryList();
                loadDiaryForDate(datePicker.value);
                renderQuestionnaireHistory();

            } catch (error) {
                console.error('导入失败:', error);
                alert(`导入失败：${error.message || '文件格式无效或已损坏。'}`);
            } finally {
                importFileElement.value = ''; // 清空文件选择
            }
        };
        reader.readAsText(file);
    }


    // --- localStorage 辅助函数 ---

    // 从 localStorage 获取所有日记条目，并返回一个数组
    function getAllDiariesFromLocalStorage() {
        return diaryStore.getMap();
    }

    // (如果这些函数已存在，请检查它们是否按如下方式工作)
    // (如果不存在，您需要添加它们)
    
    const STORAGE_KEY = 'sleepDiaryEntries';
    function getAllDiariesFromLocalStorage() {
        return diaryStore.getMap();
    }

    function getDiaryFromLocalStorage(dateString) {
        const allDiaries = getAllDiariesFromLocalStorage();
        return allDiaries[dateString] || null;
    }

    function saveDiaryToLocalStorage(dateString, diaryEntry) {
        // 使用已经标准化和计算好的数据，避免重复计算
        const normalized = diaryEntry.normalized || normalizeEntry({
            date: diaryEntry.date,
            bedTime: diaryEntry.bedTime,
            sleepLatency: diaryEntry.sleepLatency,
            awakeningsCount: diaryEntry.awakeningsCount,
            awakeningsDuration: diaryEntry.awakeningsDuration,
            wakeUpTime: diaryEntry.wakeUpTime,
            outOfBedTime: diaryEntry.outOfBedTime,
            notes: diaryEntry.notes,
            factors: diaryEntry.factors,
            sleepQuality: diaryEntry.sleepQuality,
            daytimeAlertness: diaryEntry.daytimeAlertness
        });

        // 如果已有 metrics 且包含数值型 TST/SE，直接使用；否则重新计算
        let tstHours, sePct, tstText, seText;
        if (diaryEntry.metrics && typeof diaryEntry.metrics.TST === 'number' && typeof diaryEntry.metrics.SE === 'number') {
            tstHours = diaryEntry.metrics.TST;
            sePct = diaryEntry.metrics.SE;
            tstText = diaryEntry.metrics.tst_display || '-';
            seText = diaryEntry.metrics.se_display || '-';
        } else {
            const m = calculateMetrics(normalized);
            tstHours = typeof m.tstMinutes === 'number' ? parseFloat((m.tstMinutes / 60).toFixed(2)) : 0;
            sePct = typeof m.sePercent === 'number' ? parseFloat(m.sePercent.toFixed(1)) : 0;
            tstText = typeof m.tstMinutes === 'number' ? `${Math.floor(m.tstMinutes / 60)}小时 ${m.tstMinutes % 60}分钟` : '-';
            seText = typeof m.sePercent === 'number' ? `${sePct.toFixed(1)} %` : '-';
        }

        const stored = {
            ...diaryEntry,
            normalized,
            metrics: {
                ...diaryEntry.metrics,
                TST: tstHours,
                SE: sePct,
                tst_display: tstText,
                se_display: seText,
                waso: diaryEntry.metrics?.waso || (typeof normalized.wasoMinutes === 'number' ? `${normalized.wasoMinutes} 分钟` : '-'),
                timeAwakeInBed: diaryEntry.metrics?.timeAwakeInBed || (typeof normalized.awakeInBedMinutes === 'number' ? `${normalized.awakeInBedMinutes} 分钟` : '-')
            },
            version: DATA_VERSION
        };
        diaryStore.set(dateString, stored);
    }

    // 从 localStorage 删除指定日期的日记
    function deleteDiaryFromLocalStorage(dateString) {
        diaryStore.remove(dateString);
    }


    // --- 应用程序常量 ---
    //const STORAGE_KEY = 'sleepDiaryEntries'; // 请确保这个值是您期望的存储键名

    // --- DOM 元素获取 ---
    initializeApp();

}); // DOMContentLoaded 结束

let sleepChartInstance = null; // 用于存储Chart.js图表实例
let weeklyChartInstance = null;
let currentWeekOffset = 0;
const PSQI_FREQ_OPTIONS = [
    { label: '0 - 无', value: 0 },
    { label: '1 - 每周<1次', value: 1 },
    { label: '2 - 每周1-2次', value: 2 },
    { label: '3 - 每周≥3次', value: 3 },
];

const PSQI_QUALITY_OPTIONS = [
    { label: '0 - 很好', value: 0 },
    { label: '1 - 较好', value: 1 },
    { label: '2 - 较差', value: 2 },
    { label: '3 - 很差', value: 3 },
];

const PSQI_DAYTIME_ENERGY_OPTIONS = [
    { label: '0 - 没有', value: 0 },
    { label: '1 - 偶尔有', value: 1 },
    { label: '2 - 有时有', value: 2 },
    { label: '3 - 经常有', value: 3 },
];

const isiOptionSet = [
    { label: '0 - 无', value: 0 },
    { label: '1 - 轻度', value: 1 },
    { label: '2 - 中度', value: 2 },
    { label: '3 - 重度', value: 3 },
    { label: '4 - 极重度', value: 4 },
];

const questionnaires = {
    psqi: {
        id: 'psqi',
        title: '匹兹堡睡眠质量指数 (PSQI)',
        questions: [
            { key: 'q1_bedtime', text: '1. 近1个月，晚上上床睡觉通常是几点？', type: 'time' },
            { key: 'q2_latency_minutes', text: '2. 近1个月，从上床到入睡通常需要多少分钟？', type: 'number', min: 0, step: 5, placeholder: '分钟' },
            { key: 'q3_wakeup_time', text: '3. 近1个月，通常早上几点起床？', type: 'time' },
            { key: 'q4_sleep_hours', text: '4. 近1个月，每夜通常实际睡眠多少小时？', type: 'number', min: 0, step: 0.5, placeholder: '小时' },
            { key: 'q5a_insomnia_onset', text: '5a. 入睡困难（30分钟内不能入睡）', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5b_midawake', text: '5b. 夜间易醒或早醒', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5c_toilet', text: '5c. 夜间去厕所', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5d_breath', text: '5d. 呼吸不畅', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5e_snore', text: '5e. 咳嗽或鼾声大', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5f_cold', text: '5f. 感觉冷', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5g_hot', text: '5g. 感觉热', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5h_nightmare', text: '5h. 做恶梦', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5i_pain', text: '5i. 疼痛不适', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5j_other', text: '5j. 其他影响睡眠的事情', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q5j_other_detail', text: '如有其他影响睡眠的情况，请描述', type: 'text', placeholder: '可选' },
            { key: 'q6_sleep_quality', text: '6. 总的来说，您认为自己的睡眠质量', type: 'select', options: PSQI_QUALITY_OPTIONS },
            { key: 'q7_medication_freq', text: '7. 近1个月，您用药物催眠的情况', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q8_daytime_sleepy', text: '8. 近1个月，您常感到困倦吗', type: 'select', options: PSQI_FREQ_OPTIONS },
            { key: 'q9_energy', text: '9. 近1个月，您做事情的精力不足吗', type: 'select', options: PSQI_DAYTIME_ENERGY_OPTIONS },
        ],
        scoringFn: function(ans) {
            const recodeLatency = (mins) => {
                if (mins == null) return null;
                if (mins <= 15) return 0;
                if (mins <= 30) return 1;
                if (mins <= 60) return 2;
                return 3;
            };
            const recodeDuration = (hours) => {
                if (hours == null) return null;
                if (hours > 7) return 0;
                if (hours >= 6) return 1;
                if (hours >= 5) return 2;
                return 3;
            };
            const recodeSE = (percent) => {
                if (percent == null) return null;
                if (percent >= 85) return 0;
                if (percent >= 75) return 1;
                if (percent >= 65) return 2;
                return 3;
            };
            const recodeDisturbance = (sum) => {
                if (sum == null) return null;
                if (sum === 0) return 0;
                if (sum <= 9) return 1;
                if (sum <= 18) return 2;
                return 3;
            };

            const latencyMinutes = typeof ans.q2_latency_minutes === 'number' ? ans.q2_latency_minutes : null;
            const sleepDurationMinutes = typeof ans.q4_sleep_hours === 'number' ? ans.q4_sleep_hours * 60 : null;
            const bedtimeMinutes = parseTimeToMinutes(ans.q1_bedtime);
            const wakeMinutes = parseTimeToMinutes(ans.q3_wakeup_time);
            let tib = null;
            if (bedtimeMinutes !== null && wakeMinutes !== null) {
                tib = wakeMinutes >= bedtimeMinutes ? (wakeMinutes - bedtimeMinutes) : ((24 * 60 - bedtimeMinutes) + wakeMinutes);
            }
            let sleepEfficiency = null;
            if (sleepDurationMinutes !== null && tib !== null && tib > 0) {
                sleepEfficiency = (sleepDurationMinutes / tib) * 100;
            }

            const components = {
                subjectiveQuality: typeof ans.q6_sleep_quality === 'number' ? ans.q6_sleep_quality : null,
                sleepLatency: null,
                sleepDuration: recodeDuration(typeof ans.q4_sleep_hours === 'number' ? ans.q4_sleep_hours : null),
                sleepEfficiency: recodeSE(sleepEfficiency),
                sleepDisturbance: null,
                medicationUse: typeof ans.q7_medication_freq === 'number' ? ans.q7_medication_freq : null,
                daytimeDysfunction: null,
            };

            const latencyRecode = recodeLatency(latencyMinutes);
            const latencyFreq = typeof ans.q5a_insomnia_onset === 'number' ? ans.q5a_insomnia_onset : null;
            if (latencyRecode !== null && latencyFreq !== null) {
                const sum = latencyRecode + latencyFreq;
                if (sum === 0) components.sleepLatency = 0;
                else if (sum <= 2) components.sleepLatency = 1;
                else if (sum <= 4) components.sleepLatency = 2;
                else components.sleepLatency = 3;
            }

            const disturbanceKeys = [
                'q5b_midawake',
                'q5c_toilet',
                'q5d_breath',
                'q5e_snore',
                'q5f_cold',
                'q5g_hot',
                'q5h_nightmare',
                'q5i_pain',
                'q5j_other',
            ];
            if (disturbanceKeys.every(key => typeof ans[key] === 'number')) {
                const sum = disturbanceKeys.reduce((acc, key) => acc + ans[key], 0);
                components.sleepDisturbance = recodeDisturbance(sum);
            }

            const daytimeFreq = typeof ans.q8_daytime_sleepy === 'number' ? ans.q8_daytime_sleepy : null;
            const energyFreq = typeof ans.q9_energy === 'number' ? ans.q9_energy : null;
            if (daytimeFreq !== null && energyFreq !== null) {
                const sum = daytimeFreq + energyFreq;
                if (sum === 0) components.daytimeDysfunction = 0;
                else if (sum <= 2) components.daytimeDysfunction = 1;
                else if (sum <= 4) components.daytimeDysfunction = 2;
                else components.daytimeDysfunction = 3;
            }

            const componentValues = Object.values(components);
            if (componentValues.some(value => value === null)) {
                return { score: null, severity: null, components };
            }

            const total = componentValues.reduce((acc, value) => acc + value, 0);
            let severity;
            if (total <= 5) severity = '正常';
            else if (total <= 10) severity = '轻度问题';
            else if (total <= 15) severity = '中度问题';
            else severity = '重度问题';

            return {
                score: total,
                severity,
                components,
                derived: {
                    sleepEfficiency: sleepEfficiency != null ? parseFloat(sleepEfficiency.toFixed(1)) : null,
                    timeInBedMinutes: tib,
                    sleepDurationMinutes,
                },
            };
        },
    },
    isi: {
        id: 'isi',
        title: '失眠严重程度指数量表 (ISI)',
        questions: [
            { key: 'q1', text: '1. 入睡困难', type: 'select', options: isiOptionSet },
            { key: 'q2', text: '2. 睡眠维持困难', type: 'select', options: isiOptionSet },
            { key: 'q3', text: '3. 早醒问题', type: 'select', options: isiOptionSet },
            {
                key: 'q4',
                text: '4. 您认为失眠在多大程度上影响了您的日常功能？',
                type: 'select',
                options: isiOptionSet,
            },
            {
                key: 'q5',
                text: '5. 您的失眠问题对生活质量的影响（别人眼中的表现）',
                type: 'select',
                options: isiOptionSet,
            },
            {
                key: 'q6',
                text: '6. 您对目前睡眠问题的担心/痛苦程度',
                type: 'select',
                options: isiOptionSet,
            },
            {
                key: 'q7',
                text: '7. 您对目前睡眠模式的满意度',
                type: 'select',
                options: [
                    { label: '0 - 非常满意', value: 0 },
                    { label: '1 - 满意', value: 1 },
                    { label: '2 - 不太满意', value: 2 },
                    { label: '3 - 不满意', value: 3 },
                    { label: '4 - 非常不满意', value: 4 },
                ],
            },
        ],
        scoringFn: function(ans) {
            const keys = ['q1', 'q2', 'q3', 'q4', 'q5', 'q6', 'q7'];
            if (keys.some(key => typeof ans[key] !== 'number')) {
                return { score: null, severity: null };
            }
            const total = keys.reduce((sum, key) => sum + ans[key], 0);
            let severity;
            if (total <= 7) severity = '正常';
            else if (total <= 14) severity = '阈下失眠';
            else if (total <= 21) severity = '中度失眠';
            else severity = '重度失眠';
            return {
                score: total,
                severity,
                components: keys.reduce((acc, key) => {
                    acc[key] = ans[key];
                    return acc;
                }, {})
            };
        }
    }
};

/**
 * 准备数据并渲染睡眠数据图表
 * @param {Object<string, Object>} diaryEntries
 */
function renderSleepChart(diaryEntries) {
    console.log('开始渲染睡眠图表...');
    const chartCanvas = document.getElementById('sleepDataChart');
    const noDataMessage = document.getElementById('chartNoDataMessage');

    if (!chartCanvas) {
        console.error('图表 Canvas 元素未找到');
        if (noDataMessage) noDataMessage.textContent = '图表容器丢失';
        return;
    }

    chartCanvas.style.display = 'block';

    if (sleepChartInstance) {
        sleepChartInstance.destroy();
        sleepChartInstance = null;
    }

    const entriesArray = Object.values(diaryEntries || {});
    console.log(`处理图表数据：找到 ${entriesArray.length} 条记录`);

    const sortedEntries = entriesArray
        .filter(entry => entry && entry.date)
        .sort((a, b) => new Date(a.date) - new Date(b.date));

    const labels = sortedEntries.map(entry => entry.date.substring(5));
    const TST_BASELINE = 4.5;
    const SE_BASELINE = 85;
    const tstData = sortedEntries.map(entry => (entry.metrics && typeof entry.metrics.TST === 'number') ? entry.metrics.TST : 0);
    const seData = sortedEntries.map(entry => (entry.metrics && typeof entry.metrics.SE === 'number') ? entry.metrics.SE : 0);
    const tstTransformed = tstData.map(value => value - TST_BASELINE);
    const seTransformed = seData.map(value => value - SE_BASELINE);

    if (labels.length === 0) {
        chartCanvas.style.display = 'none';
        if (noDataMessage) {
            noDataMessage.style.display = 'block';
            noDataMessage.textContent = '暂无足够数据进行可视化';
        }
        return;
    } else if (noDataMessage) {
        noDataMessage.style.display = 'none';
    }

    const chartConfig = {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: '睡眠总时长',
                    data: tstTransformed,
                    backgroundColor: 'rgba(75, 192, 192, 0.5)',
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    yAxisID: 'y-tst',
                },
                {
                    label: '睡眠效率',
                    data: seTransformed,
                    type: 'line',
                    borderColor: 'rgba(153, 102, 255, 1)',
                    backgroundColor: 'rgba(153, 102, 255, 0.15)',
                    tension: 0.1,
                    yAxisID: 'y-se',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                title: {
                    display: true,
                    text: '睡眠数据趋势（基准：4.5 小时 / 85%）'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const datasetLabel = context.dataset.label || '';
                            if (context.datasetIndex === 0) {
                                const raw = context.raw + TST_BASELINE;
                                return `${datasetLabel}: ${raw.toFixed(1)} 小时（相对基准 ${context.raw.toFixed(1)}）`;
                            }
                            const raw = context.raw + SE_BASELINE;
                            return `${datasetLabel}: ${raw.toFixed(0)}%（相对基准 ${context.raw.toFixed(0)}%）`;
                        }
                    }
                },
                legend: {
                    display: true,
                    position: 'top'
                }
            },
            scales: {
                x: { title: { display: true, text: '日期' } },
                'y-tst': {
                    type: 'linear',
                    position: 'left',
                    title: { display: true, text: '睡眠总时长（小时）' },
                    ticks: { callback: value => (value + TST_BASELINE).toFixed(1) },
                    grid: {
                        color: context => context.tick.value === 0 ? 'rgba(75, 192, 192, 0.5)' : 'rgba(0, 0, 0, 0.1)',
                        lineWidth: context => context.tick.value === 0 ? 2 : 1
                    }
                },
                'y-se': {
                    type: 'linear',
                    position: 'right',
                    title: { display: true, text: '睡眠效率（%）' },
                    ticks: { callback: value => (value + SE_BASELINE).toFixed(0) },
                    grid: {
                        color: context => context.tick.value === 0 ? 'rgba(255, 99, 132, 0.4)' : 'rgba(0, 0, 0, 0.1)',
                        lineWidth: context => context.tick.value === 0 ? 2 : 1
                    }
                }
            }
        }
    };

    const ctx = chartCanvas.getContext('2d');
    sleepChartInstance = new Chart(ctx, chartConfig);
}


function getWeekRange(offset) {
    const end = new Date();
    end.setDate(end.getDate() + offset * 7);
    end.setHours(0,0,0,0);
    const start = new Date(end);
    start.setDate(end.getDate() - 6);
    const fmt = d => {
        const y = d.getFullYear();
        const m = String(d.getMonth()+1).padStart(2,'0');
        const day = String(d.getDate()).padStart(2,'0');
        return `${y}-${m}-${day}`;
    };
    return { start, end, startStr: fmt(start), endStr: fmt(end) };
}

function renderWeeklySummary() {
    const map = diaryStore.getMap();
    const range = WeeklyRenderer.getWeekRange(currentWeekOffset);
    const chartData = WeeklyRenderer.prepareWeeklyChartData(map, currentWeekOffset);
    const anomalyList = WeeklyRenderer.detectAnomalies(Object.values(map));
    const weekAnomalies = [];

    let sumTstMin = 0, cntTst = 0, sumSe = 0, cntSe = 0, sumSleepStartMin = 0, cntSleepStart = 0, sumWakeMin = 0, cntWake = 0, sumQuality = 0, cntQuality = 0;

    for (let i = 0; i < 7; i++) {
        const d = new Date(range.start);
        d.setDate(range.start.getDate() + i);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const key = `${y}-${m}-${day}`;
        const e = map[key];

        const tstH = chartData.tstHours[i];
        const seP = chartData.sePercents[i];

        if (typeof tstH === 'number' && tstH > 0) { sumTstMin += tstH * 60; cntTst++; }
        if (typeof seP === 'number' && seP > 0) {
            sumSe += seP; cntSe++;
            if (seP < 85) weekAnomalies.push(`${key} SE ${seP}%`);
        }

        if (e) {
            const norm2 = e.normalized ? e.normalized : normalizeEntry(e);
            const m2 = calculateMetrics(norm2);
            if (m2.sleepStartTime) {
                const [hh, mm] = m2.sleepStartTime.split(':').map(Number);
                sumSleepStartMin += hh * 60 + mm; cntSleepStart++;
            }
            if (norm2.wakeTime) {
                const wm = parseTimeToMinutes(norm2.wakeTime);
                if (wm !== null) { sumWakeMin += wm; cntWake++; }
            }
            if (norm2.sleepQuality) {
                const q = parseInt(norm2.sleepQuality, 10);
                if (!Number.isNaN(q)) { sumQuality += q; cntQuality++; }
            }
        }
    }

    const avgTstText = cntTst ? `${Math.floor((sumTstMin / cntTst) / 60)}小时 ${Math.round((sumTstMin / cntTst) % 60)}分钟` : '-';
    const avgSeText = cntSe ? `${(sumSe / cntSe).toFixed(1)} %` : '-';
    const avgSleepStartText = cntSleepStart ? (() => { const avg = Math.round(sumSleepStartMin / cntSleepStart); const h = String(Math.floor(avg / 60)).padStart(2, '0'); const m = String(avg % 60).padStart(2, '0'); return `${h}:${m}`; })() : '-';
    const avgWakeText = cntWake ? (() => { const avg = Math.round(sumWakeMin / cntWake); const h = String(Math.floor(avg / 60)).padStart(2, '0'); const m = String(avg % 60).padStart(2, '0'); return `${h}:${m}`; })() : '-';
    const avgQualityText = cntQuality ? (sumQuality / cntQuality).toFixed(1) : '-';

    const elTst = document.getElementById('weeklyAvgTST');
    const elSe = document.getElementById('weeklyAvgSE');
    const elSs = document.getElementById('weeklyAvgSleepStart');
    const elWk = document.getElementById('weeklyAvgWake');
    const elQl = document.getElementById('weeklyAvgQuality');
    const elRange = document.getElementById('weeklyRangeLabel');
    const elNo = document.getElementById('weeklyNoDataMessage');
    const elCanvas = document.getElementById('weeklyChartCanvas');
    const elAn = document.getElementById('weeklyAnomaliesList');

    if (elTst) elTst.textContent = avgTstText;
    if (elSe) elSe.textContent = avgSeText;
    if (elSs) elSs.textContent = avgSleepStartText;
    if (elWk) elWk.textContent = avgWakeText;
    if (elQl) elQl.textContent = avgQualityText;
    if (elRange) elRange.textContent = `${range.startStr} ~ ${range.endStr}`;

    if (elAn) {
        elAn.innerHTML = '';
        if (weekAnomalies.length === 0) {
            const li = document.createElement('li');
            li.textContent = '无异常';
            elAn.appendChild(li);
        } else {
            weekAnomalies.forEach(a => { const li = document.createElement('li'); li.textContent = a; elAn.appendChild(li); });
        }
    }

    if (!elCanvas) return;
    const hasData = chartData.tstHours.some(v => v !== null && v !== undefined) || chartData.sePercents.some(v => v !== null && v !== undefined);
    if (!hasData) { if (elNo) elNo.style.display = 'block'; } else { if (elNo) elNo.style.display = 'none'; }

    if (weeklyChartInstance) { weeklyChartInstance.destroy(); weeklyChartInstance = null; }
    const ctx = elCanvas.getContext('2d');
    weeklyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: chartData.labels,
            datasets: [
                { label: 'TST(小时)', data: chartData.tstHours, backgroundColor: 'rgba(54,162,235,0.5)', borderColor: 'rgba(54,162,235,1)', yAxisID: 'y-tst' },
                { label: 'SE(%)', data: chartData.sePercents, type: 'line', borderColor: 'rgba(255,99,132,1)', backgroundColor: 'rgba(255,99,132,0.2)', tension: 0.1, yAxisID: 'y-se' }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'top' }
            },
            scales: {
                'y-tst': { position: 'left', title: { display: true, text: '小时' } },
                'y-se': { position: 'right', title: { display: true, text: '百分比' }, suggestedMin: 0, suggestedMax: 100 }
            }
        }
    });

    const label = document.getElementById('weeklyQuestionnaireSummary');
    if (label) {
        const latestPsqi = questionnaireStore.latestWithinRange('psqi', range.start, range.end);
        const latestIsi = questionnaireStore.latestWithinRange('isi', range.start, range.end);
        const parts = [];
        if (latestPsqi) parts.push(`本周 PSQI：${latestPsqi.score ?? '-'}（${latestPsqi.severity || '-'}）`);
        if (latestIsi) parts.push(`本周 ISI：${latestIsi.score ?? '-'}（${latestIsi.severity || '-'}）`);
        label.textContent = parts.length ? parts.join(' ｜ ') : '本周暂无量表数据';
    }
}

let currentQuestionnaireId = null;
let currentQuestionnaireEntryId = null;

function renderQuestionnaireForm(id, entry = null) {
    currentQuestionnaireId = id;
    currentQuestionnaireEntryId = entry?.id || null;
    const conf = QuestionnaireRenderer.getQuestionnaire(id);
    const container = document.getElementById('questionnaireFormContainer');
    if (!container || !conf) return;
    container.innerHTML = '';
    const answers = entry?.answers || {};
    conf.questions.forEach((q) => {
        const wrap = document.createElement('div');
        wrap.className = 'qn-item';
        const label = document.createElement('label');
        label.textContent = q.text;
        label.setAttribute('for', `qn_${q.key}`);
        wrap.appendChild(label);
        let input;
        if (q.type === 'select') {
            input = document.createElement('select');
            const placeholderOpt = document.createElement('option');
            placeholderOpt.value = '';
            placeholderOpt.textContent = '-- 请选择 --';
            input.appendChild(placeholderOpt);
            q.options.forEach((opt) => {
                const optionEl = document.createElement('option');
                optionEl.value = String(opt.value);
                optionEl.textContent = opt.label;
                input.appendChild(optionEl);
            });
            const val = answers[q.key];
            if (val !== undefined && val !== null) {
                input.value = String(val);
            }
        } else {
            input = document.createElement('input');
            if (q.type === 'number') {
                input.type = 'number';
                if (typeof q.min === 'number') input.min = String(q.min);
                if (typeof q.max === 'number') input.max = String(q.max);
                if (typeof q.step === 'number') input.step = String(q.step);
            } else if (q.type === 'time') {
                input.type = 'time';
            } else {
                input.type = 'text';
            }
            if (q.placeholder) input.placeholder = q.placeholder;
            const val = answers[q.key];
            if (val !== undefined && val !== null) {
                input.value = q.type === 'number' ? String(val) : val;
            }
        }
        input.id = `qn_${q.key}`;
        wrap.appendChild(input);
        container.appendChild(wrap);
    });
    const res = document.getElementById('questionnaireResult');
    if (res) {
        if (entry) {
            const resultParts = [`得分：${entry.score ?? '-'}（${entry.severity ?? '-'}）`];
            if (entry.derived?.sleepEfficiency != null) {
                resultParts.push(`睡眠效率：${entry.derived.sleepEfficiency.toFixed(1)}%`);
            }
            res.textContent = resultParts.join(' | ');
        } else {
            res.textContent = '';
        }
    }
    const saveBtn = document.getElementById('saveQuestionnaireBtn');
    if (saveBtn) saveBtn.textContent = entry ? '更新测评' : '保存测评';
    const deleteBtn = document.getElementById('deleteQuestionnaireBtn');
    if (deleteBtn) {
        deleteBtn.disabled = !entry;
        deleteBtn.title = entry ? '' : '请选择历史记录后删除';
    }
    renderQuestionnaireHistory();
}

function collectQuestionnaireAnswers() {
    const id = currentQuestionnaireId;
    if (!id) return null;
    const conf = questionnaires[id];
    if (!conf) return null;
    const ans = {};
    conf.questions.forEach((q) => {
        const el = document.getElementById(`qn_${q.key}`);
        if (!el) return;
        if (q.type === 'select') {
            const value = el.value;
            if (value === '') {
                ans[q.key] = null;
            } else {
                const parsed = Number(value);
                ans[q.key] = Number.isNaN(parsed) ? null : parsed;
            }
        } else if (q.type === 'number') {
            ans[q.key] = el.value === '' ? null : parseFloat(el.value);
        } else if (q.type === 'time') {
            ans[q.key] = el.value || '';
        } else {
            ans[q.key] = el.value || '';
        }
    });
    return ans;
}

function saveCurrentQuestionnaire() {
    const id = currentQuestionnaireId;
    if (!id) {
        alert('请先选择要填写的量表。');
        return;
    }
    const conf = QuestionnaireRenderer.getQuestionnaire(id);
    if (!conf) return;
    const ans = collectQuestionnaireAnswers();
    if (!ans) return;
    const date = document.getElementById('datePicker')?.value || new Date().toISOString().split('T')[0];
    const scoring = QuestionnaireRenderer.calculateScore(id, ans);
    if (scoring.score === null) {
        alert('请完整填写量表的必填项。');
        return;
    }
    const nowIso = new Date().toISOString();
    const existing = currentQuestionnaireEntryId ? questionnaireStore.get(currentQuestionnaireEntryId) : null;
    const entry = {
        id: currentQuestionnaireEntryId || generateId(id),
        questionnaireId: id,
        date,
        answers: ans,
        score: scoring.score,
        severity: scoring.severity,
        components: scoring.components || null,
        derived: scoring.derived || null,
        createdAt: existing?.createdAt || nowIso,
        updatedAt: nowIso,
        version: QUESTIONNAIRE_DATA_VERSION
    };
    if (existing) {
        questionnaireStore.update(entry);
    } else {
        questionnaireStore.add(entry);
    }
    alert('测评已保存！');
    renderQuestionnaireForm(id, entry);
    renderQuestionnaireHistory();  // 添加：刷新历史列表
    renderWeeklySummary();
}

function deleteCurrentQuestionnaire() {
    if (!currentQuestionnaireEntryId) {
        alert('请选择要删除的测评记录（先点击历史记录中的查看）。');
        return;
    }
    const entry = questionnaireStore.get(currentQuestionnaireEntryId);
    if (!entry) {
        alert('未找到该测评记录。');
        return;
    }
    if (!confirm(`确定要删除 ${entry.date} 的 ${entry.questionnaireId.toUpperCase()} 测评吗？`)) {
        return;
    }
    questionnaireStore.remove(entry.id);
    currentQuestionnaireEntryId = null;
    alert('测评已删除。');
    renderQuestionnaireForm(entry.questionnaireId);
    renderQuestionnaireHistory();  // 添加：刷新历史列表
    renderWeeklySummary();
}

function loadQuestionnaireEntry(entryId) {
    const entry = questionnaireStore.get(entryId);
    if (!entry) {
        alert('未找到该测评记录。');
        return;
    }
    renderQuestionnaireForm(entry.questionnaireId, entry);
}

function handleQuestionnaireEntryDelete(entryId) {
    const entry = questionnaireStore.get(entryId);
    if (!entry) return;
    if (!confirm(`确定要删除 ${entry.date} 的 ${entry.questionnaireId.toUpperCase()} 测评吗？`)) {
        return;
    }
    questionnaireStore.remove(entryId);
    if (currentQuestionnaireEntryId === entryId) {
        currentQuestionnaireEntryId = null;
        renderQuestionnaireForm(entry.questionnaireId);
    }
    renderQuestionnaireHistory();
    renderWeeklySummary();
}

function renderQuestionnaireHistory() {
    const list = document.getElementById('questionnaireHistoryList');
    if (!list) return;
    const entries = questionnaireStore
        .getAll()
        .sort((a, b) => new Date(b.updatedAt || b.date) - new Date(a.updatedAt || a.date));
    list.innerHTML = '';
    if (entries.length === 0) {
        list.innerHTML = '<p>暂无测评记录</p>';
        return;
    }
    entries.slice(0, 20).forEach((entry) => {
        const item = document.createElement('div');
        item.className = 'qn-history-item';
        if (entry.id === currentQuestionnaireEntryId) {
            item.classList.add('active');
        }
        const info = document.createElement('div');
        info.className = 'qn-history-info';
        info.textContent = QuestionnaireRenderer.formatResult(entry);
        item.appendChild(info);
        if (entry.derived?.sleepEfficiency != null) {
            const meta = document.createElement('div');
            meta.className = 'qn-history-meta';
            meta.textContent = `睡眠效率：${entry.derived.sleepEfficiency.toFixed(1)}%`;
            item.appendChild(meta);
        }
        const actions = document.createElement('div');
        actions.className = 'qn-history-actions';
        const viewBtn = document.createElement('button');
        viewBtn.textContent = '查看';
        viewBtn.addEventListener('click', () => loadQuestionnaireEntry(entry.id));
        const deleteBtn = document.createElement('button');
        deleteBtn.textContent = '删除';
        deleteBtn.addEventListener('click', () => handleQuestionnaireEntryDelete(entry.id));
        actions.appendChild(viewBtn);
        actions.appendChild(deleteBtn);
        item.appendChild(actions);
        list.appendChild(item);
    });
}
// 假设这是您加载历史记录的函数
// 移除过时的演示代码，统一在应用内部流转
