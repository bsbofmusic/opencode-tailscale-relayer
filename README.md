# OpenCode Tailnet Launcher

> Windows tray launcher for `opencode web`.

## What it is

This repository contains the **Windows launcher only**.

It runs as a tray app and keeps local `opencode web` healthy on the configured port.
It does **not** contain the VPS relayer source.

## Release artifact

- `OpenCodeTailnetLauncher.exe`
- `OpenCodeTailnetLauncher-v0.0.1-single.zip`

## Quick start

1. Download the latest launcher release.
2. Run `OpenCodeTailnetLauncher.exe`.
3. If no config exists, it creates `oc-launcher.ini` beside the exe.
4. Double-click the tray icon to open the configured router URL.

## Config

See:
- `launcher/oc-launcher.ini.example`

Main fields:
- `cli_path`
- `port`
- `cors_origin`
- `router_url`
- `poll_seconds`
- `auto_start`

## Build

```powershell
powershell -ExecutionPolicy Bypass -File .\launcher\build-oc-launcher.ps1
```

## Versioning

- Launcher version line is independent from the relayer.
- This repository starts with `v0.0.1` as the standalone launcher release baseline.

## Related repo

Relayer source lives in the main repo:
- `https://github.com/bsbofmusic/opencode-web-tailscale-launcher-relayer`
