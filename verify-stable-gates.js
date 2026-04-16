const cp = require('child_process')
const https = require('https')

const checks = [
  { name: 'browser-smoke', cmd: 'node verify-v0.1.6.js' },
  { name: 'fresh-browser', cmd: 'node verify-fresh-browser-gate.js' },
]

function prewarm(url) {
  return new Promise((resolve) => {
    const u = new URL(url)
    const req = https.request({ hostname: u.hostname, path: u.pathname + u.search, method: 'GET', port: 443 }, (res) => {
      res.on('data', () => {})
      res.on('end', resolve)
    })
    req.on('error', resolve)
    req.end()
  })
}

let failed = false
;(async () => {
  await prewarm('https://opencode.cosymart.top/__oc/meta?host=100.121.130.36&port=3000')
  await new Promise((resolve) => setTimeout(resolve, 5000))
  for (const check of checks) {
    console.log(`=== ${check.name} ===`)
    try {
      cp.execSync(check.cmd, { stdio: 'inherit' })
    } catch {
      console.error(`gate failed: ${check.name}`)
      failed = true
      break
    }
  }
  process.exit(failed ? 1 : 0)
})()
