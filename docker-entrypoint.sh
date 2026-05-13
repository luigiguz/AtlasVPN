#!/bin/sh
set -e
# Los volúmenes Docker suelen montarse como root; tunnel_manager escribe como usuario atlas (uid 1000).
mkdir -p /app/.atlasvpn /app/.cloudflared-tunnels
chown -R atlas:atlas /app/.atlasvpn /app/.cloudflared-tunnels
# Bind mount de scripts/ o tunnels.json desde el host (puede ser root)
chown -R atlas:atlas /app/scripts 2>/dev/null || true
exec gosu atlas "$@"
