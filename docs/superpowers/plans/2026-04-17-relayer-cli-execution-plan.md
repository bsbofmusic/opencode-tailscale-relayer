# Relayer → CLI Execution Plan

> **Status:** Final pre-implementation plan  
> **Owner:** OpenCode relayer maintenance  
> **Decision date:** 2026-04-17  
> **Review lane:** stability-first / zero-intrusion upstream / rollback-first / preserve landing-loading UX  
> **Purpose:** 这是落地编码前的最后一次细分规划。下一步只做两件事：**实现** 与 **验证**。
> **Version-line decision:** 本文不覆盖 `docs/RELEASE-v0.1.10-plan.md` 对 `v0.1.10 stable` 的冻结规则。本文定义的是 **next 版本线（`v0.1.11+ / next candidate`）** 的执行计划；只有 candidate 全量通过后，才允许讨论新的 stable tag。

---

## 0. 执行总判断

当前不需要再做“大方向讨论”。

现在已经明确：

- 不能继续把 relayer 当作脆弱网页转发层修修补补
- 也不能为了“升级到 CLI”而把用户熟悉的 landing / loading 体验删掉
- 这次落地必须把 **体验层保持连续**，把 **内核层升级为 CLI-grade contract**

所以这次执行的核心目标只有一句话：

> **在保留原有 landing / loading 体验和 upstream OpenCode 使用体感的前提下，把 relayer 的 target/context/sync/scheduler/release 机制升级到可压测、可恢复、可回滚、可验证的 CLI-grade。**

---

## 1. 产品硬约束（非协商）

以下条目全部是本次执行的硬约束，不允许在实现阶段被“临时调整”。

### 1.1 八大原则

- 稳定化
- 高效化
- 智能化
- 通用化
- 闭环思维
- 长期主义
- 上帝视角
- 第一性原理

其中本次最高优先级是：

- **稳定性第一**
- **可验证第二**
- **可回滚第三**

### 1.2 upstream 边界

- 不修改 upstream OpenCode 本体
- 不改 upstream session / workspace / message / project 业务语义
- 不把 relayer 的补丁埋进 upstream 去救场

### 1.3 体验边界

- landing 页必须保留
- loading 页/态必须保留
- 与原生 OpenCode Web 的主要使用体感尽量一致
- relayer 只做映射、保护、治理，不改业务体验主语义

### 1.4 稳定性硬指标

- 压测不能把前台主路径打烂
- 实时同步不能继续靠侥幸
- workspace 和 session 加载必须稳定
- fresh browser / incognito 必须稳定
- 任何候选版本必须可一键回滚

---

## 2. 本次执行的终态定义

只有同时满足下面五条，才算本次落地完成：

1. **入口稳定**：landing / loading / target-qualified URL 三者语义清晰、体验连续
2. **上下文稳定**：target / browser / tab / workspace / session / conversation 不串线
3. **同步稳定**：发送消息后 direct reconcile 生效；watcher 异常时 polling fallback 生效
4. **调度稳定**：压力下 foreground 仍存活，warm/heavy 能主动降级
5. **发布稳定**：候选版本的 build、deploy、manifest、health、rollback 全部可验证

---

## 3. 执行基线与止损锚点

## 3.1 唯一已知基线

当前唯一已知稳定基线仍然是：

- **准确 `v0.1.9` live runtime**

在这个基线上，已有文档与已验证资产：

- `docs/RELEASE-v0.1.10-plan.md`
- `docs/RUNBOOK-v0.1.10-stable.md`
- `docs/VERIFY-v0.1.10-stable.md`
- `verify-stable-gates.js`
- `verify-fresh-browser-gate.js`

## 3.2 执行前止损要求

在开始编码前，必须先具备以下止损锚点：

- [ ] 当前 stable 运行物 manifest
- [ ] 当前 VPS 关键文件 hash
- [ ] 当前稳定配置快照
- [ ] 当前缓存目录隔离策略
- [ ] 当前一键回滚路径

如果这些东西不完整，先补齐，再改代码。

## 3.3 候选发布纪律

本次实现不允许直接打 stable 主槽位。

只能走：

1. 从稳定基线切 candidate
2. 在 candidate 槽位部署
3. 在 candidate 上跑全量 gates
4. 观察通过后再切流量
5. 保留旧 stable 槽位直到 soak 完成

## 3.4 执行前必须先量化的口径

以下口径不允许边做边猜，必须在打开高 blast-radius surface 之前先钉死到配置或文档：

- **safe-mode 触发/退出阈值**
  - queue high-watermark
  - sync lag 阈值
  - 关键 API 错误率阈值
  - 恢复回 normal 的持续观察窗口
- **stress gate 通过标准**
  - 压测机器规格
  - 并发打开数
  - 活跃会话数
  - 持续时长
  - 可接受错误率 / p95 / p99 / 恢复时长
- **last-known-good target 规则**
  - scope
  - TTL
  - 失效条件
  - 回滚后是否清理

如果这些口径没有先写死，后续验证全部不算数。

---

## 4. 本次执行的范围与非范围

## 4.1 本次执行范围（必须做）

### A. 入口与 admission flow

- 固化 landing / loading / `/` / `/connect` 契约
- 保证恢复、手动连接、失败回退语义统一
- 保证 target-qualified URL 是 canonical app 入口

### B. 上下文与身份契约

- targetKey 规范化
- browserId / tabId / claimId 契约
- mutate/sync 路径显式 claim 化

### C. workspace / session 正确性

- workspace ownership
- writer lease
- session / conversation 绑定

### D. realtime sync 守卫

- 写后 direct reconcile
- watcher 仅做优化
- polling fallback
- revision 正确性

### E. 调度与保护

- foreground / sync / recovery / warm/heavy 分级
- safe-mode
- queue budget / drop / TTL / dedupe

### F. 发布与回滚纪律

- immutable artifact
- manifest
- slot deploy
- health gates
- rollback drill

## 4.2 本次非范围（明确不做）

- 不改 upstream OpenCode
- 不重写 upstream Web runtime
- 不搞“更炫”的新 UI
- 不追求一次性做完所有未来 control plane 能力
- 不把 launcher 或其他仓边界问题捆进本次稳定化落地

---

## 5. 文件边界与改动许可表

这次落地必须按文件 blast radius 执行，不能无边界扩写。

| Surface | 状态 | 允许动作 | 备注 |
|---|---|---|---|
| `router/pages.js` | **bounded touch** | 只允许收口 landing / loading / admission flow 展示与桥接 | 不允许继续堆隐式状态策略 |
| `router/context.js` | **primary authority** | 允许集中 target / identity / claim / ownership 解析 | 应成为单一上下文真相层 |
| `router/routes/proxy.js` | **bounded touch** | 只允许 bridge 注入、显式 claim 传递、canonical 入口协商 | 不允许塞调度策略 |
| `router/routes/cache.js` | **bounded touch** | 只允许 cache authority 去权、revision key、reconcile 相关收口 | 不允许继续承担 ownership 判定 |
| `router/sync/disk-cache.js` | **freeze unless forced** | 默认冻结；只有在验证证据证明必须改时才小范围改 | 需单独 gate |
| `router/warm.js` | **allowed** | roots / meta / fallback / local isolation | 不得反向定义业务真相 |
| `router/sync/watcher.js` | **allowed** | watcher lease、tracked budget、fallback 协同 | watcher 不是 authority |
| `router/state.js` | **primary authority** | scheduler mode / lease state / health state | 不能再分散权威 |
| `router/heavy.js` | **allowed** | heavy queue / TTL / drop / overload | 不得反向抢占 foreground |
| `router/routes/control.js` | **allowed** | livez/readyz/healthz/modez/diagnostics | 不承担业务判断 |
| deploy / verify / docs | **allowed** | manifest / rollout / gate / rollback | 必须同步更新 |

实现纪律：

- 每个 workstream 只能打开自己必要的 surface
- 每打开一个高 blast-radius surface，必须新增对应 gate
- 如果某个改动要求同时重写 `pages.js + proxy.js + cache.js + disk-cache.js`，立即拆分，不允许 bundling

---

## 6. 总体执行顺序

执行顺序必须严格按照依赖关系推进：

1. **W0：基线与回滚链补齐**
2. **W1：入口/admission flow 收口**
3. **W2：上下文/claim/ownership 收口**
4. **W3：workspace/session 加载正确性收口**
5. **W4：realtime sync 收口**
6. **W5：scheduler/safe-mode 收口**
7. **W6：发布与观测链收口**
8. **W7：全量验证、压测、恢复、浸泡**

为什么必须这么排：

- 入口不稳，后面所有验证都不可信
- 上下文不稳，同步和 workspace 全是假象
- 同步不稳，压测结果没有意义
- 发布链不稳，任何“通过”都不可信

---

## 7. 详细工作流拆分

## W0 — 基线、Manifest、回滚链先补齐

### 目标

让后续任何失败都能退回一个已知可用的状态。

### 必做项

- [ ] 导出当前 stable manifest
- [ ] 记录 VPS 当前关键文件 hash
- [ ] 固化 stable 配置快照
- [ ] 固化 contract version 标识
- [ ] 固化 cache bucket 隔离键：schema / release / contract version
- [ ] 明确 slot A / slot B 路径
- [ ] 补全一键回滚脚本与文档
- [ ] 把响应头挂上 `X-Relayer-Release` / `X-Relayer-Manifest`
- [ ] 明确 safe-mode 阈值、stress gate 阈值、last-known-good target 规则

### 涉及文件

- deploy / rollout scripts
- `router/routes/control.js`
- docs / runbooks / manifests

### 完成标准

- manifest 可生成、可核对
- rollback 在不改代码前提下可执行
- candidate/stable 版本可从外部请求直接辨认
- contract version 与 cache bucket 隔离已生效
- 后续验证口径已写死，不需要临场拍脑袋

### 止损

- 如果这一阶段做不稳，后续编码全部暂停

---

## W1 — landing / loading / admission flow 收口

### 目标

在不改变用户熟悉体验的前提下，把入口语义从“混乱 landing”收口成“稳定 landing + loading + canonical target entry”。

### 产品决策（执行中不得摇摆）

- `/` = canonical landing entry
- landing 页保留
- loading 页/态保留
- `/connect` = landing 的手动连接别名模式
- target-qualified URL = canonical app 入口

### 必做项

- [ ] 明确 landing 的三种状态：manual connect / restore loading / fail-closed error
- [ ] 明确 loading 的阶段展示：restore / connect / bootstrap / sync bind
- [ ] 收口 last-known-good target 更新条件
- [ ] 收口 restore fail-closed 流程
- [ ] admission flow 遵守 contract version / cache isolation 规则，不与 stable 污染
- [ ] 把 landing/loading 的体验变化控制在“用户看起来仍是同一产品”范围内

### 涉及文件

- `router/pages.js`
- `router/context.js`
- 少量 `router/routes/proxy.js`（仅入口协商需要时）

### 明确禁止

- 不允许删 landing
- 不允许删 loading
- 不允许把 `/` 做成无 UI 的纯 302 跳板
- 不允许继续在入口页塞入新的隐式权威逻辑

### 验证

- [ ] 无历史 target：进入 landing 手动连接态
- [ ] 有历史 target：进入 loading 恢复态，再进 app
- [ ] 恢复失败：回 landing 错误态
- [ ] 刷新、前进、后退、重复打开，不出现 root 语义漂移

### 止损

- 如果此阶段必须重开大面积 HTML 注入逻辑，先停，改为引入更薄的 admission bridge，而不是继续扩写页面拼装

---

## W2 — target / identity / claim / ownership 收口

### 目标

把“靠 referer/cookie 猜上下文”的旧路径改成“显式上下文 + 失败关闭”的新路径。

### 必做项

- [ ] 规范化 canonical targetKey
- [ ] browserId / tabId / claimId 契约落地
- [ ] mutate / sync 请求强制带 claim
- [ ] claim 与 `(browserId, tabId, targetKey, workspaceId)` 绑定
- [ ] referer/cookie 只保留只读兜底，不再承担写路径权威

### 涉及文件

- `router/context.js`
- `router/routes/proxy.js`
- 必要时新建轻量 context/claim helper

### 明确禁止

- 不允许让 `pages.js`、`cache.js`、`watcher.js` 各管一套 client 解释
- 不允许把短期 claim 暴露成可长期分享 URL

### 验证

- [ ] 无 claim 的 mutate 请求失败关闭
- [ ] 无 claim 的 sync 请求失败关闭或仅只读降级
- [ ] 同 browser 多 tab 不串 workspace
- [ ] 同 target 多窗口不会 silent steal

### 止损

- 如果为了 claim 化必须大改 upstream 请求语义，立即停；改由 relayer bridge 做最小承接

---

## W3 — workspace / session 加载稳定性收口

### 目标

让 workspace roots、当前 project、session rail、conversation 视图稳定，不再出现 D/E 抢权或 session 误归属。

### 必做项

- [ ] workspace ownership 与 writer lease 落地
- [ ] session / conversation key 与 target/workspace 绑定
- [ ] roots refresh 与 current project 解耦，避免展示便利层反过来定义主权威
- [ ] fresh/incognito bootstrap 幂等化

### 涉及文件

- `router/context.js`
- `router/warm.js`
- `router/routes/cache.js`
- 少量 `router/pages.js`

### 明确禁止

- 不允许 `/project` rewrite 决定真正 workspace authority
- 不允许 cache entry 决定当前 session 真相

### 验证

- [ ] D / E workspace 反复切换无串线
- [ ] roots 列表稳定可见
- [ ] current project 不反向污染会话视图
- [ ] fresh/incognito 连续进入成功

### 止损

- 如果必须重写 project/caching 整体模型，暂停当前 workstream，先基于 authority 收口最小修复，不做 broad refactor

---

## W4 — realtime sync 收口

### 目标

让实时同步从“尽量同步”升级成“有正确性守卫、有退路的同步机制”。

### 必做项

- [ ] 发送消息后 direct reconcile
- [ ] watcher lease 管理
- [ ] revision key 引入 message authority
- [ ] watcher 失败时自动切 polling fallback
- [ ] sync lag / fallback count / reconcile status 可观测

### 涉及文件

- `router/sync/watcher.js`
- `router/routes/cache.js`
- `router/warm.js`
- `router/routes/control.js`

### 明确禁止

- 不允许 disk hydrate 把旧 revision 盖回新 revision
- 不允许 watcher 失败后静默卡死

### 验证

- [ ] 两标签页同 conversation 双向发送消息稳定同步
- [ ] watcher 停掉后自动降级 polling 仍可用
- [ ] old body / old revision 不复活
- [ ] append 单调递增

### 止损

- 如果 direct reconcile 需要引入大规模新 transport，先停，优先用现有 HTTP 路径完成正确性，再谈更实时

---

## W5 — scheduler / overload / safe-mode 收口

### 目标

把“后台自燃带崩前台”收口成“前台保活、后台降级、失败可解释”。

### 必做项

- [ ] foreground / sync / recovery / warm/heavy 分级
- [ ] queue hard cap / soft limit / TTL / dedupe
- [ ] client / target 预算
- [ ] recovery 单工与限频
- [ ] safe-mode 触发/退出规则

### 涉及文件

- `router/state.js`
- `router/heavy.js`
- `router/index.js`
- `router/sync/watcher.js`
- `router/routes/control.js`

### 明确禁止

- 不允许 foreground 与 heavy 共命运
- 不允许自愈线程递归重入
- 不允许 overload 时继续扩大后台刷新面

### 验证

- [ ] 100 并发打开 + 20 活跃会话同步不拖死前台
- [ ] overload 时 warm/heavy 优先降级
- [ ] healthz / modez 能准确反映 scheduler 状态
- [ ] safe-mode 可自动进入并可恢复退出

### 止损

- 如果队列策略需要“智能动态调参”才能跑稳，先拒绝；第一版只接受保守固定预算

---

## W6 — 发布、观测、回滚链收口

### 目标

避免再出现“本地代码有，线上没部署”或“候选版本不可证明”的漂移事故。

### 必做项

- [ ] immutable artifact
- [ ] manifest.json
- [ ] 启动前导出符号/配置自检
- [ ] slot deploy / atomic switch
- [ ] livez / readyz / healthz / modez 完整化
- [ ] cache bucket 按 schema/release/contract version 隔离

### 涉及文件

- deploy scripts
- `router/routes/control.js`
- docs / manifests / rollout assets

### 验证

- [ ] live manifestHash = artifact manifestHash
- [ ] 两个槽位版本可区分
- [ ] 候选失败可自动或半自动回滚
- [ ] 回滚后旧缓存不会污染当前版本

### 止损

- 如果部署流程仍依赖手工替换单文件，则本次版本不得叫 stable

---

## W7 — 全量验证与准入闸门

### 目标

把“看起来好了”升级成“有证据证明它能稳定工作”。

### Gate 1 — Browser smoke

- [ ] `/` landing 正常
- [ ] loading 正常
- [ ] 直开 target-qualified URL 正常
- [ ] 不出现 root 语义错乱

### Gate 2 — Fresh / incognito

- [ ] 干净 profile 连续通过
- [ ] 无痕模式连续通过
- [ ] bootstrap 键正确且幂等

### Gate 3 — Workspace / session

- [ ] D / E / main roots 切换稳定
- [ ] 无 jump-back
- [ ] 无 session rail 串线

### Gate 4 — Realtime sync

- [ ] 双标签消息互通稳定
- [ ] append 单调递增
- [ ] watcher 故障自动 fallback

### Gate 5 — Archive / stale prevention

- [ ] archive 不复活
- [ ] old body 不复活
- [ ] old revision 不压新 revision

### Gate 6 — Stress

- [ ] 并发打开压力
- [ ] 活跃对话同步压力
- [ ] 30 分钟持续压测
- [ ] foreground 存活、错误率受控

### Gate 7 — Recovery

- [ ] 进程重启恢复
- [ ] watcher kill 恢复
- [ ] target 短时不可达恢复
- [ ] network flap 恢复

### Gate 8 — Deploy parity

- [ ] manifest 对齐
- [ ] candidate / stable slot 分离
- [ ] rollback drill 通过

### Gate 9 — Soak

- [ ] 24h 真 VPS + 真 tailnet + 真浏览器浸泡

---

## 8. 实施批次与交付顺序

本次实现不应一次性大爆炸提交，必须拆批次落地。

## Batch 1 — Admission + Context skeleton

目标：先让入口和上下文链站稳。

包含：

- W0 全部
- W1 主体
- W2 主体

交付物：

- landing / loading 契约落实
- claim skeleton 落实
- candidate 槽位可验证

放行条件：

- Browser smoke 全绿
- root / landing / loading 行为稳定

## Batch 2 — Workspace / Session / Sync correctness

目标：把真正用户最痛的使用链收口。

包含：

- W3 主体
- W4 主体

交付物：

- workspace ownership
- session/conversation binding
- direct reconcile + fallback

放行条件：

- workspace/session gate 通过
- realtime sync gate 通过
- archive/stale prevention gate 通过

## Batch 3 — Scheduler / Release hardening

目标：把“能用”变成“压不烂、可回滚”。

包含：

- W5 主体
- W6 主体

交付物：

- safe-mode
- queue budget
- manifest / slot / rollback 闭环

放行条件：

- stress gate 通过
- recovery gate 通过
- deploy parity gate 通过

## Batch 4 — Final candidate verification

目标：拿到能称之为 stable candidate 的证据。

包含：

- W7 全部

交付物：

- full gate evidence
- soak result
- release recommendation

---

## 9. 验证资产补齐清单

为了让下一个阶段直接进入实现和验证，需要先准备这些资产：

- [ ] 更新 `verify-stable-gates.js`
- [ ] 新增 landing/loading gate
- [ ] 新增 realtime sync gate
- [ ] 新增 stress / recovery / parity gate
- [ ] 更新 runbook
- [ ] 更新 rollback 文档
- [ ] 生成 candidate manifest 模板

---

## 10. 失败判定与回退规则

实现过程中，出现下面任一情况，必须立即停止继续扩写，转入回退或拆分：

- landing / loading 体验明显断裂
- workspace 或 session 出现新的串线
- sync 正确性下降
- 需要同时重写多个高 blast-radius surface 才能解释得通
- candidate 无法清晰证明自己跑的是哪一版
- 压测结果显示 foreground 路径仍会被后台拖死

回退原则：

1. 优先回退候选槽位，不碰 stable 槽位
2. 优先关新 contract / 新 bridge / 新 scheduler 行为，不动 upstream 兼容骨架
3. 必要时回退到准确 `v0.1.9` 运行物

---

## 11. 完成定义（Definition of Done）

只有同时满足以下条件，本次版本才允许被认为进入 stable 候选：

- [ ] landing / loading 体验连续
- [ ] root / manual connect / restore flow 清晰且可解释
- [ ] target / workspace / session / conversation 不串线
- [ ] realtime sync 有 direct reconcile 和 fallback
- [ ] 压测下 foreground 存活，后台可降级
- [ ] health / mode / manifest / release 观测完整
- [ ] 回滚 drill 通过
- [ ] 24h soak 通过

少一项都不算完成。

---

## 12. 最终执行口令

从现在开始，执行阶段必须遵守下面这句总口令：

> **体验上像原生 OpenCode Web，边界上零入侵 upstream，内核上按 CLI-grade contract 落地，验证上按 stable product 标准放行。**

如果任何实现动作不能同时满足这四点，就不应该进入下一步编码。
