import assert from 'node:assert/strict'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

import dedicatedProviders from '../providers/providerExtensions/zz-dedicated-scraper-folder-backfill.json' with { type: 'json' }
import { generateCompanyCoverageReport, getCompanyAliasMap } from '../providers/companyCoverage.js'
import { buildScrapers, getScraperCatalog, hydrateProviderCatalogEntry } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const currentDir = fileURLToPath(new URL('.', import.meta.url))
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
const manifest = {
  companies: [
    ...BATCH_04_PROVIDER_SOURCES.map(
      (source) => dedicatedProviders.find((provider) => provider.source === source)?.companyName ?? source,
    ),
    'Plum',
    'Saarthi AI',
    'Sattva',
  ],
}
const ALIAS_ONLY_SOURCES = new Set(['plumhq', 'saarthi', 'sattvamedia'])
const CURRENT_RUNTIME_PROVIDER_SOURCES = new Set([
  'nectarbits',
  'neuralgarage',
  'optymyzeindia',
  'outgrow',
  'paramai',
  'piramaleswasthya',
  'quicko',
  'quiklyz',
  'quicksell',
  'rategain',
  'revv',
  'sahamati',
  'sastasundar',
  'simpliwork',
])
const LIVE_DRIFT_SENSITIVE_PROVIDER_SOURCES = new Set([
  'nectarbits',
  'netmeds',
  'neuropixel',
  'orbo',
  'panasonicindiadigital',
  'pebble',
  'photomathindia',
  'piramalpharmadigital',
  'qburstindia',
  'selfscribe',
  'skitai',
  'smartshift',
])

const loadBatch04Providers = () => {
  const report = generateCompanyCoverageReport({
    csvText: `${manifest.companies.join('\n')}\n`,
    catalog: getScraperCatalog(),
    aliasMap: getCompanyAliasMap(),
  })

  return report.matched
    .filter(({ source }) => !ALIAS_ONLY_SOURCES.has(source))
    .map(({ source }) => dedicatedProviders.find((provider) => provider.source === source))
}

// Match the positive native fixture used by registerCurrentRecruitmentContract.
// Both public entry points must extract its role while retaining unknown scope.
const currentRecruitmentFixture = (provider, country = 'IN') => {
  const root = new URL(/myworkdayjobs|smartrecruiters|ashbyhq|greenhouse|lever\.co|breezy\.hr|workable\.com/i.test(provider.companyCareerPage)
    ? provider.officialHomepageUrl : provider.companyCareerPage)
  root.search = ''; root.hash = ''; root.pathname = root.pathname.replace(/\/$/, '') + '/jobs/native-test-role'
  const roleURL = root.href
  const description = '<p>Design and operate production software services, investigate distributed system failures, review API contracts and collaborate with the engineering team on reliable delivery.</p>'
  const record = { '@type': 'JobPosting', identifier: { value: provider.source + '-native-1' }, title: 'Software Engineer',
    hiringOrganization: { name: provider.companyName }, url: roleURL, description,
    jobLocation: { address: { ...(country ? { addressCountry: country } : {}), addressLocality: 'Bengaluru' } }, datePosted: '2026-10-30' }
  return { roleURL, description, options: {
    now: () => '2026-11-03T10:00:00Z', maxPages: 4,
    fetchPage: async url => ({ status: 200, url, html: url === roleURL
      ? '<h1>Software Engineer</h1>' + description + '<script type="application/ld+json">' + JSON.stringify(record) + '</script>'
      : '<h1>Careers</h1><a href="' + roleURL + '">Open job</a>' }),
    fetchJson: () => assert.fail('The current first-party fixture did not advertise a native API'),
  } }
}

const assertIncompleteInventory = jobs => {
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'coverage-gap')
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
}

test('workbook batch 04 company-local providers are registered in the dedicated manifest', () => {
  const providers = loadBatch04Providers()

  assert.equal(Array.isArray(providers), true)
  assert.equal(providers.length, BATCH_04_PROVIDER_SOURCES.length)
  assert.ok(providers.every(Boolean))
})

test('historical unregistered Nomura snapshot helper retains its compatibility empty result', async () => {
  const modulePath = path.resolve(currentDir, '../../scraper/nomuraindia/verifiedCareersEmptyState.js')
  const module = await import(pathToFileURL(modulePath).href)

  assert.deepEqual(await module.run(), [])
  assert.deepEqual(await module.createVerifiedCareersEmptyStateScraper().run(), [])
})

test('workbook batch 04 scripts stay fail-closed and never fabricate jobs', async context => {
  context.mock.method(globalThis, 'fetch', () => assert.fail('Workbook fixtures must not make uncontrolled HTTP requests'))
  const scrapers = buildScrapers()

  for (const provider of loadBatch04Providers()) {
    const hydratedProvider = hydrateProviderCatalogEntry(provider)
    const modulePath = path.isAbsolute(hydratedProvider.modulePath)
      ? hydratedProvider.modulePath
      : path.resolve(currentDir, hydratedProvider.modulePath)
    const module = await import(pathToFileURL(modulePath).href)
    const scraper = scrapers.find((item) => item.name === hydratedProvider.source)

    assert.ok(scraper, `Expected scraper registration for ${hydratedProvider.source}`)
    assert.equal(scraper.provider.companyName, hydratedProvider.companyName)
    if (hydratedProvider.source === 'nomuraindia') {
      // The genuine 298-response registered-source fixture exercises this live
      // reader. The old manifest remains historical compatibility input here.
      assert.equal(scraper.provider.verifiedPublicJobCount, null)
      assert.equal(scraper.provider.sourceScopeComplete, false)
      assert.equal(scraper.provider.lifecycleCleanupAllowed, false)
      continue
    }
    if (CURRENT_RUNTIME_PROVIDER_SOURCES.has(hydratedProvider.source)) {
      assert.equal(scraper.provider.verifiedPublicJobCount, null)
      assert.equal(scraper.provider.verifiedIndiaJobCount, null)
      assert.equal(scraper.provider.sourceScopeComplete, false)
      assert.equal(scraper.provider.lifecycleCleanupAllowed, false)
      assert.equal(scraper.provider.parser, 'runtime-verified-recruitment')
      assert.equal(scraper.provider.zeroResultPolicy, 'evidence-required')
      assert.equal(module.DISPOSITION, 'runtime-verified-recruitment')
      for (const execute of [options => module.run(options), options => scraper.run(options)]) {
        const fixture = currentRecruitmentFixture(scraper.provider)
        const jobs = await execute(fixture.options)
        assert.equal(jobs.length, 1, `Expected current native extraction for ${hydratedProvider.source}`)
        assert.equal(jobs[0].company, scraper.provider.companyName)
        assert.equal(jobs[0].source, hydratedProvider.source)
        assert.equal(jobs[0].title, 'Software Engineer')
        assert.equal(jobs[0].country, 'India')
        assert.equal(jobs[0].applyUrl, fixture.roleURL)
        assert.equal(jobs[0].sourceDescription, fixture.description)
        assert.equal(jobs[0].postingDate, '2026-10-30')
        assert.equal(jobs[0].sourceDetailComplete, true)
        assert.equal(jobs[0].sourceScopeComplete, false)
        assert.equal(jobs[0].sourceListingComplete, false)
        assert.equal(jobs[0].lifecycleCleanupAllowed, false)
        assertIncompleteInventory(jobs)
        const unresolved = await execute(currentRecruitmentFixture(scraper.provider, null).options)
        assert.deepEqual(unresolved, [], `Unresolved native country must not become an India job for ${hydratedProvider.source}`)
        assertIncompleteInventory(unresolved)
      }
      continue
    }
    assert.equal(scraper.provider.verifiedPublicJobCount, 0)
    if (LIVE_DRIFT_SENSITIVE_PROVIDER_SOURCES.has(hydratedProvider.source)) continue

    assert.deepEqual(
      await module.run(),
      [],
      `Expected ${hydratedProvider.source} module to return []`,
    )
    assert.deepEqual(
      await scraper.run(),
      [],
      `Expected ${hydratedProvider.source} registered scraper to return []`,
    )
  }
})
