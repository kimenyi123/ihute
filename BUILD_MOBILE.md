# Mobile builds (Android + Apple) — Capacitor

This app uses **Capacitor** to wrap the **live website** in a native shell (WebView). The default URL is **`https://ihute.rw/grandma`**. Override with `CAPACITOR_SERVER_URL` before `npx cap sync`.

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
# Example: full site root
set CAPACITOR_SERVER_URL=https://ihute.rw/
npx cap sync

# Example: local dev on your LAN
set CAPACITOR_SERVER_URL=http://192.168.1.10:3000
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
