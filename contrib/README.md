# Contrib Assets

This folder contains optional deployment helpers.

## Files

- `family-calendar.service`: systemd unit for running the app directly on Linux hosts (for example Proxmox LXC without Docker).

## Usage

1. Copy the service file to `/etc/systemd/system/`.
2. Adjust paths and user if needed.
3. Reload systemd and enable the service.

```bash
sudo cp contrib/family-calendar.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now family-calendar
```
