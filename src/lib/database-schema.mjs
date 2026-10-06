// Shared, dependency-free validation for the browser, local writer and build.
// Validate without reconstructing records: additional solver/metadata fields survive.
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v) => typeof v === 'string';
const nonempty = (v) => text(v) && v.trim().length > 0;
const finite = (v) => typeof v === 'number' && Number.isFinite(v);
const date = (v) => nonempty(v) && !Number.isNaN(Date.parse(v));
const fail = (message) => { throw new Error(message); };

export function validateDatabase(value) {
  if (!object(value) || value.schemaVersion !== 1) fail('Database schemaVersion must be 1.');
  if (!Array.isArray(value.materials) || value.materials.length === 0)
    fail('Refusing an empty or missing material database. Keep at least one material.');
  if (!object(value.indexes) || !Array.isArray(value.indexes.categories) || !Array.isArray(value.indexes.sources))
    fail('Category and source indexes are required.');
  const categories = new Set();
  for (const c of value.indexes.categories) {
    if (!object(c) || !nonempty(c.id) || c.id.toLowerCase() === 'all' || !nonempty(c.label) || !/^#[0-9a-f]{6}$/i.test(c.color))
      fail('Invalid category index.');
    if (categories.has(c.id)) fail(`Duplicate category ID: ${c.id}`);
    categories.add(c.id);
  }
  const sources = new Set();
  for (const source of value.indexes.sources) {
    if (!nonempty(source) || source.toLowerCase() === 'all' || sources.has(source)) fail('Invalid or duplicate source index.');
    sources.add(source);
  }
  const ids = new Set();
  for (const m of value.materials) {
    if (!object(m) || !nonempty(m.id) || !nonempty(m.name) || !nonempty(m.category)) fail('Material ID, name and category are required.');
    if (ids.has(m.id)) fail(`Duplicate material ID: ${m.id}`);
    ids.add(m.id);
    if (!categories.has(m.category) || (m.source && !sources.has(m.source))) fail(`Missing index for material ${m.name}.`);
    for (const key of ['density', 'youngsModulus', 'poissonRatio', 'yieldStress', 'etan', 'ultimateStress', 'elongation'])
      if (m[key] !== null && !finite(m[key])) fail(`Invalid or missing ${key} for ${m.name}.`);
    if (!text(m.source) || !text(m.notes) || !date(m.updatedAt) || !Array.isArray(m.history)) fail(`Invalid metadata for ${m.name}.`);
    for (const h of m.history)
      if (!object(h) || !date(h.at) || !['created', 'edited', 'imported'].includes(h.action) || !text(h.summary)) fail(`Invalid history for ${m.name}.`);
    const c = m.stressStrainCurve;
    if (c != null && (!object(c) || !Array.isArray(c.points) || c.points.length < 2 ||
      !c.points.every(p => object(p) && finite(p.strain) && finite(p.stress)) ||
      !['engineering', 'true', 'unspecified'].includes(c.definition) ||
      !['total', 'plastic', 'unspecified'].includes(c.strainKind) || !text(c.source) || !text(c.notes)))
      fail(`Invalid stress-strain curve for ${m.name}.`);
  }
  // Reject values JSON would silently drop/coerce (undefined, NaN, Infinity).
  const walk = (v) => {
    if (v === null || text(v) || typeof v === 'boolean' || finite(v)) return;
    if (Array.isArray(v)) return v.forEach(walk);
    if (object(v)) return Object.values(v).forEach(walk);
    fail('Database contains a value that cannot be represented as JSON.');
  };
  walk(value);
  return value;
}

/** Order-independent object comparison; array/curve point order remains significant. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return '[' + value.map(canonicalJson).join(',') + ']';
  if (object(value)) return '{' + Object.keys(value).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(value[k])).join(',') + '}';
  return JSON.stringify(value);
}
