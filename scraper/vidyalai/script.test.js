import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
  <html>
    <head>
      <title>Vidyalai</title>
    </head>
    <body>
      <a href="https://erp.vidyalai.com/jobs">Careers</a>
    </body>
  </html>
`

const liveHomepageHtml = `
  <html>
    <head>
      <title>Vidyalai.com: One to One Online Tuitions for IGCSE, IB, CBSE, ICSE, JEE, NEET, SAT and more.</title>
    </head>
    <body>
      <a href="http://erp.vidyalai.com/jobs">Careers</a>
    </body>
  </html>
`

const jobsPageHtml = `
  <html>
    <head>
      <title>Jobs | Vidyalai</title>
    </head>
    <body>
      <div>Showing 2 results</div>
    </body>
  </html>
`

const apiPayload = {
  data: [
    {
      name: 'JOB-001',
      job_title: 'Senior Software Engineer',
      route: 'jobs/vidyalai/senior-software-engineer',
      company: 'Vidyalai',
      department: 'Engineering',
      employment_type: 'Full-time',
      location: 'Bengaluru, India',
      status: 'Open',
    },
    {
      name: 'JOB-002',
      job_title: 'Academic Associate - Physics K12',
      route: 'academic-associate-physics-k12',
      company: 'Vidyalai',
      department: 'Academics',
      employment_type: 'Full-time',
      location: 'Remote, India',
      status: 'Open',
    },
  ],
}

const seniorSoftwareEngineerUrl = 'https://erp.vidyalai.com/jobs/vidyalai/senior-software-engineer'
const academicAssociateUrl = 'https://erp.vidyalai.com/academic-associate-physics-k12'

const seniorSoftwareEngineerHtml = `
  <html>
    <head>
      <title>Senior Software Engineer</title>
    </head>
    <body>
      <h1>Senior Software Engineer</h1>
      <p>Vidyalai</p>
      <a href="#apply">Apply Now</a>
    </body>
  </html>
`

const academicAssociateHtml = `
  <html>
    <head>
      <title>Academic Associate - Physics K12</title>
    </head>
    <body>
      <h1>Academic Associate - Physics K12</h1>
      <p>Vidyalai</p>
      <a href="#apply">Apply Now</a>
    </body>
  </html>
`

test('legacy helper constants remain available while title and Apply Now alone do not qualify criteria', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  assert.equal(vidyalai.SOURCE, 'vidyalai')
  assert.equal(vidyalai.COMPANY, 'Vidyalai')
  assert.equal(vidyalai.HOMEPAGE_URL, 'https://www.vidyalai.com/')
  assert.equal(vidyalai.JOBS_PAGE_URL, 'https://erp.vidyalai.com/jobs')
  assert.equal(
    vidyalai.JOBS_API_URL,
    'https://erp.vidyalai.com/api/resource/Job%20Opening?fields=%5B%22name%22,%22job_title%22,%22route%22,%22company%22,%22department%22,%22employment_type%22,%22location%22,%22status%22%5D&filters=%5B%5B%22company%22,%22%3D%22,%22Vidyalai%22%5D,%5B%22status%22,%22%3D%22,%22Open%22%5D%5D&limit_page_length=200',
  )
  assert.equal(vidyalai.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(vidyalai.hasOfficialHomepageSignal(liveHomepageHtml), true)
  assert.equal(vidyalai.extractJobsPageCount(jobsPageHtml), 2)
  assert.equal(
    vidyalai.buildDetailUrl('jobs/vidyalai/senior-software-engineer'),
    seniorSoftwareEngineerUrl,
  )
  assert.equal(
    vidyalai.buildDetailUrl('academic-associate-physics-k12'),
    academicAssociateUrl,
  )
  assert.equal(
    vidyalai.hasVerifiedDetailPage({
      status: 200,
      url: seniorSoftwareEngineerUrl,
      html: seniorSoftwareEngineerHtml,
    }, apiPayload.data[0]),
    false,
  )
  assert.equal(vidyalai.hasVerifiedDetailPage({status:200,url:academicAssociateUrl,html:academicAssociateHtml},apiPayload.data[1]),false)
})

test('extractOpenJobs keeps the filtered open ERP jobs and preserves routes verbatim', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  assert.deepEqual(vidyalai.extractOpenJobs(apiPayload), [
    {
      title: 'Senior Software Engineer',
      company: 'Vidyalai',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      state: null,
      country: 'India',
      jobId: 'JOB-001',
      requisitionId: 'JOB-001',
      sourceUrl: 'https://erp.vidyalai.com/jobs/vidyalai/senior-software-engineer',
      applyUrl: 'https://erp.vidyalai.com/jobs/vidyalai/senior-software-engineer',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'On-site',
    },
    {
      title: 'Academic Associate - Physics K12',
      company: 'Vidyalai',
      department: 'Academics',
      location: 'Remote, India',
      city: null,
      state: null,
      country: 'India',
      jobId: 'JOB-002',
      requisitionId: 'JOB-002',
      sourceUrl: 'https://erp.vidyalai.com/academic-associate-physics-k12',
      applyUrl: 'https://erp.vidyalai.com/academic-associate-physics-k12',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
      remoteStatus: 'Remote',
    },
  ])
})

const currentOriginals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261121.json.gz',import.meta.url))))
const currentReader=(calls,change=()=>{})=>async url=>{
  calls.push(url)
  const packet=currentOriginals.packets.find(row=>row.url===url)
  assert.ok(packet,'The runtime must use only published routes and no historical undeclared API')
  const response={status:packet.status,url:packet.url,headers:new Headers(packet.headers),body:Buffer.from(packet.bodyBase64,'base64').toString('utf8')}
  return change(url,response)??response
}

test('public factory reconciles all current original role details before applying its configured cap', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  const requestedUrls = []
  const jobs = await vidyalai.createVidyalaiScraper({ maxJobs: 1 }).run({
    fetchPage: currentReader(requestedUrls),
    fetchJson: async () => {throw Error('No current client declares the legacy filtered API')},
    requestIntervalMs:0,
    now: () => '2026-07-12T00:00:00.000Z',
  })

  assert.equal(requestedUrls.length,36)
  assert.equal(requestedUrls.includes(vidyalai.JOBS_API_URL),false)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'vidyalai')
  assert.equal(jobs[0].link, null)
  assert.equal(jobs[0].country,null)
  assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
  assert.equal(jobs.nativeCollectionEvidence.fullRawCriteriaRecords,16)
  assert.equal(jobs[0].scrapedAt, '2026-07-12T00:00:00.000Z')
})

test('public factory cannot route current native rejection into historical or incomplete extraction', async () => {
  const vidyalai = await loadModule()
  assert.ok(vidyalai, 'Vidyalai scraper module should load')

  for(const [target,change,expectedCalls]of[
    [vidyalai.HOMEPAGE_URL,()=>homepageHtml,1],
    [vidyalai.JOBS_PAGE_URL,body=>body.replace('Showing 16','Showing 15'),2],
    [vidyalai.JOBS_PAGE_URL,body=>body.replace('name="card"','hidden name="card"'),2],
    [currentOriginals.packets[3].url,body=>body.replace(/<div class="ql-editor read-mode">[\s\S]*?<\/div>/,'<div class="ql-editor read-mode"></div>'),3],
  ]){
    const calls=[]
    await assert.rejects(vidyalai.createVidyalaiScraper().run({fetchPage:currentReader(calls,(url,response)=>url===target?{...response,body:change(response.body)}:undefined),requestIntervalMs:0,fetchJson:async()=>{throw Error('No historical API fallback')}}),/Vidyalai native data/)
    assert.equal(calls.length,expectedCalls)
  }
})
