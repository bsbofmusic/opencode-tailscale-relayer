# OpenCode Tailnet Relayer v0.1.10 Stable Plan

> **Status:** Replanned after incident recovery  
> **Baseline:** Accurate `v0.1.9` live runtime  
> **Priority:** Stability first, zero-intrusion, rollback-first

---

## 1. Current Truth

Current live has been recovered to an accurate `v0.1.9` runtime bundle and is now the **only known-good baseline**.

Verified now:

- browser smoke: **5/5 passed**
- fresh browser / incognito gate: **passed**
- `healthz = ready`
- workspace roots visible:
  - `D:\CODE`
  - `D:\CODE\opencode-tailscale`
  - `E:\CODE`

This baseline must remain frozen while `0.1.10` is redesigned.

---

## 2. One-Sentence Mainline

`0.1.10` should do only one thing:

> **Turn the verified `v0.1.9` runtime into a release unit that is more observable, more rollback-safe, and slightly better isolated on the server side — without touching the browser hot path again.**

This means:

- do **not** continue patching `pages.js / proxy.js / cache.js / disk-cache.js`
- do **not** continue experimenting in browser/runtime space
- do **not** treat feature flags as a substitute for stability

---

## 3. Freeze Surface

## 3.1 Files that must stay frozen

Do not touch these in `0.1.10`:

- `router/pages.js`
- `router/routes/proxy.js`
- `router/routes/cache.js`
- `router/sync/disk-cache.js`
- upstream OpenCode itself

Reason:

- these are the highest blast-radius surfaces
- recent incidents proved that extending them quickly destroys the web UI

## 3.2 Files that may be touched carefully

Only these low-blast-radius server-side surfaces may enter `0.1.10`:

- `router/routes/control.js`
- `router/warm.js`
- `router/sync/watcher.js`
- deploy / systemd / nginx / rollout scripts
- verification scripts
- docs / runbooks / manifests

---

## 4. Phase Plan

## P0 — Freeze and Observe

### Goal

Make `v0.1.9` reproducible and non-accidental.

### Required actions

- [ ] Export a release manifest for the exact `v0.1.9` runtime bundle
- [ ] Record the current VPS deployment checksum / file list
- [ ] Preserve a hard rollback target:
  - git/tag rollback
  - VPS file rollback
  - cache kill-switch rollback
- [ ] Run browser smoke twice, not once
- [ ] Run fresh browser gate twice, not once

### Exit criteria

- `v0.1.9` is proven repeatable
- rollback source is explicit and tested

---

## P1 — Smallest Server-Side Closure

### Goal

Improve server-side resilience without changing browser/runtime semantics.

### Allowed changes

1. **`healthz` debug gating**
   - default minimal output
   - detailed debug only when explicitly enabled

2. **`/progress` override gating**
   - default disabled
   - explicit header feedback when override is attempted

3. **`/project` invalid JSON local isolation**
   - bad `/project` response must not poison the whole target state
   - watcher should degrade locally, not globally

### Not allowed

- no new runtime flags
- no browser bootstrap changes
- no project rewrite semantic changes
- no cache/hydrate strategy expansion

### Exit criteria

- all three server-side closures pass gates without changing the browser behavior envelope

---

## P2 — Low-Risk Reinforcement

### Goal

Strengthen release engineering, not runtime cleverness.

### Allowed work

- [ ] dual-slot deployment (A = current stable, B = candidate)
- [ ] immutable release manifest
- [ ] rollback script
- [ ] cache isolation per slot/version
- [ ] preflight checks for:
  - service status
  - `healthz`
  - fresh browser workspace roots
  - launcher ↔ relayer minimal contract

### Exit criteria

- release can be deployed and rolled back by script, not memory

---

## P3 — Rollout and Rollback

### Goal

Ship boldly but only because rollback is trivial.

### Rollout order

1. Build candidate from `v0.1.9` branch
2. Deploy to B slot only
3. Run all gates against B slot
4. Observe 15–30 minutes
5. Switch traffic to B only if all gates remain green
6. Keep A slot intact until post-switch observation passes

### Rollback order

1. If page-level failure appears:
   - immediately route back to A slot (`v0.1.9`)
2. If only local server-side regression appears:
   - disable new server-side flags
   - restart service
3. If state pollution remains:
   - switch to memory-only
   - disable hydrate
   - clear relayer cache directory

### Mandatory rollback handles

- exact `v0.1.9` bundle
- one-command feature kill-switch
- cache/hydrate kill-switch

---

## 5. Mandatory Gates

`0.1.10` is not allowed to ship unless all of the following pass:

1. **browser smoke**
   - existing smoke suite 5/5 passes

2. **fresh browser / incognito gate**
   - enters session successfully
   - shows roots:
     - `D:\CODE`
     - `D:\CODE\opencode-tailscale`
     - `E:\CODE`

3. **workspace switch**
   - switch repeatedly between `D:\CODE`, `D:\CODE\opencode-tailscale`, `E:\CODE`
   - no jump-back
   - no wrong session cross-over

4. **archive**
   - archive does not revive after refresh or reopen

5. **message append**
   - new messages append monotonically
   - no old body revival

6. **rollback drill**
   - candidate → `v0.1.9` rollback must complete and restore green gates

---

## 6. Explicit Do-Not-Do List

Do not do these in `0.1.10`:

- do not extend `pages.js`
- do not re-open `proxy.js` HTML injection logic
- do not change message body authority rules again
- do not add more feature-flag matrix to browser/runtime surfaces
- do not redesign `state.js` authority model in this version
- do not use live users as the experiment harness

---

## 7. Final Decision

The real stable `0.1.10` should not try to be a big architecture leap.

It should be:

> **`v0.1.9` runtime, frozen as the known-good core, plus the smallest possible server-side resilience and rollback engineering.**

Anything beyond that belongs to a later version.
