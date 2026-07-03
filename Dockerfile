# Macro + Alarm services for ThingsBoard monitoring.
# One image, two entrypoints: macro_component/app.js (default) and alarm/app.js
# (selected per-service via the compose `command:` override).
FROM node:20-alpine

WORKDIR /app

# Install production dependencies.
# Deps (axios, dotenv, mqtt) live in the root package.json and are resolved
# by macro_component/app.js via Node's upward module resolution.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Application source
COPY macro_component ./macro_component
COPY alarm ./alarm
COPY alarm_bridge ./alarm_bridge

ENV NODE_ENV=production

# app.js reads TB_* and MQTT_* config from the environment.
# Pass them at runtime, e.g. `docker run --env-file .env ...`
CMD ["node", "macro_component/app.js"]
