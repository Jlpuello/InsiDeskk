# Build multi-stage: la imagen anterior corría el dev server de Vite en
# producción — esta compila el bundle estático y lo sirve con nginx.
#
# Las VITE_* son de build-time (Vite las hornea en el bundle en el momento de
# `vite build`, no se leen en runtime) — por eso van como ARG/ENV ANTES del
# build, y por eso docker-compose.prod.yml se las pasa como `build.args`, no
# como `environment` del servicio (eso no tendría ningún efecto acá).
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

ARG VITE_API_URL
ARG VITE_REMOTELY_URL
ARG VITE_TURNSTILE_SITE_KEY
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_REMOTELY_URL=$VITE_REMOTELY_URL
ENV VITE_TURNSTILE_SITE_KEY=$VITE_TURNSTILE_SITE_KEY

RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
