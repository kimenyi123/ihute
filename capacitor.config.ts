import type { CapacitorConfig } from "@capacitor/cli"

/**
 * Default: load `public-capacitor/index.html` first — it health-checks the site, logs to localStorage,
 * offers `ihute_logs.txt` download on failure, then redirects to shop Grandma.
 *
 * Set CAPACITOR_SERVER_URL to skip the shell and open that URL directly (e.g. http://192.168.x.x:3000/grandma).
 */
const serverUrl = process.env.CAPACITOR_SERVER_URL?.trim()

const config: CapacitorConfig = {
  appId: "rw.ihute.app",
  appName: "Ihute",
  webDir: "public-capacitor",
  ...(serverUrl
    ? {
        server: {
          url: serverUrl,
          androidScheme: "https",
          cleartext: serverUrl.startsWith("http://"),
        },
      }
    : {}),
}

export default config
