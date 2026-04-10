import * as fs from 'fs'; // Manejo de archivos del sistema
import * as path from 'path'; // Manejo de rutas
import * as core from '@actions/core'; // API de GitHub Actions (inputs, logs, outputs)
import * as actionsToolkit from '@docker/actions-toolkit'; // Toolkit principal de Docker para actions

import {Buildx} from '@docker/actions-toolkit/lib/buildx/buildx.js'; // Manejo de buildx
import {History as BuildxHistory} from '@docker/actions-toolkit/lib/buildx/history.js'; // Historial de builds
import {Context} from '@docker/actions-toolkit/lib/context.js'; // Manejo de contexto temporal
import {Docker} from '@docker/actions-toolkit/lib/docker/docker.js'; // Funciones de Docker
import {Exec} from '@docker/actions-toolkit/lib/exec.js'; // Ejecutar comandos en terminal
import {GitHub} from '@docker/actions-toolkit/lib/github/github.js'; // Información del entorno GitHub
import {GitHubArtifact} from '@docker/actions-toolkit/lib/github/artifact.js'; // Subir archivos como artifacts
import {GitHubSummary} from '@docker/actions-toolkit/lib/github/summary.js'; // Resumen visual en GitHub
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit.js'; // Toolkit general
import {Util} from '@docker/actions-toolkit/lib/util.js'; // Funciones auxiliares

import {BuilderInfo} from '@docker/actions-toolkit/lib/types/buildx/builder.js'; // Tipo del builder
import {ConfigFile} from '@docker/actions-toolkit/lib/types/docker/docker.js'; // Tipo de config Docker
import {UploadResponse as UploadArtifactResponse} from '@docker/actions-toolkit/lib/types/github/artifact.js';

import * as context from './context.js'; // Archivo que procesa inputs y argumentos
import * as stateHelper from './state-helper.js'; // Manejo de estado interno

// Punto de entrada principal de la GitHub Action
actionsToolkit.run(
  // ============================
  // MAIN (EJECUCIÓN PRINCIPAL)
  // ============================
  async () => {
    const startedTime = new Date(); // Guarda hora de inicio

    const inputs: context.Inputs = await context.getInputs(); // Obtiene inputs del usuario
    stateHelper.setSummaryInputs(inputs); // Guarda inputs para el resumen
    core.debug(`inputs: ${JSON.stringify(inputs)}`); // Debug

    const toolkit = new Toolkit(); // Inicializa toolkit

    // Muestra información del token de GitHub
    await core.group(`GitHub Actions runtime token ACs`, async () => {
      try {
        await GitHub.printActionsRuntimeTokenACs();
      } catch (e) {
        core.warning(e.message);
      }
    });

    // Muestra información de Docker
    await core.group(`Docker info`, async () => {
      try {
        await Docker.printVersion();
        await Docker.printInfo();
      } catch (e) {
        core.info(e.message);
      }
    });

    // Muestra configuración de proxy
    await core.group(`Proxy configuration`, async () => {
      let dockerConfig: ConfigFile | undefined;
      let dockerConfigMalformed = false;

      try {
        dockerConfig = await Docker.configFile(); // Lee config de Docker
      } catch (e) {
        dockerConfigMalformed = true;
        core.warning(`Error leyendo config Docker`);
      }

      // Si hay proxies definidos los imprime
      if (dockerConfig && dockerConfig.proxies) {
        for (const host in dockerConfig.proxies) {
          for (const key in dockerConfig.proxies[host]) {
            core.info(`${key}: ${dockerConfig.proxies[host][key]}`);
          }
        }
      } else if (!dockerConfigMalformed) {
        core.info('No proxy configuration found');
      }
    });

    // Verifica que buildx esté disponible
    if (!(await toolkit.buildx.isAvailable())) {
      core.setFailed(`Docker buildx is required.`);
      return;
    }

    stateHelper.setTmpDir(Context.tmpDir()); // Guarda carpeta temporal

    // Muestra versión de buildx
    await core.group(`Buildx version`, async () => {
      await toolkit.buildx.printVersion();
    });

    let builder: BuilderInfo;

    // Obtiene información del builder
    await core.group(`Builder info`, async () => {
      builder = await toolkit.builder.inspect(inputs.builder);
      stateHelper.setBuilderDriver(builder.driver ?? '');
      stateHelper.setBuilderEndpoint(builder.nodes?.[0]?.endpoint ?? '');
      core.info(JSON.stringify(builder, null, 2));
    });

    // Genera argumentos para docker buildx
    const args: string[] = await context.getArgs(inputs, toolkit);

    // Genera comando final
    const buildCmd = await toolkit.buildx.getCommand(args);

    let err: Error | undefined;

    // Ejecuta el comando docker buildx
    await Exec.getExecOutput(buildCmd.command, buildCmd.args, {
      ignoreReturnCode: true, // no rompe automáticamente
      env: Object.assign({}, process.env, {
        BUILDX_METADATA_WARNINGS: 'true'
      })
    }).then(res => {
      // Manejo de errores
      if (res.exitCode != 0) {
        if (res.stderr.length > 0) {
          err = new Error(`buildx failed: ${res.stderr}`);
        }
      }
    });

    // Obtiene resultados del build
    const imageID = toolkit.buildxBuild.resolveImageID(); // ID de imagen
    const metadata = toolkit.buildxBuild.resolveMetadata(); // metadata
    const digest = toolkit.buildxBuild.resolveDigest(metadata); // hash

    // Output: image ID
    if (imageID) {
      core.setOutput('imageid', imageID);
    }

    // Output: digest
    if (digest) {
      core.setOutput('digest', digest);
    }

    // Output: metadata
    if (metadata) {
      core.setOutput('metadata', JSON.stringify(metadata, null, 2));
    }

    // Obtiene referencia del build
    let ref: string | undefined;
    ref = await buildRef(toolkit, startedTime, inputs.builder);

    if (ref) {
      stateHelper.setBuildRef(ref);
    }

    // Si hay errores, lanza excepción
    if (err) {
      throw err;
    }
  },

  // ============================
  // POST (SE EJECUTA AL FINAL)
  // ============================
  async () => {
    // Genera resumen del build
    if (stateHelper.isSummarySupported) {
      await core.group(`Generating build summary`, async () => {
        try {
          const buildxHistory = new BuildxHistory();

          // Exporta historial del build
          const exportRes = await buildxHistory.export({
            refs: stateHelper.buildRef ? [stateHelper.buildRef] : []
          });

          // Sube como artifact
          await GitHubArtifact.upload({
            filename: exportRes.dockerbuildFilename
          });

          // Escribe resumen en GitHub
          await GitHubSummary.writeBuildSummary({
            exportRes: exportRes,
            inputs: stateHelper.summaryInputs
          });

        } catch (e) {
          core.warning(e.message);
        }
      });
    }

    // Limpia carpeta temporal
    if (stateHelper.tmpDir.length > 0) {
      try {
        fs.rmSync(stateHelper.tmpDir, {recursive: true});
      } catch {
        core.warning(`Error eliminando carpeta temporal`);
      }
    }
  }
);

// Obtiene referencia del build
async function buildRef(toolkit: Toolkit, since: Date, builder?: string): Promise<string> {
  const ref = toolkit.buildxBuild.resolveRef(); // intenta obtener referencia directa
  if (ref) return ref;

  // Si no, busca en historial
  if (!builder) {
    const currentBuilder = await toolkit.builder.inspect();
    builder = currentBuilder.name;
  }

  const refs = Buildx.refs({
    dir: Buildx.refsDir,
    builderName: builder,
    since: since
  });

  return Object.keys(refs).length > 0 ? Object.keys(refs)[0] : '';
}

// Verifica si annotations están habilitadas
function buildChecksAnnotationsEnabled(): boolean {
  if (process.env.DOCKER_BUILD_CHECKS_ANNOTATIONS) {
    return Util.parseBool(process.env.DOCKER_BUILD_CHECKS_ANNOTATIONS);
  }
  return true;
}

// Verifica si summary está habilitado
function buildSummaryEnabled(): boolean {
  if (process.env.DOCKER_BUILD_SUMMARY) {
    return Util.parseBool(process.env.DOCKER_BUILD_SUMMARY);
  }
  return true;
}

// Verifica si subir artifacts está habilitado
function buildRecordUploadEnabled(): boolean {
  if (process.env.DOCKER_BUILD_RECORD_UPLOAD) {
    return Util.parseBool(process.env.DOCKER_BUILD_RECORD_UPLOAD);
  }
  return true;
}

// Define días de retención de artifacts
function buildRecordRetentionDays(): number | undefined {
  const val = process.env.DOCKER_BUILD_RECORD_RETENTION_DAYS;
  if (val) {
    const res = parseInt(val);
    if (isNaN(res)) {
      throw new Error(`Valor inválido`);
    }
    return res;
  }
}