# OpenCode Tailnet Launcher

Single-exe Windows tray launcher for keeping `opencode web` alive, plus a small VPS router that pre-seeds OpenCode history before redirecting into the real session page.

## What It Does

- Runs as a silent Windows tray app
- Never opens a browser on its own
- Detects the current Tailscale IPv4 and keeps `opencode web` healthy on the configured port
- Exposes a public router entrypoint that:
- checks remote OpenCode health
- reads recent sessions
- seeds same-origin browser state
- redirects to the exact remote session route

## Repo Layout

- `launcher/`: Windows tray launcher source and build scripts
- `router/`: Node-based VPS router source
- `deploy/`: example `systemd` and `nginx` configs
- `docs/`: release notes and deployment notes

## Launcher

The launcher is a single-exe portable app at runtime.

- First run can be just `OpenCodeTailnetLauncher.exe`
- If `oc-launcher.ini` is missing, it generates one beside the exe
- Logs are written to `logs/launcher.log`

### Commands

```powershell
OpenCodeTailnetLauncher.exe --install-autostart
OpenCodeTailnetLauncher.exe --remove-autostart
```

## VPS Router

The router is designed to sit behind `nginx` and a public hostname.

- `GET /`: landing page
- `GET /__oc/meta`: health + session inspection
- `GET /__oc/launch`: pre-seed localStorage then redirect to the exact session route
- everything else: transparent proxy to the remote `opencode web`

## Security

- This repo does not contain any real VPS credentials
- This repo uses example hostnames and paths only
- Do not commit real SSH passwords, real domains, or real certificates

## Build

Windows launcher build uses the built-in .NET Framework C# compiler on Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\launcher\build-oc-launcher.ps1
```
