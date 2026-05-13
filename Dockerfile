# syntax=docker/dockerfile:1
# AtlasVPN: UI React (build) + FastAPI + cloudflared en PATH.
# Uso típico (escucha en todas las interfaces):
#   docker build -t atlasvpn .
#   docker run --rm -p 8765:8765 \
#     -v atlasvpn-data:/app/.atlasvpn \
#     -v atlasvpn-tunnels:/app/.cloudflared-tunnels \
#     -v "$(pwd)/scripts/tunnels.json:/app/scripts/tunnels.json:rw" \
#     atlasvpn
#
# Notas operativas:
# - En contenedor suele usarse --no-browser; --host 0.0.0.0 expone la UI en la red del contenedor.
# - Los túneles cloudflared lanzados desde la app son procesos hijos del contenedor; Access/login
#   puede requerir montar credenciales o ejecutar cloudflared login en un volumen persistente.
# - «Terminal SSH» / PgAdmin desde la UI pueden no ser aplicables dentro del contenedor (sin escritorio).

# ---------- Etapa 1: compilar UI (Vite → atlasvpn/static/web) ----------
FROM node:22-bookworm-slim AS ui
WORKDIR /ui
COPY ui/package.json ui/package-lock.json ./
RUN npm ci
COPY ui/ ./
RUN npm run build

# ---------- Etapa 2: runtime Python ----------
FROM python:3.12-slim-bookworm AS runtime

LABEL org.opencontainers.image.title="AtlasVPN" \
      org.opencontainers.image.description="AtlasVPN — túneles Cloudflare Access TCP (UI web + API)"

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

ARG CLOUDFLARED_VERSION=2026.5.0
ARG TARGETARCH

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl gosu \
    && rm -rf /var/lib/apt/lists/*

# Binario oficial cloudflared (amd64 / arm64)
RUN set -eux; \
    case "${TARGETARCH:-amd64}" in \
      amd64) cf_arch=amd64 ;; \
      arm64) cf_arch=arm64 ;; \
      *) echo "Arquitectura no soportada: ${TARGETARCH}"; exit 1 ;; \
    esac; \
    curl -fsSL "https://github.com/cloudflare/cloudflared/releases/download/${CLOUDFLARED_VERSION}/cloudflared-linux-${cf_arch}" \
      -o /usr/local/bin/cloudflared; \
    chmod +x /usr/local/bin/cloudflared; \
    cloudflared --version

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY atlasvpn/ ./atlasvpn/
COPY scripts/ ./scripts/
COPY Logos/ ./Logos/

COPY --from=ui /atlasvpn/static/web ./atlasvpn/static/web/

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh \
    && useradd --create-home --shell /bin/bash --uid 1000 atlas \
    && chown -R atlas:atlas /app

# Arranque como root solo para chown de volúmenes; el proceso de la app baja a atlas (gosu).
USER root

EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -fsS "http://127.0.0.1:8765/" >/dev/null || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["python", "-m", "atlasvpn", "--no-browser", "--host", "0.0.0.0", "--port", "8765"]
