# Macro + Alarm-bridge + Sequence-report services for ThingsBoard monitoring.
# All three run in this ONE container under supervisord, each independently
# restarted on crash (one dying does not affect the others).
# NOTE: the standalone `alarm` service (alarm/app.js) was removed from live
# 2026-07-29 — it stays on disk (NOT copied into this image) only because
# backfill/backfill.js still requires alarm/index.js for alarm backfills.
FROM node:20-alpine

WORKDIR /app

# supervisord: process supervisor that runs & independently restarts the
# services below inside a single container.
RUN apk add --no-cache supervisor

# Install production dependencies.
# Deps (axios, dotenv, mqtt) live in the root package.json and are resolved
# by macro_component/app.js via Node's upward module resolution.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# sequence_report has its own package.json with its own dependency versions
# (express, body-parser, and separately-pinned axios/mqtt/dotenv). It gets its
# own node_modules so its deps never collide with the root ones above —
# Node resolves require() from the closest node_modules first.
COPY sequence_report/package.json sequence_report/package-lock.json ./sequence_report/
RUN npm ci --omit=dev --prefix sequence_report

# Application source
COPY macro_component ./macro_component
COPY alarm_bridge ./alarm_bridge
COPY sequence_report ./sequence_report
COPY supervisord.conf ./supervisord.conf

ENV NODE_ENV=production

# app.js/bridge.js/index.js read TB_*/THINGSBOARD_*/MQTT_* config from the
# environment. Pass them at runtime, e.g. `docker run --env-file .env ...`
EXPOSE 6027

CMD ["supervisord", "-c", "/app/supervisord.conf"]
