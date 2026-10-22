#!/bin/sh
# Registra (o aggiorna) il connettore Debezium dell'outbox. Gira in un container di una sola esecuzione, dopo che
# Kafka Connect risponde. L'operazione è idempotente: PUT crea il connettore o ne aggiorna la configurazione.
set -eu

CONNECT_URL="${CONNECT_URL:-http://connect:8083}"
NAME="outbox"

config=$(sed -e "s|__DB_USER__|${DB_USER}|" -e "s|__DB_PASSWORD__|${DB_PASSWORD}|" -e "s|__DB_NAME__|${DB_NAME}|" /config/outbox-connector.json)

curl -fsS -X PUT -H 'Content-Type: application/json' --data "$config" "$CONNECT_URL/connectors/$NAME/config" > /dev/null
echo "register-connector: connettore '$NAME' registrato su $CONNECT_URL"
