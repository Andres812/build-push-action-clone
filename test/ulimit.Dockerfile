# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

FROM busybox
# Usa BusyBox como imagen base (ligera y con herramientas básicas de Linux)

RUN ulimit -a
# Ejecuta un comando durante la construcción de la imagen
# ulimit -a → muestra todos los límites de recursos del sistema
# (como memoria, número de archivos abiertos, procesos, etc.)