import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { materializeWorkbookProvider } from './lib/workbookDedicatedFolderMaterializer.js'
import {
  getDefaultDryRunRelativePath,
  getDefaultScriptModulePath,
} from '../scraper-support/providers/sourcePaths.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const scraperDir = path.join(backendDir, 'scraper')

const escapeForRegex = (value) =>
  String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const buildProviderEntries = (manifest) =>
  manifest.companies.map(({ companyName, source, backfillMode }) => {
    const provider = {
      source,
      companyName,
      adapter: 'script',
      atsPlatform: 'workbook-exact-name-sentinel',
      countryFilter: 'India',
      paginationStrategy: 'none',
      extractionStrategy: 'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified',
      parser: 'custom-script',
      normalizationProfile: 'engineering-default',
      verifiedOn: manifest.verifiedOn,
      verifiedPublicJobCount: 0,
      verifiedIndiaJobCount: 0,
      verificationDisposition: 'no-trustworthy-exact-name-public-jobs-flow-verified-locally',
      verifiedSurfaceSummary: `Workbook batch ${manifest.batchLabel} exact-name sentinel for ${companyName} added on ${manifest.verifiedDateLabel}. It intentionally returns zero jobs until a trustworthy public careers surface is verified for this exact company name.`,
      originalModulePath: `../${manifest.folderName}/failClosedSentinel.js`,
    }

    const resolvedBackfillMode = backfillMode || manifest.backfillMode
    if (resolvedBackfillMode) {
      provider.backfillMode = resolvedBackfillMode
    }

    provider.modulePath = getDefaultScriptModulePath(provider)
    provider.dryRunFile = getDefaultDryRunRelativePath(provider)

    return provider
  })

const renderBatchTest = (manifest) => {
  const providerImportPath = `../providers/providerExtensions/${path.basename(manifest.providerExtensionFile)}`

  return `import assert from 'node:assert/strict'
import test from 'node:test'

import batchProviders from '${providerImportPath}' with { type: 'json' }
import { generateCompanyCoverageReport } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { getScraperSourceDirectoryName } from '../providers/sourcePaths.js'

const EXPECTED_COMPANY_COUNT = ${manifest.companies.length}
const EXPECTED_BATCH_ID = ${JSON.stringify(manifest.batchId)}
const EXPECTED_BATCH_LABEL = ${JSON.stringify(manifest.batchLabel)}
const EXPECTED_EXTRACTION_STRATEGY =
  'exact-name-batch-coverage-sentinel-return-empty-until-public-surface-is-verified'
const EXPECTED_CSV = ['company_name', ...batchProviders.map((provider) => provider.companyName)].join('\\n').concat('\\n')

test('workbook batch ${manifest.batchId} providers resolve through the shared catalog', () => {
  const report = generateCompanyCoverageReport({
    csvText: EXPECTED_CSV,
    catalog: getScraperCatalog(),
  })

  assert.equal(EXPECTED_BATCH_ID, ${JSON.stringify(manifest.batchId)})
  assert.equal(EXPECTED_BATCH_LABEL, ${JSON.stringify(manifest.batchLabel)})
  assert.equal(batchProviders.length, EXPECTED_COMPANY_COUNT)
  assert.equal(report.matchedCount, EXPECTED_COMPANY_COUNT)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
  assert.deepEqual(
    report.matched.map((entry) => entry.companyName),
    batchProviders.map((provider) => provider.companyName),
  )
})

test('workbook batch ${manifest.batchId} providers stay exact-name and fail closed', async () => {
  const catalog = getScraperCatalog()
  const scrapersByName = new Map(buildScrapers().map((scraper) => [scraper.name, scraper]))

  for (const provider of batchProviders) {
    const catalogProvider = catalog.find((entry) => entry.source === provider.source)
    const scraper = scrapersByName.get(provider.source)
    const expectedDirectoryName = getScraperSourceDirectoryName(provider)
    const expectedModulePath = \`../\${expectedDirectoryName}/script.js\`
    const expectedDryRunFile = \`\${expectedDirectoryName}/jobs.json\`
    const expectedRuntimeSuffix = \`scraper\\\\\${expectedDirectoryName}\\\\script.js\`
    const expectedOriginalModulePath = \`../${manifest.folderName}/failClosedSentinel.js\`

    assert.ok(catalogProvider)
    assert.ok(scraper)
    assert.equal(provider.modulePath, expectedModulePath)
    assert.equal(provider.dryRunFile, expectedDryRunFile)
    assert.equal(provider.atsPlatform, 'workbook-exact-name-sentinel')
    assert.equal(provider.countryFilter, 'India')
    assert.equal(provider.paginationStrategy, 'none')
    assert.equal(provider.extractionStrategy, EXPECTED_EXTRACTION_STRATEGY)
    assert.equal(provider.parser, 'custom-script')
    assert.equal(provider.normalizationProfile, 'engineering-default')
    assert.equal(provider.verifiedOn, ${JSON.stringify(manifest.verifiedOn)})
    assert.equal(provider.verifiedPublicJobCount, 0)
    assert.equal(provider.verifiedIndiaJobCount, 0)
    assert.equal(provider.originalModulePath, expectedOriginalModulePath)
    assert.equal(provider.backfillMode ?? null, ${JSON.stringify(manifest.backfillMode ?? null)})
    assert.equal(
      provider.verificationDisposition,
      'no-trustworthy-exact-name-public-jobs-flow-verified-locally',
    )
    assert.equal(
      provider.verifiedSurfaceSummary.includes(${JSON.stringify(`Workbook batch ${manifest.batchLabel} exact-name sentinel`)}),
      true,
    )
    assert.equal(
      provider.verifiedSurfaceSummary.includes(${JSON.stringify(manifest.verifiedDateLabel)}),
      true,
    )
    assert.equal(provider.verifiedSurfaceSummary.includes(provider.companyName), true)
    assert.equal(String(catalogProvider.modulePath).endsWith(expectedRuntimeSuffix), true)
    assert.deepEqual(await scraper.run(), [])
  }
})
`
}

const parseArgs = (argv = process.argv.slice(2)) => {
  const manifestFlagIndex = argv.findIndex((arg) => arg === '--manifest')
  if (manifestFlagIndex === -1 || !argv[manifestFlagIndex + 1]) {
    throw new Error('Usage: node scripts/generateWorkbookSentinelBatch.js --manifest <path>')
  }

  return {
    manifestPath: path.resolve(process.cwd(), argv[manifestFlagIndex + 1]),
  }
}

export const generateWorkbookSentinelBatch = ({ manifestPath }) => {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const batchFolderPath = path.join(scraperDir, manifest.folderName)
  const providerExtensionPath = path.join(backendDir, manifest.providerExtensionFile)
  const testFilePath = path.join(backendDir, manifest.testFile)
  const providerEntries = buildProviderEntries(manifest)

  mkdirSync(batchFolderPath, { recursive: true })
  mkdirSync(path.dirname(providerExtensionPath), { recursive: true })
  mkdirSync(path.dirname(testFilePath), { recursive: true })

  for (const provider of providerEntries) {
    materializeWorkbookProvider(provider, { scraperDir })
  }

  rmSync(batchFolderPath, { recursive: true, force: true })

  writeFileSync(providerExtensionPath, `${JSON.stringify(providerEntries, null, 2)}\n`, 'utf8')
  writeFileSync(testFilePath, renderBatchTest(manifest), 'utf8')

  return {
    manifestPath,
    providerExtensionPath,
    testFilePath,
    removedBatchFolderPath: batchFolderPath,
    providerCount: providerEntries.length,
    sources: providerEntries.map((provider) => provider.source),
  }
}

const isDirectExecution = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)

if (isDirectExecution) {
  try {
    const { manifestPath } = parseArgs()
    const result = generateWorkbookSentinelBatch({ manifestPath })
    console.log(JSON.stringify(result, null, 2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
