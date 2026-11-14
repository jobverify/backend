import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {API,BOARD,CORPORATE} from '../../scraper/myoperator/currentNative.js'

const currentFixture=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/myoperator/test-data/native-20261114.json.gz',import.meta.url))))
const FIXED_SCRAPED_AT=currentFixture.capturedAt
const provider=getScraperCatalog().find(row=>row.source==='myoperator')
function replayCurrent(change=(_url,row)=>row){
 const requested=[],counts=new Map()
 const fetchImpl=async(input,init={})=>{
  const url=String(input),count=(counts.get(url)||0)+1;counts.set(url,count);init.signal?.throwIfAborted()
  const matches=currentFixture.responses.filter(row=>row.url===url),original=matches[Math.min(count-1,matches.length-1)]
  assert.ok(original,'Unexpected native read '+url);assert.equal(init.method||'GET','GET');requested.push(url)
  const record=change(url,structuredClone(original)),response=new Response(record.body,{status:record.status,headers:record.headers})
  Object.defineProperty(response,'url',{value:record.finalUrl??record.url});return response
 }
 return {fetchImpl,requested}
}

const careersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at MyOperator | Build, Scale, and Lead With Ownership</title>
  </head>
  <body>
    <main>
      <h2>Current Openings</h2>
      <p class="current-openings-heading">Channel Partner Sales Manager</p>
      <p class="current-openings-heading">Performance Marketing Executive</p>
      <p class="current-openings-heading">Talent Acquisition Specialist</p>
      <a href="https://careers.myoperator.com/jobs/Careers">View All Openings</a>
    </main>
  </body>
</html>
`

const portalHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs @ MyOperator</title>
  </head>
  <body>
    <input id="pageJson" />
    <input id="moduleMeta" />
    <input id="jobs" />
    <script>
      var page_id = '163599000003109531', portalPageJson, moduleMeta, jobs, meta, Crm;
    </script>
  </body>
</html>
`

const apiPayload = {
  code: 'success',
  data: [
    {
      Posting_Title: 'Senior Site Reliability Engineer',
      City: 'Noida',
      Country: 'India',
      Job_Description: 'Build reliable platform infrastructure for Business AI Operator workloads.',
      Work_Experience: '3 To 5 Years',
      Job_Type: 'Full time',
      Date_Opened: '30/04/2026',
      $url: 'https://careers.myoperator.com/jobs/Careers/163599000021255085/Senior-Site-Reliability-Engineer?source=CareerSite',
      id: '163599000021255085',
    },
    {
      Posting_Title: 'Business Consultant',
      City: 'Noida',
      Country: 'India',
      Job_Description: 'Own the end-to-end sales cycle for inbound demand.',
      Work_Experience: '0 To 2 Years',
      Job_Type: 'Full time',
      Date_Opened: '29/01/2026',
      $url: 'https://careers.myoperator.com/jobs/Careers/163599000020939005/Business-Consultant?source=CareerSite',
      id: '163599000020939005',
    },
    {
      Posting_Title: 'Revenue Director',
      City: 'Austin',
      Country: 'United States',
      Job_Description: 'Non-India role.',
      Work_Experience: '7 To 10 Years',
      Job_Type: 'Full time',
      Date_Opened: '15/07/2026',
      $url: 'https://careers.myoperator.com/jobs/Careers/999999999/Revenue-Director?source=CareerSite',
      id: '999999999',
    },
  ],
}

const loadModule = async () => {
  try {
    return await import('../../scraper/myoperator/script.js')
  } catch {
    assert.fail('Expected MyOperator scraper module at ../../scraper/myoperator/script.js')
  }
}

test('MyOperator helpers stay pinned to the verified shell, portal, and public Zoho Recruit payload', async () => {
  const myoperator = await loadModule()

  assert.equal(myoperator.SOURCE, 'myoperator')
  assert.equal(myoperator.COMPANY, 'MyOperator')
  assert.equal(myoperator.CAREERS_URL, 'https://myoperator.com/careers')
  assert.equal(myoperator.PORTAL_URL, 'https://careers.myoperator.com/jobs/Careers')
  assert.equal(
    myoperator.JOBS_API_URL,
    'https://careers.myoperator.com/recruit/v2/public/Job_Openings?pagename=Careers&source=CareerSite',
  )
  assert.equal(myoperator.VERIFIED_ON, '2026-07-17')
  assert.equal(myoperator.hasOfficialCareersSignal(careersShellHtml), true)
  assert.equal(myoperator.hasOfficialPortalSignal(portalHtml), true)
  assert.deepEqual(myoperator.extractIndiaJobs(apiPayload), [
    {
      title: 'Senior Site Reliability Engineer',
      company: 'MyOperator',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: '163599000021255085',
      requisitionId: '163599000021255085',
      sourceUrl: 'https://careers.myoperator.com/jobs/Careers/163599000021255085/Senior-Site-Reliability-Engineer?source=CareerSite',
      applyUrl: 'https://careers.myoperator.com/jobs/Careers/163599000021255085/Senior-Site-Reliability-Engineer?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '3 To 5 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '30/04/2026',
      closingDate: null,
      jobDescription: 'Build reliable platform infrastructure for Business AI Operator workloads.',
      remoteStatus: 'On-site',
    },
    {
      title: 'Business Consultant',
      company: 'MyOperator',
      department: null,
      location: 'Noida, India',
      city: 'Noida',
      country: 'India',
      jobId: '163599000020939005',
      requisitionId: '163599000020939005',
      sourceUrl: 'https://careers.myoperator.com/jobs/Careers/163599000020939005/Business-Consultant?source=CareerSite',
      applyUrl: 'https://careers.myoperator.com/jobs/Careers/163599000020939005/Business-Consultant?source=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '0 To 2 Years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: '29/01/2026',
      closingDate: null,
      jobDescription: 'Own the end-to-end sales cycle for inbound demand.',
      remoteStatus: 'On-site',
    },
  ])
})

test('MyOperator registered run validates current native HTTP responses and retains provider metadata', async () => {
  const transport=replayCurrent()
  const jobs=await createCatalogScraper(provider).run({fetchImpl:transport.fetchImpl,now:()=>FIXED_SCRAPED_AT})
  assert.equal(jobs.length,16)
  assert.equal(transport.requested.length,38)
  for(const url of [CORPORATE,BOARD,API])assert.equal(transport.requested.filter(value=>value===url).length,2)
  for(const job of jobs){
    assert.equal(job.source,'myoperator')
    assert.equal(job.companyCareerPage,'https://myoperator.com/careers')
    assert.equal(job.companyDomain,'myoperator.com')
    assert.equal(job.atsPlatform,'zoho-recruit')
    assert.equal(job.scrapedAt,FIXED_SCRAPED_AT)
    assert.equal(job.country,'India')
    assert.equal(job.sourceDetailComplete,true)
    assert.equal(job.sourceDescriptionHTML,job.sourceNativeDetailRecord.Job_Description)
    assert.equal(job.sourceClosingReconciled,true)
    assert.equal(job.sourceScopeComplete,false)
    assert.equal(job.lifecycleCleanupAllowed,false)
  }
})

test('MyOperator registered run fails closed at shell, portal, API and HTTP authority boundaries', async t => {
  for(const {name,url,edit,error,reads}of [
    {name:'corporate shell',url:CORPORATE,edit:row=>{row.body='<html><head><title>Careers</title></head><body>Other employer</body></html>'},error:/corporate employer title/i,reads:1},
    {name:'native portal',url:BOARD,edit:row=>{row.body=row.body.replace('<title>Careers at MyOperator</title>','<title>Another employer</title>')},error:/native employer title/i,reads:2},
    {name:'native jobs API',url:API,edit:row=>{row.body=JSON.stringify({code:'error',data:[]})},error:/native jobs success/i,reads:3},
    {name:'foreign final HTTP URL',url:CORPORATE,edit:row=>{row.finalUrl='https://other.example/careers'},error:error=>error.status===200&&/Original native final URL changed/.test(error.message),reads:1},
    {name:'native public HTTP refusal',url:CORPORATE,edit:row=>{row.status=403},error:error=>error.status===403&&error.abortRetries===true,reads:1},
  ])await t.test(name,async()=>{
    const transport=replayCurrent((target,row)=>{if(target===url)edit(row);return row})
    await assert.rejects(createCatalogScraper(provider).run({fetchImpl:transport.fetchImpl,now:()=>FIXED_SCRAPED_AT}),error)
    assert.equal(transport.requested.length,reads)
  })
})

test('MyOperator rejects body-only transport overrides before any HTTP read',async()=>{
  for(const key of ['fetchText','fetchJson']){
    let requested=0
    await assert.rejects(createCatalogScraper(provider).run({[key]:async()=>key==='fetchJson'?apiPayload:careersShellHtml,fetchImpl:async()=>{requested++;throw Error('Unexpected HTTP read')}}),/unreviewed.*overrides|body-only|unsupported/i)
    assert.equal(requested,0)
  }
})
