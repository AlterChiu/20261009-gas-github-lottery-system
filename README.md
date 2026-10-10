# 活動幸運抽獎系統 (Google Apps Script + GitHub Pages)

一套無伺服器負擔、開箱即用的現代化活動抽獎系統。後端透過 Google Form 表單收集大學生名冊（系所、年級、姓名）、以 Google Sheet 維護獎品清單與配額，並由 Google Apps Script (GAS) 發布唯讀 JSON API；前端採用原生 HTML5、CSS 與 JavaScript 實作，可直接免費託管於 GitHub Pages。

---

## ⚡ 快速設定與 API 介接指南 (Quick Setup & API Integration)

本系統支援「**本機展示模式 (Demo Mode)**」與「**正式 Google 試算表 API 連線**」兩種運行方式。

### 1. 實際介接 Google Apps Script API 設定方式

#### 介面操作設定（推薦，開箱即用）
1. 使用瀏覽器開啟 `index.html`（或您的 GitHub Pages 網址）。
2. 點擊右上角 **「⚙️ 設定 API」** 按鈕展開設定面板。
3. 在 **Google Apps Script Web App URL** 輸入框中貼上您部署好的 GAS Web App 網址：
   ```text
   https://script.google.com/macros/s/AKfycb.../exec
   ```
4. 點擊 **「連線載入資料」** 按鈕：
   - 系統將發起 HTTPS GET 請求，自動同步獎品配額與學生名冊。
   - 連線成功後，API 網址將自動儲存於瀏覽器 `localStorage`（Key: `lottery_gas_api_url`），後續重整或再次開啟網頁皆會自動套用，無需重複輸入。

#### 程式預設配置（可選）
若希望網頁初次開啟時即自動載入特定 API，亦可直接在瀏覽器開發者工具 (Console) 預先寫入：
```javascript
localStorage.setItem('lottery_gas_api_url', 'https://script.google.com/macros/s/YOUR_GAS_ID/exec');
```

> [!IMPORTANT]
> **GAS 發布權限關鍵注意事項**：
> 在 Google 試算表中發布 GAS 網路應用程式時，**「誰可以存取 (Who has access)」務必選擇「所有人 (Anyone)」**。若設定為「僅限自己」或「網域內」，瀏覽器跨網域（CORS）存取時會被導向 Google 登入頁面，導致前端無法成功解析 JSON 資料。

---

### 2. 資料結構範例 (app.js DEMO_DATA / API Schema)

系統內建於 `app.js` 的 `DEMO_DATA` 與後端 GAS API 回傳的標準 JSON 格式完全一致。您可依此格式直接擴充或進行離線測試：

#### 標準 JSON 資料範本
```json
{
  "status": "success",
  "prizes": [
    {
      "id": "demo_p1",
      "name": "頭獎：Apple iPad Air (256GB)",
      "quota": 1,
      "order": 1,
      "description": "特獎校園高效學習首選"
    },
    {
      "id": "demo_p2",
      "name": "二獎：Sony 降噪藍牙耳機",
      "quota": 2,
      "order": 2,
      "description": "專注讀書聽歌神器"
    },
    {
      "id": "demo_p3",
      "name": "三獎：校園書局與百貨禮券 $2000",
      "quota": 5,
      "order": 3,
      "description": "購書文具實用好禮"
    },
    {
      "id": "demo_p4",
      "name": "幸運獎：星巴克飲品兌換券",
      "quota": 10,
      "order": 4,
      "description": "期中期末暖心咖啡"
    }
  ],
  "participants": [
    {
      "id": "B11902001",
      "name": "陳冠宇",
      "department": "資訊工程學系",
      "grade": "大三",
      "email": "b11902001@school.edu.tw"
    },
    {
      "id": "B12703015",
      "name": "林若晴",
      "department": "財務金融學系",
      "grade": "大二",
      "email": "b12703015@school.edu.tw"
    },
    {
      "id": "B10102033",
      "name": "張凱翔",
      "department": "外國語文學系",
      "grade": "大四",
      "email": "b10102033@school.edu.tw"
    },
    {
      "id": "B13501008",
      "name": "黃子庭",
      "department": "生物機電學系",
      "grade": "大一",
      "email": "b13501008@school.edu.tw"
    },
    {
      "id": "R12521019",
      "name": "吳家瑋",
      "department": "電機工程研究所",
      "grade": "碩二",
      "email": "r12521019@school.edu.tw"
    }
  ]
}
```

#### 資料欄位說明規範

| 區塊 | 欄位名稱 | 型別 | 必填 | 說明與呈現位置 |
| :--- | :--- | :---: | :---: | :--- |
| **prizes** | `id` | String | 是 | 獎品唯一識別碼（如 `demo_p1` 或 `prize_1`） |
| | `name` | String | 是 | 獎品完整名稱（呈現於下拉選單、看版與中獎名冊） |
| | `quota` | Number | 是 | 獎品總配額名額數量（抽完時按鈕自動鎖定） |
| | `order` | Number | 否 | 排序優先序（數字越小越優先） |
| | `description` | String | 否 | 獎品備註說明（呈現於獎品看版下方） |
| **participants** | `name` | String | 是 | 學生真實姓名（抽獎舞台中央大字體呈現） |
| | `department` | String | 是 | 就讀學系/研究所（抽獎舞台與名冊次標題） |
| | `grade` | String | 是 | 年級別，如大一、大二、大三、大四、碩一、碩二 |
| | `id` | String | 否 | 學生學號或身分編號（以 `#學號` 格式標註防同名同姓） |
| | `email` | String | 否 | 學生聯絡信箱（匯出 CSV 時提供中獎名單核對） |

---

### 3. 一鍵體驗展示模式 (Demo Mode)

若尚未建立 Google 試算表或處於離線環境，可直接點擊首頁右上角 **「📊 載入展示資料」** 按鈕，系統會立即注入上述 `DEMO_DATA`，包含 4 項獎品與 15 位各系所學生名冊，方便快速測試開獎動畫、獎品切換與 CSV 匯出功能。

---

## 🌟 系統亮點

1. **零伺服器維護成本**：完全依託 Google Apps Script 與 GitHub Pages，不需購買主機或架設資料庫。
2. **表單即時同步**：人員填寫 Google Form 表單後，隨時點擊重新同步即可載入最新名單。
3. **獎品彈性切換**：下拉選單即時切換抽獎品項，動態呈現各獎項之總額、已抽出與剩餘名額。
4. **炫麗抽獎舞台**：高對比慶祝視覺、流暢隨機滾輪動畫，並確保不重複中獎。
5. **中獎名單防遺失**：中獎結果即時存入瀏覽器 `localStorage`，誤觸重新整理也不會遺失開獎進度。
6. **一鍵匯出 CSV**：活動結束後可一鍵下載含獎項、學生姓名、系所、年級、學號與中獎時間的名冊。
7. **開箱即測 Demo 模式**：內建大學生展示假資料，未連線前即可點擊「載入展示資料」體驗完整流程。

---

## 📁 專案目錄結構

```text
.
├── index.html       # 前端抽獎系統主頁面 (GitHub Pages 入口)
├── style.css        # 前端視覺、舞台動畫與響應式排版樣式
├── app.js           # 抽獎邏輯、API 串接、LocalStorage 與 CSV 匯出
├── presentation.md  # 系統架構、實作剖析與正式上板操作展示簡報 (Markdown 格式)
├── gas/
│   ├── Code.gs      # Google Apps Script 試算表唯讀 Web App API
│   └── README.md    # Google 表單、試算表欄位設定與 GAS 部署詳細教學
└── README.md        # 專案總覽、API 介接設定指引與部署指南
```

---

## 🚀 完整部署與正式上線指南

### 步驟 1：部署 Google Apps Script 後端
詳細設定請參閱 [gas/README.md](file:///F:/Onedrive/OneDrive%20-%20%E4%B8%89%E5%B7%9D%E9%9B%B2%E7%A7%91%E6%8A%80%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8/SpectraWorkSpace/Task/20261009-gas-github-lottery-system/gas/README.md)：
1. 於 Google 試算表中建立「表單回應 1」與「獎品」分頁。
2. 進入擴充功能 -> Apps Script，貼上 `gas/Code.gs`。
3. 發布為網路應用程式（存取權限設為 `所有人 (Anyone)`），取得 Web App URL。

### 步驟 2：本地預覽測試
直接雙擊開啟 [index.html](file:///F:/Onedrive/OneDrive%20-%20%E4%B8%89%E5%B7%9D%E9%9B%B2%E7%A7%91%E6%8A%80%E6%9C%89%E9%99%90%E5%85%AC%E5%8F%B8/SpectraWorkSpace/Task/20261009-gas-github-lottery-system/index.html) 或使用任意靜態伺服器（如 VS Code Live Server）：
* 點擊右上角 **「📊 載入展示資料」** 即可立即開始模擬抽獎。
* 點擊 **「⚙️ 設定 API」**，貼上您於步驟 1 取得的 GAS 網址並點擊連線，即可同步真實名單與獎項！

### 步驟 3：部署至 GitHub Pages
1. 將本專案整包目錄提交並推播至您的 GitHub Repository（例如 `main` 分支）：
   ```bash
   git add .
   git commit -m "feat: initial lottery system"
   git push origin main
   ```
2. 進入該 GitHub 儲存庫的 **Settings** -> **Pages**。
3. 在 **Build and deployment** > **Source** 選擇 **Deploy from a branch**。
4. Branch 選擇 **`main`**，資料夾選擇 **`/ (root)`**，點擊 **Save**。
5. 等待 1~2 分鐘後，即可透過 GitHub 提供之靜態網址（如 `https://<username>.github.io/<repo>/`）直接開啟線上抽獎系統。

---

## 🎯 現場操作小技巧

* **防止人員重複中獎**：系統自動記錄所有已中獎人員，後續抽出其他獎項時將自動過濾已得獎者。
* **分輪抽獎**：可隨時在下拉選單中切換欲抽出的獎品，各獎項的「已抽出」與「剩餘名額」會自動計算。
* **緊急備份**：每抽完一個階段，可隨時點擊「匯出 CSV」保存目前已抽出的中獎名冊。
