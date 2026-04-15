# Quick Deploy Checklist

> 目标：让外部用户在 **10 分钟内**完成 relayer 部署，并能和 Windows launcher 联动成功。

---

## 1. 你需要准备什么

- 一台 Linux VPS
- 一个已经解析到 VPS 的 HTTPS 域名
- 一台安装了 Tailscale 的 Windows 机器
- Windows 机器上可访问的 `opencode web`（默认 `3000`）
- launcher 下载地址：
  - `https://github.com/bsbofmusic/opencode-tailnet-launcher-windows/releases/tag/v0.0.1`

---

## 2. VPS 侧最小部署

### 2.1 复制源码

把本仓复制到 VPS，例如：

```bash
/opt/opencode-router
```

### 2.2 正式入口

relayer 正式入口是：

```bash
node /opt/opencode-router/router/vps-opencode-router.js
```

### 2.3 使用模板

- systemd：`deploy/systemd/opencode-router.service.example`
- nginx：`deploy/nginx/opencode-router.conf.example`

### 2.4 systemd 关键项

至少确认：

- `WorkingDirectory=/opt/opencode-router`
- `ExecStart=/usr/bin/node /opt/opencode-router/router/vps-opencode-router.js`
- `OPENCODE_ROUTER_HOST=127.0.0.1`
- `OPENCODE_ROUTER_PORT=33102`

### 2.5 nginx 关键项

至少确认：

- 你的真实域名已经替换 `your-domain.example.com`
- TLS 证书路径正确
- 反代目标是：`http://127.0.0.1:33102`

---

## 3. Launcher ↔ Relayer 联动最小契约

launcher 要能正常联动 relayer，必须满足以下 4 条：

1. relayer 对外必须是 HTTPS 域名
2. launcher `router_url` 必须指向这个域名，例如：

```ini
router_url=https://your-domain.example.com/?autogo=1
```

3. launcher `port` 必须等于 Windows 上 `opencode web` 实际监听端口（默认 `3000`）
4. 如果希望 relayer 把这个目标识别为 launcher-managed，必须配置：

```bash
OPENCODE_ROUTER_LAUNCHER_HOSTS=100.x.x.x
```

多个主机可以逗号分隔：

```bash
OPENCODE_ROUTER_LAUNCHER_HOSTS=100.x.x.x,100.y.y.y
```

---

## 4. 部署后必须验证的 5 件事

### 4.1 VPS 本地健康

```bash
sudo systemctl status opencode-router.service
curl http://127.0.0.1:33102/__oc/healthz
```

期望：

- service 是 `active (running)`
- healthz 返回 `{"ok":true,...}`

### 4.2 公网入口正常

```bash
curl -I https://your-domain.example.com/
```

期望：

- HTTPS 正常

### 4.3 项目/workspace 暴露正常

```bash
curl "https://your-domain.example.com/project?host=100.x.x.x&port=3000"
```

期望：

- 返回 `D:\CODE` / `E:\CODE` 等 worktree

### 4.4 launcher 能打开 relayer

双击 launcher 托盘图标，期望：

- 打开的是 public relayer URL
- 不是本地 raw upstream URL

### 4.5 fresh browser / 无痕模式验证

必须再用无痕模式打开一次，确认：

- 能看到 workspace roots
- 不是只有旧浏览器可用

---

## 5. 常见失败点

### 看不到工作区

先查：

- `/__oc/meta`
- `/project`
- fresh browser 是否拿到了：
  - `opencode.global.dat:server`
  - `opencode.global.dat:globalSync.project`
  - `opencode.settings.dat:defaultServerUrl`

### launcher 打开了，但不是 launcher-managed

先查：

- `router_url` 是否正确
- `OPENCODE_ROUTER_LAUNCHER_HOSTS` 是否配置
- Windows 本机端口是否真的是 `3000`

### 页面能开，但内容不对

先查：

- `/session/:id/message?limit=80` 是否绕过 stale body
- relayer 是否已部署到 `v0.1.8+`

---

## 6. 最低可交付标准

如果以下 5 条同时成立，就算“别人拿仓能较快部署成功”：

- relayer service 跑起来
- HTTPS 入口正常
- launcher 能打开 public relayer
- fresh browser 能看到工作区
- 进入 session 后内容正常
