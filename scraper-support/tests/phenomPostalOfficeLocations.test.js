import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../phenom/engine.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { normalizeScrapedJob } from '../utils/normalizeScrapedJob.js'

const fixture = (source, file) => readFileSync(new URL('./fixtures/' + source + '/' + file, import.meta.url), 'utf8')
const evidence = source => JSON.parse(fixture(source, 'current-20261024-location-evidence.json'))
const page = listing => '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { status: 200, totalHits: 1, hits: 1,
  data: { jobs: [listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
const engine = source => createPhenomScraper({ source, companyName: source === 'juniper' ? 'Juniper Networks' : 'Giant Eagle',
  baseUrl: source === 'juniper' ? 'https://careers.hpe.com' : 'https://jobs.gianteagle.com',
  searchPath: source === 'juniper' ? '/juniper' : '/in/hi/search-results',
  ...(source === 'juniper' ? { jobPathPrefix: '/us/en' } : {}), scraperDir: fileURLToPath(new URL('.', import.meta.url)) })
const replay = (source, sample, html = fixture(source, sample.detailHtml)) => engine(source).run({ fetchText: async url => {
  if (url === evidence(source).landingURL) return page(sample.listing)
  assert.equal(url, sample.nativeDetailURL, 'Fetch only the role independently present in the captured listing')
  return html
} })
const changedDetail = (source, sample, change) => {
  const native = JSON.parse(fixture(source, sample.detailNative))
  const posting = native.jsonLd.find(value => value?.['@type'] === 'JobPosting')
  change(native.jobDetail.data.job, posting, native)
  return '<link rel="canonical" href="' + native.alternateLinks.find(link => link.rel === 'canonical').href + '">'
    + '<script>phApp.ddo = ' + JSON.stringify({ jobDetail: native.jobDetail }).replaceAll('<', '\\u003c') + '</script>'
    + '<script type="application/ld+json">' + JSON.stringify(posting).replaceAll('<', '\\u003c') + '</script>'
}

test('current Juniper detail accepts its exact native postal label with unchanged role identity and India scope', async () => {
  const [sample] = evidence('juniper').samples
  const [job] = await replay('juniper', sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, '1207301')
  assert.equal(job.requisitionId, '1207301')
  assert.equal(job.title, 'ASIC Senior Manager')
  assert.equal(job.location, 'Bengaluru, Karnātaka, India')
  assert.equal(job.city, 'Bengaluru')
  assert.ok(job.jobDescription.length > 5000)
  assert.equal(job.applyUrl, sample.listing.applyUrl)
  assert.equal(normalizeScrapedJob(job).sourceDescription, job.jobDescription)
})

for (const sample of evidence('gianteagle').samples) test('current Giant Eagle native office accepts ' + sample.listing.reqId + ' without inventing a city', async () => {
  const [job] = await replay('gianteagle', sample)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, sample.listing.jobId)
  assert.equal(job.requisitionId, sample.listing.reqId)
  assert.equal(job.location, 'Karnātaka, India')
  assert.equal(job.city, null)
  assert.equal(job.country, 'India')
  assert.equal(job.applyUrl, sample.listing.applyUrl)
  assert.ok(job.jobDescription.length > 1000)
  const normalized = normalizeScrapedJob(job)
  assert.equal(normalized.sourceDescription, job.jobDescription)
  assert.equal(normalized.city, null)
})

test('the earlier Juniper fixture also recovers its native postal-location description', async () => {
  const scraper = engine('juniper')
  const listingHtml = fixture('juniper', 'search-results-page-0.html')
  const jobs = await scraper.run({ maxPages: 1, maxJobs: 1, fetchText: async url => url.endsWith('/juniper')
    ? listingHtml : fixture('juniper', 'job-detail-1191918.html') })
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.ok(jobs[0].jobDescription.length > 1000)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false, 'A selected fixture is not a complete live inventory')
})

for (const [name, change] of [
  ['different native postal code', job => { job.multi_location[0].postalCode = '999999' }],
  ['different short-label postal code', job => { job.multi_location[0].location = 'Bengaluru, Karnātaka, 999999' }],
  ['different short-label city', job => { job.multi_location[0].location = 'Mumbai, Karnātaka, 560048' }],
  ['different explicit state', job => { job.multi_location[0].state = 'California' }],
  ['foreign explicit office country', job => { job.multi_location[0].country = 'United States' }],
  ['conflicting schema country', (_job, posting) => { posting.jobLocation.address.addressCountry = 'United States' }],
  ['different native role identifier', job => { job.reqId = 'unrelated-role' }],
  ['different native job sequence', job => { job.jobSeqNo = 'unrelated-sequence' }],
]) test('postal-location contract rejects ' + name, async () => {
  const [sample] = evidence('juniper').samples
  const [job] = await replay('juniper', sample, changedDetail('juniper', sample, change))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

for (const [name, change] of [
  ['office identifier alone without a matching name', job => { delete job.multi_location[0].locationName }],
  ['office name without a native identifier', job => { delete job.multi_location[0].locationId }],
  ['different named office label', job => { job.multi_location[0].location = 'Unrelated Corporate Office' }],
  ['different explicit state', job => { job.multi_location[0].state = 'California' }],
  ['foreign full office region', job => { job.multi_location[0].cityStateCountry = 'California, United States' }],
  ['missing explicit office country', job => { delete job.multi_location[0].country }],
  ['missing full office region', job => { delete job.multi_location[0].cityStateCountry }],
  ['city incompatible with the state-only full region', job => { job.multi_location[0].city = 'Bengaluru' }],
  ['foreign explicit office country', job => { job.multi_location[0].country = 'United States' }],
  ['conflicting schema country', (_job, posting) => { posting.jobLocation.address.addressCountry = 'United States' }],
  ['changed apply URL', job => { job.applyUrl = 'https://unrelated.example/apply' }],
]) test('native named-office contract rejects ' + name, async () => {
  const [sample] = evidence('gianteagle').samples
  const [job] = await replay('gianteagle', sample, changedDetail('gianteagle', sample, change))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

for (const [name, office, schemaCountry] of [
  ['India and United Kingdom', { country: 'United Kingdom', city: 'London', state: 'England',
    cityStateCountry: 'London, England, United Kingdom', location: 'London, England, United Kingdom' }, 'GB'],
  ['India and United States with a schema country object', { country: 'United States of America', city: 'San Francisco', state: 'California',
    cityStateCountry: 'San Francisco, California, United States of America', location: 'San Francisco, California, United States of America' }, { name: 'US' }],
]) test('explicit native and schema office sets retain legitimate ' + name + ' roles', async () => {
  const [sample] = evidence('juniper').samples
  const html = changedDetail('juniper', sample, (job, posting) => {
    job.multi_location.push(office)
    posting.jobLocation = [posting.jobLocation, { address: { addressCountry: schemaCountry } }]
  })
  const [job] = await replay('juniper', sample, html)
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.country, 'India')
  assert.equal(job.location, 'Bengaluru, Karnātaka, India')
})

test('an unresolved native office cannot corroborate supplied schema countries', async () => {
  const [sample] = evidence('juniper').samples
  const html = changedDetail('juniper', sample, job => { job.multi_location.push('Unresolved Campus') })
  const [job] = await replay('juniper', sample, html)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

for (const source of ['juniper', 'gianteagle']) for (const [name, country] of [
  ['object without a supported name', { '@type': 'Country', identifier: 'US' }],
  ['object with a conflicting identifier', { '@type': 'Country', name: 'India', identifier: 'US' }],
  ['object with an empty name', { '@type': 'Country', name: '' }],
  ['unrelated object type', { '@type': 'Organization', name: 'India' }],
  ['empty country string', ''],
]) test(source + ' rejects unsupported schema country ' + name, async () => {
  const [sample] = evidence(source).samples
  const [job] = await replay(source, sample, changedDetail(source, sample, (_job, posting) => {
    posting.jobLocation.address.addressCountry = country
  }))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
