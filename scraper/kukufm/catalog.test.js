import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import catalog from './catalog.js'
import {getScraperCatalog, hydrateProviderCatalogEntry} from '../../scraper-support/providers/index.js'

for (const [name, provider] of [['local', hydrateProviderCatalogEntry(catalog)],
  ['registered', getScraperCatalog().find(row => row.source === 'kukufm')]]) test(name + ' provider uses the explicit native entry and retains every company/action completeness hold', async () => {
  assert.equal(provider.modulePath, path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'nativeData20261115.js'))
  assert.equal(provider.source, 'kukufm')
  assert.equal(provider.companyName, 'Kuku FM')
  assert.equal(provider.adapter, 'script')
  assert.equal(provider.atsPlatform, 'pyjamahr')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.parser, 'runtime-native-data-20261115')
  assert.equal(provider.backfillMode, null)
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceEvidenceScope, 'native-role-criteria-as-data-only')
  for (const key of ['sourceCorporateBindingQualified', 'sourceFormalLegalEntityQualified', 'sourceActivationComplete',
    'sourceRenderedCriteriaComplete', 'sourceApplicationQualificationComplete', 'sourceScopeComplete', 'lifecycleCleanupAllowed']) assert.equal(provider[key], false)
  const module = await import(pathToFileURL(provider.modulePath))
  assert.equal(typeof module.run, 'function')
  assert.equal(typeof module.createKukuFMScraper, 'function')
})
test('historical corporate context remains distinct from the native account website', () => {
  const provider = getScraperCatalog().find(row => row.source === 'kukufm')
  assert.equal(provider.companyDomain, 'kukuapp.in')
  assert.equal(provider.companyCareerPage, 'https://kukuapp.in/careers/open-roles/')
  assert.equal(provider.officialHomepageUrl, 'https://kukuapp.in/')
  assert.equal(provider.sourceCorporateBindingQualified, false)
})
