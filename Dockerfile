# Slim fork — extends upstream image, copies only our overlay files.
# Build time: ~15 seconds (vs 15+ minutes for a full build from scratch).
FROM ghcr.io/p-adamiec/free-games-claimer:enhanced

WORKDIR /fgc

# Copy our overlay files on top of the upstream image.
COPY src/discord.js src/logger.js src/util.js ./src/

ENV LOG_LEVEL="INFO"

# Health check: noVNC reachable
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl --fail http://localhost:6080 || exit 1

# ENTRYPOINT stays as docker-entrypoint.sh (from upstream — sets up TurboVNC/noVNC/DISPLAY)
# Default: run all platforms then sleep 1 day; restart: unless-stopped handles daily scheduling.
# Override in docker-compose command: to pick which platforms to run.
CMD bash -c "node prime-gaming; node gog; node epic-games; node aliexpress; sleep 1d"
