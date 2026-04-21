"use strict"

const fs = require("fs")
const path = require("path")
const http = require("http")
const https = require("https")
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

function encodeDir(value) {
  return Buffer.from(String(value || ""), "utf8").toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function request(url, method = "GET", body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const mod = target.protocol === "https:" ? https : http
    const req = mod.request({
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === "https:" ? 443 : 80),
      path: `${target.pathname}${target.search}`,
      method,
      headers,
    }, (res) => {
      const chunks = []
      res.on("data", (chunk) => chunks.push(chunk))
      res.on("end", () => resolve({ status: res.statusCode || 0, body: Buffer.concat(chunks).toString("utf8") }))
    })
    req.setTimeout(30000, () => req.destroy(new Error("request-timeout")))
    req.on("error", reject)
    if (body) req.write(body)
    req.end()
  })
}

function buildBase() {
  const explicit = env("TAILNET_ROUTER_URL", "")
  if (!explicit) throw new Error("Set TAILNET_ROUTER_URL")
  return explicit.replace(/\/$/, "")
}

async function main() {
  const { chromium } = loadPlaywright()
  const base = buildBase()
  const host = env("TAILNET_TARGET_HOST", "")
  const port = env("TAILNET_TARGET_PORT", "3000")
  const directory = env("TAILNET_DIRECTORY", "D:\\CODE\\opencode-tailscale")
  if (!host) throw new Error("Set TAILNET_TARGET_HOST")

  const create = await request(
    `${base}/session?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&directory=${encodeURIComponent(directory)}`,
    "POST",
    JSON.stringify({ title: `safe-auto-refresh-${Date.now()}` }),
    { "content-type": "application/json" },
  )
  if (create.status >= 400) throw new Error(`create-session-failed ${create.status} ${create.body}`)
  const created = JSON.parse(create.body)
  const sessionID = created.id
  if (!sessionID) throw new Error("create-session-missing-id")

  const browser = await chromium.launch({ headless: env("TAILNET_HEADLESS", "1") !== "0" })
  const context = await browser.newContext()
  const page = await context.newPage()
  const browserClient = `c_browser_${Date.now().toString(36)}`
  const sessionUrl = `${base}/${encodeDir(directory)}/session/${encodeURIComponent(sessionID)}?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&client=${encodeURIComponent(browserClient)}`
  const launchUrl = `${base}/__oc/launch?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&directory=${encodeURIComponent(directory)}&sessionID=${encodeURIComponent(sessionID)}&client=${encodeURIComponent(browserClient)}`
  const navigations = []
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) navigations.push({ url: frame.url(), at: Date.now() })
  })
  await page.goto(launchUrl, { waitUntil: "domcontentloaded", timeout: 30000 })
  const entryDeadline = Date.now() + 30000
  while (Date.now() < entryDeadline) {
    if (page.url() === sessionUrl) break
    await page.waitForTimeout(500)
  }
  if (page.url() !== sessionUrl) throw new Error(`launch-did-not-enter-session ${page.url()}`)
  await page.waitForTimeout(4000)
  const baselineNavigations = navigations.length
  const send = await request(
    `${base}/session/${encodeURIComponent(sessionID)}/prompt_async?host=${encodeURIComponent(host)}&port=${encodeURIComponent(port)}&directory=${encodeURIComponent(directory)}`,
    "POST",
    JSON.stringify({ parts: [{ type: "text", text: `auto refresh probe ${Date.now()}` }] }),
    { "content-type": "application/json" },
  )
  if (send.status >= 400) throw new Error(`prompt-failed ${send.status} ${send.body}`)

  const deadline = Date.now() + Number(env("TAILNET_AUTO_REFRESH_TIMEOUT_MS", "20000"))
  while (Date.now() < deadline) {
    if (navigations.length > baselineNavigations) break
    await page.waitForTimeout(500)
  }
  const lastUrl = page.url()
  const ok = navigations.length > baselineNavigations && lastUrl === sessionUrl
  console.log(JSON.stringify({ sessionID, baselineNavigations, navigations, lastUrl, ok }, null, 2))
  await browser.close()
  if (!ok) process.exit(1)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
