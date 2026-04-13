# syntax=docker/dockerfile:1
# Define la versión de la sintaxis de Dockerfile que se va a utilizar

FROM alpine
# Especifica la imagen base del contenedor
# Alpine es una distribución de Linux muy ligera y común en contenedores

RUN cat /proc/self/cgroup
# Ejecuta un comando durante la construcción de la imagen
# Este comando muestra la información de los grupos de control (cgroups) del proceso actual