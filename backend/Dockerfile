# Build multi-stage: la imagen anterior corría "npm run dev" (tsx watch) en
# producción, que nunca fue el objetivo — esta compila con tsc y corre el
# JS ya compilado. node_modules completo (con devDependencies) pasa a la
# etapa final a propósito: `prisma migrate deploy` en el CMD necesita el CLI
# de prisma, que solo vive en devDependencies (@prisma/client, en cambio, sí
# es dependencia de producción).
FROM node:20-alpine AS build
# El motor de consultas de Prisma necesita libssl — sin esto, "prisma
# generate" tira un warning ("failed to detect the libssl/openssl version")
# y en algunos casos el engine binario ni siquiera carga en runtime.
RUN apk add --no-cache openssl
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-alpine AS production
RUN apk add --no-cache openssl
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY package*.json ./

EXPOSE 3000

# migrate deploy es idempotente (solo aplica migraciones pendientes) — correr
# acá en vez de a mano cierra el riesgo de desplegar un build nuevo contra un
# schema viejo.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
