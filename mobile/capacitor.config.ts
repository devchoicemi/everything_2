import type { CapacitorConfig } from '@capacitor/cli'

/**
 * ChoiceMi mobile — a Capacitor wrap of web/, not a separate rebuild (see
 * root README: mobile/ = "PWA / Play Store wrap of web/"). There is no
 * separate mobile UI here on purpose: every screen, the compatibility
 * engine, the read-verification gate and the propose-a-date rules all live
 * in web/ and are served over HTTP into this native WebView shell — so a
 * fix in web/ ships to mobile users on their next app-resume without a
 * store submission.
 *
 * `server.url` picks where that content is loaded from:
 *   - CHOICEMI_WEB_URL env var, if set (e.g. a staging deploy) — takes
 *     priority so CI/local builds can point anywhere without editing this
 *     file.
 *   - Local dev server otherwise. Android emulators can't reach
 *     "localhost" (that's the emulator's own loopback) — 10.0.2.2 is the
 *     documented alias for the host machine's localhost. iOS
 *     simulators/devices can use the LAN IP directly instead if needed.
 *   - Swap to the production URL (https://web-seven-jet-19.vercel.app, or
 *     whatever custom domain replaces it) before a real store build.
 */
const DEV_SERVER_URL = 'http://10.0.2.2:3000'
const webUrl = process.env.CHOICEMI_WEB_URL || DEV_SERVER_URL

/**
 * CHOICEMI_STANDALONE=1 → fully offline app: the static export from
 * `npm run build:standalone` in web/ is bundled into the APK and nothing is
 * loaded over the network (scoring, the read-check gate and date rules run
 * in-app; data lives on the device). No server.url in this mode.
 */
const STANDALONE = process.env.CHOICEMI_STANDALONE === '1'

const config: CapacitorConfig = {
  appId: 'fi.choicemi.app',
  appName: 'ChoiceMi',
  webDir: STANDALONE ? '../web/.next-standalone' : 'www',
  server: STANDALONE
    ? { androidScheme: 'https' }
    : {
    url: webUrl,
    cleartext: webUrl.startsWith('http://'),
    // Bundled in www/ — shown instead of Android's raw error page when the
    // site can't be reached (e.g. launched with no network).
    errorPath: 'offline.html',
  },
  backgroundColor: '#1B0A3D',
  plugins: {
    SplashScreen: {
      // Matches the purple entry screens, so there is no colour flash before the WebView paints.
      backgroundColor: '#1B0A3D',
      launchAutoHide: true,
      launchFadeOutDuration: 200,
      androidScaleType: 'CENTER_CROP',
    },
    StatusBar: {
      style: 'DARK', // dark background → light (white) status bar text/icons
      backgroundColor: '#1B0A3D',
    },
  },
}

export default config
