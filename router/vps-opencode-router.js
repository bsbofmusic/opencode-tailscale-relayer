const http = require("http")

const bindHost = process.env.OPENCODE_ROUTER_HOST || "127.0.0.1"
const bindPort = Number(process.env.OPENCODE_ROUTER_PORT || "33102")
const targetCookie = "oc_target"
const directoryCookie = "oc_directory"
const maxSessions = 80
const maxProjects = 12
const inspectTimeoutMs = 5000

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
}

function validIp(value) {
  const parts = value.split(".")
  if (parts.length !== 4) return false
  return parts.every((part) => {
    if (!part) return false
    if (!part.split("").every((char) => char >= "0" && char <= "9")) return false
    const num = Number(part)
    return Number.isInteger(num) && num >= 0 && num <= 255
  })
}

function validPort(value) {
  return /^\d{1,5}$/.test(value) && Number(value) > 0 && Number(value) < 65536
}

function parseCookies(raw) {
  return (raw || "").split(/;\s*/).reduce((out, item) => {
    const i = item.indexOf("=")
    if (i === -1) return out
    out[item.slice(0, i)] = item.slice(i + 1)
    return out
  }, {})
}

function parseTarget(host, port) {
  if (!host) return
  if (!validIp(host)) return
  const nextPort = String(port || "3000")
  if (!validPort(nextPort)) return
  return { host, port: nextPort }
}

function getTarget(reqUrl, headers, options) {
  const opts = options || {}
  const cookies = opts.useCookie === false ? {} : parseCookies(headers.cookie)
  const fromCookie = cookies[targetCookie]?.split(":")
  const host = reqUrl.searchParams.get("host") || fromCookie?.[0] || ""
  const port = reqUrl.searchParams.get("port") || fromCookie?.[1] || "3000"
  if (!host) return opts.allowEmpty ? { host: "", port } : undefined
  return parseTarget(host, port)
}

function setCookies(res, items) {
  const next = items.filter(Boolean)
  if (!next.length) return
  res.setHeader("Set-Cookie", next)
}

function setTargetCookie(res, target) {
  setCookies(res, [`${targetCookie}=${target.host}:${target.port}; Path=/; Max-Age=2592000; SameSite=Lax`])
}

function setContextCookies(res, target, directory) {
  const items = []
  if (target?.host && target?.port) items.push(`${targetCookie}=${target.host}:${target.port}; Path=/; Max-Age=2592000; SameSite=Lax`)
  if (directory) items.push(`${directoryCookie}=${encodeURIComponent(String(directory))}; Path=/; Max-Age=2592000; SameSite=Lax`)
  setCookies(res, items)
}

function clearTargetCookie(res) {
  setCookies(res, [
    `${targetCookie}=; Path=/; Max-Age=0; SameSite=Lax`,
    `${directoryCookie}=; Path=/; Max-Age=0; SameSite=Lax`,
  ])
}

function json(res, code, body, extra) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...(extra || {}),
  })
  res.end(JSON.stringify(body))
}

function js(res, body) {
  res.writeHead(200, {
    "Content-Type": "application/javascript; charset=utf-8",
    "Cache-Control": "no-store",
  })
  res.end(body)
}

async function fetchJson(target, path) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), inspectTimeoutMs)
  const start = Date.now()
  try {
    const res = await fetch(`http://${target.host}:${target.port}${path}`, {
      headers: { Accept: "application/json" },
      signal: ctrl.signal,
    })
    if (!res.ok) throw new Error(`Upstream returned ${res.status}`)
    return { data: await res.json(), latencyMs: Date.now() - start }
  } catch (err) {
    if (err && err.name === "AbortError") throw new Error(`Timed out after ${inspectTimeoutMs}ms`)
    throw err
  } finally {
    clearTimeout(timer)
  }
}

function parseDirectory(value) {
  if (!value) return ""
  try {
    return decodeURIComponent(value)
  } catch {
    return String(value)
  }
}

function getDirectory(reqUrl, headers) {
  const cookies = parseCookies(headers.cookie)
  return parseDirectory(reqUrl.searchParams.get("directory") || cookies[directoryCookie] || "")
}

function latest(items) {
  return [...items].sort((a, b) => (b.time?.updated ?? b.time?.created ?? 0) - (a.time?.updated ?? a.time?.created ?? 0))[0]
}

function uniqueDirectories(items) {
  const seen = new Set()
  return items
    .map((item) => item?.directory)
    .filter((dir) => {
      if (!dir || seen.has(dir)) return false
      seen.add(dir)
      return true
    })
    .slice(0, maxProjects)
}

function classifyError(err, fallback) {
  const text = err instanceof Error ? err.message : String(err)
  return text || fallback
}

async function inspectTarget(target) {
  const result = {
    target,
    source: {
      kind: "cli",
      label: "Global CLI service",
    },
    health: {
      ok: false,
      healthy: false,
      version: null,
      latencyMs: null,
      error: null,
    },
    sessions: {
      ok: false,
      count: 0,
      directories: [],
      latest: null,
      error: null,
    },
    ready: false,
  }

  try {
    const { data, latencyMs } = await fetchJson(target, "/global/health")
    result.health = {
      ok: true,
      healthy: data?.healthy === true,
      version: data?.version || null,
      latencyMs,
      error: data?.healthy === true ? null : "OpenCode unhealthy",
    }
  } catch (err) {
    result.health.error = classifyError(err, "Health check failed")
    return result
  }

  try {
    const { data } = await fetchJson(target, `/session?limit=${maxSessions}`)
    const list = Array.isArray(data) ? data : []
    const root = latest(list)
    result.sessions = {
      ok: true,
      count: list.length,
      directories: uniqueDirectories(list),
      latest: root
        ? {
            id: root.id || null,
            title: root.title || null,
            directory: root.directory || null,
          }
        : null,
      error: list.length ? null : "Target is online but has no historical sessions",
    }
  } catch (err) {
    result.sessions.error = classifyError(err, "Session scan failed")
    return result
  }

  result.ready = Boolean(result.health.ok && result.health.healthy && result.sessions.ok && result.sessions.latest && result.sessions.latest.directory)
  return result
}

function bootstrap() {
  return `(function () {
  var key = 'opencode.global.dat:server'
  var origin = location.origin
  function read() { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } }
  function write(data) { localStorage.setItem(key, JSON.stringify(data)) }
  fetch('/__oc/meta', { credentials: 'same-origin' })
    .then(function (res) { return res.json() })
    .then(function (meta) {
      if (!meta || !meta.sessions || !Array.isArray(meta.sessions.directories) || !meta.sessions.directories.length) return
      var data = read()
      if (!Array.isArray(data.list)) data.list = []
      if (!data.projects || typeof data.projects !== 'object') data.projects = {}
      if (!data.lastProject || typeof data.lastProject !== 'object') data.lastProject = {}
      var existing = Array.isArray(data.projects[origin]) ? data.projects[origin] : []
      var merged = []
      var seen = new Set()
      meta.sessions.directories.forEach(function (dir, index) {
        if (!dir || seen.has(dir)) return
        seen.add(dir)
        merged.push({ worktree: dir, expanded: index === 0 })
      })
      existing.forEach(function (item) {
        var dir = item && item.worktree
        if (!dir || seen.has(dir)) return
        seen.add(dir)
        merged.push({ worktree: dir, expanded: Boolean(item.expanded) })
      })
      data.projects[origin] = merged
      if (meta.sessions.latest && meta.sessions.latest.directory) data.lastProject[origin] = meta.sessions.latest.directory
      write(data)
    })
    .catch(function () {})
})()`
}

function launchPage(payload) {
  const json = JSON.stringify(payload).replace(/</g, "\\u003c")
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenCode Launching</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top, #13233e 0, #08111d 46%); color: #eef4ff; font: 15px/1.5 Inter, "Segoe UI", sans-serif; }
    main { width: min(620px, 100%); border: 1px solid #20314b; border-radius: 22px; padding: 22px; background: rgba(13, 21, 35, .94); box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    h1 { margin: 0 0 10px; font-size: 28px; }
    p { margin: 0; color: #8fa6c7; }
    code { color: #d3e3ff; word-break: break-all; }
    .line { margin-top: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Launching Remote OpenCode</h1>
    <p>Seeding history for this browser origin before redirecting into the real session page.</p>
    <div class="line"><code id="status">Preparing...</code></div>
  </main>
  <script>
    const payload = ${json}
    const status = document.getElementById('status')
    const key = 'opencode.global.dat:server'
    const origin = location.origin
    function read() { try { return JSON.parse(localStorage.getItem(key) || '{}') } catch { return {} } }
    function write(data) { localStorage.setItem(key, JSON.stringify(data)) }
    function seed(meta) {
      const data = read()
      if (!Array.isArray(data.list)) data.list = []
      if (!data.projects || typeof data.projects !== 'object') data.projects = {}
      if (!data.lastProject || typeof data.lastProject !== 'object') data.lastProject = {}
      const seen = new Set()
      const merged = []
      ;(meta.sessions.directories || []).forEach(function (dir, index) {
        if (!dir || seen.has(dir)) return
        seen.add(dir)
        merged.push({ worktree: dir, expanded: index === 0 })
      })
      data.projects[origin] = merged
      if (meta.sessions.latest && meta.sessions.latest.directory) data.lastProject[origin] = meta.sessions.latest.directory
      write(data)
    }
    if (!payload.ready || !payload.sessions || !payload.sessions.latest || !payload.sessions.latest.directory || !payload.sessions.latest.id) {
      status.textContent = payload.health && payload.health.error ? payload.health.error : 'Target is not ready'
    } else {
      seed(payload)
      status.textContent = 'History seeded. Redirecting...'
      const next = '/session/' + encodeURIComponent(payload.launch.sessionID)
        + '?host=' + encodeURIComponent(payload.target.host)
        + '&port=' + encodeURIComponent(payload.target.port)
        + '&directory=' + encodeURIComponent(payload.launch.directory)
      location.replace(next)
    }
  </script>
</body>
</html>`
}

function inject(html) {
  const tag = '<script src="/__oc/bootstrap.js"></script>'
  if (html.includes(tag)) return html
  return html.replace("</head>", `${tag}</head>`)
}

function rewriteLocation(value, reqUrl, target) {
  if (!value || !value.startsWith("/")) return value
  const next = new URL(value, `http://${reqUrl.headersHost || "localhost"}`)
  next.searchParams.set("host", target.host)
  next.searchParams.set("port", target.port)
  if (reqUrl.directory && !next.searchParams.has("directory")) next.searchParams.set("directory", reqUrl.directory)
  return `${next.pathname}${next.search}${next.hash}`
}

function upstreamPath(reqUrl, directory) {
  const next = new URL(reqUrl.pathname, "http://upstream.local")
  reqUrl.searchParams.forEach((value, key) => {
    if (key === "host" || key === "port") return
    next.searchParams.set(key, value)
  })
  if (directory && !next.searchParams.has("directory")) next.searchParams.set("directory", directory)
  return `${next.pathname}${next.search}${reqUrl.hash}`
}

function landing(target) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>OpenCode Tailnet Router</title>
  <style>
    :root { color-scheme: dark; }
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px; background: radial-gradient(circle at top, #13233e 0, #08111d 46%); color: #eef4ff; font: 15px/1.5 Inter, "Segoe UI", sans-serif; }
    main { width: min(760px, 100%); background: rgba(13, 21, 35, .94); border: 1px solid #20314b; border-radius: 22px; padding: 22px; box-shadow: 0 20px 60px rgba(0,0,0,.35); }
    h1 { margin: 0; font-size: 30px; line-height: 1.12; }
    p { margin: 10px 0 0; color: #8fa6c7; }
    .grid { display: grid; grid-template-columns: 1fr 110px; gap: 12px; margin-top: 18px; }
    label { display: block; margin: 0 0 6px; color: #8fa6c7; font-size: 12px; text-transform: uppercase; letter-spacing: .04em; }
    input { width: 100%; height: 48px; border-radius: 12px; border: 1px solid #334155; background: #020617; color: #eef4ff; padding: 0 14px; font-size: 15px; }
    .actions { display: flex; gap: 10px; margin-top: 14px; flex-wrap: wrap; }
    button { display: inline-flex; align-items: center; justify-content: center; padding: 11px 15px; border-radius: 12px; border: 1px solid #334155; background: #101b2b; color: #eef4ff; cursor: pointer; font: inherit; }
    .primary { background: linear-gradient(180deg, #3d8cff, #2c7dff); border-color: #3279e7; }
    .status { margin-top: 14px; color: #8fa6c7; min-height: 20px; }
    .meta { margin-top: 14px; padding: 14px; border: 1px solid #20314b; border-radius: 14px; background: rgba(7, 12, 22, .92); display: grid; gap: 10px; }
    .line { display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; }
    .k { color: #8fa6c7; min-width: 108px; }
    .ok { color: #79e29b; }
    .bad { color: #f1bc65; }
    code { color: #d3e3ff; word-break: break-all; }
    ul { margin: 6px 0 0 18px; padding: 0; color: #d3e3ff; }
    @media (max-width: 640px) { .grid { grid-template-columns: 1fr; } .k { min-width: auto; } }
  </style>
</head>
<body>
  <main>
    <h1>OpenCode Tailnet Router</h1>
    <p>Enter the Tailscale IPv4 and port for a machine already running the CLI version of OpenCode web.</p>
    <div class="grid">
      <div><label for="host">Tailscale IPv4</label><input id="host" value="${escapeHtml(target.host)}" placeholder="100.x.x.x"></div>
      <div><label for="port">Port</label><input id="port" value="${escapeHtml(target.port)}" placeholder="3000"></div>
    </div>
    <div class="actions">
      <button id="open" class="primary" type="button">Open Remote OpenCode</button>
      <button id="check" type="button">Check</button>
      <button id="clear" type="button">Clear</button>
    </div>
    <div id="status" class="status"></div>
    <div id="meta" class="meta">Enter a target and click Check.</div>
  </main>
  <script>
    const host = document.getElementById('host')
    const port = document.getElementById('port')
    const status = document.getElementById('status')
    const meta = document.getElementById('meta')
    function validIp(value) {
      const parts = value.split('.')
      if (parts.length !== 4) return false
      return parts.every(function (part) {
        if (!part) return false
        if (!part.split('').every(function (char) { return char >= '0' && char <= '9' })) return false
        const num = Number(part)
        return Number.isInteger(num) && num >= 0 && num <= 255
      })
    }
    function cleanPort(value) {
      const chars = value.split('').filter(function (char) { return char >= '0' && char <= '9' }).join('')
      return chars || '3000'
    }
    function target() {
      const ip = host.value.trim()
      const p = cleanPort(port.value.trim() || '3000')
      if (!validIp(ip)) throw new Error('Invalid Tailscale IPv4')
      return { host: ip, port: p }
    }
    function renderMeta(data) {
      const healthOk = data.health && data.health.ok
      const sessionsOk = data.sessions && data.sessions.ok
      const healthText = healthOk ? '<span class="ok">healthy</span>' : '<span class="bad">' + (data.health && data.health.error ? data.health.error : 'unreachable') + '</span>'
      const versionText = data.health && data.health.version ? data.health.version : 'unknown'
      const latencyText = data.health && typeof data.health.latencyMs === 'number' ? data.health.latencyMs + ' ms' : 'n/a'
      const latestTitle = sessionsOk && data.sessions.latest ? (data.sessions.latest.title || data.sessions.latest.id || 'none') : 'none'
      const latestDir = sessionsOk && data.sessions.latest ? data.sessions.latest.directory : 'none'
      const directories = sessionsOk && Array.isArray(data.sessions.directories) && data.sessions.directories.length
        ? '<ul>' + data.sessions.directories.map(function (item) { return '<li><code>' + item + '</code></li>' }).join('') + '</ul>'
        : '<div class="bad">' + (data.sessions && data.sessions.error ? data.sessions.error : 'No restoreable directories found') + '</div>'
      meta.innerHTML = ''
        + '<div class="line"><span class="k">Target</span><code>' + data.target.host + ':' + data.target.port + '</code></div>'
        + '<div class="line"><span class="k">Source</span><code>' + ((data.source && data.source.label) || 'Global CLI service') + '</code></div>'
        + '<div class="line"><span class="k">CLI Version</span><code>' + versionText + '</code></div>'
        + '<div class="line"><span class="k">Health</span>' + healthText + '<span class="k">Latency</span><code>' + latencyText + '</code></div>'
        + '<div class="line"><span class="k">Latest Session</span><code>' + latestTitle + '</code></div>'
        + '<div class="line"><span class="k">Latest Directory</span><code>' + latestDir + '</code></div>'
        + '<div class="line"><span class="k">Directories</span></div>'
        + directories
    }
    async function inspect() {
      const t = target()
      status.textContent = 'Inspecting target...'
      const url = '/__oc/meta?host=' + encodeURIComponent(t.host) + '&port=' + encodeURIComponent(t.port)
      const res = await fetch(url, { credentials: 'same-origin' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || ('Request failed: ' + res.status))
      renderMeta(data)
      if (data.ready) { status.textContent = 'Target is ready'; return data }
      if (!data.health || !data.health.ok) throw new Error(data.health && data.health.error ? data.health.error : 'Target unreachable')
      if (!data.sessions || !data.sessions.ok) throw new Error(data.sessions && data.sessions.error ? data.sessions.error : 'Session scan failed')
      throw new Error('Target is online but has no restoreable session')
    }
    async function openLatest() {
      try {
        const t = target()
        status.textContent = 'Restoring history...'
        location.href = '/__oc/launch?host=' + encodeURIComponent(t.host) + '&port=' + encodeURIComponent(t.port)
      } catch (error) {
        status.textContent = error.message || String(error)
      }
    }
    document.getElementById('open').addEventListener('click', openLatest)
    document.getElementById('check').addEventListener('click', function () { inspect().catch(function (error) { status.textContent = error.message || String(error) }) })
    document.getElementById('clear').addEventListener('click', function () {
      host.value = ''
      port.value = '3000'
      status.textContent = ''
      meta.textContent = 'Enter a target and click Check.'
      fetch('/__oc/clear', { method: 'POST', credentials: 'same-origin' }).catch(function () {})
      host.focus()
    })
    for (const input of [host, port]) input.addEventListener('keydown', function (event) { if (event.key === 'Enter') openLatest() })
  </script>
</body>
</html>`
}

function proxyRequest(req, res, target, reqUrl) {
  const directory = getDirectory(reqUrl, req.headers)
  const options = {
    hostname: target.host,
    port: Number(target.port),
    method: req.method,
    path: upstreamPath(reqUrl, directory),
    headers: {
      ...req.headers,
      host: `${target.host}:${target.port}`,
      connection: req.headers.upgrade ? "upgrade" : "keep-alive",
      "accept-encoding": "identity",
    },
  }
  delete options.headers.cookie
  delete options.headers["content-length"]
  if (directory) options.headers["x-opencode-directory"] = directory
  const upstream = http.request(options, (up) => {
    const headers = { ...up.headers }
    const location = rewriteLocation(headers.location, { search: reqUrl.search, headersHost: req.headers.host, directory }, target)
    if (location) headers.location = location
    else delete headers.location
    const wantCookie = reqUrl.searchParams.has("host") || reqUrl.searchParams.has("port")
    if (wantCookie || directory) {
      headers["set-cookie"] = [
        `${targetCookie}=${target.host}:${target.port}; Path=/; Max-Age=2592000; SameSite=Lax`,
        ...(directory ? [`${directoryCookie}=${encodeURIComponent(directory)}; Path=/; Max-Age=2592000; SameSite=Lax`] : []),
      ]
    }
    const type = String(headers["content-type"] || "")
    if (!type.includes("text/html")) {
      res.writeHead(up.statusCode || 502, headers)
      up.pipe(res)
      return
    }
    const chunks = []
    up.on("data", (chunk) => chunks.push(chunk))
    up.on("end", () => {
      const body = inject(Buffer.concat(chunks).toString("utf8"))
      delete headers["content-length"]
      res.writeHead(up.statusCode || 200, headers)
      res.end(body)
    })
  })
  upstream.on("error", (err) => {
    if (res.headersSent || res.writableEnded || res.destroyed) return
    json(res, 502, { error: err.message })
  })
  req.on("data", (chunk) => upstream.write(chunk))
  req.on("end", () => upstream.end())
}

function writeUpgradeResponse(socket, response) {
  const lines = [`HTTP/1.1 ${response.statusCode || 101} ${response.statusMessage || "Switching Protocols"}`]
  for (const [key, value] of Object.entries(response.headers || {})) {
    if (Array.isArray(value)) value.forEach((item) => lines.push(`${key}: ${item}`))
    else if (value !== undefined) lines.push(`${key}: ${value}`)
  }
  lines.push("", "")
  socket.write(lines.join("\r\n"))
}

function proxyUpgrade(req, socket, head, target, reqUrl) {
  const directory = getDirectory(reqUrl, req.headers)
  const upstream = http.request({
    hostname: target.host,
    port: Number(target.port),
    method: req.method,
    path: upstreamPath(reqUrl, directory),
    headers: { ...req.headers, host: `${target.host}:${target.port}`, connection: "upgrade", ...(directory ? { "x-opencode-directory": directory } : {}) },
  })
  upstream.on("upgrade", (upRes, upSocket, upHead) => {
    writeUpgradeResponse(socket, upRes)
    if (head && head.length) upSocket.write(head)
    if (upHead && upHead.length) socket.write(upHead)
    upSocket.pipe(socket)
    socket.pipe(upSocket)
  })
  upstream.on("response", () => socket.destroy())
  upstream.on("error", () => socket.destroy())
  upstream.end()
}

const server = http.createServer(async (req, res) => {
  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
  const isLanding = !reqUrl.pathname || reqUrl.pathname === "/" || reqUrl.pathname === "/index.html" || reqUrl.pathname === "/__landing"
  if (isLanding) {
    const target = getTarget(reqUrl, req.headers, { allowEmpty: true, useCookie: false }) || { host: "", port: "3000" }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" })
    res.end(landing(target))
    return
  }
  if (reqUrl.pathname === "/__oc/clear") {
    clearTargetCookie(res)
    json(res, 200, { ok: true })
    return
  }
  const target = getTarget(reqUrl, req.headers)
  if (!target) {
    json(res, 400, { error: "Invalid target host or port" })
    return
  }
  const wantCookie = reqUrl.searchParams.has("host") || reqUrl.searchParams.has("port")
  if (reqUrl.pathname === "/__oc/bootstrap.js") {
    if (wantCookie) setTargetCookie(res, target)
    js(res, bootstrap())
    return
  }
  if (reqUrl.pathname === "/__oc/meta") {
    const payload = await inspectTarget(target)
    const directory = payload.sessions?.latest?.directory || getDirectory(reqUrl, req.headers)
    const extra = wantCookie || directory
      ? {
          "Set-Cookie": [
            `${targetCookie}=${target.host}:${target.port}; Path=/; Max-Age=2592000; SameSite=Lax`,
            ...(directory ? [`${directoryCookie}=${encodeURIComponent(directory)}; Path=/; Max-Age=2592000; SameSite=Lax`] : []),
          ],
        }
      : undefined
    json(res, 200, payload, extra)
    return
  }
  if (reqUrl.pathname === "/__oc/launch") {
    const payload = await inspectTarget(target)
    if (payload.ready && payload.sessions && payload.sessions.latest) payload.launch = { directory: payload.sessions.latest.directory, sessionID: payload.sessions.latest.id }
    const directory = payload.launch?.directory || getDirectory(reqUrl, req.headers)
    if (wantCookie || directory) setContextCookies(res, target, directory)
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" })
    res.end(launchPage(payload))
    return
  }
  if (wantCookie || getDirectory(reqUrl, req.headers)) setContextCookies(res, target, getDirectory(reqUrl, req.headers))
  proxyRequest(req, res, target, reqUrl)
})

server.on("upgrade", (req, socket, head) => {
  const reqUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`)
  const target = getTarget(reqUrl, req.headers)
  if (!target) {
    socket.destroy()
    return
  }
  proxyUpgrade(req, socket, head, target, reqUrl)
})

server.listen(bindPort, bindHost, () => {
  console.log(`OpenCode router listening on http://${bindHost}:${bindPort}`)
})
