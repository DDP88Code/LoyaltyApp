# Fives Sports Bar Rewards — Native App Implementation Roadmap

**Project:** Fives Sports Bar Rewards  
**Repository:** `C:\dev\fives-rewards`  
**Production:** `https://fivessportsbar.app`  
**Native strategy:** Capacitor — Android first, iOS later  
**Source of truth:** One repository, one backend, one database

---

## 1. Goal

Add native Android and later iOS delivery to the existing Fives customer experience **without replacing or destabilising the live PWA**.

The native apps will reuse the existing React/Vite frontend, Cloudflare Worker, D1, R2, Better Auth, loyalty engine, Reward Points, Item Campaigns, QR system, rewards wallet and notifications data.

### Permanent principles

- [ ] Keep one Git repository.
- [ ] Do not create separate Android/iOS codebases.
- [ ] Do not duplicate databases or customer accounts.
- [ ] Keep `fivessportsbar.app` permanently.
- [ ] Keep the PWA available as a fallback.
- [ ] Keep Staff browser-first.
- [ ] Keep Admin/Owner browser-first.
- [ ] Native apps are customer-first.
- [ ] The existing Staff browser scanner continues scanning the same customer QR.
- [ ] Joe's Admin changes remain server/data driven and should appear in web/native without store updates.

---

## 2. Approved architecture decisions

### Application identity

- [ ] **Package / application ID:** `app.fivessportsbar.rewards`
- [ ] **Store name:** `Fives Sports Bar Rewards`
- [ ] **Suggested launcher label:** `Fives Rewards`
- [ ] **First public native version:** `1.0.0`

> The package/application ID becomes effectively permanent after publication. Approve it before the first store build.

### Capacitor model

- [ ] Use Capacitor 8.x.
- [ ] Bundle the React/Vite frontend inside the native app.
- [ ] Do **not** use a production `server.url` pointing at `https://fivessportsbar.app`.
- [ ] Use a separate native output directory such as `dist-native`.
- [ ] Prefer `capacitor.config.json` if the existing TypeScript version remains incompatible with Capacitor CLI config loading.

### Authentication

**Web/PWA**
- [ ] Continue using secure HttpOnly cookie sessions.

**Native**
- [ ] Use Better Auth bearer session support.
- [ ] Store native session token in Android Keystore / iOS Keychain through maintained secure storage.
- [ ] Never store auth tokens in `localStorage`.
- [ ] Never use `@capacitor/preferences` as secure token storage.
- [ ] Logout revokes the server session and clears secure storage.

### Native hostname

Recommended reserved hostname:

```text
app.fivessportsbar.app
```

- [ ] Reserve it for native-origin/Turnstile use.
- [ ] Do not host a normal public site there.
- [ ] Do not trust generic localhost origins in production.

### Staff/Admin

If Staff/Admin/Owner signs into the native app:

- [ ] Show "Staff & Admin use the web portal".
- [ ] Provide "Open in browser".
- [ ] Provide "Sign out".
- [ ] Do not duplicate Staff/Admin interfaces in native.

### Native push

- [ ] Not required for first internal Android build.
- [ ] Required before public native release.
- [ ] Existing in-app notifications remain available during internal testing.
- [ ] Existing Web Push remains for the PWA.

### Initial deep-link paths

Candidates:

- `/app`
- `/app/rewards`
- `/app/notifications`
- `/app/fives-code`
- `/app/menu`
- `/app/profile`
- `/reset-password`

Initial policy:

- [ ] Do **not** auto-open the native app for `/` yet.
- [ ] Keep `/` as the public landing/install page.

---

# PHASE 0 — FIX THE WRANGLER DEPLOYMENT HAZARD

## 3. Why this must happen first

The native-readiness audit found an existing deployment hazard unrelated to Capacitor:

The generic top-level Wrangler configuration used by:

```powershell
npm run deploy
```

points at production D1/R2 while using development-style configuration. The audit identified the risk that development behaviour such as `/api/dev/seed` could be exposed against production data if that path were used.

### Until fixed

> **DO NOT RUN `npm run deploy`.**

Only use the intentional production path when explicitly authorised:

```powershell
npm run deploy:prod
```

## 3.1 Inspect the current deployment config

- [x] Confirm repo is `C:\dev\fives-rewards`.
- [x] Confirm branch and HEAD.
- [x] Confirm `git status` is clean.
- [x] Inspect `package.json` deployment scripts.
- [x] Inspect `wrangler.jsonc`.
- [x] Document the top-level/default Wrangler environment.
- [x] Document production environment.
- [x] Confirm Worker names.
- [x] Confirm D1 bindings.
- [x] Confirm R2 bindings.
- [x] Confirm `APP_ENV` values.
- [x] Confirm workers.dev behaviour.
- [x] Confirm which environments expose `/api/dev/*`.
- [x] Confirm `deploy:prod` is correctly isolated from the unsafe default path.

Phase 0 inspection notes (2026-10-01):

- Default/top-level Worker config uses `name: fives-rewards`, `APP_ENV=development`, dev-safe `MEDIA` bucket (`fives-rewards-media-local`), and local/dev guard on `/api/dev/*`.
- Production deploy path remains `npm run deploy:prod` with `wrangler deploy --env production` and production bindings in `env.production`.
- Production API health confirms `environment: production` on `https://fivessportsbar.app/api/health`.
- The accidental workers.dev script `fives-rewards.fives-rewards.workers.dev` was removed (`Error 1042 script not found`), while production remained healthy.

## 3.2 Fix the hazard

Target state:

- [x] A development-mode deployment cannot target production D1/R2.
- [x] `/api/dev/*` can never operate against production data.
- [x] Production Worker/D1/R2 names remain unchanged.
- [x] Production secrets remain unchanged.
- [x] Development deployment becomes explicitly safe, or the unsafe generic deployment command is removed/renamed.
- [x] `deploy:prod` remains explicit and safe.

## 3.3 Verify Phase 0

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run build:prod`
- [x] Confirm production config points at correct production resources.
- [x] Confirm `/api/dev/*` is unavailable in production.
- [x] Confirm normal PWA behaviour is unchanged.
- [x] Commit and push the safety fix.
- [ ] Return to a clean Git status.

Remaining note (2026-10-01): repository still contains pre-existing untracked `Native Readiness.md`, intentionally left untouched.

### STOP / GO GATE

Do **not** install Capacitor until every Phase 0 item is complete.

---

# PHASE 1 — WEB-SAFE NATIVE READINESS CHANGES

These changes prepare the shared app without creating a native project yet.

## 4. Platform abstraction

Create a minimal shared platform layer, conceptually:

```text
IS_NATIVE
WEB_ORIGIN
APP_TARGET
```

Likely location:

```text
src/lib/platform.ts
```

- [x] Web defaults remain unchanged.
- [x] Native-specific behaviour is gated centrally.
- [x] Avoid scattered ad-hoc platform checks.

## 4.1 Password reset origin

Current native problem: reset callback is derived from `window.location.origin`.

Phase-1 native behaviour:

- [x] Web keeps existing reset flow.
- [x] Native requests a reset using `https://fivessportsbar.app/reset-password`.
- [x] Reset completes in browser initially.
- [x] User returns to app and logs in.
- [x] Deep-link reset can be added later.

## 4.2 Legal/internal links

- [x] Replace unnecessary hard reloads to `/terms` and `/privacy` with router-safe navigation where appropriate.
- [x] Web behaviour remains unchanged.

## 4.3 Safe-area groundwork

Review and prepare:

- [x] sticky customer header;
- [x] bottom nav;
- [x] connectivity banner;
- [x] menu item sheet;
- [x] back-to-top controls;
- [x] dialogs/modals.

Do not create visible PWA regressions.

## 4.4 Public media CORP fix

Current issue: public media may inherit `Cross-Origin-Resource-Policy: same-origin`.

Target:

- [x] Public menu images can be loaded by native app.
- [x] Public promotion images can be loaded by native app.
- [x] Private/Admin media remains protected.
- [x] Existing immutable caching remains intact.
- [x] Existing menu-media cache smoke stays green.
- [x] Existing promotion-media cache smoke stays green.

## 4.5 Phase 1 validation

- [x] `npm run typecheck`
- [x] `npm run lint`
- [x] `npm test`
- [x] `npm run build:prod`
- [x] Password-reset smoke passes.
- [x] Menu media smoke passes.
- [x] Promotion media smoke passes.
- [x] Mobile PWA layout passes.
- [x] PWA is unchanged for customers.

### STOP / GO GATE

- [x] Web-safe readiness changes verified.
- [x] No Capacitor packages installed yet.
- [x] Git clean before Phase 2.

Phase 1 evidence note (2026-10-01):

- Implemented central platform abstraction in `src/lib/platform.ts` (`APP_TARGET`, `IS_NATIVE`, `WEB_ORIGIN`) and wired password-reset redirect via `buildPasswordResetRedirectUrl()` in `src/features/auth/useSession.ts`.
- Replaced Profile legal hard reload links with router `Link` navigation; added safe-area fallback variables/patterns and applied them to customer nav/banner/menu sheet/back-to-top/dialog spacing without Capacitor dependencies.
- Applied public-media-only CORP override (`Cross-Origin-Resource-Policy: cross-origin`) for `/api/media/public/*` in `worker/index.ts`; private media remains `same-origin` and authenticated.
- Expanded media smokes with CORP assertions and kept deterministic menu-media setup.
- Validation executed: `node ./scripts/password-reset-link-smoke.mjs`, `node ./scripts/menu-media-cache-smoke.mjs`, `node ./scripts/promotion-media-cache-smoke.mjs`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run build:prod`.
- Production deploy executed with `npm run deploy:prod`; Worker version `ab129c04-7c6f-4265-9826-8a1d26fc01e8`.
- Live checks: `GET /api/health` returned `environment=production`; `POST /api/dev/seed` returned `404`; public menu/promotion media returned `200` with immutable cache headers and `CORP=cross-origin`; private media unauthenticated returned `401` with `CORP=same-origin`.

---

# PHASE 2 — NATIVE BACKEND / AUTH SUPPORT

## 5. CORS

Add exact native-origin CORS handling before auth/business routes.

Requirements:

- [x] Exact allowlist only.
- [x] No `*` origin.
- [x] Do not echo arbitrary origins.
- [x] Allow required methods only.
- [x] Allow headers:
  - `Content-Type`
  - `Authorization`
  - `cf-turnstile-response`
  - `Accept`
- [x] Expose `set-auth-token` only to approved native origins.
- [x] Native CORS must not weaken normal web security.

## 5.1 Better Auth native support

- [x] Add Better Auth bearer support.
- [x] Add exact approved native origins to `trustedOrigins`.
- [x] Preserve web cookie authentication exactly.
- [x] Do not disable CSRF checks.
- [x] Do not disable origin checks.
- [x] Do not migrate normal web/PWA sessions to bearer tokens.

Expected split:

```text
WEB/PWA  -> HttpOnly cookie
NATIVE   -> Authorization: Bearer <session token>
```

## 5.2 Protect `set-auth-token`

Critical:

- [x] Web JavaScript must not be able to read native auth tokens.
- [x] Strip/suppress token header for non-native origins.

## 5.3 Turnstile preparation

- [x] Reserve/approve `app.fivessportsbar.app`.
- [x] Add native hostname to server expected-hostname handling.
- [x] Configure Turnstile hostname support.
- [x] Prefer separate native Turnstile widget if operationally straightforward.
- [x] Never bypass Turnstile because a request claims to be native.
- [x] Never trust a custom request header as proof of native origin.

## 5.4 Add native API smoke coverage

Automated tests should prove:

- [x] approved native origin preflight succeeds;
- [x] unknown origin is rejected;
- [x] native sign-in returns usable bearer token;
- [x] bearer token can call `/api/me`;
- [x] web login remains cookie based;
- [x] web cannot read `set-auth-token`;
- [x] expired/invalid token is rejected;
- [x] logout revokes native session.

## 5.5 Full regression gate

Must stay green:

- [x] Phase 13 smoke
- [x] Auth regression
- [x] Account deletion smoke
- [x] Reward Points smoke
- [x] Web Push payload smoke
- [x] Menu media cache smoke
- [x] Promotion media cache smoke
- [x] Password reset link smoke
- [x] Coffee regression
- [x] Birthday regression
- [x] Welcome regression
- [x] QR/OTP regression
- [x] Item Campaign regression
- [x] Reward redemption regression
- [x] Typecheck
- [x] Lint
- [x] Production build

## 5.6 Production gate

If deployed:

- [x] use only approved production deploy process;
- [x] verify `/api/health`;
- [ ] verify customer login/signup;
- [ ] verify Staff login;
- [ ] verify Admin login;
- [ ] verify QR;
- [ ] verify account deletion;
- [ ] verify menu/promotions.

Phase 2 completion notes (2026-10-01):

- Native CORS and bearer support shipped with exact allowlist controls and non-native `set-auth-token` suppression.
- Deployed using `npm run deploy:prod` (version `b0c3008d-6222-4ec3-bf8c-c259ac73050c`).
- Production checks passed for approved/blocked native preflight behavior, `/api/health`, production `/api/dev/*` lockout, and Turnstile enforcement on auth endpoints.

---

# PHASE 3 — CREATE NATIVE BRANCH

## 6. Git strategy

Use one repository.

Recommended:

```powershell
git checkout main
git pull
git checkout -b native/capacitor
```

- [ ] `main` is current.
- [ ] `main` is clean.
- [ ] Create `native/capacitor`.
- [ ] Native project work stays on this branch initially.
- [ ] Do not create a separate repository.

### Commit native project source

Eventually commit:

- [ ] `capacitor.config.json`
- [ ] native Vite config
- [ ] `android/`
- [ ] `ios/` later
- [ ] native integration source

### Ignore generated/secrets

- [ ] `dist-native/`
- [ ] `*.jks`
- [ ] `*.keystore`
- [ ] `keystore.properties`
- [ ] `*.p8`
- [ ] `*.p12`
- [ ] `*.mobileprovision`
- [ ] Android build outputs
- [ ] iOS DerivedData
- [ ] generated caches

Never commit signing keys/secrets.

---

# PHASE 4 — CAPACITOR CORE

## 7. Install core packages

- [ ] Install Capacitor 8-compatible core/CLI packages.
- [ ] Add only required plugins initially.
- [ ] Do not add native push yet.

## 7.1 Native Vite build

Create dedicated native build output:

```text
WEB     -> existing web output
NATIVE  -> dist-native
```

Native build must:

- [ ] exclude Cloudflare Vite plugin;
- [ ] exclude PWA/service-worker generation;
- [ ] set `VITE_APP_TARGET=native` or equivalent;
- [ ] set native production API origin to `https://fivessportsbar.app`;
- [ ] never overwrite normal production web assets.

> `VITE_API_BASE_URL` should be the origin `https://fivessportsbar.app`, **not** `https://fivessportsbar.app/api`.

## 7.2 Capacitor config

Use `capacitor.config.json` unless verified otherwise.

Baseline:

- [ ] appId = `app.fivessportsbar.rewards`
- [ ] appName = `Fives Sports Bar Rewards`
- [ ] webDir = `dist-native`
- [ ] native hostname = approved Fives-owned hostname
- [ ] no production `server.url`
- [ ] no unsafe `allowNavigation`
- [ ] no cleartext HTTP in release
- [ ] no mixed-content relaxation in release

## 7.3 Disable PWA SW in native

- [ ] Native does not register service worker.
- [ ] PWA still does.
- [ ] Existing PWA cache/update behaviour remains unchanged.

## 7.4 Build gate

- [ ] Web build succeeds.
- [ ] Native build succeeds.
- [ ] `dist-native` is separate.
- [ ] Native bundle contains no PWA service-worker registration.
- [ ] No production deployment occurs in this phase.

---

# PHASE 5 — ANDROID TOOLING

## 8. Local tooling checklist

Current audit indicated Node/JDK are already suitable, but Android tooling is not installed/configured.

- [ ] Install Android Studio 2025.2.1 (Otter) or newer.
- [ ] Install SDK Platform 36.
- [ ] Install Build Tools.
- [ ] Install Platform Tools.
- [ ] Configure `ANDROID_HOME`.
- [ ] Add `platform-tools` / `adb` to PATH.
- [ ] Enable Windows Hypervisor Platform if needed.
- [ ] Create modern Android emulator (API 35/36).
- [ ] Create lower supported emulator/device for compatibility testing.
- [ ] Enable USB or wireless debugging on physical Android phone.

### Baseline Android versions

- [ ] minSdk 24
- [ ] compile/target SDK 36
- [ ] minimum WebView 111

---

# PHASE 6 — GENERATE ANDROID PROJECT

## 9. Create Android shell

Only after previous gates pass:

- [ ] `cap add android`
- [ ] Review generated project.
- [ ] Confirm package ID.
- [ ] Confirm display label.
- [ ] Confirm SDK versions.
- [ ] Confirm release has no dev URL.
- [ ] Commit `android/`.

### First emulator milestone

- [ ] Native app launches.
- [ ] React UI renders.
- [ ] Native bundle reaches intended API.
- [ ] No PWA production change.
- [ ] No push/deep links yet.

---

# PHASE 7 — NATIVE AUTH CLIENT

## 10. Secure token storage

- [ ] Use Android secure storage / Keystore-backed plugin.
- [ ] Read token on app startup.
- [ ] Attach bearer token to native API requests.
- [ ] Native requests do not rely on web cookies.
- [ ] Token never logged.
- [ ] Logout clears token.
- [ ] Account deletion clears token.
- [ ] Invalid session returns user to login.

## 10.1 Login tests

- [ ] valid login;
- [ ] wrong password;
- [ ] Turnstile failure;
- [ ] session survives app kill/restart;
- [ ] logout revokes session;
- [ ] login works again after logout.

## 10.2 Registration tests

- [ ] Turnstile renders;
- [ ] registration succeeds;
- [ ] profile created;
- [ ] Welcome Reward behaves normally;
- [ ] duplicate email handled;
- [ ] required profile fields validated.

## 10.3 Staff/Admin native gate

- [ ] Staff sees web-portal message.
- [ ] Admin sees web-portal message.
- [ ] Owner sees web-portal message.
- [ ] "Open in browser" works.
- [ ] "Sign out" works.
- [ ] Native app does not expose Staff scanner/Admin management UI.

---

# PHASE 8 — NATIVE UI POLISH

## 11. Safe areas / system bars

- [ ] sticky header clears notch/status bar;
- [ ] bottom nav clears gesture area;
- [ ] connectivity banner clears top inset;
- [ ] menu sheet clears bottom inset;
- [ ] floating controls clear bottom inset;
- [ ] dark Fives system-bar styling looks correct.

## 11.1 Keyboard

- [ ] Login fields visible above keyboard.
- [ ] Register fields visible.
- [ ] Profile/change-password inputs visible.
- [ ] Bottom nav does not cover active input.

## 11.2 Hide PWA-only UI

In native:

- [ ] hide Add to Home Screen prompt;
- [ ] hide Web Push unsupported card/message;
- [ ] hide web-only install guidance.

## 11.3 Android back button

Priority:

1. close open dialog;
2. close menu/detail sheet;
3. handle current customer tab/root;
4. minimise/exit from root;
5. never unexpectedly navigate to public landing page.

Test throughout the app.

---

# PHASE 9 — FULL ANDROID CUSTOMER REGRESSION

## 12. Authentication

- [ ] Sign up
- [ ] Login
- [ ] Logout
- [ ] Session persistence
- [ ] Session expiry
- [ ] Password change
- [ ] Password reset request
- [ ] Password reset completion via browser
- [ ] Account deletion
- [ ] Deleted session cannot continue

## 12.1 Coffee Loyalty

- [ ] Native customer shows QR.
- [ ] Staff web scanner resolves customer.
- [ ] Staff awards coffee.
- [ ] Native progress updates.
- [ ] Threshold reward issues.
- [ ] Staff web redeems reward.

## 12.2 Reward Points

- [ ] Staff awards points.
- [ ] Native balance updates.
- [ ] Catalogue renders.
- [ ] Claim works.
- [ ] Available reward created.
- [ ] History updates.
- [ ] Duplicate claim prevented.
- [ ] Staff web redemption works.

## 12.3 Item Campaigns

- [ ] Campaign cards render.
- [ ] Progress bar correct.
- [ ] Quantity award updates.
- [ ] Excluded campaign spend does not earn general points when configured.
- [ ] Threshold reward auto-unlocks.
- [ ] Multiple campaigns render.
- [ ] Catch-up state is correct.
- [ ] Campaign reward redeems through Staff web.

## 12.4 Fives QR

- [ ] QR generated.
- [ ] OTP displayed.
- [ ] Countdown works.
- [ ] Expiry works.
- [ ] Reissue works.
- [ ] Staff browser scanner resolves native QR.
- [ ] No second native QR system introduced.

## 12.5 Promotions

- [ ] cards render;
- [ ] images load;
- [ ] actions work;
- [ ] replacement images update.

## 12.6 Menu

- [ ] categories;
- [ ] images;
- [ ] item sheet;
- [ ] scrolling;
- [ ] back closes item sheet first;
- [ ] restart/cache behaviour acceptable.

## 12.7 Notifications before native push

- [ ] in-app list works;
- [ ] unread badge works;
- [ ] action links work;
- [ ] no broken Web Push UI.

## 12.8 Profile

- [ ] profile data;
- [ ] legal links;
- [ ] password change;
- [ ] logout;
- [ ] account deletion.

---

# PHASE 10 — ANDROID APP LINKS

## 13. Domain verification

Add:

```text
/.well-known/assetlinks.json
```

- [ ] correct package ID;
- [ ] Play App Signing SHA-256 fingerprint;
- [ ] upload/debug fingerprints where appropriate;
- [ ] returns HTTP 200;
- [ ] JSON content type;
- [ ] no redirect;
- [ ] no WAF challenge.

## 13.1 Android intent filter

- [ ] `android:autoVerify=true`;
- [ ] host = `fivessportsbar.app`;
- [ ] approved paths only.

## 13.2 App URL handling

- [ ] validate host;
- [ ] validate path allowlist;
- [ ] navigate with React Router;
- [ ] reject arbitrary external paths as internal navigation.

## 13.3 Root URL policy

- [ ] Keep `/` as landing/install page initially.
- [ ] Do not include `/` in automatic native open for first release.

---

# PHASE 11 — PASSWORD RESET DEEP-LINK UPGRADE

Initial release may keep browser-completed reset.

Later:

- [ ] HTTPS reset link can open installed app.
- [ ] No app -> normal web fallback.
- [ ] Use verified link, not insecure custom scheme for reset token.
- [ ] Password-reset smoke updated.
- [ ] Existing web reset remains supported.

---

# PHASE 12 — NATIVE PUSH BEFORE PUBLIC RELEASE

## 14. Architecture

Recommended:

- [ ] `@capacitor/push-notifications`
- [ ] Firebase Cloud Messaging
- [ ] native push-token table
- [ ] existing notifications table reused
- [ ] existing notification preferences reused
- [ ] existing relative `actionUrl` reused

## 14.1 Native token lifecycle

Store/manage:

- [ ] customer ID
- [ ] business ID
- [ ] platform
- [ ] token
- [ ] app version
- [ ] active flag
- [ ] last seen

Handle:

- [ ] registration
- [ ] token refresh
- [ ] logout
- [ ] account deletion
- [ ] inactive tokens

## 14.2 Android permission

- [ ] Android 13+ notification permission.
- [ ] Ask contextually.
- [ ] Respect opt-in settings.

## 14.3 Push tests

- [ ] reward notification;
- [ ] Birthday notification;
- [ ] promotion broadcast;
- [ ] expiry reminder if applicable;
- [ ] tap opens correct native destination;
- [ ] opt-out respected;
- [ ] PWA Web Push still works;
- [ ] no accidental duplicate delivery.

---

# PHASE 13 — PUBLIC WEBSITE / INSTALL LANDING

Once store apps exist, update `/` to something like:

```text
Fives Sports Bar Rewards

[ Get it on Google Play ]
[ Download on the App Store ]

[ Continue on web ]

Staff / Admin Login
```

- [ ] Do not force installation.
- [ ] Keep web customer fallback.
- [ ] Existing printed QR to `https://fivessportsbar.app` stays valid.
- [ ] Staff/Admin login easy to find.
- [ ] Native build never shows this public landing page.

---

# PHASE 14 — GOOGLE PLAY READINESS

## 15. Developer account

- [ ] D-U-N-S received.
- [ ] Google Play organisation account verified.
- [ ] Correct legal/business information.
- [ ] Play App Signing enabled.

## 15.1 Store policy/support work

Before submission:

- [ ] privacy policy available;
- [ ] public account-deletion request page available;
- [ ] valid support URL;
- [ ] fix `/contact` or use another valid support destination;
- [ ] age/content rating completed accurately;
- [ ] alcohol/menu content disclosed accurately;
- [ ] add age statement to Terms if appropriate;
- [ ] Data Safety form completed;
- [ ] reviewer/demo account prepared if required.

## 15.2 Store assets

- [ ] app icon;
- [ ] adaptive Android icon;
- [ ] splash screen;
- [ ] screenshots;
- [ ] feature graphic;
- [ ] short description;
- [ ] full description;
- [ ] privacy URL;
- [ ] support email;
- [ ] support URL.

## 15.3 Signing

- [ ] upload key generated;
- [ ] keystore outside repo;
- [ ] keystore backed up;
- [ ] Play App Signing configured;
- [ ] signing secrets never committed.

---

# PHASE 15 — ANDROID RELEASE

## 16. Internal testing

- [ ] versionName `1.0.0`
- [ ] versionCode set
- [ ] production native build
- [ ] signed AAB
- [ ] upload to Internal Testing
- [ ] install from Play on real phone
- [ ] complete full regression

## 16.1 Production launch gate

Only release publicly when:

- [ ] customer workflows pass;
- [ ] native push works;
- [ ] App Links work;
- [ ] privacy/deletion/support URLs complete;
- [ ] API remains backward compatible;
- [ ] no critical defects;
- [ ] real-device regression passes.

---

# 17. Versioning after launch

## Android

Example first release:

```text
versionName 1.0.0
versionCode 1
```

Next upload:

```text
versionName 1.0.1
versionCode 2
```

Every Play upload needs a higher `versionCode`.

## Web/PWA

Independent deployment cycle.

A Cloudflare PWA deployment does **not** update bundled native UI already installed from the Play Store.

## Backend

Backward-compatible Worker fixes can usually ship without a store update.

---

# 18. What needs a store update after launch?

## Usually NO store update

- [ ] Joe changes Promotions.
- [ ] Joe creates/changes Item Campaigns.
- [ ] Joe changes campaign prices/targets.
- [ ] Joe creates catalogue rewards.
- [ ] Menu content changes.
- [ ] Reward definitions/settings change.
- [ ] Backward-compatible Worker bug fix.

## Store update required

- [ ] new bundled customer UI;
- [ ] redesigned customer screen;
- [ ] native plugin;
- [ ] new permission;
- [ ] splash/icon change;
- [ ] Capacitor config change;
- [ ] native push implementation change;
- [ ] significant bundled frontend feature.

---

# 19. API backward-compatibility rules after native launch

Native customers will update at different times.

Therefore:

- [ ] Prefer additive API changes.
- [ ] Do not remove fields old native clients use.
- [ ] Do not rename fields without a compatibility period.
- [ ] Do not remove customer endpoints abruptly.
- [ ] Avoid server schema tightening that breaks older clients.
- [ ] Clients should tolerate unknown future enum values where reasonable.
- [ ] Send client version header from native.

Suggested:

```text
X-Fives-Client: android/1.0.0+1
```

Later add a minimum-supported-build value through public app config if required.

---

# 20. Lightweight feature coordination

Do not build a large feature-flag platform.

Reuse the existing `app_settings` philosophy when needed.

Potential future public endpoint:

```text
GET /api/public/app-config
```

Possible fields:

- [ ] minimum native build;
- [ ] Google Play link;
- [ ] App Store link;
- [ ] show store badges;
- [ ] maintenance message.

This can later coordinate features between PWA/Android/iOS.

Example future enhancement:

```text
campaign_images_enabled = false
```

Support can be deployed everywhere first, then enabled once store versions are ready.

---

# PHASE 16 — iOS later

Start after Android architecture is proven and Apple organisation enrolment is ready.

## 21. Requirements

- [ ] Mac
- [ ] Xcode
- [ ] Apple Developer organisation account
- [ ] D-U-N-S completed
- [ ] App Store Connect
- [ ] certificates/provisioning
- [ ] real iPhone for testing

## 21.1 iOS baseline

- [ ] same app ID `app.fivessportsbar.rewards`
- [ ] deployment target at least 16.4
- [ ] same bearer auth model
- [ ] Keychain secure storage
- [ ] Turnstile tested on real iOS Capacitor origin
- [ ] native push tested
- [ ] Universal Links configured
- [ ] safe areas verified

---

# 22. iOS Universal Links later

Add:

```text
/.well-known/apple-app-site-association
```

- [ ] Team ID known.
- [ ] app ID correct.
- [ ] `applinks:fivessportsbar.app` entitlement.
- [ ] approved `/app/*` paths.
- [ ] reset-password path.
- [ ] JSON content type.
- [ ] no redirect.
- [ ] test Apple CDN propagation.

---

# 23. Security non-negotiables

- [ ] No secrets in native JS bundle.
- [ ] Treat API URL and Turnstile site key as public.
- [ ] Bearer token in secure storage only.
- [ ] Never log bearer token.
- [ ] Exact CORS allowlist only.
- [ ] Never disable CSRF/origin protection.
- [ ] Never bypass Turnstile for native.
- [ ] No production `server.url`.
- [ ] No cleartext HTTP in release.
- [ ] No mixed content in release.
- [ ] No WebView debugging in release.
- [ ] Deep-link host/path allowlist.
- [ ] Signing keys outside repo.
- [ ] FCM secrets only in Worker secrets.
- [ ] Existing QR remains server-side, single-use and short-lived.
- [ ] Native push tokens removed on account deletion.

---

# 24. Production protection checklist — EVERY PHASE

Before work:

- [ ] Correct repo: `C:\dev\fives-rewards`
- [ ] Correct branch.
- [ ] `git status` reviewed.
- [ ] Confirm Build My New App repo/resources are out of scope.

Before production deployment:

- [ ] Relevant tests pass.
- [ ] Production build passes.
- [ ] Diff reviewed.
- [ ] Migration reviewed if applicable.
- [ ] Use only approved deploy command.
- [ ] Never use unsafe generic Wrangler deploy path.
- [ ] Worker = `fives-rewards`.
- [ ] D1 = `fives-rewards-db`.
- [ ] R2 = `fives-rewards-media`.

After deployment:

- [ ] `/api/health` returns 200.
- [ ] PWA login works.
- [ ] Customer Home works.
- [ ] Staff login works.
- [ ] Admin login works.
- [ ] QR works.
- [ ] Coffee works.
- [ ] Reward Points works.
- [ ] Item Campaigns works.
- [ ] Available Rewards works.
- [ ] Menu works.
- [ ] Promotions work.
- [ ] Notifications work.
- [ ] Account deletion regression passes if auth/deletion touched.

---

# 25. Existing regression suites that must remain green

- [ ] `phase13-smoke.ps1`
- [ ] `auth-regression-smoke.ps1`
- [ ] `account-deletion-smoke.mjs`
- [ ] `points-smoke.mjs`
- [ ] `webpush-payload-smoke.mjs`
- [ ] `menu-media-cache-smoke.mjs`
- [ ] `promotion-media-cache-smoke.mjs`
- [ ] `password-reset-link-smoke.mjs`
- [ ] Coffee regression
- [ ] Birthday regression
- [ ] Welcome regression
- [ ] QR/OTP regression
- [ ] Reward redemption regression
- [ ] Item Campaign regression
- [ ] `npm run typecheck`
- [ ] `npm run lint`
- [ ] `npm run build:prod`

Native tests are added **in addition to**, not instead of, the existing suite.

---

# 26. Native-specific tests to add

## Automated

- [ ] CORS approved origin succeeds.
- [ ] Unknown native origin rejected.
- [ ] Bearer sign-in succeeds.
- [ ] Bearer `/api/me` succeeds.
- [ ] Web cannot access native auth token header.
- [ ] Public media loads cross-origin.
- [ ] Private media remains protected.
- [ ] Native API base is correct.
- [ ] Native build contains no PWA service worker.
- [ ] App Link verification file valid.

## Manual Android

- [ ] auth;
- [ ] Coffee;
- [ ] Reward Points;
- [ ] Item Campaigns;
- [ ] catalogue claims;
- [ ] QR;
- [ ] Available Rewards;
- [ ] Menu;
- [ ] Promotions;
- [ ] Notifications;
- [ ] Profile;
- [ ] account deletion;
- [ ] safe areas;
- [ ] keyboard;
- [ ] dialogs/sheets;
- [ ] Android back;
- [ ] app kill/restart;
- [ ] network interruption;
- [ ] Staff/Admin browser gate;
- [ ] deep links;
- [ ] native push later.

---

# 27. Future backlog — do not block first native release

- [ ] Reward / campaign images.
- [ ] Biometric login.
- [ ] Keep screen awake / brightness boost on QR screen.
- [ ] Native haptics.
- [ ] App icon notification badge.
- [ ] Native share sheet.
- [ ] richer deep-link destinations.
- [ ] advanced offline behaviour.
- [ ] staging environment if native development volume justifies it.
- [ ] optional stronger web CSP hardening.

---

# 28. Master STOP / GO gates

## GO to Capacitor only when

- [ ] Wrangler hazard fixed.
- [ ] PWA regressions green.
- [ ] native auth backend support ready.
- [ ] CORS proven.
- [ ] Turnstile native-origin plan approved.
- [ ] public media safe for native.
- [ ] app ID approved.
- [ ] native hostname approved.
- [ ] native Git branch created.

## GO to Android internal testing only when

- [ ] native bundle builds;
- [ ] secure auth works;
- [ ] signup/login/logout work;
- [ ] QR works;
- [ ] loyalty/reward flows work;
- [ ] Staff/Admin gate works;
- [ ] safe areas/back button work;
- [ ] PWA remains green.

## GO to public Play release only when

- [ ] full real-device regression passes;
- [ ] native push is implemented;
- [ ] App Links work;
- [ ] organisation Play account active;
- [ ] Play App Signing configured;
- [ ] privacy/support/deletion URLs complete;
- [ ] content/alcohol rating handled;
- [ ] Data Safety complete;
- [ ] no known critical defects;
- [ ] backend remains backward-compatible.

## GO to iOS only when

- [ ] Android architecture is proven;
- [ ] D-U-N-S available;
- [ ] Apple organisation account active;
- [ ] Mac/Xcode available;
- [ ] Turnstile verified on iOS;
- [ ] Keychain auth verified;
- [ ] Universal Links tested;
- [ ] native push tested on iPhone.

---

# 29. Recommended implementation order

Follow this sequence unless an actual repository constraint requires a change:

```text
0. Fix Wrangler deployment hazard
1. Web-safe readiness fixes
2. Native backend auth/CORS/Turnstile support
3. Create native/capacitor branch
4. Add Capacitor core + native Vite build
5. Install/configure Android tooling
6. Generate Android project
7. Implement native secure auth client
8. Add Staff/Admin native web-portal gate
9. Safe areas / keyboard / back button / polish
10. Full Android customer regression
11. Android App Links
12. Password reset deep-link improvement
13. Native push
14. Public Fives landing/store buttons
15. Play Store readiness
16. Internal Play testing
17. Production Android release
18. iOS implementation later
```

---

# 30. Definition of success

The native implementation is successful when:

- the existing PWA still works as intended;
- Staff and Admin continue using the browser;
- customers can use Fives natively on Android;
- customer accounts are shared across web/native;
- Coffee, Reward Points, Item Campaigns and Rewards are shared;
- the existing customer QR works with the Staff web scanner;
- Joe's Admin changes appear in native automatically;
- content/settings changes do not require store releases;
- bundled UI/native changes follow store release controls;
- `fivessportsbar.app` remains the API/deep-link/web-fallback hub;
- permanent QR material remains valid;
- Android and future iOS share one codebase;
- no production resources are duplicated unnecessarily.

---

# 31. Current status

- [x] Native-readiness audit completed.
- [x] Capacitor judged suitable.
- [x] One-repository strategy approved.
- [x] Android-first strategy approved.
- [x] Staff/Admin browser-first strategy approved.
- [x] Domain retention approved.
- [x] Native bearer-token architecture recommended.
- [x] Application ID recommendation identified.
- [ ] Application ID formally approved.
- [ ] Wrangler deployment hazard fixed.
- [ ] Web-safe readiness fixes implemented.
- [ ] Native backend support implemented.
- [ ] Capacitor installed.
- [ ] Android tooling installed.
- [ ] Android project generated.
- [ ] Secure native auth implemented.
- [ ] Android device testing completed.
- [ ] Native push implemented.
- [ ] Google Play organisation account ready.
- [ ] Android published.
- [ ] Apple organisation account ready.
- [ ] iOS project created.
- [ ] iOS published.

---

# Final guardrail

> **Never trade the stability of the live Fives PWA for speed on the native implementation.**

The native app is an additional customer delivery channel built on top of a production system that already works. Every phase must preserve that production system first.
