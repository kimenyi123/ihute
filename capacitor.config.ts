import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Android shell loads your live site in a WebView.
 * Override: CAPACITOR_SERVER_URL=https://ihute.rw/grandma npx cap sync
 */
const serverUrl =
  process.env.CAPACITOR_SERVER_URL ||
  "http://192.168.11.174:3000/grandma"

const config: CapacitorConfig = {
  appId: "rw.ihute.app",
  appName: "Ihute",
  webDir: "public-capacitor",
  server: {
    url: serverUrl,
    androidScheme: "https",
    // Allow http:// for local dev on device (set CAPACITOR_SERVER_URL=http://...)
    cleartext: serverUrl.startsWith("http://"),
  },
}

export default config
