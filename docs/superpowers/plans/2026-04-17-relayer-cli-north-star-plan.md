# Relayer → CLI North Star Plan

> **Status:** Draft  
> **Owner:** OpenCode relayer maintenance  
> **Decision date:** 2026-04-17  
> **Review lane:** stability-first / relayer-only / zero-intrusion upstream / rollback-first  
> **North star:** 把 relayer 从“能打开网页的中转页”升级为“在保留既有 landing / loading 体验的前提下，具备 CLI 级确定性、可恢复性、可观测性、可发布纪律的远程访问产品”。

> **Hard constraint:** 本文定义的是目标架构与产品北极星，**不自动授权当前稳定分支去重开浏览器热路径**。近期执行仍然必须服从 stability-first、rollback-first、freeze-surface 原则。

---

## 0. 一句话北极星

Relayer 的终态不是“继续补网页代理”，而是：

> **成为 OpenCode CLI 的远程接入与控制平面，让 Web 访问在保留既有 landing / loading 交互体验的同时，在正确性、可恢复性、可回滚性、可观测性上尽量接近本地 CLI 体验。**

这里的“升级到 CLI”不是去替代 upstream CLI，
而是要求 relayer 具备与 CLI 同等级别的产品纪律：

- 明确边界
- 明确真相源
- 明确失败模式
- 明确恢复路径
- 明确版本契约
- 明确发布与回滚纪律

没有这些，relayer 仍然只是一个脆弱的网页转发层。

---

## 1. 为什么必须重定义 relayer

当前 relayer 暴露出的问题，不是单点 bug，而是产品定义不清：

- `/` 到底是 landing、恢复入口、调试页，还是 app 首页，不清楚
- `host / port / client / workspace / session` 的权威关系不清楚
- 实时同步到底依赖 watcher、cache、disk hydrate，还是依赖 target 真相源，不清楚
- 后台调度在系统中的职责不清楚，结果变成前台和后台一起互相拖死
- 发布没有制品纪律，导致“本地以为修了，线上根本没跑到”

所以这份文档的目标不是“再列一堆 patch 任务”，而是先把 relayer 的产品定义钉死。

---

## 2. 产品定义：Relayer 到底是什么

## 2.1 正式定义

Relayer 是一个 **OpenCode remote access plane**，负责把本地/内网 OpenCode CLI 能力，稳定地、安全地、可恢复地投射到远端 Web 使用场景。

它不是：

- upstream OpenCode 的 fork
- OpenCode 的新核心 runtime
- 一个随手写的网页跳板
- 一个靠浏览器本地状态硬撑正确性的前端 hack

它是：

- **入口层**：把用户稳定带到正确 target
- **上下文层**：解析 target / browser / tab / workspace / session 的绑定关系
- **代理层**：承接 Web ↔ CLI 的请求与响应
- **同步层**：保证会话更新、message body、workspace 视图不会错乱
- **控制层**：负责负载保护、模式切换、自愈、观测、回滚
- **发布层**：保证线上运行物与发布物一致

## 2.2 Relayer 与 CLI 的关系

必须明确：

- **CLI 是业务真相源**
- **Relayer 是远程访问与保护层**
- **Web 是呈现层，不是权威层**

也就是说：

- session 真相属于 upstream OpenCode / CLI
- workspace/project 真相属于 upstream OpenCode / CLI
- relayer 负责把这些真相正确、安全、稳定地送到浏览器
- 浏览器里的 cache / bootstrap / localStorage 只能是兼容层，不是主权威

这条边界以后不能再模糊。

## 2.3 双层真相模型

为了避免“CLI 是真相源”被误读成“relayer 不该持有任何状态”，必须再补一条：

- **upstream 业务真相**：workspace / session / conversation / message / project
- **relayer 控制面真相**：claim / lease / last-known-good target / scheduler mode / health / release / manifest

原则：

- relayer 不得篡改 upstream 业务真相
- 但 relayer 必须对自己的控制面真相负责
- 任何控制面状态都必须服务于“正确传递 upstream 真相”，不能反过来覆盖 upstream 业务状态

---

## 3. 升级到 CLI，到底要达到什么标准

“升级到 CLI”不等于把网页做得更像桌面端，而是要求 relayer 满足 **CLI-grade operational bar**。

## 3.1 CLI 级标准

### A. 确定性（Determinism）

- 相同 target、相同 workspace、相同 session，在同样条件下得到同样结果
- 不能靠“猜 referer / 猜 cookie / 猜最新会话”维持正确性

### B. 真相源单一（Single authority）

- target 解析只有一套契约
- workspace 绑定只有一套契约
- session/message 正确性只有一套契约

### C. 前台优先（Foreground first）

- 页面打开、读取、发送消息必须永远优先于 warm/heavy/watcher
- 系统过载时先牺牲优化能力，不牺牲主要使用路径

### D. 故障可预期（Predictable failure）

- 出错时要么拒绝，要么降级，要么回滚
- 不能表现为“表面没报错，但 session/workspace 悄悄串了”

### E. 恢复可执行（Recoverability）

- relayer 重启后可恢复
- watcher 掉线后可恢复
- 目标短暂不可达后可恢复
- 发布失败后可回滚

### F. 可观测（Observability）

- 能看见当前 target、release、mode、队列深度、sync lag、fallback 次数
- 不能靠猜日志片段定位线上状态

### G. 可发布（Release discipline）

- 构建物可校验
- 部署物可比对
- 线上运行物可证明就是当前 release
- 回滚是脚本，不是记忆力

### H. 可扩展（Extensibility）

- 以后加能力时，不需要再碰高爆炸面的网页热路径
- 扩展应发生在契约层、控制层、发布层，而不是继续堆 `pages.js`

## 3.2 这意味着什么

如果一个版本：

- 只是“又把网页暂时拉起来了”
- 但上下文依旧靠猜
- 同步依旧靠侥幸
- 发布依旧可能漂移

那它就不配叫“CLI 级 relayer”。

---

## 4. Relayer 的北极星能力地图

Relayer 未来能力必须分层管理，不能再把所有能力糊成一团。

同时要明确：**CLI-grade 升级的是内核模式，不是把用户熟悉的入口体验删掉。**

- landing 页不能消失
- loading 页不能消失
- 用户进入、恢复、连接、等待的体感要与之前连续
- 真正要升级的是 landing/loading 背后的 target 绑定、claim、sync、scheduler、release discipline

## 4.1 核心能力（必须有）

### C1. 稳定入口能力

- `/` 作为 landing 入口
- landing 内承载恢复与手动连接
- loading 作为显式过渡页/态
- target-qualified URL 作为 canonical app 入口
- last-known-good target 恢复

### C1.1 体验连续性能力

- landing / loading 文案、布局、节奏保持连续
- 连接中、恢复中、失败回退都必须有明确 UI 态
- 禁止直接把用户从空白页硬切进 app 或硬打回裸文本错误

### C2. 显式上下文能力

- 明确 targetKey
- 明确 browserId / tabId / claimId
- 明确 workspace ownership
- 明确 session/conversation 归属

### C3. 正确性优先同步能力

- 写后 direct reconcile
- watcher 只做优化，不做唯一正确性来源
- polling fallback 必须存在

### C4. 负载保护能力

- foreground / sync / recovery / warm/heavy 分级
- 队列预算
- 去重 / 合并
- overload / degraded / safe-mode

### C5. 发布与回滚能力

- immutable artifact
- manifest 校验
- 原子切换
- 自动烟测
- 快速回滚

## 4.2 增强能力（稳定后再做）

### E1. 多 target 快速切换

- 最近 target 列表
- target 标签/命名
- target 健康状态摘要

### E2. 会话恢复体验增强

- 最近 workspace/session 恢复
- 断线后重连提示
- claim 失效后的 rebind 流程

### E3. 远程控制能力

- target 级控制面板
- safe-mode 手动切换
- watcher 状态可视化

### E4. 多客户端协同能力

- 多标签页并行浏览不串线
- 多浏览器实例共享读但不抢写
- 明确冲突提示

## 4.3 不应放进 relayer 的能力

以下能力不该由 relayer 承担：

- 重写 upstream OpenCode 的业务语义
- 替代 CLI 内部状态模型
- 接管 message 历史真相
- 用浏览器本地缓存定义服务端世界观
- 做一套和 upstream 长期分叉的 Web runtime

---

## 5. 边界定义

## 5.1 上游边界

Relayer 必须坚持零入侵 upstream：

- 不修改 upstream OpenCode 本体
- 不篡改 upstream session/message/project 的业务语义
- 不在 upstream 代码里埋补丁去救 relayer

## 5.2 前端边界

浏览器只负责：

- 展示
- 输入
- 承接 bridge 注入后的显式上下文
- 保存少量兼容 bootstrap 状态
- 承载 landing / loading 的体验连续性

浏览器不负责：

- 重新解释 target 权威
- 推断 workspace 真相
- 充当长期 state authority

## 5.3 服务端边界

Relayer 服务端负责：

- target 解析
- claim 签发
- ownership 校验
- 前后台流量隔离
- 同步和恢复机制
- 健康面与模式切换

它不负责：

- 改写 upstream 业务逻辑
- 长期保存与 upstream 相互冲突的业务状态

## 5.4 部署边界

部署系统必须保证：

- 发布物一致
- 环境变量清晰
- 文件 hash 可核对
- 回滚路径独立于当前候选版本

部署系统不该允许：

- 手工覆盖单文件
- 带着未知缓存直接切换版本
- 无自检直接接流量

---

## 6. 核心角色与职责模型

为了避免职责互相污染，必须把 relayer 里的角色讲清楚。

## 6.1 Target Router

职责：

- 解析 canonical target
- 决定 `/` 去哪
- 决定请求是否已经绑定 target

真相：

- query target
- signed target cookie
- explicit claim

禁止：

- 在 mutate/sync 上继续靠 referer/cookie 猜权威

## 6.2 Context Authority

职责：

- 生成和校验 browserId / tabId / claimId
- 给出 `(target, workspace, session)` 的绑定判定

真相：

- 单一 context authority 契约与实现模块

禁止：

- 让 `pages.js`、`cache.js`、`watcher.js` 各自维护一套隐式上下文逻辑

## 6.3 Sync Guardian

职责：

- 写后 reconcile
- watcher lease 管理
- polling fallback
- revision 正确性守卫

真相：

- 以 target/workspace/conversation/revision 为主键

禁止：

- 把 disk hydrate 当成最新消息来源

## 6.4 Scheduler Guard

职责：

- 分级队列
- 配额
- overload/safe-mode
- 自愈限流

禁止：

- 让后台预热挤占前台生命线
- 让自愈线程递归重入

## 6.5 Release Governor

职责：

- artifact / manifest / health gate / rollback

禁止：

- 未经校验的部署
- 未完成烟测即接流量

---

## 7. 一锤定音的入口规则

这个规则以后作为产品契约，不再摇摆。

## 7.1 `/` 的定义

`/` 是 **canonical landing entry**。

它必须一直存在，而且必须保留用户已习惯的入口体验。

`/` 上允许三种明确状态，但只允许这三种：

1. **manual connect**：没有可恢复 target 时，展示 landing 输入态
2. **restore loading**：有 `last-known-good target` 或显式 target 时，展示 loading 过渡态
3. **fail-closed fallback**：恢复/连接失败时，回到 landing 错误态

这意味着：

- `/` 不再是语义混乱的多态页
- 但 `/` 也不能被删成一个无 UI 的纯 302 跳板
- landing 页是产品入口，不是临时壳子

## 7.2 landing 页契约

landing 页负责：

- 输入 host/port
- 展示最近可恢复 target
- 展示连接前检查结果
- 承接显式恢复动作
- 在进入 app 前把用户送入 loading 态

landing 页不负责：

- 猜测式决定 workspace/session 权威
- 直接承担业务主界面
- 越权修改控制面状态

## 7.3 loading 页/态契约

loading 页/态必须保留，且不能只是一个装饰性 spinner。

它的职责是把“用户体验连续性”和“CLI-grade admission flow”接起来：

- 展示当前目标 target
- 展示当前阶段：restore / connect / bootstrap / sync bind
- 等待 claim 建立、关键 API 成功、sync 建链或 fallback 完成
- 成功后进入 canonical app URL
- 失败后返回 landing 错误态

loading 页/态不负责：

- 长期停留为业务页
- 隐藏错误细节到完全不可解释

## 7.4 `/connect` 的定义

`/connect` 不再是“替代 landing 的另一套首页”，而是 **landing 的显式手动连接模式别名**。

职责：

- 强制进入 manual connect 态
- 用于从错误恢复、分享手动连接入口、绕过自动恢复
- 与 `/` 共享同一套 landing 体验和同一套 target contract

## 7.4.1 canonical URL 契约

canonical app URL 必须满足：

- 能唯一表达 target
- 可分享、可收藏、可重放
- 不把敏感短期控制面令牌直接暴露为长期 URL 参数

约束：

- target 信息可以出现在 URL
- `claimId` 不应作为长期可分享 URL 的一部分
- 短期绑定信息应通过受控注入、cookie 或首屏协商建立，而不是要求用户拷贝带临时令牌的链接

## 7.5 last-known-good target 的定义

只有在以下三件事都成功后，才允许更新：

1. 首屏 bootstrap 成功
2. 至少一个关键 API 成功
3. 至少一个 sync 通道成功建链或成功 fallback

否则不能把该 target 记为“last-known-good”。

还必须定义：

- **作用域**：至少绑定到 browser 级身份，不做全局匿名共享
- **TTL**：过旧 target 不能无限期当作恢复入口
- **失效条件**：连续失败、manifest 重大变更、显式断开、回滚后契约不兼容
- **清理规则**：回滚或 target 明确失效后，禁止继续拿旧 target 做“错误学习”

## 7.6 restore fail-closed 规则

恢复链必须失败关闭：

- `/` 最多做一次自动恢复尝试
- 自动恢复阶段必须经过 loading 页/态，而不是直接黑箱跳转
- 恢复成功则进入 canonical app URL
- 恢复失败则回到 landing 错误态；用户可继续手动连接或转入 `/connect`
- 必须给出可解释原因，例如：target 失效、契约不兼容、claim 协商失败、关键 API 不通

不允许：

- 在 `/` 上无限重试
- JS 多轮猜测式跳转
- 失败后仍停留在一个语义不清的半路页面
- 跳过 landing/loading 直接把体验做成“空白 → app / 错误”硬切换

---

## 8. 能力契约：从网页代理升级到 CLI 级产品

## 8.1 Target Contract

- 所有读取请求最终都必须能落到唯一 targetKey
- 所有变更/同步请求必须带显式 claim
- target 解析必须可审计、可解释

## 8.2 Identity Contract

- browserId：浏览器级持久身份
- tabId：标签页级瞬时身份
- claimId：服务端签发的绑定令牌

绑定粒度：

- `(browserId, tabId, targetKey, workspaceId)`

## 8.3 Workspace Contract

- workspace 读可共享
- workspace 写有 lease
- lease 冲突时必须失败关闭，不允许 silent steal

## 8.4 Conversation Contract

- message body 以 revision 为权威
- 老 revision 不能压新 revision
- 发送消息后必须 direct reconcile
- watcher 失败时自动退 polling

## 8.5 Scheduler Contract

- foreground 永远优先
- sync 次优先
- recovery 限频单工
- warm/heavy 最先降级或丢弃

## 8.6 Cache Contract

- cache 是衍生物，不是 authority
- cache schema 必须版本化
- 不兼容版本不能共享缓存

## 8.7 Health Contract

最少必须暴露：

- `livez`
- `readyz`
- `healthz`
- `modez`

每个响应都应能关联：

- releaseId
- manifestHash
- schedulerMode

## 8.8 Version Compatibility Contract

必须显式管理版本偏斜：

- 旧 tab + 新服务端
- 新 tab + 旧服务端
- 候选版本回滚到上一稳定版

规则：

- bundle 与 server 的 contract version 不兼容时，必须显式拒绝或强制刷新
- 不能静默退回猜测式上下文继承
- cache bucket 必须按 schema / release / contract version 隔离
- 恢复入口不得跨越不兼容 contract version 盲目复用 last-known-good target

---

## 9. 运行模式与故障模型

## 9.1 Normal

- foreground / sync / recovery / warm 全开
- watcher 正常工作
- last-known-good target 可更新
- landing / loading 流程完整且可解释

## 9.2 Degraded

- watcher 部分退化
- sync 允许更多 polling fallback
- warm/heavy 收缩预算

## 9.3 Safe-mode

触发条件示例：

- 队列持续高水位
- watcher 大面积失效
- sync lag 超阈值
- 关键 API 错误率超阈值

这些阈值必须：

- 有明确默认值
- 可配置
- 可观测
- 与 release 一起版本化记录

行为：

- 停掉 warm/heavy
- recovery 限频
- sync 以保守模式运行
- 优先保证打开页面、查看 session、发送消息

## 9.4 Rollback mode

- 候选版本自动退回上一稳定制品
- 清理候选缓存桶
- 停止 last-known-good target 的错误学习

---

## 10. 成熟度阶梯：什么才算真正“升级到 CLI”

Relayer 必须分级收口，不再靠一句“已经稳定了”。

## Level 0 — Page Proxy

特征：

- 只能偶尔把页面打开
- correctness 靠缓存和 luck
- 发布靠手工

这不是可交付产品。

## Level 1 — Stable Browser Entry

要求：

- landing / loading 体验稳定且连续
- `/` 与 `/connect` 语义稳定
- target-qualified URL 稳定
- fresh/incognito 可进入 app

## Level 2 — Context Safe Relayer

要求：

- target/workspace/session 不串线
- 显式 claim 生效
- mutate/sync 不再靠猜

## Level 3 — Sync Safe Relayer

要求：

- direct reconcile + fallback 生效
- 实时同步有 SLA
- watcher 失效不致命

## Level 4 — Operable Product

要求：

- 健康面完整
- safe-mode 生效
- 压测可存活
- 24h soak 不塌

## Level 5 — CLI-grade Remote Access Plane

要求：

- 发布物、运行物、回滚链、观测链完整闭环
- 用户把它当作长期生产入口使用，不再担心“下一次刷新会不会全坏”

只有到 Level 5，才配说 relayer 已经升级到 CLI 级标准。

---

## 11. 未来扩展时的红线

以后允许扩展能力，但不允许再破坏以下边界。

## 11.1 可以扩展的方向

- 多 target 管理
- 更好的 target 选择 UI
- target 标签/收藏/健康分
- 更强的 control plane
- 更好的 remote diagnostics
- 更好的多客户端协作体验

## 11.2 不允许扩展的方向

- 继续把复杂策略堆进 `pages.js`
- 继续让 `cache.js` 决定正确性
- 继续让 disk cache 参与 authority 竞争
- 继续把 referer/cookie 当 mutate/sync 真相源
- 继续手工热修线上文件

---

## 12. 近期路线图：从现在走到 CLI-grade

## Phase A — 定义收口

目标：先把产品契约钉死。

动作：

- [ ] 固化 landing / loading / `/` / `/connect` 契约
- [ ] 固化 target / identity / workspace / conversation / scheduler / health 契约
- [ ] 明确文件职责冻结表

## Phase B — 正确性收口

目标：不再串 target、串 workspace、串 message。

动作：

- [ ] 显式 claim 全链路生效
- [ ] workspace writer lease 生效
- [ ] direct reconcile + fallback 生效

## Phase C — 生存性收口

目标：压不死、挂了能恢复。

动作：

- [ ] 分级队列生效
- [ ] safe-mode 生效
- [ ] health 指标闭环

## Phase D — 发布纪律收口

目标：不再发生部署漂移。

动作：

- [ ] immutable artifact
- [ ] manifest 校验
- [ ] 原子切换
- [ ] 自动烟测
- [ ] 自动回滚

## Phase E — CLI-grade 验证

目标：证明它是产品，不是 patch 集合。

动作：

- [ ] browser smoke
- [ ] fresh/incognito gate
- [ ] workspace switch gate
- [ ] realtime sync gate
- [ ] stress gate
- [ ] recovery gate
- [ ] deployment parity gate
- [ ] 24h soak gate

---

## 13. 明确不做什么

这份北极星文档不是要把 relayer 做成另一个 OpenCode，也不是要追求一次性大重构。

明确不做：

- 不改 upstream OpenCode
- 不发明第二套业务模型
- 不靠 feature flag 矩阵掩盖定义不清
- 不把所有未来能力一次塞进当前版本
- 不在没有闸门的情况下追求“更实时”“更智能”“更自动”

先做到 CLI 级稳定，再谈更花的体验。

---

## 14. 最终判断

Relayer 的终局不该是“更复杂的网页补丁器”，而应是：

> **一个以 upstream CLI 为真相源、以显式上下文契约为骨架、以同步守卫与调度保护为内核、以发布回滚纪律为底座的远程访问产品。**

如果未来每次改动都能回答下面这六个问题，relayer 才算真的在向 CLI-grade 收敛：

1. 它有没有破坏单一真相源？
2. 它有没有让上下文更显式，而不是更依赖猜测？
3. 它有没有让前台主路径更稳，而不是更脆？
4. 它有没有给出可验证的恢复与回滚路径？
5. 它有没有减少热路径复杂度，而不是继续把逻辑堆进网页层？
6. 它有没有通过完整闸门，而不是只在一次手工测试里看起来“好了”？

只有持续满足这六条，relayer 才不是半成品。
