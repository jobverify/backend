import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadConfig } from '../utils/loadConfig.js'

const testsDir = path.dirname(fileURLToPath(import.meta.url))

const sourcesRejectingGenericCountryFacet = [
  'browserstack', 'calix',
  'epiqsystems', 'fox', 'hpinc', 'intel',
  'magnaautomotive', 'ncrvoyix', 'nissandigitalindia', 'nvidia',
  'q2ebanking', 'redhat', 'spgi',
  'thoughtspot', 'workday',
]

test('known Workday tenants that reject the generic country facet start with India search text', () => {
  for (const source of sourcesRejectingGenericCountryFacet) {
    const config = loadConfig(path.join(testsDir, `../../scraper/${source}.workday`))

    assert.equal(config.locationCountry, null, `${source} must omit the generic country facet`)
    assert.equal(config.searchText, 'India', `${source} must search India from the first request`)
  }
})
