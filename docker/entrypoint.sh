#!/bin/sh
# Arranque del contenedor `app` (backend + frontend en uno). El proyecto está
# montado en /app; todo lo generado vive en volúmenes nombrados:
#   /app/backend/node_modules, /app/frontend/node_modules  -> dependencias (Linux)
#   /build                                                 -> salida compilada
#   /data/{uploads,backups,logs}                           -> datos persistentes (cwd del backend)
set -eu

APP=/app
BACKEND=$APP/backend
FRONTEND=$APP/frontend
BUILD=/build
NODE_PID=""
NGINX_PID=""

log() { echo "[entrypoint] $*"; }

# Hash del contenido de las rutas dadas — permite saltear npm ci / build cuando
# nada cambió (un reinicio sin cambios de código arranca en segundos).
tree_hash() {
  find "$@" -type f 2>/dev/null | sort | xargs sha256sum 2>/dev/null | sha256sum | cut -d' ' -f1
}

# Vacía el contenido de node_modules sin borrar el directorio: es un punto de
# montaje (volumen) y npm no puede eliminarlo (EBUSY).
sync_deps() {
  dir=$1
  cd "$dir"
  hash=$( { sha256sum package.json package-lock.json; echo "include-dev"; } | sha256sum | cut -d' ' -f1)
  if [ "$(cat node_modules/.deps-hash 2>/dev/null || true)" != "$hash" ]; then
    log "instalando dependencias en $dir"
    find node_modules -mindepth 1 -maxdepth 1 -exec rm -rf {} +
    # --include=dev: con NODE_ENV=production npm omite las devDependencies, pero
    # acá adentro hacen falta (@types/*, el CLI de prisma, vite) para compilar.
    npm ci --include=dev --no-audit --no-fund
    echo "$hash" > node_modules/.deps-hash
  else
    log "dependencias de $dir al día"
  fi
}

build_backend() {
  cd "$BACKEND"
  hash=$(tree_hash src prisma tsconfig.json tsconfig.build.json package.json)
  if [ "$(cat $BUILD/.backend-hash 2>/dev/null || true)" != "$hash" ] || [ ! -f $BUILD/backend/server.js ]; then
    log "compilando backend"
    npx prisma generate
    rm -rf $BUILD/backend
    npx tsc -p tsconfig.build.json --outDir $BUILD/backend
    # El JS compilado es ESM: necesita su propio package.json con type=module y
    # acceso a node_modules (symlink al volumen de dependencias).
    echo '{"type":"module"}' > $BUILD/backend/package.json
    ln -sfn $BACKEND/node_modules $BUILD/backend/node_modules
    echo "$hash" > $BUILD/.backend-hash
  else
    log "backend sin cambios, reutilizando build"
    npx prisma generate >/dev/null
  fi
}

build_frontend() {
  cd "$FRONTEND"
  # VITE_* se hornean en el bundle al compilar — entran al hash para que
  # cambiarlas dispare un rebuild.
  hash=$( { tree_hash src public index.html vite.config.ts tsconfig.json tailwind.config.js postcss.config.js package.json; \
            echo "${VITE_API_URL:-/api}|${VITE_REMOTELY_URL:-}|${VITE_TURNSTILE_SITE_KEY:-}"; } | sha256sum | cut -d' ' -f1)
  if [ "$(cat $BUILD/.frontend-hash 2>/dev/null || true)" != "$hash" ] || [ ! -f $BUILD/frontend/index.html ]; then
    log "compilando frontend"
    VITE_API_URL="${VITE_API_URL:-/api}" npx vite build --outDir $BUILD/frontend --emptyOutDir
    echo "$hash" > $BUILD/.frontend-hash
  else
    log "frontend sin cambios, reutilizando build"
  fi
}

shutdown() {
  log "señal recibida, apagando"
  [ -n "$NGINX_PID" ] && kill "$NGINX_PID" 2>/dev/null || true
  [ -n "$NODE_PID" ] && kill "$NODE_PID" 2>/dev/null || true
  wait 2>/dev/null || true
  exit 0
}

mkdir -p $BUILD
sync_deps "$BACKEND"
sync_deps "$FRONTEND"
build_backend
build_frontend

cd "$BACKEND"
log "aplicando migraciones"
npx prisma migrate deploy

trap shutdown TERM INT

log "iniciando backend"
# cwd = /data: el backend resuelve uploads/, logs/ y backups/ relativos al cwd
# (ver process.cwd() en las features) — así caen en los volúmenes de datos y no
# dentro de la carpeta del proyecto.
mkdir -p /data/uploads /data/logs /data/backups
cd /data
node $BUILD/backend/server.js &
NODE_PID=$!

log "iniciando nginx"
nginx -c $APP/docker/nginx.conf -g 'daemon off;' &
NGINX_PID=$!

# Si cualquiera de los dos procesos muere, el contenedor entero sale con error
# para que `restart: unless-stopped` lo levante de nuevo — mejor un reinicio
# limpio que un contenedor "vivo" con la mitad caída.
while kill -0 "$NODE_PID" 2>/dev/null && kill -0 "$NGINX_PID" 2>/dev/null; do
  sleep 2
done

log "un proceso terminó (backend=$NODE_PID nginx=$NGINX_PID), saliendo"
kill "$NODE_PID" "$NGINX_PID" 2>/dev/null || true
exit 1
