import test from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { getScraperCatalog, loadProviderExtensions } from '../scraper-support/providers/index.js'

const recoveredSources = [
  ['2070health', '2070health', 'Global', 'first-party-native-listing-and-canonical-detail-pages'],
  ['aible', 'aible', 'Global', 'first-party-native-inline-authored-roles'],
  ['astrasecurity', 'astrasecurity', 'Global', 'first-party-zoho-native-board-and-literal-details'],
  ['asus', 'asus.workday', 'India', 'first-party-nuxt-regional-directory-and-jobvite-native-html'],
  ['attackiq', 'attackiq', 'India', 'first-party-and-jazz-literal-widget-native-html'],
  ['axa', 'axa.workday', 'India', 'first-party-and-jibe-public-native-json'],
  ['base64ai', 'base64ai', 'India', 'first-party-native-html-disclosures'],
  ['doximity', 'doximity', 'India', 'greenhouse'],
  ['sigmasolve', 'sigmasolve', 'Global', 'official-company-careers'],
]
const catalog = getScraperCatalog()
const filename = 'zz-298-catalog.json'

for (const [source, directory, country, platform] of recoveredSources) {
  test(`${source} registration selects its current native extractor and retains unqualified scope`, () => {
    const entries = catalog.filter(provider => provider.source === source)
    assert.equal(entries.length, 1)
    const provider = entries[0]
    assert.equal(provider.adapter, 'script')
    assert.equal(provider.parser, 'live-parser')
    assert.equal(provider.atsPlatform, platform)
    assert.equal(provider.countryFilter, country)
    assert.equal(provider.backfillMode, null)
    assert.equal(provider.verifiedPublicJobCount, null)
    assert.equal(provider.verifiedIndiaJobCount, null)
    assert.equal(provider.verifiedOn, null)
    assert.equal(provider.verifiedAt, null)
    assert.equal(provider.sourceScopeComplete, false)
    assert.equal(provider.lifecycleCleanupAllowed, false)
    assert.equal(provider.modulePath, fileURLToPath(new URL(`../scraper/${directory}/script.js`, import.meta.url)))
  })
}

test('restored extension paths remain relative and within a portable Windows path length', () => {
  const url = new URL(`../scraper-support/providers/providerExtensions/${filename}`, import.meta.url)
  const overrides = JSON.parse(readFileSync(url, 'utf8'))
  assert.equal(overrides.length, recoveredSources.length)
  assert.deepEqual(overrides.map(row => row.source).sort(), recoveredSources.map(row => row[0]).sort())
  assert.ok(filename.length <= 160)
  assert.ok(fileURLToPath(url).length < 240)
  for (const row of overrides) {
    const directory = recoveredSources.find(([source]) => source === row.source)?.[1]
    assert.equal(row.modulePath, `../${directory}/script.js`)
    assert.equal(row.dryRunFile, `${directory}/jobs.json`)
    assert.equal(path.isAbsolute(row.modulePath), false)
    assert.equal(path.isAbsolute(row.dryRunFile), false)
    assert.equal(row.catalogOverride, true)
  }
  const loaded = loadProviderExtensions().filter(row => overrides.some(current => current.source === row.source))
  for (const row of overrides) assert.deepEqual(loaded.filter(current => current.source === row.source).at(-1), row)
})
