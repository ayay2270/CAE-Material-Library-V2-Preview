import { Modal } from './Modal';

export function LocalEditingDialog({ onClose }: { onClose: () => void }) {
  return <Modal title="Local editing only" onClose={onClose}>
    <p>This GitHub Pages version is read-only.</p>
    <p>To add, edit, delete or import materials, open the repository locally and run:</p>
    <pre><code>npm run dev</code></pre>
    <p>After editing, use <b>Save Database</b> to write changes to:</p>
    <p><code>src/data/materials.json</code></p>
    <p>Then commit and push the database update to GitHub.</p>
  </Modal>;
}
