import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'

const FIXED_SCRAPED_AT = '2026-08-14T12:00:00.000Z'

const jobsBoardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Grab your dream role</h1>
      <h2>Search Jobs</h2>
      <p>Displaying 1 to 20 of 349 matching jobs</p>
      <p>Location Cambodia China India Indonesia Malaysia Philippines Romania Singapore Thailand Vietnam</p>
      <a href="https://www.grab.careers/en/jobs/xml/?rss=true">RSS</a>

      <article>
        <h2><a href="/en/jobs/744000143509332/project-manager-grabads-solutions/">Project Manager, GrabAds Solutions</a></h2>
        <ul>
          <li>Petaling Jaya, Malaysia</li>
          <li>Advertising</li>
        </ul>
      </article>

      <article>
        <h2><a href="/en/jobs/744000143357414/senior-software-engineer-mobile-ios/">Senior Software Engineer, Mobile (iOS)</a></h2>
        <ul>
          <li>Petaling Jaya, Malaysia</li>
          <li>Engineering</li>
        </ul>
      </article>
    </main>
  </body>
</html>
`

const jobsRssXml = `<?xml version="1.0" encoding="utf-8" standalone="yes"?>
<source>
  <publisher>Grab</publisher>
  <publisherUrl>https://www.grab.com/sg/</publisherUrl>
  <lastBuildDate>Fri, 14 Aug 2026 09:08:27 GMT</lastBuildDate>
  <job>
    <title><![CDATA[Lead Software Engineer, Backend]]></title>
    <apijobid><![CDATA[744000143229150]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000143229150/lead-software-engineer-backend/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Engineering]]></category>
  </job>
  <job>
    <title><![CDATA[Support Manager, People Systems]]></title>
    <apijobid><![CDATA[744000143031699]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000143031699/support-manager-people-systems/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Other Teams]]></category>
  </job>
  <job>
    <title><![CDATA[Solutions Specialist (EPM), Finance Systems]]></title>
    <apijobid><![CDATA[744000138554499]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000138554499/solutions-specialist-epm-finance-systems/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Technology Solutions]]></category>
  </job>
  <job>
    <title><![CDATA[Senior Solution Specialist, People Systems]]></title>
    <apijobid><![CDATA[744000138296534]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000138296534/senior-solution-specialist-people-systems/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Bangalore]]></city>
    <country><![CDATA[India]]></country>
    <category><![CDATA[Technology Solutions]]></category>
  </job>
  <job>
    <title><![CDATA[Project Manager, GrabAds Solutions]]></title>
    <apijobid><![CDATA[744000143509332]]></apijobid>
    <url><![CDATA[https://www.grab.careers/en/jobs/744000143509332/project-manager-grabads-solutions/]]></url>
    <company><![CDATA[Grab]]></company>
    <city><![CDATA[Petaling Jaya]]></city>
    <country><![CDATA[Malaysia]]></country>
    <category><![CDATA[Advertising]]></category>
  </job>
</source>
`

const indiaLocationHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Welcome to India!</h1>
      <p>Our teams in India are putting Fintech in the fast lane and making an impact beyond service.</p>
      <h2>Where we work from in India</h2>
      <p>Bangalore</p>
      <h2>Teams in India</h2>
      <a href="/en/teams">See all teams</a>
    </main>
  </body>
</html>
`

const indiaLocationHtmlWithLiveCardLayout = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Welcome to India!</h1>
      <p>Bangalore</p>
      <h2>Join our team in India</h2>
      <a href="/en/jobs/?orderby=0&amp;pagesize=20&amp;page=1&amp;location=Bengaluru&amp;country=India">See all jobs</a>

      <div class="grid job-listing">
        <div class="card card-job" data-id="744000109177995">
          <div class="card-body">
            <h2 class="card-title">
              <a class="stretched-link js-view-job" href="/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/">
                Senior Techno-Functional Oracle Integration Specialist
              </a>
            </h2>
            <ul class="list-inline job-meta">
              <li class="list-inline-item">Bengaluru, India</li>
              <li class="list-inline-item">Technology Solutions</li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/grab/script.js')
  } catch {
    assert.fail('Expected Grab scraper module at ../../scraper/grab/script.js')
  }
}

test('Grab helpers stay pinned to the verified first-party jobs board, jobs RSS feed, and India location surfaces from Friday, August 14, 2026', async () => {
  const grab = await loadModule()

  assert.equal(grab.SOURCE, 'grab')
  assert.equal(grab.COMPANY, 'Grab')
  assert.equal(grab.HOMEPAGE_URL, 'https://www.grab.careers/en/')
  assert.equal(grab.JOBS_URL, 'https://www.grab.careers/jobs')
  assert.equal(grab.JOBS_RSS_URL, 'https://www.grab.careers/en/jobs/xml/?rss=true')
  assert.equal(grab.INDIA_LOCATION_URL, 'https://www.grab.careers/en/locations/india/')
  assert.equal(grab.VERIFIED_ON, '2026-08-14')
  assert.match(grab.VERIFIED_SURFACE_SUMMARY, /jobs\/xml\/\?rss=true/i)
  assert.equal(grab.hasOfficialJobsBoardSignal(jobsBoardHtml), true)
  assert.equal(grab.hasOfficialJobsRssSignal(jobsRssXml), true)
  assert.equal(grab.hasOfficialIndiaLocationSignal(indiaLocationHtml), true)
})

test('Grab extracts India roles from the verified RSS feed and tolerates a jobs-board first page with no India cards', async () => {
  const grab = await loadModule()
  const jobsFromBoard = grab.extractJobsFromJobsBoardHtml(jobsBoardHtml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })
  const jobsFromRss = grab.extractJobsFromJobsRssXml(jobsRssXml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })
  const jobsFromIndiaPage = grab.extractJobsFromIndiaLocationHtml(indiaLocationHtml, {
    scrapedAt: FIXED_SCRAPED_AT,
  })

  assert.deepEqual(jobsFromBoard, [])
  assert.deepEqual(jobsFromIndiaPage, [])
  assert.deepEqual(
    jobsFromRss.map((job) => [job.title, job.location, job.department, job.jobId]),
    [
      ['Lead Software Engineer, Backend', 'Bangalore, India', 'Engineering', '744000143229150'],
      ['Support Manager, People Systems', 'Bangalore, India', 'Other Teams', '744000143031699'],
      ['Solutions Specialist (EPM), Finance Systems', 'Bangalore, India', 'Technology Solutions', '744000138554499'],
      ['Senior Solution Specialist, People Systems', 'Bangalore, India', 'Technology Solutions', '744000138296534'],
    ],
  )
})

test('Grab extracts India roles from the live card layout used on the India location page', async () => {
  const grab = await loadModule()

  assert.deepEqual(
    grab.extractJobsFromIndiaLocationHtml(indiaLocationHtmlWithLiveCardLayout, {
      scrapedAt: FIXED_SCRAPED_AT,
    }),
    [
      {
        title: 'Senior Techno-Functional Oracle Integration Specialist',
        company: 'Grab',
        department: 'Technology Solutions',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        country: 'India',
        link: 'https://www.grab.careers/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/',
        applyUrl: 'https://www.grab.careers/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/',
        sourceUrl: 'https://www.grab.careers/en/jobs/744000109177995/senior-techno-functional-oracle-integration-specialist/',
        source: 'grab',
        jobId: '744000109177995',
        requisitionId: '744000109177995',
        employmentType: null,
        experienceRequired: null,
        jobDescription: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        remoteStatus: null,
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

const currentNativeFixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/grab/test-data/native-20261114.json.gz',import.meta.url))))
currentNativeFixture.responses.push(...JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/grab/test-data/native-styles-20261114.json.gz',import.meta.url)))).responses)
const currentProvider=getScraperCatalog().find(provider=>provider.source==='grab')
const currentTransport=(change=(_url,response)=>response)=>async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const original=currentNativeFixture.responses.find(response=>response.url===String(url))
  assert.ok(original,'The current collector must only read declared original entities: '+url)
  const captured=change(String(url),structuredClone(original))
  const response=new Response(captured.body,{status:captured.status,headers:captured.headers})
  Object.defineProperty(response,'url',{value:captured.finalUrl});return response
}

test('Grab registered run preserves complete original India criteria and source fields through current publisher/detail reconciliation', async () => {
  const jobs=await createCatalogScraper(currentProvider).run({fetchImpl:currentTransport(),now:()=> '2026-11-14T12:00:00.000Z'})
  assert.deepEqual(jobs.map(job=>job.jobId),['744000161218849','744000159351149','744000156946578','744000156260400','744000154359024','744000151842122','744000149229199','744000147495489','744000144006034','744000138554499'])
  assert.equal(jobs[0].title, 'Lead Security Technical Program Manager')
  assert.equal(jobs[0].companyDomain, 'grab.careers')
  assert.equal(jobs[0].companyCareerPage, 'https://www.grab.careers/jobs')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.ok(jobs.every(job=>job.company==='Grab'&&job.country==='India'&&job.sourceDetailComplete&&job.sourceClosingReconciled&&job.sourceDescriptionHTML.length>1000))
  assert.equal(jobs[0].postingDate,'2026-11-12T05:00:07.000Z')
  assert.equal(jobs.at(-1).postingDate,'2026-07-20T04:10:08.000Z')
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const [label,change] of [
  ['corporate board',(url,response)=>url==='https://www.grab.careers/jobs'?{...response,body:response.body.replace('Grab your dream role | Grab Careers','Other employer')}:response],
  ['publisher feed',(url,response)=>url.includes('/jobs/xml/')?{...response,body:response.body.replace('<publisher>Grab</publisher>','<publisher>Other employer</publisher>')}:response]
])test('Grab registered run fails closed when its current '+label+' changes',async()=>{
  await assert.rejects(createCatalogScraper(currentProvider).run({fetchImpl:currentTransport(change)}),error=>error.softFailure===true&&error.lifecycleCleanupAllowed===false)
})

test('Grab current collector requires explicit India detail country rather than a city or India marketing page',async()=>{
  const jobs=await createCatalogScraper(currentProvider).run({fetchImpl:currentTransport((url,response)=>{
    if(url.includes('/744000161218849/'))response.body=response.body.replace('"addressCountry":"India"','"addressCountry":""')
    return response
  })})
  assert.equal(jobs.length,9)
  assert.ok(jobs.every(job=>job.jobId!=='744000161218849'))
  assert.deepEqual(jobs.nativeCollectionEvidence.holds.map(hold=>hold.nativeId),['744000161218849'])
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Grab current collector rejects body-only callbacks instead of promoting historical null-description previews',async()=>{
  const grab=await loadModule()
  await assert.rejects(grab.createGrabScraper().run({fetchText:async()=>jobsBoardHtml}),/Original HTTP metadata is required/)
})
