# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

# Etapa 1: base
FROM busybox AS base
# Usa BusyBox como imagen base ligera
# Se nombra esta etapa como "base"

RUN echo "Hello world!" > /hello
# Crea un archivo llamado /hello con el mensaje "Hello world!"

# Etapa 2: build
FROM alpine AS build
# Usa Alpine como base para esta segunda etapa

COPY --from=base /hello /hello
# Copia el archivo /hello desde la etapa "base"

RUN uname -a
# Muestra información del sistema (kernel, arquitectura, etc.)

# Etapa final
FROM build
# Usa directamente la etapa "build" como imagen final