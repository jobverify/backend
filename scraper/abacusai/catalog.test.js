import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import metadata from './catalog.js'
import { getScraperCatalog, loadProviderExtensions, createCatalogScraper, DEFAULT_PROVIDER_EXTENSION_DIR } from '../../scraper-support/providers/index.js'
import { classifyProviderImplementation } from '../../scripts/reportScriptCatalogTopology.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { analyzePublishableJobs } from '../../scraper-support/utils/publishableJobMetrics.js'
import { resolveZeroJobOutcome, buildCoverageGapResult } from '../../scraper-support/runner.js'
import { replay } from './test-data/fixture.mjs'
const override = JSON.parse(fs.readFileSync(new URL('../../scraper-support/providers/providerExtensions/zzzzzz-abacusai-native-observations-20261101.json', import.meta.url)))
const overrideName = 'zzzzzz-abacusai-native-observations-20261101.json'
// Match the production loader's filename ordering, including files after this one.
// The baseline omits this new file so the same test remains useful after installation.
const extensionScenario = (includeOverride, extraFiles = new Map()) => {
  const files = new Map(fs.readdirSync(DEFAULT_PROVIDER_EXTENSION_DIR)
    .filter(name => name.toLowerCase().endsWith('.json') && name !== overrideName)
    .map(name => [name, JSON.parse(fs.readFileSync(path.join(DEFAULT_PROVIDER_EXTENSION_DIR, name), 'utf8'))]))
  if (includeOverride) files.set(overrideName, override)
  for (const [name, rows] of extraFiles) files.set(name, rows)
  const names = [...files.keys()].sort((left, right) => left.localeCompare(right))
  const rows = names.flatMap(name => {
    const parsed = files.get(name)
    return Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed] : []
  })
  return { names, rows }
}
const extended = () => getScraperCatalog({ providerExtensions: extensionScenario(true).rows })

test('Abacus catalog separates historical sentinel counters from the new raw-observation route', () => {
  assert.equal(metadata.source, 'abacusai')
  assert.equal(metadata.companyName, 'Abacus.AI')
  assert.equal(metadata.companyCareerPage, 'https://abacus.ai/jobs')
  assert.equal(metadata.zeroResultPolicy, 'coverage-gap')
  for (const key of ['verifiedOn', 'verifiedPublicJobCount', 'verifiedIndiaJobCount']) assert.equal(metadata[key], null)
  assert.deepEqual(metadata.historicalSentinel, { verifiedOn: '2026-07-29', verifiedPublicJobCount: 0,
    verifiedIndiaJobCount: 0, note: 'Historical workbook placeholder counters; no current vacancy or company-empty authority.' })
  assert.match(metadata.verifiedSurfaceSummary, /current availability and whole-company scope remain unknown/)
})

test('the source override changes only Abacus metadata in the original4567-source registry', () => {
  const before = getScraperCatalog({ providerExtensions: extensionScenario(false).rows }), after = extended()
  assert.equal(before.length, 4567)
  assert.equal(after.length, 4567)
  assert.deepEqual(after.map(provider => provider.source), before.map(provider => provider.source))
  assert.deepEqual(after.filter(provider => provider.source !== 'abacusai'), before.filter(provider => provider.source !== 'abacusai'))
  const provider = after.find(provider => provider.source === 'abacusai')
  assert.equal(provider.zeroResultPolicy, 'coverage-gap')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedOn, null)
  const intendedModulePath = fileURLToPath(new URL('./script.js', import.meta.url))
  assert.equal(classifyProviderImplementation({ ...provider, modulePath: intendedModulePath }).type, 'script')
})

test('the staged registered path keeps3 raw observations and0 qualified public rows without empty authority', async () => {
  const provider = extended().find(provider => provider.source === 'abacusai')
  const scraper = createCatalogScraper(provider), options = replay()
  const jobs = await scraper.run(options)
  assert.equal(jobs.length, 3)
  assert.equal(readSourceObservationEvidence(jobs, 'abacusai').observedRecordCount, 3)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length, 0)
  const outcome = resolveZeroJobOutcome(scraper, jobs, [])
  assert.equal(outcome, 'coverage-gap')
  assert.equal(buildCoverageGapResult(scraper.name, outcome).success, false)
  for (const job of jobs) {
    assert.equal(job.country, null)
    assert.equal(job.sourceScopeComplete, false)
    assert.equal(job.sourceDescription, null)
  }
})

test('Abacus extension uses actual filename precedence rather than append-after-all', () => {
  const without = extensionScenario(false), actualFiles = fs.readdirSync(DEFAULT_PROVIDER_EXTENSION_DIR).filter(name => name.toLowerCase().endsWith('.json'))
  assert.deepEqual(without.rows, actualFiles.includes(overrideName)
    ? actualFiles.filter(name => name !== overrideName).sort((left, right) => left.localeCompare(right)).flatMap(name => {
      const value = JSON.parse(fs.readFileSync(path.join(DEFAULT_PROVIDER_EXTENSION_DIR, name), 'utf8'))
      return Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : []
    }) : loadProviderExtensions())
  const withNative = extensionScenario(true), position = withNative.names.indexOf(overrideName)
  assert.ok(position >= 0 && position < withNative.names.length - 1, 'Existing later filenames must remain after the native override')
  const earlier = 'zzzzz-abacusai-controlled-earlier.json', later = 'zzzzzzz-abacusai-controlled-later.json'
  const controlled = platform => [{ source: 'abacusai', companyName: 'Abacus.AI', catalogOverride: true, atsPlatform: platform }]
  const early = extensionScenario(true, new Map([[earlier, controlled('controlled-earlier')]]))
  assert.ok(early.names.indexOf(earlier) < early.names.indexOf(overrideName))
  assert.equal(getScraperCatalog({ providerExtensions: early.rows }).find(provider => provider.source === 'abacusai').atsPlatform, metadata.atsPlatform)
  const late = extensionScenario(true, new Map([[later, controlled('controlled-later')]]))
  assert.ok(late.names.indexOf(later) > late.names.indexOf(overrideName))
  assert.equal(getScraperCatalog({ providerExtensions: late.rows }).find(provider => provider.source === 'abacusai').atsPlatform, 'controlled-later')
  const wronglyAppended = [...late.rows.filter(row => !override.includes(row)), ...override]
  assert.equal(getScraperCatalog({ providerExtensions: wronglyAppended }).find(provider => provider.source === 'abacusai').atsPlatform, metadata.atsPlatform)
})
