# Mobile builds (Android + Apple) — Capacitor

This app uses **Capacitor** to wrap the **live website** in a native shell (WebView). The default URL is **`https://shop.ihute.rw/grandma`** (Grandma is deployed on the **shop** host; **`https://ihute.rw/grandma` may 404** until redirects are live). Override with `CAPACITOR_SERVER_URL` before `npx cap sync`.

## 1. Sync web config into native projects

From the repo root:

```bash
npm install
npx cap sync
```

Or: `npm run cap:sync`

---

## 2. Android (.apk / .aab)

**Works on:** Windows, macOS, or Linux (with Android SDK).

1. Install [Android Studio](https://developer.android.com/studio) and the Android SDK.
2. Set `ANDROID_HOME`, or open the project once in Android Studio so it creates `android/local.properties`.
3. Sync: `npx cap sync android`
4. **Option A — Android Studio:**  
   `npm run cap:open:android` → **Build → Build APK(s)** or **Build App Bundle** (Play Store).
5. **Option B — CLI:**  
   `cd android && ./gradlew assembleDebug` (Unix) or `gradlew.bat assembleDebug` (Windows)  
   Debug APK: `android/app/build/outputs/apk/debug/app-debug.apk`

**Release signing:** Configure signing in Android Studio (keystore) before uploading to Google Play.

---

## 3. Apple (iOS — .ipa for TestFlight / App Store)

**Must use macOS** with **Xcode** (Apple does not allow building iOS apps on Windows).

1. On a Mac, install [Xcode](https://developer.apple.com/xcode/) from the App Store.
2. Install CocoaPods: `sudo gem install cocoapods` (or Homebrew: `brew install cocoapods`).
3. From repo root:  
   `npx cap sync ios`  
   `cd ios/App && pod install && cd ../..`
4. Open the workspace:  
   `npm run cap:open:ios`  
   Opens `ios/App/App.xcworkspace` (use **.xcworkspace**, not `.xcodeproj`, when CocoaPods is used).
5. In Xcode: select a **Team** (Apple Developer account), set **Bundle Identifier** if needed (`rw.ihute.app`), then **Product → Archive** to upload to App Store Connect / TestFlight.

**Note:** If you only have Windows, use a **Mac mini / cloud Mac** (e.g. MacStadium, GitHub Actions `macos-latest`, or Codemagic) to run Xcode builds.

---

## 4. Change the loaded URL

```bash
# Example: Grandma on production (preferred host)
set CAPACITOR_SERVER_URL=https://shop.ihute.rw/grandma
npx cap sync

# Example: local dev on your LAN
set CAPACITOR_SERVER_URL=http://192.168.1.10:3000/grandma
npx cap sync
```

On macOS/Linux use `export CAPACITOR_SERVER_URL=...` instead of `set`.

---

## 5. Summary

| Platform | Build machine | Output |
|----------|----------------|--------|
| **Android** | Windows, Mac, or Linux + Android Studio | `.apk` / `.aab` |
| **iOS** | **macOS + Xcode only** | `.ipa` (via Archive) |

Both use the same Capacitor project: run `npx cap sync` after changing `capacitor.config.ts` or env vars.

## 6. APK opens to “404” (blank or Next error page)

- **Cause:** `server.url` in `capacitor.config.ts` points at a host/path that does not serve the Grandma app (often **`https://ihute.rw/grandma`** before the apex redirect exists).
- **Fix:** Use **`https://shop.ihute.rw/grandma`**, then `npx cap sync android`, rebuild the APK. Confirm the URL in a **phone browser** first.
- **Check:** `echo %CAPACITOR_SERVER_URL%` (Windows) — unset means the default from `capacitor.config.ts` is used.

## 7. Startup shell, errors, and `ihute_logs.txt`

- **Default (no `CAPACITOR_SERVER_URL`):** the app loads **`public-capacitor/index.html`** first. It calls **`/api/ihute-bootstrap-health`** on **`https://shop.ihute.rw`**, then redirects to **`/grandma`**. If that fails, the screen shows the **full target URL**, **health URL**, and the error; you can **Download ihute_logs.txt** (built from **`localStorage`**, last ~200 lines).
- To change shop URLs, edit **`public-capacitor/index.html`** (`TARGET` and `HEALTH`) and keep them in sync with production.

## 8. Seller stock offline (Grandma → Items)

- Open **Items** once **online** so stock is cached on the device.
- **Offline:** you can change **quantities** (±) and **queue new items** (“Add it yourself”); changes sync when the device is **online** again (or use **Refresh** after reconnect).
- This is a **best-effort** queue on one browser/device — not a full conflict-resolution system for multi-device edits.
