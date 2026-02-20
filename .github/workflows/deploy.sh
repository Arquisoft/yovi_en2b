#!/bin/bash
set -e

APP_DIR=$HOME/yovi
mkdir -p "$APP_DIR"
cd "$APP_DIR"

# Create .env file
cat > .env << EOF
NODE_ENV=production
MARIADB_ROOT_PASSWORD="$MARIADB_ROOT_PASSWORD"
MARIADB_USER="$MARIADB_USER"
MARIADB_PASSWORD="$MARIADB_PASSWORD"
JWT_SECRET="$JWT_SECRET"
EOF
chmod 600 .env

# Create directories
mkdir -p users/monitoring/prometheus
mkdir -p users/monitoring/grafana/provisioning/datasources
mkdir -p users/monitoring/grafana/provisioning/dashboards

# Download files
wget -q "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/master/docker-compose.yml" -O docker-compose.yml
wget -q "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/master/users/schema.sql" -O users/schema.sql
wget -q "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/master/users/monitoring/prometheus/prometheus.yml" -O users/monitoring/prometheus/prometheus.yml
wget -q "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/master/users/monitoring/grafana/provisioning/datasources/datasource.yml" -O users/monitoring/grafana/provisioning/datasources/datasource.yml
wget -q "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/master/users/monitoring/grafana/provisioning/dashboards/dashboard.yml" -O users/monitoring/grafana/provisioning/dashboards/dashboard.yml
wget -q "https://raw.githubusercontent.com/$REPO_OWNER/$REPO_NAME/master/users/monitoring/grafana/provisioning/dashboards/dashboard.json" -O users/monitoring/grafana/provisioning/dashboards/dashboard.json

# Deploy
docker compose down
docker compose up -d --pull always || {
  echo "Docker Compose failed. Showing logs:"
  docker compose logs
  exit 1
}

echo "Deploy complete!"
