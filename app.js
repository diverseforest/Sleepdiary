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

    // --- 初始化函数 ---
    function initializeApp() {
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
        importDataBtn.addEventListener('click', () => importFileElement.click()); // 点击按钮时触发隐藏的文件输入框
        importFileElement.addEventListener('change', importData);


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

    // 保存当前日记 (到 localStorage)
    function saveDiary() {
        const date = datePicker.value;
        if (!date) {
            alert('请先选择一个日期！');
            return;
        }
    
        // 在保存前确保最新的指标已计算并存入lastCalculated...变量
        calculateAndDisplayMetrics(); // 确保在保存前，所有指标都是基于当前表单的最新值计算的
    
        // 收集表单数据
        const diaryEntry = {
            date: date,
            bedTime: bedTimeInput.value,
            sleepLatency: sleepLatencyInput.value,
            awakeningsCount: awakeningsCountInput.value,
            awakeningsDuration: awakeningsDurationInput.value,
            wakeUpTime: wakeUpTimeInput.value,
            outOfBedTime: outOfBedTimeInput.value,
            factors: {},
            sleepQuality: sleepQualitySelect.value,
            daytimeAlertness: daytimeAlertnessSelect.value,
            notes: notesTextarea.value,
            // 存储指标
            metrics: { // 存储指标
                // 保留文本格式的指标用于可能的直接显示
                tib: metricTIBDisplay.textContent,
                sl: metricSLDisplay.textContent,
                actualSleepTime: metricActualSleepTimeDisplay.textContent,
                waso: metricWASODisplay.textContent,
                tst_display: metricTSTDisplay.textContent, // 文本版TST
                se_display: metricSEDisplay.textContent,   // 文本版SE
                timeAwakeInBed: metricTimeAwakeInBedDisplayOutput.textContent,

                // 新增：存储数值格式的指标用于图表
                TST: lastCalculatedTSTHours,          // 数值型睡眠总时长 (小时)
                SE: lastCalculatedSEPercentage      // 数值型睡眠效率 (%)
            }
        };

        for (const factor in factorCheckboxes) {
            if (factorCheckboxes[factor].checked) {
                diaryEntry.factors[factor] = {
                    checked: true,
                    detail: factorDetailInputs[factor].value
                };
            }
        }

        console.log(`准备保存日期 ${date} 的日记:`, diaryEntry);
        saveDiaryToLocalStorage(date, diaryEntry);
        alert('日记已保存！');
        renderHistoryList(); // 保存后刷新历史列表
        // 新增：保存后更新图表
        const allDiaries = getAllDiariesFromLocalStorage();
        renderSleepChart(allDiaries);

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

        sortedDates.forEach(date => {
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
                    alert(`日记 ${dateToDelete} 已删除。`);
                }
            });

            historyListDiv.appendChild(listItem);
        });
    }

    // 导出数据
    function exportData() {
        console.log('导出全部数据...');
        const allDiaries = getAllDiariesFromLocalStorage();
        if (Object.keys(allDiaries).length === 0) {
            alert('没有数据可以导出。');
            return;
        }

        const jsonData = JSON.stringify(allDiaries, null, 2); // null, 2 用于格式化JSON，使其更易读
        const blob = new Blob([jsonData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const timestamp = new Date().toISOString().replace(/[:.-]/g, '').slice(0, -4); // YYYYMMDDTHHMMSS
        a.download = `my_sleep_diary_export_${timestamp}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert('数据已导出！');
    }

    // 导入数据
    function importData(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                // TODO: 添加更详细的数据校验逻辑
                if (typeof importedData !== 'object' || importedData === null) {
                    throw new Error('文件内容不是有效的JSON对象。');
                }

                // 导入策略：询问用户是覆盖还是合并
                // 简单起见，我们先实现一个“智能合并/覆盖”：如果日期已存在，则用导入的数据覆盖
                let importCount = 0;
                let overwriteCount = 0;
                const existingDiaries = getAllDiariesFromLocalStorage();

                if (!confirm("您将导入睡眠日记数据。\n\n- 如果导入的记录与现有记录日期相同，现有记录将被覆盖。\n- 新日期的记录将被添加。\n\n是否继续导入？")) {
                    importFileElement.value = ''; // 清空文件选择，以便下次还能选择同一个文件
                    return;
                }

                for (const dateKey in importedData) {
                    // 简单校验日期格式 (YYYY-MM-DD) 和基本结构
                    if (/^\d{4}-\d{2}-\d{2}$/.test(dateKey) && typeof importedData[dateKey] === 'object') {
                        if (existingDiaries[dateKey]) {
                            overwriteCount++;
                        } else {
                            importCount++;
                        }
                        saveDiaryToLocalStorage(dateKey, importedData[dateKey]);
                    } else {
                        console.warn(`跳过无效的导入数据条目，键: ${dateKey}`);
                    }
                }

                alert(`数据导入完成！\n新增记录: ${importCount}条\n覆盖记录: ${overwriteCount}条`);
                renderHistoryList(); // 刷新历史列表
                // 导入后，可以尝试加载当天的日记（如果导入数据包含当天）
                loadDiaryForDate(datePicker.value);

            } catch (error) {
                console.error('导入失败:', error);
                alert('导入失败：文件格式无效或已损坏。');
            } finally {
                importFileElement.value = ''; // 清空文件选择，以便下次还能选择同一个文件
            }
        };
        reader.readAsText(file);
    }


    // --- localStorage 辅助函数 ---

    // 从 localStorage 获取所有日记条目，并返回一个数组
    function getAllDiariesFromLocalStorage() {
        const diariesObject = JSON.parse(localStorage.getItem('sleepDiaries')) || {};
        // 将以日期为键的对象转换为包含所有日记条目的数组
        return Object.values(diariesObject);
    }

    // (如果这些函数已存在，请检查它们是否按如下方式工作)
    // (如果不存在，您需要添加它们)
    
    const STORAGE_KEY = 'sleepDiaryEntries'; // 再次强调，确保这个KEY在全局定义且一致
    
    function getAllDiariesFromLocalStorage() {
        const diariesJSON = localStorage.getItem(STORAGE_KEY);
        if (!diariesJSON) {
            return {}; // 关键：如果没找到数据，返回空对象
        }
        try {
            const diaries = JSON.parse(diariesJSON);
            // 确保解析出来的是一个对象
            if (typeof diaries === 'object' && diaries !== null && !Array.isArray(diaries)) {
                return diaries;
            } else {
                // 如果解析出来不是预期的对象格式（例如，意外地存成了数组或null）
                console.warn('LocalStorage data is not a valid object, returning empty object.');
                return {};
            }
        } catch (e) {
            console.error("Error parsing diaries from localStorage:", e);
            return {}; // 解析出错也返回空对象，避免程序崩溃
        }
    }

    function getDiaryFromLocalStorage(dateString) {
        const allDiaries = getAllDiariesFromLocalStorage();
        return allDiaries[dateString] || null; // 返回特定日期的日记，或null
    }

    function saveDiaryToLocalStorage(dateString, diaryEntry) {
        console.log('[saveDiaryToLocalStorage] Date:', dateString, 'Entry:', diaryEntry); // 调试信息
        const allDiaries = getAllDiariesFromLocalStorage();
        console.log('[saveDiaryToLocalStorage] Diaries from localStorage before save:', JSON.parse(JSON.stringify(allDiaries))); // 调试信息 (深拷贝打印)
        allDiaries[dateString] = diaryEntry;
        console.log('[saveDiaryToLocalStorage] Diaries to be saved:', JSON.parse(JSON.stringify(allDiaries))); // 调试信息
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(allDiaries));
            console.log('[saveDiaryToLocalStorage] Save successful.'); // 调试信息
        } catch (e) {
            console.error("Error saving diary to localStorage:", e);
            alert('保存日记时出错，数据可能未能成功保存。请检查浏览器控制台获取更多信息。');
        }
    }

    // 从 localStorage 删除指定日期的日记
    function deleteDiaryFromLocalStorage(dateString) {
        const allDiaries = getAllDiariesFromLocalStorage();
        delete allDiaries[dateString];
        localStorage.setItem(STORAGE_KEY, JSON.stringify(allDiaries));
    }


    // --- 应用程序常量 ---
    //const STORAGE_KEY = 'sleepDiaryEntries'; // 请确保这个值是您期望的存储键名

    // --- DOM 元素获取 ---
    initializeApp();

}); // DOMContentLoaded 结束

let sleepChartInstance = null; // 用于存储Chart.js图表实例


/**
 * 准备数据并渲染睡眠数据图表
 * @param {Array<Object>} diaryEntries - 所有日记条目的数组
 */
function renderSleepChart(diaryEntries) { // diaryEntries 是一个以日期为键的日记对象
    console.log('开始渲染睡眠图表...');
    const chartCanvas = document.getElementById('sleepDataChart');
    const noDataMessage = document.getElementById('chartNoDataMessage');

    if (!chartCanvas) {
        console.error('图表 Canvas 元素未找到!');
        if (noDataMessage) noDataMessage.textContent = '图表容器丢失。';
        return;
    }
    
    // 确保Canvas元素可见
    chartCanvas.style.display = 'block';
    
    if (!noDataMessage) {
        console.error('图表无数据提示元素未找到!');
    }

    // 0. 检查并销毁已存在的图表实例，以便重新渲染
    if (sleepChartInstance) {
        sleepChartInstance.destroy();
        sleepChartInstance = null;
    }

    // 1. 数据处理和提取
    // 将日记对象的值（即每个日记条目）转换为数组
    const entriesArray = Object.values(diaryEntries); 
    console.log(`处理图表数据：找到 ${entriesArray.length} 条记录`);
    
    const sortedEntries = entriesArray
        .filter(entry => entry && entry.date) // 过滤掉无效的 entry 或没有日期的 entry
        .sort((a, b) => new Date(a.date) - new Date(b.date)); // 按日期对数组进行排序

    // 提取图表所需的标签（日期）、睡眠总时长(TST)和睡眠效率(SE)
    const labels = sortedEntries.map(entry => entry.date); // X轴：日期
    // entry.metrics.TST 应为数值 (小时), entry.metrics.SE 应为数值 (百分比)
    const tstData = sortedEntries.map(entry => (entry.metrics && typeof entry.metrics.TST === 'number') ? entry.metrics.TST : 0);
    const seData = sortedEntries.map(entry => (entry.metrics && typeof entry.metrics.SE === 'number') ? entry.metrics.SE : 0);

    // 2. 检查是否有足够的数据
    if (labels.length < 1) { // 如果没有有效数据点
        chartCanvas.style.display = 'none'; // 隐藏canvas
        if (noDataMessage) {
            noDataMessage.style.display = 'block'; // 显示无数据提示
            noDataMessage.textContent = '暂无足够数据进行可视化。'; // 确保消息正确
        }
        return;
    } else {
        chartCanvas.style.display = 'block'; // 显示canvas
        if (noDataMessage) noDataMessage.style.display = 'none'; // 隐藏无数据提示
    }

    // 3. Chart.js 配置对象
    const chartConfig = {
        type: 'bar', // 基础类型，但我们会混合使用
        data: {
            labels: labels, // X轴标签 (日期)
            datasets: [
                {
                    label: '睡眠总时长 (小时)', // 数据系列1的标签
                    data: tstData,           // 数据系列1的数据
                    type: 'bar',             // 此数据系列为柱状图
                    backgroundColor: 'rgba(54, 162, 235, 0.6)', // 柱状图填充颜色
                    borderColor: 'rgba(54, 162, 235, 1)',     // 柱状图边框颜色
                    borderWidth: 1,
                    yAxisID: 'yTST',         // 关联到左侧Y轴
                    order: 2 // 确保柱状图在折线图后面，避免遮挡
                },
                {
                    label: '睡眠效率 (%)',    // 数据系列2的标签
                    data: seData,            // 数据系列2的数据
                    type: 'line',            // 此数据系列为折线图
                    borderColor: 'rgba(255, 99, 132, 1)',    // 折线颜色
                    backgroundColor: 'rgba(255, 99, 132, 0.2)',// 折线下方填充颜色 (可选)
                    tension: 0.1,            // 折线平滑度 (0表示不平滑)
                    fill: false,             // 是否填充折线下方区域
                    yAxisID: 'ySE',          // 关联到右侧Y轴
                    order: 1 // 确保折线图在前面
                }
            ]
        },
        options: {
            responsive: true,       // 图表将响应容器大小变化
            maintainAspectRatio: false, // 允许图表高度独立于宽度变化
            interaction: {
                mode: 'index',
                intersect: false,
            },
            stacked: false,
            plugins: {
                title: {
                    display: true,
                    text: '睡眠总时长与睡眠效率趋势图'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y.toFixed(context.dataset.yAxisID === 'yTST' ? 2 : 1); // TST保留两位小数，SE保留一位
                                if (context.dataset.yAxisID === 'yTST') {
                                    label += ' 小时';
                                } else if (context.dataset.yAxisID === 'ySE') {
                                    label += ' %';
                                }
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '日期'
                    }
                },
                yTST: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: '睡眠总时长 (小时)'
                    },
                    beginAtZero: true,
                    // suggestedMax: 12, // 可根据常见睡眠时长调整
                    grid: {
                        drawOnChartArea: true,
                    }
                },
                ySE: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: '睡眠效率 (%)'
                    },
                    min: 0,
                    max: 100,
                    beginAtZero: true,
                    grid: {
                        drawOnChartArea: false, // 避免与左轴网格线重叠
                    }
                }
            }
        }
    };

    // 4. 创建新的Chart实例
    const ctx = chartCanvas.getContext('2d');
    sleepChartInstance = new Chart(ctx, chartConfig);
}

// 假设这是您加载历史记录的函数
function loadAndDisplayHistory() {
    const diaries = JSON.parse(localStorage.getItem('sleepDiaries')) || [];
    // ... (您现有加载和显示历史列表的代码) ...

    renderSleepChart(diaries); // <--- 新增：加载历史后渲染图表
}

// 假设这是您保存日记的事件监听器
document.getElementById('saveDiaryBtn').addEventListener('click', function() {
    // ... (您现有保存日记的逻辑) ...
    // 假设 newDiaryEntry 是新创建的日记对象，并且已添加到 diaries 数组并保存到 localStorage
    
    const allDiaries = JSON.parse(localStorage.getItem('sleepDiaries')) || []; // 重新获取所有数据
    renderSleepChart(allDiaries); // <--- 新增：保存后更新图表
});

// 假设这是您处理数据导入的逻辑
// (在导入成功并更新了 localStorage 之后)
// function handleImportSuccess() {
//     const allDiaries = JSON.parse(localStorage.getItem('sleepDiaries')) || [];
//     loadAndDisplayHistory(); // 这会刷新列表并调用 renderSleepChart
//     // 或者直接调用 renderSleepChart(allDiaries);
// }


// 页面加载时初始化
document.addEventListener('DOMContentLoaded', function() {
    // ... (您现有的DOMContentLoaded逻辑，例如加载历史日记) ...
    loadAndDisplayHistory(); // 这应该会调用 renderSleepChart
});