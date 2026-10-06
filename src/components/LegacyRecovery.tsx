import { useState } from 'react';
import { Modal } from './Modal';
import type { LegacyRecovery as Recovery } from '../lib/legacy';
import { downloadJson } from '../lib/legacy';
import { downloadCsv } from '../lib/csv';

export function LegacyRecovery({ recovery, editable, onImport, onClose }: {
  recovery: Recovery; editable: boolean; onImport: () => void; onClose: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  return <Modal title="發現舊瀏覽器材料資料" width={540} onClose={onClose}>
    <p>舊 localStorage 與 Git 主資料庫不同。舊資料仍保留，未自動覆寫或刪除。</p>
    <p className="muted">{editable
      ? '匯入會取代目前草稿，保留舊 ID、歷史、曲線與索引。只有按 Save Database 才會寫入本機資料庫。'
      : '請先連結本機資料庫，即可回復舊資料草稿並儲存；也可先下載完整 JSON 備份。CSV 可另外用來檢視材料數值。'}</p>
    {recovery.error && <p role="alert">舊資料未通過驗證：{recovery.error} 請下載原始備份，修復後再匯入。</p>}
    <div className="io-actions">
      {recovery.database && <button className="btn" onClick={() => downloadCsv(recovery.database!.materials, 'legacy-materials.csv')}>匯出舊資料 CSV</button>}
      <button className="btn" onClick={() => downloadJson(recovery.database ?? { legacyMaterialsRaw: recovery.raw, legacyIndexesRaw: recovery.rawIndexes }, 'legacy-material-database.json')}>下載完整 JSON 備份</button>
      {editable && recovery.database && <button className="btn primary" onClick={() => confirm ? onImport() : setConfirm(true)}>{confirm ? '確認取代草稿並匯入' : '匯入舊資料為草稿'}</button>}
      <button className="btn" onClick={onClose}>忽略舊資料</button>
    </div>
    {confirm && <p role="alert">目前草稿將被取代；需要保留時請先關閉視窗並匯出草稿。</p>}
    <p className="muted small">忽略只記錄此通知已讀；可從「匯入 / 匯出 → 檢查舊瀏覽器資料」再次開啟。</p>
  </Modal>;
}
