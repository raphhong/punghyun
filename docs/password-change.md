# Self-service password change

Initially implemented and tested against repository HEAD `076f5acc27bc88cfa7d243c3db73811977e86bf8`. For release, applied cleanly to the current production commit `b8a0a29667529221dec20cd4dbf582d42d52b955`, preserving all intervening production features. The verification results below refer to the initial implementation unless stated otherwise.

- Admin: `/ph-console-8f27x/account/password`, under **내 계정 → 비밀번호 변경** in desktop/mobile navigation.
- Approved sales agents: `/sales/account/password`, linked in the portal header. Existing pending/rejected-account access rules are unchanged.
- Enter current password, a new 12–128 character password, and confirmation. On deployments requiring reauthentication, request the email/phone nonce and re-enter passwords with the code.

## Security review

Server actions obtain identity from the cookie-backed Supabase client and validate it with `getUser()`. They accept no target ID, email, or token. Next.js Server Action Origin/Host checks remain enabled. Validation also runs on the server. No service-role client, profile/role updates, database migrations, or `resetAgent` calls are involved.

Current-password checking in Supabase's `updateUser` is configuration-dependent. To avoid changing production settings, the action verifies the current password using a separate non-persistent anon-key client, checks the returned identity, then updates through the **original** session. This preserves original MFA assurance and secure-password-change nonce requirements. Only the verification client's temporary session is signed out (`scope: local`) in `finally`; cleanup is best effort if the Auth service is unavailable. No additional session is installed in browser cookies. Provider policies (including MFA, password strength, CAPTCHA, and rate limits) are not bypassed. A provider configuration that requires a login CAPTCHA may require a future CAPTCHA UI integration.

Password values are masked in the form, cleared after every change attempt, and never put into URLs, local storage, logs, React state, or returned action state. Unknown provider diagnostics are replaced with fixed messages. A network interruption during update is reported as uncertain rather than asserting that no change occurred. Supabase controls session invalidation on password update; the feature does not claim instant invalidation of already-issued JWTs or explicitly sign out all sessions.

## Verification

- `node --test tests/password-change.test.mjs tests/password-ui.test.mjs`: 9 passed.
- `npx tsc --noEmit`: passed.
- Targeted ESLint for changed TypeScript files: passed.
- `npm run build`: passed; routes present. Existing middleware deprecation warning and blocked external OpenGraph font fetch warning remain.
- Full suite: 212 tests, 209 passed, 3 failed. All three reproduced on an untouched HEAD archive: the PDF/PNG gallery cases in `purchase-intent.test.mjs`, and the sales-detail loader case in `sales-other-documents.test.cjs` (looks for `ProductShare.ts`, while the component is `.tsx`).
- Local production server: anonymous GET to each password page returned 307 to its corresponding login.
- No live password changes, email/phone nonce deliveries, user creation, production configuration changes, or deployments were performed. Auth operations in the new tests are mocked; real authenticated browser end-to-end behavior remains to be verified with an authorized non-production account.

## Release steps

Production deployment was approved by the user; real-account password testing was explicitly skipped. Release from the production-based feature branch. No new environment variables, schema changes, or authentication settings are required. In a staging environment with an authorized test account, verify both portals: incorrect current password; matching new password; old-session nonce delivery/expiry/retry; new-password login; old-password rejection; mobile navigation and keyboard interaction. Check existing Auth delivery/CAPTCHA/session policies before rollout. Do not test by changing an existing customer's password.

References consulted: Supabase [password authentication](https://supabase.com/docs/guides/auth/passwords), [password security](https://supabase.com/docs/guides/auth/password-security), [updateUser](https://supabase.com/docs/reference/javascript/auth-updateuser), [reauthenticate](https://supabase.com/docs/reference/javascript/auth-reauthenticate), installed auth-js types, and upstream Auth `internal/api/user.go` implementation. The changelog Markdown endpoint was requested but the web reader could not parse its content type.
