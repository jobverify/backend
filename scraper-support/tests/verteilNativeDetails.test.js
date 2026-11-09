import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import * as verteil from '../../scraper/verteiltechnologies/script.js'

const fixture = name => gunzipSync(readFileSync(new URL(`./fixtures/verteiltechnologies/${name}.gz`, import.meta.url))).toString()
const companyHtml = fixture('company.html'), config = JSON.parse(fixture('config.json')), detail = JSON.parse(fixture('job-43.json'))
const applyUrl = 'https://recruitcareers.zappyhire.com/en/Verteil/apply?job=43'
const api = 'https://verteil.zappyhire-multitenant-be-prod.zappyhire.com/api/'
const configUrl = api + 'careers/configurations/?job=43', detailUrl = api + 'careers/jobs/43/'
const replay = (options = {}) => verteil.run({
  fetchText: async url => { assert.equal(url, verteil.CAREERS_URL); return companyHtml },
  fetchNative: async url => {
    assert.ok([configUrl, detailUrl].includes(url), `Unverified native request: ${url}`)
    return { status: 200, url, payload: url === configUrl ? config : detail }
  },
  now: () => '2026-10-29T18:10:00.000Z', ...options,
})

test('Verteil job 43 recovers exact native body and 2023 publication date independently of the similar 2026 role', async () => {
  const jobs = await replay()
  assert.equal(jobs.length, 1)
  const [job] = jobs
  assert.equal(job.jobId, '43')
  assert.equal(job.title, 'Executive - Customer Support')
  assert.equal(job.sourceDetailComplete, true)
  assert.match(job.sourceDescription, /^Requirement\n/)
  assert.match(job.sourceDescription, /Minimum 2 years of experience in IATA accredited travel agency/)
  assert.match(job.sourceDescription, /Flexible to work in shifts/)
  assert.doesNotMatch(job.sourceDescription, /Senior Associate-Finance|Do you want to join us/)
  assert.equal(job.postingDate, '2023-12-22')
  assert.equal(job.nativeJobPublishDate, '2023-12-22T10:37:41.497329Z')
  assert.equal(job.sourceDateEvidence, 'verteil-native-job-posting-v1')
  assert.equal(job.closingDate, null)
  assert.equal(job.sourceUrl, applyUrl)
  assert.equal(job.sourceDetailUrl, detailUrl)
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Kochi')
  assert.equal(job.publicationEligible, undefined)
})

test('Verteil rejects wrong employer, title, native id, country or career-page identity', async () => {
  for (const mutate of [
    (c, d) => { c.results.name = 'Other Company' },
    (c, d) => { c.results.website = 'https://foreign.example/' },
    (c, d) => { d.results.id = 261 },
    (c, d) => { d.results.title = 'Senior Associate-Finance' },
    (c, d) => { d.results.location[0].country_code = 'US' },
    (c, d) => { d.results.location[0].city = 'Dubai' },
    (c, d) => { d.results.location[0].city = 'Kochi-Kerala / Dubai' },
    (c, d) => { d.results.job_board_urls[0].url = 'https://recruitcareers.zappyhire.com/other/apply?job=43' },
  ]) {
    const c = structuredClone(config), d = structuredClone(detail); mutate(c, d)
    const [job] = await replay({ fetchNative: async url => ({ status: 200, url, payload: url === configUrl ? c : d }) })
    assert.equal(job.sourceDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.equal(job.postingDate, null)
  }
})

test('Verteil does not treat creation or similar-job dates as publication or infer a closing date', async () => {
  const payload = structuredClone(detail)
  delete payload.results.job_publish_date
  payload.results.created_at = '2026-10-29T01:00:00Z'
  const [job] = await replay({ fetchNative: async url => ({ status: 200, url, payload: url === configUrl ? config : payload }) })
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourceDateEvidence, undefined)
  assert.equal(job.closingDate, null)
})

test('Verteil retains the advertised listing with incomplete detail on denied, redirected or unavailable native responses', async () => {
  for (const fetchNative of [
    async () => { throw new Error('network unavailable') },
    async url => ({ status: 403, url, payload: detail }),
    async () => ({ status: 200, url: 'https://foreign.example/', payload: detail }),
  ]) {
    const [job] = await replay({ fetchNative })
    assert.equal(job.jobId, '43')
    assert.equal(job.sourceDescription, null)
    assert.equal(job.sourceDetailComplete, false)
    assert.ok(job.sourceDetailFailureKind)
  }
})
