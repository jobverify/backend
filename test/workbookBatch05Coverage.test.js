import assert from 'node:assert/strict'
import test from 'node:test'

import dedicatedProviders from '../scraper-support/providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import { generateCompanyCoverageReport } from '../scraper-support/providers/companyCoverage.js'
import { getScraperCatalog } from '../scraper-support/providers/index.js'

const buildCsvText = (companies) =>
  `company_name\n${companies.map((company) => `"${String(company).replace(/"/g, '""')}"`).join('\n')}\n`

const EXPECTED_SOURCES = new Map([
  ['SmarterAI', 'smarterai'],
  ['Snapmint', 'snapmint'],
  ['SocialPilot', 'socialpilot'],
  ['Somany Ceramics Digital', 'somanyceramics'],
  ['Sphera India', 'spheraindia'],
  ['Sporjo', 'sporjo'],
  ['Stackbox', 'stackbox'],
  ['StarHealth Digital', 'starhealthdigital'],
  ['Sukoon', 'sukoon'],
  ['SumUp India', 'sumupindia'],
  ['SuperGaming', 'supergaming'],
  ['Supr Daily', 'suprdaily'],
  ['Synup', 'synup'],
  ['TeamLease Digital', 'teamlease'],
  ['Techjockey', 'techjockey'],
  ['Technovert', 'technovert'],
  ['TelioEV', 'telioev'],
  ['ThirdEyeData', 'thirdeyedata'],
  ['Trell', 'trell'],
  ['Trigyn', 'trigyn'],
  ['Tricog', 'tricog'],
  ['Truecaller India', 'truecallerindia'],
  ['TruKKer India', 'trukkerindia'],
  ['Twimbit', 'twimbit'],
  ['Unbxd', 'unbxd'],
  ['Uniqus', 'uniqus'],
  ['Uolo', 'uolo'],
  ['UrbanPiper', 'urbanpiper'],
  ['Vakilsearch', 'vakilsearch'],
  ['Very Good Security India', 'verygoodsecurityindia'],
  ['Vervotech', 'vervotech'],
  ['WATI', 'wati'],
  ['Wealthy', 'wealthy'],
])
const manifest = {
  companies: [...EXPECTED_SOURCES.keys()],
}
const BATCH_PROVIDER_SOURCES = new Set(EXPECTED_SOURCES.values())
const providersBySource = new Map(dedicatedProviders.map((provider) => [provider.source, provider]))

test('workbook batch 05 manifest companies all resolve to providers', () => {
  const report = generateCompanyCoverageReport({
    csvText: buildCsvText(manifest.companies),
    catalog: getScraperCatalog(),
  })

  assert.equal(report.matchedCount, manifest.companies.length)
  assert.equal(report.unmatchedCount, 0)
  assert.deepEqual(
    report.matched.map((item) => ({
      companyName: item.companyName,
      source: item.source,
    })),
    manifest.companies.map((companyName) => ({
      companyName,
      source: EXPECTED_SOURCES.get(companyName),
    })),
  )
})

test('workbook batch 05 replaces the generic sentinel only for explicitly verified public contracts', () => {
  const specializedProviders = new Map([
    ['smarterai', 'verified-public-open-positions-detail-pages'],
    ['snapmint', 'verified-public-careers-jsonld'],
    ['socialpilot', 'verified-public-careers-jsonld'],
    ['spheraindia', 'verified-first-party-workday-handoff'],
    ['sporjo', 'verified-exact-name-public-surface-fail-closed-sentinel'],
    ['stackbox', 'verified-exact-name-public-company-surface'],
    ['starhealthdigital', 'verified-non-enumerable-careers-cta'],
    ['sukoon', 'verified-exact-name-company-surface-no-public-listings'],
    ['sumupindia', 'verified-public-positions-page'],
    ['supergaming', 'gohire-native-public-incomplete'],
    ['suprdaily', 'verified-exact-name-public-company-surface'],
    ['synup', 'first-party-careers-page-linkedin-handoff'],
    ['techjockey', 'verified-first-party-careers-empty-result'],
    ['technovert', 'verified-tezo-rebrand-keka-handoff-fail-closed'],
    ['telioev', 'verified-exact-name-public-surface-fail-closed'],
    ['thirdeyedata', 'verified-public-jobpost-detail-pages'],
    ['trell', 'verified-exact-name-public-surface-fail-closed-sentinel'],
    ['tricog', 'verified-first-party-resume-intake-surface'],
    ['trigyn', 'first-party-drupal-native-career-api'],
    ['truecallerindia', 'verified-public-careers-jsonld'],
    ['trukkerindia', 'verified-public-careers-jsonld'],
    ['twimbit', 'verified-public-careers-detail-pages'],
    ['unbxd', 'verified-exact-name-brand-surfaces-fail-closed'],
    ['uniqus', 'verified-first-party-email-handoff-surface'],
    ['uolo', 'verified-exact-name-public-company-surface-with-linkedin-handoff'],
    ['urbanpiper', 'keka-embed-api'],
    ['vakilsearch', 'verified-public-careers-jsonld'],
    ['verygoodsecurityindia', 'lever'],
    ['vervotech', 'verified-exact-name-public-company-surface'],
    ['wati', 'workable-native-api'],
    ['wealthy', 'zoho-recruit-public-board'],
  ])

  const batchProviders = dedicatedProviders.filter((provider) => BATCH_PROVIDER_SOURCES.has(provider.source))

  assert.equal(batchProviders.length, specializedProviders.size)
  for (const [source, atsPlatform] of specializedProviders) {
    const provider = providersBySource.get(source)
    assert.ok(provider, `Expected ${source} in the dedicated manifest`)
    assert.match(provider.modulePath, new RegExp(`${source}[\\\\/]script\\.js$`, 'i'))
    assert.equal(provider.atsPlatform, atsPlatform)
  }
})
