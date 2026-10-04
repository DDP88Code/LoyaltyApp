# Android foundation

This branch contains the Capacitor shell and packaged frontend, not a completed
native customer release. Native bearer authentication and the Staff/Admin/Owner
web-portal gate are implemented; push, deep links, back-button handling and keyboard polish remain
in their later roadmap phases. Do not distribute this foundation as a finished app.

## Identity and build

- Capacitor core, CLI and Android: **8.5.2**, pinned in the lockfile.
- Permanent application ID: `app.fivessportsbar.rewards`.
- Application and launcher name: **Fives Sports Bar Rewards**.
- Configuration: `capacitor.config.json` (JSON avoids the TypeScript 7 CLI issue).
- `npm run build:native`: builds and checks `dist-native` using `vite.native.config.ts`.
- `npm run cap:sync`: builds, syncs Android and verifies metadata and copied assets.
- `npm run cap:android`: opens the project in an installed Android Studio.

The native config fixes `VITE_APP_TARGET=native` and
`VITE_API_BASE_URL=https://fivessportsbar.app` at build time, including when local
environment values differ. Existing API helpers append `/api/...` themselves.
The existing `.env` supplies the public Turnstile site key; secrets must never use
the `VITE_` prefix.

## Native authentication

Native API and Better Auth requests use `credentials: "omit"` and read the bearer
token from `@aparajita/capacitor-secure-storage@8.0.1`. Successful Better Auth
responses persist `set-auth-token` before the caller loads `/api/me` or updates
registration profile fields. Authenticated Better Auth actions, including password
change and sign-out, use the same secure token. The first session request reads
secure storage again after an app restart.

Logout attempts server revocation before clearing the local token in `finally`,
including on network failure. Offline logout cannot confirm server revocation.
Successful account deletion and an unauthenticated session response also clear
the token. Storage errors fail explicitly; there is no browser-storage fallback.
Capacitor bridge logging is disabled, including debug builds, because bridge
payloads can contain tokens. Do not enable it when testing with real accounts.

Web/PWA requests retain cookie authentication and never access token storage or
capture `set-auth-token`. Backend CORS, auth configuration and database schema are
unchanged.

`npm run test:native-auth` tests both frontend targets with mocked native storage
and actual Better Auth client hooks. `npm run test:native-api` exercises the local
backend, including cookie-free password change and logout. For that test, run the
built Worker directly: Vite's dev server intercepts OPTIONS before Worker CORS.

```powershell
npm run build
npx wrangler dev --config dist/fives_rewards/wrangler.json --persist-to .wrangler/state --port 8787
# In a second terminal, using the existing local database:
$env:NATIVE_API_SMOKE_BASE_URL = 'http://localhost:8787'
npm run test:native-api
```

Capacitor serves the bundled UI at `https://app.fivessportsbar.app` and starts at
`/app`, which uses the existing customer/session routes. There is no remote
`server.url`, navigation allowlist, cleartext or mixed-content allowance.
The website's `/` landing page and route tree are unchanged.

Native builds exclude both Cloudflare and PWA build plugins and replace the PWA
registration module with an empty module. Web builds retain the original service
worker registration/update behavior and output to `dist/client`. Existing safe-area
CSS variables and environment fallbacks are checked in the built native CSS.

## Customer-only native access

Native Staff, Admin and Owner sessions render a web-portal gate before any
protected layout or feature mounts. Login sends these roles to `/app`; restored
sessions, app restarts and direct protected-route attempts encounter the same
gate. Customers retain their existing native routes. Signed-out login/register
and web/PWA cookie authentication and role routing are unchanged.

**Open Web Portal** uses the fixed `https://fivessportsbar.app/login` URL with no
token, query parameters, return path or referrer. The production portal has a
different origin from the native bundle, so Capacitor's existing Android
navigation handler launches the system browser using ACTION_VIEW. Do not add
this domain to `allowNavigation`. The browser uses its own web session; the native
bearer token is never transferred. **Sign Out** uses the existing native logout
flow, including server revocation and secure-storage cleanup.

Validation on 2026-10-04:

- `npm run test:native-routing` passed native/web cases for all four roles,
  restored sessions, protected routes, signed-out access, fixed token-free portal
  links and gate logout. Mock storage/backend assertions complement device checks.
- `npm run test:native-auth`, `npm run typecheck`, `npm run build:native`,
  `npm run build`, `npx cap sync android`,
  `node scripts/android-project-check.mjs` and `gradlew.bat assembleDebug` passed.
  The updated debug APK was installed on API 36; toolchain versions are unchanged.
- Customer emulator checks passed: session restored after restart, `/api/me` 200,
  customer UI retained, Staff/Admin route attempts returned to `/app`, logout
  cleared secure storage and the revoked token received 401.
- Owner emulator checks passed: real login after logout, gate appearance,
  force-stop/restart persistence, direct `/staff`, `/admin/settings`,
  `/admin/owner` and `/app/profile` gating, external Chrome ACTION_VIEW launch
  with exactly the fixed portal URL, return to the gate, and gate logout. Logout
  returned to `/login`, cleared secure storage and revoked the session (401 on
  reuse). Diagnostics never printed or saved bearer tokens.
- Full `npm test` ran once and completed with exit 0. The existing local SQLite
  foreign-key diagnostic still precedes auth success; local Turnstile assertions
  are skipped, and reset validation reports the known `INVALID_REDIRECT_URL`
  limitation. Build output retains the existing large-chunk warning.
- Staff/Admin real-account emulator verification remains pending: no designated
  accounts were available. Their routing and logout are covered automatically.
  The other Phase 7 manual registration/error checks remain on the roadmap.

## Android tools and remaining validation

### Phase 8 offline issue (recorded 2026-10-04)

When Android loses Wi-Fi/mobile connectivity, Home/Profile and cached menu content
remain available, but Rewards and QR generation can hang indefinitely. Phase 8
must add explicit offline UX, prevent endless loading, and verify reconnection
without changing server-side QR rules. This issue was recorded, not fixed, during
the Phase 7 role-gate work.

### Build environment

The generated project uses min SDK **24**, compile/target SDK **36**, Gradle
**8.14.3**, Android Gradle Plugin **8.13.0**, and minimum WebView **111**.
No SDK overrides or Gradle downgrades were required.

To build on a configured machine, install Android Studio 2025.2.1 or newer,
SDK Platform 36, Android Build Tools and Platform Tools. Configure `ANDROID_HOME`
(or the ignored `android/local.properties` SDK path), use JDK 21, then run:

```powershell
npm ci
npm run cap:sync
cd android
.\gradlew.bat assembleDebug
```

The APK will be under `android/app/build/outputs/apk/debug/`.
On 2026-10-03, Java 21 at `C:\Users\deand\.jdks\jbr-21.0.11` and the SDK at
`C:\Users\deand\AppData\Local\Android\Sdk` were used successfully for
`assembleDebug`. The debug APK was installed on the running API 36 emulator.
The project check now verifies the secure-storage plugin and disabled bridge
logging alongside synced assets, identity and SDK versions. No tooling versions
were changed. Default generated launcher/splash artwork remains for the later
branding/polish phase. Visual safe-area validation remains separate.

Runtime validation on API 36: real customer sign-in succeeded; `/api/me` returned
200 using the securely stored token; force-stop/relaunch preserved authentication.
Observed app requests omitted cookies and carried bearer authentication. The
actual Sign out button returned 200, cleared secure storage, and returned to
`/login`; reuse of the revoked session returned 401. No service worker was
registered. Token values were never printed or saved to diagnostics.

Validation on 2026-10-03 passed: `npm run typecheck` (also the lint script),
`npm run test:native-auth`, local `npm run test:native-api`, `npm run build`,
`npm run cap:sync`, Android project checks, `gradlew.bat assembleDebug`, and one
completed full `npm test` run. An initial full-suite attempt stopped in its first
suite because the sandbox denied a helper process; the permitted retry completed
with exit 0. The auth regression script again printed the already-documented local
SQLite foreign-key error before reporting success. Local Turnstile enforcement
checks are skipped and reset redirect validation reports the existing
`INVALID_REDIRECT_URL` limitation. See ignored `.native-auth-regression.log`.

Generated web assets, build outputs, SDK paths, caches and signing material are
ignored. Commit Android source and the Gradle wrapper. This foundation requires no
Worker deployment, migrations or production resource changes.
