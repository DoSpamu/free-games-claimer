# Slim fork — extends upstream image, copies only our overlay files.
# Build time: ~15 seconds (vs 15+ minutes for a full build from scratch).
FROM ghcr.io/p-adamiec/free-games-claimer:enhanced

WORKDIR /fgc

# Install only the new dependency (node-cron) without touching upstream deps.
# --ignore-scripts prevents patchright from re-downloading Chromium.
RUN npm install node-cron --ignore-scripts --no-save

# Copy our overlay files on top of the upstream image.
COPY src/discord.js src/logger.js src/util.js ./src/
COPY scheduler.js ./

# Scheduler defaults (can all be overridden via environment in docker-compose / Portainer)
ENV CRON_SCHEDULE="0 7 * * *"
ENV TZ="Europe/Warsaw"
ENV RUN_ON_START="0"
ENV RETRY_FAILED="1"
ENV WEEKLY_DIGEST="1"
ENV HEALTH_PORT="8080"
ENV LOG_LEVEL="INFO"

EXPOSE 8080

# Health check: noVNC + scheduler HTTP endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl --fail http://localhost:6080 && curl --fail http://localhost:${HEALTH_PORT}/health || exit 1

# ENTRYPOINT stays as docker-entrypoint.sh (from upstream — sets up TurboVNC/noVNC/DISPLAY)
# Override CMD to start the scheduler daemon instead of the one-shot script chain.
CMD node scheduler.js
