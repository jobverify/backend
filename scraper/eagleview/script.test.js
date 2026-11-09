import assert from 'node:assert/strict'
import test from 'node:test'

import {
  INDIA_LOCATION_QUERY,
  JOBS_PAGE_URL,
  buildSearchUrl,
  createEagleviewScraper,
  extractJobListings,
  hasOfficialJobsPageSignal,
} from './script.js'

const firstPageHtml = `
  <html>
    <head><title>Search Jobs | EagleView</title></head>
    <body>
      <main>
        <h1>Search Jobs</h1>
        <div class="iCIMS_JobsTable">
          <div class="iCIMS_JobsTableRow">
            <a class="iCIMS_Anchor" href="/jobs/2866?lang=en-us">Incident Manager I</a>
            <dl>
              <dt>Job ID</dt><dd>2866</dd>
              <dt>Location</dt><dd>IN-Bengaluru</dd>
              <dt>Department</dt><dd>Technology</dd>
              <dt>Posted Date</dt><dd>06/30/2026</dd>
            </dl>
          </div>
          <div class="iCIMS_JobsTableRow">
            <a href="/jobs/3000?lang=en-us">US Role</a>
            <dl><dt>Job ID</dt><dd>3000</dd><dt>Location</dt><dd>US-Rochester</dd></dl>
          </div>
        </div>
        <a rel="next" href="?location=India&amp;page=2">Next</a>
      </main>
    </body>
  </html>
`

const secondPageHtml = `
  <html>
    <head><title>Search Jobs | EagleView</title></head>
    <body>
      <main>
        <h1>Search Jobs</h1>
        <div class="iCIMS_JobsTable">
          <div class="iCIMS_JobsTableRow">
            <a href="/jobs/2866?lang=en-us">Incident Manager I</a>
            <dl><dt>Job ID</dt><dd>2866</dd><dt>Location</dt><dd>IN-Bengaluru</dd></dl>
          </div>
          <div class="iCIMS_JobsTableRow">
            <a href="/jobs/2867?lang=en-us">Software Engineer</a>
            <dl>
              <dt>Job ID</dt><dd>2867</dd>
              <dt>Location</dt><dd>IN-Hyderabad</dd>
            </dl>
          </div>
        </div>
      </main>
    </body>
  </html>
`

test('builds and validates the official Eagleview India jobs search page', () => {
  assert.equal(JOBS_PAGE_URL, 'https://careers.eagleview.com/jobs')
  assert.equal(INDIA_LOCATION_QUERY, 'India')
  assert.equal(buildSearchUrl(), 'https://careers.eagleview.com/jobs?location=India&page=1&sortBy=distance_from&stretch=10&stretchUnit=MILES&woe=12&lang=en-us')
  assert.equal(hasOfficialJobsPageSignal(firstPageHtml), true)
  assert.equal(hasOfficialJobsPageSignal('<html><title>Search Jobs | Other Company</title></html>'), false)
})

test('extracts only India listings and normalizes Eagleview iCIMS job URLs', () => {
  assert.deepEqual(extractJobListings(firstPageHtml), [{
    title: 'Incident Manager I',
    company: 'Eagleview',
    department: 'Technology',
    location: 'Bengaluru, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '2866',
    requisitionId: '2866',
    sourceUrl: 'https://careers.eagleview.com/jobs/2866?lang=en-us',
    applyUrl: 'https://careers.eagleview.com/jobs/2866?lang=en-us',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-06-30',
    closingDate: null,
    jobDescription: null,
  }])
})

test('legacy Eagleview listing cards cannot be published without current native role details', async () => {
  await assert.rejects(createEagleviewScraper().run({
    maxPages:2,
    fetchText:async url=>url===JOBS_PAGE_URL?firstPageHtml:secondPageHtml,
  }),error=>error.failureKind==='coverage_gap')
})

test('rejects an unexpected public careers surface', async () => {
  await assert.rejects(
    createEagleviewScraper().run({
      fetchText: async () => '<html><title>Access denied</title><body>Challenge page</body></html>',
    }),
    error=>error.failureKind==='coverage_gap',
  )
})

test('Eagleview delegates the current public Jibe client and matches each native India detail',async()=>{
 const client='https://app.jibecdn.com/prod/search/4.11.225/main.js'
 const settings={path:'/jobs',locale:'en-US',numRowsPerPage:10,externalSearch:true,isLoggedIn:false,contextSettings:{}}
 const page=`<title>EagleView Careers</title><script>window._jibe={cid:'eagleview'};window.searchConfig=${JSON.stringify(settings)}</script><script src="${client}"></script>`
 const description='<p>Design production services, work with engineers on technical designs, investigate incidents and improve the reliability and performance of software used by customers.</p>'
 const native={req_id:'2931',slug:'2931',title:'Data Scientist II',language:'en-us',country:'India',country_code:'IN',city:'Bengaluru',hiring_organization:'EagleView',description,
  internal:false,searchable:true,applyable:true,client_code:'eagleview',apply_url:'https://careers-apac-eagleview.icims.com/jobs/2931/login'}
 const requests=[]
 const jobs=await createEagleviewScraper().run({
  fetchPage:async url=>{requests.push(url);assert.ok([JOBS_PAGE_URL,client].includes(url));return {url,status:200,html:url===client?'class Search { search(p){return this.http.get("/api/jobs",{params:p})} detail(s,l){return this.http.get(`api/jobs/${s}/${l}`)} url(j){return `/jobs/${j.slug}?lang=${j.language}`}}':page}},
  fetchJson:async url=>{requests.push(url);const u=new URL(url);assert.equal(u.origin,'https://careers.eagleview.com');return u.pathname==='/api/jobs'?{jobs:[{data:native}],totalCount:1,count:1}:native},
 })
 assert.equal(jobs.length,1)
 assert.equal(jobs[0].source,'eagleview')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].sourceDescription,description)
 assert.equal(jobs[0].nativeSourceRecord.detail.req_id,'2931')
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.ok(requests.includes('https://careers.eagleview.com/api/jobs/2931/en-us'))
 assert.equal(requests.some(url=>url.includes('icims.com')),false)
})
