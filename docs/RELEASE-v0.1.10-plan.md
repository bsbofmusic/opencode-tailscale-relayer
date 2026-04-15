# OpenCode Tailnet Relayer v0.1.10 Plan

## 目标

`v0.1.10` 的目标不是继续堆补丁，而是把高风险行为收口成：

- 可关
- 可灰度
- 可回退
- 可观测

同时保持 **零入侵 upstream OpenCode**。

## 本次必做

1. 高风险行为 feature-flag 化
2. `warm.js` 坏 JSON 隔离
3. `/__oc/healthz` 默认降敏
4. `/__oc/progress` query override 收口并可关闭

## 推荐环境变量

```bash
OPENCODE_ROUTER_ENABLE_SYNC_RUNTIME=1
OPENCODE_ROUTER_ENABLE_BROWSER_BOOTSTRAP=1
OPENCODE_ROUTER_ENABLE_AUTO_SOFT_REFRESH=1
OPENCODE_ROUTER_ENABLE_AUTO_REENTER=1
OPENCODE_ROUTER_ENABLE_PROGRESS_QUERY_OVERRIDE=1
OPENCODE_ROUTER_HEALTHZ_DEBUG=0
OPENCODE_ROUTER_ENABLE_PROJECT_REWRITE=1
OPENCODE_ROUTER_ENABLE_SYNTHETIC_PROJECTS=1
OPENCODE_ROUTER_INJECT_MODE=legacy-strip-csp
OPENCODE_ROUTER_CACHE_MODE=disk
OPENCODE_ROUTER_ENABLE_DISK_HYDRATE=1
```

## 一键回退建议

如果线上行为异常，优先回退为保守配置：

```bash
OPENCODE_ROUTER_ENABLE_SYNC_RUNTIME=0
OPENCODE_ROUTER_ENABLE_BROWSER_BOOTSTRAP=1
OPENCODE_ROUTER_ENABLE_AUTO_SOFT_REFRESH=0
OPENCODE_ROUTER_ENABLE_AUTO_REENTER=0
OPENCODE_ROUTER_ENABLE_PROGRESS_QUERY_OVERRIDE=0
OPENCODE_ROUTER_HEALTHZ_DEBUG=0
OPENCODE_ROUTER_ENABLE_PROJECT_REWRITE=1
OPENCODE_ROUTER_ENABLE_SYNTHETIC_PROJECTS=1
OPENCODE_ROUTER_INJECT_MODE=legacy-strip-csp
OPENCODE_ROUTER_CACHE_MODE=memory-only
OPENCODE_ROUTER_ENABLE_DISK_HYDRATE=0
```

然后：

```bash
sudo systemctl restart opencode-router.service
```

## 发布门禁

发布当天至少通过：

1. `/__oc/healthz` 正常
2. `verify-launch-gate.js` desktop/mobile 双通过
3. fresh browser / incognito 有 workspace roots
4. session 切换不回跳、不串古早消息
5. archive 不 revive

## 禁止项

- 不修改 upstream OpenCode
- 不重做 `state.js` 多状态模型
- 不把 `message body` 重新回到强缓存权威路线
- 不扩大 watcher 写权限
