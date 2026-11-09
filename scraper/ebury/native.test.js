import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
globalThis.fetch = async () => { throw Error('OFFLINE_FETCH_TRIPWIRE') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence, isFreshCompleteInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const fixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/actual-native-20261027.json.gz', import.meta.url))))
const stableFixture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/actual-stable-native-20261027.json.gz', import.meta.url))))
const provider = () => getScraperCatalog().find(p => p.source === 'ebury')
const changeModel = (response, transform) => {
  response.body=response.body.replace(/window\.__remixContext\s*=\s*([\s\S]*?);<\/script>/,(_all,json)=>{
    const model=JSON.parse(json);transform(model.state.loaderData)
    return 'window.__remixContext = '+JSON.stringify(model)+';</script>'
  })
}
const syntheticSecondaryIndia = responses => {
  const apiUrl='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'
  const api=JSON.parse(responses[apiUrl].body)
  api.jobs.find(j=>j.id===5012714101).offices.push({id:999001,name:'Synthetic Bengaluru',location:'Bengaluru, India',parent_id:999000})
  responses[apiUrl].body=JSON.stringify(api)
  for(const response of Object.values(responses))changeModel(response,data=>{
    data['routes/$url_token']?.offices.push({id:999999,name:'Synthetic Asia',children:[{id:999000,name:'India',children:[{id:999001,name:'Synthetic Bengaluru',children:[]}]}]})
  })
}
const reconciledSynthetic = responses => {
  const detail='https://job-boards.eu.greenhouse.io/ebury/jobs/5012714101'
  const board='https://job-boards.eu.greenhouse.io/ebury'
  const corporate='https://ebury.com/company/careers/job-board'
  responses['https://ebury.com/company/careers'].body=`<a href="${corporate}">View jobs</a><a href="${detail}">Open role</a>`
  responses[corporate].body=`<a href="${detail}">Senior Financial Accountant</a><div aria-label="Page 1 of 1">1/1</div>`
  let selected
  for(const r of Object.values(responses))changeModel(r,data=>{
    const b=data['routes/$url_token'];if(!b)return
    const match=b.jobPosts.data.find(j=>j.id===5012714101);if(match)selected=match
  })
  assert.ok(selected)
  changeModel(responses[board],data=>{data['routes/$url_token'].jobPosts={count:1,page:1,total:1,total_pages:1,data:[selected]}})
  const apiUrl='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'
  const api=JSON.parse(responses[apiUrl].body);api.jobs=api.jobs.filter(j=>j.id===5012714101);api.meta.total=1
  responses[apiUrl].body=JSON.stringify(api)
}
const run = async (change = () => {}) => {
  const responses = structuredClone(fixture.responses), calls = []
  change(responses)
  let audit
  const jobs = await createCatalogScraper(provider()).run({ fetchPage: async url => {
    calls.push(url)
    assert.ok(responses[url], `Uncaptured offline route: ${url}`)
    return structuredClone(responses[url])
  }, onAudit: value => { audit = value } })
  return { jobs, audit, calls }
}

test('registered Ebury consumes corporate/native pages and every live or stale advertised detail before reporting zero India', async () => {
  const { jobs, audit, calls } = await run()
  assert.equal(provider().adapter, 'script')
  assert.equal(jobs.length, 0)
  assert.equal(audit.corporatePostingIds.length, 150)
  assert.equal(audit.nativeJobs.length, 140)
  assert.equal(audit.closedPostingIds.length, 11)
  assert.equal(new Set(audit.nativeJobs.map(j => j.nativePostingId)).size, 140)
  assert.ok(calls.includes('https://job-boards.eu.greenhouse.io/ebury?page=3'))
  assert.equal(audit.nativeJobs.find(j => j.nativePostingId === '5012714101').nativeRequisitionId, '2920')
  const job = audit.nativeJobs.find(j => j.nativePostingId === '5012714101')
  assert.equal(job.country, 'Spain')
  assert.equal(job.sourceEmployerName, 'Ebury')
  assert.equal(job.sourcePublishedAt, '2026-10-23T05:32:48-04:00')
  assert.equal(job.closingDate, null)
  assert.match(job.sourceDescription, /IFRS 9\/IFRS 13/)
  assert.match(job.sourceDescription, /We believe in inclusion/)
  assert.equal(job.sourceDescriptionHtml, job.nativeDescriptionParts.join('\n'))
  assert.equal(job.nativeInternalJobId, '4540343101')
  assert.equal(job.applyUrl, 'https://job-boards.eu.greenhouse.io/ebury/jobs/5012714101')
  const evidence = readInventoryEvidence(jobs)
  assert.equal(evidence.listingComplete, false)
  assert.equal(evidence.reportedTotal, null)
  assert.equal(isFreshCompleteInventoryEvidence(evidence), false)
  assert.match(evidence.reason, /inventory-drift|corporate-native-synchronization/)
})

test('synthetic future India role retains country, original publication precision and distinct native requisition', async () => {
  const { run: nativeRun } = await import('./script.js')
  const { jobs, audit } = await run(responses => {
    // Synthetic future India geography, never evidence of actual India hiring.
    const apiUrl = 'https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'
    const api = JSON.parse(responses[apiUrl].body)
    const role = api.jobs.find(j => j.id === 5012714101)
    role.location.name = 'Bengaluru, India'
    role.offices = [{ id: 999001, name: 'Bengaluru', parent_id: 999000, location: 'Bengaluru, India' }]
    role.first_published = '2026-10-27T08:00:00+05:30'
    responses[apiUrl].body = JSON.stringify(api)
    for (const [url,response] of Object.entries(responses)) {
      if (!response.body.includes('window.__remixContext')) continue
      response.body = response.body.replace(/window\.__remixContext\s*=\s*([\s\S]*?);<\/script>/, (all,json) => {
        const model = JSON.parse(json), data = model.state.loaderData
        const board = data['routes/$url_token']
        if (board) board.offices.push({ id: 999999, name: 'Synthetic Asia', children: [{ id: 999000, name: 'India', children: [{ id: 999001, name: 'Bengaluru', children: [] }] }] })
        const detail = data['routes/$url_token_.jobs_.$job_post_id']
        if (detail?.jobPostId === '5012714101' || detail?.jobPostId === 5012714101) detail.jobPost.job_post_location = 'Bengaluru, India'
        return 'window.__remixContext = ' + JSON.stringify(model) + ';</script>'
      })
    }
  })
  assert.equal(typeof nativeRun, 'function')
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].nativePostingId, '5012714101')
  assert.equal(jobs[0].nativeRequisitionId, '2920')
  assert.equal(jobs[0].sourcePublishedAt, '2026-10-27T08:00:00+05:30')
  assert.equal(jobs[0].lifecycleCleanupAllowed, false)
  assert.equal(audit.synthetic, undefined)
})

for (const status of [401,403,429]) test(`first native HTTP ${status} stops without retry or alternate request`, async () => {
  const p=provider();const calls=[]
  await assert.rejects(createCatalogScraper(p).run({fetchPage: async url=>{calls.push(url);return {status,body:'blocked'}}}),new RegExp(String(status)))
  assert.equal(calls.length,1)
})

test('native truncation and foreign role identity fail before eligibility or cleanup', async () => {
  await assert.rejects(run(responses=>{
    const key='https://job-boards.eu.greenhouse.io/ebury?page=3'
    responses[key].body=responses[key].body.replace('"page": 3','"page": 2')
  }), /pagination|page|inventory/i)
  await assert.rejects(run(responses=>{
    const key='https://job-boards.eu.greenhouse.io/ebury/jobs/5012714101'
    responses[key].body=responses[key].body.replaceAll('"company_name": "Ebury"','"company_name": "Other"')
  }),/employer|identity/i)
})

test('synthetic secondary India office is retained alongside the native foreign primary location', async () => {
  const {jobs}=await run(syntheticSecondaryIndia)
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].nativeLocation,'León')
  assert.deepEqual(jobs[0].sourceCountries,['Spain','India'])
  assert.equal(jobs[0].sourceLocations.length,2)
  assert.equal(jobs[0].country,'India')
})

test('missing native criteria keeps the synthetic India role unhealthy and source partial', async () => {
  const {jobs,audit}=await run(responses=>{
    syntheticSecondaryIndia(responses)
    changeModel(responses['https://job-boards.eu.greenhouse.io/ebury/jobs/5012714101'],data=>{
      data['routes/$url_token_.jobs_.$job_post_id'].jobPost.content=''
    })
  })
  assert.equal(jobs.length,0)
  assert.equal(audit.nativeJobs.find(j=>j.nativePostingId==='5012714101').sourceDetailComplete,false)
  assert.ok(audit.reasons.includes('native-role-detail-incomplete'))
})

test('stylesheet-hidden native criteria cannot supply a healthy synthetic India role', async () => {
  const {jobs}=await run(responses=>{
    syntheticSecondaryIndia(responses)
    const response=responses['https://job-boards.eu.greenhouse.io/ebury/jobs/5012714101']
    response.body='<style>.job__description{display:none}</style>'+response.body
  })
  assert.equal(jobs.length,0)
})

test('synthetic expiry keeps original date-only precision and missing publication stays null', async () => {
  const {jobs}=await run(responses=>{
    syntheticSecondaryIndia(responses)
    const apiUrl='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'
    const api=JSON.parse(responses[apiUrl].body)
    api.jobs.find(j=>j.id===5012714101).first_published=null
    responses[apiUrl].body=JSON.stringify(api)
    for(const response of Object.values(responses))changeModel(response,data=>{
      const board=data['routes/$url_token'];if(board)for(const j of board.jobPosts.data)if(j.id===5012714101)j.published_at=null
      const detail=data['routes/$url_token_.jobs_.$job_post_id'];if(String(detail?.jobPostId)==='5012714101')Object.assign(detail.jobPost,{published_at:null,application_deadline:'2026-11-01'})
    })
  })
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourcePublishedAt,null)
  assert.equal(jobs[0].postingDate,null)
  assert.equal(jobs[0].closingDate,'2026-11-01')
  assert.equal(jobs[0].sourceClosingDateIsExact,false)
})

test('HTTP200 explicit challenge stops at the first request', async () => {
  let calls=0
  await assert.rejects(createCatalogScraper(provider()).run({fetchPage:async()=>{calls++;return {status:200,body:'<h1>Verify you are human</h1>'}}}),/bot gate/)
  assert.equal(calls,1)
})

test('fully reconciled synthetic source can complete with explicit foreign country and zero India', async () => {
  const {jobs,audit}=await run(reconciledSynthetic)
  const evidence=readInventoryEvidence(jobs)
  assert.equal(audit.nativeJobs.length,1)
  assert.equal(audit.companyComplete,true)
  assert.equal(evidence.listingComplete,true)
  assert.equal(evidence.reportedTotal,1)
  assert.equal(evidence.indiaFacetCount,0)
})

test('a regional APAC hierarchy node is unresolved geography and cannot prove company zero India', async () => {
  const {jobs,audit}=await run(responses=>{
    reconciledSynthetic(responses)
    changeModel(responses['https://job-boards.eu.greenhouse.io/ebury'],data=>{
      const visit=n=>{if(n.name==='Spain')n.name='APAC';n.children.forEach(visit)}
      data['routes/$url_token'].offices.forEach(visit)
    })
  })
  assert.equal(audit.nativeJobs[0].country,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('a missing required internal native identity fails instead of becoming the text undefined', async () => {
  await assert.rejects(run(responses=>{
    reconciledSynthetic(responses)
    const apiUrl='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'
    const api=JSON.parse(responses[apiUrl].body);delete api.jobs[0].internal_job_id;responses[apiUrl].body=JSON.stringify(api)
    changeModel(responses['https://job-boards.eu.greenhouse.io/ebury'],data=>{delete data['routes/$url_token'].jobPosts.data[0].internal_job_id})
    changeModel(responses['https://job-boards.eu.greenhouse.io/ebury/jobs/5012714101'],data=>{delete data['routes/$url_token_.jobs_.$job_post_id'].jobPost.hiring_plan_id})
  }),/identity/)
})

test('same posting ID with closing country or criteria drift cannot complete', async () => {
  const responses=structuredClone(fixture.responses);reconciledSynthetic(responses)
  const apiUrl='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true';let apiCalls=0,audit
  const jobs=await createCatalogScraper(provider()).run({fetchPage:async url=>{
    const r=structuredClone(responses[url]);assert.ok(r,url)
    if(url===apiUrl&&++apiCalls===2){const api=JSON.parse(r.body);api.jobs[0].offices=[];api.jobs[0].content+='<p>Synthetic additional mandatory criteria</p>';r.body=JSON.stringify(api)}
    return r
  },onAudit:value=>{audit=value}})
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(audit.companyComplete,false)
  assert.ok(audit.reasons.some(r=>r.includes('closing-api')))
})

test('another advertised hiring channel with a proprietary URL prevents company completeness', async () => {
  const {jobs,audit}=await run(responses=>{
    reconciledSynthetic(responses)
    responses['https://ebury.com/company/careers'].body+='<a href="https://recruit.example.org/open">View open roles</a>'
  })
  assert.equal(audit.companyComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.ok(audit.reasons.includes('additional-advertised-hiring-channel-unresolved'))
})

const stableActualRun = async mutate => {
  let index=0,audit
  const counts=new Map()
  const jobs=await createCatalogScraper(provider()).run({fetchPage:async(url,options)=>{
    const response=structuredClone(stableFixture.responses[index++])
    assert.ok(response,'actual177 replay exhausted')
    assert.equal(response.url,url)
    assert.equal(options.method,'GET')
    const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
    mutate?.(response,occurrence)
    return response
  },onAudit:value=>{audit=value}})
  assert.equal(index,177)
  return {jobs,audit,evidence:readInventoryEvidence(jobs)}
}

test('unchanged actual177 closing envelopes preserve the complete140 zero-India positive control', async () => {
  const {jobs,audit,evidence}=await stableActualRun()
  assert.equal(jobs.length,0)
  assert.equal(audit.companyComplete,true)
  assert.equal(audit.nativeJobs.length,140)
  assert.equal(evidence.reportedTotal,140)
  assert.equal(evidence.indiaFacetCount,0)
})

test('actual177 closing native page count3 to4 cannot certify an unvisited closing page', async () => {
  const {jobs,audit,evidence}=await stableActualRun((response,occurrence)=>{
    if(response.url==='https://job-boards.eu.greenhouse.io/ebury'&&occurrence===2)changeModel(response,data=>{
      assert.equal(data['routes/$url_token'].jobPosts.total_pages,3)
      data['routes/$url_token'].jobPosts.total_pages=4
    })
  })
  assert.equal(jobs.length,0)
  assert.equal(audit.nativeJobs.length,140)
  assert.equal(audit.companyComplete,false)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.ok(audit.nativeJobs.every(job=>job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
})

test('actual177 closing API hasMore continuation suppresses complete totals and zero-India proof', async () => {
  const {jobs,audit,evidence}=await stableActualRun((response,occurrence)=>{
    if(response.url==='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'&&occurrence===2){
      const api=JSON.parse(response.body);api.hasMore=true;response.body=JSON.stringify(api)
    }
  })
  assert.equal(jobs.length,0)
  assert.equal(audit.nativeJobs.length,140)
  assert.equal(audit.companyComplete,false)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.ok(audit.nativeJobs.every(job=>job.sourceListingComplete===false&&job.lifecycleCleanupAllowed===false))
})

for(const kind of ['native-pages','api-continuation'])test(`closing ${kind} drift retains independently healthy synthetic India rows with partial evidence`, async () => {
  const responses=structuredClone(fixture.responses);reconciledSynthetic(responses);syntheticSecondaryIndia(responses)
  const counts=new Map();let audit
  const jobs=await createCatalogScraper(provider()).run({fetchPage:async url=>{
    const response=structuredClone(responses[url]);assert.ok(response,url)
    const occurrence=(counts.get(url)||0)+1;counts.set(url,occurrence)
    if(kind==='native-pages'&&url==='https://job-boards.eu.greenhouse.io/ebury'&&occurrence===2)changeModel(response,data=>{data['routes/$url_token'].jobPosts.total_pages=2})
    if(kind==='api-continuation'&&url==='https://boards-api.greenhouse.io/v1/boards/ebury/jobs?content=true'&&occurrence===2){const api=JSON.parse(response.body);api.hasMore=true;response.body=JSON.stringify(api)}
    return response
  },onAudit:value=>{audit=value}})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(audit.companyComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
