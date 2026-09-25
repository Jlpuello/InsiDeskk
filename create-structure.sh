#!/usr/bin/env bash
# Crea el árbol de carpetas del sistema de tickets (backend + frontend).
# Uso: bash create-structure.sh
set -e

ROOT="$(pwd)"

# ── Backend ──────────────────────────────────────────────────────────
mkdir -p backend/prisma
mkdir -p backend/src/config
mkdir -p backend/src/shared/prisma/middleware
mkdir -p backend/src/shared/middleware
mkdir -p backend/src/shared/utils
mkdir -p backend/src/shared/types
mkdir -p backend/src/shared/auth
mkdir -p backend/src/shared/cache
mkdir -p backend/src/shared/events
mkdir -p backend/src/shared/queue
mkdir -p backend/src/shared/security
mkdir -p backend/src/shared/monitoring
mkdir -p backend/src/shared/backup
mkdir -p backend/src/shared/services

for feature in auth users tickets devices remotely; do
  mkdir -p "backend/src/features/$feature/services"
  mkdir -p "backend/src/features/$feature/controllers"
  mkdir -p "backend/src/features/$feature/repositories"
  mkdir -p "backend/src/features/$feature/types"
done

mkdir -p backend/src/features/notifications/controllers
mkdir -p backend/src/features/notifications/services
mkdir -p backend/src/features/notifications/jobs
mkdir -p backend/src/features/notifications/types

mkdir -p backend/logs
mkdir -p backend/backups

# ── Frontend ─────────────────────────────────────────────────────────
mkdir -p frontend/public
mkdir -p frontend/src/routes
mkdir -p frontend/src/shared/api
mkdir -p frontend/src/shared/components
mkdir -p frontend/src/shared/store

for feature in auth tickets devices remotely users; do
  mkdir -p "frontend/src/features/$feature/components"
  mkdir -p "frontend/src/features/$feature/api"
  mkdir -p "frontend/src/features/$feature/types"
  mkdir -p "frontend/src/features/$feature/store"
done

echo "Estructura creada en $ROOT"
