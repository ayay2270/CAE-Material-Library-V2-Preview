import { Modal } from './Modal';
import { UNSUPPORTED_MESSAGE } from '../lib/browserDatabase';
import { useState } from 'react';
import { DatabaseOnboardingDialog } from './DatabaseOnboardingDialog';

export function LocalEditingDialog({ onClose, onConnect, supported, permissionNeeded }: { onClose: () => void; onConnect: () => void; supported: boolean; permissionNeeded: boolean }) {
  const [helpOpen, setHelpOpen] = useState(false);
  if (helpOpen) return <DatabaseOnboardingDialog onClose={() => setHelpOpen(false)} onConnect={onConnect} supported={supported} />;
  return <Modal title="連結本機資料庫" onClose={onClose}>
    {supported ? <>
      <p>請先把 GitHub 專案複製到電腦，再連結專案中的 <code>src/data/materials.json</code>，並允許網站讀取與寫入，即可新增、編輯、刪除及匯入材料。第一次設定請查看下方步驟。</p>
      <p>編輯後按 <b>Save Database</b> 儲存本機檔案，再使用 GitHub Desktop Commit + Push。網站不會自行推送資料。</p>
      <button className="btn primary" onClick={onConnect}>{permissionNeeded ? '重新授權' : '連結本機資料庫'}</button>
    </> : <p>{UNSUPPORTED_MESSAGE}</p>}
    <button className="database-help-link" onClick={() => setHelpOpen(true)}>第一次使用？查看設定步驟</button>
  </Modal>;
}
