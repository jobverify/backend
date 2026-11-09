import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { run } from './script.js'
import { createPhenomScraper, extractPhAppDdo } from '../../scraper-support/phenom/engine.js'

const { sample } = JSON.parse(gunzipSync(readFileSync(new URL('./nativeEvidence/dash-country-20261105.json.gz', import.meta.url))))
assert.equal(createHash('sha256').update(sample.body).digest('hex'), sample.sha256)
const listing = '<script>phApp.ddo = ' + JSON.stringify({ eagerLoadRefineSearch: { status: 200, totalHits: 1, hits: 1,
  data: { jobs: [sample.listing], aggregations: [{ field: 'country', value: { India: 1 } }] } } }) + '</script>'
const changedBody = (change, postingChange = () => {}) => {
  const model = extractPhAppDdo(sample.body)
  change(model.jobDetail.data.job)
  const jsonLd = [...sample.body.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => {
      const posting = JSON.parse(match[1])
      if (posting['@type'] === 'JobPosting') postingChange(posting)
      return '<script type="application/ld+json">' + JSON.stringify(posting).replaceAll('<', '\\u003c') + '</script>'
    }).join('')
  return '<link rel="canonical" href="' + sample.url + '"><script>phApp.ddo = '
    + JSON.stringify(model).replaceAll('<', '\\u003c') + '</script>' + jsonLd
}
const replay = async (body = sample.body, operation = run) => {
  const jobs = await operation({ nativeDetailRecovery: false, fetchText: async url => {
    if (url.endsWith('/search-results')) return listing
    assert.equal(url, sample.url)
    return body
  } })
  assert.equal(jobs.length, 1)
  return jobs[0]
}
const dubai = job => job.multi_location.find(office => office.country === 'United Arab Emirates')

test('Quest retains the full native India description when its explicitly bound Dubai office uses a dash country display', async () => {
  const job = await replay()
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.jobId, 'P-122255')
  assert.equal(job.title, 'Senior Architect - HMI Networking and Cybersecurity')
  assert.equal(job.country, 'India')
  assert.equal(job.sourceUrl, sample.url)
  assert.ok(job.jobDescription.length > 1000)
})

for (const [name, change] of [
  ['a conflicting typed city', job => { dubai(job).city = 'Abu Dhabi' }],
  ['a conflicting typed state', job => { dubai(job).state = 'Abu Dhabi' }],
  ['a conflicting typed country', job => { dubai(job).country = 'India' }],
  ['a missing typed country', job => { delete dubai(job).country }],
  ['a conflicting display city', job => { dubai(job).location = 'Abu Dhabi - United Arab Emirates' }],
  ['a conflicting display country', job => { dubai(job).location = 'Dubai - India' }],
  ['an unbound extra display locality', job => { dubai(job).location = 'Office - Dubai - United Arab Emirates' }],
  ['a conflicting redundant city/country', job => { dubai(job).cityCountry = 'Abu Dhabi, United Arab Emirates' }],
  ['a conflicting role identity', job => { job.reqId = 'unrelated-role' }],
  ['a conflicting native title', job => { job.title = 'Other role' }],
]) test('Quest dash display still rejects ' + name, async () => {
  const job = await replay(changedBody(change))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

test('Quest dash display retains the independent native JobPosting title guard', async () => {
  const job = await replay(changedBody(() => {}, posting => { posting.title = 'Other role' }))
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})

test('the captured dash display cannot qualify another adapter without its reviewed source opt-in', async () => {
  const other = createPhenomScraper({ source: 'unopted-phenom', companyName: 'Quest Global', baseUrl: 'https://careers.quest-global.com',
    searchPath: '/global/en/search-results', scraperDir: fileURLToPath(new URL('.', import.meta.url)), nativeBangaloreLocationAlias: true,
    nativeLocalitySuffixFormatting: true, nativeBoundUSStateCodeFormatting: true, nativeReviewedIndiaCityAliases: true })
  const job = await replay(sample.body, other.run)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.sourceDetailFailureKind, 'identity-mismatch')
})
