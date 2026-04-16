# v0.1.9 Fast Rollback

## Principle
Rollback is always bundle-based, never ad-hoc file editing on live traffic.

## Order
1. Switch runtime bundle back to the exact `v0.1.9` file set.
2. If state pollution is suspected, clear relayer cache.
3. Restart service.
4. Re-run browser smoke.
5. Re-run fresh browser / incognito gate.

## Soft kill-switches
Use only if a partial candidate is still running:

```bash
OPENCODE_ROUTER_ENABLE_PROGRESS_QUERY_OVERRIDE=0
OPENCODE_ROUTER_HEALTHZ_DEBUG=0
```

## Hard service restart

```bash
sudo systemctl restart opencode-router.service
```

## Success criteria
- browser smoke 5/5
- fresh browser gate pass
- `healthz = ready`
