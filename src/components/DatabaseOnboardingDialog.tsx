import { Modal } from './Modal';
import { downloadDeployedDatabase } from '../lib/deployedDatabaseDownload';
import { UNSUPPORTED_MESSAGE } from '../lib/browserDatabase';

export function DatabaseOnboardingDialog({ onClose, onConnect, supported }: {
  onClose: () => void;
  onConnect: () => void;
  supported: boolean;
}) {
  return <Modal title="第一次使用 / 如何開始" width={620} onClose={onClose}>
    <div className="database-onboarding-paths">
      <section className="database-onboarding-path" aria-label="只想查看 / 備份">
        <h3>只想查看 / 備份</h3>
        <ol>
          <li>直接使用線上網站，無需 Clone。</li>
          <li>可按「下載目前材料資料庫 JSON」備份目前線上版本的完整資料庫。</li>
        </ol>
        <button className="btn" onClick={downloadDeployedDatabase}>下載目前材料資料庫 JSON</button>
        <p className="muted small">下載的 JSON 是獨立備份／副本，不會建立 Git 儲存庫，也不會自動 Commit / Push。</p>
      </section>
      <section className="database-onboarding-path" aria-label="我要新增 / 編輯材料">
        <h3>我要新增 / 編輯材料</h3>
        <ol>
          <li>使用 GitHub Desktop Clone 此 Repository。</li>
          <li>在網站按「連結本機資料庫」。</li>
          <li>選擇 Clone 後儲存庫中的 <code>src/data/materials.json</code>，並允許讀寫。</li>
          <li>新增／編輯材料。</li>
          <li>按 <b>Save Database</b> 儲存本機檔案。</li>
          <li>在 GitHub Desktop <b>Commit</b>。</li>
          <li>按 <b>Push origin</b>。</li>
          <li>回網站按「檢查 GitHub 同步」，確認「已同步至 GitHub」。</li>
        </ol>
        <p className="muted small">連結的是 Clone 後儲存庫內的 Git 追蹤檔案，不是剛下載的獨立 JSON。Save Database 不會自動 Commit 或 Push。</p>
        <div className="database-onboarding-actions">
          <a className="btn" href="https://github.com/ayay2270/CAE-Material-Library-V2-Preview" target="_blank" rel="noopener noreferrer">開啟 GitHub Repository</a>
          <button className="btn primary" disabled={!supported} onClick={onConnect}>連結本機資料庫</button>
        </div>
        {!supported && <p>{UNSUPPORTED_MESSAGE}</p>}
      </section>
    </div>
  </Modal>;
}
