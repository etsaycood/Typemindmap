# Typemindmap — 左圖右文雙向同步心智圖工作台

[![Deploy to GitHub Pages](https://github.com/etsaycood/Typemindmap/actions/workflows/deploy.yml/badge.svg)](https://github.com/etsaycood/Typemindmap/actions/workflows/deploy.yml)

🔗 **線上網址**：[**https://etsaycood.github.io/Typemindmap/**](https://etsaycood.github.io/Typemindmap/)

**Typemindmap** 是一款以鍵盤極速輸入為核心、兼具圖形直接互動能力的純前端心智圖應用程式（靈感源自 [txt2map.com](https://txt2map.com/)，並採用 **「左側互動心智圖畫布 + 右側縮排大綱打字區」** 雙向即時同步架構）。

所有內容 **100% 儲存在您的瀏覽器本地（LocalStorage）**，無需註冊、零伺服器上傳，打開即用。

---

## ✨ 核心特色

### 1. ⌨️ 右側：鍵盤優先縮排大綱編輯器（Keyboard-First Outliner）
- **打字速度就是繪圖速度**：第一行即根節點，按 `Enter` 自動對齊縮排建立同級節點，按 `Tab` 建立子分支，`Shift + Tab` 提升層級。
- **整塊移動子樹**：按 `Alt + ↑ / ↓` 直接將當前節點連同底下所有巢狀子項目整塊上下搬移，免剪貼重排。
- **多分頁工作區**：右側頂部支援多張圖表分頁切換、雙擊分頁重新命名、獨立儲存排版模式。
- **行內增強語法**：
  - `[ ] 任務` / `[x] 任務`：可直接在圖形上點擊打勾的待辦核取方塊
  - `#標籤`：自動渲染為彩色標籤膠囊
  - `// 補充說明`：於節點卡片下方呈現精簡備註
  - `@color(indigo|emerald|amber|purple|rose|cyan)`：指定分支主題色
  - `https://...` 或 `@url(...)`：附加可點擊外部超連結

### 2. 🧠 左側：可直接編輯的視覺化互動心智圖（Interactive Canvas）
- **100% 圖文雙向同步**：不只右邊打字會改左邊的圖，**在左邊圖形上做的任何修改也會即時寫回右邊的縮排文字**！
- **直接在圖形卡片打字**：雙擊任一節點（或選取後按 `F2` / `Space`），直接在節點方塊內輸入修改。
- **圖形快捷鍵增刪**：選取節點後按 `Tab` 直接長出子節點並進入打字狀態、按 `Enter` 新增同級節點、按 `Delete` 刪除子樹。
- **單擊浮動工具列**：點擊節點即浮現快速換色圓點、`+子節點`、`+同級`、切換待辦框、詳細設定與 `🎯 聚焦放大`。
- **滑鼠拖曳重組（Drag & Drop）**：直接拖曳節點至其他節點上方、中央或下方，即可調整同層順序或變更父子階層。
- **四種專業佈局一鍵切換**：
  1. `➡️ 右側邏輯圖`（由左至右水平展開）
  2. `↔️ 雙向平衡圖`（中心對稱展開）
  3. `⬅️ 左側邏輯圖`（由右至左水平展開）
  4. `⬇️ 垂直樹狀圖`（由上至下組織架構圖）

### 3. 📤 多格式無損匯出與工作區備份
- **高解析度 PNG (2x Retina)** 與 **純向量 SVG 圖檔**（純原生向量繪製，絕不掉字）
- **Markdown (`.md`)**、**Mermaid `mindmap` (`.mmd`)**、**純文字大綱 (`.txt`)**
- **JSON 完整工作區備份與還原**

---

## 🚀 本地啟動與開發

```bash
cd Typemindmap
npm install
npm run dev
```

建置生產環境靜態檔案（內附 GitHub Pages 自動部署 Workflow `.github/workflows/deploy.yml`）：

```bash
npm run build
```

