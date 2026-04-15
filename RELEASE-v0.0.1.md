# OpenCode Tailnet Launcher v0.0.1

## Summary

- Silent Windows tray launcher for `opencode web`
- No automatic browser popups
- Auto-detects current Tailscale IPv4
- Keeps `opencode web` healthy on the configured port
- Single-exe portable release

## Files

- Release artifact: `OpenCodeTailnetLauncher.exe`
- Portable archive: `OpenCodeTailnetLauncher-v0.0.1-single.zip`
- Generated after first run: `oc-launcher.ini`, `logs\launcher.log`

## Commands

```powershell
OpenCodeTailnetLauncher.exe --install-autostart
OpenCodeTailnetLauncher.exe --remove-autostart
```

## Notes

- The launcher never opens the browser by itself.
- Double-clicking the tray icon opens the configured router page.
- Logs are written under `logs\launcher.log` beside the exe.
- If `oc-launcher.ini` is missing, the exe creates it automatically with defaults.
