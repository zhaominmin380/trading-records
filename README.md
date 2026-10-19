# Dspe · 期貨交易日誌

粉白色繁體中文交易日誌，靜態網站，無須安裝依賴。

```sh
cd mnq-journal
python3 -m http.server 8080
```

開啟 http://localhost:8080 。資料儲存在目前網址的瀏覽器 localStorage，請定期匯出 JSON 備份；尚無跨裝置同步。

## 帳號與規則

首頁帳號選單右側可新增帳號，選單下方顯示帳號資訊，再往下顯示期間統計、月曆與交易紀錄；不顯示累積淨損益圖表。「帳號與規則」以寬版視窗呈現帳號資料、資金與風控、持倉限制及出金規則分區，標題與儲存按鈕固定，內容獨立捲動；手機使用單欄，考試帳號隱藏出金規則區。依序選擇公司、類型、金額、考試／出金階段。目前提供 Tradeify Select 25K、50K、150K（Flex／Daily），以及 Lucid Trading → LucidFlex 50K／150K（考試／Sim Funded）。

選單切換會自動填入規則。數值均可手動修改，空白代表無／不適用；保存後屬於該帳號的獨立快照，不會因新增其他帳號或更新預設而被覆蓋。「重新套用官方預設」才會重設。考試支援標準 40%／已購買 50% 加購；50K 支援現行 $3,000 與舊儀表板前購買 $2,500 目標。出金上限可選 2026/09/01（含）後與之前的版本。

查核日期與官方來源放在帳號表單；數值與差異見 [Tradeify 規則查核](TRADEIFY-RULES.md)。規則目錄位於 `rules.js`：`RULE_CATALOG` 可新增公司／產品，產品提供 `sizes` 和 `makeRules`，不需修改交易紀錄結構。

## 交易紀錄

新增交易必須選帳號。首頁、月曆、統計與帳戶數值只計算目前帳號；點交易開啟獨立單頁，依序顯示基本資訊、上傳圖表與檢討。保留 hash 路由與瀏覽器上一頁功能。

可選擇 NQ／MNQ／ES／MES／GC，依標的每點價值計算損益並扣除總手續費；切換標的會更新價格步進。舊紀錄缺少標的時沿用 MNQ。交易列表提供標的篩選，僅影響列表，不改變帳號總覽統計。無策略輸入欄位，舊資料的策略欄位會保留。每筆可加入最多 3 張 PNG／JPEG／WebP 圖片，每張最多 750 KB。匯出備份包含所有帳號、規則與圖片；第一階段提供匯出，暫不提供匯入；保留既有瀏覽器資料的舊格式相容能力。

每天平均交易次數＝期間總筆數 ÷ 有交易的天數；交易一致性＝最高單日淨獲利 ÷ 期間總淨獲利 × 100%。期間總淨獲利不大於零時顯示「—」。總覽指標隨期間篩選；帳號規則追蹤以該帳號所有已平倉紀錄估算。

## 資料與計算範圍

v2 備份儲存 accounts、activeAccountId 和每筆交易的 accountId，settings 僅保留當前帳號相容副本。舊單帳號資料載入時會轉為獨立帳號，保留原始資金、目標、每日虧損、天數與交易，不推測舊帳號未記錄的回撤與一致性限制。交易及帳號更動儲存失敗時會保留原資料。

此版保存規則與已平倉績效，不判定通過／違規／可出金金額。未追蹤出金週期、出入金、盤中淨值、回撤底線或當前升級口數。交易日期以手動選擇的交易日歸檔，今日淨虧損按瀏覽器當地日期查詢，與 Tradeify 的交易時段 DLL 不等同。EOD 回撤只在收盤更新底線，但盤中觸碰仍會違規；請查看平台。

## 驗證

```sh
node --check rules.js
node --check app.js
node tests/accounts.cjs
```

Node VM 測試涵蓋預設規則組合、版本切換、無限制值、自動填入、手動覆寫保存、多帳號隔離、交易歸屬、詳情路由、保存後重載、含圖表資料與舊資料遷移。未完成實際瀏覽器操作驗證。

Sites 已保留原 project_id；原始碼服務 `git.chatgpt-team.site` 目前 DNS 回傳 ENOTFOUND，尚未部署成功，無可用的線上版本。

## 第一階段整理

正式介面已移除示範模式、假交易資料、預留頭像、停用的匯入元件及未使用的舊圖表／檢討樣式。保留正式功能的錯誤提示、欄位說明與規則來源。`tests/` 是開發檢查，不會載入網站；`img/` 保留使用者提供的參考圖片。現有瀏覽器儲存鍵維持不變。

## 標的規格

| 標的 | 每點價值 USD／口 | 最小跳動 | 每跳價值 USD／口 |
|---|---:|---:|---:|
| NQ | 20 | 0.25 | 5 |
| MNQ | 2 | 0.25 | 0.50 |
| ES | 50 | 0.25 | 12.50 |
| MES | 5 | 0.25 | 1.25 |
| GC | 100 | 0.10 | 10 |

淨損益＝（出場－進場）× 方向 × 口數 × 每點價值－總手續費。價格使用最小跳動驗證，計算時處理小數精度，最終結果四捨五入至美分；每筆紀錄會保存 symbol。考核帳號持倉限制仍以 Micro 等值記錄，不是各標的實際口數上限，網站不自動判定持倉合規。

官方來源：[NQ](https://www.cmegroup.com/markets/equities/nasdaq/e-mini-nasdaq-100.contractSpecs.html)、[MNQ](https://www.cmegroup.com/markets/equities/nasdaq/micro-e-mini-nasdaq-100.contractSpecs.html)、[ES](https://www.cmegroup.com/markets/equities/sp/e-mini-sandp500.contractSpecs.html)、[MES](https://www.cmegroup.com/markets/equities/sp/micro-e-mini-sandp-500.contractSpecs.html)、[GC](https://www.cmegroup.com/education/articles-and-reports/trading-comex-gold-and-silver)。查核日期：2026-10-19。

## LucidFlex 50K

考試預設：目標 $3,000、EOD 回撤 $2,000、標準 40% 一致性最快 3 日（已購買 50% 加購可選最快 2 日）、40 Micro。出金帳號：起始 20 Micro，收盤獲利 $1,000／$2,000 升至 30／40 Micro；每輪需 5 個淨利至少 $150 的獲利日及本輪正淨利，最低申請 $500、總獲利 50% 且上限 $2,000、90% 分潤，無安全墊及一致性限制。EOD 回撤鎖在起始資金加 $100，出金時亦鎖定。DLL 預設無，購買時加選者請依平台手動填入。最多 5 次出金後轉 Live。網站不追蹤出金週期、次數或自動判定出金資格。

查核日期：2026-10-19。官方來源：[考試](https://support.lucidtrading.com/en/articles/12945790-lucidflex-evaluation-account)、[出金帳號](https://support.lucidtrading.com/en/articles/12945795-lucidflex-funded-account)、[出金規則](https://support.lucidtrading.com/en/articles/12945796-lucidflex-payouts)、[回撤](https://support.lucidtrading.com/en/articles/12945815-lucidflex-drawdown)、[口數升級](https://support.lucidtrading.com/en/articles/12945808-lucidflex-scaling-plan)。

LucidFlex 150K 同樣支援考試／Sim Funded。考試目標 $9,000、EOD 回撤 $4,500、最高 100 Micro，標準 40% 一致性／最快 3 日，加購 50%／最快 2 日。出金帳號起始 40 Micro，收盤獲利達 $1,000／$2,000／$3,000／$4,500 升至 50／60／80／100 Micro；每輪 5 個淨利至少 $250 的獲利日，單次上限 $3,000，其餘出金規則與 50K 相同。已儲存帳號仍保留原始規則快照；重新套用預設才會更新。
