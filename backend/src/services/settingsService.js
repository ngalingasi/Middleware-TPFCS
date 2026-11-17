// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Settings service: saved value, then .env, then default
// └──────────────────────────────────────────────────────────────────────────┘

const db = require('../config/database');
const { FIELDS, GROUPS, byKey, validate } = require('../utils/settingsRegistry');

const REFRESH_MS = 30 * 1000;

let saved = new Map();

function fromEnv(field) {
  for (const name of field.env || []) {
    if (process.env[name]) return process.env[name];
  }
  return '';
}

function resolve(field) {
  const own = saved.get(field.key);
  if (own) return { value: own, source: 'database' };
  const env = fromEnv(field);
  if (env) return { value: env, source: 'env' };
  if (field.default !== undefined) return { value: field.default, source: 'default' };
  return { value: '', source: 'unset' };
}

// Synchronous on purpose: GePG requests and printing read settings in many
// places. Before load() runs (scripts, tests) this just falls back to .env.
function get(key) {
  const field = byKey[key];
  if (!field) throw new Error(`Unknown setting: ${key}`);
  return resolve(field).value;
}

async function load() {
  const [rows] = await db.query(
    'SELECT config_key, config_value FROM system_config WHERE config_key IN (?)',
    [FIELDS.map((f) => f.key)]
  );
  saved = new Map(rows.map((r) => [r.config_key, r.config_value]));
}

// Other server instances pick up changes within REFRESH_MS.
function startAutoRefresh() {
  const timer = setInterval(() => load().catch((e) => console.error('Settings refresh failed:', e.message)), REFRESH_MS);
  timer.unref();
}

function describe(field) {
  const { value, source } = resolve(field);
  return {
    key: field.key,
    label: field.label,
    abbr: field.abbr,
    meaning: field.meaning,
    example: field.example,
    providedBy: field.providedBy,
    input: field.input,
    options: field.options,
    max: field.max,
    hint: field.hint,
    critical: !!field.critical,
    affects: field.affects,
    value,
    source,
    savedValue: saved.get(field.key) || '',
    envValue: fromEnv(field)
  };
}

function getAll() {
  return GROUPS.map((group) => ({
    id: group.id,
    title: group.title,
    description: group.description,
    critical: !!group.critical,
    fields: FIELDS.filter((f) => f.group === group.id).map(describe)
  }));
}

/**
 * Saves several settings at once. Everything is validated first, so one bad
 * value saves nothing. A blank value clears the saved one (back to .env).
 * Returns the list of real changes: [{ key, label, from, to }].
 */
async function update(values) {
  const errors = {};
  const cleaned = {};

  for (const [key, raw] of Object.entries(values || {})) {
    const field = byKey[key];
    if (!field) {
      errors[key] = 'Unknown setting';
      continue;
    }
    const result = validate(field, raw);
    if (result.error) errors[key] = result.error;
    else cleaned[key] = result.value;
  }

  if (Object.keys(errors).length > 0) {
    const error = new Error('Some values are not valid');
    error.status = 400;
    error.fieldErrors = errors;
    throw error;
  }

  const changes = [];
  for (const [key, value] of Object.entries(cleaned)) {
    const field = byKey[key];
    const before = saved.get(key) || '';
    if (before === value) continue;

    const from = resolve(field).value;
    if (value === '') {
      await db.query('DELETE FROM system_config WHERE config_key = ?', [key]);
    } else {
      await db.query(
        `INSERT INTO system_config (config_key, config_value, description) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE config_value = VALUES(config_value)`,
        [key, value, field.label]
      );
    }
    saved.set(key, value);
    if (value === '') saved.delete(key);
    changes.push({ key, label: field.label, from, to: resolve(field).value });
  }

  await load();
  return changes;
}

module.exports = { get, load, startAutoRefresh, getAll, update };
