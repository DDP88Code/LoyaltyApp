# Fives Rewards: Capacitor native-readiness audit (read-only)

Baseline: branch `main`, HEAD `4912dcb`. The working tree was clean before the audit and is clean after it. The only commands run were read-only checks (git status, file reads, tool-version checks, docs lookups).

---

## 1. Executive recommendation

- **Capacitor is a good fit, with one shared codebase.** The frontend is already well prepared:
  - Every API call goes through one function, `apiFetch`, which already reads `VITE_API_BASE_URL`.
  - `authClient` and the media URL helpers read the same variable.
  - Notification links are relative router paths.
  - Staff QR scanning already sits behind a `ScannerService` interface.
- **Native sign-in will not work today.** The blockers are almost all on the backend:
  1. There is no CORS handling on `/api/*`.
  2. Better Auth `trustedOrigins` only contains the request origin.
  3. The session cookie is `SameSite=Lax`, so a native app on a different site never sends it.
  4. Turnstile only accepts the `fivessportsbar.app` hostname.
  5. Hono `secureHeaders()` sends `Cross-Origin-Resource-Policy: same-origin`, which blocks menu and promotion images from loading in the app.
  6. The password-reset `redirectTo` is built from `window.location.origin`.
- **Recommended setup:**
  - Native app ships its own bundled build (`dist-native`), with `VITE_API_BASE_URL=https://fivessportsbar.app`.
  - Native sign-in uses Better Auth's `bearer()` plugin, with the token kept in the phone's secure storage (Android Keystore / iOS Keychain).
  - CORS allows only the exact native origins.
  - The app's WebView uses a hostname Dean owns, such as `app.fivessportsbar.app`, so Turnstile still works without a bypass.
  - The web/PWA keeps HttpOnly cookies and behaves exactly as now.
- **Push notifications:** Android internal testing can ship without native push. Native push through Firebase Cloud Messaging (FCM) should be in place before the public release.
- **Staff and Admin:** stay browser-only. The native app shows a "please use the web portal" screen to those roles.
- **Two problems already in the repo, separate from Capacitor:**
  - The top-level Wrangler environment (the one `npm run deploy` uses) points at the production D1 and R2 with `APP_ENV=development`.
  - TypeScript 7.0.2 lacks the API the Capacitor CLI uses to read `capacitor.config.ts`, so use `capacitor.config.json` instead.

---

## 2. Current architecture found

| Item | Finding |
|---|---|
| Entry point | `index.html` (has `viewport-fit=cover`) → `main.tsx` → `RouterProvider` + `AppProviders` |
| Router | `createBrowserRouter` in `router.tsx`. Public routes: `/`, `/terms`, `/privacy`. Signed-out only: `/login`, `/register`, `/forgot-password`, `/reset-password`. Customer: `/app/*`. Staff/admin/owner: `/staff`. Admin/owner: `/admin/*` |
| Role routing | `ROLE_HOME` in `roles.ts` plus `RequireAuth`, `RequireRole` and `RedirectIfSignedIn` in `guards.tsx`. The Worker re-checks roles on every request |
| Build | `@cloudflare/vite-plugin` writes `client` (web assets) and `fives_rewards` (Worker) |
| PWA | `VitePWA` in injectManifest mode with `sw.js`, `registerType: autoUpdate`, dev SW disabled (`vite.config.ts:14-51`) |
| API client | `api.ts`: `BASE_URL = VITE_API_BASE_URL ?? ""` and `credentials: "include"`. About 90 call sites, all through `apiFetch` |
| Auth client | `authClient.ts`: `baseURL: VITE_API_BASE_URL \|\| window.location.origin`, `basePath: "/api/auth"` |
| Environment variables | `.env.example` has `VITE_API_BASE_URL` (empty means same origin) and `VITE_TURNSTILE_SITE_KEY`. `.gitignore` ignores `.env.*` |
| Backend | Hono in `index.ts`: `/api/auth/*` (Turnstile gate, then Better Auth), plus health, me, customer, staff, admin, media and dev routers. Everything else falls through to the SPA via `ASSETS` |
| Assets | `wrangler.jsonc:8-12`: `run_worker_first: ["/api/*"]` and SPA not-found handling |
| Deploy | `deploy:prod` = `build:prod` (`CLOUDFLARE_ENV=production`) then `wrangler deploy --env production` |
| Origin assumptions | Same origin everywhere. Better Auth `baseURL` comes from the request URL (`session.ts`) |

**Can stay unchanged for Capacitor:** all feature API modules, TanStack Query, React Hook Form/Zod, React Router, the Worker's business routes, D1, R2, cron jobs, provisioning, and the loyalty, points and campaign logic.

---

## 3. Capacitor compatibility verdict

**Compatible, with Capacitor 8.x** (the current major version).

- **Capacitor 8 requirements:**
  - Node 22+ (Dean has 22.17.1, which is fine).
  - Android Studio 2025.2.1 (Otter) or newer.
  - Android `minSdk` 24, `compileSdk`/`targetSdk` 36.
  - iOS 15+ and Xcode 26.
- **No library conflicts:** React 19, React Router 7, TanStack, React Hook Form, Zod, lucide and `react-qr-code` are all plain web code. Capacitor's local server returns `index.html` for paths without a file extension, so `createBrowserRouter` works.
- **Caveats found in this repo:**
  - **TypeScript 7.0.2:** I checked that `require('typescript').transpileModule` is `undefined`. The Capacitor CLI uses that to load `capacitor.config.ts`, so use **`capacitor.config.json`** instead. Confirm when Capacitor is first set up.
  - **Tailwind 4.3** needs Chromium 111+ / Safari 16.4+, and `index.css` uses `color-mix`. Set `android.minWebViewVersion: 111` (Capacitor's default is 60) and an iOS deployment target of at least 16.4.
  - **Build plugins:** `@cloudflare/vite-plugin` and `VitePWA` shouldn't be part of the native build. Use a separate `vite.native.config.ts`.
- **`webDir`:** use a new **`dist-native`** folder, not `client`. If the native build wrote into `client`, a bare `wrangler deploy` could publish the native bundle (with the absolute API URL and no service worker) to production web.
- **App ID:** `app.fivessportsbar.rewards` (see section 28; needs Dean's approval).
- **Display name:** store listing `Fives Sports Bar Rewards` (`BRAND.rewardsName`). The launcher label is Dean's choice (see section 37).

---

## 4. Green / Amber / Red summary

| Area | Status | Reason |
|---|---|---|
| API base URL abstraction | GREEN | Already driven by an environment variable |
| Sign-in / sign-up / session | RED | No CORS, `trustedOrigins` too narrow, cross-site cookie |
| Turnstile | RED | Hostname is locked to `fivessportsbar.app` |
| Password reset | RED (small fix) | `redirectTo` uses `window.location.origin` |
| Menu and promotion images | RED (small fix) | `Cross-Origin-Resource-Policy: same-origin` header |
| Loyalty, points, campaigns, rewards, QR | GREEN | Pure API calls and SVG |
| Service worker / PWA | AMBER | Must not register in native |
| Web Push | RED (new work) | Not supported in WebViews |
| Safe areas / back button / keyboard | AMBER | CSS and back-button handling |
| Staff/Admin in native | AMBER | Needs a redirect-to-web screen |
| Deep links | AMBER | New verification files and config |
| Tooling | AMBER | Android SDK/Studio not installed |
| Staging | AMBER | The top-level Wrangler environment points at production data |

---

## 5. API-base findings

**Where URLs are built today:**

| Location | Behaviour |
|---|---|
| `apiFetch` (`api.ts:3`) | Prefixes `BASE_URL`. Works in native once the variable is set |
| `authClient` (`authClient.ts`) | Uses `VITE_API_BASE_URL`. Works |
| `media.ts` | Builds `${BASE_URL}/api/media/...`. Works once the header issue in section 14 is fixed |
| `useSession.ts:186` | `redirectTo: ${window.location.origin}/reset-password`. **Breaks in native** |
| `ProfilePage.tsx:337-343` | `<a href="/terms">` and `/privacy` cause a full reload. Should be `<Link>` |
| `sw.js:84-88` | Relative `fetch("/api/...")`. Web only, fine |
| `notifications.actionUrl` | Relative (`/app/rewards`, `/app/notifications`), rendered with `<Link>`. Correct |
| Downloads/exports | None in the customer UI. Admin uploads use FormData and stay web-only |

**Important:** `VITE_API_BASE_URL` is an **origin**. Paths already start with `/api/...`, so the native value must be `https://fivessportsbar.app`, **not** `https://fivessportsbar.app/api` (that would produce `/api/api/...`).

**Smallest clean abstraction (not implemented):**
- Add `src/lib/platform.ts` exporting:
  - `IS_NATIVE`, set at build time via `VITE_APP_TARGET=native`.
  - `WEB_ORIGIN` (= `BRAND.website`).
- Build with `vite build --mode native` and `.env.native`. Either add `!.env.native` to `.gitignore` (the values are public) or set the variables in the npm script.
- Web keeps an empty `VITE_API_BASE_URL`, so nothing changes for the PWA.

---

## 6. Better Auth findings

`index.ts`:
- One instance is cached per request origin.
- `baseURL` is derived from the request; `trustedOrigins: [baseURL]` (`index.ts:25-26`).
- Email and password, minimum length 10, no email verification.
- Reset emails are sent through the `EMAIL` binding.
- Sessions last 30 days and refresh daily.
- `useSecureCookies` is on outside development (`index.ts:55`).
- No plugins.

`requireSession` calls `auth.api.getSession({ headers })` (`auth.ts:17-18`), so a bearer token would work for every `/api` route without touching the routes.

**Answers to your questions:**
- **Will login work unchanged?** No.
- **Is the native origin rejected?** Yes. The default native origins are `https://localhost` (Android) and `capacitor://localhost` (iOS). Better Auth checks the `Origin` header on sign-in and sign-up even without cookies, and also checks `redirectTo`.
- **Do `trustedOrigins` need additions?** Yes. Add the exact native origins from an environment variable, ideally a hostname Dean owns rather than `localhost`. Better Auth's docs warn against trusting localhost in production.
- **Is a native/mobile capability needed?** Yes. The `bearer()` plugin (it adds no database tables) is the officially supported route for clients that can't use cookies.
- **Token storage:** Android Keystore / iOS Keychain through a maintained secure-storage plugin for Capacitor 8. Never `localStorage`, and not `@capacitor/preferences` (it isn't encrypted).
- **Logout:** call `authClient.signOut()` (revokes the session on the server), then delete the stored token.
- **Session expiry:** the same 30 days with daily refresh. If `/api/me` returns `unauthenticated`, clear the token and go to `/login`.
- **Account deletion:** already deletes the auth user, so the session is invalidated. The client then clears the token.

---

## 7. Cookie/session findings

- The session cookie is HttpOnly, Secure, `SameSite=Lax` (Better Auth default) and host-only for `fivessportsbar.app`.
- From a native origin the request is cross-site:
  - Lax cookies aren't sent on cross-site `fetch`.
  - Android WebView blocks third-party cookies by default.
  - iOS (ITP) also blocks them.
- **Result today:** sign-in returns 200, then `/api/me` returns `unauthenticated`, and the app bounces back to `/login`.

**Options:**

| Option | Verdict |
|---|---|
| A. Cookies with `SameSite=None` | Reject. Weakens web CSRF protection and still fails on iOS |
| B. CapacitorHttp (replaces `fetch` globally) | Not recommended. Global patching has edge cases (FormData, headers) and is hard to reason about |
| **C. Better Auth bearer token in secure storage** | **Recommended.** One model for Android and iOS, doesn't depend on WebView cookie policy, native uses `credentials: "omit"` |
| D. Android-only same-site cookies via `server.hostname=app.fivessportsbar.app` | Workable on Android only, because `capacitor://` on iOS is cross-site. Fallback |

Cookie auth stays the right choice for web/PWA.

---

## 8. CORS / trusted-origin findings

- There is **no CORS middleware anywhere**.
- Native requests send `Content-Type: application/json`, `Authorization` and `cf-turnstile-response`, so the browser sends a preflight `OPTIONS` request first. Today that request goes into Better Auth (for `/api/auth/*`) or into the `not_found` catch-all.
- **Needed:**
  - `hono/cors` on the `api` router, mounted **before** `/auth/*`.
  - An exact allowlist from an environment variable (for example `NATIVE_APP_ORIGINS`).
  - Allowed headers: `Content-Type, Authorization, cf-turnstile-response, Accept`.
  - Exposed header: `set-auth-token`. `credentials: false`.
- **Strip `set-auth-token`** from responses whose `Origin` isn't a native origin. Otherwise the web app's JavaScript could read session tokens that are currently protected by HttpOnly.
- Never use `*`, never echo back arbitrary origins, and never set `disableCSRFCheck` or `disableOriginCheck`.

---

## 9. Turnstile findings

- **Client:** `TurnstileWidget.tsx` on `/login`, `/register` and `/forgot-password`. The token is sent in the `cf-turnstile-response` header.
- **Server:** `turnstile.ts:3-5` gates POST requests to `sign-in/email`, `sign-up/email` and `request-password-reset`.
  - Enforced only when `APP_ENV=production` and the secret is set.
  - Checks the action, checks the hostname is in `["fivessportsbar.app"]`, and blocks token replay.
  - Your repo notes mention a workers.dev hostname; the code is the source of truth.
- **In native:** Turnstile runs in a WebView. However, widget hostnames must be fully qualified domains, so a `localhost` origin fails with error 110200 (already seen locally). The server's hostname check would fail too. Result: **nobody can sign in, register or request a reset in native.**

**Options:**
1. **Recommended:** set Capacitor `server.hostname` to a Fives-owned subdomain that is never served, for example `app.fivessportsbar.app`.
   - Turnstile automatically allows subdomains of an authorised hostname.
   - The server adds that hostname to its expected list.
   - Same protection, no bypass. Works on Android; iOS (`capacitor://` scheme) needs testing.
2. Optionally use a separate "native" widget and secret, for separate analytics and the ability to switch it off independently.
3. Run the challenge in an external browser and return via an App Link. Complex; keep as the iOS fallback.
4. Play Integrity / App Attest. Strongest, but a later addition, not a replacement.
5. Skip Turnstile for "trusted native" traffic. **Rejected:** headers can be forged and the app binary is public.

---

## 10. Password reset / deep-link findings

**Current flow:**
- `requestPasswordReset({ redirectTo })` → Better Auth emails `https://fivessportsbar.app/api/auth/reset-password/<token>?callbackURL=...`.
- The Worker validates the token and redirects (302) to `/reset-password?token=...`.
- ResetPasswordPage calls `resetPassword`.
- `password-reset-link-smoke.mjs` covers this flow.

**In native:** `redirectTo` becomes `https://localhost/reset-password`, which Better Auth rejects as untrusted.

- **Phase 1 fix:** in native, use `${WEB_ORIGIN}/reset-password` for `redirectTo`. The reset completes in the browser, then the user signs in in the app. Safe and simple.
- **Later, for deep links:** the email's first stop is a server redirect, and Android doesn't reliably hand redirected navigations to apps. Instead, build the email link as `https://fivessportsbar.app/reset-password?token=<token>`, using the `token` value Better Auth passes to `sendResetPassword`. Then update the smoke test.
- **Paths to deep-link:** `/reset-password` and `/app/*` (`/app`, `/app/rewards`, `/app/notifications`, `/app/fives-code`, `/app/menu`, `/app/profile`).
- **Exclude:** `/api/*`, `/staff`, `/admin/*`, `/terms`, `/privacy`. `/` is Dean's decision.

---

## 11. QR findings

- FivesCodePage calls `POST /api/customer/loyalty-code` and gets back `{otp, qrToken, expiresAt}`. The QR code is an SVG from `react-qr-code`, with a timer countdown.
- On the server the code is HMAC-hashed, single-use, expires after `loyalty_code_ttl_seconds` (600), and generating a new code invalidates the old one.
- It uses no browser-only APIs, so it **works unchanged** once auth works. Staff resolution doesn't care whether the customer uses PWA or native. No second QR system is needed.
- No customer-side camera feature exists. The camera is only used by staff via `qr-scanner` in `browserQrScanner.ts`, which stays on the web.
- Optional polish: keep the screen awake and boost brightness on the Fives Code page.

---

## 12. Push notification findings

**Current flow:**
- The Profile "Web push notifications" card and `MarketingOptInModal` call `ensureBrowserPushSubscription` (service worker, PushManager, VAPID keys).
- The subscription is saved to `POST /api/customer/push/subscriptions` (`deviceLabel: "PWA"`) in the `push_subscriptions` table (`notifications.ts:46-72`).
- `createNotificationService` writes a `notifications` row, then `deliverPushIfEligible` sends the push. It respects the opt-in preferences, deactivates subscriptions that no longer exist, and sets `pushSentAt`.

**In native:** Android System WebView and iOS WKWebView-in-app don't support the Push API. `supportsWebPush()` returns false, so the card says "This browser does not support…". That card must be hidden or replaced in native.

**Future native push:**
- `@capacitor/push-notifications`, with FCM HTTP v1 as the single provider for both platforms (APNs through FCM). Confirm that FCM's service-account signing works from a Worker.
- Add a new `native_push_tokens` table (`customerId`, `businessId`, `platform`, `token` (unique), `appVersion`, `active`, `lastSeenAt`), because the Web Push columns are `NOT NULL`.
- Add an FCM `PushProvider`; `deliverPushIfEligible` sends to both kinds of subscription.
- **Reusable as-is:** the `notifications` table, `pushSentAt`, `canSendPush` preferences and relative `actionUrl`s.
- Account deletion must also delete native tokens.
- Android 13+ needs the `POST_NOTIFICATIONS` runtime permission.

**Recommendation:** Phase 1 internal testing without push (the in-app notification centre still works). Native push should ship **before the public release**, because promotion broadcasts and reward-expiry reminders depend on it.

---

## 13. Service-worker / PWA findings

**Current setup:**
- Precaches `**/*.{js,css,html,svg,png,woff2}`.
- SPA navigation route (excluding `/api`).
- CacheFirst caches `fives-menu-images` (300 entries) and `fives-promotion-images` (120 entries), each kept up to 180 days, for **same-origin** media only (`sw.js:24-58`).
- Checks for updates every 60 seconds and updates itself automatically.
- The Worker sends `no-store` for HTML, `sw.js` and the manifest.

**What happens in native:**
- **Android** WebView would register the service worker. That duplicates the bundled files, and after a store update the old worker can serve the old bundle until it refreshes. The media cache rules check `url.origin === self.location.origin`, so they never match in native and give no benefit.
- **iOS** WKWebView only allows service workers with App-Bound Domains, so registration silently does nothing.

| Target | Recommendation |
|---|---|
| WEB | Leave everything as it is |
| ANDROID | Don't register (gate `main.tsx:10-22` on `IS_NATIVE`; the native Vite config leaves out VitePWA). Media uses the normal WebView HTTP cache. The existing `public, max-age=31536000, immutable` headers and UUID keys are enough |
| iOS | Same as Android |

---

## 14. Media / R2 findings

- **Customer images:** `/api/media/public/menu` and `/promotions`. Public, keys validated by shape, cached as immutable ([media.ts route](worker/routes/media.ts#L20-L50), `media.ts:10-13`). URLs are absolute in native.
- **Admin images:** `/api/media/object` requires a session cookie. Admin only, web only. Fine.
- **Blocker:** `app.use("*", secureHeaders())` (`index.ts:60`) sends `Cross-Origin-Resource-Policy: same-origin` (default confirmed in `node_modules/hono/.../secure-headers.js`). Browsers block cross-origin `<img>` loads under that header.
- **Fix:** send `cross-origin` for those two public routes only. Hono's `secureHeaders` writes its headers after the route runs, so the override has to run after it. Confirm with a smoke test.
- Uploads stay in the web Admin portal.

---

## 15. Customer feature compatibility matrix

| Feature | Status | Notes |
|---|---|---|
| Sign up / Login | RED | Auth, CORS and Turnstile (sections 6–9) |
| Home | AMBER | Promotion images blocked by the CORP header |
| Coffee Loyalty | GREEN | |
| Reward Points / Catalogue / claiming | GREEN | `crypto.randomUUID` works on the https origin; iOS should be checked |
| Item Campaigns | GREEN | |
| Available Rewards / history | GREEN | Native `<dialog>` works |
| Promotions | AMBER | CORP header |
| Menu | AMBER | CORP header. The item sheet (`MenuPage.tsx:464`) ignores the back button and has no bottom safe-area padding |
| Notifications list | GREEN | Relative `<Link>`s |
| Push | RED | Native push is new work |
| Profile | AMBER | Web-push card must be hidden; legal links should be `<Link>` |
| Password change | GREEN | Once bearer auth is in place |
| Password reset | AMBER | `redirectTo` fix (section 10) |
| Account deletion | GREEN | Also clear the stored token |
| Show My Fives Code | GREEN | |
| Navigation | AMBER | Safe areas and back button |
| Install prompt | AMBER | On iOS native, `PwaInstallPrompt.tsx:94-108` would show "Add to Home Screen". Hide it in native |
| External links | AMBER | Section 22 |
| Landing `/` | AMBER | Native should go straight to `/login` or `/app` |

---

## 16. Staff/Admin strategy

**Recommend B with a friendly message.** In the native build only the `customer` role is allowed.

- When a staff, admin or owner signs in natively, show a "Staff & Admin use the web portal" screen with:
  - "Open in browser", opening `https://fivessportsbar.app/login` externally.
  - "Sign out".
- Build it with a native-only override of `ROLE_HOME` and `RequireRole`. No duplicated screens.
- **Why:** the scanner needs camera-permission plumbing, admin is desktop-first and handles uploads, and it reduces what app reviewers see. The server already enforces roles, so this is only a UX gate.

---

## 17. Domain strategy

- `fivessportsbar.app` stays as:
  - the API host (`/api/*`),
  - the web/PWA fallback,
  - the Staff/Admin login (`/login` sends each role to its home),
  - the deep-link domain (`/.well-known`),
  - the install landing page (`/`).
- **Difficulty: low.** LandingPage is already a simple hub. Adding store badges (by platform), "Continue on web" and "Staff / Admin login" is a small change on one page with no routing changes. Hide it in native.
- The **printed QR to `https://fivessportsbar.app` can stay permanently**. Keep `/` as a real page, never a redirect. If App Links later include `/`, Android users who have the app will open it straight from the printed QR.
- If the native hostname is adopted, reserve it (for example `app.fivessportsbar.app`) and never host anything there.

---

## 18. Android App Links plan

- Add `public/.well-known/assetlinks.json`. It gets copied to `client` and served as a static asset (it isn't covered by `run_worker_first`).
  - Confirm it returns 200 with `application/json` and no redirect.
- Contents:
  - `package_name: app.fivessportsbar.rewards`.
  - SHA-256 fingerprints of the **Play App Signing key** (from Play Console), the upload key and the debug key.
- AndroidManifest: an `intent-filter` with `android:autoVerify="true"` for `https://fivessportsbar.app`, covering `/app` and `/reset-password`.
- Handle `@capacitor/app` `appUrlOpen` by checking the host and path against an allowlist, then calling `router.navigate`.
- Add `/.well-known/` to the service worker's `denylist`.
- Fallback: if the app isn't installed, the normal web page opens.
- Make sure no WAF rule challenges `/.well-known/*`.

## 19. iOS Universal Links plan

- Add `public/.well-known/apple-app-site-association` (no file extension) with:
  - `appIDs: ["<TEAMID>.app.fivessportsbar.rewards"]`
  - components for `/app/*` and `/reset-password?token=*`.
- Force `Content-Type: application/json` with a `public/_headers` rule, and confirm it.
- Add the Associated Domains entitlement `applinks:fivessportsbar.app`.
- The Team ID becomes available after Apple organisation enrolment (needs the D-U-N-S number).
- Apple's CDN caches this file, so changes propagate slowly.

---

## 20. Native UI / safe-area findings

**Safe areas and status bar:**
- The `body` padding uses raw `env(safe-area-inset-*)` (`index.css:48-53`).
  - Android WebView below version 140 reports wrong values. Capacitor 8's SystemBars plugin injects `--safe-area-inset-*` variables to use instead: `var(--safe-area-inset-top, env(safe-area-inset-top, 0px))`.
- **Sticky header** (`CustomerLayout.tsx:84`): `top-0` sticks under the status bar once the body padding scrolls away (Android 15+ edge-to-edge, and iOS). Move the top inset into the header's own padding.
- **Bottom nav** (`CustomerLayout.tsx:155`): switch to the variable fallback.
- **ConnectivityBanner** (`fixed top-0`) needs the top inset.
- **Menu item sheet** needs bottom inset padding. The back-to-top button (`bottom-24`) needs `calc()` with the inset.
- Set the status bar style to dark (background `#14110f`).

**Other UI:**
- **Dialogs:** `ConfirmDialog` uses native `<dialog>`, which works.
- **Height:** `min-h-dvh` is fine on WebView 111+.
- **Keyboard:** on Profile and Change Password, the fixed bottom nav can cover the focused input. Hide it while the keyboard is open (`@capacitor/keyboard` or `visualViewport`).
- **Install prompt:** hide `PwaInstallPrompt`.
- **Staff/Admin:** redirect to the screen in section 16.

## 21. Android back-button considerations

- Capacitor's default goes back in WebView history, then exits the app.
- **Problems:**
  - The Menu sheet and `<dialog>`s stay open while the page underneath navigates away.
  - Pressing back from `/app` can land on the landing page.
- **Use the `@capacitor/app` `backButton` handler:**
  1. Close an open `<dialog>` or the Menu sheet.
  2. On `/app` or `/login`, minimise the app (`App.minimizeApp()`).
  3. On other tabs, go to `/app`.
  4. Otherwise go back in history, or minimise if there's nothing to go back to.

## 22. External-link policy

| Link type | Behaviour |
|---|---|
| Internal routes | React Router `<Link>` (fix the `<a href>` in Profile) |
| `fivessportsbar.app` web-only pages (Staff/Admin portal, account-deletion page) | System browser or Custom Tab (`@capacitor/browser`) |
| Third-party https | System browser (Capacitor's default) |
| `mailto:` / `tel:` | OS handler. Check on a device |
| Maps / WhatsApp | None exist today |
| Production | Never navigate the WebView itself to a remote origin; no `server.url` or `allowNavigation` |

---

## 23. Versioning recommendation

- Marketing version **1.0.0** at the first store release, taken from `package.json` `version` (currently 0.1.0).
- **Android:** `versionName 1.0.0`; `versionCode` integer goes up by 1 on every upload. Lives in `android/app/build.gradle`.
- **iOS:** `MARKETING_VERSION` 1.0.0 and `CURRENT_PROJECT_VERSION` (build number) +1. Lives in the Xcode project.
- Inject the version into the bundle and send an `X-Fives-Client: android/1.0.0+N` header.
- Web deploys stay independent and never change the UI inside an installed app.
- **Release process:** bump version → `build:native` → `cap sync` → signed AAB → Play internal track → promote.

## 24. Store-update model

| A. No store update | B. Store update needed |
|---|---|
| Promotions, menu, campaigns, rewards, catalogue, points programs, settings and code TTL changes made in Admin | Any `src` UI change |
| Worker fixes that keep the API contract | `shared` schemas or types used by the client |
| Emails, cron, secret rotation | Plugins, permissions, `capacitor.config`, icons/splash, intent filters, API base URL, enabling native push |

**Backwards compatibility with older installed apps:**
- API changes must only add things. Don't remove or rename fields or endpoints the customer screens use.
- Tightening a `shared` Zod schema on the server can break old clients.
- The client should tolerate enum values it doesn't know.
- Keep a minimum-supported-version gate using the client header.
- Test Better Auth upgrades against the previous native build.

## 25. Feature-flag recommendation

**No flag system.** The `app_settings` table (business, key, `value_json`) already holds keys such as `welcome_reward_enabled`, `loyalty_code_ttl_seconds` and `promotion_carousel_speed_seconds`.

When needed, add one public endpoint, `GET /api/public/app-config`, returning:
- `nativeMinSupportedBuild` (forced update)
- `storeLinks`
- `showStoreBadges`

Backend native support (CORS, bearer) does nothing until a native client exists, so it doesn't need a flag.

---

## 26. Android tooling requirements

**What I found on this machine:**
- Node 22.17.1 and npm 10.9.2 (both fine).
- Microsoft OpenJDK 21.0.8 (fine).
- `JAVA_HOME` and `ANDROID_HOME` are not set.
- No Android SDK in `%LOCALAPPDATA%\Android\Sdk`, no Android Studio in the default location, `adb` is not on PATH.
- Nothing Android-related in the repo.

**Needed:**
- Android Studio **2025.2.1 (Otter) or newer**.
- SDK Platform 36, Build-Tools, Platform-Tools.
- Emulator with Pixel images for API 35/36, plus one image at API 24–28.
- Gradle 8.14.3 (downloaded automatically by the wrapper) and Android Gradle Plugin 8.13. Use Android Studio's bundled JDK.
- Set `ANDROID_HOME` and add `platform-tools` to PATH.
- Turn on Windows Hypervisor Platform (WHPX) so the emulator runs at a usable speed.
- Physical phone: Developer options → USB debugging, plus the Google or manufacturer USB driver (or use wireless debugging).

## 27. iOS reality check

- Needs **macOS and Xcode 26+**, and an Apple Developer Program **organisation** enrolment (needs the D-U-N-S number).
- Signing certificates and provisioning profiles (Xcode can manage these automatically), and App Store Connect.
- Capacitor 8 uses Swift Package Manager by default. Deployment target at least 16.4.
- Cloud Macs are possible, but a real Mac is strongly recommended for testing.
- No Windows-only App Store workflow.

## 28. Recommended package / application ID

**`app.fivessportsbar.rewards`**
- It is the reverse-domain form of the domain Dean owns (`BRAND.website`, `noreply@` / `support@fivessportsbar.app`).
- `com.` or `za.co.` would imply domains with no evidence of ownership in the repo.
- **This cannot be changed after the app is published, so Dean must approve it.**

## 29. Environment / staging recommendation

**Today there are two environments:**
- **Local:** Miniflare D1/R2, Turnstile off. Every smoke test targets `http://localhost:5173`.
- **Production.**

**Hazard:** the top-level config in `wrangler.jsonc:22-41`, which `npm run deploy` uses:
- binds the **production** D1 `e1d41192…` and the production R2 bucket,
- with `APP_ENV=development` and `workers_dev` defaulting to on.

A deploy from that config would publicly expose `/api/dev/seed` (`dev.ts:22-31`) against production data and turn off Turnstile. **Don't run `npm run deploy`.** Check in the dashboard whether a non-production `fives-rewards` Worker exists, and fix this before creating any staging environment.

**Plan:**
- **UI development:** live reload (`server.url`, dev builds only).
- **Testing the cross-origin path:** native bundle → HTTPS tunnel (`cloudflared` quick tunnel) → local Worker. No Cloudflare resources needed.
- **Staging** (separate Worker, D1, R2, secrets and Turnstile test keys): recommended before testers try staff flows, but not required for Phase 1.
- **Production API:** only for final internal builds, with a dedicated test account.

## 30. Git / branch strategy

- One repo. Create branch `native/capacitor` from `main`.
- **Commit** `android/` (and later `ios/`). They are source code; Capacitor's own `.gitignore` files exclude build outputs and the copied web assets.
- **Add to the root `.gitignore`:** `dist-native/`, `*.jks`, `*.keystore`, `keystore.properties`, `*.p8`, `*.p12`, `*.mobileprovision`, Pods, DerivedData.
- **Backend changes** (CORS, bearer, CORP) can go to `main` early as small, inert changes.
- **Merge the branch** once Android builds reproducibly and web regression tests pass.
- Merging doesn't deploy; `deploy:prod` is still manual. Note this differs from your usual commit-and-push-to-`main` routine after each phase.

## 31. Cloudflare changes eventually required

- **Worker code:**
  - CORS allowlist.
  - `trustedOrigins` from an environment variable.
  - `bearer()` plugin.
  - Strip `set-auth-token` for non-native origins.
  - CORP `cross-origin` on the public media routes.
  - Turnstile expected-hostname list.
  - Later: FCM provider and secret, `/api/public/app-config`.
- **Static files:** `/.well-known/assetlinks.json`, AASA file and `_headers`.
- **Turnstile dashboard:** confirm the widget's hostnames, or create a native widget.
- **DNS:** reserve the native hostname.
- **D1:** one migration later, for native push tokens.
- **No changes** to the Worker name, production D1, production R2 or unrelated resources.

---

## 32. Security risks

| Risk | Mitigation |
|---|---|
| Bearer token theft through XSS | Keystore/Keychain storage. Strict CSP in the native `index.html` (`script-src 'self' challenges.cloudflare.com`). No `dangerouslySetInnerHTML` exists today (checked) |
| Web JavaScript reading `set-auth-token` | Strip the header for non-native origins |
| CORS too broad | Exact allowlist, no wildcard, no credentials |
| Trusting `localhost` | Use a Fives-owned hostname instead |
| Turnstile bypass | None allowed |
| Deep-link injection | Host and path allowlist. Only verified App Links (not custom URL schemes) for reset tokens |
| QR tokens | Unchanged: server-side, single-use, 10-minute expiry |
| Logging / debug builds | No token logging. `webContentsDebuggingEnabled`, `allowMixedContent`, `cleartext` and `server.url` all off in release builds; add a pre-release check |
| Signing keys | Use Play App Signing; keep the upload keystore outside the repo and backed up |
| Secrets | Nothing secret ships in the bundle (the API URL and Turnstile site key are public). FCM credentials live only in Worker secrets |
| Staging hazard | Section 29 |
| Existing gap | Web has no CSP (optional hardening) |

## 33. Store-review risks

**Both stores:**
- Risk of looking like a plain website in a wrapper. Mitigate with native push, deep links and native navigation polish.
- Account deletion in the app already exists ✓. Google Play also needs a **public web page for deletion requests** (`/privacy` only says "from your profile").
- Privacy policy at `/privacy` ✓.
- **Support URL:** `BRAND.support.contactUrl` (`/contact`) **has no route**. Fix it or use the support email.
- **Alcohol on the menu** (Beers, Whiskey) will raise the age/content rating. The Terms page has no age statement.

**Google Play:**
- Data Safety form: name, email, phone, birthday, loyalty history, push token, IP (used by Turnstile).
- Current target-API requirement (Capacitor 8 targets 36).
- An organisation account (D-U-N-S) avoids the 12-tester / 14-day closed-test rule for new personal accounts.

**Apple:**
- Minimum-functionality guideline (4.2).
- Sign in with Apple isn't required (email/password only).
- No in-app purchase issue: rewards are redeemed in the venue.
- Provide a reviewer demo account and explain why Staff/Admin are blocked.

---

## 34. Exact files likely to change

| Area | Files |
|---|---|
| Frontend | `src/lib/platform.ts` (new), `api.ts`, `authClient.ts`, `src/lib/nativeAuthToken.ts` (new), `vite-env.d.ts`, `main.tsx`, `AppProviders.tsx`, `useSession.ts`, `guards.tsx` or `roles.ts` (native override), `CustomerLayout.tsx`, `MarketingOptInModal.tsx`, `ProfilePage.tsx`, `MenuPage.tsx`, `LandingPage.tsx`, `ConnectivityBanner.tsx`, `index.css`, `sw.js` (denylist only), new native use-web page |
| Worker | `index.ts`, `index.ts`, `turnstile.ts`, `media.ts`, `env.d.ts`, `worker/lib/notifications/*` (later), `customer.ts` (later: tokens and deletion), new migration (later) |
| Config | `package.json`, `capacitor.config.json` (new), `vite.native.config.ts` (new), `.env.native`, `.gitignore`, `wrangler.jsonc` (environment variables and the top-level hazard fix), `public/.well-known/*`, `public/_headers` |
| Native | `android/` (new), `ios/` (later) |
| Tests | `scripts/native-api-smoke.mjs` (new), `password-reset-link-smoke.mjs` (if the email link format changes) |

---

## 35. Recommended implementation phases

| Phase | Scope | Main risk | Tests | Web change? |
|---|---|---|---|---|
| 0. Readiness (on `main`) | Decisions; `platform.ts`; reset `redirectTo`; CORP on media; `<Link>` fixes; safe-area CSS variables; fix the Wrangler hazard | CSS regressions on iOS PWA | `typecheck`, `npm test`, `build:prod`, viewport checks | None visible |
| 1. Backend native auth | CORS, `trustedOrigins`, `bearer()`, `set-auth-token` stripping, Turnstile hostnames | Auth regression | All existing suites plus a new native API smoke test | None |
| 2. Capacitor core (branch) | Install Capacitor 8 packages, `capacitor.config.json`, `vite.native.config.ts`, `build:native` script, gate the service worker | TypeScript 7 / config loading | Build both outputs | None |
| 3. Android project | `cap add android`, app ID, `minWebViewVersion: 111`, icons | Gradle setup | Emulator boot | None |
| 4. Native UX | Token storage, role screen, back button, links, hide push and install prompt, keyboard | Logic forks between web and native | Regression plan (section 36) | None |
| 5. Device testing | Tunnel first, then production (after Phase 1 is deployed) | Production data noise | Full section 36 | None |
| 6. Polish | SystemBars, splash, icons, Fives Code brightness | Low | Visual | None |
| 7. Deep links | `assetlinks.json`, intent filters, email link format | Verification failures | `adb` App Link verification | Reset email link format |
| 8. Native push | FCM, migration, provider | Worker signing compatibility | Delivery smoke test | None |
| 9. Play Store | Organisation account, Play App Signing, Data Safety, rating, deletion URL | Review | Internal → closed → production tracks | Adds a deletion page |
| 10. iOS | Mac, Turnstile/scheme test, Universal Links | Turnstile under `capacitor://` | Same plan on iOS | None |

## 36. Native regression test plan

**Must stay green:**
- `npm run typecheck`
- `npm test`, which runs: `phase13-smoke.ps1`, `auth-regression-smoke.ps1`, `account-deletion-smoke.mjs`, `points-smoke.mjs`, `webpush-payload-smoke.mjs`, `menu-media-cache-smoke.mjs`, `promotion-media-cache-smoke.mjs`, `password-reset-link-smoke.mjs`
- `test:birthday` and `phase9`–`phase12` smoke scripts
- `build:prod`

**New automated checks:**
- Preflight allowed for native origins and denied for any other origin.
- Bearer sign-in followed by `/api/me` succeeds.
- Web responses contain no `set-auth-token`.
- Public media returns CORP `cross-origin`; the private media route doesn't.
- `assetlinks.json` returns 200 with JSON.

**Manual Android checks:**

| Area | Checks |
|---|---|
| Auth | Sign up (Turnstile + mobile PATCH + welcome reward); login; logout (server session revoked); session survives app kill and restart; expired or invalid token sends the user to `/login`; reset request and completion on web, then login in the app; account deletion clears the token |
| Loyalty | Coffee stamp via staff web scan of native QR; Reward Points; Item Campaigns; catalogue claim (idempotency); Available Rewards and redemption; QR expiry and refresh |
| Content | Promotions carousel images; menu images, item sheet, offline menu fallback; image cache after restart |
| Navigation | Sticky header under status bar; bottom nav with gesture bar; keyboard on forms; back button (dialogs, sheet, tab roots); deep links (installed and not installed) |
| Notifications | In-app list and unread badge; web-push UI hidden; later native push opens the right `actionUrl` |
| Security | Wrong Turnstile token rejected; other origins rejected; deactivated account blocked; Staff/Admin accounts see the web-portal screen |
| PWA regression | iOS Safari standalone, Android Chrome PWA, push, install prompt, media cache |

---

## 37. Critical decisions Dean must approve

1. App ID `app.fivessportsbar.rewards` (permanent once published).
2. Store name and launcher label.
3. Native auth model: bearer token (recommended) or Android-only same-site cookies.
4. Native WebView hostname (for example `app.fivessportsbar.app`), and reserving it in DNS.
5. Turnstile: reuse the existing widget or create a separate native widget.
6. Staff/Admin blocked in native with a link to the web portal.
7. Push: none for internal testing, required before public release.
8. Fix the top-level Wrangler environment, and whether to create staging.
9. Minimum versions: Android WebView 111, `minSdk` 24, iOS 16.4+.
10. Password reset: finished on the web in Phase 1; email link format changed in Phase 7.
11. Which paths deep-link (include `/`?).
12. Versioning scheme.
13. Organisation developer accounts (D-U-N-S) and Play App Signing.
14. Content rating and alcohol disclosure; an age statement in the Terms.
15. Public account-deletion page URL and the `/contact` support link.

## 38. Implementation handoff prompt outline

1. **Context:** repo path, stack, production is live, branch `native/capacitor`, never deploy without approval.
2. **Approved decisions:** list items 1–15 above.
3. **Phase 0 tasks:** with the regression requirement "web behaviour unchanged".
4. **Phase 1 backend tasks:** with exact CORS, `trustedOrigins` and bearer rules, and the forbidden options (`disableCSRFCheck`, `disableOriginCheck`, wildcard CORS, Turnstile bypass).
5. **Phases 2–4:** use Capacitor 8, `capacitor.config.json`, `webDir: dist-native`, a separate Vite config, and secure token storage.
6. **Guardrails:** don't change Worker, D1 or R2 names; don't run `npm run deploy`; migrations only with approval; no secrets in the bundle.
7. **Acceptance:** section 36 checks plus the new smoke tests; all existing suites pass.
8. **Deliverables per phase:** changed files, test output, and a note on whether web behaviour changed.

---

NO FILES WERE MODIFIED.
NO PACKAGES WERE INSTALLED.
NO CAPACITOR PROJECT WAS CREATED.
NO PRODUCTION RESOURCES WERE MODIFIED.
NO Build My New App RESOURCES WERE MODIFIED.