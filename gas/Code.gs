/**
 * Google Apps Script (GAS) 抽獎系統後端 Web App API
 * 
 * 功能：
 * 1. 提供 doGet API，讀取 Google Form 表單回應名單與獎品設定分頁。
 * 2. 資料清理與正規化（過濾空白列、修剪字串、型別轉換）。
 * 3. 輸出符合前端抽獎系統規範之 JSON 格式。
 */

// 設定預設工作表名稱
const CONFIG = {
  // 獎品分頁名稱候選清單
  PRIZE_SHEET_NAMES: ['獎品設定', '獎品清單', 'Prizes', 'Prize'],
  // 人員名冊分頁名稱候選清單（若未比對成功則預設使用第一個工作表）
  PARTICIPANT_SHEET_NAMES: ['表單回應 1', '表單回應', 'Form Responses 1', 'Form Responses', '參加名單', 'Participants']
};

/**
 * Web App GET 請求處理入口
 */
function doGet(e) {
  try {
    const data = getLotteryData();
    return createJsonResponse({
      status: 'success',
      timestamp: new Date().toISOString(),
      prizes: data.prizes,
      participants: data.participants
    });
  } catch (error) {
    return createJsonResponse({
      status: 'error',
      message: error.toString(),
      prizes: [],
      participants: []
    });
  }
}

/**
 * 建立標準 JSON HTTP 回應物件
 */
function createJsonResponse(data) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

/**
 * 取得試算表實例（支援作用中試算表或指定試算表 ID）
 */
function getTargetSpreadsheet() {
  try {
    return SpreadsheetApp.getActiveSpreadsheet();
  } catch (e) {
    // 若為獨立腳本，可透過 Script Properties 設定 SPREADSHEET_ID
    const propId = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
    if (propId) {
      return SpreadsheetApp.openById(propId);
    }
    throw new Error('無法取得 Google 試算表，請綁定於容器試算表或設定 SPREADSHEET_ID 屬性。');
  }
}

/**
 * 依候選名稱查找工作表，若未找到可指定是否 fallback 至預設
 */
function findSheet(ss, candidateNames, fallbackToIndex = -1) {
  const sheets = ss.getSheets();
  for (let i = 0; i < candidateNames.length; i++) {
    const sheet = ss.getSheetByName(candidateNames[i]);
    if (sheet) return sheet;
  }
  if (fallbackToIndex >= 0 && sheets.length > fallbackToIndex) {
    return sheets[fallbackToIndex];
  }
  return null;
}

/**
 * 讀取並標準化試算表資料
 */
function getLotteryData() {
  const ss = getTargetSpreadsheet();
  if (!ss) {
    throw new Error('未找到 Google 試算表。');
  }

  // 1. 讀取獎品分頁
  const prizeSheet = findSheet(ss, CONFIG.PRIZE_SHEET_NAMES);
  const rawPrizes = prizeSheet ? prizeSheet.getDataRange().getValues() : [];
  const prizes = parsePrizes(rawPrizes);

  // 2. 讀取人員分頁（若未找到指定名稱則預設取第一個分頁）
  const participantSheet = findSheet(ss, CONFIG.PARTICIPANT_SHEET_NAMES, 0);
  const rawParticipants = participantSheet ? participantSheet.getDataRange().getValues() : [];
  const participants = parseParticipants(rawParticipants);

  return {
    prizes: prizes,
    participants: participants
  };
}

/**
 * 解析並正規化獎品資料 (Output Data Format Normalization)
 */
function parsePrizes(rows) {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || '').trim());
  const nameIndex = findColumnIndex(headers, ['獎品名稱', '獎項名稱', '獎品', '名稱', 'Prize', 'Name']);
  const quotaIndex = findColumnIndex(headers, ['配額', '數量', '總數', '名額', 'Quota', 'Count', 'Quantity']);
  const orderIndex = findColumnIndex(headers, ['順序', '抽獎順序', 'Order', 'Sort']);
  const descIndex = findColumnIndex(headers, ['說明', '備註', 'Description', 'Desc']);

  const prizes = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;

    const name = nameIndex >= 0 ? String(row[nameIndex] || '').trim() : String(row[0] || '').trim();
    if (!name) continue;

    const rawQuota = quotaIndex >= 0 ? row[quotaIndex] : 1;
    const quota = Math.max(0, parseInt(rawQuota, 10) || 0);

    const rawOrder = orderIndex >= 0 ? row[orderIndex] : i;
    const order = parseInt(rawOrder, 10) || i;

    const description = descIndex >= 0 ? String(row[descIndex] || '').trim() : '';

    prizes.push({
      id: 'prize_' + i,
      name: name,
      quota: quota,
      order: order,
      description: description
    });
  }

  // 依抽獎順序排序
  prizes.sort((a, b) => a.order - b.order);
  return prizes;
}

/**
 * 解析並正規化抽獎人員資料 (支援大學生名冊：系所、年級、姓名)
 */
function parseParticipants(rows) {
  if (!rows || rows.length <= 1) return [];

  const headers = rows[0].map(h => String(h || '').trim());
  const nameIndex = findColumnIndex(headers, ['姓名', '學生姓名', '中文姓名', '名字', 'Name', 'Full Name']);
  const deptIndex = findColumnIndex(headers, ['系所', '科系', '學系', '系別', '院系', '部門', '組別', '單位', 'Department', 'Dept', 'Major']);
  const gradeIndex = findColumnIndex(headers, ['年級', '年級別', '年級(如大一/大二)', 'Grade', 'Year']);
  const idIndex = findColumnIndex(headers, ['學號', '學生證號', '員工編號', '工號', '編號', 'ID', 'Student ID', 'Employee ID']);
  const emailIndex = findColumnIndex(headers, ['電子郵件', '學校信箱', 'Email', '信箱']);

  const participants = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (isRowEmpty(row)) continue;

    const name = nameIndex >= 0 ? String(row[nameIndex] || '').trim() : String(row[1] || row[0] || '').trim();
    if (!name) continue;

    const department = deptIndex >= 0 ? String(row[deptIndex] || '').trim() : '';
    const grade = gradeIndex >= 0 ? String(row[gradeIndex] || '').trim() : '';
    const studentId = idIndex >= 0 ? String(row[idIndex] || '').trim() : ('s_' + i);
    const email = emailIndex >= 0 ? String(row[emailIndex] || '').trim() : '';

    participants.push({
      id: studentId || ('user_' + i),
      name: name,
      department: department,
      grade: grade,
      email: email
    });
  }

  return participants;
}

/**
 * 欄位標題比對輔助函式
 */
function findColumnIndex(headers, candidateKeys) {
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i].toLowerCase();
    for (let j = 0; j < candidateKeys.length; j++) {
      if (header === candidateKeys[j].toLowerCase()) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * 檢查列資料是否全為空
 */
function isRowEmpty(row) {
  if (!row || !Array.isArray(row)) return true;
  return row.every(cell => String(cell || '').trim() === '');
}

/**
 * 開發測試專用函式
 */
function testDoGet() {
  const result = getLotteryData();
  Logger.log('Prizes count: ' + result.prizes.length);
  Logger.log('Participants count: ' + result.participants.length);
  Logger.log(JSON.stringify(result, null, 2));
  return result;
}
