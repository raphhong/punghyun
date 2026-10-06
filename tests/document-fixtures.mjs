import { loadSource } from './cashflow-loader.mjs';
export { loadSource };
export const CUSTOMER = '11111111-1111-4111-8111-111111111111';
export const OTHER = '22222222-2222-4222-8222-222222222222';
export const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const PDF = new Blob(['%PDF-1.7\nfixture only'], { type: 'application/pdf' });
export function fakeDb(options = {}) {
  const rows = {
    customer_documents: structuredClone(options.legacy ?? []),
    customer_document_attachments: structuredClone(options.attachments ?? []),
    customers: options.customers ?? [{ id: CUSTOMER, hospital_name: '가상 고객', share_token: 'fixture-token', share_token_expires_at: options.expiry ?? null }],
    admins: options.admin === false ? [] : [{ user_id: 'admin-a' }],
    customer_devices: [],
  };
  const files = new Map();
  const calls = [];
  const errors = new Map();
  const db = {
    rows, files, calls, errors,
    auth: { getClaims: async () => ({ data: { claims: options.authenticated === false ? null : { sub: 'admin-a' } }, error: options.authError ?? null }) },
    from(table) {
      const filters = []; let operation = 'select'; let payload; let settings; let single = false; let limit = Infinity; let offset = 0;
      const builder = {
        select() { return builder; }, eq(k, v) { filters.push(r => r[k] === v); return builder; },
        is(k, v) { filters.push(r => (r[k] ?? null) === v); return builder; },
        in(k, v) { filters.push(r => v.includes(r[k])); return builder; },
        not(k, _, v) { filters.push(r => r[k] !== v); return builder; },
        order() { return builder; }, range(start, end) { offset = start; limit = end - start + 1; return builder; }, limit(n) { limit = n; return builder; },
        upsert(p, s) { operation = 'upsert'; payload = p; settings = s; return builder; },
        update(p) { operation = 'update'; payload = p; return builder; },
        delete() { operation = 'delete'; return builder; },
        maybeSingle() { single = true; return builder; }, single() { single = true; return builder; },
        then(resolve, reject) {
          calls.push({ table, operation, payload, settings });
          if (errors.has(`${table}:${operation}`)) return Promise.resolve({ data: null, error: errors.get(`${table}:${operation}`) }).then(resolve, reject);
          if (options.missingAttachments && table === 'customer_document_attachments') return Promise.resolve({ data: null, error: { code: 'PGRST205' } }).then(resolve, reject);
          let selected = (rows[table] ?? []).filter(r => filters.every(f => f(r))).slice(offset, offset + limit);
          if (operation === 'upsert') {
            const existing = rows[table].find(r => r.id === payload.id);
            if (!existing) rows[table].push({ deleted_at: null, uploaded_at: null, created_at: '2026-10-02T00:00:00Z', updated_at: '2026-10-02T00:00:00Z', ...payload });
          } else if (operation === 'update') selected.forEach(r => Object.assign(r, payload));
          else if (operation === 'delete') rows[table] = rows[table].filter(r => !selected.includes(r));
          return Promise.resolve({ data: single ? selected[0] ?? null : selected, error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
    storage: { from(bucket) {
      if (bucket !== 'customer-docs') throw Error('wrong bucket');
      return {
        createSignedUploadUrl: async (path, settings) => {
          calls.push({ sign: path, settings });
          if (options.signError) return { data: null, error: { message: 'sign failed' } };
          return { data: { path, token: 'synthetic-token' }, error: null };
        },
        createSignedUrls: async paths => ({ data: paths.map(path => ({ path, signedUrl: `https://storage.example.test/${path}?token=fixture` })), error: null }),
        info: async path => {
          const file = files.get(path);
          return file ? { data: { size: file.size, contentType: file.type, etag: 'fixture-etag', version: 'fixture-version', ...(options.infoOverride ?? {}) }, error: null } : { data: null, error: { message: 'missing' } };
        },
        download: async path => ({ data: files.get(path) ?? null, error: files.has(path) ? null : { message: 'missing' } }),
        remove: async () => { throw Error('No physical deletion is allowed in attachment tests'); },
      };
    } },
  };
  return db;
}
export function server() { return loadSource('src/lib/documents/server.ts', { 'server-only': {} }); }
