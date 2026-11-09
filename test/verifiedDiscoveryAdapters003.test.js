import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createPublishingGapAtsScraper } from '../scraper-support/utils/publishingGapAts.js'
import test from 'node:test'
import { getScraperCatalog, createCatalogScraper } from '../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../scraper-support/utils/inventoryEvidence.js'
import { extractOfficialRecruitmentLinks } from '../scripts/officialRecruitmentLinks.js'

const expected = {
  ataccama: ['publicAts', 'lever', 'ataccama'],
  aurecon: ['workday', 'workday', 'https://aurecongroup.wd3.myworkdayjobs.com/en-US/aurecon'],
  automox: ['publicAts', 'greenhouse', 'automox'],
  avisbudgetgroup: ['workday', 'workday', 'https://avisbudget.wd1.myworkdayjobs.com/en-US/ABG_Careers'],
}
const providerFor = source => getScraperCatalog().find(row => row.source === source)

test('batch 003 retains four exact historical board bindings under current routes without duplication', () => {
  const catalog = getScraperCatalog()
  const extension = JSON.parse(readFileSync(new URL('../scraper-support/providers/providerExtensions/zzzzzzzz-verified-discovery-adapters-003.json', import.meta.url)))
  for (const [source, [adapter, atsPlatform, identity]] of Object.entries(expected)) {
    const historical = extension.find(row => row.source === source)
    assert.equal(historical.adapter, adapter, source)
    assert.equal(historical.atsPlatform, atsPlatform)
    assert.equal(adapter === 'workday' ? historical.baseUrl : historical.boardToken, identity)
    const row = providerFor(source)
    // Aurecon now owns the native office-country proof and current publisher
    // qualification in a dedicated reader. The original board binding remains.
    assert.equal(row.adapter, source === 'aurecon' ? 'script' : adapter, source)
    if (source === 'aurecon') {
      assert.equal(row.modulePath, fileURLToPath(new URL('../scraper/aurecon.workday/script.js', import.meta.url)))
      assert.equal(row.sourceScopeComplete, false)
      assert.equal(row.lifecycleCleanupAllowed, false)
    }
    assert.equal(row.atsPlatform, atsPlatform)
    assert.equal(adapter === 'workday' ? row.baseUrl : row.boardToken, identity)
    assert.equal(catalog.filter(p => p.source === source).length, 1)
    assert.equal(catalog.filter(p => p.atsPlatform === atsPlatform
      && (adapter === 'workday' ? p.baseUrl === identity : p.boardToken === identity)).length, 1)
  }
  assert.deepEqual(extension.map(row => row.source).sort(), Object.keys(expected).sort())
})

test('batch 003 hashes the original corporate binding proof chains and keeps runtime counts unknown', () => {
  for (const source of Object.keys(expected)) {
    const row = providerFor(source)
    assert.equal(row.remediationStatus, 'implemented-awaiting-live-validation')
    assert.equal(row.verifiedPublicJobCount, null)
    assert.equal(row.verifiedIndiaJobCount, null)
    assert.equal(row.bindingEvidence.verified, true)
    assert.ok(row.bindingEvidence.httpProofs.length)
    for (const proof of row.bindingEvidence.httpProofs) {
      const bytes = readFileSync(new URL(proof.file, new URL('../', import.meta.url)))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), proof.sha256)
      const capture = JSON.parse(bytes)
      assert.equal(capture.status, 200)
      assert.equal(capture.finalURL, capture.requestedURL)
      assert.equal(createHash('sha256').update(capture.body).digest('hex'), capture.bodySha256)
      if (source !== 'aurecon') {
        assert.ok(extractOfficialRecruitmentLinks(capture.body, capture.finalURL).some(url => url.href === capture.expectedTarget))
      } else {
        // Corporate JSON navigation data is distinct from an HTML href. The
        // original discovery separately records clicking this rendered link.
        assert.equal(row.bindingEvidence.evidenceOrigin, 'corporate-navigation-data-and-reviewed-clicked-link')
        let found = false
        const walk = value => {
          if (!value || typeof value !== 'object') return
          if (value.Type === 'PageLink' && value.MenuTitle === 'Search all jobs'
            && value.Url === 'https://aurecongroup.wd3.myworkdayjobs.com/aurecon') found = true
          for (const child of Object.values(value)) walk(child)
        }
        for (const match of capture.body.matchAll(/<script type="application\/json">([\s\S]*?)<\/script>/g)) walk(JSON.parse(match[1]))
        assert.equal(found, true)
      }
    }
  }
})

for (const source of ['ataccama', 'automox']) {
  test(source === 'automox' ? 'automox generic API-model compatibility preserves descriptions and excludes generic or US Remote' : `${source} preserves native descriptions and excludes generic or US Remote`, async () => {
    // Automox payloads below model the active generic API mapper; employer provenance is separate.
    const provider = providerFor(source)
    const scraper = source === 'automox' ? createPublishingGapAtsScraper(provider) : createCatalogScraper(provider)
    const jobs = await scraper.run({ fetchJson: async url => {
      assert.equal(url, source === 'ataccama' ? 'https://api.lever.co/v0/postings/ataccama?mode=json'
        : 'https://boards-api.greenhouse.io/v1/boards/automox/jobs?content=true')
      const rows = ['Remote', 'Remote, United States', 'Pune, India'].map((location, index) => source === 'ataccama'
        ? { id: `role-${index}`, text: 'Software Engineer', categories: { location },
          hostedUrl: `https://jobs.lever.co/ataccama/role-${index}`, applyUrl: `https://jobs.lever.co/ataccama/role-${index}/apply`,
          descriptionPlain: 'Build and maintain production services.' }
        : { id: index + 1, title: 'Software Engineer', location: { name: location },
          absolute_url: `https://job-boards.greenhouse.io/automox/jobs/${index + 1}`,
          content: '<p>Build and maintain production services.</p>' })
      return source === 'ataccama' ? rows : { jobs: rows, meta: { total: rows.length } }
    } })
    assert.equal(jobs.length, 1)
    assert.match(jobs[0].location, /Pune/)
    assert.match(jobs[0].jobDescription, /production services/)
    assert.equal(readInventoryEvidence(jobs).reportedTotal, 3)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
    assert.match(readInventoryEvidence(jobs).reason, /native-location-scope-unresolved/)
  })
}

test('automox current registered runtime requires employer provenance before parsed-only feed access', async () => {
  const provider = providerFor('automox'), reason = Object.freeze(new Error('Current employer packet was not supplied'))
  const pageCalls = []; let feedCalls = 0
  await assert.rejects(createCatalogScraper(provider).run({
    fetchPage: async url => { pageCalls.push(url); throw reason },
    fetchJson: async () => { feedCalls++; assert.fail('An unqualified employer surface cannot authorize native feed access') },
  }), error => error === reason)
  assert.deepEqual(pageCalls, [provider.companyCareerPage])
  assert.equal(feedCalls, 0)
  assert.equal(provider.runtimeInventoryVerification.mode, 'role-links-exact')
  assert.equal(provider.runtimeInventoryVerification.boardUrl, 'https://job-boards.greenhouse.io/automox')
  assert.equal(provider.verifiedPublicJobCount, null)
  assert.equal(provider.verifiedIndiaJobCount, null)
  assert.equal(provider.verifiedAt, null)
})
test('Workday geography config follows the observed native country facets', () => {
  assert.equal(providerFor('aurecon').locationCountry, null)
  const config = JSON.parse(readFileSync(new URL('../scraper/aurecon.workday/config.json', import.meta.url)))
  assert.equal(config.locationCountry, null)
  assert.equal(providerFor('avisbudgetgroup').locationCountry, 'c4f78be1a8f14da0ab49ce1162348a5e')
  assert.equal(providerFor('aurecon').boardIdentityVerified, true)
  assert.equal(providerFor('avisbudgetgroup').boardIdentityVerified, true)
})
