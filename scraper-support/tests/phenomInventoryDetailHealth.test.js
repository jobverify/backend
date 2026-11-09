import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { createPhenomScraper } from '../phenom/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'
import { createAbbScraper } from '../../scraper/abb.workday/script.js'
import { hasSourceDescription } from '../../src/utils/jobSourceContent.js'

const scraper = createPhenomScraper({ companyName: 'Example', source: 'phenom-health',
  baseUrl: 'https://careers.example.com', scraperDir: fileURLToPath(new URL('.', import.meta.url)) })
const row = id => ({ reqId: String(id), jobId: String(id), title: 'Role ' + id, country: 'India',
  cityStateCountry: 'Pune, India', descriptionTeaser: 'A brief native listing teaser.' })
const page = (jobs, total = jobs.length) => '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
  totalHits: total, hits: jobs.length, data: { jobs, aggregations: [{ field: 'country', value: { India: total } }] },
} }) + '</script>'
const detail = (job, description = '<p>Build and maintain reliable native production services.</p>') => '<script>phApp.ddo = '
  + JSON.stringify({ jobDetail: { data: { job: { ...job, ml_country: 'India', ml_Description: description } } } }) + '</script>'
const isListing = url => url.includes('/search-results')

test('complete native Phenom listing carries counts and separately verified full detail health', async () => {
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)]) : detail(row(1)) })
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.match(jobs[0].jobDescription, /reliable native production/)
  assert.equal(jobs[0].sourceListingTeaser, 'A brief native listing teaser.')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.status, 'complete-inventory')
  assert.equal(evidence.reportedTotal, 1)
  assert.equal(evidence.indiaFacetCount, 1)
  assert.equal(evidence.pagesFetched, 1)
  assert.equal(evidence.listingComplete, true)
})

test('explicit zero detail budget retains teaser only outside publishable description and preserves listing evidence', async () => {
  const jobs = await scraper.run({ detailEnrichmentBudgetMs: 0, fetchText: async url => {
    assert.ok(isListing(url)); return page([row(1)])
  } })
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceListingTeaser, row(1).descriptionTeaser)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'budget-exhausted')
  // Retain the listing for later enrichment without promoting its teaser to source content.
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length, 1)
  assert.equal(hasSourceDescription(jobs[0]), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

for (const [kind, response] of [
  ['missing-content', () => detail(row(1), '')],
  ['identity-mismatch', () => detail(row('wrong'))],
  ['identity-mismatch', () => detail({ ...row(1), jobId: 'wrong' })],
  ['upstream', () => { throw new Error('HTTP 503') }],
]) test('Phenom retains incomplete listings for enrichment with failure kind ' + kind + ' ' + response, async () => {
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)]) : response() })
  assert.equal(jobs[0].jobDescription, null)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, kind)
  assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length, 1)
  assert.equal(hasSourceDescription(jobs[0]), false)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('a timed out detail and every unvisited detail retain explicit budget failure with full listing evidence', async () => {
  let aborted = false
  const jobs = await scraper.run({ detailEnrichmentBudgetMs: 10, fetchText: async (url, { signal }) => {
    if (isListing(url)) return page([row(1), row(2)])
    signal.addEventListener('abort', () => { aborted = true }, { once: true })
    return new Promise(() => {})
  } })
  assert.equal(aborted, true)
  assert.ok(jobs.every(job => job.jobDescription == null && job.sourceDetailComplete === false
    && job.sourceDetailFailureKind === 'budget-exhausted'))
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('positive capped listing preserves known native totals while blocking complete inventory authority', async () => {
  const jobs = await scraper.run({ maxJobs: 1, detailEnrichmentBudgetMs: 0, fetchText: async () => page([row(1), row(2)]) })
  const evidence = readInventoryEvidence(jobs)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, 2)
  assert.equal(evidence.indiaFacetCount, 2)
})

test('changing native listing totals never certifies a complete current inventory', async () => {
  const jobs = await scraper.run({ detailEnrichmentBudgetMs: 0, fetchText: async url =>
    new URL(url).searchParams.has('from') ? page([row(2), row(3)], 3) : page([row(1)], 2) })
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.ok(jobs.every(job => job.sourceListingComplete === false))
})

test('ABB timestamp mapping preserves the shared native inventory evidence and explicit zero detail budget', async () => {
  const jobs = await createAbbScraper({ now: () => '2026-10-20T20:00:00.000Z' }).run({
    detailEnrichmentBudgetMs: 0, fetchText: async url => { assert.ok(isListing(url)); return page([row(1)]) },
  })
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'budget-exhausted')
  assert.equal(jobs[0].scrapedAt, '2026-10-20T20:00:00.000Z')
})

test('native no-location-specific rows cannot certify full India scope', async () => {
  const jobs = await scraper.run({ detailEnrichmentBudgetMs: 0, fetchText: async () =>
    page([row(1), { ...row(2), country: 'Not Location Specific', cityStateCountry: 'Remote' }]) })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('an explicit native foreign detail cannot provide an India description', async () => {
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)])
    : detail(row(1)).replaceAll('"India"', '"United States"') })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(jobs[0].jobDescription, null)
})

test('environment detail budget zero remains authoritative for ABB source-local defaults', async () => {
  const previous = process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS
  process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS = '0'
  try {
    const jobs = await createAbbScraper().run({ fetchText: async url => {
      assert.ok(isListing(url)); return page([row(1)])
    } })
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].sourceDetailFailureKind, 'budget-exhausted')
  } finally {
    if (previous === undefined) delete process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS
    else process.env.PHENOM_DETAIL_ENRICHMENT_BUDGET_MS = previous
  }
})

test('actual native ABB detail object locations retain the explicit India secondary behind Czechia primary', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/phenom/abb-object-multi-location-listing.json', import.meta.url), 'utf8'))
  const html = readFileSync(new URL('./fixtures/phenom/abb-object-multi-location-detail.html', import.meta.url), 'utf8')
  const jobs = await createAbbScraper().run({ fetchText: async url => {
    if (isListing(url)) return page([fixture.listing])
    assert.equal(url, fixture.nativeDetailURL)
    return html
  } })
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].country, 'India')
  assert.match(jobs[0].location, /Bangalore.*India/)
  assert.ok(jobs[0].jobDescription.length > 4000)
})

test('a conflicting native detail object country and India location label cannot establish India scope', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/phenom/abb-object-multi-location-listing.json', import.meta.url), 'utf8'))
  const html = readFileSync(new URL('./fixtures/phenom/abb-object-multi-location-detail.html', import.meta.url), 'utf8')
    .replaceAll('"country":"India"', '"country":"United States of America"')
  const jobs = await createAbbScraper().run({ fetchText: async url => isListing(url) ? page([fixture.listing]) : html })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
})

test('a conflicting canonical job ID cannot authenticate a native full description', async () => {
  const html = '<link rel="canonical" href="https://careers.example.com/global/en/job/wrong/Role-1">' + detail(row(1))
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)]) : html })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
})

test('conflicting primary country models without an explicit India secondary do not authenticate India content', async () => {
  const html = detail(row(1)).replaceAll('"India"', '"United States"')
    + '<script type="application/ld+json">' + JSON.stringify({ '@type': 'JobPosting', title: row(1).title,
      jobLocation: { address: { addressCountry: 'India' } }, description: 'Unverified conflicting country description.' }) + '</script>'
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)]) : html })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
})

test('an unknown native country cannot certify a complete zero India inventory', async () => {
  const payload = { eagerLoadRefineSearch: { totalHits: 1, hits: 1, data: { jobs: [
    { ...row(1), country: 'Unknownland', cityStateCountry: 'Unspecified office' },
  ], aggregations: [] } } }
  await assert.rejects(scraper.run({ detailEnrichmentBudgetMs: 0,
    fetchText: async () => '<script>phApp.ddo = ' + JSON.stringify(payload) + '</script>',
  }), { code: 'PHENOM_INCOMPLETE_SNAPSHOT' })
})

test('a malformed native listing country cannot become India by string coercion', async () => {
  await assert.rejects(scraper.run({ detailEnrichmentBudgetMs: 0,
    fetchText: async () => page([{ ...row(1), country: ['India'] }]),
  }), { code: 'PHENOM_INCOMPLETE_SNAPSHOT' })
})

test('native structured detail title must agree with the listing title', async () => {
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)])
    : detail({ ...row(1), title: 'Unrelated Role' }) })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(jobs[0].jobDescription, null)
})

for (const [context, wrap] of [
  ['HTML comment', value => '<!--' + value + '-->'],
  ...['template', 'xmp', 'iframe', 'noembed', 'noframes', 'textarea', 'noscript'].map(tag =>
    [tag, value => '<' + tag + '>' + value + '</' + tag + '>']),
  ['external script fallback', value => value.replace('<script>', '<script src="/app.js">')],
  ['non-executable script', value => value.replace('<script>', '<script type="application/json">')],
  ['JS line comment', value => '<script>// ' + value.slice(8, -9) + '\n</script>'],
  ['JS block comment', value => '<script>/*' + value.slice(8, -9) + '*/</script>'],
  ['JS string literal', value => '<script>const stale = `' + value.slice(8, -9) + '`;</script>'],
]) test('inactive ' + context + ' cannot supply the native detail model', async () => {
  const html = wrap(detail(row(1))) + detail(row('wrong'), '')
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)]) : html })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].jobDescription, null)
})

test('malformed native secondary country cannot authenticate a full India description', async () => {
  const job = { ...row(1), country: 'United States', ml_country: 'United States',
    multi_location: [{ country: ['India'], location: 'Bangalore, India' }],
    ml_Description: 'A full native description with malformed secondary country.' }
  const html = '<script>phApp.ddo = ' + JSON.stringify({ jobDetail: { data: { job } } }) + '</script>'
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)]) : html })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
})

test('a detail cannot replace the native application identity with an unrelated URL', async () => {
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([row(1)])
    : detail({ ...row(1), applyUrl: 'https://unrelated.example/jobs/999' }) })
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'identity-mismatch')
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
})

test('an external native apply URL remains usable when listing and detail agree exactly', async () => {
  const listing = { ...row(1), applyUrl: 'https://native-apply.example/job/1?source=careers' }
  const jobs = await scraper.run({ fetchText: async url => isListing(url) ? page([listing]) : detail(listing) })
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].applyUrl, listing.applyUrl)
})

for (const status of [500, 'error']) test('an explicit native listing failure status cannot certify empty inventory: ' + status, async () => {
  const html = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: {
    status, error: 'upstream unavailable', totalHits: 0, hits: 0, data: { jobs: [], aggregations: [] },
  } }) + '</script>'
  await assert.rejects(scraper.run({fetchText: async () => html}), {code:'PHENOM_INCOMPLETE_SNAPSHOT'})
})

test('explicit native detail failure status cannot authenticate attached content', async () => {
  const html = detail(row(1)).replace('"jobDetail":{', '"jobDetail":{"status":500,')
  const jobs = await scraper.run({fetchText: async url => isListing(url) ? page([row(1)]) : html})
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].jobDescription, null)
})

test('active JSON-LD cannot borrow full content from an inactive JobPosting', async () => {
  const posting = '<script type="application/ld+json">' + JSON.stringify({'@type':'JobPosting',title:row(1).title,
    jobLocation:{address:{addressCountry:'India'}},description:'Invented stale inactive full job description.'}) + '</script>'
  const jobs = await scraper.run({fetchText: async url => isListing(url) ? page([row(1)]) : '<template>' + posting + '</template>' + detail(row(1), '')})
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].jobDescription, null)
})

test('distinct active native models cannot authenticate conflicting details', async () => {
  const jobs = await scraper.run({fetchText: async url => isListing(url) ? page([row(1)]) : detail(row(1)) + detail(row('wrong'))})
  assert.equal(jobs[0].sourceDetailComplete, false)
})

test('recognized Turkey secondary does not invalidate explicit native India behind a foreign primary', async () => {
  const listing={...row(1),country:'Poland',multi_location:['Bangalore, India','Remote, Turkey']}
  const native = { ...row(1), country:'Poland', ml_country:'Poland',
    multi_location:[{country:'India',location:'Bangalore, India'},{country:'Turkey',location:'Remote, Turkey'}],
    ml_Description:'Build and maintain reliable production services across these explicit native offices.' }
  const html = '<script>phApp.ddo = ' + JSON.stringify({jobDetail:{data:{job:native}}}) + '</script>'
    + '<script type="application/ld+json">' + JSON.stringify({'@type':'JobPosting',title:row(1).title,
      jobLocation:[{address:{addressCountry:'India'}},{address:{addressCountry:'Turkey'}}]}) + '</script>'
  const jobs = await scraper.run({fetchText: async url => isListing(url) ? page([listing]) : html})
  assert.equal(jobs[0].sourceDetailComplete, true)
})

test('explicit country-only offices can retain the native no-location-specific city and state placeholders', async () => {
  const native={...row(1),ml_country:'India',standardisedCountry:'India',ml_Description:'Full native role description across these explicit countries.',
    multi_location:[{country:'India',location:'India',cityStateCountry:'India',city:'Not Location Specific',state:'Not Location Specific',
      cityState:'',stateCountry:'India',cityCountry:'India'},
    {country:'Estonia',location:'Estonia',cityStateCountry:'Estonia',city:'Not Location Specific',state:'Not Location Specific',
      cityState:'',stateCountry:'Estonia',cityCountry:'Estonia'}]}
  const html='<script>phApp.ddo = '+JSON.stringify({jobDetail:{data:{job:native}}})+'</script>'
  const jobs=await scraper.run({fetchText:async url=>isListing(url)?page([row(1)]):html})
  assert.equal(jobs[0].sourceDetailComplete,true)
})

test('a real city cannot contradict a country-only office even when another India office is valid', async () => {
  const native={...row(1),ml_country:'India',standardisedCountry:'India',ml_Description:'Full native role description with contradictory city metadata.',
    multi_location:[{country:'India',location:'India',cityStateCountry:'India',city:'Pune'},
      {country:'India',location:'Bangalore, India',cityStateCountry:'Bangalore, India',city:'Bangalore'}]}
  const html='<script>phApp.ddo = '+JSON.stringify({jobDetail:{data:{job:native}}})+'</script>'
  const jobs=await scraper.run({fetchText:async url=>isListing(url)?page([row(1)]):html})
  assert.equal(jobs[0].sourceDetailComplete,false)
})

test('a malformed native full description cannot become publishable object text', async () => {
  const jobs = await scraper.run({fetchText: async url => isListing(url) ? page([row(1)])
    : detail(row(1), {unsupported:'native field changed shape'})})
  assert.equal(jobs[0].sourceDetailComplete, false)
  assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
  assert.equal(jobs[0].jobDescription, null)
})

test('a valid matching native JobPosting can supply full content when the structured field changes shape', async () => {
  const html = detail(row(1), {unsupported:'native field changed shape'})
    + '<script type="application/ld+json">' + JSON.stringify({'@type':'JobPosting',title:row(1).title,identifier:'1',
      jobLocation:{address:{addressCountry:'India'}},description:'Verified matching native JobPosting description.'}) + '</script>'
  const jobs = await scraper.run({fetchText: async url => isListing(url) ? page([row(1)]) : html})
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].jobDescription, 'Verified matching native JobPosting description.')
})

for (const content of ['<script>console.log("not role content")</script>', '<style>.fake-role { color:red }</style>', '<!-- no actual role description -->']) {
  test('native markup without employer text cannot become healthy description: ' + content.split('>')[0], async () => {
    const html = '<script>phApp.ddo = ' + JSON.stringify({jobDetail:{data:{job:{...row(1),ml_country:'India',ml_Description:content}}}})
      .replaceAll('<', '\\u003c') + '</script>'
    const jobs = await scraper.run({fetchText: async url => isListing(url) ? page([row(1)]) : html})
    assert.equal(jobs[0].sourceDetailComplete, false)
    assert.equal(jobs[0].sourceDetailFailureKind, 'missing-content')
    assert.equal(jobs[0].jobDescription, null)
  })
}
