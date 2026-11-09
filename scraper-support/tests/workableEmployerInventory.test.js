import {createEmployerBoundWorkableScraper} from '../utils/workableEmployerInventory.js'
import {replay as originalReplay} from '../native-sources/publicWorkableSources/fixtureReplay.js'
import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'

const specs = [
  { source: 'bharatx', company: 'BharatX', tenant: 'bharatx', uid: 'db2cc781-d7bb-431d-ba2d-62a131069447', careers: 'https://bharatx.tech/careers/', domain: 'bharatx.tech' },
  { source: 'seeq', company: 'Seeq', tenant: 'seeq', uid: '55c96070-dc05-4efb-baf3-3a71fbc4e6ee', careers: 'https://www.seeq.com/careers/', domain: 'seeq.com' },
  { source: 'huggingface', company: 'Hugging Face', tenant: 'huggingface', uid: '940cf17f-c078-40ac-95e8-07704e754048', careers: 'https://huggingface.co/', domain: 'huggingface.co' },
]
const india = { city: 'Bengaluru', region: 'Karnataka', country: 'India', countryCode: 'IN', hidden: false }
const foreign = { city: 'New York', region: 'New York', country: 'United States', countryCode: 'US', hidden: false }
const fixture = (spec = specs[0]) => {
  const record = { id: 1001, shortcode: 'NATIVE1001', title: 'Platform Engineer', accountUid: spec.uid,
    state: 'published', isInternal: false, approvalStatus: 'approved', location: { ...india }, locations: [{ ...india }],
    published: '2026-10-24T00:00:00.000Z', workplace: 'hybrid', remote: false }
  return { spec, homepage: `<title>${spec.company} Careers</title><a href="https://apply.workable.com/${spec.tenant}/?lng=en">Careers</a>`,
    finalUrl: spec.careers, account: { id: 100, uid: spec.uid, subdomain: spec.tenant, name: spec.company, url: `https://${spec.domain}/` },
    pages: [{ total: 1, results: [record] }], details: { NATIVE1001: { ...structuredClone(record),
      description: '<p>Build reliable distributed systems for employer products.</p>', requirements: '<p>Strong JavaScript and database experience.</p>', benefits: '<p>Flexible leave and learning support.</p>' } } }
}
const options = data => {
  const calls = []
  return { calls, now: () => '2026-10-26T09:00:00.000Z',
    fetchText: async () => { throw new Error('Legacy markdown runtime called instead of native full inventory') },
    fetchPage: async (url, init = {}) => {
      calls.push(url); assert.equal(url, data.spec.careers); init.signal?.throwIfAborted()
      return { status: 200, url: data.finalUrl, html: data.homepage }
    },
    fetchJson: async (url, init = {}) => {
      calls.push(url); init.signal?.throwIfAborted()
      const prefix = `https://apply.workable.com/api/`
      if (url === `${prefix}v1/accounts/${data.spec.tenant}`) return data.account
      if (url === `${prefix}v3/accounts/${data.spec.tenant}/jobs`) {
        assert.equal(init.method, 'POST')
        const body = JSON.parse(init.body)
        assert.deepEqual({ ...body, token: undefined }, { query: '', location: [], department: [], worktype: [], remote: [], token: undefined })
        const index = body.token === undefined ? 0 : data.pages.findIndex(page => page.nextPage === body.token) + 1
        assert.ok(data.pages[index], 'Unexpected listing cursor')
        return data.pages[index]
      }
      assert.ok(url.startsWith(`${prefix}v2/accounts/${data.spec.tenant}/jobs/`))
      const detail = data.details[url.split('/').at(-1)]
      assert.ok(detail, 'Unexpected native detail')
      return detail
    } }
}
const legacy=spec=>createEmployerBoundWorkableScraper({source:spec.source,company:spec.company,tenant:spec.tenant,accountUid:spec.uid,careersUrl:spec.careers,companyDomain:spec.domain,canonicalCareersUrls:spec.source==='seeq'?['https://www.seeq.com/company/careers/']:[]})
const run = async (data, overrides = {}) => {
  const module = data.spec.source==='bharatx'?await import(`../../scraper/${data.spec.source}/script.js`):legacy(data.spec)
  return module.run({ ...options(data), ...overrides })
}

test('stylesheet-hidden additional careers routes retain unresolved inventory scope', async () => {
  const data = fixture()
  data.homepage += '<style>.other-recruiting{display:none}</style><a class="other-recruiting" href="https://recruit.example/careers">Careers</a>'
  const jobs = await run(data)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.match(readInventoryEvidence(jobs).reason, /additional-employer-recruiting-scope-unresolved/)
})

for (const spec of specs) test(`${spec.company} legacy shared engine keeps its employer-bound cursor/detail contract`, async () => {
  const data = fixture(spec), opts = options(data)
  const module = spec.source==='bharatx'?await import(`../../scraper/${spec.source}/script.js`):legacy(spec)
  const jobs = await module.run(opts)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].company, spec.company)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].postingDate, data.details.NATIVE1001.published)
  assert.match(jobs[0].jobDescription, /distributed systems[\s\S]*Requirements[\s\S]*database experience[\s\S]*Benefits[\s\S]*learning support/)
  assert.equal(jobs[0].applyUrl, `https://apply.workable.com/${spec.tenant}/j/NATIVE1001/apply/`)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, 1)
  const snapshotCalls = [spec.careers, `https://apply.workable.com/api/v1/accounts/${spec.tenant}`,
    `https://apply.workable.com/api/v3/accounts/${spec.tenant}/jobs`, `https://apply.workable.com/api/v2/accounts/${spec.tenant}/jobs/NATIVE1001`]
  assert.deepEqual(opts.calls, spec.source === 'bharatx' ? [...snapshotCalls, ...snapshotCalls] : snapshotCalls)
})

test('a current employer-bound exact empty native inventory is verified empty', async () => {
  const data = fixture(); data.pages = [{ total: 0, results: [] }]
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 0)
})
test('all cursor pages are read and foreign roles remain excluded', async () => {
  const data = fixture(), row = structuredClone(data.pages[0].results[0])
  Object.assign(row, { id: 1002, shortcode: 'FOREIGN1002', location: { ...foreign }, locations: [{ ...foreign }] })
  data.pages = [{ total: 2, results: [row], nextPage: 'next-native-page' }, { total: 2, results: data.pages[0].results }]
  const jobs = await run(data)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})
for (const [label, mutate] of [
  ['foreign account UID', d => { d.account.uid = 'foreign' }],
  ['foreign company', d => { d.account.name = 'Other Employer' }],
  ['foreign reciprocal domain', d => { d.account.url = 'https://other.example/' }],
  ['foreign reciprocal tenant', d => { d.account.subdomain = 'other' }],
  ['foreign employer redirect', d => { d.finalUrl = 'https://other.example/careers/' }],
  ['query-based employer redirect', d => { d.finalUrl += '?redirect=other' }],
  ['comment-only careers link', d => { d.homepage = `<!--${d.homepage}-->` }],
  ['hidden careers link', d => { d.homepage = `<div hidden>${d.homepage}</div>` }],
  ['script-string careers link', d => { d.homepage = `<script>const example=${JSON.stringify(d.homepage)}</script>` }],
  ['truncated terminal page', d => { d.pages[0].total = 2 }],
  ['foreign role account', d => { d.pages[0].results[0].accountUid = 'foreign' }],
  ['missing complete description', d => { d.details.NATIVE1001.description = '<script>example description</script>' }],
]) test(`fails closed for ${label}`, async () => {
  const data = fixture(); mutate(data)
  await assert.rejects(run(data))
})
test('hidden foreign location leaves India scope unknown while preserving valid India jobs', async () => {
  const data = fixture(), row = structuredClone(data.pages[0].results[0])
  Object.assign(row, { id: 1002, shortcode: 'FOREIGN1002', location: { ...foreign }, locations: [{ ...foreign, hidden: true }] })
  data.pages[0].results.push(row); data.pages[0].total++
  const jobs = await run(data)
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
test('hidden India locations cannot produce an India vacancy', async () => {
  const data = fixture(); data.pages[0].results[0].locations[0].hidden = true; data.details.NATIVE1001.locations[0].hidden = true
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
for (const href of ['https://apply.workable.com/other/', 'https://other.wd5.myworkdayjobs.com/careers', 'https://recruit.example/openings']) {
  test(`an additional recruiting surface stays unresolved: ${href}`, async () => {
    const data = fixture(); data.homepage += `<a href="${href}">Apply for open roles</a>`
    const jobs = await run(data)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  })
}
test('an advertised native role absent from the listing keeps the result partial', async () => {
  const data = fixture(); data.homepage += '<a href="https://apply.workable.com/bharatx/j/MISSING123/">Platform Engineer</a>'
  assert.equal(readInventoryEvidence(await run(data)).listingComplete, false)
})
test('Seeq permits its current canonical careers redirect', async () => {
  const data = fixture(specs[1]); data.finalUrl = 'https://www.seeq.com/company/careers/'
  assert.equal(readInventoryEvidence(await run(data)).listingComplete, true)
})
test('abort never returns verified-empty evidence', async () => {
  const data = fixture(); await assert.rejects(run(data, { signal: AbortSignal.abort() }))
})
test('registered Hugging Face execution uses the opt-in original GET reader',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='huggingface'),r=originalReplay()
 assert.equal(provider.atsPlatform,'workable-public-get');assert.equal(provider.backfillMode,'discovery-only')
 const jobs=await createCatalogScraper(provider).run(r.options)
 assert.equal(jobs.length,3);assert.equal(r.audits[0].observations.length,6);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('an active additional Ashby embed prevents a complete empty result', async () => {
  const data = fixture(); data.pages = [{ total: 0, results: [] }]
  data.homepage += '<script src="https://jobs.ashbyhq.com/another-employer/embed"></script>'
  const jobs = await run(data)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('a hidden primary India location cannot be overridden by a visible plural entry', async () => {
  const data = fixture()
  data.pages[0].results[0].location.hidden = true; data.details.NATIVE1001.location.hidden = true
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})
test('hidden-only native detail descriptions fail closed', async () => {
  const data = fixture(); data.details.NATIVE1001.description = '<div hidden>Build employer products.</div>'
  await assert.rejects(run(data), /description/i)
})
test('BharatX output limits preserve observed native totals while keeping full-source facets and cleanup incomplete', async () => {
  const data = fixture(), row = structuredClone(data.pages[0].results[0])
  Object.assign(row, { id: 1002, shortcode: 'NATIVE1002' })
  data.pages[0].results.push(row); data.pages[0].total++
  data.details.NATIVE1002 = { ...structuredClone(data.details.NATIVE1001), ...row }
  const jobs = await run(data, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal, 2)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /source-job-limit/)
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
})
test('limits are applied after unsafe hidden India roles are excluded', async () => {
  const data = fixture(), row = structuredClone(data.pages[0].results[0])
  Object.assign(row, { id: 1002, shortcode: 'NATIVE1002' })
  data.pages[0].results.push(row); data.pages[0].total++
  data.details.NATIVE1002 = { ...structuredClone(data.details.NATIVE1001), ...row }
  data.pages[0].results[0].locations[0].hidden = true; data.details.NATIVE1001.locations[0].hidden = true
  const jobs = await run(data, { maxJobs: 1 })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'NATIVE1002')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
})
test('single-snapshot mapping omits hidden prose while visible employer sections and literal angle brackets survive', async () => {
  const data = fixture(specs[1])
  data.details.NATIVE1001.description = '<p>Build systems with O(n &lt; 10) performance.</p><div hidden>Do not display private draft prose.</div>'
  data.details.NATIVE1001.requirements = '<div style="display:none">Hidden draft requirements</div>'
  const jobs = await run(data)
  assert.match(jobs[0].jobDescription, /O\(n < 10\)/)
  assert.doesNotMatch(jobs[0].jobDescription, /private draft|Hidden draft/)
})

test('BharatX closing proof keeps descriptions with hidden draft criteria incomplete without rewriting native content', async () => {
  const data = fixture()
  const description = '<p>Build systems with O(n &lt; 10) performance.</p><div hidden>Do not display private draft prose.</div>'
  data.details.NATIVE1001.description = description
  data.details.NATIVE1001.requirements = '<div style="display:none">Hidden draft requirements</div>'
  const jobs = await run(data)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount, null)
  assert.match(readInventoryEvidence(jobs).reason, /visible-full-native-description-unavailable:NATIVE1001/)
  assert.equal(data.details.NATIVE1001.description, description)
})
test('a script URL pointing to an HTML board cannot establish an employer handoff', async () => {
  const data = fixture(); data.homepage = '<script src="https://apply.workable.com/bharatx/"></script>'
  await assert.rejects(run(data), /handoff/i)
})
test('an HTTP 200 account error cannot certify an empty native inventory', async () => {
  const data = fixture(); data.account.error = 'Service unavailable'; data.pages = [{ total: 0, results: [] }]
  await assert.rejects(run(data), /account/i)
})
