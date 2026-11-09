import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE network tripwire') }
const { getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')
const { readInventoryEvidence } = await import('../utils/inventoryEvidence.js')
const { extractNativeJob } = await import('../../scraper/keiindustries/script.js')
const { visibleText, visibleDocument } = await import('../../scraper/keiindustries/nativeVisibility.js')
const registered = () => createCatalogScraper(getScraperCatalog().find(p => p.source === 'keiindustries'))
const portal = 'https://keihrms.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab'
const secondary = 'https://maxhr.myadrenalin.com/CandidateMAX/#/?CompanyID=KEIIND#new_tab'
const home = extra => `<title>KEI Industries</title><a href="${portal}">Current Job Openings</a>${extra ? `<a href="${secondary}">Apply Now!</a>` : ''}<a href="https://www.kei-ind.com/career-at-kei/life-at-kei/">Life at KEI</a>`
const script = 'getVacancyInformation(e){return this.http.post(this.AUTH_API+"CPVacancyDetails/GetVacancyInformationWithoutToken",{CompanyID:this.appConfig.CompanyID,Flag:e},this.getHeader())} getLandingPageData(){return this.http.post(this.AUTH_API+"CPLandigPage/GetLandingPage",{CompanyID:this.appConfig.CompanyID},this.getHeader())} getLabelData(){return this.http.post(this.AUTH_API+"CPCommon/GetLabelWithoutToken",{CompanyID:this.appConfig.CompanyID,FormModuleCode:["CAND_JOSK_00_28,CAND_GENR_00_00","CAND_VACY_00_24"]},this.getHeader())} this.gridData=e.Data[0].VacancyInformation;refreshPagedData(){this.pagedData.push(this.filteredData[e])} selectedJobDetail.FUNCTION_DESC;selectedJobDetail.FUNCTION_RESPONSIBILITY; r.includes("~D"); assets/company/ /config.json'
const record = (id, country = 'India') => ({ JOB_REQUEST_CODE: id, FUNCTION_NAME: 'Native Engineer', LOCATION_NAME: 'Chennai', COUNTRY_NAME: country, EXPERIENCE: '5 years', POSTED_ON: '2026-10-25T09:00:00+05:30', FUNCTION_DESC: '<p>Build reliable systems &amp; tooling.</p><div><p>Full nested criterion.</p></div><p>Literal &amp;lt;example&amp;gt;.</p><span hidden>Hidden requirement</span>', FUNCTION_RESPONSIBILITY: '<ul><li>Own production recovery.</li></ul>', 'CAND_VACY_lblQual~D': 'BTech', 'CAND_VACY_lblSal~D': 'As disclosed', 'CAND_VACY_lblSkill~D': 'Node.js', 'CAND_VACY_lblLoc~D': 'Chennai' })
const fixture = ({ records = [record('KEI-101')], extra = false, secondaryValid = false, changed = false, deny = false, gate = false } = {}) => {
  const requests = []; let feedReads = 0
  const fetchPage = async (url, init = {}) => {
    requests.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null })
    if (deny) return { url, status: 429, body: 'Rate limited' }
    if (gate) return { url, status: 200, body: '<title>Attention Required! | Cloudflare</title>' }
    let body, contentType = 'text/html'
    if (url === 'https://www.kei-ind.com/' || url === 'https://www.kei-ind.com/career-at-kei/life-at-kei/') body = home(extra)
    else if (url === 'https://www.kei-ind.com/jobs/') body = 'Home / Job Job Archives'
    else if (url.endsWith('/CandidateMAX/')) body = '<title>Candidate Portal</title><script src="main.fixture.js"></script>'
    else if (url.endsWith('main.fixture.js')) { body = script; contentType = 'application/javascript' }
    else if (url.endsWith('/config.json')) { body = JSON.stringify({ apiURL: new URL(url).origin, apiPath: '/CandidateMAX/', CompanyTitle: 'Candidate Portal' }); contentType = 'application/json' }
    else if (!secondaryValid && url.includes('maxhr.myadrenalin.com') && url.endsWith('/GetLandingPage')) { body = JSON.stringify({ IsValid: false, Data: [], ErrorMessage: 'E001171' }); contentType = 'application/json' }
    else if (url.endsWith('/GetLandingPage')) { body = JSON.stringify({ IsValid: true, Data: [{ CompanyDetails: [{ LINK_NAME: 'KEI INDUSTRIES LTD', LINK_ADDRESS: 'https://www.kei-ind.com/' }] }] }); contentType = 'application/json' }
    else if (url.endsWith('/GetLabelWithoutToken')) { body = JSON.stringify({ IsValid: true, Data: [{ CAND_VACY_lblJbDes: 'Job description~E', CAND_VACY_lblRolRes: 'Roles & responsibilities~E', CAND_VACY_lblQual: 'Qualification~E', CAND_VACY_lblSal: 'Salary~E', CAND_VACY_lblSkill: 'Skills~E', CAND_VACY_lblLoc: 'Location~E' }] }); contentType = 'application/json' }
    else if (url.endsWith('/GetVacancyInformationWithoutToken')) { feedReads++; body = JSON.stringify({ IsValid: true, Data: [{ VacancyInformation: changed && feedReads > 1 ? records.map(r => ({ ...r, FUNCTION_RESPONSIBILITY: '<p>Changed responsibilities</p>' })) : records }] }); contentType = 'application/json' }
    else throw new Error('Unexpected offline route ' + url)
    return { url, status: 200, body, html: body, contentType }
  }
  return { fetchPage, requests }
}

test('KEI registered scraper reads complete public native records and all dynamic criteria', async () => {
  const f = fixture(), jobs = await registered().run({ fetchPage: f.fetchPage, now: () => '2026-10-27T00:00:00Z' })
  assert.equal(jobs.length, 1)
  const [job] = jobs
  assert.equal(job.jobId, 'KEI-101')
  assert.equal(job.requisitionId, null)
  assert.equal(job.country, 'India')
  assert.equal(job.remoteStatus, null)
  assert.equal(job.postingDate, '2026-10-25T09:00:00+05:30')
  assert.equal(job.minimumQualification, 'BTech')
  assert.equal(job.compensation, 'As disclosed')
  assert.deepEqual(job.requiredSkills, ['Node.js'])
  assert.equal(job.sourceDetailComplete, true)
  assert.match(job.jobDescription, /Full nested criterion\./)
  assert.match(job.jobDescription, /Own production recovery\./)
  assert.match(job.jobDescription, /literal &lt;example&gt;/i)
  assert.match(job.jobDescription, /Salary: As disclosed/)
  assert.doesNotMatch(job.jobDescription, /Hidden requirement/)
  assert.equal(job.applyUrl, portal)
  assert.equal(job.applicationPostingContext.nativePostingId, 'KEI-101')
  assert.equal(f.requests.some(r => r.url === 'https://www.kei-ind.com/jobs/'), false)
  assert.ok(f.requests.filter(r => r.method === 'POST').every(r => !Object.hasOwn(r.body, 'Token')))
})

test('KEI does not infer country from city, default dates, or promote a preview to full criteria', async () => {
  const r = record('KEI-102', null); r.POSTED_ON = null; r.FUNCTION_RESPONSIBILITY = null
  const f = fixture({ records: [r] }); let audit
  const jobs = await registered().run({ fetchPage: f.fetchPage, onAudit: v => { audit = v } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.nativeJobs[0].country, null)
  assert.equal(audit.nativeJobs[0].postingDate, null)
  assert.equal(audit.nativeJobs[0].sourceDetailComplete, false)
  assert.equal(audit.scopeComplete, false)
})

test('KEI reconciles every record and closing metadata before applying an output cap', async () => {
  const f = fixture({ records: [record('KEI-101'), record('KEI-102')] }); let audit
  const jobs = await registered().run({ fetchPage: f.fetchPage, maxJobs: 1, onAudit: v => { audit = v } })
  assert.equal(jobs.length, 1)
  assert.equal(audit.observedGlobalCount, 2)
  assert.equal(audit.closingReconciled, true)
  assert.equal(audit.outputCapped, true)
  assert.equal(readInventoryEvidence(jobs).listingComplete, false)
  const changed = fixture({ changed: true }); let changedAudit
  await registered().run({ fetchPage: changed.fetchPage, onAudit: v => { changedAudit = v } })
  assert.equal(changedAudit.closingReconciled, false)
  assert.equal(changedAudit.scopeComplete, false)
})

test('KEI unresolved secondary channel never certifies an empty whole-company inventory', async () => {
  const f = fixture({ records: [], extra: true }); let audit
  const jobs = await registered().run({ fetchPage: f.fetchPage, onAudit: v => { audit = v } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.scopeComplete, false)
  assert.equal(audit.indiaJobCount, null)
  assert.equal(audit.cleanupEligible, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('KEI stops at the first public denial without other endpoints or retries', async () => {
  for (const options of [{ deny: true }, { gate: true }]) {
    const f = fixture(options)
    await assert.rejects(registered().run({ fetchPage: f.fetchPage }), /denied/i)
    assert.equal(f.requests.length, 1)
  }
})

test('KEI reconciles overlapping native IDs across advertised employer portals', async () => {
  const f = fixture({ extra: true, secondaryValid: true }); let audit
  const jobs = await registered().run({ fetchPage: f.fetchPage, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 1)
  assert.equal(audit.observedGlobalCount, 1)
  assert.equal(jobs[0].applicationPostingContext.nativePostingId, 'KEI-101')
})

test('KEI retains native filled and expired records in the audit while excluding them from active output', async () => {
  const filled = record('KEI-104'); filled.OFFER_FILLED = '1'
  const expired = record('KEI-105'); expired.APPLY_END_DATE = '2026-10-25'
  const f = fixture({ records: [filled, expired] }); let audit
  const jobs = await registered().run({ now: () => '2026-10-27T00:00:00Z', fetchPage: f.fetchPage, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.observedGlobalCount, 2)
  assert.ok(audit.nativeJobs.every(job => job.nativeInactive === true))
})

test('KEI keeps conflicting native countries unresolved', async () => {
  const r = record('KEI-103'); r.LOCATION_NAME = 'India, United States'
  const f = fixture({ records: [r] }); let audit
  const jobs = await registered().run({ fetchPage: f.fetchPage, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.equal(audit.nativeJobs[0].country, null)
  assert.equal(audit.cleanupEligible, false)
})

test('KEI preserves technical HTML entities and rejects an impossible native publication day', async () => {
  const r = record('KEI-106'); r.FUNCTION_DESC += '<p>10&deg;C &micro;F &sup2; &#128;</p>'; r.POSTED_ON = '2026-02-30T09:00:00+05:30'
  const f = fixture({ records: [r] })
  const [job] = await registered().run({ fetchPage: f.fetchPage })
  assert.match(job.jobDescription, /10\u00b0C \u00b5F \u00b2 \u20ac/)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourcePublicationDateUnavailable, true)
})

test('KEI retains every advertised hiring channel even when its provider route is new', async () => {
  const f = fixture(); let audit
  await registered().run({ fetchPage: async (url, init) => {
    const response = await f.fetchPage(url, init)
    if (url === 'https://www.kei-ind.com/') response.body += '<a href="https://another.invalid/positions/">Current Job Openings</a>'
    return response
  }, onAudit: value => { audit = value } })
  assert.equal(audit.scopeComplete, false)
  assert.equal(audit.indiaJobCount, null)
  assert.ok(audit.scopes.some(s => s.portalUrl === 'https://another.invalid/positions/'))
})

test('KEI never certifies whole-company scope when career-link visibility is unresolved', async () => {
  const f = fixture({ records: [] }); let audit
  await registered().run({ fetchPage: async (url, init) => {
    const response = await f.fetchPage(url, init)
    if (url === 'https://www.kei-ind.com/') response.body += '<style>a{display:var(--career-link-visibility)}</style>'
    return response
  }, onAudit: value => { audit = value } })
  assert.equal(audit.scopeComplete, false)
  assert.equal(audit.cleanupEligible, false)
})

test('KEI rejects ambiguous state abbreviations as location-only country evidence', async () => {
  const records = ['Fort Wayne, IN', 'Dover, DE'].map((location, i) => ({ ...record('STATE-' + i, null), LOCATION_NAME: location }))
  const f = fixture({ records }); let audit
  const jobs = await registered().run({ fetchPage: f.fetchPage, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 0)
  assert.ok(audit.nativeJobs.every(job => job.country === null))
  assert.equal(audit.indiaJobCount, null)
  for (const [location, fields, expected] of [
    ['Chennai', { COUNTRY_CODE: 'IN' }, 'India'],
    ['Chennai, India', {}, 'India'],
    ['Fort Wayne, IN, United States', {}, 'United States'],
    ['Berlin, Germany', {}, 'Germany'],
  ]) {
    const job = extractNativeJob({ ...record('COUNTRY-POSITIVE', null), LOCATION_NAME: location, ...fields })
    assert.equal(job.country, expected, location)
  }
})

test('KEI keeps opaque RGB and HSL criteria visible and complete', () => {
  for (const color of ['rgb(0,0,0)', 'hsl(0 0% 0%)', 'hsl(0,0%,0%)', 'rgba(0,0,0,1)', 'hsla(0,0%,0%,1)', 'rgb(0 0 0 / 1)']) {
    const result = visibleText(`<p style="color:${color}">Visible qualification.</p>`)
    assert.equal(result.unresolved, false, color)
    assert.equal(result.text, 'Visible qualification.', color)
    const job = extractNativeJob({ ...record('OPAQUE-POSITIVE'), FUNCTION_DESC: `<p style="color:${color}">Visible qualification.</p>` })
    assert.equal(job.sourceDetailComplete, true, color)
    assert.equal(job.country, 'India')
  }
})

test('KEI excludes or withholds transparent RGB and HSL criteria', () => {
  for (const color of ['rgb(0 0 0 / 0)', 'rgba(0,0,0,0)', 'hsl(0 0% 0% / 0)', 'hsla(0,0%,0%,0)', 'rgb(0 0 0 / 0%)']) {
    const result = visibleText(`<p style="color:${color}">HIDDEN</p><p>Visible criteria.</p>`)
    assert.equal(result.text?.includes('HIDDEN') ?? false, false, color)
    assert.ok(result.unresolved || result.text === 'Visible criteria.', color)
  }
})

test('KEI applies the zero clamp to negative opacity and retains positive opacity', () => {
  for (const opacity of ['-1', '-1%', '-.5', '-0.5%', '-1e0', '-1e2%']) {
    const result = visibleText(`<p style="opacity:${opacity}">SYNTHETIC HIDDEN</p><p>VISIBLE</p>`)
    assert.equal(result.text, 'VISIBLE', opacity)
    assert.equal(result.unresolved, false, opacity)
  }
  for (const opacity of ['1', '0.25', '25%', '150%', '1e-1']) assert.equal(visibleText(`<p style="opacity:${opacity}">VISIBLE</p>`).text, 'VISIBLE', opacity)
  assert.equal(visibleText('<style>.zero{opacity:-1;visibility:visible}</style><p class="zero">SYNTHETIC HIDDEN</p><p>VISIBLE</p>').text, 'VISIBLE')
})

test('KEI preserves uncertainty for a descendant visibility override within the criteria scope', () => {
  const result = visibleText('<p style="visibility:hidden">HIDDEN<span style="visibility:visible">VISIBLE</span></p>')
  assert.ok(result.unresolved || result.text === 'VISIBLE')
  assert.equal(result.text?.includes('HIDDEN') ?? false, false)
  const doc = visibleDocument('<nav style="visibility:hidden">HIDDEN<span style="visibility:visible">Navigation</span></nav><article id="criteria">Visible criteria.</article>', n => n.attrs.id === 'criteria')
  assert.equal(doc.unresolved, false)
  assert.equal(doc.text(doc.nodes(n => n.attrs.id === 'criteria')[0]), 'Visible criteria.')
})
