import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createCyberInfrastructureScraper } from '../../../scraper/cyberinfrastructure/script.js'
import { createVeeamIndiaScraper } from '../../../scraper/veeamindia/script.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { isIndiaJob } from '../../utils/indiaLocationFilter.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const originals = new Map(fixture.pages.map(page => [page.receipt.url, page]))
const cisURL = 'https://career.cisin.com/job/digital-marketing-internship-jobs'
const ownURL = 'https://careers.veeam.com/job/pune/senior-software-engineer-test/22681/100973212240'
const nativeURL = 'https://job-boards.eu.greenhouse.io/veeamsoftware/jobs/4982287101'
const run = async (source, mutate = (url, html) => html) => {
  const visits = new Map();let audit
  const jobs = await (source === 'cyberinfrastructure' ? createCyberInfrastructureScraper() : createVeeamIndiaScraper()).run({
    fetchPage: async url => {
      const page = originals.get(url);assert.ok(page, 'Only original declared URLs; mutations are labelled artificial controls')
      const visit = (visits.get(url) || 0) + 1;visits.set(url, visit)
      const html = mutate(url, Buffer.from(page.bodyBase64, 'base64').toString('utf8'), visit)
      return { url, status: html === null ? 503 : page.receipt.status, headers: page.receipt.responseHeaders,
        bodyBase64: html === null ? '' : Buffer.from(html).toString('base64') }
    }, onAudit: value => { audit = value }, now: () => '2026-10-31T10:00:00.000Z',
  })
  return { jobs, audit, visits }
}
const publicIndia = job => isIndiaJob(normalizeScrapedJob(job, { source: job.source, countryFilter: 'India' }))
const posting = (html, change) => html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/gi,
  (whole, start, raw, end) => { const value = JSON.parse(raw);return value['@type'] === 'JobPosting' ? start + JSON.stringify(change(value)) + end : whole })

for (const [source, target, role] of [['cyberinfrastructure', cisURL, cisURL], ['veeamindia', ownURL, ownURL], ['veeamindia', nativeURL, ownURL]])
  test('I1 artificial unchanged link closing503 holds earlier positive: ' + target, async () => {
    const r = await run(source, (url, html, visit) => url === target && visit === 2 ? null : html)
    assert.equal(r.visits.get(target), 2)
    const job = r.audit.observations.find(value => value.sourceUrl === role)
    assert.ok(job.jobDescription);assert.equal(job.sourceCurrentNativeRoleQualified, false)
    assert.ok(job.sourceNativeClosingObservation.sourceNativeIssues.length)
    assert.ok(r.audit.observationHistory.some(entry => entry.url === role && entry.earlier.jobDescription))
    assert.ok(!r.jobs.some(value => value.sourceUrl === role))
    assert.equal(readInventoryEvidence(r.jobs).listingComplete, false)
  })

test('I1 artificial unavailable closing primary keeps history in audit and returns no current candidates', async () => {
  const r = await run('veeamindia', (url, html, visit) => url === 'https://careers.veeam.com/india' && visit === 2 ? null : html)
  assert.equal(r.jobs.length, 0);assert.equal(r.audit.observations.length, 14)
  assert.ok(r.audit.observations.every(job => job.jobDescription && !job.sourceCurrentNativeRoleQualified))
  assert.equal(readInventoryEvidence(r.jobs).reportedTotal, null)
})

test('I1 artificial changed native company at unchanged closing link is held with original preserved', async () => {
  const r = await run('veeamindia', (url, html, visit) => url === nativeURL && visit === 2
    ? html.replace('"company_name":"Veeam Software"', '"company_name":"Other Company"') : html)
  assert.equal(r.visits.get(nativeURL), 2)
  const job = r.audit.observations.find(value => value.sourceUrl === ownURL)
  assert.ok(job.sourceNativeJobPost.company_name === 'Veeam Software')
  assert.equal(job.sourceCurrentNativeRoleQualified, false);assert.ok(!r.jobs.some(value => value.sourceUrl === ownURL))
})

test('I1 artificial changed closing country at stable link replaces current projection and retains opening India history', async () => {
  const r = await run('veeamindia', (url, html, visit) => url === nativeURL && visit === 2 ? html.replaceAll('Pune, India', 'Pune, USA') : html)
  const job = r.audit.observations.find(value => value.sourceUrl === ownURL)
  assert.equal(job.country, 'United States');assert.equal(publicIndia(job), false)
  assert.ok(r.audit.observationHistory.some(entry => entry.url === ownURL && entry.earlier.country === 'India'))
  assert.ok(!r.jobs.some(value => value.sourceUrl === ownURL))
})

for (const label of ['Pune', 'Pune, IN', 'Pune, Unknown']) test('I2 artificial unresolved country cannot pass actual India predicate: ' + label, async () => {
  const r = await run('veeamindia', (url, html) => url === nativeURL ? html.replaceAll('Pune, India', label) : html)
  const job = r.audit.observations.find(value => value.sourceUrl === ownURL)
  assert.equal(job.country, null);assert.equal(job.sourceCountryScopeUnresolved, true)
  assert.equal(job.sourceNativeJobPost.job_post_location, label)
  assert.equal(job.location, null);assert.deepEqual(job.locations, [])
  assert.equal(publicIndia(job), false)
})

test('I3 artificial own visible Veeam country conflict is retained and blocked through actual consumer', async () => {
  const r = await run('veeamindia', (url, html) => url === ownURL ? html.replace(/(class="job-location"[^>]*>)[\s\S]*?(<\/span>)/, '$1Pune, USA$2') : html)
  const job = r.audit.observations.find(value => value.sourceUrl === ownURL)
  assert.equal(job.sourceFirstPartyLocation, 'Pune, USA')
  assert.equal(job.sourceNativeJobPost.job_post_location, 'Pune, India')
  assert.equal(job.sourceNativeCountryConflict, true);assert.equal(job.country, null)
  assert.equal(publicIndia(job), false);assert.ok(!r.jobs.some(value => value.sourceUrl === ownURL))
})

test('I3 artificial CIS multiple IN addresses versus same-place visible USA cannot silently select India', async () => {
  const r = await run('cyberinfrastructure', (url, html) => url === cisURL ? posting(html, model => {
    model.jobLocation = [model.jobLocation, { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'Pune', addressCountry: 'IN' } }]
    return model
  }).replace(/(<dt>Location<\/dt><dd>)[\s\S]*?(<\/dd>)/, '$1142-A, New IT Park, Electronic Complex, Pardesipura, Indore, Madhya Pradesh 452010, USA$2') : html)
  const job = r.audit.observations.find(value => value.sourceUrl === cisURL)
  assert.equal(job.sourceNativeJobPosting.jobLocation.length, 2)
  assert.equal(job.sourceNativeCountryConflict, true);assert.equal(job.country, null)
  assert.equal(publicIndia(job), false);assert.ok(!r.jobs.some(value => value.sourceUrl === cisURL))
})

test('I3 artificial coherent multiple-country CIS worksites preserve the distinct India worksite', async () => {
  const r = await run('cyberinfrastructure', (url, html) => url === cisURL ? posting(html, model => {
    model.jobLocation = [model.jobLocation, { '@type': 'Place', address: { '@type': 'PostalAddress', addressLocality: 'New York', addressRegion: 'New York', addressCountry: 'US' } }]
    return model
  }).replace(/(<dt>Location<\/dt><dd>)[\s\S]*?(<\/dd>)/, '$1New York, New York, USA$2') : html)
  const job = r.jobs.find(value => value.sourceUrl === cisURL)
  assert.ok(job);assert.equal(job.country, 'India');assert.equal(publicIndia(job), true)
  assert.deepEqual(new Set(job.sourceNativeCountryCodes), new Set(['India', 'United States']))
})

test('I3 artificial coherent Veeam typed secondary foreign worksite does not erase native India worksite', async () => {
  const r = await run('veeamindia', (url, html) => url === ownURL ? posting(html, model => {
    model.jobLocation = [{ '@type': 'Place', address: { addressLocality: 'Pune', addressCountry: 'IN' } },
      { '@type': 'Place', address: { addressLocality: 'New York', addressCountry: 'US' } }]
    return model
  }) : html)
  const job = r.jobs.find(value => value.sourceUrl === ownURL)
  assert.ok(job);assert.equal(job.country, 'India');assert.equal(job.sourceNativeCountryConflict, false)
})

test('I4 genuine firstparty benefits and compensation reach sourceDescription for foreign native job5005555101', async () => {
  const r = await run('veeamindia'), job = r.audit.observations.find(value => value.jobId === '5005555101')
  for (const phrase of ['401(k) retirement plan with company matching contributions', '$289,320', '$537,360']) {
    assert.ok(job.sourceFirstPartyDescription.includes(phrase));assert.ok(job.jobDescription.includes(phrase))
    assert.ok(normalizeScrapedJob(job, { source: 'veeamindia' }).sourceDescription.includes(phrase))
  }
  assert.ok(job.jobDescription.includes(job.sourceFirstPartyDescription))
})

test('I4 artificial firstparty-only mandatory qualification remains in actual source description alongside native criteria', async () => {
  const phrase = 'A current ABC production certification is mandatory for this role.'
  const r = await run('veeamindia', (url, html) => url === ownURL ? html.replace(/(class="ats-description"[^>]*>)/, '$1<p>' + phrase + '</p>') : html)
  const job = r.jobs.find(value => value.sourceUrl === ownURL)
  assert.ok(job.sourceFirstPartyDescription.includes(phrase));assert.ok(job.jobDescription.includes(phrase))
  assert.ok(job.jobDescription.includes('Veeam'))
})

for (const code of ['window["window"].__remixContext={};', 'this.__remixContext={};', '__remixContext={};',
  'window.self.globalThis.__remixContext.state={};', 'const alias=window["window"];alias.__remixContext={};',
  'const alias=this;alias.__remixContext={};']) test('I5 artificial global self-alias/this mutation is held: ' + code, async () => {
  const r = await run('veeamindia', (url, html) => url === nativeURL ? html.replace('</body>', '<script>' + code + '</script></body>') : html)
  const job = r.audit.observations.find(value => value.sourceUrl === ownURL)
  assert.equal(job.sourceCurrentNativeRoleQualified, false);assert.ok(job.sourceNativeIssues.length)
  assert.ok(!r.jobs.some(value => value.sourceUrl === ownURL))
})

test('I5 artificial quoted/inert alias examples remain terminal; genuine positive criteria survive', async () => {
  const code = '<script>const example="this.__remixContext={}";</script><template><script>window["window"].__remixContext={};</script></template>'
  const r = await run('veeamindia', (url, html) => url === nativeURL ? html.replace('</body>', code + '</body>') : html)
  const job = r.jobs.find(value => value.sourceUrl === ownURL)
  assert.ok(job?.jobDescription);assert.equal(job.sourceCurrentNativeRoleQualified, true)
})
