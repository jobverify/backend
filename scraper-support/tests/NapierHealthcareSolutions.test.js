import assert from 'node:assert/strict'
import test from 'node:test'
import { buildScrapers, getScraperCatalog } from '../providers/index.js'
import { resolveZeroJobOutcome, buildCoverageGapResult } from '../runner.js'
import { readInventoryEvidence, isVerifiedEmptyEvidence, isFreshCompleteInventoryEvidence } from '../utils/inventoryEvidence.js'
import { inventoryCleanupOptions } from '../utils/scraperOutcome.js'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers - Napier</title>
  </head>
  <body>
    <main>
      <h1>Be part of healthcare's digital transformation</h1>
      <a href="#openings">VIEW ALL OPENINGS</a>
      <p>
        Scroll down and view our current openings or fill in the electronic form, telling us what you have to offer
        the job you are looking for and attach your resume / CV.
      </p>
      <p>Alternatively, you can follow us on LinkedIn and stay updated on the latest opportunities as they appear.</p>
    </main>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/napierhealthcaresolutions/provider.js')
  } catch {
    assert.fail(
      'Expected Napier Healthcare Solutions provider module at ../../scraper/napierhealthcaresolutions/provider.js',
    )
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/napierhealthcaresolutions/script.js')
  } catch {
    assert.fail(
      'Expected Napier Healthcare Solutions scraper module at ../../scraper/napierhealthcaresolutions/script.js',
    )
  }
}

test('Napier Healthcare Solutions exports the verified fail-closed careers contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'napierhealthcaresolutions',
    companyName: 'Napier Healthcare Solutions',
    officialBrandName: 'Napier',
    adapter: 'script',
    modulePath: '../../scraper/napierhealthcaresolutions/script.js',
    homepageUrl: 'http://www.napierhealthcare.com/v2/',
    companyCareerPage: 'http://www.napierhealthcare.com/v2/careers/',
    atsPlatform: "official-company-careers-unavailable",
    countryFilter: 'India',
    paginationStrategy: "single-first-party-careers-route-unavailable-validation",
    extractionStrategy: "verified-unavailable-first-party-careers-route+typed-upstream-failure",
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'napierhealthcare.com',
    verifiedOn: "2026-09-13",
    verifiedSurfaceSummary:
      "Verified on Sunday, September 13, 2026 that the last trusted Napier first-party route http://www.napierhealthcare.com/v2/careers/ now returns HTTP 404, adjacent http://www.napierhealthcare.com/v2/ and http://www.napierhealthcare.com/careers/ routes also return HTTP 404, the bare/root domain redirects to http://www.thetransformationhub.com.au/, and the https variants still fail with certificate-expired errors. This scraper now reports typed upstream_unavailable instead of returning [] until a trustworthy Napier public jobs surface reappears.",
    dryRunFile: 'napierhealthcaresolutions/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Napier Healthcare Solutions returns [] only while the official page stays a marketing shell', async () => {
  const napier = await loadScriptModule()

  assert.equal(napier.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(napier.extractSameDomainJobLinks(careersHtml), [])

  const jobs = await napier.run({
    fetchText: async (url) => {
      assert.equal(url, napier.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    napier.run({
      fetchText: async () => `
        ${careersHtml}
        <a href="https://www.napierhealthcare.com/v2/jobs/data-engineer/">Data Engineer</a>
      `,
    }),
    /public jobs surface/i,
  )
})

test('Napier unavailable runtime and historical descriptor remain distinct with unknown totals', async () => {
  const napier = await loadScriptModule()
  const effective = getScraperCatalog().find(item => item.source === 'napierhealthcaresolutions')
  const scraper = buildScrapers().find(item => item.name === 'napierhealthcaresolutions')
  assert.equal(napier.CAREERS_URL, 'http://www.napierhealthcare.com/v2/careers/')
  assert.equal(effective.companyCareerPage, 'https://www.napierhealthcare.com/v2/careers/')
  assert.notEqual(napier.CAREERS_URL, effective.companyCareerPage)
  assert.equal(napier.PROVIDER_METADATA.verifiedOn, '2026-09-13')
  assert.equal(effective.verifiedOn, '2026-07-18')
  assert.equal(effective.zeroResultPolicy, 'coverage-gap')
  const calls = [], clock = '2026-09-13T00:00:00.000Z'
  const native404 = Object.assign(new Error('controlled unavailable route'), { status: 404 })
  const wrapped404 = new Error('controlled transport wrapper', { cause: native404 })
  const jobs = await scraper.run({ fetchText: async url => { calls.push(url); throw wrapped404 }, now: () => clock })
  assert.deepEqual(calls, [napier.CAREERS_URL])
  assert.deepEqual(jobs, [])
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'discovery-only')
  assert.equal(evidence.surface, napier.CAREERS_URL)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.pagesFetched, 0)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(evidence.indiaFacetCount, null)
  assert.equal(evidence.verifiedAt, clock) // Controlled observation time, never completeness.
  assert.equal(isVerifiedEmptyEvidence(evidence), false)
  assert.equal(isFreshCompleteInventoryEvidence(evidence, { now: clock }), false)
  assert.equal(resolveZeroJobOutcome(scraper, jobs, jobs), 'blocked-zero')
  assert.equal(buildCoverageGapResult(scraper.name, 'blocked-zero').success, false)
  assert.deepEqual(inventoryCleanupOptions({ success: true, inventoryEvidence: evidence, zeroJobEvidence: 'blocked-zero' }), { replaceExisting: false })
})

test('Napier non-404 failures remain errors rather than successful zero inventories', async () => {
  const napier = await loadScriptModule()
  for (const status of [401, 403, 429, 503]) {
    const error = Object.assign(new Error('controlled denied response'), { status })
    let calls = 0
    await assert.rejects(napier.run({ fetchText: async () => { calls++; throw error } }), value => value === error)
    assert.equal(calls, 1)
  }
})
