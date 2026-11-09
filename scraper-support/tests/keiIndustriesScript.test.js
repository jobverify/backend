import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch = async () => { throw new Error('OFFLINE KEI source-family network tripwire') }
const kei = await import('../../scraper/keiindustries/script.js')
const { getScraperCatalog, createCatalogScraper } = await import('../providers/index.js')

const FIXED_SCRAPED_AT = '2026-10-27T00:00:00.000Z'
const LABELS = {
  CAND_VACY_lblJbDes: 'Job description~E',
  CAND_VACY_lblRolRes: 'Roles & responsibilities~E',
  CAND_VACY_lblDept: 'Department~E',
  CAND_VACY_lblQual: 'Qualification~E',
  CAND_VACY_lblSal: 'Salary~E',
  CAND_VACY_lblSkill: 'Skills~E',
}
const NATIVE_RECORD = {
  JOB_REQUEST_CODE: 'KEI-NATIVE-104',
  FUNCTION_NAME: 'Native Engineer',
  COUNTRY_NAME: 'India',
  LOCATION_NAME: 'Mumbai',
  EXPERIENCE: '2-5 years',
  POSTED_ON: '2026-10-25',
  modified: '2026-10-27T12:00:00Z',
  FUNCTION_DESC: '<p>Build reliable native systems.</p><div><p>Retain this complete nested qualification.</p></div>',
  FUNCTION_RESPONSIBILITY: '<ul><li>Own production recovery.</li><li>Review engineering quality.</li></ul>',
  'CAND_VACY_lblDept~D': 'Engineering',
  'CAND_VACY_lblQual~D': 'BE / B Tech (Electrical)',
  'CAND_VACY_lblSal~D': 'As disclosed',
  'CAND_VACY_lblSkill~D': 'Node.js',
}
const LEGACY_ARCHIVE_HTML = '<title>KEI Industries Jobs</title><main><p>Home / Job</p><h1>Job Archives</h1><a href="https://www.kei-ind.com/jobs/executive/">Executive</a><h2>Job Features</h2><p>Locations: Mumbai</p><h2>Apply Online</h2><a href="/jobs/our-esg-vision-purpose/">Our ESG Vision/ Purpose</a></main>'
const HOMEPAGE_HTML = '<title>KEI Industries</title><a href="' + kei.PUBLIC_PORTAL_URL + '">Current Job Openings</a><a href="' + kei.CAREER_PAGE_URL + '">Life at KEI</a>'
// Controlled excerpts of the verified anonymous frontend contract; no candidate
// login, profile, application or other write route is represented by this fixture.
const PUBLIC_FRONTEND = 'getVacancyInformation(e){return this.http.post(this.AUTH_API+"CPVacancyDetails/GetVacancyInformationWithoutToken",{CompanyID:this.appConfig.CompanyID,Flag:e},this.getHeader())} getLandingPageData(){return this.http.post(this.AUTH_API+"CPLandigPage/GetLandingPage",{CompanyID:this.appConfig.CompanyID},this.getHeader())} getLabelData(){return this.http.post(this.AUTH_API+"CPCommon/GetLabelWithoutToken",{CompanyID:this.appConfig.CompanyID,FormModuleCode:["CAND_JOSK_00_28,CAND_GENR_00_00","CAND_VACY_00_24"]},this.getHeader())} refreshPagedData(){this.pagedData.push(this.filteredData[e])} selectedJobDetail.FUNCTION_DESC;selectedJobDetail.FUNCTION_RESPONSIBILITY; r.includes("~D"); assets/company/ /config.json'
const registered = () => createCatalogScraper(getScraperCatalog().find(provider => provider.source === 'keiindustries'))

const syntheticTransport = ({ legacySurface = false, redirectPortal = false } = {}) => {
  const requests = []
  const fetchPage = async (url, init = {}) => {
    requests.push({ url, method: init.method || 'GET', body: init.body ? JSON.parse(init.body) : null })
    let body, contentType = 'text/html'
    if (url === kei.HOMEPAGE_URL || url === kei.CAREER_PAGE_URL) body = legacySurface ? LEGACY_ARCHIVE_HTML : HOMEPAGE_HTML
    else if (url === 'https://keihrms.myadrenalin.com/CandidateMAX/') {
      if (redirectPortal) return { status: 200, url: 'https://jobs.example.invalid/CandidateMAX/', body: '<title>Candidate Portal</title>' }
      body = '<title>Candidate Portal</title><script src="main.native-contract.js"></script>'
    } else if (url.endsWith('/main.native-contract.js')) { body = PUBLIC_FRONTEND; contentType = 'application/javascript' }
    else if (url.endsWith('/assets/company/KEIIND/config.json')) { body = JSON.stringify({ apiURL: 'https://keihrms.myadrenalin.com', apiPath: '/CandidateMAX/' }); contentType = 'application/json' }
    else if (url.endsWith('/CPLandigPage/GetLandingPage')) { body = JSON.stringify({ IsValid: true, Data: [{ CompanyDetails: [{ LINK_NAME: 'KEI INDUSTRIES LTD', LINK_ADDRESS: kei.HOMEPAGE_URL }] }] }); contentType = 'application/json' }
    else if (url.endsWith('/CPCommon/GetLabelWithoutToken')) { body = JSON.stringify({ IsValid: true, Data: [LABELS] }); contentType = 'application/json' }
    else if (url.endsWith('/CPVacancyDetails/GetVacancyInformationWithoutToken')) {
      body = JSON.stringify({ IsValid: true, Data: [{ VacancyInformation: [NATIVE_RECORD, { ...NATIVE_RECORD, JOB_REQUEST_CODE: 'KEI-NATIVE-FOREIGN', COUNTRY_NAME: 'United Kingdom', LOCATION_NAME: 'London' }] }] })
      contentType = 'application/json'
    } else throw new Error('Unexpected current native route; legacy archive is not hiring inventory: ' + url)
    return { status: 200, url, body, contentType }
  }
  return { fetchPage, requests }
}

test('KEI native records retain complete criteria, posting identity and original dates without fabricated defaults', () => {
  const job = kei.extractNativeJob(NATIVE_RECORD, { labels: LABELS, now: FIXED_SCRAPED_AT })
  assert.equal(job.jobId, 'KEI-NATIVE-104')
  assert.equal(job.requisitionId, null)
  assert.equal(job.title, 'Native Engineer')
  assert.equal(job.country, 'India')
  assert.equal(job.city, 'Mumbai')
  assert.equal(job.department, 'Engineering')
  assert.equal(job.experienceRequired, '2-5 years')
  assert.equal(job.minimumQualification, 'BE / B Tech (Electrical)')
  assert.equal(job.compensation, 'As disclosed')
  assert.deepEqual(job.requiredSkills, ['Node.js'])
  assert.equal(job.postingDate, '2026-10-25')
  assert.equal(job.employmentType, null)
  assert.equal(job.remoteStatus, null)
  assert.equal(job.sourceIdentityComplete, true)
  assert.equal(job.sourceDetailComplete, true)
  assert.match(job.jobDescription, /Retain this complete nested qualification/)
  assert.match(job.jobDescription, /Own production recovery/)
  assert.match(job.jobDescription, /Review engineering quality/)
  assert.equal(job.applyUrl, kei.PUBLIC_PORTAL_URL)
  assert.equal(job.applicationPostingContext.nativePostingId, 'KEI-NATIVE-104')
  assert.equal(job.applicationUrlIsGeneric, true)
  assert.equal(job.applicationSubmitted, false)
})

test('KEI incomplete native records keep country, publication and requisition unknown instead of promoting previews', () => {
  assert.equal(kei.extractNativeJob(LEGACY_ARCHIVE_HTML), null)
  const job = kei.extractNativeJob({ ...NATIVE_RECORD, JOB_REQUEST_CODE: null, COUNTRY_NAME: null, LOCATION_NAME: 'HO', POSTED_ON: null, FUNCTION_RESPONSIBILITY: null, 'CAND_VACY_lblQual~D': null }, { labels: LABELS })
  assert.equal(job.jobId, null)
  assert.equal(job.requisitionId, null)
  assert.equal(job.country, null)
  assert.equal(job.postingDate, null)
  assert.equal(job.sourcePublicationDateUnavailable, true)
  assert.equal(job.minimumQualification, null)
  assert.equal(job.remoteStatus, null)
  assert.equal(job.sourceIdentityComplete, false)
  assert.equal(job.sourceDetailComplete, false)
  assert.equal(job.jobDescription, null)
})

test('KEI registered run uses the complete anonymous native feed and never enumerates the legacy archive', async () => {
  const fixture = syntheticTransport(); let audit
  const jobs = await registered().run({ fetchPage: fixture.fetchPage, now: () => FIXED_SCRAPED_AT, onAudit: value => { audit = value } })
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].jobId, 'KEI-NATIVE-104')
  assert.equal(jobs[0].source, 'keiindustries')
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[0].link, kei.PUBLIC_PORTAL_URL)
  assert.equal(jobs[0].sourceDetailComplete, true)
  assert.equal(jobs[0].sourceListingComplete, true)
  assert.equal(audit.observedGlobalCount, 2)
  assert.equal(audit.closingReconciled, true)
  assert.equal(audit.fullHealthyIndia, 1)
  assert.equal(audit.eligibleCount, 1)
  assert.equal(fixture.requests.filter(request => request.url.endsWith('/GetVacancyInformationWithoutToken')).length, 2)
  assert.equal(fixture.requests.some(request => request.url.startsWith(kei.JOBS_ARCHIVE_URL)), false)
  assert.ok(fixture.requests.filter(request => request.method === 'POST').every(request => request.body.CompanyID === 'KEIIND' && !Object.hasOwn(request.body, 'Token')))
})

test('KEI rejects obsolete archive replacement and off-host current portal redirects before any fallback or native API read', async () => {
  for (const [options, expected] of [[{ legacySurface: true }, /current openings handoff changed/i], [{ redirectPortal: true }, /employer binding changed/i]]) {
    const fixture = syntheticTransport(options)
    await assert.rejects(registered().run({ fetchPage: fixture.fetchPage }), expected)
    assert.equal(fixture.requests.some(request => request.url.startsWith(kei.JOBS_ARCHIVE_URL)), false)
    assert.equal(fixture.requests.some(request => request.method === 'POST'), false)
  }
})
