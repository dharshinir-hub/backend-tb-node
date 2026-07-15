# Docker Build & Deployment Guide

## Changes in This Version (v0.2)

- ✅ Email notifications for IDLE alerts
- ✅ Multiple recipient support
- ✅ Smart server check (only activates with smart.yantra)
- ✅ Customer filtering for email notifications
- ✅ Comprehensive logging and diagnostics

## Quick Start

### 1. Build Docker Image

```bash
cd /root/surin/status_threshold/backend-tb-node

# Build the image locally
docker build -t dharshiniradhakrishnan/status-threshold:v0.2 .

# Or use docker-compose (builds automatically)
docker-compose build
```

### 2. Verify .env Configuration

Before running, ensure `.env` has all required settings:

```env
# ThingsBoard Connection
TB_BASE_URL=http://smart.yantra24x7.com:8080
TB_USERNAME=pms@gmail.com
TB_PASSWORD=pmspms
TB_INSECURE_TLS=1

# MQTT Configuration
MQTT_BROKER=mqtt://smart.yantra24x7.com:1884

# Customer & Email Configuration
customer_name=Precicraft CNC Works
email_from=your-email@gmail.com
email_pass=your-app-password
email_to=recipient1@example.com,recipient2@example.com
```

### 3. Run with Docker Compose

```bash
# Start the container
docker-compose up -d

# View logs
docker-compose logs -f status-threshold

# Stop the container
docker-compose down
```

### 4. Run with Docker (standalone)

```bash
# Build
docker build -t status-threshold:v0.2 .

# Run with environment file
docker run -d \
  --name status-threshold \
  --env-file .env \
  -e TZ=Asia/Kolkata \
  -e NODE_ENV=production \
  --restart unless-stopped \
  status-threshold:v0.2

# View logs
docker logs -f status-threshold

# Stop
docker stop status-threshold
docker rm status-threshold
```

## Configuration

The container loads configuration from:
1. `.env` file (primary)
2. Environment variables (override)

### Required Variables
```env
TB_BASE_URL          # ThingsBoard URL (must contain "smart.yantra" for email)
TB_USERNAME          # ThingsBoard username
TB_PASSWORD          # ThingsBoard password
TB_INSECURE_TLS      # 1 for self-signed certificates, 0 for production
MQTT_BROKER          # MQTT broker URL (optional)
```

### Email Configuration (Optional)
```env
email_from           # Gmail sender address
email_pass           # Gmail app password
email_to             # Recipients (comma-separated for multiple)
customer_name        # "all" or customer names (comma-separated)
```

## Image Details

- **Base Image**: `node:20-alpine` (lightweight)
- **Size**: ~200MB
- **Node Version**: 20 LTS
- **Package**: npm ci --omit=dev (production dependencies only)

## Environment Variables in Container

The docker-compose.yml automatically loads:
- `.env` file via `env_file`
- `TZ=Asia/Kolkata` for shift calculations
- `NODE_ENV=production` for optimized mode

## Logging

View container logs:
```bash
# Real-time logs
docker-compose logs -f status-threshold

# Last 100 lines
docker-compose logs --tail=100 status-threshold

# Since specific time
docker-compose logs --since 2h status-threshold
```

### Log Examples
```
[2026-07-15T10:30:45.123Z] [TB1] ✓ Logged in. Loading customers and devices...
[2026-07-15T10:30:46.456Z] [TB1] [Precicraft CNC Works] PCW-VMC-02 — idle:10s
[2026-07-15T10:30:50.123Z] [TB1] ✓ WebSocket connected.
[2026-07-15T10:30:51.789Z] [TB1] Subscribed to 21 device(s) via WebSocket.
[2026-07-15T10:35:00.000Z] [TB1] ALERT — Precicraft CNC Works/PCW-VMC-02: Machine Idle
[2026-07-15T10:35:00.123Z] [TB1] ✓ Email sent to 2 recipient(s) — "Machine Idle"
```

## Troubleshooting

### Container exits immediately
```bash
# Check logs
docker-compose logs status-threshold

# Common issues:
# - Missing .env file
# - Invalid ThingsBoard credentials
# - Network connectivity issues
```

### Email not working
```bash
# Check if smart.yantra is in TB_BASE_URL
grep TB_BASE_URL .env

# Verify email configuration
grep email .env

# Test email functionality
docker exec status-threshold node test-email-alert.js
```

### Port or container name conflicts
Edit `docker-compose.yml`:
```yml
container_name: status-threshold-prod
image: dharshiniradhakrishnan/status-threshold:v0.2-prod
```

## Deployment Checklist

- [ ] Update `docker-compose.yml` image version if needed
- [ ] Verify `.env` has correct credentials
- [ ] Ensure `TB_BASE_URL` contains "smart.yantra"
- [ ] Configure email settings (email_from, email_pass, email_to)
- [ ] Set customer_name for email filtering
- [ ] Build image: `docker build -t dharshiniradhakrishnan/status-threshold:v0.2 .`
- [ ] Start container: `docker-compose up -d`
- [ ] Verify logs: `docker-compose logs -f`
- [ ] Test with: `docker exec status-threshold node test-email-alert.js`

## Version History

### v0.2 (Current)
- Email notifications for IDLE alerts
- Multiple recipient support
- Smart server check
- Customer filtering
- Comprehensive logging

### v0.1
- Basic status monitoring
- Web notifications only
- WebSocket subscription

## Support

For issues:
1. Check logs: `docker-compose logs`
2. Read [EMAIL_CONFIGURATION.md](EMAIL_CONFIGURATION.md)
3. Read [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
4. Run diagnostic scripts: `test-email-alert.js`, `check-machine-status.js`
