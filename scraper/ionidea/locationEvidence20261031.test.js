import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import { getScraperCatalog, createCatalogScraper } from '../../scraper-support/providers/index.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/location-cohort-20261031.json.gz', import.meta.url))))
const [packet] = fixture.packets
assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const replay = ({ mutate, signal, registered = false } = {}) => (registered
  ? createCatalogScraper(getScraperCatalog().find(row => row.source === 'ionidea')).run : source.run)({ signal,
  fetchText: async url => { assert.equal(url, source.CAREERS_URL); return mutate ? mutate(packet.body) : packet.body } })

test('registered IonIdea collects actual native paragraph role cards instead of footer headings', async () => {
  const jobs = await replay({ registered: true })
  assert.deepEqual(jobs.map(job => job.title), ['APM Consultant/Sr Consultant for Dynatrace', 'Consultant (Devops Engineer)', 'Software Engineer - APM'])
  const apm = jobs[0], devops = jobs[1], engineer = jobs[2]
  assert.equal(apm.location, 'Bangalore/ Hyderabad/ Chennai/ Delhi')
  assert.equal(engineer.location, apm.location)
  assert.equal(apm.country, null)
  assert.equal(engineer.country, null)
  assert.equal(devops.location, 'unanticipated client worksites throughout the U.S.')
  assert.equal(devops.country, 'U.S.')
  assert.equal(apm.applyUrl, 'https://www.ionidea.com/careers-apply.php?id=252368')
  assert.equal(engineer.applyUrl, 'https://www.ionidea.com/careers-apply.php?id=252367')
  assert.equal(devops.applyUrl, 'https://www.jobpostingtoday.com/application/15567/apply/')
  assert.match(apm.jobDescription, /Dynatrace Product Certification/)
  assert.match(engineer.jobDescription, /Flexible to travel and relocate if required/)
  assert.match(devops.jobDescription, /Salary: \$114,026\/year/)
  for (const job of jobs) {
    assert.equal(job.requisitionId, null)
    assert.equal(job.jobId, null)
    assert.equal(job.city, null)
    assert.equal(job.sourceDetailComplete, true)
  }
  assert.equal(readSourceObservationEvidence(jobs, 'ionidea')?.observedVacancyCount, 3)
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, null)
})

test('extra IonIdea contact/role-area headings do not become native vacancies', async () => {
  const jobs = await replay({ mutate: html => html.replace(/<\/body>/i, '<h3>Engineering careers</h3><p>India</p></body>') })
  assert.equal(jobs.length, 3)
  assert.ok(jobs.every(job => !/Contact Us|Find us on|Our location|Engineering careers/.test(job.title)))
})

test('missing IonIdea role Location cannot be filled by a city list, headquarters, footer, or provider country', async () => {
  const jobs = await replay({ mutate: html => html.replaceAll('Location:', 'Head office:')
    .replace(/<\/body>/i, '<footer>Bangalore, India</footer></body>') })
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].location, null)
  assert.equal(jobs[2].location, null)
  assert.equal(jobs[0].country, null)
  assert.equal(jobs[2].country, null)
})

test('unbound U.S. text does not replace a missing IonIdea worksite statement', async () => {
  const jobs = await replay({ mutate: html => html.replace('Will provide services at unanticipated client worksites throughout the U.S.',
    'Our company has customers throughout the U.S.') })
  const devops = jobs.find(job => job.title === 'Consultant (Devops Engineer)')
  assert.equal(devops.location, null)
  assert.equal(devops.country, null)
})

for (const prefix of ['This position does not have the requirement: ', 'Not required: ', 'A different role says: ']) {
  test('IonIdea only an affirmative same-role worksite sentence supplies country, not ' + prefix, async () => {
    const sentence = 'Will provide services at unanticipated client worksites throughout the U.S.'
    const jobs = await replay({ mutate: html => html.replace(sentence, prefix + sentence) })
    const devops = jobs.find(job => job.title === 'Consultant (Devops Engineer)')
    assert.equal(devops.location, null)
    assert.equal(devops.country, null)
    assert.ok(devops.jobDescription.includes(prefix + sentence), 'Literal unqualified prose is still preserved')
  })
}

for (const mutate of [html => html.replace('/careers-apply.php?id=252368', 'https://other-company.example/apply'),
  html => html.replace('/careers-apply.php?id=252368', '/careers-apply.php?id=252368&id=252367'),
  html => html.replace(/<head\b[^>]*>/i, '$&<style>.careers-job-title{opacity:0}</style>')]) {
  test('IonIdea refuses contradictory application ownership or permanently hidden role identity', async () => {
    await assert.rejects(replay({ mutate }), /IonIdea.*(?:application|URL|identity|visible|role)/i)
  })
}

test('IonIdea exact immutable cancellation reason stops before native collection', async () => {
  const controller = new AbortController(), reason = Object.freeze(new Error('Stop IonIdea'))
  controller.abort(reason)
  await assert.rejects(replay({ signal: controller.signal }), error => error === reason)
})
