# CandidFan implementation and deployment

## Objective and baseline

Deploy candidfan.com from commit `2ea0e8d975aa816095df6e5645616202c88a12f7` of https://github.com/cmwfx/walkingpov.git. Do not incorporate newer upstream commits. Workspace: `C:\Users\william\Desktop\Projects\WPOV\walkingpov-2ea0e8d`. Credential source: `C:\Users\william\Desktop\Projects\WPOV\.env.local`; never print values or commit secrets.

## Accepted decisions

- Rebrand all active WalkingPOV/VaultTube code, assets, emails and deployment configuration to CandidFan. Preserve original theme, layout and responsive design. Keep the checkout path and upstream Git history.
- Public thumbnail/title catalog; premium/admin downloads only; no player.
- Lifetime premium costs €50; reference €200; existing 75% OFF badge/countdown retained. Giftcard only: https://www.g2a.com/rewarble-visa-gift-card-50-eur-by-rewarble-key-global-i10000502992084 . Remove crypto from UI/API/schema.
- Fresh Supabase project `ghredjydntjlfykgrqqq`; import no old database, users, payments, catalog or scraped JSON data. Preserve configured Auth SMTP.
- Owner manually changes `public.users.is_admin` after registering. No automatic production admin.
- Private text support tickets for all signed-in membership levels. Owner/admin access only; close/reopen support. Admin reply composer has an unchecked email-notification checkbox. No notification for previous replies and no automatic admin alerts. Email contains a generic notice and ticket link.
- Import original regular MP4 videos from `/root/videos` into independent copied files under `/srv/candidfan/media`. No hardlinks, symlinks or serving source paths. Future SFTP uploads use `/srv/candidfan/intake` and admin start/resume controls.
- Titles: filename basename minus extension, replace every hyphen with space; preserve remaining characters. Use one shared temporary 800px-max JPEG placeholder for every imported item until the owner supplies the corresponding thumbnail folder; no video thumbnail extraction, transcoding, contact sheets or AVIF variants.
- Launch successfully processed videos; report opaque IDs/counts of failures. Scheduled backups deferred; retain originals and rollback releases.
- One labeled test email to ADMIN_EMAIL is authorized.

## Privacy invariant

Never expose source filenames or derived real video titles to the agent, logs, traces, screenshots, manifests or diagnostics. Scripts may enumerate/copy/derive titles internally; return counts, bytes, timings, opaque IDs and fixed error codes only. Do not inspect legacy scraped JSON datasets. Use synthetic media/titles for browser and automated testing. Suppress filename-bearing FFmpeg/OS errors and download headers. No shell interpolation of filenames. URLs/storage names use opaque UUIDs. Avoid printing credentials, proof codes or tokens.

## Verified infrastructure and prerequisites

- Storage VPS inspection: Ubuntu 26.04, 1 CPU, ~1.6GiB RAM, ~882GB free, Nginx/Node/FFmpeg/Python installed; Nginx inactive.
- Source aggregate: 532 MP4 files, 113971747307 bytes; exclude 3241 other files. Recheck aggregate at execution time.
- Website VPS rebuilt/replaced (owner confirmed), SSH key differs from known_hosts. Verify via provider console before updating saved key: ed25519 `SHA256:3f0NLnSpa+0JOAWerN68xAY7i2TU0e3BSEETjlmx/po`. Website OS/services/resources not yet verified. Never disable host checking.
- Owner creates DNS-only A `media.candidfan.com` to STORAGE_VPS_IP; verify conflicting AAAA records. Main domain reportedly already points to website VPS. Validate DNS and TLS.
- Existing MCP pointed to project `gpkwlywtxlmyqwxspves` and returned permission error. Replace only Supabase entry, authenticate, reconnect tools, verify target URL before writes:

```powershell
codex mcp add supabase --url "https://mcp.supabase.com/mcp?project_ref=ghredjydntjlfykgrqqq&features=docs%2Caccount%2Cdatabase%2Cdebugging%2Cdevelopment%2Cfunctions%2Cbranching"
codex mcp login supabase
```

OAuth may require browser interaction. Inspect target schema/counts before migrations; stop if unexpected existing data, never reset it. Obtain publishable key, verify supplied SUPABASE_SECRET_KEY belongs to target. Preserve SMTP transport and configure branded Auth templates/site URLs/OTP length.

Credential keys: WEBSITE_VPS_IP/ROOT/PASSWORD, STORAGE_VPS_IP/ROOT/PASSWORD, SUPABASE_SECRET_KEY, SMTP_HOST/PORT/SECURE/USER/PASS/FROM, ADMIN_EMAIL. Generate persistent independent encryption, media signing and importer secrets; don't rotate on redeploy. Frontend gets only target URL/publishable key. Secrets stay in restricted persistent env files outside releases.

## Application/database implementation

Use reviewed versioned fresh migrations, RLS and least-privilege grants. Users read own profiles but cannot update membership/admin fields. Backend handles all privileged operations. Public catalog selects explicit ready-video fields; sensitive media, import and outbox data inaccessible to browser.

Tables: users (auth-linked free/non-admin defaults), videos (public metadata), media_assets (opaque storage metadata), payment_requests (encrypted giftcard proofs), support_tickets/messages, email_outbox, import_jobs/items, audit_logs. Index ownership, status/time, foreign keys and import identities. Secure signup trigger and restricted transaction RPCs with fixed search paths.

Fix shared auth state, same-origin API URL handling and CSRF cookie/header flow. Preserve signup/login/OTP/recovery. Move cross-user admin statistics/payments behind backend authorization.

Payments: giftcard-only validation; AES-256-GCM proof stored only on request; fail closed on invalid key. Atomic pending submission and review; prevent duplicate pending and premium downgrade. POST /api/payments/:id/review changes decision/membership/audit and enqueues email atomically. Derive recipients from trusted records. No arbitrary email-notify route.

Support: /support, /support/:id and admin support route. Owner-only list/read/create/reply; admins read all/reply/close/reopen. Owner can reopen closed tickets. Plain text, subject 160/body 10000 chars, bounded pagination/rate limits. Composer notify_email defaults false. Transactional outbox, bounded retry/backoff and visible state; saved reply survives mail failure. Stable message identifiers; do not claim SMTP exactly-once.

Disable legacy arbitrary remote JSON/URL imports. Replace bulk-upload UI with durable folder import controls in existing theme.

## Media architecture and processing

Website: Nginx frontend + loopback Express API and email worker under systemd. Releases `/var/www/candidfan/releases/<id>`, atomic current symlink, persistent secrets outside releases. Build locally and deploy artifacts, install production dependencies. HTTPS/redirects, SPA routing, correct cache/CSP/proxy/security headers.

Storage: /srv/candidfan/{intake,media,thumbnails,state}; originals stay /root/videos. Nginx public thumbnails; private internal video location. Small loopback Node verifier validates HMAC(key+expiry), then X-Accel-Redirect; Nginx handles bytes/Range/HEAD/attachment. Website checks live membership/readiness then issues 15-minute URL on click. Opaque download filename. Reject missing/expired/tampered/traversal requests. No unprotected alternate route.

Importer uses narrow authenticated internal website API, never Supabase secret. Root-constrained service can read original source without changing its permissions; writable only destination/state. Initial source fixed /root/videos, future source fixed intake. Durable claim/start/status/resume, no arbitrary path input. Detect regular stable MP4s, derive deterministic private identity, independent temporary copy, size/source-stability verification, atomic rename, thumbnail, atomic catalog publication. Resume interrupted stages idempotently. Ignore symlinks. Failures only opaque IDs/codes.

Thumbnail stage uses the shared temporary JPEG placeholder for every item. Keep a JPEG plain-image fallback in existing components. Publish ready items progressively; the later owner-supplied thumbnail folder can replace the public thumbnail URL without touching media files.

## Execution order and acceptance

1. Save plan, branch from baseline, retain unrelated changes.
2. Resolve MCP/OAuth/target verification and website host key; continue independent local work while waiting.
3. Implement migrations/backend/frontend/importer/deployment artifacts and runnable tests (old Jest tests have no installed runner).
4. Validate in isolated database with synthetic users/media; apply reviewed migration through verified target MCP; run advisors; record versions.
5. Verify Auth config, DNS, HTTPS/cert renewal; deploy systemd services, firewall and restricted env; keep API/verifier loopback-only.
6. Benchmark then import; verify API/ready metadata via aggregates, never real titles/screenshots.
7. Send authorized SMTP test; report release/migrations/services/import outcome and owner admin instructions.

Tests: branding/prices; synthetic responsive UI; auth flows; RLS/grants prevent self-promotion and cross-user access; atomic/idempotent payments; encryption key failures; support checkbox/off/on/retries; download membership/signature/expiry/path/Range/HEAD/origin checks; synthetic tricky filenames; import resume/dedup/source preservation; thumbnail failure unpublished; logs sanitized; service restart recovery. Use synthetic tests for privileged flows, no automatic real administrator.

Completion: public HTTPS, core flows, protected downloads, support/outbox and ready catalog verified. Report failed media honestly. Retain prior release for code rollback; never rollback by deleting database/copied/source media. No scheduled backups. Owner registers and manually sets users.is_admin=true. OAuth/DNS/SSH/actual email-receipt dependencies must be reported if unresolved.

## Progress / resume checkpoint

- Planning complete; user explicitly stopped implementation and requested only this document. Do not implement until separately instructed.
- Baseline verified clean before saving this document. Branch `candidfan-migration` was created; `.gitignore` now permits this plan to be tracked.
- Supabase global MCP URL was updated to the requested target. Automatic OAuth registration failed with HTTP 400 due to invalid requested scopes; authentication is NOT complete. On a future authorized run, inspect supported scopes and CLI login options before retrying.
- No application code changes, remote database mutations, media imports or deployments were performed.
- Website host fingerprint verification, target MCP authentication, media DNS and target configuration verification remain pending.

References: https://learn.chatgpt.com/docs/extend/mcp?surface=cli ; https://supabase.com/docs/guides/getting-started/api-keys ; https://supabase.com/docs/guides/auth/auth-email-templates ; https://ffmpeg.org/ffmpeg.html
