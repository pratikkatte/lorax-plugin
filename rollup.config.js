import { babel } from '@rollup/plugin-babel'
import globals from '@jbrowse/core/ReExports/list'
import { createRollupConfig } from '@jbrowse/development-tools'

/**
 * @lorax/core ships JSX under node_modules; JBrowse's babel excludes all of
 * node_modules, so Rollup never transpiles it. Run Babel on Lorax/vis.gl
 * packages (right after node-resolve) before other plugins parse them.
 */
function babelForLoraxCore() {
  return babel({
    babelHelpers: 'bundled',
    extensions: ['.js', '.jsx', '.mjs'],
    include: [
      /[/\\]node_modules[/\\]@lorax[/\\]core[/\\]/,
      /[/\\]node_modules[/\\]@deck\.gl[/\\]/,
      /[/\\]node_modules[/\\]@luma\.gl[/\\]/,
      /[/\\]node_modules[/\\]@math\.gl[/\\]/,
    ],
    presets: [
      ['@babel/preset-env', { modules: false, bugfixes: true, targets: { node: '10' } }],
      ['@babel/preset-react', { runtime: 'automatic' }],
    ],
    plugins: [['@babel/plugin-proposal-class-properties', { loose: false }]],
  })
}

function withWorkerInlineExternal(external) {
  const forceBundle = new Set([
    'prop-types',
    '@jbrowse/core/ui/BaseTooltip',
    '@jbrowse/core/ui/ErrorBoundary',
    '@jbrowse/core/util/stopToken',
  ])
  return id => {
    if (typeof id === 'string' && forceBundle.has(id)) {
      return false
    }
    if (typeof id === 'string' && id.includes('?worker&inline')) {
      return true
    }
    if (typeof external === 'function') {
      return external(id)
    }
    if (Array.isArray(external)) {
      return external.some(entry =>
        entry instanceof RegExp ? entry.test(id) : entry === id,
      )
    }
    return Boolean(external)
  }
}

function disableViteInlineWorkerImports() {
  const workerImportPattern =
    /import\(\s*\/\*[\s\S]*?\*\/\s*\/\*[\s\S]*?\*\/\s*['"][^'"]+\?worker&inline['"]\s*\)/g
  return {
    name: 'disable-vite-inline-worker-imports',
    transform(code, id) {
      if (!id.includes('/@lorax/core/src/workers/workerSpecs.js')) {
        return null
      }
      if (!workerImportPattern.test(code)) {
        return null
      }
      const transformed = code.replace(
        workerImportPattern,
        "Promise.reject(new Error('inline workers unavailable in Rollup build'))",
      )
      return { code: transformed, map: null }
    },
  }
}

function replaceProcessEnv() {
  const nodeEnv = JSON.stringify(process.env.NODE_ENV || 'development')
  return {
    name: 'replace-process-env',
    transform(code) {
      if (!code.includes('process.env.NODE_ENV')) {
        return null
      }
      return {
        code: code.replaceAll('process.env.NODE_ENV', nodeEnv),
        map: null,
      }
    },
  }
}

function withInlineDynamicImports(output) {
  if (Array.isArray(output)) {
    return output.map(entry => ({ ...entry, inlineDynamicImports: true }))
  }
  if (output && typeof output === 'object') {
    return { ...output, inlineDynamicImports: true }
  }
  return output
}

function withJBrowseSubpathGlobals(output) {
  const extraGlobals = {
    '@jbrowse/core/ui/BaseTooltip': 'JBrowseExports["BaseTooltip"]',
    '@jbrowse/core/ui/ErrorBoundary': 'JBrowseExports["ErrorBoundary"]',
    '@jbrowse/core/util/stopToken': 'JBrowseExports["stopToken"]',
  }
  const patchEntry = entry => ({
    ...entry,
    globals: {
      ...(entry?.globals || {}),
      ...extraGlobals,
    },
  })
  if (Array.isArray(output)) {
    return output.map(patchEntry)
  }
  if (output && typeof output === 'object') {
    return patchEntry(output)
  }
  return output
}

function isUMDConfig(rollupConfig) {
  const output = rollupConfig.output
  const firstOutput = Array.isArray(output) ? output[0] : output
  return firstOutput?.format === 'umd'
}

function withoutLegacyNodePolyfillPlugins(plugins) {
  // In @jbrowse/development-tools v2.x UMD plugins end with two anonymous
  // legacy polyfill plugins (node-globals + node-builtins) that use an older
  // Acorn parser and crash on modern @luma.gl syntax.
  if (plugins.length >= 2) {
    return plugins.slice(0, -2)
  }
  return plugins
}

function injectLoraxCoreBabel(rollupConfig) {
  const plugins = rollupConfig.plugins
  if (!Array.isArray(plugins) || plugins.length === 0) {
    return rollupConfig
  }
  if (process.env.LORAX_DEBUG_PLUGINS === 'true') {
    const output = rollupConfig.output
    const firstOutput = Array.isArray(output) ? output[0] : output
    const format = firstOutput?.format || 'unknown'
    console.log(
      `[rollup:${format}] plugins: ${plugins
        .map(plugin => plugin?.name || '(anonymous)')
        .join(', ')}`,
    )
  }
  const maybeFilteredPlugins = isUMDConfig(rollupConfig)
    ? withoutLegacyNodePolyfillPlugins(plugins)
    : plugins
  return {
    ...rollupConfig,
    external: withWorkerInlineExternal(rollupConfig.external),
    output: isUMDConfig(rollupConfig)
      ? withJBrowseSubpathGlobals(withInlineDynamicImports(rollupConfig.output))
      : withInlineDynamicImports(rollupConfig.output),
    plugins: [
      maybeFilteredPlugins[0],
      disableViteInlineWorkerImports(),
      replaceProcessEnv(),
      babelForLoraxCore(),
      ...maybeFilteredPlugins.slice(1),
    ],
  }
}

function stringToBoolean(string) {
  if (string === undefined) {
    return undefined
  }
  if (string === 'true') {
    return true
  }
  if (string === 'false') {
    return false
  }
  throw new Error('unknown boolean string')
}

const includeUMD = stringToBoolean(process.env.JB_UMD)
const includeCJS = stringToBoolean(process.env.JB_CJS)
const includeESMBundle = stringToBoolean(process.env.JB_ESM_BUNDLE)
const includeNPM = stringToBoolean(process.env.JB_NPM)

const rawConfigs = createRollupConfig(globals.default, {
  includeUMD,
  includeCJS,
  includeESMBundle,
  includeNPM,
})

const configs = Array.isArray(rawConfigs) ? rawConfigs : [rawConfigs]

export default configs.map(injectLoraxCoreBabel)
