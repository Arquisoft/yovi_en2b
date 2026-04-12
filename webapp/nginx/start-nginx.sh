#!/bin/sh
set -e

ENV=${APP_ENV:-production}

echo "Starting nginx server with env: $ENV"

if [ "$ENV" = "production" ]; then
    cp /etc/nginx/prod.conf /etc/nginx/conf.d/prod.conf
else
    cp /etc/nginx/dev.conf /etc/nginx/conf.d/dev.conf
fi

exec /docker-entrypoint.sh nginx -g "daemon off;"
