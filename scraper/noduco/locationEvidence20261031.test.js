import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import test from 'node:test'
import * as source from './script.js'
import { createCatalogScraper, getScraperCatalog } from '../../scraper-support/providers/index.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { readSourceObservationEvidence } from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./nativeEvidence/location-cohort-20261031.json.gz', import.meta.url))))
for (const packet of fixture.packets) assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'), packet.sha256)
const mutateSchema = (html, mutate) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
  (whole, open, text, close) => { const schema = JSON.parse(text); if (schema['@type'] !== 'JobPosting') return whole; mutate(schema); return open + JSON.stringify(schema) + close })
const replay = async ({ detail, careers, registered = false } = {}) => {
  const events = [], operation = registered ? createCatalogScraper(getScraperCatalog().find(row => row.source === 'noduco')).run : source.run
  const jobs = await operation({ fetchText: async url => {
    events.push(url)
    const packet = fixture.packets.find(packet => packet.url === url)
    assert.ok(packet, 'No uncaptured native read: ' + url)
    return /\/careers\/\d+\/$/.test(url) && detail ? detail(packet.body, url)
      : url === source.CAREERS_URL && careers ? careers(packet.body) : packet.body
  } })
  return { jobs, events }
}

test('registered Noduco recovers explicit same-role Noida/Uttar Pradesh/IN while retaining full native criteria and application', async () => {
  const { jobs, events } = await replay({ registered: true })
  assert.equal(jobs.length, 2)
  assert.equal(events.length, 4)
  for (const job of jobs) {
    assert.equal(job.location, 'Noida, Uttar Pradesh, IN')
    assert.equal(job.city, 'Noida')
    assert.equal(job.country, 'IN')
    assert.match(job.jobDescription, /Solid experience with both Relational and NoSQL databases/)
    assert.match(job.jobDescription, /Proactive in identifying potential technical solutions/)
    assert.match(job.applyUrl, /^mailto:hr@noduco\.com\?subject=Application for /)
  }
  assert.equal(readSourceObservationEvidence(jobs, 'noduco')?.observedVacancyCount, 2)
  assert.equal(readInventoryEvidence(jobs)?.status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete, false)
  assert.equal(readInventoryEvidence(jobs)?.verifiedAt, null)
})

for (const value of [null, 'ZZ', 'US']) test('Noduco never derives workplace India from applicant eligibility or city when primary country is ' + value, async () => {
  const { jobs } = await replay({ detail: html => mutateSchema(html, schema => {
    if (value === null) delete schema.jobLocation.address.addressCountry
    else schema.jobLocation.address.addressCountry = value
  }) })
  assert.equal(jobs.length, 2)
  for (const job of jobs) assert.equal(job.country, value === 'US' ? 'US' : null)
})

for (const [name, mutate] of [
  ['other native title', schema => { schema.title += ' another role' }],
  ['other native employer', schema => { schema.hiringOrganization.name = 'Other Employer' }],
  ['foreign employer domain', schema => { schema.hiringOrganization.sameAs = 'https://other-company.example/' }],
  ['other supplied native role URL', schema => { schema.url = 'https://noduco.com/careers/999999/' }],
  ['other supplied native requisition', schema => { schema.identifier = { value: '999999' } }],
  ['contradictory native summary', schema => { schema.description = 'Develop a different unrelated product.' }],
]) test('Noduco refuses to bind typed geography to ' + name, async () => {
  await assert.rejects(replay({ detail: html => mutateSchema(html, mutate) }), /Noduco.*(?:identity|schema|role|company|description)/i)
})

test('Noduco cannot bind geography to an ambiguous duplicate JobPosting', async () => {
  await assert.rejects(replay({ detail: html => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>)/i, '$1$1') }), /Noduco.*(?:ambiguous|schema|identity)/i)
})

test('Noduco checks every supplied canonical role URL before trusting same-document typed country', async () => {
  await assert.rejects(replay({ detail: html => html.replace(/(<link\b[^>]*rel="canonical"[^>]*href=")https:\/\/noduco\.com\/careers\/\d+\/("[^>]*>)/i,
    '$1https://noduco.com/careers/999999/$2') }), /Noduco.*(?:identity|URL|role)/i)
})

test('inert Noduco schema and footer address cannot replace missing role-owned country', async () => {
  const { jobs } = await replay({ detail: html => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>)/i,
    '<template>$1</template>').replace(/<footer\b/i, '<div>Noida, Uttar Pradesh, India</div><footer') })
  assert.equal(jobs.length, 2)
  assert.ok(jobs.every(job => job.country === null && job.location === null))
})

test('permanently hidden Noduco role cards cannot become active vacancies', async () => {
  await assert.rejects(replay({ careers: html => html.replace(/<head\b[^>]*>/i, '$&<style>.job-card{opacity:0}</style>') }), /Noduco.*(?:visible|active|role|careers)/i)
})

for (const mode of ['author-css', 'opacity', 'visible']) test('Noduco normalized full criteria exclude hidden content and retain separate raw ' + mode + ' evidence', async () => {
  const marker = 'Controlled native responsibility: maintain the role owned platform notes.'
  const { jobs } = await replay({ detail: html => {
    const style = mode === 'author-css' ? '<style>.followup-criteria{display:none!important}</style>' : ''
    const attributes = mode === 'author-css' ? ' class="followup-criteria"' : mode === 'opacity' ? ' style="opacity:0"' : ''
    return html.replace('</head>', style + '</head>').replace('<ul class="job-section-list">',
      '<ul class="job-section-list"><li><span' + attributes + '>' + marker + '</span></li>')
  } })
  for (const job of jobs) {
    assert.equal(job.sourceDetailComplete, true)
    assert.equal(job.jobDescription.includes(marker), mode === 'visible')
    assert.equal(job.rawNativeRoleEvidence.contentJobDescription.includes(marker), true)
    assert.equal(job.country, 'IN')
    assert.match(job.jobDescription, /Solid experience with both Relational and NoSQL databases/)
  }
})

for (const [field, duplicate] of [['title', '"title":"Other unrelated role",'], ['escaped-title', '"ti\\u0074le":"Other unrelated role",'],
  ['country', '"addressCountry":"US",'], ['company', '"name":"Other employer",']]) {
  test('Noduco rejects supplied duplicate JSON-LD ' + field + ' before last-key parsing can erase a contradiction', async () => {
    await assert.rejects(replay({ detail: html => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
      (whole, open, text, close) => {
        if (JSON.parse(text)['@type'] !== 'JobPosting') return whole
        const key = field === 'country' ? 'addressCountry' : field === 'company' ? 'name' : 'title'
        const changed = text.replace(new RegExp('("' + key + '"\\s*:)'), duplicate + '$1')
        assert.notEqual(changed, text, 'The exact captured native field must receive the contradictory duplicate')
        return open + changed + close
      }) }), /Noduco.*(?:schema|duplicate|identity)/i)
  })
}
