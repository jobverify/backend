import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { createHash } from 'node:crypto'
import * as cis from '../../../scraper/cyberinfrastructure/script.js'
import * as veeam from '../../../scraper/veeamindia/script.js'
import { normalizeScrapedJob } from '../../utils/normalizeScrapedJob.js'
import { readInventoryEvidence } from '../../utils/inventoryEvidence.js'

const fixture = JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/actual-http-20261031.json.gz', import.meta.url))))
const sha = value => createHash('sha256').update(value).digest('hex')
const now = () => '2026-10-31T10:00:00.000Z'
const primary = { cyberinfrastructure: cis.CAREERS_URL, veeamindia: veeam.INDIA_CAREERS_URL }
const factory = source => source === 'cyberinfrastructure' ? cis.createCyberInfrastructureScraper() : veeam.createVeeamIndiaScraper()
const originals = new Map(fixture.pages.map(page => [page.receipt.url, page]))
const oracle = kind => fixture.oracle.filter(row => row.kind === kind)
const nativeURL = oracle('veeam-native')[0].url
const cisURL = oracle('cis-native')[0].url
const firstURL = oracle('veeam-first-party')[0].url

const replay = (mutate = (_, html) => html) => {
  const requests = [], audits = []
  const response = async url => {
    requests.push(url)
    const page = originals.get(url)
    assert.ok(page, 'No fabricated endpoint in genuine replay: ' + url)
    const body = Buffer.from(page.bodyBase64, 'base64')
    assert.equal(sha(body), page.receipt.sha256)
    const changed = await mutate(url, body.toString('utf8'), requests.filter(value => value === url).length)
    if (changed === null) return { url, status: 503, headers: {}, bodyBase64: '' }
    return { url, status: page.receipt.status, headers: page.receipt.responseHeaders,
      bodyBase64: Buffer.from(changed).toString('base64') }
  }
  return { requests, audits, options: { now, fetchPage: response,
    fetchText: async url => Buffer.from((await response(url)).bodyBase64, 'base64').toString('utf8'),
    onAudit: async audit => audits.push(audit) } }
}

test('genuine CIS: all116 own native criteria, identifiers, typed countries and original day dates reach the registered factory', async () => {
  const r = replay(), jobs = await factory('cyberinfrastructure').run(r.options)
  assert.equal(jobs.length, 116)
  assert.equal(r.audits.length, 1)
  assert.equal(r.audits[0].observations.length, 116)
  for (const expected of oracle('cis-native')) {
    const job = jobs.find(value => value.sourceUrl === expected.url)
    assert.ok(job, expected.url)
    assert.deepEqual(job.sourceNativeJobPosting, expected.model)
    assert.equal(job.title, expected.model.title)
    assert.equal(job.jobId, expected.model.identifier.value)
    assert.equal(job.requisitionId, null)
    assert.equal(job.country, 'India');assert.equal(job.city, 'Indore')
    assert.equal(job.postingDate, expected.model.datePosted)
    assert.equal(job.closingDate, expected.model.validThrough)
    assert.equal(job.sourcePostingDatePrecision, 'day')
    assert.equal(job.sourceEmploymentType, 'FULL_TIME');assert.equal(job.employmentType, 'Full-time')
    assert.equal(job.remoteStatus, null)
    assert.ok(job.jobDescription.length >= expected.criteriaText.length)
    assert.ok(job.sourceNativeCriteria.educationRequirements)
    assert.ok(job.sourceNativeCriteria.responsibilities)
    const normalized = normalizeScrapedJob(job, { source: 'cyberinfrastructure', companyName: 'Cyber Infrastructure', countryFilter: 'India' })
    assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(normalized.sourceEmploymentType, 'FULL_TIME')
    assert.equal(normalized.remoteStatus, null)
    assert.equal(normalized.postedAt.toISOString().slice(0, 10), expected.model.datePosted)
  }
})

test('genuine Veeam:11 India candidates, all14 native observations, foreign recommendations excluded from India', async () => {
  const r = replay(), jobs = await factory('veeamindia').run(r.options)
  assert.equal(jobs.length, 11)
  assert.equal(r.audits.length, 1)
  const audit = r.audits[0]
  assert.equal(audit.observations.length, 14)
  assert.ok(audit.observations.every(job => job.sourceCurrentNativeRoleQualified), 'Both real advertised searches bind their own role URLs')
  assert.equal(audit.observations.filter(job => job.country === 'United States').length, 1)
  assert.equal(audit.observations.filter(job => job.country === 'Costa Rica').length, 2)
  assert.ok(r.requests.includes('https://careers.veeam.com/search-jobs/?orgIds=22681&alcpm=1269750'))
  assert.ok(!r.requests.includes(veeam.INDIA_JOBS_URL), 'Historical unadvertised seed is not current discovery')
  assert.ok(audit.opening.searches.some(search => search.reportedJobs === 11 && search.reportedContent === 8 && search.reportedResults === 19))
  for (const expected of oracle('veeam-native')) {
    const job = audit.observations.find(value => value.jobId === expected.jobId)
    assert.ok(job, expected.jobId)
    assert.equal(job.title, expected.title);assert.equal(job.company, 'Veeam Software')
    assert.equal(job.requisitionId, null)
    assert.equal(job.sourceNativeJobPost.job_post_location, expected.countryLabel)
    for (const [key, value] of Object.entries(expected.originalCriteria)) assert.equal(job.sourceNativeJobPost[key], value)
    assert.equal(job.sourceNativeCriteriaText, expected.criteriaText)
    assert.ok(job.jobDescription.includes(expected.criteriaText))
    assert.ok(job.jobDescription.includes(job.sourceFirstPartyDescription))
    assert.equal(job.postingDate, expected.publication)
    assert.equal(job.sourcePostingDatePrecision, 'offset-timestamp')
    assert.equal(job.sourceEmploymentType, 'hidden');assert.equal(job.employmentType, null)
    assert.ok(job.sourceFirstPartyJobPosting.identifier.value === expected.jobId)
    assert.ok(job.sourceFirstPartyJobId !== expected.jobId)
    assert.ok(job.sourceFirstPartyJobPosting.datePosted)
    assert.equal(job.sourceNativeJobPost.application_deadline, null)
    const normalized = normalizeScrapedJob(job, { source: 'veeamindia', companyName: 'Veeam India', countryFilter: 'India' })
    assert.equal(normalized.sourceDescription, job.jobDescription)
    assert.equal(normalized.postedAt.toISOString(), new Date(expected.publication).toISOString())
    assert.equal(normalized.sourceEmploymentType, 'hidden');assert.equal(normalized.employmentType, null)
  }
})

for (const source of ['cyberinfrastructure', 'veeamindia']) {
  test(source + ': no complete-inventory/zero/activation claim; maxJobs applies after full awaited audit', async () => {
    const r = replay();let sinkDone = false
    const jobs = await factory(source).run({ ...r.options, maxJobs: 0, onAudit: async audit => {
      await new Promise(resolve => setTimeout(resolve, 1));r.audits.push(audit);sinkDone = true
    } })
    assert.equal(sinkDone, true);assert.equal(jobs.length, 0)
    assert.equal(r.audits[0].observations.length, source === 'cyberinfrastructure' ? 116 : 14)
    const evidence = readInventoryEvidence(jobs)
    assert.equal(evidence.listingComplete, false);assert.equal(evidence.reportedTotal, null)
    assert.equal(evidence.indiaFacetCount, null);assert.notEqual(evidence.status, 'verified-empty')
    assert.equal(r.audits[0].sourceScopeComplete, false)
    assert.equal(r.audits[0].lifecycleCleanupAllowed, false)
  })
  test(source + ': audit rejection and cancellation propagate', async () => {
    const r = replay()
    await assert.rejects(factory(source).run({ ...r.options, onAudit: async () => { throw Error('sink failure') } }), /sink failure/)
    const controller = new AbortController();controller.abort(Error('cancelled by test'))
    await assert.rejects(factory(source).run({ ...r.options, signal: controller.signal }), /cancelled by test/)
  })
  test(source + ': artificial unavailable closing retains every earlier full observation as historical', async () => {
    const r = replay((url, html, visit) => url === primary[source] && visit === 2 ? null : html)
    await factory(source).run(r.options)
    assert.equal(r.audits[0].observations.length, source === 'cyberinfrastructure' ? 116 : 14)
    assert.ok(r.audits[0].observations.every(job => job.jobDescription && job.sourceCurrentNativeRoleQualified === false))
  })
  test(source + ': artificial unavailable opening recovers using closing discovery and fresh real role reads', async () => {
    const r = replay((url, html, visit) => url === primary[source] && visit === 1 ? null : html)
    const jobs = await factory(source).run(r.options)
    assert.equal(jobs.length, source === 'cyberinfrastructure' ? 116 : 11)
    assert.ok(r.audits[0].observations.every(job => job.sourceNativePhase === 'closing'))
  })
}

// All mutations below are artificial offline controls, never claimed as genuine HTTP.
for (const [name, mutate] of [
  ['company mismatch', html => html.replace('"company_name":"Veeam Software"', '"company_name":"Other Company"')],
  ['duplicate model', html => html.replace('</body>', '<script>window.__remixContext={};</script></body>')],
  ['nested mutation', html => html.replace('</body>', '<script>window.__remixContext.state={};</script></body>')],
  ['alias escape', html => html.replace('</body>', '<script>const alias=window.__remixContext;alias.state={};</script></body>')],
  ['Object.assign mutation', html => html.replace('</body>', '<script>Object.assign(window.__remixContext,{state:{}});</script></body>')],
  ['global alias', html => html.replace('</body>', '<script>const root=window;root.__remixContext={};</script></body>')],
]) test('Veeam artificial control holds ' + name, async () => {
  const r = replay((url, html) => url === nativeURL ? mutate(html) : html)
  const jobs = await factory('veeamindia').run(r.options)
  assert.equal(jobs.length, 10)
  const held = r.audits[0].observations.find(job => job.sourceUrl === firstURL)
  assert.ok(held);assert.equal(held.sourceCurrentNativeRoleQualified, false)
  assert.ok(held.sourceNativeIssues.length)
})

test('Veeam artificial country absence never uses city/search/region/application choices as India', async () => {
  const r = replay((url, html) => url === nativeURL ? html.replaceAll('Pune, India', 'Pune') : html)
  const jobs = await factory('veeamindia').run(r.options)
  const job = jobs.find(value => value.sourceUrl === firstURL)
  assert.ok(job);assert.equal(job.country, null);assert.equal(job.sourceCountryScopeUnresolved, true)
})

test('CIS artificial schema country absence never uses primary India section or own city as country', async () => {
  const r = replay((url, html) => url === cisURL ? html.replace('"addressCountry":"IN"', '"addressCountry":""') : html)
  const jobs = await factory('cyberinfrastructure').run(r.options)
  const job = jobs.find(value => value.sourceUrl === cisURL)
  assert.ok(job);assert.equal(job.country, null);assert.equal(job.sourceCountryScopeUnresolved, true)
})

test('CIS artificial duplicate decoded model key is held, not silently last-wins', async () => {
  const r = replay((url, html) => url === cisURL ? html.replace('"employmentType":"FULL_TIME"', '"employmentType":"FULL_TIME","employmentType":"PART_TIME"') : html)
  const jobs = await factory('cyberinfrastructure').run(r.options)
  assert.equal(jobs.length, 115)
  assert.ok(r.audits[0].observations.find(job => job.sourceUrl === cisURL).sourceNativeIssues.length)
})

test('genuine CIS preserves labelled facts and both the structured experience and literal visible range', async () => {
  const r = replay(), jobs = await factory('cyberinfrastructure').run(r.options)
  for (const expected of oracle('cis-native')) {
    const job = jobs.find(value => value.sourceUrl === expected.url)
    assert.deepEqual(job.sourceNativeExperienceRequirements, expected.model.experienceRequirements)
    assert.ok(job.sourceNativeRoleFacts.Experience)
    assert.equal(job.sourceExperienceRequired, job.sourceNativeRoleFacts.Experience)
    assert.ok(job.jobDescription.includes(job.sourceNativeRoleFacts.Experience))
    assert.ok(job.sourceNativeRoleFacts['Republished'] || job.sourceNativeRoleFacts['Originally posted'])
  }
})

test('CIS artificial same-role native country contradiction retains original criteria but blocks India projection', async () => {
  const r = replay((url, html) => url === cisURL ? html.replace('"addressCountry":"IN"', '"addressCountry":"US"') : html)
  const jobs = await factory('cyberinfrastructure').run(r.options)
  assert.equal(jobs.length, 115)
  const job = r.audits[0].observations.find(value => value.sourceUrl === cisURL)
  assert.equal(job.country, null);assert.equal(job.sourceNativeCountryConflict, true)
  assert.equal(job.sourceNativeJobPosting.jobLocation.address.addressCountry, 'US')
  assert.ok(job.jobDescription)
})

test('Veeam artificial typed firstparty/native country contradiction blocks India projection', async () => {
  const r = replay((url, html) => url === nativeURL ? html.replaceAll('Pune, India', 'Pune, USA')
    : url === firstURL ? html.replace(/("addressCountry"\s*:\s*)""/, '$1"IN"') : html)
  const jobs = await factory('veeamindia').run(r.options)
  assert.equal(jobs.length, 10)
  const job = r.audits[0].observations.find(value => value.sourceUrl === firstURL)
  assert.equal(job.country, null);assert.equal(job.sourceNativeCountryConflict, true)
})

test('genuine fixture remains original HTTP; terminal strings, inert scripts and encoded literal brackets do not become code or markup', async () => {
  for (const page of fixture.pages) assert.equal(sha(Buffer.from(page.bodyBase64, 'base64')), page.receipt.sha256)
  const r = replay((url, html) => url === nativeURL ? html.replace('</body>', '<template><script>window.__remixContext={};</script></template><script type="application/json">"window.__remixContext={}"</script><script>const example="window.__remixContext = {}";</script></body>') : html)
  const jobs = await factory('veeamindia').run(r.options)
  assert.equal(jobs.length, 11)
})
