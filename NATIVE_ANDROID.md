# Android foundation

This branch contains the Capacitor shell and packaged frontend, not a completed
native customer release. Native bearer-token storage, the Staff/Admin/Owner
web-portal gate, push, deep links, back-button handling and keyboard polish remain
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
the `VITE_` prefix. No token persistence or bearer-header injection is added here.

Capacitor serves the bundled UI at `https://app.fivessportsbar.app` and starts at
`/app`, which uses the existing customer/session routes. There is no remote
`server.url`, navigation allowlist, cleartext or mixed-content allowance.
The website's `/` landing page and route tree are unchanged.

Native builds exclude both Cloudflare and PWA build plugins and replace the PWA
registration module with an empty module. Web builds retain the original service
worker registration/update behavior and output to `dist/client`. Existing safe-area
CSS variables and environment fallbacks are checked in the built native CSS.

## Android tools and remaining validation

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
On the implementation machine JDK 21 is available, but Android Studio/SDK were
not found in their standard locations, `adb` is absent from PATH, and
`ANDROID_HOME`, `ANDROID_SDK_ROOT` and `JAVA_HOME` are unset. APK compilation,
emulator startup, on-device API access and safe-area appearance remain unverified.
No global tooling was installed. Default generated launcher/splash artwork remains
for the later branding/polish phase; no native plugins were added.

Generated web assets, build outputs, SDK paths, caches and signing material are
ignored. Commit Android source and the Gradle wrapper. This foundation requires no
Worker deployment, migrations or production resource changes.
