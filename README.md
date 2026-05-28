# backend-tb-node

ThingsBoard monitoring and macro processing services

## Services

- **macro_component**: MQTT event-driven processor for macro components, reasons, and operators
- **status_threshold**: WebSocket-based machine status monitoring with alert thresholds

## Setup

1. Install dependencies:
```bash
npm install
```

2. Configure `.env` with ThingsBoard credentials:
```
TB_BASE_URL=http://yantra24x7.cloud:8080
TB_USERNAME=pms@gmail.com
TB_PASSWORD=pmspms
TB_INSECURE_TLS=1
```

## Running

Start both services:
```bash
npm start
```

Or run individually:
```bash
npm run macro    # Macro component only
npm run status   # Status monitoring only
```

## Project Structure

```
tb-code/
├── macro_component/       # MQTT processor
│   ├── app.js
│   ├── index.js
│   └── package.json
├── status_threshold/      # Status monitoring
│   ├── status_monitor/
│   │   └── monitor.js
│   └── package.json
├── package.json           # Root config (runs both services)
└── .env                   # Configuration (not in git)
```
