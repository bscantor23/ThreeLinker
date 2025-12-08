#!/bin/sh
# Espera a que los backends estén disponibles antes de arrancar nginx

set -e

HOSTS="threelinker-server-1:3001 threelinker-server-2:3002"
TIMEOUT=60

for host in $HOSTS; do
  echo "Esperando a que $host esté disponible..."
  for i in $(seq 1 $TIMEOUT); do
    nc -z $(echo $host | cut -d: -f1) $(echo $host | cut -d: -f2) && break
    sleep 1
  done
  nc -z $(echo $host | cut -d: -f1) $(echo $host | cut -d: -f2) || {
    echo "Timeout esperando a $host" >&2
    exit 1
  }
done

exec "$@"
