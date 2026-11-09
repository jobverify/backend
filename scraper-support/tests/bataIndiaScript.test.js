import assert from 'node:assert/strict'
import test from 'node:test'

const loadBataIndiaModule = async () => {
  try {
    return await import('../../scraper/bataindia/script.js')
  } catch {
    assert.fail('Expected Bata India scraper module at ../../scraper/bataindia/script.js')
  }
}

const OFFICIAL_HOMEPAGE_HTML = `
  <html>
    <head>
      <title>Bata India Official</title>
    </head>
    <body>
      <footer>
        <a href="https://bata.sensehq.com/careers">Careers</a>
      </footer>
    </body>
  </html>
`

const ROOT_LISTING_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"organization":{"name":"Bata"},"jobsData":{"rows":[{"id":530,"created_on":1780484415340,"job_status":"OPEN","department":"Corporate","title":"Assistant Manager - B2B Ops","location":"Kolkata","experience_end":8,"experience_start":5,"description_external":"<p><strong>Skills :</strong> B2B Sales, Channel Operations</p><p>Lead B2B operations.</p>","job_type":"FULLTIME","code":"COR00517","office":{"city":"Kolkata","country":"India","location":"Kolkata","name":"Head Office"}},{"id":499,"created_on":1780398015340,"job_status":"OPEN","department":"Finance","title":"Group Manager - SCM Finance","location":"Gurugram, Haryana","experience_end":12,"experience_start":8,"description_external":"<div><b>Skills :</b> Supply Chain Finance, SAP</div><div>Own finance planning.</div>","job_type":"FULLTIME","code":"FIN00486","office":{"city":"Gurugram","country":"India","location":"Gurugram","name":"Corporate Office"}}],"count":3}}},"page":"/careers","query":{},"buildId":"bata-build","isFallback":false,"gssp":true}</script></body></html>`

const IFRAME_LISTING_HTML = String.raw`<!DOCTYPE html><html><body><script id="__NEXT_DATA__" type="application/json">{"props":{"pageProps":{"jobsData":{"rows":[{"id":272,"created_on":1779257067290,"job_status":"OPEN","department":"Franchise","title":"Franchisee Business Development Manager","location":"Hyderabad","experience_end":10,"experience_start":6,"description_external":"<div><b>Skills :</b> Franchise Sales, Expansion Planning</div><div>Drive franchise business growth.</div>","job_type":"FULLTIME","code":"FRA00265","office":{"city":"Hyderabad","country":"India","location":"Hyderabad","name":"Retail West"}},{"id":530,"created_on":1780484415340,"job_status":"OPEN","department":"Corporate","title":"Assistant Manager - B2B Ops","location":"Kolkata","experience_end":8,"experience_start":5,"description_external":"<p><strong>Skills :</strong> B2B Sales, Channel Operations</p><p>Lead B2B operations.</p>","job_type":"FULLTIME","code":"COR00517","office":{"city":"Kolkata","country":"India","location":"Kolkata","name":"Head Office"}}],"count":3}}},"page":"/iframe/jobs","query":{"page":"1","isIframe":"true"},"buildId":"bata-build","isFallback":false,"gssp":true}</script></body></html>`

test('Bata India helpers keep the official homepage handoff and canonical SenseHQ URLs stable', async () => {
  const {
    CAREERS_BOARD_URL,
    HOMEPAGE_URL,
    IFRAME_LISTINGS_URL,
    buildIframeListingUrl,
    buildJobUrl,
    extractSenseHqCareersUrl,
    hasOfficialCareersPageSignal,
  } = await loadBataIndiaModule()

  assert.equal(HOMEPAGE_URL, 'https://www.bata.in/')
  assert.equal(CAREERS_BOARD_URL, 'https://bata.sensehq.com/careers')
  assert.equal(IFRAME_LISTINGS_URL, 'https://bata.sensehq.com/careers/iframe/jobs?page=1&isIframe=true')
  assert.equal(hasOfficialCareersPageSignal(OFFICIAL_HOMEPAGE_HTML), true)
  assert.equal(extractSenseHqCareersUrl(OFFICIAL_HOMEPAGE_HTML), CAREERS_BOARD_URL)
  assert.equal(buildIframeListingUrl(), IFRAME_LISTINGS_URL)
  assert.equal(
    buildIframeListingUrl({ page: 2 }),
    'https://bata.sensehq.com/careers/iframe/jobs?page=2&isIframe=true',
  )
  assert.equal(buildJobUrl(530), 'https://bata.sensehq.com/careers/jobs/530')
})

test('extractSearchResults keeps open India jobs and normalizes the Bata India root board payload', async () => {
  const { extractBoardSummary, extractSearchResults } = await loadBataIndiaModule()
  const jobs = extractSearchResults(ROOT_LISTING_HTML)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Assistant Manager - B2B Ops',
    company: 'Bata India',
    department: 'Corporate',
    location: 'Kolkata, India',
    city: 'Kolkata',
    jobId: '530',
    requisitionId: 'COR00517',
    sourceUrl: 'https://bata.sensehq.com/careers/jobs/530',
    applyUrl: 'https://bata.sensehq.com/careers/jobs/530',
    employmentType: 'Full-time',
    experienceRequired: '5-8 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      'B2B Sales',
      'Channel Operations',
    ],
    postingDate: '2026-06-03',
    closingDate: null,
    jobDescription: 'Skills : B2B Sales, Channel Operations Lead B2B operations.',
  })

  assert.deepEqual(extractBoardSummary(ROOT_LISTING_HTML), {
    currentPage: 1,
    pageSize: 2,
    totalCount: 3,
    totalPages: 2,
    hasNext: true,
  })
})

const currentNativeFixture=async()=>{
  const {readFileSync}=await import('node:fs'),{gunzipSync}=await import('node:zlib'),base=new URL('../../scraper/bataindia/test-data/current-20261103/',import.meta.url)
  const manifest=JSON.parse(readFileSync(new URL('manifest.json',base)))
  const rows=new Map(manifest.files.map(row=>[row.url,gunzipSync(readFileSync(new URL(row.file,base))).toString('utf8')]))
  return async url=>{assert(rows.has(url),'Unexpected current native URL '+url);return{status:200,url,html:rows.get(url)}}
}

test('current run reconciles the whole configured board and both own-detail passes before applying a caller cap',async()=>{
  const {createBataIndiaScraper}=await loadBataIndiaModule(),fetchPage=await currentNativeFixture(),requests=[]
  const jobs=await createBataIndiaScraper({maxJobs:3}).run({minRequestIntervalMs:0,fetchPage:async url=>{requests.push(url);return fetchPage(url)}})
  assert.equal(jobs.length,3)
  assert(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.source==='bataindia'))
  assert.equal(requests.filter(url=>/\/jobs\/\d+$/.test(url)).length,22)
  assert.equal(requests.at(-2),'https://bata.sensehq.com/careers')
})

test('configured native board has its own current employer proof and preserves2blank-description gaps',async()=>{
  const {run}=await loadBataIndiaModule(),audits=[]
  const jobs=await run({minRequestIntervalMs:0,fetchPage:await currentNativeFixture(),onAudit:a=>audits.push(a)})
  assert.equal(jobs.length,9);assert.equal(audits[0].nativeTotal,11)
  assert.equal(audits[0].publicEmployer.id,5079)
  assert.deepEqual(audits[0].detailGaps.map(gap=>gap.jobId).sort(),['234','465'])
  assert.equal(audits[0].inventoryEvidence.listingComplete,false)
})
