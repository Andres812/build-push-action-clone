import * as core from '@actions/core'; // Librería para leer inputs y manejar logs en GitHub Actions
import * as handlebars from 'handlebars'; // Motor de plantillas para procesar strings dinámicos

import {Build} from '@docker/actions-toolkit/lib/buildx/build.js'; // Funciones relacionadas con buildx (Docker)
import {GitHub} from '@docker/actions-toolkit/lib/github/github.js'; // Información del entorno de GitHub
import {Toolkit} from '@docker/actions-toolkit/lib/toolkit.js'; // Toolkit general para utilidades del action
import {Util} from '@docker/actions-toolkit/lib/util.js'; // Funciones auxiliares (listas, parseos, etc.)

// Variable para guardar en caché el contexto por defecto
let defaultContextPromise: Promise<string> | undefined;

// Obtiene el contexto por defecto del repositorio (ej: repo actual en GitHub)
async function getDefaultContext(): Promise<string> {
  defaultContextPromise ??= new Build().gitContext(); // Solo se calcula una vez
  return await defaultContextPromise;
}

// Interfaz que define todos los inputs que recibe la action
export interface Inputs {
  'add-hosts': string[];
  allow: string[];
  annotations: string[];
  attests: string[];
  'build-args': string[];
  'build-contexts': string[];
  builder: string;
  'cache-from': string[];
  'cache-to': string[];
  call: string;
  'cgroup-parent': string;
  context: string;
  file: string;
  labels: string[];
  load: boolean;
  network: string;
  'no-cache': boolean;
  'no-cache-filters': string[];
  outputs: string[];
  platforms: string[];
  provenance: string;
  pull: boolean;
  push: boolean;
  sbom: string;
  secrets: string[];
  'secret-envs': string[];
  'secret-files': string[];
  'shm-size': string;
  ssh: string[];
  tags: string[];
  target: string;
  ulimit: string[];
  'github-token': string;
}

// Función que obtiene todos los inputs definidos en action.yml
export async function getInputs(): Promise<Inputs> {
  const defaultContext = await getDefaultContext(); // obtiene contexto base

  return {
    'add-hosts': Util.getInputList('add-hosts'), // convierte input en lista
    allow: Util.getInputList('allow'),
    annotations: Util.getInputList('annotations', {ignoreComma: true}),
    attests: Util.getInputList('attests', {ignoreComma: true}),
    'build-args': Util.getInputList('build-args', {ignoreComma: true}),
    'build-contexts': Util.getInputList('build-contexts', {ignoreComma: true}),
    builder: core.getInput('builder'), // obtiene string directo
    'cache-from': Util.getInputList('cache-from', {ignoreComma: true}),
    'cache-to': Util.getInputList('cache-to', {ignoreComma: true}),
    call: core.getInput('call'),
    'cgroup-parent': core.getInput('cgroup-parent'),

    // Procesa el contexto usando handlebars (puede usar variables dinámicas)
    context: handlebars.compile(core.getInput('context'))({defaultContext}) || defaultContext,

    file: core.getInput('file'),
    labels: Util.getInputList('labels', {ignoreComma: true}),
    load: core.getBooleanInput('load'), // convierte a booleano
    network: core.getInput('network'),
    'no-cache': core.getBooleanInput('no-cache'),
    'no-cache-filters': Util.getInputList('no-cache-filters'),
    outputs: Util.getInputList('outputs', {ignoreComma: true, quote: false}),
    platforms: Util.getInputList('platforms'),
    provenance: Build.getProvenanceInput('provenance'), // manejo especial de provenance
    pull: core.getBooleanInput('pull'),
    push: core.getBooleanInput('push'),
    sbom: core.getInput('sbom'),
    secrets: Util.getInputList('secrets', {ignoreComma: true}),
    'secret-envs': Util.getInputList('secret-envs'),
    'secret-files': Util.getInputList('secret-files', {ignoreComma: true}),
    'shm-size': core.getInput('shm-size'),
    ssh: Util.getInputList('ssh'),
    tags: Util.getInputList('tags'),
    target: core.getInput('target'),
    ulimit: Util.getInputList('ulimit', {ignoreComma: true}),
    'github-token': core.getInput('github-token')
  };
}

// Construye todos los argumentos finales para ejecutar docker buildx
export async function getArgs(inputs: Inputs, toolkit: Toolkit): Promise<Array<string>> {
  return [
    ...await getBuildArgs(inputs, inputs.context, toolkit), // argumentos de build
    ...await getCommonArgs(inputs, toolkit), // argumentos generales
    inputs.context // contexto final
  ];
}

// Genera los argumentos específicos del comando "docker buildx build"
async function getBuildArgs(inputs: Inputs, context: string, toolkit: Toolkit): Promise<Array<string>> {
  const defaultContext = await getDefaultContext();

  const args: Array<string> = ['build']; // comando base

  // Recorre y agrega hosts personalizados
  await Util.asyncForEach(inputs['add-hosts'], async addHost => {
    args.push('--add-host', addHost);
  });

  // Agrega permisos especiales
  await Util.asyncForEach(inputs.allow, async allow => {
    args.push('--allow', allow);
  });

  // Solo si la versión de buildx lo soporta
  if (await toolkit.buildx.versionSatisfies('>=0.12.0')) {
    await Util.asyncForEach(inputs.annotations, async annotation => {
      args.push('--annotation', annotation);
    });
  } else if (inputs.annotations.length > 0) {
    core.warning("Annotations are only supported by buildx >= 0.12.0");
  }

  // Agrega argumentos de build
  await Util.asyncForEach(inputs['build-args'], async buildArg => {
    args.push('--build-arg', buildArg);
  });

  // Manejo de contextos adicionales
  if (await toolkit.buildx.versionSatisfies('>=0.8.0')) {
    await Util.asyncForEach(inputs['build-contexts'], async buildContext => {
      args.push('--build-context', handlebars.compile(buildContext)({defaultContext}));
    });
  }

  // Cache
  await Util.asyncForEach(inputs['cache-from'], async cacheFrom => {
    args.push('--cache-from', cacheFrom);
  });

  await Util.asyncForEach(inputs['cache-to'], async cacheTo => {
    args.push('--cache-to', cacheTo);
  });

  // Agrega opción call si existe
  if (inputs.call) {
    args.push('--call', inputs.call);
  }

  // Configuración de recursos
  if (inputs['cgroup-parent']) {
    args.push('--cgroup-parent', inputs['cgroup-parent']);
  }

  // Manejo de secretos por variables de entorno
  await Util.asyncForEach(inputs['secret-envs'], async secretEnv => {
    try {
      args.push('--secret', Build.resolveSecretEnv(secretEnv));
    } catch (err) {
      core.warning(err.message);
    }
  });

  // Dockerfile
  if (inputs.file) {
    args.push('--file', inputs.file);
  }

  // Labels
  await Util.asyncForEach(inputs.labels, async label => {
    args.push('--label', label);
  });

  // Plataformas
  if (inputs.platforms.length > 0) {
    args.push('--platform', inputs.platforms.join(','));
  }

  // Tags
  await Util.asyncForEach(inputs.tags, async tag => {
    args.push('--tag', tag);
  });

  return args;
}

// Argumentos generales del comando
async function getCommonArgs(inputs: Inputs, toolkit: Toolkit): Promise<Array<string>> {
  const args: Array<string> = [];

  if (inputs.builder) {
    args.push('--builder', inputs.builder);
  }

  if (inputs.load) {
    args.push('--load');
  }

  if (inputs.network) {
    args.push('--network', inputs.network);
  }

  if (inputs['no-cache']) {
    args.push('--no-cache');
  }

  if (inputs.pull) {
    args.push('--pull');
  }

  if (inputs.push) {
    args.push('--push');
  }

  return args;
}

// Manejo de attestations (seguridad, provenance, sbom)
async function getAttestArgs(inputs: Inputs, toolkit: Toolkit): Promise<Array<string>> {
  const args: Array<string> = [];

  if (inputs.provenance) {
    args.push('--attest', `type=provenance,${inputs.provenance}`);
  }

  if (inputs.sbom) {
    args.push('--attest', `type=sbom,${inputs.sbom}`);
  }

  return args;
}

// Verifica si se desactivan attestations por variable de entorno
function noDefaultAttestations(): boolean {
  if (process.env.BUILDX_NO_DEFAULT_ATTESTATIONS) {
    return Util.parseBool(process.env.BUILDX_NO_DEFAULT_ATTESTATIONS);
  }
  return false;
}