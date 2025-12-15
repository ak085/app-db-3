# Storage App - MQTT to TimescaleDB Gateway

**Time-series data collection from MQTT with web-based configuration and monitoring**

[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)](docker-compose.yml)
[![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=next.js)](https://nextjs.org/)
[![TimescaleDB](https://img.shields.io/badge/TimescaleDB-Latest-blue?logo=timescale)](https://www.timescale.com/)

---

## Quick Start

```bash
# Clone and deploy
git clone http://10.0.10.2:30008/ak101/app-storage.git storage-app
cd storage-app
docker compose up -d

# Access UI
# http://<your-ip>:3002
```

---

## What is Storage App?

Storage App is a standalone data collection gateway that:
1. **Subscribes** to MQTT topics from any broker
2. **Stores** time-series data in TimescaleDB
3. **Provides** web GUI for configuration and monitoring
4. **Exports** data in CSV or JSON format

Perfect for collecting and storing data from BacPipes edge devices, IoT sensors, or any MQTT-based data source.

---

## Architecture

```
┌─────────────────────────────────────────────┐
│ Storage App (Docker Compose)                │
├─────────────────────────────────────────────┤
│  Frontend (Next.js) - Port 3002             │
│  ├─ Dashboard (connection status)           │
│  ├─ Monitoring (data table view)            │
│  ├─ Settings (MQTT + TLS config)            │
│  └─ Export (CSV/JSON download)              │
│                                             │
│  PostgreSQL - Port 5436                     │
│  └─ Configuration database                  │
│                                             │
│  TimescaleDB - Port 5435                    │
│  └─ Time-series data storage                │
│                                             │
│  Telegraf (Python)                          │
│  ├─ MQTT subscriber with TLS/Auth           │
│  └─ Writes to TimescaleDB                   │
└─────────────────────────────────────────────┘
         ↑ MQTT subscribe
┌─────────────────────────────────────────────┐
│ External MQTT Broker                        │
│ - BacPipes publishes here                   │
│ - Supports TLS and authentication           │
└─────────────────────────────────────────────┘
```

---

## Key Features

| Feature | Description |
|---------|-------------|
| **MQTT Subscription** | Subscribe to any MQTT broker |
| **TLS/SSL Support** | Secure connections with certificate verification |
| **Authentication** | Username/password MQTT authentication |
| **Topic Patterns** | Flexible wildcard topic subscriptions |
| **Data Monitoring** | Real-time data table with filtering |
| **Data Export** | CSV and JSON download |
| **Auto Compression** | TimescaleDB compresses old data |
| **Retention Policy** | Automatic data cleanup |

---

## First-Time Setup

1. **Access Dashboard**: http://your-ip:3002
2. **Configure MQTT**:
   - Go to Settings page
   - Enter MQTT broker IP/hostname
   - Configure authentication if needed
   - Enable TLS if required
3. **Set Topic Patterns**:
   - Add topic patterns to subscribe (e.g., `bacnet/#`)
   - Save settings
4. **Verify**:
   - Check Dashboard for connection status
   - View incoming data on Monitoring page

---

## Common Commands

| Operation | Command |
|-----------|---------|
| Start | `docker compose up -d` |
| Stop | `docker compose down` |
| Logs | `docker compose logs -f telegraf` |
| Restart telegraf | `docker compose restart telegraf` |
| Rebuild | `docker compose build && docker compose up -d` |
| Reset (delete data) | `docker compose down -v` |

---

## Configuration

### Via Settings Page (Recommended)

All configuration is done via the web UI at `/settings`:
- MQTT Broker IP, Port, Client ID
- Username/Password Authentication
- TLS/SSL with certificate upload
- Topic subscription patterns
- QoS level
- Data retention period

### Via Environment Variables (Optional)

For advanced customization, create a `.env` file:

```bash
# Database credentials (optional - defaults provided)
POSTGRES_USER=storage
POSTGRES_PASSWORD=storage123
TIMESCALE_USER=timescale
TIMESCALE_PASSWORD=timescale123
TZ=Asia/Kuala_Lumpur
```

---

## Port Allocation

| Port | Service |
|------|---------|
| 3002 | Web UI (Frontend) |
| 5435 | TimescaleDB |
| 5436 | PostgreSQL (Config) |

---

## Data Storage

### TimescaleDB Features

- **Hypertable**: Automatic time-based partitioning
- **Compression**: Data older than 6 hours is compressed
- **Retention**: Data older than 30 days is deleted (configurable)
- **Continuous Aggregate**: 5-minute averages for fast queries

### Export Formats

**CSV Export:**
```csv
time,haystack_name,display_name,value,units,device_id,...
2025-12-15T10:30:00.000Z,klcc.ahu.12.sensor.temp,AHU-12 Temp,23.5,degC,221,...
```

**JSON Export:**
```json
[
  {
    "time": "2025-12-15T10:30:00.000Z",
    "haystack_name": "klcc.ahu.12.sensor.temp",
    "dis": "AHU-12 Temp",
    "value": 23.5,
    "units": "degC"
  }
]
```

---

## Troubleshooting

### MQTT Not Connecting
1. Check broker IP in Settings
2. Verify TLS settings match broker configuration
3. Check logs: `docker compose logs telegraf`

### No Data Appearing
1. Verify topic patterns match published topics
2. Check MQTT connection status on Dashboard
3. Ensure BacPipes or data source is publishing

### TimescaleDB Connection Error
1. Wait for database initialization (first startup)
2. Check logs: `docker compose logs timescaledb`

---

## Development

See `CLAUDE.md` for detailed development context.

**Project Structure:**
```
storage-app/
├── docker-compose.yml          # All services
├── frontend/                   # Next.js web app
│   ├── src/app/               # Pages and API routes
│   ├── prisma/                # Database schema
│   └── Dockerfile
├── telegraf/                   # MQTT to TimescaleDB
│   ├── mqtt_to_timescaledb.py
│   └── Dockerfile
└── timescaledb/
    └── init/                  # Database initialization
```

---

## Repository

- **Gitea**: http://10.0.10.2:30008/ak101/app-storage.git

---

**Last Updated:** December 2025
**Status:** Production-ready
