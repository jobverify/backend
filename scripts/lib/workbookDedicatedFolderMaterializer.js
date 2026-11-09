import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  getDefaultDryRunRelativePath,
  getDefaultScriptModulePath,
  getScraperSourceDirectoryName,
} from '../../scraper-support/providers/sourcePaths.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..', '..')
const defaultScraperDir = path.join(backendDir, 'scraper')
const supportProviderDir = path.join(backendDir, 'scraper-support', 'providers')

const FAIL_CLOSED_HELPER = 'failClosedSentinel.js'
const VERIFIED_EMPTY_HELPER = 'verifiedCareersEmptyState.js'
const FAIL_CLOSED_HELPER_SOURCE = `export const createFailClosedSentinelScraper = () => ({
  async run() {
    return []
  },
})

export const run = async () => createFailClosedSentinelScraper().run()
`
const VERIFIED_EMPTY_HELPER_SOURCE = `// These exact-company careers pages were reviewed with zero public jobs on 2026-07-25.
// A later review must replace this snapshot with a parser before jobs are emitted.
export const createVerifiedCareersEmptyStateScraper = () => ({
  async run() {
    return []
  },
})

export const run = async () => createVerifiedCareersEmptyStateScraper().run()
`

const getLegacyModuleSpecifier = (provider = {}) =>
  String(provider.originalModulePath || provider.modulePath || '')

const escapeJsString = (value) => JSON.stringify(value ?? null)

const buildCatalogObject = (provider = {}) => ({
  ...provider,
  modulePath: '__MODULE_PATH__',
  dryRunFile: '__DRY_RUN_FILE__',
})

const renderCatalogModule = (provider) => {
  const serialized = JSON.stringify(buildCatalogObject(provider), null, 2)
    .replace('"__MODULE_PATH__"', "path.join(currentDir, 'script.js')")
    .replace('"__DRY_RUN_FILE__"', "path.join(currentDir, 'jobs.json')")

  return `import path from 'node:path'
import { fileURLToPath } from 'node:url'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PROVIDER_METADATA = ${serialized}

export default PROVIDER_METADATA
export { PROVIDER_METADATA }
`
}

const renderWrapperScript = ({
  helperImport,
  helperExport,
  provider,
  disposition = provider.atsPlatform,
}) => `import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { ${helperExport} } from '${helperImport}'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

export const SOURCE = ${escapeJsString(provider.source)}
export const COMPANY = ${escapeJsString(provider.companyName || provider.source)}
export const CAREERS_URL = ${escapeJsString(provider.companyCareerPage || null)}
export const DISPOSITION = ${escapeJsString(disposition || null)}
export const VERIFIED_ON = ${escapeJsString(provider.verifiedOn || null)}
export const VERIFIED_SURFACE_SUMMARY = ${escapeJsString(provider.verifiedSurfaceSummary || null)}

export const run = async () => ${helperExport}().run()

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { saveToDB, saveToFile } = await import('../../scraper-support/utils/saveToDB.js')
  const isDryRun = process.argv.includes('--dry-run')
  const jobs = await run()

  if (isDryRun) {
    saveToFile(jobs, path.join(currentDir, 'jobs.json'))
  } else {
    await saveToDB(jobs, SOURCE)
  }
}
`

const renderGeneratedScript = (provider) => {
  const legacyModulePath = getLegacyModuleSpecifier(provider)

  if (legacyModulePath.includes(VERIFIED_EMPTY_HELPER)) {
    return renderWrapperScript({
      helperImport: './verifiedCareersEmptyState.js',
      helperExport: 'createVerifiedCareersEmptyStateScraper',
      provider,
      disposition: 'verified-first-party-careers-empty-result',
    })
  }

  return renderWrapperScript({
    helperImport: './failClosedSentinel.js',
    helperExport: 'createFailClosedSentinelScraper',
    provider,
    disposition: provider.atsPlatform || 'workbook-exact-name-sentinel',
  })
}

const resolveLegacyModulePath = (
  provider,
  {
    scraperDir = defaultScraperDir,
    supportProviderDirectory = supportProviderDir,
  } = {},
) => {
  const legacySpecifier = getLegacyModuleSpecifier(provider)
  const legacyCandidatePath = path.resolve(path.join(scraperDir, 'providers'), legacySpecifier)

  if (existsSync(legacyCandidatePath)) {
    return legacyCandidatePath
  }

  if (legacySpecifier.includes(FAIL_CLOSED_HELPER)) {
    return path.join(supportProviderDirectory, FAIL_CLOSED_HELPER)
  }

  if (legacySpecifier.includes(VERIFIED_EMPTY_HELPER)) {
    return path.join(supportProviderDirectory, VERIFIED_EMPTY_HELPER)
  }

  return legacyCandidatePath
}

const rewriteDryRunOutputPath = (sourceCode) =>
  String(sourceCode || '')
    .replace(/path\.join\(currentDir,\s*'[^']+\.jobs\.json'\)/g, "path.join(currentDir, 'jobs.json')")
    .replace(/path\.join\(currentDir,\s*"[^"]+\.jobs\.json"\)/g, "path.join(currentDir, 'jobs.json')")

const collectRelativeImports = (sourceCode = '') => {
  const imports = new Set()
  const patterns = [
    /(?:import|export)\s+(?:[^'"\n]+?\s+from\s+)?['"](\.[^'"]+\.js)['"]/g,
    /import\(\s*['"](\.[^'"]+\.js)['"]\s*\)/g,
  ]

  for (const pattern of patterns) {
    for (const match of String(sourceCode).matchAll(pattern)) {
      imports.add(match[1])
    }
  }

  return [...imports]
}

const copyLocalDependencyGraph = (entryFilePath, targetDirectory, { rootDirectory } = {}) => {
  const visited = new Set()

  const visit = (absolutePath) => {
    if (visited.has(absolutePath) || !existsSync(absolutePath)) return
    visited.add(absolutePath)

    const sourceCode = readFileSync(absolutePath, 'utf8')
    const relativeName = path.relative(rootDirectory, absolutePath)
    const destinationPath = path.join(targetDirectory, relativeName)
    mkdirSync(path.dirname(destinationPath), { recursive: true })
    copyFileSync(absolutePath, destinationPath)

    for (const specifier of collectRelativeImports(sourceCode)) {
      const resolvedDependency = path.resolve(path.dirname(absolutePath), specifier)
      if (!resolvedDependency.startsWith(rootDirectory)) continue
      visit(resolvedDependency)
    }
  }

  for (const specifier of collectRelativeImports(readFileSync(entryFilePath, 'utf8'))) {
    const resolvedDependency = path.resolve(path.dirname(entryFilePath), specifier)
    if (!resolvedDependency.startsWith(rootDirectory)) continue
    visit(resolvedDependency)
  }
}

const copyGeneratedHelper = (provider, sourceDirectory, options) => {
  const helperName = getLegacyModuleSpecifier(provider).includes(VERIFIED_EMPTY_HELPER)
    ? VERIFIED_EMPTY_HELPER
    : FAIL_CLOSED_HELPER
  const helperSourcePath = resolveLegacyModulePath(provider, options)
  const helperTargetPath = path.join(sourceDirectory, helperName)
  mkdirSync(path.dirname(helperTargetPath), { recursive: true })

  if (existsSync(helperSourcePath)) {
    copyFileSync(helperSourcePath, helperTargetPath)
    return
  }

  writeFileSync(
    helperTargetPath,
    helperName === VERIFIED_EMPTY_HELPER
      ? VERIFIED_EMPTY_HELPER_SOURCE
      : FAIL_CLOSED_HELPER_SOURCE,
    'utf8',
  )
}

export const isWorkbookSentinelProvider = (provider = {}) =>
  getLegacyModuleSpecifier(provider).includes(FAIL_CLOSED_HELPER)
  || provider.atsPlatform === 'workbook-exact-name-sentinel'

export const isWorkbookVerifiedEmptyStateProvider = (provider = {}) =>
  getLegacyModuleSpecifier(provider).includes(VERIFIED_EMPTY_HELPER)
  || provider.atsPlatform === 'verified-first-party-careers-empty-result'

export const getDedicatedWorkbookTarget = (provider = {}) => {
  const sourceDirectoryName = getScraperSourceDirectoryName(provider)
  return {
    folderName: sourceDirectoryName,
    sourceDirectoryName,
    workday: sourceDirectoryName.endsWith('.workday'),
  }
}

const removeStaleWorkbookSourceDirectory = (
  provider,
  { scraperDir = defaultScraperDir } = {},
) => {
  const targetDirectoryName = getScraperSourceDirectoryName(provider)
  const legacyDirectoryName = getScraperSourceDirectoryName(provider?.source || provider?.name || '')

  if (!targetDirectoryName.endsWith('.workday') || legacyDirectoryName === targetDirectoryName) {
    return
  }

  const legacyDirectory = path.join(scraperDir, legacyDirectoryName)
  const legacyCatalogPath = path.join(legacyDirectory, 'catalog.js')
  const legacyScriptPath = path.join(legacyDirectory, 'script.js')

  if (!existsSync(legacyCatalogPath) || !existsSync(legacyScriptPath)) return

  const legacyCatalogSource = readFileSync(legacyCatalogPath, 'utf8')
  const legacyScriptSource = readFileSync(legacyScriptPath, 'utf8')
  const matchesSource = legacyCatalogSource.includes(`"source": ${JSON.stringify(provider.source)}`)
  const looksGeneratedWorkbookSource =
    legacyCatalogSource.includes('"originalModulePath": "../workbookbatch')
    || legacyCatalogSource.includes('"atsPlatform": "workbook-exact-name-sentinel"')
    || legacyScriptSource.includes('createFailClosedSentinelScraper')
    || legacyScriptSource.includes('createVerifiedCareersEmptyStateScraper')

  if (matchesSource && looksGeneratedWorkbookSource) {
    rmSync(legacyDirectory, { recursive: true, force: true })
  }
}

export const materializeWorkbookProvider = (
  provider,
  {
    scraperDir = defaultScraperDir,
    repoDir,
    supportProviderDirectory = supportProviderDir,
  } = {},
) => {
  void repoDir

  const { sourceDirectoryName } = getDedicatedWorkbookTarget(provider)
  const sourceDirectory = path.join(scraperDir, sourceDirectoryName)
  removeStaleWorkbookSourceDirectory(provider, { scraperDir })
  mkdirSync(sourceDirectory, { recursive: true })

  const generatedMode = isWorkbookVerifiedEmptyStateProvider(provider)
    ? 'verified-empty-generated'
    : isWorkbookSentinelProvider(provider)
      ? 'sentinel-generated'
      : 'live-copy'

  if (generatedMode === 'live-copy') {
    rmSync(path.join(sourceDirectory, FAIL_CLOSED_HELPER), { force: true })
    rmSync(path.join(sourceDirectory, VERIFIED_EMPTY_HELPER), { force: true })

    const legacyModulePath = resolveLegacyModulePath(provider, {
      scraperDir,
      supportProviderDirectory,
    })
    const targetScriptPath = path.join(sourceDirectory, 'script.js')
    const sourceScriptPath = existsSync(legacyModulePath) ? legacyModulePath : targetScriptPath

    if (!existsSync(sourceScriptPath)) {
      throw new Error(
        `Missing live workbook source for ${provider.source}: expected ${legacyModulePath} or ${targetScriptPath}`,
      )
    }

    const rewrittenSource = rewriteDryRunOutputPath(readFileSync(sourceScriptPath, 'utf8'))
    writeFileSync(targetScriptPath, rewrittenSource, 'utf8')

    if (sourceScriptPath !== targetScriptPath) {
      const legacyModuleDir = path.dirname(sourceScriptPath)
      copyLocalDependencyGraph(sourceScriptPath, sourceDirectory, { rootDirectory: legacyModuleDir })
    }
  } else {
    const activeHelperName = generatedMode === 'verified-empty-generated'
      ? VERIFIED_EMPTY_HELPER
      : FAIL_CLOSED_HELPER
    const staleHelperName = activeHelperName === VERIFIED_EMPTY_HELPER
      ? FAIL_CLOSED_HELPER
      : VERIFIED_EMPTY_HELPER

    rmSync(path.join(sourceDirectory, staleHelperName), { force: true })
    if (existsSync(resolveLegacyModulePath(provider, {
      scraperDir,
      supportProviderDirectory,
    }))) {
      rmSync(path.join(sourceDirectory, activeHelperName), { force: true })
    }

    copyGeneratedHelper(provider, sourceDirectory, {
      scraperDir,
      supportProviderDirectory,
    })
    writeFileSync(path.join(sourceDirectory, 'script.js'), renderGeneratedScript(provider), 'utf8')
  }

  writeFileSync(path.join(sourceDirectory, 'catalog.js'), renderCatalogModule(provider), 'utf8')
  if (!existsSync(path.join(sourceDirectory, 'jobs.json'))) {
    writeFileSync(path.join(sourceDirectory, 'jobs.json'), '[]\n', 'utf8')
  }

  return {
    source: provider.source,
    sourceDirectory,
    modulePath: getDefaultScriptModulePath(provider),
    dryRunFile: getDefaultDryRunRelativePath(provider),
    materializationMode: generatedMode,
  }
}
