import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { buildScrapers, getScraperCatalog } from '../scraper-support/providers/index.js'
import {
  getScraperSourceDirectoryName,
  isWorkdayBackedProvider,
} from '../scraper-support/providers/sourcePaths.js'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const backendDir = path.resolve(currentDir, '..')
const repoDir = path.resolve(backendDir, '..')
const scraperDir = path.join(backendDir, 'scraper')
const COVERAGE_ARTIFACT_BASENAME = 'company-scraper-check-india-hiring-400.csv'
const manifestPath = path.join(
  backendDir,
  'scraper-support',
  'providers',
  'providerExtensions',
  'zz-002-dedicated-backfill.json',
)
const coverageArtifactPath = existsSync(path.join(repoDir, COVERAGE_ARTIFACT_BASENAME))
  ? path.join(repoDir, COVERAGE_ARTIFACT_BASENAME)
  : path.join(repoDir, 'artifacts', COVERAGE_ARTIFACT_BASENAME)

const BACKFILL_MANIFEST = JSON.parse(readFileSync(manifestPath, 'utf8'))

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

  const [headerLine, ...dataLines] = lines
  const headers = parseCsvLine(headerLine)

  return dataLines.map((line) => {
    const values = parseCsvLine(line)
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']))
  })
}

test('generated dedicated scraper backfill manifest stays aligned with local source files', () => {
  assert.ok(BACKFILL_MANIFEST.length > 0, 'backfill manifest should contain dedicated providers')
  assert.equal(
    new Set(BACKFILL_MANIFEST.map((provider) => provider.source)).size,
    BACKFILL_MANIFEST.length,
    'each source should have only one dedicated backfill entry',
  )

  for (const provider of BACKFILL_MANIFEST) {
    const sourceDir = path.join(
      scraperDir,
      getScraperSourceDirectoryName(provider),
    )

    assert.equal(existsSync(path.join(sourceDir, 'catalog.js')), true, `${provider.source} should have catalog.js`)
    assert.equal(existsSync(path.join(sourceDir, 'script.js')), true, `${provider.source} should have script.js`)
    assert.match(String(provider.dryRunFile || ''), /(?:^|[\\/])jobs\.json$/i, `${provider.source} should resolve dry runs to jobs.json`)
  }
})

test('getScraperCatalog resolves backfilled and upgraded providers to local script modules', () => {
  const catalog = getScraperCatalog()
  const uniqueSources = new Set(catalog.map((provider) => provider.source))

  assert.equal(uniqueSources.size, catalog.length, 'catalog sources should remain unique after local overrides')

  const lucidya = catalog.find((provider) => provider.source === 'lucidya')
  assert.ok(lucidya)
  assert.equal(lucidya.adapter, 'script')
  assert.equal(lucidya.atsPlatform, 'runtime-first-party-recruitment')
  assert.equal(lucidya.backfillMode, 'live-parser')
  assert.equal(lucidya.verifiedIndiaJobCount, null)
  assert.equal(lucidya.verifiedPublicJobCount, null)
  assert.match(lucidya.modulePath, /lucidya[\\/]script\.js$/i)
  assert.match(lucidya.dryRunFile, /lucidya[\\/]jobs\.json$/i)
  assert.equal(lucidya.originalModulePath, '../workbookbatch08/failClosedSentinel.js')

  const fortanix = catalog.find((provider) => provider.source === 'fortanix')
  assert.ok(fortanix)
  assert.equal(fortanix.adapter, 'script')
  assert.equal(fortanix.atsPlatform, 'workable-native-api')
  assert.equal(fortanix.originalAtsPlatform, 'workbook-exact-name-sentinel')
  assert.equal(fortanix.backfillMode, 'live-parser')
  assert.match(fortanix.modulePath, /fortanix[\\/]script\.js$/i)
  assert.equal(fortanix.originalModulePath, '../workbookbatch08/failClosedSentinel.js')

  const housr = catalog.find((provider) => provider.source === 'housr')
  assert.ok(housr)
  assert.equal(housr.adapter, 'script')
  assert.equal(housr.atsPlatform, 'verified-first-party-careers-page-plus-same-origin-detail-pages')
  assert.match(housr.modulePath, /housr[\\/]script\.js$/i)

  const amberstudent = catalog.find((provider) => provider.source === 'amberstudent')
  assert.ok(amberstudent)
  assert.equal(amberstudent.adapter, 'script')
  assert.equal(amberstudent.atsPlatform, 'keka')
  assert.match(amberstudent.modulePath, /amberstudent[\\/]script\.js$/i)

  const alation = catalog.find((provider) => provider.source === 'alation')
  assert.ok(alation)
  assert.equal(alation.adapter, 'script')
  assert.equal(alation.atsPlatform, 'workday')
  assert.equal(isWorkdayBackedProvider(alation), true)
  assert.match(alation.modulePath, /alation\.workday[\\/]script\.js$/i)
  assert.match(alation.dryRunFile, /alation\.workday[\\/]jobs\.json$/i)

  const browserstack = catalog.find((provider) => provider.source === 'browserstack')
  assert.ok(browserstack)
  assert.equal(browserstack.adapter, 'script')
  assert.equal(browserstack.atsPlatform, 'workday')
  assert.match(browserstack.modulePath, /browserstack\.workday[\\/]script\.js$/i)
})

test('buildScrapers and the refreshed coverage artifact treat the backfilled set as dedicated local scrapers', (t) => {
  const scrapers = buildScrapers()

  assert.equal(scrapers.filter((scraper) => scraper.name === 'lucidya').length, 1)
  assert.equal(scrapers.filter((scraper) => scraper.name === 'alation').length, 1)
  assert.equal(scrapers.filter((scraper) => scraper.name === 'browserstack').length, 1)
  assert.equal(scrapers.filter((scraper) => scraper.name === 'fortanix').length, 1)

  if (!existsSync(coverageArtifactPath)) {
    t.skip(`Coverage artifact not present at ${coverageArtifactPath}`)
    return
  }

  const coverageRows = parseCsvRows(readFileSync(coverageArtifactPath, 'utf8'))

  assert.equal(coverageRows.length, 400)
  assert.ok(
    coverageRows.every((row) => row.has_backend_scraper_folder === 'yes'),
    'every tracked company should now have a dedicated scraper folder',
  )
  assert.ok(
    coverageRows.every((row) => row.coverage_type === 'dedicated_source_dir'),
    'every tracked company should now resolve as a dedicated source dir',
  )
})
