#!/bin/sh
# Restaura un backup-*.sql (generado por shared/backup/backup.service.ts, pg_dump
# en formato SQL plano) sobre la base indicada.
#
# Uso (dentro del contenedor `app`, que ya trae psql y DATABASE_URL):
#   sh backend/scripts/restore-backup.sh backups/backup-2026-09-25T03-00-00-000Z.sql [DATABASE_URL_DESTINO]
#
# Sin destino explícito restaura sobre DATABASE_URL — es decir, PISA la base
# actual. Para probar un backup sin riesgo, crear antes una base vacía aparte y
# pasarla como segundo argumento.
set -eu

FILE="${1:?Falta el archivo .sql a restaurar}"
TARGET="${2:-${DATABASE_URL:?Falta DATABASE_URL}}"

[ -f "$FILE" ] || { echo "No existe: $FILE" >&2; exit 1; }

psql "$TARGET" -v ON_ERROR_STOP=1 -q -f "$FILE"
echo "Restauración completa en: $(echo "$TARGET" | sed 's#//[^@]*@#//***@#')"
