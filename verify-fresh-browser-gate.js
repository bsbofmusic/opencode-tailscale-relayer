"use strict"

const fs = require("fs")
const path = require("path")
const { execFileSync } = require("child_process")

function env(name, fallback) {
  const value = process.env[name]
  return value == null || value === "" ? fallback : value
}

function loadPlaywright() {
  const explicit = env("PLAYWRIGHT_NODE_PATH", "")
  if (explicit) return require(explicit)
  try {
    return require("playwright")
  } catch {}
  const appDataRoot = process.env.APPDATA ? path.join(process.env.APPDATA, "npm", "node_modules", "playwright") : ""
  if (appDataRoot && fs.existsSync(appDataRoot)) return require(appDataRoot)
  const npmBin = process.platform === "win32" ? "npm.cmd" : "npm"
  const globalRoot = execFileSync(npmBin, ["root", "-g"], { encoding: "utf8" }).trim()
  return require(path.join(globalRoot, "playwright"))
}

function buildLaunchUrl() {
  const explicit = env("TAILNET_LAUNCH_URL", "")
  if (explicit) return explicit
  const router = env("TAILNET_ROUTER_URL", "")
  const host = env("TAILNET_TARGET_HOST", "")
  const port = env("TAILNET_TARGET_PORT", "3000")
  if (!router || !host) throw new Error("Set TAILNET_LAUNCH_URL or TAILNET_ROUTER_URL + TAILNET_TARGET_HOST")
  const url = new URL("/__oc/launch", router)
  url.searchParams.set("host", host)
  url.searchParams.set("port", port)
  return url.toString()
}

const { chromium } = loadPlaywright()
const LAUNCH_URL = buildLaunchUrl()

;(async () => {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(LAUNCH_URL, { waitUntil: "domcontentloaded", timeout: 30000 })
  await page.waitForFunction(() => location.pathname.includes("/session/"), { timeout: 45000 })
  await page.waitForTimeout(3000)
  const data = await page.evaluate(() => ({
    url: location.href,
    snapshot: sessionStorage.getItem("opencode.router.dat:snapshot"),
  }))
  console.log(JSON.stringify(data, null, 2))
  if (!data.snapshot) {
    console.error("fresh-browser-gate-failed")
    process.exit(1)
  }
  const parsed = { snapshot: JSON.parse(data.snapshot) }
  const roots = parsed.snapshot.workspaceRoots || []
  if (roots.includes("/") || roots.includes("\\")) {
    console.error("fresh-browser-gate-invalid-root")
    process.exit(1)
  }
  await browser.close()
})().catch((err) => {
  console.error(err)
  process.exit(1)
})
