#!/bin/sh
set -eu

if [ "${SEED_DEMO_DATA:-true}" != "true" ]; then
  echo "SEED_DEMO_DATA=${SEED_DEMO_DATA:-}, skip demo seed import"
  exit 0
fi

seed_once() {
  db_name="$1"
  marker_name="$2"
  seed_file="$3"

  psql -v ON_ERROR_STOP=1 -d "$db_name" -c \
    "CREATE TABLE IF NOT EXISTS docker_seed_markers (name text PRIMARY KEY, seeded_at timestamptz NOT NULL DEFAULT now());"

  if [ "$(psql -At -d "$db_name" -c "SELECT 1 FROM docker_seed_markers WHERE name='${marker_name}' LIMIT 1;")" = "1" ]; then
    echo "${marker_name} already imported into ${db_name}"
    return 0
  fi

  psql -v ON_ERROR_STOP=1 -d "$db_name" -f "$seed_file"
  psql -v ON_ERROR_STOP=1 -d "$db_name" -c \
    "INSERT INTO docker_seed_markers(name) VALUES ('${marker_name}') ON CONFLICT DO NOTHING;"
  echo "${marker_name} imported into ${db_name}"
}

seed_once "${GO_DB:-aegis_go}" "aegis_go_mock_7_1_no_transfers_on_demand_forecast_v4" "/seeds/aegis_go_mock_7_1.sql"
seed_once "${PYTHON_DB:-aegis_python}" "aegis_python_mock_no_seeded_forecast_current_dates_v4" "/seeds/aegis_python_mock.sql"
