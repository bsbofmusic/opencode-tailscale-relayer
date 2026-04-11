"use strict"

const { backgroundWarmPaused, setLastReason, setClientHeads, setSyncState } = require("../state")
const { cacheKey, uniqueDirectories } = require("../util")
const { emitTargetEvent } = require("./bus")
const { saveStateCache } = require("./disk-cache")

async function tickWatcher(state, config) {
  if (state.watcherBusy || !state.meta?.ready || !state.clients.size) return
  if (state.promise) return
  if (state.backoffUntil && state.backoffUntil > Date.now()) return
  state.watcherBusy = true
  const { fetchJson, fetchJsonWith, buildMeta, rememberList } = require("../warm")
  try {
    const protectedMode = backgroundWarmPaused(state)
    const wasOffline = state.offline
    const health = await fetchJson(state.target, "/global/health", config)
    const sessions = await fetchJsonWith(state.target, `/session?limit=${config.directoryDiscoveryLimit || config.maxSessions || 80}`, { state, priority: "background", heavy: true }, config)

    state.offline = false
    state.offlineReason = null

    const prevList = JSON.stringify(state.sessionList)
    state.sessionList = Array.isArray(sessions.data) ? sessions.data : []
    state.meta = buildMeta(state.target, health.data, state.sessionList, health.latencyMs, config)
    state.metaAt = Date.now()
    for (const dir of uniqueDirectories(state.sessionList, config.maxProjects || 12)) rememberList(state, dir, 55)

    if (prevList !== JSON.stringify(state.sessionList)) {
      emitTargetEvent(state.target, "session-list-updated", {
        count: state.sessionList.length,
        latestID: state.meta?.sessions?.latest?.id || null,
      })
    }

    const entries = protectedMode ? activeEntries(state) : [...state.messages.entries()]
    for (const [entryKey, entry] of entries) {
      const next = await fetchJsonWith(
        state.target,
        `/session/${encodeURIComponent(entry.sessionID)}/message?limit=${entry.limit}&directory=${encodeURIComponent(entry.directory)}`,
        { state, priority: protectedMode ? "foreground" : "background", heavy: true },
        config,
      )
      if (next.text === entry.body) continue
      const prevHead = headFromBody(entry.sessionID, entry.directory, entry.body)
      const nextHead = headFromBody(entry.sessionID, entry.directory, next.text)
      const prevCount = prevHead.messageCount
      const nextCount = nextHead.messageCount
      state.messages.set(entryKey, {
        ...entry,
        body: next.text,
        type: "application/json",
        at: Date.now(),
      })
      emitTargetEvent(state.target, "message-appended", {
        sessionID: entry.sessionID,
        directory: entry.directory,
        limit: entry.limit,
        previousCount: prevCount,
        nextCount,
      })
      for (const client of state.clients.values()) {
        const view = client.view || (client.activeSessionID && client.activeDirectory
          ? { sessionID: client.activeSessionID, directory: client.activeDirectory }
          : null)
        if (!view) continue
        if (view.sessionID !== entry.sessionID || view.directory !== entry.directory) continue
        if (sameHead(prevHead, nextHead)) continue
        if (entry.baseline) {
          setClientHeads(state, client, nextHead, nextHead)
          setSyncState(client, state.offline ? "offline" : "live", null, "noop")
          continue
        }
        const viewHead = client.remoteHead?.sessionID ? client.remoteHead : prevHead
        setClientHeads(state, client, viewHead, nextHead)
        setSyncState(client, "stale", "head-advanced", client.lastAction || "noop")
        emitTargetEvent(state.target, "sync-stale", {
          client: client.id,
          sessionID: entry.sessionID,
          directory: entry.directory,
          reason: "head-advanced",
          action: client.lastAction || "noop",
          state: client.syncState,
          version: state.syncVersion,
          timestamp: Date.now(),
        })
      }
    }

    saveStateCache(state, config)

    if (wasOffline) {
      emitTargetEvent(state.target, "target-health-changed", { healthy: true })
    }
  } catch (err) {
    const becameOffline = !state.offline
    state.offline = true
    state.offlineReason = err.message
    state.failureReason = err.message
    state.failureCount += 1
    state.lastFailureAt = Date.now()
    state.backoffUntil = state.meta ? Date.now() + Math.min(15000, state.failureCount * 2000) : 0
    state.targetStatus = "offline"
    setLastReason(state, null, "watcher-offline")
    if (becameOffline) {
      for (const client of state.clients.values()) {
        setSyncState(client, "offline", "target-offline", "noop")
        emitTargetEvent(state.target, "sync-stale", {
          client: client.id,
          sessionID: client.activeSessionID || null,
          directory: client.activeDirectory || null,
          reason: "target-offline",
          action: "noop",
          state: client.syncState,
          version: state.syncVersion,
          timestamp: Date.now(),
        })
      }
      emitTargetEvent(state.target, "target-health-changed", { healthy: false, error: err.message })
    }
  } finally {
    state.watcherBusy = false
  }
}

function headFromBody(sessionID, directory, body) {
  let rows = []
  try {
    rows = JSON.parse(body || "[]")
  } catch {}
  if (!Array.isArray(rows)) rows = []
  const tail = rows.length ? rows[rows.length - 1] : null
  return {
    sessionID,
    directory,
    messageCount: rows.length,
    tailID: tail?.info?.id || tail?.id || null,
  }
}

function sameHead(a, b) {
  return Boolean(
    a &&
    b &&
    a.sessionID === b.sessionID &&
    a.directory === b.directory &&
    a.messageCount === b.messageCount &&
    a.tailID === b.tailID
  )
}

function activeEntries(state) {
  const entries = new Map()
  for (const client of state.clients.values()) {
    const sessionID = client.activeSessionID || client.view?.sessionID
    const directory = client.activeDirectory || client.view?.directory
    if (!sessionID || !directory) continue
    const key = cacheKey(directory, sessionID, 80)
    entries.set(key, state.messages.get(key) || {
      sessionID,
      directory,
      limit: 80,
      body: "[]",
      at: 0,
      baseline: true,
    })
  }
  return [...entries.entries()]
}

function startWatcher(state, config) {
  const interval = Number(config?.watchIntervalMs || 0)
  if (!interval || state.watcherTimer) return
  state.watcherTimer = setInterval(() => {
    void tickWatcher(state, config)
  }, interval)
  state.watcherTimer.unref?.()
}

function stopWatcher(state) {
  if (!state.watcherTimer) return
  clearInterval(state.watcherTimer)
  state.watcherTimer = undefined
}

module.exports = {
  tickWatcher,
  startWatcher,
  stopWatcher,
}
