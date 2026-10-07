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
          <li>直接使用線上網站，不需要先把專案複製到電腦。</li>
          <li>可按「下載目前材料資料庫 JSON」備份目前線上版本的完整資料庫。</li>
        </ol>
        <button className="btn" onClick={downloadDeployedDatabase}>下載目前材料資料庫 JSON</button>
        <p className="muted small">用途：備份、複製資料、保留一份 JSON，或帶到其他地方。下載的獨立 JSON 不會自動與 GitHub Repository 綁定，也不會自動 Commit / Push。</p>
      </section>
      <section className="database-onboarding-path" aria-label="我要新增 / 編輯材料">
        <h3>我要新增 / 編輯材料</h3>
        <p>第一次使用這台電腦時，需要先把 GitHub 上的專案複製到電腦。這個動作叫做 Clone，只需要做一次。</p>
        <p><b>Clone = 把 GitHub 上的專案複製到你的電腦，並保留與 GitHub 的版本同步關係。</b></p>
        <section className="database-onboarding-step-group" aria-label="第一次使用這台電腦">
          <h4>第一次使用這台電腦</h4>
          <ol>
            <li>開啟 GitHub Desktop，並登入 GitHub 帳號。</li>
            <li>在 GitHub Desktop 上方選 <b>File → Clone repository</b>。</li>
            <li>找到 <code>ayay2270/CAE-Material-Library-V2-Preview</code>。</li>
            <li>選擇要把專案放在電腦哪個資料夾。例如：<code className="database-file-path">{'C:\\Users\\你的帳號\\Documents\\GitHub\\'}</code></li>
            <li>按 <b>Clone</b>。<p className="muted small">這會複製整個專案；這份資料夾之後可以透過 GitHub Desktop Commit / Push 回 GitHub。</p></li>
            <li>完成後，電腦中會有：<pre className="database-onboarding-tree">{'CAE-Material-Library-V2-Preview\n└─ src\n   └─ data\n      └─ materials.json'}</pre></li>
            <li>回到 CAE Material Library 網站，按「連結本機資料庫」。</li>
            <li>在檔案選擇視窗進入剛複製的專案：<code className="database-file-path">CAE-Material-Library-V2-Preview → src → data</code>選擇 <b>materials.json</b>，並允許網站讀取與寫入。</li>
            <li>看到「本機資料庫 · ✓ 已連結 · materials.json」，就可以開始新增／編輯／刪除材料。</li>
          </ol>
        </section>
        <p className="muted small">如果你要讓修改可以上傳到 GitHub，請選擇 GitHub Desktop Clone 下來的專案中的 <code>src/data/materials.json</code>。GitHub Desktop Clone 會建立真正的本機 Git Repository，修改後可以 Commit，再 Push origin 到 GitHub。網站上的「下載目前材料資料庫 JSON」主要是備份用途，不是用來直接 Push 到 GitHub。</p>
        <section className="database-onboarding-step-group" aria-label="修改完成後">
          <h4>修改完成後</h4>
          <ol>
            <li>在網站新增／編輯材料。</li>
            <li>按 <b>Save Database</b>。</li>
            <li>確認「本機儲存 · ✓ 儲存成功」。<p className="muted small">這一步只代表你電腦裡的 materials.json 已經更新，還沒有上傳到 GitHub。</p></li>
            <li>打開 GitHub Desktop。</li>
            <li>在 <b>Changes</b>（變更清單）中確認有 <code>src/data/materials.json</code>。</li>
            <li>在 <b>Summary</b>（提交說明）輸入修改內容。例如：<code>Update material database</code>。</li>
            <li>按 <b>Commit to main</b>。</li>
            <li>再按 <b>Push origin</b>。</li>
            <li>回網站按「檢查 GitHub 同步」。</li>
            <li>看到「GitHub 同步 · ✓ 已同步至 GitHub」，才代表資料已經 Push 到 GitHub。</li>
            <li>若部署也完成，會顯示「GitHub Pages · ✓ 線上版已更新」。<p className="muted small">其他電腦重新整理網站後，就會看到最新資料。</p></li>
          </ol>
        </section>
        <section className="database-onboarding-step-group" aria-label="之後每次使用">
          <h4>之後每次使用</h4>
          <p>同一台電腦不用再 Clone。先更新本機專案，再開始修改：</p>
          <ol className="database-onboarding-daily">
            <li>GitHub Desktop Fetch / Pull（取得最新版本）</li>
            <li>開啟 CAE Material Library</li>
            <li>新增／編輯材料</li>
            <li>Save Database</li>
            <li>GitHub Desktop Commit</li>
            <li>Push origin</li>
            <li>回網站「檢查 GitHub 同步」</li>
          </ol>
        </section>
        <div className="database-onboarding-actions">
          <a className="btn" href="https://github.com/ayay2270/CAE-Material-Library-V2-Preview" target="_blank" rel="noopener noreferrer">開啟 GitHub Repository</a>
          <button className="btn primary" disabled={!supported} onClick={onConnect}>連結本機資料庫</button>
        </div>
        {!supported && <p>{UNSUPPORTED_MESSAGE}</p>}
      </section>
    </div>
  </Modal>;
}
