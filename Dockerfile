# Partially from https://github.com/microsoft/playwright/blob/main/utils/docker/Dockerfile.noble
# Ubuntu 24.04 LTS (Noble Numbat)
FROM ubuntu:noble

# https://github.com/hadolint/hadolint/wiki/DL4006
SHELL ["/bin/bash", "-o", "pipefail", "-c"]
ARG DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl ca-certificates gnupg \
    && mkdir -p /etc/apt/keyrings \
    # Node.js
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main" > /etc/apt/sources.list.d/nodesource.list \
    # TurboVNC & VirtualGL instead of Xvfb+X11vnc
    && curl --proto "=https" --tlsv1.2 -fsSL https://packagecloud.io/dcommander/virtualgl/gpgkey | gpg --dearmor -o /etc/apt/trusted.gpg.d/VirtualGL.gpg \
    && curl --proto "=https" --tlsv1.2 -fsSL  https://packagecloud.io/dcommander/turbovnc/gpgkey | gpg --dearmor -o /etc/apt/trusted.gpg.d/TurboVNC.gpg \
    && curl --proto "=https" --tlsv1.2 -fsSL https://raw.githubusercontent.com/VirtualGL/repo/main/VirtualGL.list > /etc/apt/sources.list.d/VirtualGL.list \
    && curl --proto "=https" --tlsv1.2 -fsSL https://raw.githubusercontent.com/TurboVNC/repo/main/TurboVNC.list > /etc/apt/sources.list.d/TurboVNC.list \
    && apt-get update \
    && apt-get install --no-install-recommends -y \
      virtualgl turbovnc ratpoison \
      novnc websockify \
      tini \
      nodejs \
      dos2unix \
      pip \
    && apt-get install -y --no-install-recommends \
      libnss3 \
      libnspr4 \
      libatk1.0-0 \
      libatk-bridge2.0-0 \
      libcups2 \
      libxkbcommon0 \
      libatspi2.0-0 \
      libxcomposite1 \
      libgbm1 \
      libpango-1.0-0 \
      libcairo2 \
      libasound2t64 \
      libxfixes3 \
      libxdamage1 \
    && apt-get autoremove -y \
    && apt-get clean \
    && rm -rf \
      /var/lib/apt/lists/* \
      /var/cache/* \
      /var/tmp/* \
      /tmp/* \
      /usr/share/doc/* \
    && ln -s /usr/share/novnc/vnc_auto.html /usr/share/novnc/index.html \
    && pip install apprise --break-system-packages --no-cache-dir

WORKDIR /fgc
COPY package*.json ./

RUN npm install --ignore-scripts && npx patchright install chromium --no-shell && du -h -d1 ~/.cache/ms-playwright

COPY . .

RUN dos2unix ./*.sh && chmod +x ./*.sh
RUN cp docker-entrypoint.sh /usr/local/bin/

ARG COMMIT=""
ARG BRANCH=""
ARG NOW=""
ENV COMMIT=${COMMIT}
ENV BRANCH=${BRANCH}
ENV NOW=${NOW}

# VNC
ENV VNC_PORT=5900
ENV NOVNC_PORT=6080
EXPOSE 5900
EXPOSE 6080

# Scheduler health/trigger endpoint
ENV HEALTH_PORT=8080
EXPOSE 8080

# Display
ENV WIDTH=1920
ENV HEIGHT=1080
ENV DEPTH=24
ENV SHOW=1

# Scheduler defaults
ENV CRON_SCHEDULE="0 7 * * *"
ENV TZ="Europe/Warsaw"
ENV RUN_ON_START="0"
ENV LOG_LEVEL="INFO"

# Healthcheck: noVNC reachable + scheduler HTTP up
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD curl --fail http://localhost:6080 && curl --fail http://localhost:${HEALTH_PORT}/health || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]

# Daemon mode: scheduler keeps container alive and triggers scripts on cron schedule.
# Override with e.g.  docker run ... node epic-games  to run a single script.
CMD node scheduler.js
