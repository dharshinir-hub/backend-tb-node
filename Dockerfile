# Macro + Alarm + Alarm-bridge services for ThingsBoard monitoring.
# All three run in this ONE container under supervisord, each independently
# restarted on crash (one dying does not affect the other two).
FROM node:20-alpine

WORKDIR /app

# supervisord: process supervisor that runs & independently restarts the 3
# services below inside a single container.
RUN apk add --no-cache supervisor

# Install production dependencies.
# Deps (axios, dotenv, mqtt) live in the root package.json and are resolved
# by macro_component/app.js via Node's upward module resolution.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application source
COPY macro_component ./macro_component
COPY alarm ./alarm
COPY alarm_bridge ./alarm_bridge
COPY supervisord.conf ./supervisord.conf

ENV NODE_ENV=production

# app.js/bridge.js read TB_* and MQTT_* config from the environment.
# Pass them at runtime, e.g. `docker run --env-file .env ...`
CMD ["supervisord", "-c", "/app/supervisord.conf"]
