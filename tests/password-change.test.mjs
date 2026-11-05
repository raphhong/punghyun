import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync(new URL('../src/lib/account/password.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { changeOwnPassword, requestPasswordNonce } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
function fixture() {
  const calls = [];
  const auth = {
    getUser: async () => ({ data: { user: { id: 'self', email: 'self@example.test' } }, error: null }),
    updateUser: async value => { calls.push(['update', value]); return { error: null }; },
    reauthenticate: async () => { calls.push(['nonce']); return { error: null }; },
  };
  const verification = {
    signInWithPassword: async value => { calls.push(['verify', value]); return { data: { user: { id: 'self' }, session: {} }, error: null }; },
    signOut: async value => { calls.push(['cleanup', value]); return { error: null }; },
  };
  const form = new FormData();
  form.set('currentPassword', 'old password');
  form.set('password', 'a new long password');
  form.set('confirmation', 'a new long password');
  return { auth, verification, calls, form };
}
test('updates only authenticated self, verifies current password, ignores injected identity, cleans temporary session', async () => {
  const f = fixture(); f.form.set('userId', 'victim'); f.form.set('email', 'victim@example.test');
  f.form.set('nonce', '123456');
  const result = await changeOwnPassword(f.form, f.auth, f.verification);
  assert.equal(result.status, 'success');
  assert.deepEqual(f.calls, [['verify', { email: 'self@example.test', password: 'old password' }], ['update', { password: 'a new long password', current_password: 'old password', nonce: '123456' }], ['cleanup', { scope: 'local' }]]);
  assert.ok(!JSON.stringify(result).includes('a new long password'));
});
test('invalid, mismatched, same and oversized passwords cannot call Auth', async () => {
  for (const [key, value] of [['currentPassword', ''], ['password', 'short'], ['confirmation', 'mismatch'], ['password', 'x'.repeat(129)], ['currentPassword', 'a new long password'], ['nonce', 'x'.repeat(129)]]) {
    const f = fixture(); f.form.set(key, value);
    assert.equal((await changeOwnPassword(f.form, f.auth, f.verification)).status, 'error');
    assert.deepEqual(f.calls, []);
  }
});
test('expired or anonymous sessions cannot verify or update', async () => {
  for (const user of [null, { id: 'self', email: 'self@example.test', is_anonymous: true }]) {
    const f = fixture(); f.auth.getUser = async () => ({ data: { user }, error: null });
    assert.equal((await changeOwnPassword(f.form, f.auth, f.verification)).status, 'error');
    assert.ok(f.calls.every(([kind]) => kind === 'cleanup'));
  }
});
test('wrong password and identity mismatch never update original session', async () => {
  for (const reply of [{ error: { code: 'invalid_credentials' } }, { data: { user: { id: 'other' }, session: {} }, error: null }]) {
    const f = fixture(); f.verification.signInWithPassword = async () => reply;
    assert.equal((await changeOwnPassword(f.form, f.auth, f.verification)).status, 'error');
    assert.deepEqual(f.calls, [['cleanup', { scope: 'local' }]]);
  }
});
test('handles nonce, policy, rate-limit, and unknown errors without leaking provider data', async () => {
  for (const code of ['reauthentication_needed', 'reauthentication_not_valid', 'weak_password', 'over_request_rate_limit', 'session_not_found', 'unknown']) {
    const f = fixture(); f.auth.updateUser = async () => ({ error: { code, message: 'SECRET PROVIDER DATA' } });
    const result = await changeOwnPassword(f.form, f.auth, f.verification);
    assert.equal(result.status, code.startsWith('reauthentication') ? 'reauthentication' : 'error');
    assert.ok(!JSON.stringify(result).includes('SECRET'));
    assert.deepEqual(f.calls.at(-1), ['cleanup', { scope: 'local' }]);
  }
});
test('transport exceptions still clean temporary session and cleanup failure does not misreport successful update', async () => {
  const f = fixture(); f.auth.updateUser = async () => { throw Error('secret'); };
  assert.equal((await changeOwnPassword(f.form, f.auth, f.verification)).status, 'error');
  assert.deepEqual(f.calls.at(-1), ['cleanup', { scope: 'local' }]);
  const success = fixture(); success.verification.signOut = async () => { throw Error('secret'); };
  assert.equal((await changeOwnPassword(success.form, success.auth, success.verification)).status, 'success');
});
test('nonce requires authenticated user and handles delivery failure', async () => {
  const f = fixture();
  assert.equal((await requestPasswordNonce(f.auth)).status, 'reauthentication');
  assert.deepEqual(f.calls, [['nonce']]);
  f.auth.getUser = async () => ({ data: { user: null }, error: null });
  assert.equal((await requestPasswordNonce(f.auth)).status, 'error');
  assert.equal(f.calls.length, 1);
  const failed = fixture(); failed.auth.reauthenticate = async () => ({ error: { code: 'over_email_send_rate_limit' } });
  assert.equal((await requestPasswordNonce(failed.auth)).status, 'error');
});
