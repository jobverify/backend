import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs/promises'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-08-01T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const avizvaCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Avizva Careers | Explore Exciting Opportunities</title>
  </head>
  <body>
    <main>
      <h1>We Aim, Learn, and Grow Each Day with Passion and Purpose</h1>
      <label>Select Role</label>
      <label>Select Location</label>
      <div class="job-box">
        <div class="job-info">
          <ul>
            <li>Backend Technologies</li>
            <li>5 - 8 Years</li>
          </ul>
          <h3>Senior Python Engineer</h3>
        </div>
        <h4>Locations</h4>
        <ul><li>Gurugram, India</li><li>Indore, India</li></ul>
        <a href="https://avizva.keka.com/careers/jobdetails/1001">Apply Now</a>
      </div>
      <div class="job-box">
        <div class="job-info">
          <ul>
            <li>Backend Technologies</li>
            <li>3 - 5 Years</li>
          </ul>
          <h3>Python Engineer</h3>
        </div>
        <h4>Locations</h4>
        <ul><li>Gurugram, India</li><li>Indore, India</li></ul>
        <a href="https://avizva.keka.com/careers/jobdetails/1002">Apply Now</a>
      </div>
      <div class="job-box">
        <div class="job-info">
          <ul>
            <li>Program Governance</li>
            <li>3 - 5 Years</li>
          </ul>
          <h3>Scrum Master</h3>
        </div>
        <h4>Locations</h4>
        <ul><li>Gurugram, India</li><li>Indore, India</li></ul>
        <a href="https://avizva.keka.com/careers/jobdetails/1003">Apply Now</a>
      </div>
      <!--
      <div class="job-box">
        <div class="job-info">
          <ul>
            <li>Backend Technologies</li>
            <li>8 - 10 Years</li>
          </ul>
          <h3>Lead Development Engineer</h3>
        </div>
        <h4>Locations</h4>
        <ul><li>Gurugram - India</li></ul>
        <a href="https://avizva.keka.com/careers/jobdetails/1004">Apply Now</a>
      </div>
      <div class="job-box">
        <div class="job-info">
          <ul>
            <li>Design</li>
            <li>6 - 8 Years</li>
          </ul>
          <h3>Senior Product Owner</h3>
        </div>
        <h4>Locations</h4>
        <ul><li>Indore - India</li><li>Gurugram - India</li></ul>
        <a href="https://avizva.keka.com/careers/jobdetails/1005">Apply Now</a>
      </div>
      -->
    </main>
  </body>
</html>
`

const cdwSearchHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Job Search Results</h1>
    <p>Search All Jobs</p>
    <p>Recruitment Fraud Alert</p>
    <a href="/search/jobs/in/country/india">India (4 jobs)</a>
  </body>
</html>
`

const cdwIndiaSearchHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>India Careers</h1>
    <p>Country India (4 jobs ) selected</p>
    <p>Showing 1-3 results out of total 3 open jobs</p>
    <div class="jobs-section__item" id="R26_00002003">
      <div class="row">
        <div class="column">
          <h4><a href="/jobs/17992081-senior-data-engineer-2">Senior Data Engineer-2</a></h4>
          <div class="columns medium-7">Technology</div>
          <div class="columns medium-5 text-right">Hyderabad, TS, India</div>
        </div>
      </div>
    </div>
    <div class="jobs-section__item" id="R26_00002004">
      <div class="row">
        <div class="column">
          <h4><a href="/jobs/17992082-senior-data-engineer-1">Senior Data Engineer-1</a></h4>
          <div class="columns medium-7">Technology</div>
          <div class="columns medium-5 text-right">Bangalore, KA, India</div>
        </div>
      </div>
    </div>
    <div class="jobs-section__item" id="R26_00002006">
      <div class="row">
        <div class="column">
          <h4><a href="/jobs/17992083-data-engineer-consultant-2">Data Engineer(Consultant)-2</a></h4>
          <div class="columns medium-7">Technology</div>
          <div class="columns medium-5 text-right">Bangalore, KA, India</div>
        </div>
      </div>
    </div>
  </body>
</html>
`

const cdwDetailByUrl = {
  'https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2': `
    <!doctype html>
    <html lang="en">
      <body>
        <h1>Senior Data Engineer-2</h1>
        <p>Job ID: R26_00002003</p>
        <p>Team: Corporate</p>
        <p>Focus Area: Technology</p>
        <p>Location: Hyderabad, TS, India</p>
        <p>Remote Type: Hybrid</p>
        <p>Date Posted: Jul 14, 2026</p>
        <h2>Description</h2>
        <p>Lead the design and delivery of modern cloud data solutions using Microsoft Fabric and Azure Data Factory.</p>
      </body>
    </html>
  `,
  'https://www.cdwjobs.com/jobs/17992082-senior-data-engineer-1': `
    <!doctype html>
    <html lang="en">
      <body>
        <h1>Senior Data Engineer-1</h1>
        <p>Job ID: R26_00002004</p>
        <p>Team: Corporate</p>
        <p>Focus Area: Technology</p>
        <p>Location: Bangalore, KA, India</p>
        <p>Remote Type: Hybrid</p>
        <p>Date Posted: Jul 14, 2026</p>
        <h2>Description</h2>
        <p>Build scalable analytics platforms with SQL, Fabric, and PySpark.</p>
      </body>
    </html>
  `,
  'https://www.cdwjobs.com/jobs/17992083-data-engineer-consultant-2': `
    <!doctype html>
    <html lang="en">
      <body>
        <h1>Data Engineer(Consultant)-2</h1>
        <p>Job ID: R26_00002006</p>
        <p>Team: Corporate</p>
        <p>Focus Area: Technology</p>
        <p>Location: Bangalore, KA, India</p>
        <p>Remote Type: Hybrid</p>
        <p>Date Posted: Jul 13, 2026</p>
        <h2>Description</h2>
        <p>Design data pipelines and modern warehousing solutions on Azure.</p>
      </body>
    </html>
  `,
}

const mavenWaveHomepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>At Atos, we accelerate intelligence to help shape a responsible, secure and AI-powered digital future.</h1>
    <a href="/en/">Atos homepage</a>
  </body>
</html>
`

const mavenWaveAlertsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Maven Wave Partners Careers</h1>
    <p>Get notified about new jobs that match your skills and let Maven Wave Partners know you're interested!</p>
    <h2>Select Job Categories</h2>
    <p>Application Development</p>
    <p>Data Analytics</p>
    <h2>Select Job Locations</h2>
    <p>Chandigarh</p>
    <p>Gurgaon</p>
    <p>India</p>
    <a href="https://jobs.jobvite.com/maven-wave-partners/jobs">Back to Current Openings</a>
  </body>
</html>
`

const vertexCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Team That’s Redefining Global Innovation</h1>
    <h2>Team Unstoppables - Join Us!</h2>
    <a href="#open-positions">View Opportunities</a>
    <section id="open-positions">
      <h3>Open Positions</h3>
      <h4>Join the Finovate Family</h4>
      <p>Financial Advisor</p>
      <p>Change Management Consultant</p>
      <p>Salesforce Process & Business Consultant/Sr. Consultant</p>
      <p>Office Manager</p>
    </section>
    <footer>
      <p>office@execor.com</p>
      <p>San Francisco, 1140 Harrison St, CA 94103</p>
    </footer>
  </body>
</html>
`

const trinamixCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Innovate with Us</h1>
    <p>Drive Digital Transformation for Customers and Advance Your Career with Oracle Cloud and AI/ML Technologies</p>
    <h2>Current Openings</h2>
    <label>Search</label>
    <input value="Enter keywords to search">
    <button>Search</button>
    <button>Reset</button>
    <h3>Didn't find authentic jobs?</h3>
    <a href="/submit-resume">Submit Your Resume</a>
  </body>
</html>
`

test('AVIZVA run reconciles genuine current native descriptions, countries and closing inventory', async () => {
  const avizva = await loadModule('../../scraper/avizva/script.js')
  assert.equal(avizva.hasOfficialCareersSignal(avizvaCareersHtml), true)
  const {readFileSync}=await import('node:fs')
  const {gunzipSync}=await import('node:zlib')
  const {readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
  const {createCatalogScraper,getScraperCatalog}=await import('../providers/index.js')
  const fixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/avizva/test-data/current-native-20261105.json.gz',import.meta.url))))
  const evidence={},calls=[],seen=new Map()
  const provider=getScraperCatalog().find(provider=>provider.source==='avizva')
  const jobs=await createCatalogScraper(provider).run({
    now:()=>fixture.capturedAt,requestIntervalMs:0,evidence,
    fetchImpl:async(url,init)=>{
      calls.push({url,init})
      const captures=fixture.responses.filter(response=>response.requestedUrl===url),ordinal=seen.get(url)||0
      const captured=captures[ordinal];seen.set(url,ordinal+1)
      assert.ok(captured,'Unexpected native replay request '+url)
      return new Response(captured.body,{status:captured.status,headers:{'content-type':captured.headers['content-type']}})
    },
  })
  assert.deepEqual(jobs.map(job=>job.jobId).sort(),['120944','158305'])
  assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceListingComplete))
  assert.equal(evidence.nativeObservations.length,3)
  assert.equal(evidence.nativeObservations.find(job=>job.jobId==='154713').country,'United States')
  assert.deepEqual(evidence.closedCorporateIDs,['157359'])
  assert.equal(evidence.nativeDetailReads.filter(detail=>detail.phase==='closing'&&detail.valid).length,3)
  for(const job of jobs){const native=evidence.openingNativePayload.find(row=>String(row.id)===job.jobId);assert.equal(job.jobDescription,native.description);assert.deepEqual(job.nativeSourceRecord,native)}
  assert.deepEqual(evidence.openingNativePayload,evidence.closingNativePayload)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,3)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,2)
  assert.equal(evidence.companyGlobalTotal,null)
  assert.equal(evidence.companyIndiaTotal,null)
  assert.ok(calls.every(call=>call.init.method==='GET'&&call.init.redirect==='manual'&&call.init.credentials==='omit'))
})

test('CDW run returns normalized India jobs from the verified search results and detail pages', async () => {
  const cdw = await loadModule('../../scraper/cdw/script.js')
  const requestedUrls = []

  assert.equal(cdw.hasOfficialSearchResultsSignal(cdwSearchHtml), true)
  assert.equal(cdw.hasOfficialIndiaResultsSignal(cdwIndiaSearchHtml), true)

  const jobs = await cdw.createCdwScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cdw.SEARCH_URL) return cdwSearchHtml
      if (url === cdw.INDIA_SEARCH_URL) return cdwIndiaSearchHtml
      if (cdwDetailByUrl[url]) return cdwDetailByUrl[url]
      throw new Error(`Unexpected CDW URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cdw.SEARCH_URL,
    cdw.INDIA_SEARCH_URL,
    'https://www.cdwjobs.com/jobs/17992081-senior-data-engineer-2',
    'https://www.cdwjobs.com/jobs/17992082-senior-data-engineer-1',
    'https://www.cdwjobs.com/jobs/17992083-data-engineer-consultant-2',
  ])
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs.map((job) => job.title), [
    'Data Engineer(Consultant)-2',
    'Senior Data Engineer-1',
    'Senior Data Engineer-2',
  ])
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[1].team, 'Corporate')
  assert.match(jobs[2].jobDescription, /Microsoft Fabric/i)
})

test('Maven Wave Partners verifies the native linked unfiltered empty Jobvite inventory', async () => {
  const mavenWave = await loadModule('../../scraper/mavenwavepartners/script.js')
  const requestedUrls = []
  const alerts = await fs.readFile(new URL('../../scraper/mavenwavepartners/fixtures/current-alerts.html', import.meta.url), 'utf8')
  const openings = await fs.readFile(new URL('../../scraper/mavenwavepartners/fixtures/current-openings.html', import.meta.url), 'utf8')
  const jobs = await mavenWave.run({fetchText: async url => {requestedUrls.push(url);if(url===mavenWave.ALERTS_URL)return alerts;if(url===mavenWave.CAREERS_URL)return openings;throw new Error('Unexpected Maven Wave URL '+url)}})
  assert.deepEqual(requestedUrls, [mavenWave.ALERTS_URL, mavenWave.CAREERS_URL])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status, 'verified-empty')
  assert.equal(readInventoryEvidence(jobs).listingComplete, true)
})

test('Vertex Global Services stays fail-closed while the careers page remains contradictory and untrustworthy', async () => {
  const vertex = await loadModule('../../scraper/vertexglobalservices/script.js')

  assert.equal(vertex.hasContradictoryCareersSignal(vertexCareersHtml), true)

  const jobs = await vertex.createVertexGlobalServicesScraper().run({
    fetchText: async (url) => {
      assert.equal(url, vertex.CAREERS_URL)
      return vertexCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('TRINAMIX stays fail-closed while the careers page exposes only a current-openings search shell', async () => {
  const trinamix = await loadModule('../../scraper/trinamix/script.js')

  assert.equal(trinamix.hasOfficialCareersShellSignal(trinamixCareersHtml), true)
  assert.equal(trinamix.hasServerRenderedRoleInventory(trinamixCareersHtml), false)

  const jobs = await trinamix.createTrinamixScraper().run({
    fetchText: async (url) => {
      assert.equal(url, trinamix.CAREERS_URL)
      return trinamixCareersHtml
    },
  })

  assert.deepEqual(jobs, [])
})
