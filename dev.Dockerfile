# syntax=docker/dockerfile:1
# Define la versión de la sintaxis

ARG NODE_VERSION=24
# Define la versión de Node.js que se usará

# =========================
# ETAPA BASE
# =========================
FROM node:${NODE_VERSION}-alpine AS base
# Imagen base con Node.js en Alpine (ligera)

RUN apk add --no-cache cpio findutils git rsync
# Instala herramientas necesarias

WORKDIR /src
# Directorio de trabajo

RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache <<EOT
  set -e
  corepack enable
  yarn --version
  yarn config set --home enableTelemetry 0
EOT
# Habilita Yarn (gestor de paquetes) y desactiva telemetría

# =========================
# ETAPA DEPENDENCIAS
# =========================
FROM base AS deps
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules \
  yarn install && mkdir /vendor && cp yarn.lock /vendor
# Instala dependencias y guarda el archivo yarn.lock

# =========================
# EXPORTAR DEPENDENCIAS
# =========================
FROM scratch AS vendor-update
COPY --from=deps /vendor /
# Exporta dependencias a una imagen vacía

# =========================
# VALIDAR DEPENDENCIAS
# =========================
FROM deps AS vendor-validate
RUN --mount=type=bind,target=.,rw <<EOT
  set -e
  git add -A
  cp -rf /vendor/* .
  if [ -n "$(git status --porcelain -- yarn.lock)" ]; then
    echo >&2 'ERROR: Vendor result differs'
    exit 1
  fi
EOT
# Verifica que yarn.lock esté actualizado

# =========================
# BUILD (COMPILACIÓN)
# =========================
FROM deps AS build
RUN --mount=target=/context \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules <<EOT
  set -e
  rsync -a /context/. .
  rm -rf dist
  yarn run build
  mkdir /out
  cp -r dist /out
EOT
# Compila el proyecto y guarda el resultado

# =========================
# EXPORTAR BUILD
# =========================
FROM scratch AS build-update
COPY --from=build /out /
# Exporta archivos compilados

# =========================
# VALIDAR BUILD
# =========================
FROM build AS build-validate
RUN --mount=target=/context \
  --mount=target=.,type=tmpfs <<EOT
  set -e
  rsync -a /context/. .
  git add -A
  rm -rf dist
  cp -rf /out/* .
  if [ -n "$(git status --porcelain -- dist)" ]; then
    echo >&2 'ERROR: Build result differs'
    exit 1
  fi
EOT
# Verifica que el build esté actualizado

# =========================
# FORMATEO DE CÓDIGO
# =========================
FROM deps AS format
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules \
  yarn run format && mkdir /out && find . -name '*.ts' -not -path './node_modules/*' -not -path './.yarn/*' | cpio -pdm /out
# Formatea código TypeScript y lo exporta

FROM scratch AS format-update
COPY --from=format /out /
# Exporta archivos formateados

# =========================
# LINT
# =========================
FROM deps AS lint
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules \
  yarn run lint
# Ejecuta análisis de código (lint)

# =========================
# TEST
# =========================
FROM deps AS test
RUN --mount=type=bind,target=.,rw \
  --mount=type=cache,target=/src/.yarn/cache \
  --mount=type=cache,target=/src/node_modules \
  yarn run test --coverage --coverage.reportsDirectory=/tmp/coverage
# Ejecuta pruebas y genera reporte de cobertura

FROM scratch AS test-coverage
COPY --from=test /tmp/coverage /
# Exporta el reporte de cobertura