import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import * as source from '../../scraper/lindeindia/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const fixture = name => JSON.parse(readFileSync(new URL(`./fixtures/lindeindia/${name}.json`, import.meta.url)))
const apiBase = 'https://leindiacareers.peoplestrong.com/api/cp/rest/altone/cp/'
const detailUrl = apiBase + 'job/LEI_STM_1871499/v2?part=basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied&isReqId=false'
const homepageHtml = '<title>Linde in India | A Linde Company</title><a href="https://www.lindecareers.com/">Careers</a><a href="https://www.linde.com/">Corporate</a>'
const locationsHtml = `Job location information, related details and applications. Asia India <a href="${source.ENGINEERING_PORTAL_URL}">Linde Engineering</a><a href="${source.INDIA_GASES_URL}">Gases</a><a href="${source.INDIA_ITSC_URL}">ITSC</a>`
const portalHtml = '<title>Candidate Portal</title><body class="candidate-portal"><app-root data-testid="src-index-app-root-page-1"></app-root><script src="main-3V5KPFGK.js"></script></body>'
const listing = () => ({...fixture('listing'),response:fixture('listing').response.slice(0,1),totalRecords:1})
const fetchPage = async (url, {signal}={}) => ({status:url===source.ENGINEERING_PORTAL_URL?404:200,url,html:url===source.HOMEPAGE_URL?homepageHtml:url===source.JOB_LOCATIONS_URL?locationsHtml:portalHtml})
const run = (payload=listing(), detail=fixture('detail'), options={}) => {
  const requests=[]
  const promise=source.run({maxPages:1,fetchPage,fetchJson:async (url,request={})=>{
    requests.push({url,...request})
    if(url===apiBase+'urlinfo')return fixture('urlinfo')
    if(url===apiBase+'layout?isPreview=false')return fixture('layout')
    if(url===source.buildApiUrl({limit:options.pageSize??20}))return payload
    if(url===detailUrl)return detail
    throw Error(`Unexpected Linde native API: ${url}`)
  },...options})
  return {promise,requests}
}

test('Linde recovers role-specific native description and preserves actual employer lifecycle and employment fields',async()=>{
  const controller=new AbortController()
  const result=run(listing(),fixture('detail'),{signal:controller.signal})
  const jobs=await result.promise
  assert.equal(jobs.length,1)
  const job=jobs[0]
  assert.match(job.jobDescription,/Resolve standard incidents and service requests/)
  assert.equal(job.sourceDescription,job.jobDescription)
  assert.match(job.jobDescriptionHtml,/<h2/)
  assert.equal(job.jobId,'LEI/STM/1871499')
  assert.equal(job.requisitionId,'1871499')
  assert.equal(job.location,'Vadodara, Gujarat, India')
  assert.equal(job.city,'Vadodara')
  assert.equal(job.state,'Gujarat')
  assert.equal(job.employmentType,'Third Party Agency')
  assert.equal(job.postingDate,'2026-10-23')
  assert.equal(job.closingDate,'2026-11-06')
  assert.equal(job.applyUrl,'https://leindiacareers.peoplestrong.com/job/detail/LEI_STM_1871499')
  assert.equal(result.requests.find(r=>r.url===detailUrl).method,'GET')
  assert.equal(result.requests.find(r=>r.url===detailUrl).body,undefined)
  assert.ok(result.requests.every(r=>r.signal===controller.signal))
  assert.equal(readInventoryEvidence(jobs)?.status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete,false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null)
  assert.equal(job.sourceListingComplete,false)
})

test('Linde cannot infer India from employer alone or a missing/contradictory location',()=>{
  const payload=listing()
  payload.response[0].locationHierarchyComplete='Germany>Bavaria>Munich>Munich'
  payload.response[0].locationHierarchy='Munich'
  assert.deepEqual(source.extractEngineeringJobs(payload),[])
  payload.response[0].locationHierarchyComplete=null
  payload.response[0].locationHierarchy=null
  assert.throws(()=>source.extractEngineeringJobs(payload),/location|country/i)
  const conflict=listing();conflict.response[0].country='Germany'
  assert.throws(()=>source.extractEngineeringJobs(conflict),/location|country/i)
})

test('Linde rejects another employer in India and off-tenant application identities',()=>{
  const foreign=listing();foreign.response[0].organizationUnitComplete='Other Employer>Engineering'
  assert.throws(()=>source.extractEngineeringJobs(foreign),/employer|identity/i)
  const invalid=listing();invalid.response[0].jobDetailUrl='https://unrelated.example/job/detail/LEI_STM_1871499'
  assert.throws(()=>source.extractEngineeringJobs(invalid),/identity|application|tenant/i)
})

test('Linde rejects substituted, closed or location-conflicting native details',async()=>{
  for(const mutate of [d=>{d.response.requisitionCode='LEI/OTHER/1'},d=>{d.response.requisitionId='1'},d=>{d.response.entityID='1397'},d=>{d.response.jobTitle='Other role'},d=>{d.response.organizationUnitComplete='Other employer'},d=>{d.response.locationHierarchyComplete='Germany>Bavaria>Munich>Munich'},d=>{d.response.requisitionStatus='CLOSED'},d=>{d.response.CandidatePortalEndDate='2027-11-06 00:00:00.0'}]){
    const detail=fixture('detail');mutate(detail)
    await assert.rejects(run(listing(),detail).promise,/detail|identity|employer|location|open|lifecycle/i)
  }
})

test('Linde rejects empty/placeholder descriptions instead of creating employer content',async()=>{
  for(const description of ['', '<p>Apply now</p>','<template>Develop engineering systems.</template>']){
    const detail=fixture('detail');detail.response.jobDescription=description
    await assert.rejects(run(listing(),detail).promise,/description|content/i)
  }
})

test('Linde does not treat malformed or truncated listing responses as verified empty',async()=>{
  for(const payload of [{error:'unavailable'},{response:[],totalRecords:28,messageCode:{code:200}},{...listing(),totalRecords:0}]){
    await assert.rejects(run(payload).promise,/listing|inventory|total/i)
  }
})

test('Linde requires independently matching tenant metadata behind its expected404 shell',async()=>{
  for(const mutate of [p=>{p.response.realm=1397},p=>{p.response.url='unrelated.peoplestrong.com'},p=>{p.response.leftLogo='https://static.peoplestrong.com/tenant_1/org_1/logo.png'}]){
    const info=fixture('urlinfo');mutate(info)
    await assert.rejects(run(listing(),fixture('detail'),{fetchJson:async url=>url.endsWith('/urlinfo')?info:fixture('layout')}).promise,/tenant|identity|branding/i)
  }
  await assert.rejects(run(listing(),fixture('detail'),{fetchPage:async url=>({...await fetchPage(url),url:'https://unrelated.example/'})}).promise,/official|identity|redirect/i)
})

test('an empty verified Engineering listing cannot establish empty whole-company India inventory',async()=>{
  const result=run({...listing(),response:[],totalRecords:0})
  const jobs=await result.promise
  assert.deepEqual(jobs,[])
  assert.equal(readInventoryEvidence(jobs)?.status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs)?.listingComplete,false)
  assert.equal(readInventoryEvidence(jobs)?.reportedTotal,null)
  assert.equal(readInventoryEvidence(jobs)?.indiaFacetCount,null)
  assert.match(readInventoryEvidence(jobs)?.reason,/Gases.*ITSC/i)
  assert.equal(readInventoryEvidence(jobs)?.pagesFetched,1)
})

test('Linde publisher handoffs must be active HTML anchors rather than comment, template or script lookalikes',()=>{
  for(const wrap of [html=>`<!--${html}-->`,html=>`<template>${html}</template>`,html=>`<script>${html}</script>`,html=>`<div hidden>${html}</div>`]){
    assert.equal(source.hasOfficialHomepageSignal(wrap(homepageHtml)),false)
    assert.equal(source.hasOfficialJobLocationsSignal(wrap(locationsHtml)),false)
  }
})

test('Linde honors the actual active India modal metadata component and rejects inactive or mismatched model content',()=>{
  const modalHtml=readFileSync(new URL('./fixtures/lindeindia/locations-binding.html',import.meta.url),'utf8')
  assert.equal(source.hasOfficialJobLocationsSignal(modalHtml),true)
  for(const html of [`<!--${modalHtml}-->`,`<template>${modalHtml}</template>`,`<script>${modalHtml}</script>`,modalHtml.replace('>India</a>','>Germany</a>')]){
    assert.equal(source.hasOfficialJobLocationsSignal(html),false)
  }
  const modal=fixture('india-modal')
  modal.Content=modal.Content.replace('<a rel="noopener noreferrer" href="https://leindiacareers.peoplestrong.com/home"','<a hidden rel="noopener noreferrer" href="https://leindiacareers.peoplestrong.com/home"')
  const attributes=JSON.stringify(modal).replaceAll('&','&amp;').replaceAll("'",'&#39;')
  assert.equal(source.hasOfficialJobLocationsSignal(`Job location information, related details and applications. Asia <a href="#" data-modal-target='${attributes}'>India</a>`),false)
})

test('Linde bounded native reads cannot claim complete source inventory',async()=>{
  const jobs=await run({...listing(),totalRecords:28},fixture('detail'),{pageSize:1,maxJobs:1,maxPages:1}).promise
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.equal(readInventoryEvidence(jobs)?.status,'discovery-only')
})

test('Linde propagates cancellation and starts no work when already aborted',async()=>{
  const controller=new AbortController();const reason=Error('caller stopped Linde');controller.abort(reason)
  let io=0
  await assert.rejects(source.run({signal:controller.signal,fetchPage:async()=>{io++;return {}},fetchJson:async()=>{io++;return {}}}),error=>error===reason)
  assert.equal(io,0)
})

test('Linde starts no layout request after cancellation during native tenant lookup',async()=>{
  const controller=new AbortController(),requests=[]
  const reason=Error('stop during tenant lookup')
  await assert.rejects(source.run({signal:controller.signal,fetchPage,fetchJson:async url=>{
    requests.push(url)
    if(url===apiBase+'urlinfo'){controller.abort(reason);return fixture('urlinfo')}
    return fixture('layout')
  }}),error=>error===reason)
  assert.deepEqual(requests,[apiBase+'urlinfo'])
})

test('actual Engineering role1812584 can omit its optional detail organization while exact listing employer and native entity remain corroborated',async()=>{
  const payload=fixture('null-detail-org-listing'),detail=fixture('null-detail-org-detail')
  const execute=()=>source.run({fetchPage,maxJobs:1,fetchJson:async url=>{
    if(url.endsWith('/urlinfo'))return fixture('urlinfo')
    if(url.endsWith('/layout?isPreview=false'))return fixture('layout')
    if(url.includes('/cp/jobs/v1?'))return payload
    if(url===source.buildJobDetailsApiUrl('LEI/EE/1812584'))return detail
    throw Error('Unexpected optional organization API '+url)
  }})
  const jobs=await execute()
  assert.equal(jobs[0].jobId,'LEI/EE/1812584')
  assert.equal(jobs[0].postingDate,'2026-09-07')
  assert.equal(jobs[0].closingDate,'2026-10-31')
  assert.equal(jobs[0].sourceClosingDateIsExact,false)
  assert.deepEqual(jobs[0].sourceNativeOrganizationEvidence,{listingPath:payload.response[0].organizationUnitComplete,detailPath:null,legalEmployer:'Linde Engineering India Pvt. Ltd.',entityID:'1475'})
  assert.match(jobs[0].sourceDescription,/managing sourcing activities/)
  for(const change of [d=>{d.entityID='1397'},d=>{d.requisitionCode='LEI/EE/1'},d=>{d.requisitionId='1'},d=>{d.jobTitle='Other role'},d=>{d.locationHierarchyComplete='Germany>Bavaria>Munich'},d=>{d.requisitionStatus='CLOSED'},d=>{d.organizationUnitComplete='Other Employer>Procurement'},d=>{d.organizationUnitComplete=''}]){
    const original=structuredClone(detail.response);change(detail.response)
    await assert.rejects(execute(),/detail|identity|employer|location|open/i)
    detail.response=original
  }
  payload.response[0].organizationUnitComplete='Other Employer>Procurement'
  await assert.rejects(execute(),/employer|identity/i)
})

test('Linde stops queued details and waits for active requests after the first failure',async()=>{
  const rows=fixture('listing').response
  const failure=Error('first detail identity failure')
  let releaseSecond,secondStarted,activeSettled=false,earlyRejection=false
  const secondActive=new Promise(resolve=>{secondStarted=resolve})
  const details=[]
  const result=source.run({maxPages:1,fetchPage,detailConcurrency:2,fetchJson:async url=>{
    if(url.endsWith('/urlinfo'))return fixture('urlinfo')
    if(url.endsWith('/layout?isPreview=false'))return fixture('layout')
    if(url===source.buildApiUrl())return {...fixture('listing'),totalRecords:3}
    details.push(url)
    if(url===detailUrl)throw failure
    if(details.length===2){secondStarted();await new Promise(resolve=>{releaseSecond=resolve});activeSettled=true;throw Error('second request settled')}
    throw Error('queued request after failure')
  }}).catch(error=>{earlyRejection=!activeSettled;return error})
  await Promise.race([secondActive,result.then(()=>{throw Error('native detail requests were never started')})])
  await new Promise(resolve=>setImmediate(resolve))
  releaseSecond()
  assert.equal(await result,failure)
  assert.equal(earlyRejection,false)
  assert.equal(details.length,2)
})
