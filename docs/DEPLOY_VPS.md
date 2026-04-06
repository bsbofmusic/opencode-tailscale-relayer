# VPS Deploy

## Files

- `router/vps-opencode-router.js`
- `deploy/systemd/opencode-router.service.example`
- `deploy/nginx/opencode-router.conf.example`

## Suggested Paths

- router app dir: `/opt/opencode-router`
- systemd unit: `/etc/systemd/system/opencode-router.service`
- nginx conf: `/etc/nginx/conf.d/opencode-router.conf`

## Steps

1. Copy `router/vps-opencode-router.js` to `/opt/opencode-router/`.
2. Copy the example systemd unit and adjust paths if needed.
3. Copy the example nginx config and replace `your-domain.example.com`.
4. Reload `systemd` and `nginx`.
5. Start the router service.

## Example Commands

```bash
sudo mkdir -p /opt/opencode-router
sudo cp vps-opencode-router.js /opt/opencode-router/
sudo cp opencode-router.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now opencode-router.service
sudo nginx -t && sudo systemctl reload nginx
```
