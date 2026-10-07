import { Modal } from './Modal';
import { UNSUPPORTED_MESSAGE } from '../lib/browserDatabase';
import { useState } from 'react';
import { DatabaseOnboardingDialog } from './DatabaseOnboardingDialog';

export function LocalEditingDialog({ onClose, onConnect, supported, permissionNeeded }: { onClose: () => void; onConnect: () => void; supported: boolean; permissionNeeded: boolean }) {
  const [helpOpen, setHelpOpen] = useState(false);
  if (helpOpen) return <DatabaseOnboardingDialog onClose={() => setHelpOpen(false)} onConnect={onConnect} supported={supported} />;
  return <Modal title="連結本機資料庫" onClose={onClose}>
    {supported ? <>
      <p>請先連結本機 Git 儲存庫的 <code>src/data/materials.json</code>，並授予瀏覽器讀寫權限，即可新增、編輯、刪除及匯入材料。</p>
      <p>編輯後按 <b>Save Database</b> 儲存本機檔案，再使用 GitHub Desktop Commit + Push。網站不會自行推送資料。</p>
      <button className="btn primary" onClick={onConnect}>{permissionNeeded ? '重新授權' : '連結本機資料庫'}</button>
    </> : <p>{UNSUPPORTED_MESSAGE}</p>}
    <button className="database-help-link" onClick={() => setHelpOpen(true)}>第一次使用 / 如何開始</button>
  </Modal>;
}
