#!/bin/sh
set -e

echo "Corriendo migraciones..."
npm run migration:run:prod

echo "Iniciando aplicación..."
exec node dist/main
