import * as core from '@actions/core'; // Permite guardar estado entre pasos de GitHub Actions

import {Build} from '@docker/actions-toolkit/lib/buildx/build.js'; // Utilidades relacionadas con build (por ejemplo parsear secrets)

import {Inputs} from './context.js'; // Tipo de los inputs que vienen del action.yml

// ============================
// VARIABLES DE ESTADO (se recuperan del entorno)
// ============================

// Carpeta temporal guardada previamente
export const tmpDir = process.env['STATE_tmpDir'] || '';

// Información del builder usado por Docker
export const builderDriver = process.env['STATE_builderDriver'] || '';
export const builderEndpoint = process.env['STATE_builderEndpoint'] || '';

// Inputs guardados para el resumen (convertidos desde JSON)
export const summaryInputs = process.env['STATE_summaryInputs']
  ? JSON.parse(process.env['STATE_summaryInputs'])
  : undefined;

// Referencia del build (ID interno del proceso buildx)
export const buildRef = process.env['STATE_buildRef'] || '';

// Indica si el resumen del build está habilitado
export const isSummarySupported = !!process.env['STATE_isSummarySupported'];


// ============================
// FUNCIONES PARA GUARDAR ESTADO
// ============================

// Guarda la carpeta temporal para usarla después
export function setTmpDir(tmpDir: string) {
  core.saveState('tmpDir', tmpDir); // GitHub guarda esto entre main y post
}

// Guarda el driver del builder (ej: docker-container)
export function setBuilderDriver(builderDriver: string) {
  core.saveState('builderDriver', builderDriver);
}

// Guarda el endpoint del builder (dónde se ejecuta)
export function setBuilderEndpoint(builderEndpoint: string) {
  core.saveState('builderEndpoint', builderEndpoint);
}

// Guarda la referencia del build (para historial o resumen)
export function setBuildRef(buildRef: string) {
  core.saveState('buildRef', buildRef);
}

// Marca que el resumen está disponible
export function setSummarySupported() {
  core.saveState('isSummarySupported', 'true');
}


// ============================
// PROCESAMIENTO DE INPUTS PARA RESUMEN
// ============================

export function setSummaryInputs(inputs: Inputs) {
  const res = {}; // Aquí se guardarán los inputs "limpios"

  // Recorre todos los inputs
  for (const key of Object.keys(inputs)) {

    // Evita guardar el token de GitHub por seguridad
    if (key === 'github-token') {
      continue;
    }

    const value: string | string[] | boolean = inputs[key];

    // Si es booleano y es false → no lo guarda
    if (typeof value === 'boolean' && !value) {
      continue;

    // Si es un arreglo
    } else if (Array.isArray(value)) {

      // Si está vacío → no lo guarda
      if (value.length === 0) {
        continue;

      // Si es un arreglo de secrets
      } else if (key === 'secrets' && value.length > 0) {

        const secretKeys: string[] = [];

        // Extrae solo las claves de los secrets (no los valores)
        for (const secret of value) {
          try {
            // Divide el secret tipo "KEY=VALUE"
            const [skey, _] = Build.parseSecretKvp(secret, true);
            secretKeys.push(skey); // Guarda solo la clave
          } catch {
            // Si el formato es inválido, lo ignora
          }
        }

        // Solo guarda si hay claves válidas
        if (secretKeys.length > 0) {
          res[key] = secretKeys;
        }

        continue;
      }

    // Si el valor es vacío (null, undefined, '')
    } else if (!value) {
      continue;
    }

    // Si pasó todas las validaciones → se guarda
    res[key] = value;
  }

  // Guarda los inputs procesados como JSON en el estado
  core.saveState('summaryInputs', JSON.stringify(res));
}