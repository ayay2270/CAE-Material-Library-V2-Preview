import { committedDatabase } from './masterDatabase';
import { downloadJson } from './legacy';

export const DEPLOYED_DATABASE_FILENAME = 'CAE-Material-Library-materials.json';

/** Export the same complete snapshot bundled with this site, never a local file or draft. */
export function downloadDeployedDatabase() {
  downloadJson(committedDatabase(), DEPLOYED_DATABASE_FILENAME);
}
