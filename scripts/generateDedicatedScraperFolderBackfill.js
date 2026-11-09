import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { getScraperCatalog } from '../scraper-support/providers/index.js'
import {
  getDefaultDryRunRelativePath,
  getDefaultScriptModulePath,
  resolveScraperSourceDirectory,
} from '../scraper-support/providers/sourcePaths.js'
import {
  loadWorkbookBatchAliases,
  loadWorkbookBatchProviders,
  buildCanonicalWorkbookInventory,
} from './lib/workbookMigrationInventory.js'
import {
  materializeWorkbookProvider,
} from './lib/workbookDedicatedFolderMaterializer.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const repoDir = path.resolve(backendDir, '..')
const scraperDir = path.join(backendDir, 'scraper')
const providerExtensionDir = path.join(
  backendDir,
  'scraper-support',
  'providers',
  'providerExtensions',
)
const aliasExtensionDir = path.join(
  backendDir,
  'scraper-support',
  'providers',
  'companyAliasExtensions',
)
const manifestPath = path.join(providerExtensionDir, 'zz-dedicated-scraper-folder-backfill.json')
const legacyManifestPath = path.join(providerExtensionDir, 'dedicated-scraper-folder-backfill.json')
const aliasOutputPath = path.join(aliasExtensionDir, 'zz-workbook-dedicated.json')
const COVERAGE_ARTIFACT_BASENAME = 'company-scraper-check-india-hiring-400.csv'

const TARGET_COVERAGE_TYPES = new Set(['provider_only', 'sentinel_placeholder'])

export const resolveDefaultCoverageArtifactPath = ({ repoRoot = repoDir } = {}) => {
  const legacyCoveragePath = path.join(repoRoot, COVERAGE_ARTIFACT_BASENAME)
  if (existsSync(legacyCoveragePath)) return legacyCoveragePath
  return path.join(repoRoot, 'artifacts', COVERAGE_ARTIFACT_BASENAME)
}

const coverageArtifactPath = resolveDefaultCoverageArtifactPath()

const parseCsvLine = (line) => {
  const columns = []
  let current = ''
  let insideQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]

    if (char === '"') {
      if (insideQuotes && line[index + 1] === '"') {
        current += '"'
        index += 1
      } else {
        insideQuotes = !insideQuotes
      }
      continue
    }

    if (char === ',' && !insideQuotes) {
      columns.push(current)
      current = ''
      continue
    }

    current += char
  }

  columns.push(current)
  return columns
}

const parseCsvRows = (csvText) => {
  const lines = String(csvText || '')
    .trim()
    .split(/\r?\n/)

  if (lines.length === 0) return []

  const [headerLine, ...dataLines] = lines
  const headers = parseCsvLine(headerLine).map((value) => String(value || '').trim())

  return dataLines
    .filter(Boolean)
    .map((line) => {
      const values = parseCsvLine(line)
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
    })
}

const escapeCsv = (value) => {
  const text = String(value ?? '')

  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }

  return text
}

const pickIfPresent = (target, key, value) => {
  if (value === undefined) return
  target[key] = value
}

const buildTargetManifestFromCoverage = ({ coverageRows, catalog }) => {
  const providersBySource = new Map(catalog.map((provider) => [provider.source, provider]))
  const seenSources = new Set()
  const manifest = []

  for (const row of coverageRows) {
    const coverageType = String(row.coverage_type || '').trim()
    const source = String(row.source || '').trim()
    if (!TARGET_COVERAGE_TYPES.has(coverageType) || !source || seenSources.has(source)) continue

    const provider = providersBySource.get(source)
    if (!provider) {
      throw new Error(`Unable to find catalog provider for targeted source: ${source}`)
    }

    const entry = {
      source,
      companyName: provider.companyName || provider.company || row.company || source,
      adapter: 'script',
      modulePath: getDefaultScriptModulePath(provider),
      dryRunFile: getDefaultDryRunRelativePath(provider),
      companyCareerPage: provider.companyCareerPage || null,
      companyDomain: provider.companyDomain || null,
      atsPlatform:
        coverageType === 'provider_only'
          ? provider.atsPlatform || 'workday'
          : 'dedicated-local-empty-scraper',
      countryFilter: provider.countryFilter || 'India',
      paginationStrategy:
        coverageType === 'provider_only'
          ? provider.paginationStrategy || 'next-button'
          : 'local-dedicated-empty-wrapper',
      extractionStrategy:
        coverageType === 'provider_only'
          ? provider.extractionStrategy || 'dom+detail-page'
          : 'local-dedicated-empty-wrapper-return-empty',
      parser: coverageType === 'provider_only' ? provider.parser || 'workday' : 'custom-script',
      normalizationProfile: provider.normalizationProfile || 'engineering-default',
      verifiedOn: provider.verifiedOn || null,
      verifiedSurfaceSummary: provider.verifiedSurfaceSummary || null,
      backfillMode: coverageType === 'provider_only' ? 'workday' : 'sentinel',
      originalAdapter: provider.adapter || null,
      originalAtsPlatform: provider.atsPlatform || null,
      originalModulePath: provider.modulePath || null,
      originalDryRunFile: provider.dryRunFile || null,
    }

    pickIfPresent(entry, 'baseUrl', provider.baseUrl)
    pickIfPresent(entry, 'locationCountry', provider.locationCountry)
    pickIfPresent(entry, 'officialBrandName', provider.officialBrandName)
    pickIfPresent(entry, 'homepageUrl', provider.homepageUrl)
    pickIfPresent(entry, 'officialHomepageUrl', provider.officialHomepageUrl)

    manifest.push(entry)
    seenSources.add(source)
  }

  return manifest.sort((left, right) => left.source.localeCompare(right.source))
}

const loadSeedManifest = (manifestPaths = []) =>
  manifestPaths
    .filter((candidatePath) => existsSync(candidatePath))
    .map((candidatePath) => JSON.parse(readFileSync(candidatePath, 'utf8')))
    .filter((value) => Array.isArray(value) && value.length > 0)
    .sort((left, right) => right.length - left.length)[0] || null

const classifyCoverageRow = ({ source, provider }) => {
  const hasSourceDir = existsSync(
    resolveScraperSourceDirectory(provider || source, {
      baseDir: scraperDir,
      workday: provider?.atsPlatform === 'workday' || provider?.backfillMode === 'workday',
    }),
  )
  const isSharedSentinel =
    provider?.atsPlatform === 'workbook-exact-name-sentinel'
    || String(provider?.modulePath || '').includes('failClosedSentinel.js')

  if (hasSourceDir) return 'dedicated_source_dir'
  if (isSharedSentinel) return 'sentinel_placeholder'
  return 'provider_only'
}

const ensureDedicatedProviderDryRunFile = (
  provider,
  { scraperBaseDir = scraperDir } = {},
) => {
  const sourceDirectory = resolveScraperSourceDirectory(provider, {
    baseDir: scraperBaseDir,
    workday: provider?.atsPlatform === 'workday' || provider?.backfillMode === 'workday',
  })
  const dryRunFilePath = path.join(sourceDirectory, 'jobs.json')

  if (existsSync(dryRunFilePath)) return

  mkdirSync(sourceDirectory, { recursive: true })
  writeFileSync(dryRunFilePath, '[]\n', 'utf8')
}

const writeCoverageArtifact = ({ coverageRows, catalog, coveragePath = coverageArtifactPath }) => {
  const providersBySource = new Map(catalog.map((provider) => [provider.source, provider]))
  const headers = ['company', 'source', 'has_backend_scraper_folder', 'coverage_type']
  const lines = [headers.join(',')]

  for (const row of coverageRows) {
    const source = String(row.source || '').trim()
    const provider = providersBySource.get(source)
    const coverageType = classifyCoverageRow({ source, provider })
    const hasSourceDir = existsSync(
      resolveScraperSourceDirectory(provider || source, {
        baseDir: scraperDir,
        workday: provider?.atsPlatform === 'workday' || provider?.backfillMode === 'workday',
      }),
    )

    lines.push([
      escapeCsv(row.company),
      escapeCsv(source),
      escapeCsv(hasSourceDir ? 'yes' : 'no'),
      escapeCsv(coverageType),
    ].join(','))
  }

  mkdirSync(path.dirname(coveragePath), { recursive: true })
  writeFileSync(coveragePath, `${lines.join('\n')}\n`, 'utf8')
}

const normalizeWorkbookManifestProvider = (provider = {}) => ({
  ...provider,
  adapter: 'script',
  modulePath: getDefaultScriptModulePath(provider),
  dryRunFile: getDefaultDryRunRelativePath(provider),
  backfillMode: provider.modulePath?.includes('failClosedSentinel.js')
    ? 'sentinel'
    : provider.modulePath?.includes('verifiedCareersEmptyState.js')
      ? 'verified-empty-state'
      : 'live-copy',
  originalAdapter: provider.originalAdapter ?? provider.adapter ?? null,
  originalAtsPlatform: provider.originalAtsPlatform ?? provider.atsPlatform ?? null,
  originalModulePath: provider.originalModulePath ?? provider.modulePath ?? null,
  originalDryRunFile: provider.originalDryRunFile ?? (
    provider.dryRunFile
      ? path.join(scraperDir, provider.dryRunFile)
      : null
  ),
})

export const generateDedicatedScraperFolderBackfill = ({
  coveragePath = coverageArtifactPath,
  outputManifestPath,
  outputAliasPath,
  providerExtensionDir: providerExtensionDirectory = providerExtensionDir,
  aliasExtensionDir: aliasExtensionDirectory = aliasExtensionDir,
  scraperBaseDir = scraperDir,
} = {}) => {
  const resolvedOutputManifestPath = outputManifestPath
    || path.join(providerExtensionDirectory, path.basename(manifestPath))
  const resolvedOutputAliasPath = outputAliasPath
    || path.join(aliasExtensionDirectory, path.basename(aliasOutputPath))
  const legacyManifestCandidatePath = path.join(
    providerExtensionDirectory,
    path.basename(legacyManifestPath),
  )
  const coverageRows = existsSync(coveragePath)
    ? parseCsvRows(readFileSync(coveragePath, 'utf8'))
    : []
  const seedManifest = loadSeedManifest([resolvedOutputManifestPath, legacyManifestCandidatePath])
  const workbookProviders = loadWorkbookBatchProviders({ providerExtensionDir: providerExtensionDirectory })
  const workbookAliases = loadWorkbookBatchAliases({ aliasExtensionDir: aliasExtensionDirectory })
  const { canonicalProviders, dedicatedOnlyProviders, conflicts } = buildCanonicalWorkbookInventory({
    workbookProviders,
    dedicatedProviders: Array.isArray(seedManifest) ? seedManifest : [],
  })

  if (conflicts.length > 0) {
    throw new Error(`Workbook migration conflicts: ${conflicts.join(', ')}`)
  }

  const workbookManifestProviders = canonicalProviders
    .filter((provider) => !dedicatedOnlyProviders.some((dedicatedProvider) => dedicatedProvider.source === provider.source))
    .map((provider) => normalizeWorkbookManifestProvider(provider))
  const dedicatedManifestProviders = dedicatedOnlyProviders.map((provider) => ({
    ...provider,
    modulePath: provider.adapter === 'script'
      ? getDefaultScriptModulePath(provider)
      : provider.modulePath,
    dryRunFile: getDefaultDryRunRelativePath(provider),
  }))
  const manifest = [...dedicatedManifestProviders, ...workbookManifestProviders]
    .sort((left, right) => left.source.localeCompare(right.source))

  mkdirSync(path.dirname(resolvedOutputManifestPath), { recursive: true })
  mkdirSync(path.dirname(resolvedOutputAliasPath), { recursive: true })
  writeFileSync(resolvedOutputManifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
  writeFileSync(resolvedOutputAliasPath, `${JSON.stringify(workbookAliases, null, 2)}\n`, 'utf8')

  let livePromotedCount = 0
  let sentinelGeneratedCount = 0

  for (const provider of workbookManifestProviders) {
    const result = materializeWorkbookProvider(provider, {
      scraperDir: scraperBaseDir,
      repoDir,
    })

    if (result.materializationMode === 'live-copy') livePromotedCount += 1
    else sentinelGeneratedCount += 1
  }

  for (const provider of dedicatedManifestProviders) {
    if (provider.adapter !== 'script') continue
    ensureDedicatedProviderDryRunFile(provider, { scraperBaseDir })
  }

  const updatedCatalog = getScraperCatalog()
  if (coverageRows.length > 0) {
    writeCoverageArtifact({ coverageRows, catalog: updatedCatalog, coveragePath })
  }

  return {
    coveragePath,
    manifestPath: resolvedOutputManifestPath,
    aliasPath: resolvedOutputAliasPath,
    generatedSourceCount: manifest.length,
    generatedDirectoryCount: workbookManifestProviders.length,
    livePromotedCount,
    sentinelGeneratedCount,
    aliasCount: Object.keys(workbookAliases).length,
    conflictCount: conflicts.length,
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(generateDedicatedScraperFolderBackfill(), null, 2))
}
