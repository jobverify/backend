import assert from 'node:assert/strict'
import test, { beforeEach } from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const C = 'https://classplusapp.com/careers/open-role'
const A = 'https://crm.classplus.co/ts/jobs/get-job-list?'
const D = 'https://crm.classplus.co/ts/jobs/get-job-description?jobId='
const html = '<title>Classplus careers</title><div id="root"></div><script>var r="/careers/",h={4:"aaa111",5:"bbb222"};function u(e){return r+"static/js/"+e+"."+h[e]+".chunk.js"}</script><script src="/careers/static/js/main.123abc.chunk.js"></script>'
const main = 'var ue=Object(s.lazy)(function(){return a.e(4).then(a.bind(null,326))}),be=Object(s.lazy)(function(){return a.e(5).then(a.bind(null,330))});var routes=[{component:ue,path:"/open-role"},{component:be,path:"/job-description"}];'
const listBundle = '(this.webpackJsonpclassplusCareers=this.webpackJsonpclassplusCareers||[]).push([[4],{326:function(e,t,a){var L=a(26),w=a.n(L);function get(){var c="https://crm.classplus.co/ts/jobs/get-job-list?".concat("");return w.a.get(c)}var visible=rows.filter(function(e){return "VIDU"!==e.department});var f=["department=","&location=","&employmentType="];var jobs=data.Jobs;}}]);'
const detailBundle = '(this.webpackJsonpclassplusCareers=this.webpackJsonpclassplusCareers||[]).push([[5],{330:function(e,t,n){var l=n(26),d=n.n(l);function get(t){return d.a.get("https://crm.classplus.co/ts/jobs/get-job-description?jobId=".concat(t))}function apply(){window.open(s.JobDescription.jobLink,"_blank")}var desc={__html:v(s.JobDescription.jobDescription)},v=function(e){var t=document.createElement("div");return t.innerHTML=e,t.childNodes[0].nodeValue};var fields=[s.JobDescription.designation,s.JobDescription.locationCity,s.JobDescription.employeeType];}}]);'
const row = (id = 'cp-1') => ({ jobId: id, title: 'Backend Engineer', department: 'Engineering', parentDepartment: 'Engineering Team', locationCity: 'Noida', employeeType: 'Full Time' })
const detail = (id = 'cp-1') => ({ data: { JobDescription: { ...row(id), designation: 'Backend Engineer', locationCountry: 'India', jobLink: 'https://classplusapp.com/careers/apply?jobId=' + id,
  jobDescription: '&lt;h2&gt;Responsibilities&lt;/h2&gt;&lt;p&gt;Build the complete reliable backend platform, own production systems and collaborate with product teams.&lt;/p&gt;&lt;h2&gt;Requirements&lt;/h2&gt;&lt;p&gt;Strong JavaScript, SQL, testing and distributed systems experience.&lt;/p&gt;',
  experienceFrom: 0, experienceTo: 3 } }, message: 'Job Description Fetched Successfully' })
const native = ({ rows = [row()], closing = rows, mutateDetail = () => {}, mutatePage = (_url, body) => body, failAt, maxJobs } = {}) => {
  let listingCalls = 0
  const calls = []
  return { calls, settings: { now: () => '2026-10-27T09:00:00.000Z', ...(maxJobs === undefined ? {} : { maxJobs }), onNativeAudit: value => { calls.audit = value },
    fetchPage: async url => {
      calls.push(url)
      if (url === failAt) return { url, status: 403, body: 'restricted' }
      let body
      if (url === C) body = html
      else if (url.endsWith('main.123abc.chunk.js')) body = main
      else if (url.endsWith('4.aaa111.chunk.js')) body = listBundle
      else if (url.endsWith('5.bbb222.chunk.js')) body = detailBundle
      else if (url === A) body = JSON.stringify({ data: { Jobs: listingCalls++ ? closing : rows }, message: 'Jobs Fetched Successfully' })
      else if (url.startsWith(D)) { const payload = detail(decodeURIComponent(url.slice(D.length))); mutateDetail(payload); body = JSON.stringify(payload) }
      else throw Error('Unexpected public request ' + url)
      return { url, status: 200, body: mutatePage(url, body) }
    } } }
}
const registered = settings => createCatalogScraper(getScraperCatalog().find(p => p.source === 'classplus')).run(settings)
beforeEach(t => t.mock.method(globalThis, 'fetch', async () => { throw Error('Unexpected live network') }))

test('Classplus reads current client contracts before API and preserves complete full native detail', async t => {
  t.mock.method(globalThis, 'fetch', async () => { throw Error('Unexpected live network') })
  const fixture = native(), jobs = await registered(fixture.settings)
  assert.equal(jobs.length, 1)
  const job = jobs[0]
  assert.equal(job.title, 'Backend Engineer')
  assert.equal(job.company, 'Classplus')
  assert.equal(job.country, 'India')
  assert.equal(job.requisitionId, null)
  assert.equal(job.remoteStatus, null)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourcePublicationDateUnavailable, true)
  assert.equal(job.jobDescription, 'Responsibilities Build the complete reliable backend platform, own production systems and collaborate with product teams. Requirements Strong JavaScript, SQL, testing and distributed systems experience.')
  assert.equal(job.sourceDescription, job.jobDescription)
  assert.equal(job.experienceRequired, '0-3 years')
  assert.equal(job.applyUrl, 'https://classplusapp.com/careers/apply?jobId=cp-1')
  assert.equal(job.sourceDetailComplete, true)
  assert.equal(fixture.calls.audit.nativeListingComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(fixture.calls.indexOf(A), 4)
  assert.equal(fixture.calls.at(-1), A)
})

test('Classplus stable native zero requires two complete list reads and current binding', async () => {
  const fixture = native({ rows: [] }), jobs = await registered(fixture.settings)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).status, 'discovery-only')
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(fixture.calls.audit.nativeListingComplete, true)
  assert.equal(readInventoryEvidence(jobs).pagesFetched, 2)
  assert.equal(fixture.calls.audit.nativeGlobalCount, 0)
  assert.equal(fixture.calls.audit.unknownCountryCount, 0)
})

test('Classplus cannot infer India from Noida or a global Remote label', async () => {
  const fixture = native({ mutateDetail: p => { delete p.data.JobDescription.locationCountry } })
  const jobs = await registered(fixture.settings)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(fixture.calls.audit.unknownCountryCount, 1)
})

test('Classplus explicit foreign country overrides an India city hint', async () => {
  const fixture = native({ mutateDetail: p => { p.data.JobDescription.locationCountry = 'United Arab Emirates' } })
  const jobs = await registered(fixture.settings)
  assert.equal(jobs.length, 0)
  assert.equal(fixture.calls.audit.nativeListingComplete, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  assert.equal(fixture.calls.audit.foreignCountryCount, 1)
})

for (const [name, mutateDetail] of [
  ['foreign employer', p => { p.data.JobDescription.company = 'Another Company' }],
  ['mismatched role', p => { p.data.JobDescription.jobId = 'other' }],
  ['mismatched title', p => { p.data.JobDescription.designation = 'Another Engineer' }],
  ['hidden full description', p => { p.data.JobDescription.jobDescription = '&lt;div hidden&gt;Full invisible employer job text&lt;/div&gt;' }],
  ['missing apply context', p => { delete p.data.JobDescription.jobLink }],
  ['generic apply context', p => { p.data.JobDescription.jobLink = 'https://classplusapp.com/' }],
  ['unpublished role', p => { p.data.JobDescription.isPublished = false }],
  ['expired role', p => { p.data.JobDescription.validThrough = '2026-10-26T23:59:59Z' }],
]) test('Classplus withholds ' + name + ' and protects cleanup', async () => {
  const jobs = await registered(native({ mutateDetail }).settings)
  assert.equal(jobs.length, 0)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Classplus does not silently exclude VIDU as a department or invent its employer hierarchy', async () => {
  const fixture = native({ rows: [{ ...row(), department: 'VIDU' }], mutateDetail: p => { p.data.JobDescription.department = 'VIDU' } })
  const jobs = await registered(fixture.settings)
  assert.ok(fixture.calls.includes(D + 'cp-1'))
  assert.equal(jobs.length, 0)
  assert.equal(fixture.calls.audit.clientExcludedEmployerUnknownCount, 1)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
})

test('Classplus changed closing inventory and output caps protect verified rows from cleanup', async () => {
  for (const config of [{ closing: [] }, { maxJobs: 0 }]) {
    const jobs = await registered(native(config).settings)
    assert.equal(readInventoryEvidence(jobs).listingComplete, false)
    assert.ok(jobs.every(j => j.lifecycleCleanupAllowed === false))
  }
})

test('Classplus fails before API when current executable contract is missing or comments only', async () => {
  const fixture = native({ mutatePage: (url, body) => url.endsWith('4.aaa111.chunk.js') ? '/*' + body + '*/' : body })
  await assert.rejects(registered(fixture.settings), /contract/i)
  assert.ok(!fixture.calls.includes(A))
})

test('Classplus current bundled axios binding survives unrelated nested variable shadowing', async () => {
  const fixture = native({ mutatePage: (url, body) => url.endsWith('4.aaa111.chunk.js')
    ? body.replace('function get(){', 'function nested(){var L=123}function get(){') : body })
  const jobs = await registered(fixture.settings)
  assert.equal(jobs.length, 1)
})

test('Classplus stops on first actual public 403 without retries or a closing read', async () => {
  const fixture = native({ failAt: D + 'cp-1' })
  await assert.rejects(registered(fixture.settings), /403/)
  assert.equal(fixture.calls.filter(url => url === D + 'cp-1').length, 1)
  assert.equal(fixture.calls.filter(url => url === A).length, 1)
})

test('Classplus rejects malformed inventory rather than treating it as empty', async () => {
  await assert.rejects(registered(native({ mutatePage: (url, body) => url === A ? '{"data":{}}' : body }).settings))
})

test('Classplus cancellation stops before any request', async () => {
  const fixture = native()
  await assert.rejects(registered({ ...fixture.settings, signal: AbortSignal.abort() }))
  assert.equal(fixture.calls.length, 0)
})

for (const [label, injected] of [
  ['unquoted opacity zero', '<div style=opacity:0>Hidden mandatory SQL qualification</div>'],
  ['commented opacity zero', '<div style="op/*x*/acity:0">Hidden mandatory SQL qualification</div>'],
  ['entity encoded opacity zero', '<div style="o&#112;acity&#58;0">Hidden mandatory SQL qualification</div>'],
  ['multiple digit opacity zero', '<p style="opacity:00">Hidden mandatory SQL qualification</p>'],
  ['signed opacity zero', '<p style="opacity:+0">Hidden mandatory SQL qualification</p>'],
  ['exponent opacity zero', '<p style="opacity:0e0">Hidden mandatory SQL qualification</p>'],
  ['exponent percentage opacity zero', '<p style="opacity:-0E+2% !important">Hidden mandatory SQL qualification</p>'],
  ['unrecognized opacity expression', '<p style="opacity:calc(0)">Hidden mandatory SQL qualification</p>'],
  ['transparent text color', '<p style="color:transparent">Hidden mandatory SQL qualification</p>'],
  ['offscreen layout', '<p style="position:absolute;left:-10000px">Hidden mandatory SQL qualification</p>'],
  ['nonrendering title criteria', '<title>Hidden mandatory SQL qualification</title>'],
]) test('Classplus full factory withholds ' + label + ' while retaining a visible control', async () => {
  const fixture = native({ rows: [row(), row('cp-2')], mutateDetail: p => {
    p.data.JobDescription.jobDescription += p.data.JobDescription.jobId === 'cp-2' ? injected : '<p style="opacity:1">Visible mandatory SQL qualification</p>'
  } })
  const jobs = await registered(fixture.settings)
  assert.deepEqual(jobs.map(j => j.jobId), ['cp-1'])
  assert.match(jobs[0].sourceDescription, /Visible mandatory SQL qualification/)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(fixture.calls.audit.fullDetailCount, 1)
  assert.equal(fixture.calls.audit.nativeListingComplete, false)
})

for (const field of ['minimumQualification', 'preferredQualification', 'requiredSkills', 'education', 'responsibilities']) {
  test('Classplus does not silently drop structured native ' + field + ' outside the proven rendering', async () => {
    const fixture = native({ mutateDetail: p => { p.data.JobDescription[field] = field === 'requiredSkills' ? ['SQL'] : 'Required SQL expertise' } })
    const jobs = await registered(fixture.settings)
    assert.equal(jobs.length, 0)
    assert.equal(fixture.calls.audit.fullDetailCount, 0)
    assert.ok(fixture.calls.audit.reasons.some(reason => reason.startsWith('native-additional-criteria-presentation-unresolved:')))
  })
}

test('Classplus publication and optional expiry preserve original date semantics', async () => {
  const fixture = native({ mutateDetail: p => {
    Object.assign(p.data.JobDescription, { datePosted: '2026-10-01T09:00:00Z', validThrough: '2026-12-01T10:00:00Z', postingDate: '2026-10-26', updatedAt: '2026-10-26T08:00:00Z', createdAt: '2020-01-01T00:00:00Z' })
  } })
  const jobs = await registered(fixture.settings)
  assert.equal(jobs[0].postingDate, '2026-10-01T09:00:00.000Z')
  assert.equal(jobs[0].closingDate, '2026-12-01T10:00:00.000Z')
  assert.equal(jobs[0].sourceNativeDates.ambiguousPostingDate, '2026-10-26')
})
