import type { Material } from '../types';
import type { MaterialIndexes } from './indexes';
export interface MasterDatabase {
  schemaVersion: 1;
  materials: Material[];
  indexes: MaterialIndexes;
}
export function validateDatabase(value: unknown): MasterDatabase;
export function canonicalJson(value: unknown): string;
