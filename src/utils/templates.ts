import { LayoutMode } from '../types/mindmap';

export interface MindMapTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  layoutMode: LayoutMode;
  content: string;
}

export const MINDMAP_TEMPLATES: MindMapTemplate[] = [
  {
    id: 'product-launch',
    name: '🚀 產品規劃與研發路線圖',
    category: '專案管理',
    description: '包含目標定義、核心功能、技術架構與上線檢核清單',
    layoutMode: 'right',
    content: `Typemindmap 產品規劃藍圖
  核心價值主張 #重點 @color(indigo)
    鍵盤優先極速輸入 // 打字速度就是思考速度
      Tab 向內縮排建立子分支
      Shift+Tab 向外提升層級
      Alt+上下鍵 整塊移動分支
    圖文雙向即時同步 // 左圖右文雙向聯動
      右側打字即時渲染左側心智圖
      左側雙擊節點直接改字與新增分支
      拖曳節點自動重排大綱階層
  系統架構與隱私設計 @color(emerald)
    100% 純瀏覽器本地儲存 #隱私優先
      自動寫入 LocalStorage 免註冊
      多工作區分頁管理
    多樣化視覺佈局
      右側邏輯樹狀圖
      雙向平衡心智圖
      垂直組織架構圖
  上線前待辦檢核清單 @color(amber)
    [x] 完成雙向縮排解析引擎 #核心
    [x] 實作節點直接輸入與顏色標籤
    [ ] 撰寫完整快捷鍵指南與使用說明 #文檔
    [ ] 部署至 GitHub Pages 公開展示 @url(https://github.com)`
  },
  {
    id: 'study-notes',
    name: '📚 課程學習與讀書筆記',
    category: '學習筆記',
    description: '結構化梳理核心概念、原理比較、重點摘要與課後複習問題',
    layoutMode: 'balanced',
    content: `大型語言模型 (LLM) 核心技術筆記
  基礎架構原理 @color(indigo)
    Transformer 自注意力機制 #必考
      Query / Key / Value 矩陣運算
      Multi-Head Attention 多頭平行特徵
    位置編碼 (Positional Encoding)
      RoPE 旋轉位置編碼優勢 // 目前主流開源模型標配
  訓練三階段流程 @color(emerald)
    1. 預訓練 (Pre-training)
      海量無標註語料 Next-Token 預測
    2. 監督式微調 (SFT)
      高品質指令遵循對話資料集
    3. 人類回饋強化學習 (RLHF / DPO) #對齊
      提升安全性與回答偏好一致性
  推論加速與部署優化 @color(amber)
    KV Cache 記憶體快取機制
    模型量化技術 (Quantization)
      FP16 轉 INT4 / GGUF 本地部署
    RAG 檢索增強生成 // 降低幻覺並整合私有知識庫
  課後複習行動清單 @color(purple)
    [x] 整理 Attention 計算複雜度筆記
    [ ] 實作本地端 GGUF 模型量化測試 #實作`
  },
  {
    id: 'system-arch',
    name: '💻 系統架構與 API 端點設計',
    category: '軟體工程',
    description: '清楚繪製前後端模組、資料庫綱要與 RESTful API 路由結構',
    layoutMode: 'top-down',
    content: `雲端微服務電商平台架構
  前端應用層 (Frontend) @color(cyan)
    Web 響應式商城 (React + TypeScript)
    行動端 App (Flutter)
    CDN 靜態資源快取
  API 閘道層 (API Gateway) @color(indigo)
    JWT 身分驗證與權限控管 #資安
    Rate Limiting 流量限速防護
  核心微服務群 (Microservices) @color(emerald)
    會員認證服務 (/api/v1/auth)
      POST /login 登入簽發憑證
      POST /oauth2 第三方登入
    商品目錄服務 (/api/v1/catalog)
      GET /products 分頁與全文檢索
      Redis 熱門商品快取
    訂單與金流服務 (/api/v1/orders) #高可靠
      分散式交易 Saga 模式
      非同步訊息佇列 (RabbitMQ / Kafka)
  資料儲存層 (Data Layer) @color(amber)
    PostgreSQL 主從讀寫分離
    Elasticsearch 全文搜尋引擎
    S3 物件儲存與自動備份`
  },
  {
    id: 'weekly-okr',
    name: '🎯 個人雙週目標與行動計畫 (OKR)',
    category: '個人效率',
    description: '將大目標拆解為可追蹤打勾的關鍵成果與每日行動',
    layoutMode: 'right',
    content: `2026 Q4 核心目標與雙週衝刺計畫
  O1：打造高效率個人知識工作流 @color(purple)
    KR1：建立結構化筆記與心智圖模版庫 #核心
      [x] 統整專案啟動與會議紀錄格式
      [ ] 建立每週復盤檢核流程
    KR2：自動化日常重複性報表整理
      [ ] 編寫 Python 資料清理腳本 #自動化
  O2：強化全端與 AI 應用實戰能力 @color(indigo)
    KR1：完成 2 個開源工具專案並上線
      [x] 完成 SRTNote 影音同步筆記工作台
      [x] 啟動 Typemindmap 雙向心智圖專案
    KR2：輸出技術實踐文章分享
      [ ] 撰寫純前端樹狀排版演算法解析
  健康與生活平衡 @color(emerald)
    [x] 每週維持 3 次有氧或重訓運動
    [ ] 每日維持 23:30 前就寢作息 #習慣`
  }
];
