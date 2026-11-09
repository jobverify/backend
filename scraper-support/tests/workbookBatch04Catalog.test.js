import assert from 'node:assert/strict'
import test from 'node:test'

import workbookAliases from '../providers/companyAliasExtensions/zz-workbook-dedicated.json' with { type: 'json' }
import { generateCompanyCoverageReport, getCompanyAliasMap } from '../providers/companyCoverage.js'
import { getScraperCatalog } from '../providers/index.js'

const VERIFIED_CAREERS_EMPTY_SOURCES = [
  'openprise',
  'redcliffelabs',
  'securonixindia',
  'skitai',
  'slanglabs',
]
const BATCH_04_PROVIDER_SOURCES = [
  'nectarbits',
  'netmeds',
  'neuralgarage',
  'neuropixel',
  'nomuraindia',
  'openprise',
  'orbo',
  'optymyzeindia',
  'outgrow',
  'panasonicindiadigital',
  'paramai',
  'pebble',
  'photomathindia',
  'piramaleswasthya',
  'piramalpharmadigital',
  'qburstindia',
  'quicko',
  'quiklyz',
  'quicksell',
  'rategain',
  'redcliffelabs',
  'revv',
  'sahamati',
  'sastasundar',
  'securonixindia',
  'selfscribe',
  'simpliwork',
  'skitai',
  'slanglabs',
  'smartshift',
]
const PROVIDERS_BY_SOURCE = new Map(getScraperCatalog().map((provider) => [provider.source, provider]))
const manifest = {
  batch: '04',
  companies: [
    ...BATCH_04_PROVIDER_SOURCES.map((source) => PROVIDERS_BY_SOURCE.get(source)?.companyName ?? source),
    'Plum',
    'Saarthi AI',
    'Sattva',
  ],
}

test('workbook batch 04 companies all resolve to providers after dedicated aliases load', () => {
  const report = generateCompanyCoverageReport({
    csvText: `${manifest.companies.join('\n')}\n`,
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
  })

  assert.equal(manifest.batch, '04')
  assert.equal(manifest.companies.length, 33)
  assert.equal(report.matchedCount, manifest.companies.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(report.unmatched, [])
})

test('workbook batch 04 alias extensions route the known renamed companies to existing providers', () => {
  assert.deepEqual({
    Plum: workbookAliases.Plum,
    'Saarthi AI': workbookAliases['Saarthi AI'],
    Sattva: workbookAliases.Sattva,
  }, {
    Plum: 'plumhq',
    'Saarthi AI': 'saarthi',
    Sattva: 'sattvamedia',
  })
})

test('workbook batch 04 retains the other historical exact-company empty snapshots', () => {
  const providers = getScraperCatalog().filter((provider) =>
    VERIFIED_CAREERS_EMPTY_SOURCES.includes(provider.source),
  )

  assert.equal(providers.length, VERIFIED_CAREERS_EMPTY_SOURCES.length)
  assert.deepEqual(
    providers.map((provider) => provider.source).sort(),
    [...VERIFIED_CAREERS_EMPTY_SOURCES].sort(),
  )

  for (const provider of providers) {
    assert.equal(provider.verifiedOn, '2026-07-25')
    assert.equal(provider.verifiedPublicJobCount, 0)
    assert.equal(provider.verifiedIndiaJobCount, 0)
    assert.equal(provider.atsPlatform, 'verified-first-party-careers-empty-result')
    assert.match(provider.modulePath, new RegExp(`${provider.source}[\\\\/]script\\.js$`, 'i'))
  }
})

test('Nomura current native reader replaces only its historical verified-zero claim', () => {
  const provider = PROVIDERS_BY_SOURCE.get('nomuraindia')
  assert.equal(provider.atsPlatform, 'successfactors-rmk-public-native')
  assert.equal(provider.verifiedOn, null)
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.sourceScopeComplete, false)
  assert.equal(provider.lifecycleCleanupAllowed, false)
})
