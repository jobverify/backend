import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import {fileURLToPath, pathToFileURL} from 'node:url'
import catalog from './catalog.js'
import {getScraperCatalog, hydrateProviderCatalogEntry} from '../../scraper-support/providers/index.js'

for (const [name, provider] of [['local', hydrateProviderCatalogEntry(catalog)], ['registered', getScraperCatalog().find(row => row.source === 'kodo')]]) test(name + ' Kodo metadata binds source-local native entry and retains all company scope holds', async () => {
  assert.equal(provider.modulePath, path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'native.js'))
  assert.equal(provider.source, 'kodo')
  assert.equal(provider.companyName, 'Kodo')
  assert.equal(provider.companyDomain, 'kodo.com')
  assert.equal(provider.companyCareerPage, 'https://www.kodo.com/careers')
  assert.equal(provider.officialHomepageUrl, 'https://www.kodo.com/')
  assert.equal(provider.countryFilter, 'India')
  assert.equal(provider.atsPlatform, 'pyjamahr')
  assert.equal(provider.parser, 'runtime-verified-recruitment')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
  assert.equal(provider.sourceEvidenceScope, 'native-role-criteria-as-data-only')
  for (const key of ['sourceFormalLegalEntityQualified', 'sourceActivationComplete', 'sourceRenderedCriteriaComplete', 'sourceApplicationQualificationComplete']) assert.equal(provider[key], false)
  assert.equal(typeof (await import(pathToFileURL(provider.modulePath))).run, 'function')
})
