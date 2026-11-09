import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/location-cohort-20261031.json.gz', import.meta.url))))
for (const packet of fixture.packets) assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const replay = async ({ detail, careers, registered = false } = {}) => {
  const events = [], operation = registered ? createCatalogScraper(getScraperCatalog().find(row => row.source === source.SOURCE)).run : source.run
  const jobs = await operation({ fetchText: async url => {
    events.push(url)
    const packet = fixture.packets.find(packet => packet.url === url)
    assert.ok(packet, 'No uncaptured request: ' + url)
    return url === source.CAREERS_URL && careers ? careers(packet.body)
      : /\/careers\/[^/]+\/$/.test(url) && detail ? detail(packet.body, url) : packet.body
  } })
  return { jobs, events }
}

test('registered Josh recovers seven literal native workplace labels and complete bodies without appending country', async () => {
  const { jobs, events } = await replay({ registered: true })
  assert.equal(jobs.length, 7)
  assert.equal(events.length, 9)
  assert.deepEqual(jobs.map(job => job.location), ['Gurgaon/Gurugram – Work from office', 'Gurugram (WFO)',
    'Gurgaon (WFO)', 'Gurugram/Gurgaon – Work from office', 'Gurugram/Gurgaon – Work from office', 'Gurgaon', 'Gurgaon'])
  for (const job of jobs) {
    assert.equal(job.country, null)
    assert.equal(job.requisitionId, null, 'An advertised URL key is not a native requisition')
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.publicExperienceChecked, true)
    assert.ok(job.jobDescription.length > 1000)
    assert.equal(job.sourceUrl, job.applyUrl)
  }
  assert.match(jobs[3].jobDescription, /Strong understanding of STLC and SDLC/)
  assert.match(jobs[4].jobDescription, /Combine excellent abstract reasoning ability/)
  assert.match(jobs[5].jobDescription, /Develop reusable, maintainable cross-platform frontend web application components/)
  assert.match(jobs[6].jobDescription, /Mentor other developers/)
  assert.equal(readSourceObservationEvidence(jobs, source.SOURCE)?.observedVacancyCount, 7)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, null)
})

for (const [name, mutate] of [
  ['a different visible title', (html) => html.replace(/(<span class="career-list__title flex-align-center">)[\s\S]*?(<\/span>)/i, '$1Different native role$2')],
  ['foreign canonical and hidden application ownership', (html, url) => html.replaceAll(url, 'https://other-company.example/careers/different-role/')],
  ['another same-company canonical and hidden role', (html, url) => html.replaceAll(url, 'https://www.joshtechnologygroup.com/careers/different-role/')],
]) test('Josh refuses to merge ' + name + ' into a genuine listing', async () => {
  await assert.rejects(replay({ detail: mutate }), /Josh Technology Group.*(?:identity|title|URL|role|detail)/i)
})

test('hidden Josh native bodies remain partial and do not expose their work-location text', async () => {
  const { jobs } = await replay({ detail: html => html.replace(/<head\b[^>]*>/i,
    '$&<style>.career-list__openings,.career-list__content{display:none!important}</style>') })
  assert.equal(jobs.length, 7)
  assert.ok(jobs.every(job => job.location === null && job.country === null && job.sourceDetailComplete === false
    && job.publicExperienceChecked === false && job.sourceDetailFailureKind === 'missing-content'))
})

test('a Josh footer or head-office label never fills a missing same-role work-location label', async () => {
  const { jobs } = await replay({ detail: html => html.replaceAll('Work Location', 'Other unbound field')
    .replace(/<footer\b/i, '<div>Head office: Gurgaon, India</div><footer') })
  assert.equal(jobs.length, 7)
  assert.ok(jobs.every(job => job.location === null && job.country === null))
})

test('a native Josh URL observation key stays independent of title spelling and cannot become a requisition', async () => {
  const { jobs } = await replay()
  assert.equal(jobs[5].jobId, 'joshtechnologygroup-senior-front-end-developer-1')
  assert.equal(jobs[6].jobId, 'joshtechnologygroup-senior-front-end-developer-2')
  assert.equal(jobs[5].requisitionId, null)
})

for (const mode of ['author-css', 'opacity', 'visible']) test('Josh qualified normalized JD retains only visible native criteria with separate raw ' + mode + ' evidence', async () => {
  const marker = 'Controlled native responsibility: maintain the role owned project notes.'
  const { jobs } = await replay({ detail: html => {
    const style = mode === 'author-css' ? '<style>.followup-criteria{display:none!important}</style>' : ''
    const attributes = mode === 'author-css' ? ' class="followup-criteria"' : mode === 'opacity' ? ' style="opacity:0"' : ''
    return html.replace('</head>', style + '</head>').replace(/(<div class="career-list__openings">)/i,
      '$1<p' + attributes + '>' + marker + '</p>')
  } })
  for (const job of jobs) {
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.jobDescription.includes(marker), mode === 'visible')
    assert.equal(job.rawNativeRoleEvidence.contentJobDescription.includes(marker), true)
  }
  assert.match(jobs[3].jobDescription, /Strong understanding of STLC and SDLC/)
})
