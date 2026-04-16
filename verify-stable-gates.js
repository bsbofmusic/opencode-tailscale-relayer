const cp = require('child_process')
const checks = [
  { name: 'browser-smoke', cmd: 'node verify-v0.1.6.js' },
  { name: 'fresh-browser', cmd: 'node verify-fresh-browser-gate.js' },
]
let failed = false
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
