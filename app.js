/**
 * 活動幸運抽獎系統 (GitHub Pages 前端應用程式)
 * 
 * 核心功能：
 * 1. 介接 Google Apps Script (GAS) doGet API 獲取人員名單與獎品設定。
 * 2. 獎品切換與配額計算 (Prize Selection and Quota Display)。
 * 3. 前端真亂數抽獎與動畫舞台 (Random Participant Drawing)。
 * 4. 中獎紀錄分組展示、localStorage 狀態持久化與 CSV 匯出 (Winner Record Tracking and History)。
 */

(function () {
  'use strict';

  // 本地儲存鍵名常數
  const STORAGE_KEYS = {
    API_URL: 'lottery_gas_api_url',
    WINNERS: 'lottery_winners_history',
    DATA_CACHE: 'lottery_cached_data'
  };

  // 內建展示示範資料（大學校園活動抽獎示範）
  const DEMO_DATA = {
    prizes: [
      { id: 'demo_p1', name: '頭獎：Apple iPad Air (256GB)', quota: 1, order: 1, description: '特獎校園高效學習首選' },
      { id: 'demo_p2', name: '二獎：Sony 降噪藍牙耳機', quota: 2, order: 2, description: '專注讀書聽歌神器' },
      { id: 'demo_p3', name: '三獎：校園書局與百貨禮券 $2000', quota: 5, order: 3, description: '購書文具實用好禮' },
      { id: 'demo_p4', name: '幸運獎：星巴克飲品兌換券', quota: 10, order: 4, description: '期中期末暖心咖啡' }
    ],
    participants: [
      { id: 'B11902001', name: '陳冠宇', department: '資訊工程學系', grade: '大三', email: 'b11902001@school.edu.tw' },
      { id: 'B12703015', name: '林若晴', department: '財務金融學系', grade: '大二', email: 'b12703015@school.edu.tw' },
      { id: 'B10102033', name: '張凱翔', department: '外國語文學系', grade: '大四', email: 'b10102033@school.edu.tw' },
      { id: 'B13501008', name: '黃子庭', department: '生物機電學系', grade: '大一', email: 'b13501008@school.edu.tw' },
      { id: 'R12521019', name: '吳家瑋', department: '電機工程研究所', grade: '碩二', email: 'r12521019@school.edu.tw' },
      { id: 'B11201042', name: '許雅筑', department: '歷史學系', grade: '大三', email: 'b11201042@school.edu.tw' },
      { id: 'B12901024', name: '楊宗翰', department: '土木工程學系', grade: '大二', email: 'b12901024@school.edu.tw' },
      { id: 'B10302011', name: '蔡欣妤', department: '化學工程學系', grade: '大四', email: 'b10302011@school.edu.tw' },
      { id: 'B13105022', name: '劉宇恆', department: '中國文學系', grade: '大一', email: 'b13105022@school.edu.tw' },
      { id: 'B11602017', name: '周佩穎', department: '社會學系', grade: '大三', email: 'b11602017@school.edu.tw' },
      { id: 'B12304005', name: '鄭兆廷', department: '機械工程學系', grade: '大二', email: 'b12304005@school.edu.tw' },
      { id: 'B10902050', name: '謝宜萱', department: '醫學系', grade: '大四', email: 'b10902050@school.edu.tw' },
      { id: 'B13801016', name: '郭哲銘', department: '法律學系', grade: '大一', email: 'b13801016@school.edu.tw' },
      { id: 'R13622003', name: '曾詩婷', department: '經濟學研究所', grade: '碩一', email: 'r13622003@school.edu.tw' },
      { id: 'B11401039', name: '梁詠晴', department: '心理學系', grade: '大三', email: 'b11401039@school.edu.tw' }
    ]
  };

  // 應用程式狀態模型
  const state = {
    apiUrl: '',
    prizes: [],
    participants: [],
    currentPrizeId: null,
    winners: [], // 格式: [{ winnerId, name, department, prizeId, prizeName, timestamp }]
    isRolling: false,
    rollIntervalId: null
  };

  // DOM 元素快取
  let dom = {};

  /**
   * 初始化入口
   */
  function init() {
    cacheDomElements();
    bindEvents();
    loadPersistedState();

    if (state.prizes.length === 0) {
      // 若尚無資料，自動載入展示資料提供即時體驗
      loadData(DEMO_DATA);
    } else {
      updateUI();
    }
  }

  /**
   * 快取 DOM 元素
   */
  function cacheDomElements() {
    dom = {
      configPanel: document.getElementById('config-panel'),
      btnToggleConfig: document.getElementById('btn-toggle-config'),
      btnCloseConfig: document.getElementById('btn-close-config'),
      btnLoadDemo: document.getElementById('btn-load-demo'),
      gasApiUrl: document.getElementById('gas-api-url'),
      btnFetchData: document.getElementById('btn-fetch-data'),
      apiStatusMsg: document.getElementById('api-status-message'),

      prizeSelect: document.getElementById('prize-select'),
      statTotalQuota: document.getElementById('stat-total-quota'),
      statDrawnCount: document.getElementById('stat-drawn-count'),
      statRemainingQuota: document.getElementById('stat-remaining-quota'),
      prizeDesc: document.getElementById('prize-desc'),

      rollingDisplay: document.getElementById('rolling-display'),
      winnerCandidateName: domEl('.winner-candidate-name'),
      winnerCandidateMeta: domEl('.winner-candidate-meta'),
      stagePlaceholder: domEl('.stage-placeholder'),
      btnDraw: document.getElementById('btn-draw'),
      drawWarning: document.getElementById('draw-warning'),

      winnersListContainer: document.getElementById('winners-list-container'),
      btnExportCsv: document.getElementById('btn-export-csv'),
      btnResetLottery: document.getElementById('btn-reset-lottery')
    };
  }

  function domEl(selector) {
    return document.querySelector(selector);
  }

  /**
   * 綁定事件監聽
   */
  function bindEvents() {
    dom.btnToggleConfig.addEventListener('click', toggleConfigPanel);
    dom.btnCloseConfig.addEventListener('click', () => dom.configPanel.classList.add('hidden'));
    dom.btnLoadDemo.addEventListener('click', () => {
      loadData(DEMO_DATA);
      showStatusMessage('已載入展示示範資料！', 'success');
    });

    dom.btnFetchData.addEventListener('click', handleFetchApiData);
    dom.prizeSelect.addEventListener('change', handlePrizeChange);
    dom.btnDraw.addEventListener('click', handleStartDraw);
    dom.btnExportCsv.addEventListener('click', exportWinnersToCsv);
    dom.btnResetLottery.addEventListener('click', handleResetLottery);
  }

  /**
   * 從 LocalStorage 載入歷史紀錄
   */
  function loadPersistedState() {
    try {
      const savedUrl = localStorage.getItem(STORAGE_KEYS.API_URL);
      if (savedUrl) {
        state.apiUrl = savedUrl;
        dom.gasApiUrl.value = savedUrl;
      }

      const savedWinners = localStorage.getItem(STORAGE_KEYS.WINNERS);
      if (savedWinners) {
        state.winners = JSON.parse(savedWinners);
      }

      const cachedData = localStorage.getItem(STORAGE_KEYS.DATA_CACHE);
      if (cachedData) {
        const parsed = JSON.parse(cachedData);
        if (parsed.prizes && parsed.participants) {
          state.prizes = parsed.prizes;
          state.participants = parsed.participants;
          if (state.prizes.length > 0) {
            state.currentPrizeId = state.prizes[0].id;
          }
        }
      }
    } catch (e) {
      console.warn('載入 LocalStorage 失敗:', e);
    }
  }

  /**
   * 切換設定面板展開狀態
   */
  function toggleConfigPanel() {
    dom.configPanel.classList.toggle('hidden');
  }

  /**
   * 顯示 API 連線狀態訊息
   */
  function showStatusMessage(msg, type) {
    dom.apiStatusMsg.textContent = msg;
    dom.apiStatusMsg.className = 'status-message ' + type;
  }

  /**
   * 呼叫 GAS Web App API 取得即時資料
   */
  async function handleFetchApiData() {
    const url = dom.gasApiUrl.value.trim();
    if (!url) {
      showStatusMessage('請輸入有效的 Google Apps Script 網址！', 'error');
      return;
    }

    showStatusMessage('正在自 Google 試算表同步資料中...', '');
    dom.btnFetchData.disabled = true;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('HTTP 錯誤，狀態代碼：' + response.status);
      }
      const json = await response.json();
      if (json.status !== 'success') {
        throw new Error(json.message || 'API 回傳錯誤');
      }

      state.apiUrl = url;
      localStorage.setItem(STORAGE_KEYS.API_URL, url);
      loadData(json);
      showStatusMessage(`連線成功！共載入 ${json.prizes.length} 項獎品與 ${json.participants.length} 位人員。`, 'success');
      dom.configPanel.classList.add('hidden');
    } catch (err) {
      showStatusMessage('連線失敗：' + err.message + ' (請確認 Web App 發布權限為 Anyone)', 'error');
    } finally {
      dom.btnFetchData.disabled = false;
    }
  }

  /**
   * 載入資料並更新狀態
   */
  function loadData(data) {
    state.prizes = data.prizes || [];
    state.participants = data.participants || [];

    // 快取資料至 LocalStorage
    try {
      localStorage.setItem(STORAGE_KEYS.DATA_CACHE, JSON.stringify({
        prizes: state.prizes,
        participants: state.participants
      }));
    } catch (e) {}

    // 初始化選定第一個獎品
    if (state.prizes.length > 0) {
      if (!state.currentPrizeId || !state.prizes.some(p => p.id === state.currentPrizeId)) {
        state.currentPrizeId = state.prizes[0].id;
      }
    } else {
      state.currentPrizeId = null;
    }

    updateUI();
  }

  /**
   * 切換獎品事件處理 (Prize Selection and Quota Display)
   */
  function handlePrizeChange(e) {
    state.currentPrizeId = e.target.value;
    updateStageAndStats();
  }

  /**
   * 獲取當前所選獎品物件
   */
  function getCurrentPrize() {
    return state.prizes.find(p => p.id === state.currentPrizeId) || null;
  }

  /**
   * 計算特定獎品之配額統計
   */
  function getPrizeQuotaStats(prizeId) {
    const prize = state.prizes.find(p => p.id === prizeId);
    if (!prize) return { total: 0, drawn: 0, remaining: 0 };

    const drawnCount = state.winners.filter(w => w.prizeId === prizeId).length;
    const remaining = Math.max(0, prize.quota - drawnCount);
    return {
      total: prize.quota,
      drawn: drawnCount,
      remaining: remaining
    };
  }

  /**
   * 取得尚未中獎之合格抽獎人員池
   */
  function getEligibleParticipants() {
    const wonUserIds = new Set(state.winners.map(w => w.winnerId));
    return state.participants.filter(p => !wonUserIds.has(p.id));
  }

  /**
   * 完整更新頁面 UI
   */
  function updateUI() {
    renderPrizeOptions();
    updateStageAndStats();
    renderWinnersList();
  }

  /**
   * 渲染獎品下拉選單
   */
  function renderPrizeOptions() {
    dom.prizeSelect.innerHTML = '';
    if (state.prizes.length === 0) {
      dom.prizeSelect.innerHTML = '<option value="">(無可用獎品)</option>';
      return;
    }

    state.prizes.forEach(prize => {
      const stats = getPrizeQuotaStats(prize.id);
      const opt = document.createElement('option');
      opt.value = prize.id;
      opt.textContent = `${prize.name} (剩餘: ${stats.remaining}/${stats.total})`;
      if (prize.id === state.currentPrizeId) {
        opt.selected = true;
      }
      dom.prizeSelect.appendChild(opt);
    });
  }

  /**
   * 更新抽獎舞台與名額看版數據
   */
  function updateStageAndStats() {
    const currentPrize = getCurrentPrize();
    dom.drawWarning.textContent = '';

    if (!currentPrize) {
      dom.statTotalQuota.textContent = '0';
      dom.statDrawnCount.textContent = '0';
      dom.statRemainingQuota.textContent = '0';
      dom.prizeDesc.textContent = '';
      dom.btnDraw.disabled = true;
      return;
    }

    const stats = getPrizeQuotaStats(currentPrize.id);
    dom.statTotalQuota.textContent = stats.total;
    dom.statDrawnCount.textContent = stats.drawn;
    dom.statRemainingQuota.textContent = stats.remaining;
    dom.prizeDesc.textContent = currentPrize.description || '';

    const eligible = getEligibleParticipants();

    // 判斷按鈕是否可點擊
    if (state.isRolling) {
      dom.btnDraw.disabled = true;
      dom.btnDraw.textContent = '抽獎中...';
    } else if (stats.remaining <= 0) {
      dom.btnDraw.disabled = true;
      dom.btnDraw.textContent = '該獎項已抽完';
      dom.drawWarning.textContent = '🎉 此獎項配額已全數抽出完畢！';
    } else if (eligible.length === 0) {
      dom.btnDraw.disabled = true;
      dom.btnDraw.textContent = '無可用候選名單';
      dom.drawWarning.textContent = '⚠️ 所有人員皆已獲獎，名單已空。';
    } else {
      dom.btnDraw.disabled = false;
      dom.btnDraw.textContent = '開始抽獎';
    }
  }

  /**
   * 執行隨機開獎 (Random Participant Drawing)
   */
  function handleStartDraw() {
    const currentPrize = getCurrentPrize();
    if (!currentPrize || state.isRolling) return;

    const stats = getPrizeQuotaStats(currentPrize.id);
    if (stats.remaining <= 0) return;

    const eligible = getEligibleParticipants();
    if (eligible.length === 0) {
      dom.drawWarning.textContent = '⚠️ 尚無未獲獎之合格人員！';
      return;
    }

    state.isRolling = true;
    updateStageAndStats();

    // 啟動視覺滾動效果
    dom.rollingDisplay.classList.remove('winner-won');
    dom.rollingDisplay.classList.add('rolling');
    dom.stagePlaceholder.textContent = '正在抽取：' + currentPrize.name;

    const duration = 2500; // 滾動動畫持續 2.5 秒
    const startTime = Date.now();
    let speed = 50; // 毫秒切換頻率

    function rollTick() {
      const randomIndex = Math.floor(Math.random() * eligible.length);
      const tempPerson = eligible[randomIndex];
      dom.winnerCandidateName.textContent = tempPerson.name;
      const meta = [tempPerson.department, tempPerson.grade, tempPerson.id ? '#' + tempPerson.id : ''].filter(Boolean).join(' ');
      dom.winnerCandidateMeta.textContent = meta;

      const elapsed = Date.now() - startTime;
      if (elapsed < duration) {
        state.rollIntervalId = setTimeout(rollTick, speed);
      } else {
        // 定格真亂數中獎人
        finalizeWinner(currentPrize, eligible);
      }
    }

    rollTick();
  }

  /**
   * 定格決定最終中獎人 (使用加密等級或均勻隨機)
   */
  function finalizeWinner(prize, eligiblePool) {
    // 採用 crypto 均勻隨機抽取
    let finalIndex = 0;
    if (window.crypto && window.crypto.getRandomValues) {
      const randomBuffer = new Uint32Array(1);
      window.crypto.getRandomValues(randomBuffer);
      finalIndex = randomBuffer[0] % eligiblePool.length;
    } else {
      finalIndex = Math.floor(Math.random() * eligiblePool.length);
    }

    const winner = eligiblePool[finalIndex];

    // 更新舞台定格視覺
    dom.rollingDisplay.classList.remove('rolling');
    dom.rollingDisplay.classList.add('winner-won');
    dom.stagePlaceholder.textContent = '恭喜中獎！';
    dom.winnerCandidateName.textContent = winner.name;
    const winnerMeta = [winner.department, winner.grade, winner.id ? '#' + winner.id : ''].filter(Boolean).join(' ');
    dom.winnerCandidateMeta.textContent = winnerMeta;

    // 記錄中獎者
    const winnerRecord = {
      winnerId: winner.id,
      name: winner.name,
      department: winner.department || '',
      grade: winner.grade || '',
      email: winner.email || '',
      prizeId: prize.id,
      prizeName: prize.name,
      timestamp: new Date().toLocaleString('zh-TW', { hour12: false })
    };

    state.winners.push(winnerRecord);
    persistWinners();

    state.isRolling = false;
    renderPrizeOptions();
    updateStageAndStats();
    renderWinnersList();
  }

  /**
   * 保存中獎紀錄至 LocalStorage (Winner Record Tracking and History)
   */
  function persistWinners() {
    try {
      localStorage.setItem(STORAGE_KEYS.WINNERS, JSON.stringify(state.winners));
    } catch (e) {
      console.warn('儲存中獎紀錄至 LocalStorage 失敗:', e);
    }
  }

  /**
   * 渲染右側中獎分組名冊
   */
  function renderWinnersList() {
    dom.winnersListContainer.innerHTML = '';
    if (state.winners.length === 0) {
      dom.winnersListContainer.innerHTML = '<div class="empty-hint">尚無中獎紀錄</div>';
      return;
    }

    // 依獎品分組
    const grouped = {};
    state.winners.forEach(w => {
      if (!grouped[w.prizeId]) {
        grouped[w.prizeId] = {
          prizeName: w.prizeName,
          items: []
        };
      }
      grouped[w.prizeId].items.push(w);
    });

    Object.keys(grouped).forEach(prizeId => {
      const group = grouped[prizeId];
      const groupEl = document.createElement('div');
      groupEl.className = 'winner-prize-group';

      const titleEl = document.createElement('div');
      titleEl.className = 'group-title';
      titleEl.innerHTML = `<span>${group.prizeName}</span><span>(${group.items.length} 位)</span>`;
      groupEl.appendChild(titleEl);

      const listEl = document.createElement('div');
      listEl.className = 'winner-items-list';

      group.items.forEach(item => {
        const itemEl = document.createElement('div');
        itemEl.className = 'winner-item';
        const metaParts = [item.department, item.grade, item.winnerId ? '#' + item.winnerId : ''].filter(Boolean).join(' · ');
        itemEl.innerHTML = `
          <div>
            <div class="winner-item-name">${item.name}</div>
            <div class="winner-item-meta">${metaParts}</div>
          </div>
          <div class="winner-item-time">${item.timestamp}</div>
        `;
        listEl.appendChild(itemEl);
      });

      groupEl.appendChild(listEl);
      dom.winnersListContainer.appendChild(groupEl);
    });
  }

  /**
   * 匯出中獎名單為 CSV 檔案
   */
  function exportWinnersToCsv() {
    if (state.winners.length === 0) {
      alert('目前尚無任何中獎紀錄可供匯出！');
      return;
    }

    const headers = ['獎品名稱', '得獎學生姓名', '系所', '年級', '學號', '電子郵件', '中獎時間'];
    const rows = state.winners.map(w => [
      `"${(w.prizeName || '').replace(/"/g, '""')}"`,
      `"${(w.name || '').replace(/"/g, '""')}"`,
      `"${(w.department || '').replace(/"/g, '""')}"`,
      `"${(w.grade || '').replace(/"/g, '""')}"`,
      `"${(w.winnerId || '').replace(/"/g, '""')}"`,
      `"${(w.email || '').replace(/"/g, '""')}"`,
      `"${w.timestamp}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `中獎名冊_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * 重置抽獎紀錄
   */
  function handleResetLottery() {
    if (state.winners.length === 0) {
      alert('目前無中獎紀錄。');
      return;
    }

    const confirmed = confirm('確定要清除所有中獎紀錄嗎？此動作將重新計算所有獎項剩餘配額。');
    if (confirmed) {
      state.winners = [];
      localStorage.removeItem(STORAGE_KEYS.WINNERS);
      dom.winnerCandidateName.textContent = '---';
      dom.winnerCandidateMeta.textContent = '';
      dom.stagePlaceholder.textContent = '準備抽獎';
      dom.rollingDisplay.classList.remove('winner-won', 'rolling');

      renderPrizeOptions();
      updateStageAndStats();
      renderWinnersList();
      alert('已成功重置中獎紀錄！');
    }
  }

  // 暴露全域給測試或除錯
  window.__lotterySystem = {
    state,
    loadData,
    getPrizeQuotaStats,
    getEligibleParticipants,
    exportWinnersToCsv
  };

  // 網頁載入後啟動
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
