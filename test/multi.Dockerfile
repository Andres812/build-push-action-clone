# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

# Etapa 1: build
FROM --platform=$BUILDPLATFORM golang:alpine AS build
# Usa la imagen de Go basada en Alpine
# Se especifica la plataforma de construcción
# Se nombra esta etapa como "build"

ARG TARGETPLATFORM
ARG BUILDPLATFORM
# Variables que indican la plataforma destino y la de construcción

RUN echo "I am running on $BUILDPLATFORM, building for $TARGETPLATFORM" > /log
# Crea un archivo /log con información de las plataformas

# Etapa 2: imagen final
FROM alpine
# Imagen final ligera basada en Alpine

COPY --from=build /log /log
# Copia el archivo /log desde la etapa "build" a la imagen final