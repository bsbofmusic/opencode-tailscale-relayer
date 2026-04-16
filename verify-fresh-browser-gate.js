"use strict"

const { chromium } = require("C:/Users/Maxlead/AppData/Roaming/npm/node_modules/playwright")

const LAUNCH_URL = "https://opencode.cosymart.top/__oc/launch?host=100.121.130.36&port=3000"

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(LAUNCH_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForFunction(() => location.pathname.includes("/session/"), { timeout: 45000 })
  await page.waitForTimeout(3000)
  const data = await page.evaluate(() => ({
    url: location.href,
    server: localStorage.getItem("opencode.global.dat:server"),
    globalProject: localStorage.getItem("opencode.global.dat:globalSync.project"),
    defaultServer: localStorage.getItem("opencode.settings.dat:defaultServerUrl"),
    snapshot: sessionStorage.getItem("opencode.router.dat:snapshot"),
  }))
  console.log(JSON.stringify(data, null, 2))
  if (!data.server || !data.globalProject || !data.defaultServer || !data.snapshot) {
    console.error("fresh-browser-gate-failed")
    process.exit(1)
  }
  const parsed = {
    server: JSON.parse(data.server),
    globalProject: JSON.parse(data.globalProject),
    snapshot: JSON.parse(data.snapshot),
  }
  const roots = parsed.snapshot.workspaceRoots || []
  const projects = (((parsed.server || {}).projects || {})[new globalThis.URL(data.defaultServer).origin] || [])
  if (roots.includes("/") || roots.includes("\\")) {
    console.error("fresh-browser-gate-invalid-root")
    process.exit(1)
  }
  if (projects.some((item) => item && (item.worktree === "/" || item.worktree === "\\"))) {
    console.error("fresh-browser-gate-invalid-project-root")
    process.exit(1)
  }
  await browser.close()
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
