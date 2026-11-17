import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Opportunities at Mirae Asset Sharekhan </title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Grow with us</h2>
      <table>
        <tbody>
          <tr>
            <td style="text-align:left">Senior Manager - Campaign Management</td>
            <td style="text-align:left">Digital Experience</td>
            <td style="text-align:left">Mumbai</td>
            <td>5 yrs</td>
            <td><a href="/careers/job-details/senior-manager-campaign-management-290029">View Details</a></td>
          </tr>
          <tr>
            <td style="text-align:left">Manager Digital Marketing</td>
            <td style="text-align:left">Digital Marketing</td>
            <td style="text-align:left">Mumbai</td>
            <td>8</td>
            <td><a href="/careers/job-details/manager-digital-marketing-290020">View Details</a></td>
          </tr>
          <tr>
            <td style="text-align:left">UI/UX Designer</td>
            <td style="text-align:left">Design</td>
            <td style="text-align:left">Mumbai</td>
            <td>5</td>
            <td><a href="/careers/job-details/ui-ux-designer-289891">View Details</a></td>
          </tr>
        </tbody>
      </table>
      <a href="mailto:careers@sharekhan.com">careers@sharekhan.com</a>
    </main>
  </body>
</html>
`

const buildDetailHtml = (title, responsibilities) => `
<!doctype html>
<html lang="en">
  <body>
    <section class="container">
      <h1 class="font-family">Job Details</h1>
      <h3 class="JobTitle">${title}</h3>
      <hr />
      <p><strong>Direct Responsibilities</strong></p>
      <ul>
        <li>${responsibilities}</li>
      </ul>
      <h2>Applying for the Job</h2>
    </section>
  </body>
</html>
`

const buildAreasOfResponsibilitiesDetailHtml = (title, responsibilities) => `
<!doctype html>
<html lang="en">
  <body>
    <section class="container">
      <h1 class="font-family">Job Details</h1>
      <h3 class="JobTitle">${title}</h3>
      <hr />
      <h3><span>Areas of Responsibilities</span></h3>
      <ul>
        <li><span>&#x2022; Direct Responsibilities</span></li>
        <li><span>&#x2022; Contributing Responsibilities</span></li>
        <li><span>&#x2022; Technical &amp; Behavioural Competencies</span></li>
      </ul>
      <div>
        <ul>
          <li><span>&#x2022; ${responsibilities}</span></li>
        </ul>
      </div>
      <h2>Applying for the Job</h2>
    </section>
  </body>
</html>
`

const buildListOnlyDetailHtml = (title, responsibilities) => `
<!doctype html>
<html lang="en">
  <body>
    <section class="container">
      <h1 class="font-family">Job Details</h1>
      <h3 class="JobTitle">${title}</h3>
      <hr />
      <ul>
        <li><span>&#x2022; ${responsibilities}</span></li>
      </ul>
      <h2>Applying for the Job</h2>
    </section>
  </body>
</html>
`

const DETAIL_PAGES = {
  'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029': buildDetailHtml(
    'Senior Manager - Campaign Management',
    'Drive digital programs and campaigns for products with limited or no online journey.',
  ),
  'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020': buildAreasOfResponsibilitiesDetailHtml(
    'Manager Digital Marketing',
    'Manage acquisition and performance marketing programs across digital channels.',
  ),
  'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891': buildListOnlyDetailHtml(
    'UI/UX Designer',
    'Design intuitive experiences for retail investing and trading journeys.',
  ),
}

const DRIFTED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main><p>No verified Sharekhan careers surface.</p></main>
  </body>
</html>
`

const INVALID_DETAIL_LINK_HTML = CAREERS_HTML.replace(
  '/careers/job-details/ui-ux-designer-289891',
  'https://example.com/jobs/ui-ux-designer-289891',
)

const DRIFTED_DETAIL_HTML = buildDetailHtml('Wrong title', 'Broken detail page.')

const loadSharekhanModule = async () => {
  try {
    return await import('../../scraper/sharekhan/script.js')
  } catch {
    assert.fail('Expected Sharekhan scraper module at ../../scraper/sharekhan/script.js')
  }
}

test('Sharekhan pure historical helpers retain the dated July table/detail contract', async () => {
  const sharekhan = await loadSharekhanModule()

  assert.equal(sharekhan.SOURCE, 'sharekhan')
  assert.equal(sharekhan.COMPANY, 'Sharekhan')
  assert.equal(sharekhan.HOMEPAGE_URL, 'https://www.sharekhan.com/')
  assert.equal(sharekhan.CAREERS_URL, 'https://www.sharekhan.com/careers')
  assert.equal(sharekhan.LISTING_TABLE_URL, 'https://www.sharekhan.com/careers')
  assert.equal(
    sharekhan.VERIFIED_SAMPLE_JOB_URL,
    'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
  )
  assert.equal(sharekhan.VERIFIED_ON, '2026-07-17')
  assert.equal(sharekhan.hasVerifiedCareersPageSignal(CAREERS_HTML), true)
  assert.deepEqual(
    sharekhan.extractListingRows(CAREERS_HTML).map((row) => row.title),
    [
      'Senior Manager - Campaign Management',
      'Manager Digital Marketing',
      'UI/UX Designer',
    ],
  )

  const jobs = sharekhan.extractJobsFromPages(CAREERS_HTML, DETAIL_PAGES, {
    scrapedAt: '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Manager - Campaign Management',
      company: 'Sharekhan',
      department: 'Digital Experience',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      experienceRequired: '5 yrs',
      sourceUrl: 'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
      applyUrl: 'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
      link: 'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
      source: 'sharekhan',
      jobId: '290029',
      requisitionId: '290029',
      jobDescription: 'Drive digital programs and campaigns for products with limited or no online journey.',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Manager Digital Marketing',
      company: 'Sharekhan',
      department: 'Digital Marketing',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      experienceRequired: '8 years',
      sourceUrl: 'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020',
      applyUrl: 'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020',
      link: 'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020',
      source: 'sharekhan',
      jobId: '290020',
      requisitionId: '290020',
      jobDescription: 'Manage acquisition and performance marketing programs across digital channels.',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'UI/UX Designer',
      company: 'Sharekhan',
      department: 'Design',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      experienceRequired: '5 years',
      sourceUrl: 'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891',
      applyUrl: 'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891',
      link: 'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891',
      source: 'sharekhan',
      jobId: '289891',
      requisitionId: '289891',
      jobDescription: 'Design intuitive experiences for retail investing and trading journeys.',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
  ])
})


function currentNativeReplay(source,change=()=>{}){
 const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/'+source+'/fixtures/current-native-20261117.json.gz',import.meta.url)))),calls=[],seen=new Map()
 return{calls,fetchImpl:async(url,init)=>{
  const original=captures.find(row=>row.requestedUrl===url);assert.ok(original,'Unbound current native URL '+url)
  assert.equal(init.method??'GET','GET');assert.equal(init.redirect,'manual');assert.ok(init.signal instanceof AbortSignal)
  const nth=(seen.get(url)||0)+1;seen.set(url,nth);calls.push({url,nth})
  const row={...structuredClone(original),body:Buffer.from(original.bodyBase64,'base64').toString()};change(row,url,nth)
  const response=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.url});return response
 }}
}

test('Sharekhan current originals expose general intake rather than a bound Research Analyst vacancy',async()=>{
 const source=await loadSharekhanModule(),transport=currentNativeReplay('sharekhan')
 const jobs=await source.createSharekhanScraper().run({fetchImpl:transport.fetchImpl})
 assert.equal(jobs.length,0);assert.equal(transport.calls.length,6)
 const summary=readSourceObservationEvidence(jobs,'sharekhan');assert.equal(summary.recordKind,'hiring-signals');assert.equal(summary.observedRecordCount,1);assert.equal(summary.observedVacancyCount,0)
 const observation=jobs.nativeCollectionEvidence.observations[0]
 assert.deepEqual(observation.nativeBannerTitles,['Research Analyst']);assert.equal(observation.nativeApplicationJobID,'');assert.equal(observation.nativeApplicationRoleLabel,'Lead Page CTA')
 assert.deepEqual(observation.nativeOpeningModel,observation.nativeClosingModel)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaZeroProven,false);assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
})
test('Sharekhan current employer transport must retain original response authority',async()=>{
 const source=await loadSharekhanModule(),transport=currentNativeReplay('sharekhan',row=>{row.url='https://other.example/careers'})
 await assert.rejects(source.run({fetchImpl:transport.fetchImpl}),/original.*URL|authority/i);assert.equal(transport.calls.length,1)
})
test('Sharekhan original public denial remains a blocker rather than zero inventory',async()=>{
 const source=await loadSharekhanModule(),transport=currentNativeReplay('sharekhan',row=>{row.status=403;row.body='<html>Access denied</html>'})
 await assert.rejects(source.run({fetchImpl:transport.fetchImpl}),error=>error.status===403&&error.failureKind==='blocked_or_access_denied')
 assert.equal(transport.calls.length,1)
})
test('Sharekhan rejects a new application job ID instead of upgrading the generic template copy',async()=>{
 const source=await loadSharekhanModule(),transport=currentNativeReplay('sharekhan',(row,url)=>{if(url.endsWith('/careers/job-details')){assert.ok(row.body.includes('var jobid = ""'));row.body=row.body.replace('var jobid = ""','var jobid = "unreviewed-role-id"')}})
 await assert.rejects(source.run({fetchImpl:transport.fetchImpl}),/unreviewed vacancy binding/i)
})
test('Sharekhan closing-only general intake criteria cannot be dropped from reconciliation',async()=>{
 const source=await loadSharekhanModule(),transport=currentNativeReplay('sharekhan',(row,url,nth)=>{if(url.endsWith('/careers/job-details')&&nth===2){assert.ok(row.body.includes('Tracking the assigned sector'));row.body=row.body.replace('Tracking the assigned sector','New mandatory eligibility. Tracking the assigned sector')}})
 await assert.rejects(source.run({fetchImpl:transport.fetchImpl}),/opening.*closing.*criteria changed/i)
})
for(const inflight of [false,true])test('Sharekhan exact frozen opaque caller abort survives '+(inflight?'native transport':'pre-abort'),async()=>{
 const source=await loadSharekhanModule(),controller=new AbortController(),reason=Object.freeze({opaque:true,caller:'sharekhan',inflight});let reads=0
 if(!inflight)controller.abort(reason)
 await assert.rejects(source.run({signal:controller.signal,fetchImpl:async()=>{reads++;controller.abort(reason);throw Object.freeze(Error('Replacement native error'))}}),error=>error===reason)
 assert.equal(reads,inflight?1:0)
})
