## Live Preview

[開啟 CAE Material Library](https://ayay2270.github.io/CAE-Material-Library-V2-Preview/)

Branch: `main`

日常編輯不需要 `npm run dev`。使用最新版 Google Chrome 或 Microsoft Edge，
在 GitHub Pages **連結本機資料庫**並授權，即可沿用現有材料編輯介面。
未連結或瀏覽器不支援時，網站仍可唯讀瀏覽、比較、查看曲線及匯出。

# CAE Material Library — V2 Preview

本專案與[原應用程式](https://ayay2270.github.io/CAE-Material-Library/)分開。
Git 追蹤的 **`src/data/materials.json` 是主資料庫**；瀏覽器不會自行 Commit、Push，
也不會把材料庫存回 localStorage 或 IndexedDB。

```text
GitHub Pages + 使用者明確選取／授權的本機 materials.json
    → 現有編輯介面 → 記憶體草稿 → Save Database → 本機 JSON 檔
    → GitHub Desktop Commit + Push origin（使用者操作）
    → 比對 GitHub main JSON → 確認 GitHub 同步
    → 比對線上資料庫版本 → 確認 Pages 資料庫一致
```

## 第一次使用

1. 使用 GitHub Desktop Clone `ayay2270/CAE-Material-Library-V2-Preview`。
2. 使用最新版 Google Chrome 或 Microsoft Edge 開啟上方 GitHub Pages 網址。
3. 按頁首 **連結本機資料庫**。
4. 選取剛 Clone 的儲存庫內 **`src/data/materials.json`**，允許瀏覽器讀寫。
5. 確認「資料庫狀態 → 本機資料庫」顯示 **已連結 / materials.json**。

只接受名稱為 `materials.json` 且通過 schema、索引、ID、歷史及完整曲線驗證的檔案。
不接受損壞／空資料庫、重複 ID 或其他檔案名稱。瀏覽器不會列舉目錄，UI 不顯示完整本機路徑；
因此請自行確認選的是正確 Clone 儲存庫中的檔案，而非同名備份。

## 每日流程

1. 多台電腦協作時，先到 GitHub Desktop **Fetch origin / Pull origin**，避免從舊資料開始編輯。
2. 開啟 GitHub Pages。允許的檔案連結會嘗試恢復；如顯示 **需要重新授權本機資料庫**，按 **重新授權**。
3. 新增／編輯／刪除材料，匯入 CSV，或編輯分類、SOURCE、完整應力–應變曲線。
4. 按 **Save Database**；確認「本機儲存 → **儲存成功**」。此時只改了本機檔案，尚未推送 GitHub。
5. 開啟 GitHub Desktop，檢查 `src/data/materials.json` 的 Changes，輸入摘要並 **Commit**。
6. 按 **Push origin**。
7. 回到網站，開啟 **資料庫狀態**，按 **檢查 GitHub 同步**。
8. 確認 **已同步至 GitHub**。Pages 尚待部署時稍後再檢查；部署資料一致後顯示 **線上版已更新（資料庫一致）**。

GitHub Desktop Pull 或其他程式更改檔案後，重新開啟網站或按 **重新讀取本機資料庫**。
有未儲存草稿時不允許重新讀取或中斷連結；請先儲存，或下載完整 JSON 草稿備份，
再使用「匯入 / 匯出 → 取消未儲存變更」。

## 檔案權限與瀏覽器支援

使用 File System Access API，僅在使用者按鈕操作後開啟 JSON 選檔／讀寫授權。
HTTPS 與支援此 API 的 Chrome／Edge 是推薦環境。不支援時會顯示中文說明並保留唯讀功能。

IndexedDB **`cae-material-library:file-handles:v1` / `handles` / `master-materials`**
只記住選取的檔案 handle，不存材料、草稿、備份或 GitHub credentials。
下次開啟會先 `queryPermission({mode:'readwrite'})`；權限仍有效才自動讀取。
權限需要重新允許時，只在按 **重新授權** 後呼叫 `requestPermission`，不會自動跳出授權。
權限不保證永久有效；隱私模式、清除網站資料、檔案移動、企業政策都可能要求重新選取。
無法使用 IndexedDB 時，這次連結仍可使用，但下次需重新選取。
若原檔案無法再授權，可在狀態面板 **重新選取檔案** 或 **中斷連結**；有草稿時先匯出完整 JSON 並取消未儲存變更。撤銷權限也不會阻止草稿備份／取消。

參考：[Chrome File System Access API 文件](https://developer.chrome.com/docs/capabilities/web-apis/file-system-access)。

## Save Database 的驗證與保護

瀏覽器模式的存檔順序：

1. 使用原共用驗證器驗證目前完整資料庫，拒絕空資料庫、重複 ID、損壞曲線及無效欄位。
2. 序列化並再次驗證，不刪除額外材料／求解器／曲線 metadata。
3. 確認讀寫權限，重新讀取實體檔案，與最後載入／成功儲存的基準內容比對。
4. 在記憶體保留寫入前原始內容；取得 exclusive browser writer 後再檢查一次基準。
5. `write` → 等待 `close` → 再次 `getFile` → 驗證 JSON → 比對完整 canonical JSON。
6. 全部成功才更新已儲存基準、時間及 **儲存成功**；寫入期間新增的草稿變更仍標示未儲存。

寫入／關閉失敗會嘗試 abort 尚未完成的 stream。驗證失敗不報成功，保留草稿及記憶體備份，
可用 **下載寫入前備份** 或完整 JSON 草稿匯出救援。
不會以備份自動覆寫驗證後出現的未知內容，因為它可能是另一程式的新修改。
瀏覽器無法保證對其他程式的跨程序原子 compare-and-swap，請避免多個編輯器同時寫同一檔案。
有未儲存草稿時會安裝瀏覽器離頁警告；瀏覽器可能限制該警告，離頁前請先儲存或匯出備份。

瀏覽器模式不在 Git 內建立大量備份檔；Git 保留長期歷史，寫入前備份僅留記憶體至頁面關閉。

## GitHub 同步與 Pages 狀態

本機儲存與 GitHub 同步是兩個獨立狀態，**儲存成功不代表已 Push**。

- 透過公開唯讀 GitHub REST API 讀取最新 **main commit**，再以該不可變 commit 讀取 `src/data/materials.json`。
- 使用 cache-busting / `cache: no-store`，不以 raw/CDN 的最新分支 URL、時間、筆數或檔案大小推斷同步。
- 完整 canonical JSON 比對包含 ID、全部工程數值、notes、history、indexes、未知 metadata 及曲線資料點順序。
- 相同才顯示 **已同步至 GitHub**；不同顯示 **尚未同步**。若遠端資料另外變更，提示 **GitHub 資料與本機不同**，不覆寫任何一方。
- 本機有新草稿時，遠端已同步狀態只代表最後儲存版本，UI 明確說明草稿尚未儲存。
- 儲存後自動在 0、15、45、105 秒檢查，最多四次；相同、衝突或錯誤後停止。手動按鈕可再檢查。
- GitHub 網路錯誤、限流或回應損壞會顯示 **檢查失敗**，不會報成功，也不影響本機已驗證的儲存。

每次 Vite build 產生 **`dist/database-version.json`**，含 canonical JSON 的 SHA-256 與可用的 CI commit。
遠端同步確認後，透過同來源版本檔比對線上資料庫 hash；最多四次有限檢查，吻合才顯示
**線上版已更新（資料庫一致）**。不同顯示 **等待部署**；查詢失敗顯示 **暫時無法確認部署**。
這確認的是部署資料庫內容一致，不是推斷 GitHub Actions 正在執行哪一步。

參考：[GitHub repository contents API](https://docs.github.com/en/rest/repos/contents#get-repository-content)。

## 主資料庫與本機偏好

`src/data/materials.json` 包含 `schemaVersion: 1`、`materials`、`indexes.categories`、`indexes.sources`。
原 11 筆材料的 ID、工程數值、備註、日期與歷史未變更；自訂／未使用分類與 SOURCE 均保留。
歷史內部欄位 **`etan` 仍儲存 OptiStruct H**，不在此工作中改 schema。

| 儲存位置 | 用途 |
| --- | --- |
| Git JSON / 明確選取的本機檔案 | 唯一材料主資料庫 |
| 記憶體 | 尚未儲存的草稿、寫入前備份、暫時同步結果 |
| IndexedDB file-handles | 只儲存檔案控制代碼，不儲存材料內容 |
| `cae-material-library:columns:v1` | 個別瀏覽器欄位顯示與順序 |
| `cae-material-library:legacy-recovery:v1` | 舊資料通知已讀 signature |
| `cae-material-library:v1` | 舊材料資料，只讀取供回復，不覆寫／刪除 |
| `cae-material-library:indexes:v1` | 舊分類／SOURCE 索引，只讀取供回復 |

單位、篩選、排序與表格／卡片偏好維持既有記憶體行為。材料資料不寫回 localStorage。
舊資料與主資料庫不同時仍提示回復；連結本機資料庫後可明確匯入為草稿，再按 Save Database。
也可下載完整 JSON 或 CSV，忽略通知不會刪除舊資料。

## CSV、曲線與工程功能

既有新增／編輯／刪除、CSV 同名更新、分類／SOURCE 重新命名、notes 與 history 行為保留。
CSV 匯入 → 草稿 → Save Database → 選取的本機 JSON，之後手動 Commit + Push。
完整 JSON 備份保留 ID、完整歷史、索引及所有 metadata；CSV 維持既有支援欄位。

Detail → 材料曲線仍支援完整 Strain／Stress 貼上或 CSV／TSV、定義、預覽、儲存及匯出。
資料點順序、卸載／負值、engineering／true 定義、source／notes 與 metadata 不變。
內部仍用 mm/mm、MPa，不改工程轉換或公式。

Stored H 保持優先；Calculated H 仍由原 bilinear 公式計算並顯示完整代入步驟。
`ETAN = E × H / (E + H)`，E = 200000、Stored H = 740.06 時，ETAN = 737.33 MPa。
沒有 Stored H 才使用完整精度的 Calculated H。Density Tuner、Compare、Material Map、
Table／Cards、column preferences 與單位顯示保持不變。
頁首實拍圖片及 [credits](src/assets/CREDITS.md) 未修改。

## 開發者／備援模式

仍支援 Node.js 22+：

```bash
git pull
npm ci
npm run dev
```

Vite 本機網址仍使用 **`/CAE-Material-Library-V2-Preview/`**。
未選取瀏覽器檔案時，開發模式沿用 loopback-only 本機 API，Save Database 驗證後以原 atomic writer
寫入儲存庫 JSON，保留一份 Git-ignored `data/backups/materials.backup.json`。
讀寫 API 的固定路徑、same-origin／token 保護、revision／file lock 與故障不覆寫行為不變。
Production build **不提供**這個伺服器檔案 API；瀏覽器只操作使用者明確授權的 handle。
沒有 GitHub token、外部後端、Supabase、Firebase 或自動 Git 操作。

## 測試與部署

```bash
npm ci
npm test
npm run build
npm run test:production
```

`npm run build` / `build:pages` 保留 base **`/CAE-Material-Library-V2-Preview/`**。
GitHub Actions 在 main push 後測試、建置並部署 `dist/`；`build:preview` 仍提供相對資產路徑版本。

測試涵蓋原工程公式、資料庫完整性、瀏覽器檔案讀寫 adapter、權限、external-edit conflict、
write/close/re-read verification、CSV、完整曲線、canonical hash、GitHub 查詢錯誤及有限輪詢。
原生 Chrome／Edge 的系統選檔與權限視窗必須人工確認；自動測試不代表系統授權永久有效。
早期 [raw.githack 靜態快照](https://raw.githack.com/ayay2270/CAE-Material-Library-V2-Preview/preview/git-master-database/dist/index.html)
仍是舊版本，請使用本文件最上方的 Live Preview。
