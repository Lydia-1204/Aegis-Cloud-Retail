#!/usr/bin/env bash
set -euo pipefail

ARCHIVE_PATH="${1:?archive path is required}"
APP_DIR="${2:-/opt/aegis}"
PUBLIC_ORIGIN="${3:-http://127.0.0.1}"

COMPOSE_FILES=(-f docker-compose.yml -f deploy/docker-compose.prod.yml)

install_runtime() {
  apt-get update
  apt-get install -y ca-certificates curl gnupg lsb-release tar

  if ! command -v docker >/dev/null 2>&1; then
    apt-get install -y docker.io
  fi

  systemctl enable --now docker

  if ! docker compose version >/dev/null 2>&1 && ! command -v docker-compose >/dev/null 2>&1; then
    apt-get install -y docker-compose-plugin || apt-get install -y docker-compose
  fi

  mkdir -p /etc/docker
  if [ ! -f /etc/docker/daemon.json ]; then
    cat > /etc/docker/daemon.json <<'EOF'
{
  "registry-mirrors": [
    "https://docker.m.daocloud.io",
    "https://docker.1panel.live",
    "https://hub.rat.dev"
  ]
}
EOF
    systemctl restart docker
  fi
}

compose_cmd() {
  if docker compose version >/dev/null 2>&1; then
    docker compose "$@"
  else
    docker-compose "$@"
  fi
}

ensure_env() {
  if [ -f .env ]; then
    if ! grep -q '^CORS_ALLOW_ORIGINS=' .env; then
      printf '\nCORS_ALLOW_ORIGINS=%s\n' "$PUBLIC_ORIGIN" >> .env
    fi
    return
  fi

  local suffix
  suffix="$(date +%s)"

  cat > .env <<EOF
POSTGRES_USER=aegis
POSTGRES_PASSWORD=aegis_dev_${suffix}
POSTGRES_DB=aegis_go
FOUNDATION_DATA_JWT_SECRET=aegis_jwt_${suffix}
ENV=production
SEED_DEMO_DATA=true
DEEPSEEK_API_KEY=
DEEPSEEK_BASE_URL=https://api.deepseek.com
CORS_ALLOW_ORIGINS=${PUBLIC_ORIGIN}
EOF
}

deploy_release() {
  local release_dir backup_dir timestamp
  timestamp="$(date +%Y%m%d%H%M%S)"
  release_dir="/tmp/aegis-release-${timestamp}"
  backup_dir="${APP_DIR}.previous.${timestamp}"

  rm -rf "$release_dir"
  mkdir -p "$release_dir"
  tar -xzf "$ARCHIVE_PATH" -C "$release_dir"

  if [ -f "${APP_DIR}/.env" ]; then
    cp "${APP_DIR}/.env" "${release_dir}/.env"
  fi

  if [ -d "$APP_DIR" ]; then
    mv "$APP_DIR" "$backup_dir"
  fi

  mkdir -p "$(dirname "$APP_DIR")"
  mv "$release_dir" "$APP_DIR"

  cd "$APP_DIR"
  ensure_env

  compose_cmd "${COMPOSE_FILES[@]}" up -d --build --remove-orphans
  compose_cmd "${COMPOSE_FILES[@]}" ps
}

install_runtime
deploy_release
