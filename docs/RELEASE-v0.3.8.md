# RELEASE v0.3.8

## 定位

`v0.3.8` 是当前 relayer CLI 的**稳定正式基线**。

它不是最终完美版本，但已满足作为 `0.3.9` 唯一开发起点的要求：

- 默认主路径可进入 Web
- send 可用
- landing / loading 保持薄层
- session jump / workspace switch / archive 主链可用
- safe 模式下可免刷新同步
- `80/200` message 视图一致

## 边界

- CLI-first
- launcher-managed backend truth only
- synthetic `relay:*` 不进入默认控制面
- 不把 Desktop UI/runtime/default-server/recent-projects 当作默认真相层

## 封板时的已知事项

- 当前线上环境可能仍通过运维环境变量覆盖 `X-Relayer-Release` / `Contract` / `Manifest`。
- 这不影响 `v0.3.8` 作为 Git 正式基线成立，但后续部署应显式对齐版本头。
- `unarchive` 当前未在 UI 中暴露，因此验收记为 `N/A`，不算 blocker。

## 最低验收摘要

- `verify-launch-gate.js`：通过
- `verify-fresh-browser-gate.js`：通过
- `_verify-workspace-switch.js`：通过
- isolated live send probe：通过
- isolated live archive probe：通过
- refresh continuity：通过
- `verify-safe-auto-refresh.js`：通过
- `80/200` consistency：通过

## 恢复说明

### Git 恢复

```bash
git fetch --tags
git checkout v0.3.8
```

### 从 bundle 恢复（若使用离线归档）

```bash
git clone opencode-tailscale-v0.3.8.bundle opencode-tailscale-restore
cd opencode-tailscale-restore
git checkout v0.3.8
```

## 之后的版本策略

- `v0.3.8`：冻结封板版本
- `0.3.9`：从 `v0.3.8` 开新分支继续开发
