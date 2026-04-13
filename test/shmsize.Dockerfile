# syntax=docker/dockerfile:1
# Define la versión de la sintaxis del Dockerfile

FROM busybox
# Usa BusyBox como imagen base (ligera y con herramientas básicas)

RUN mount | grep /dev/shm
# Ejecuta un comando durante la construcción de la imagen
# mount → muestra los sistemas de archivos montados
# grep /dev/shm → filtra para mostrar información sobre la memoria compartida