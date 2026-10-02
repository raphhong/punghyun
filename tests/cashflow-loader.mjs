import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import ts from 'typescript';
const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, '..');
export function loadSource(relative, mocks = {}) {
  const filename = path.resolve(root, relative);
  const compiled = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const localRequire = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith('@/') || name.startsWith('.')) {
      const base = name.startsWith('@/') ? path.join(root, 'src', name.slice(2)) : path.resolve(path.dirname(filename), name);
      return loadSource([base, `${base}.ts`, `${base}.tsx`].find(p => fs.existsSync(p) && fs.statSync(p).isFile()), mocks);
    }
    return require(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, compiled, compiled.exports);
  return compiled.exports;
}
export const customer = (overrides = {}) => ({ id: 'fixture-1', hospital_name: '가상 A 병원', stage: 'operation', first_payment_date: '2026-01-31', rental_months: 12, rental_price: 1100000, paid_count: 3, execution_amount: 10000000, funding_scheduled_date: '2026-01-10', funding_done: true, funding_done_date: '2026-01-12', ...overrides });
export const profile = (overrides = {}) => ({ customer_id: 'fixture-1', funding_type: 'securitized', creditor_name: '가상 채권사', ...overrides });
export const movement = (overrides = {}) => ({ id: 'm1', customer_id: 'fixture-1', kind: 'creditor_payment', basis: 'planned', cash_date: '2026-02-28', amount: 800000, ...overrides });
