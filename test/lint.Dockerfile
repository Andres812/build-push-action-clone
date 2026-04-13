# Etapa 1: Construcción base
FROM busybox AS base
# Se usa la imagen BusyBox como base y se le asigna el nombre "base"

COPY lint.Dockerfile .
# Copia el archivo "lint.Dockerfile" desde tu máquina al contenedor

# Etapa 2: Imagen final
FROM scratch
# "scratch" es una imagen vacía (sin sistema base), se usa para imágenes mínimas

MAINTAINER moby@example.com
# Define el autor de la imagen (aunque esta instrucción ya está obsoleta)

COPY --from=base /lint.Dockerfile /
# Copia el archivo desde la etapa "base" hacia la imagen final

CMD [ "echo", "Hello, Norway!" ]
# Comando por defecto (este será ignorado si hay otro CMD después)

CMD [ "echo", "Hello, Sweden!" ]
# Este CMD sobrescribe al anterior (solo se ejecuta este)

ENTRYPOINT my-program start
# Define el comando principal del contenedor
# Se ejecuta siempre al iniciar el contenedor