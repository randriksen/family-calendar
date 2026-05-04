#!/bin/sh
# Ensure /data and /data/uploads are writable by the nextjs user (uid 1001).
# This handles bind-mounted volumes that may be owned by root on the host.
chown -R 1001:1001 /data 2>/dev/null || true
exec su-exec nextjs node server.js
