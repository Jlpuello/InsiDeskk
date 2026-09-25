# pg_dump/psql EXACTOS de la misma versión que el server (postgres:15-alpine en
# docker-compose.yml) — el `apk add postgresql-client` del Alpine base de
# node:20-alpine instala la versión de turno del repo (hoy 18.x), y un pg_dump
# más nuevo que el server genera SQL con sintaxis que el server 15 no entiende
# al restaurar (ej. `SET transaction_timeout`, GUC que no existe antes de PG17).
FROM postgres:15-alpine AS pgclient

# Imagen genérica: solo herramientas, NO copia el proyecto. El código llega como
# volumen (bind mount de PROJECT_DIR en /app) y docker/entrypoint.sh lo instala,
# compila y sirve al iniciar — actualizar código = actualizar la carpeta en el
# host y reiniciar el contenedor, sin reconstruir la imagen.
FROM node:20-alpine

# nginx: sirve el frontend y hace de proxy de /api y /socket.io hacia el backend
# openssl: el motor de Prisma lo necesita (también cubre libssl/libcrypto de pg_dump)
# tini: PID 1 — reenvía señales y limpia procesos zombie (el contenedor corre
#       node + nginx a la vez)
RUN apk add --no-cache nginx openssl libedit tini

COPY --from=pgclient /usr/local/bin/pg_dump /usr/local/bin/pg_restore /usr/local/bin/psql /usr/local/bin/
COPY --from=pgclient /usr/local/lib/libpq.so.5 /usr/local/lib/
COPY --from=pgclient \
  /usr/lib/libldap.so.2 /usr/lib/libgssapi_krb5.so.2 /usr/lib/libkrb5.so.3 \
  /usr/lib/libk5crypto.so.3 /usr/lib/libcom_err.so.2 /usr/lib/libkrb5support.so.0 \
  /usr/lib/liblber.so.2 /usr/lib/libsasl2.so.3 /usr/lib/libkeyutils.so.1 \
  /usr/lib/

WORKDIR /app

ENTRYPOINT ["/sbin/tini", "--", "sh", "/app/docker/entrypoint.sh"]
