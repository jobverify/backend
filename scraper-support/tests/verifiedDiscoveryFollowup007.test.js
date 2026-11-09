import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { createCatalogScraper, getScraperCatalog } from '../providers/index.js'
import { loadConfig } from '../utils/loadConfig.js'
import { attachInventoryEvidence, readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { analyzePublishableJobs } from '../utils/publishableJobMetrics.js'

const fixture = JSON.parse(fs.readFileSync(new URL('./fixtures/discovery-workday-007/blackberry-native.json',import.meta.url)))
const catalog = getScraperCatalog()
const provider = source => catalog.find(p=>p.source===source)
const scheduler = { acquire:async()=>()=>{},recordRateLimit:()=>{},minIntervalMs:0 }
const mock = (t,change=()=>{},boards=fixture.boards) => t.mock.method(globalThis,'fetch',async(url,init={})=>{
  url=String(url)
  const match=new URL(url).pathname.match(/^\/wday\/cxs\/bb\/([^/]+)(.*)$/)
  if (!match) return new Response('<html>BlackBerry careers</html>',{status:200})
  const [,site,part]=match,board=boards[site]
  assert.ok(board,'Unexpected board '+site)
  let data
  if(part==='/jobs'){
    const payload=JSON.parse(init.body)
    assert.equal(payload.searchText,'')
    assert.deepEqual(payload.appliedFacets,site==='Student'?{}:{Country:['c4f78be1a8f14da0ab49ce1162348a5e']})
    assert.equal(payload.offset,0)
    data=structuredClone(board.listing)
  }else data=structuredClone(board.details[part])
  assert.ok(data,'Unexpected native URL '+url)
  change(data,site,part)
  return Response.json(data)
})

test('four exact registered identities retain their sources and use verified Workday routes without aliases',()=>{
  for(const source of ['blackberry','blackrock','blackstone','blueorigin']){
    assert.equal(catalog.filter(row=>row.source===source).length,1)
    const p=provider(source)
    assert.equal(p.atsPlatform,'workday')
    assert.equal(p.boardIdentityVerified,true)
    assert.equal(p.bindingEvidence.verified,true)
    assert.equal(p.verifiedPublicJobCount,null)
    assert.equal(p.verifiedIndiaJobCount,null)
    assert.notEqual(p.verificationDisposition,'no-trustworthy-exact-name-public-jobs-flow-verified-locally')
  }
  assert.equal(catalog.some(p=>p.source==='qnx'),false)
})

test('unfiltered sources never install an unobserved generic country facet',()=>{
  for(const source of ['blackrock','blackstone','blueorigin']){
    const p=provider(source),config=loadConfig(p.sourceDirectory)
    assert.equal(config.listingStrategy,'jobs-api')
    assert.equal(config.locationCountry,null)
    assert.equal(config.searchText,'')
    assert.equal(config.jobsApiUrl.includes('/wday/cxs/'),true)
    assert.ok(config.workdayMaxPages>=Math.ceil(({blackrock:286,blackstone:146,blueorigin:1833})[source]/20))
  }
})

test('BlackRock verified India facet fallback fetches every opaque native office rather than treating commas as foreign',()=>{
  const config=loadConfig(path.join(provider('blackrock').sourceDirectory,'boards/india-fallback'))
  assert.equal(config.locationPattern,'.*')
})

test('actual M11 three-row native listing retains all full India details under the source fallback config',async t=>{
  const native=JSON.parse(fs.readFileSync(new URL('./fixtures/discovery-workday-007/blackrock-m11-native.json',import.meta.url)))
  t.mock.method(globalThis,'fetch',async(url,init={})=>{
    const suffix=String(url).split('/wday/cxs/blackrock/BlackRock_Professional')[1]
    if(!suffix)return new Response('<html>BlackRock native board</html>')
    if(suffix==='/jobs')return Response.json(native.listing)
    assert.ok(native.details[suffix],'Unexpected M11 detail '+suffix)
    return Response.json(native.details[suffix])
  })
  const {runVerifiedWorkdayBoardUnion}=await import('../shared/workdayBoardUnion.js')
  const jobs=await runVerifiedWorkdayBoardUnion({source:'blackrock',company:'BlackRock',employerPattern:/BlackRock/,requireEmployer:false,completeSourceScope:false,
    boards:[{tenant:'blackrock',site:'BlackRock_Professional',baseUrl:'https://blackrock.wd1.myworkdayjobs.com/en-US/BlackRock_Professional?locations=866218765a69100195e38a8b9cc40000',scraperDir:path.join(provider('blackrock').sourceDirectory,'boards/india-fallback')}]},
    {requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000})
  assert.equal(jobs.length,3)
  assert.ok(jobs.every(j=>j.country==='India' && /M11/.test(j.location) && j.sourceDetailComplete && j.sourceDescription.length>1000))
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('BlackBerry unions all three official boards and deduplicates only matching native requisition/employer/content',async t=>{
  mock(t)
  const jobs=await createCatalogScraper(provider('blackberry')).run({requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000})
  assert.equal(jobs.length,2)
  assert.deepEqual(jobs.map(j=>j.requisitionId).sort(),['20250320','20260163'])
  const duplicate=jobs.find(j=>j.requisitionId==='20250320')
  assert.equal(duplicate.jobId,'20250320')
  assert.equal(duplicate.nativeBoardProvenance.length,2)
  assert.deepEqual(duplicate.nativeBoardProvenance.map(p=>p.site),['BlackBerry','QNX'])
  assert.equal(duplicate.nativeEmployer,'5300 BlackBerry India Private Limited')
  assert.equal(duplicate.postedAt,'2026-09-18T00:00:00.000Z')
  assert.equal(duplicate.sourceDescription,fixture.boards.BlackBerry.details[Object.keys(fixture.boards.BlackBerry.details)[0]].jobPostingInfo.jobDescription)
  assert.equal(jobs[0].sourceBoardInventories.length,3)
  assert.equal(jobs[0].sourceBoardDuplicateCount,1)
  assert.equal(jobs[0].sourceGlobalJobCount,null)
  assert.equal(readInventoryEvidence(jobs).listingComplete,true)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,2)
})

for(const [name,change]of[
 ['wrong native board',(d,s,p)=>{if(s==='QNX'&&p!=='/jobs')d.jobPostingInfo.jobPostingSiteId='Other'}],
 ['duplicate description conflict',(d,s,p)=>{if(s==='QNX'&&p!=='/jobs'&&d.jobPostingInfo.jobReqId==='20250320')d.jobPostingInfo.jobDescription+='<p>Changed duties</p>'}],
 ['wrong employer',(d,s,p)=>{if(s==='QNX'&&p!=='/jobs')d.hiringOrganization.name='Unrelated employer'}],
 ['future publication',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.startDate='2099-01-01'}],
 ['impossible calendar',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.startDate='2026-02-30'}],
 ['inactive application',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.canApply=false}],
 ['error envelope',(d,s,p)=>{if(p!=='/jobs')d.error='upstream error'}],
 ['Student partial zero',(d,s,p)=>{if(s==='Student'&&p==='/jobs')d.total=1}],
 ['foreign country contradicts selected India facet',(d,s,p)=>{if(p!=='/jobs'){d.jobPostingInfo.country={descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09'};d.jobPostingInfo.jobRequisitionLocation.country={descriptor:'United States of America',id:'bc33aa3152ec42d4995f4791a106ed09',alpha2Code:'US'}}}],
 ['country code contradiction',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.jobRequisitionLocation.country.alpha2Code='US'}],
 ['wrong canonical',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.externalUrl='https://example.com/unrelated'}],
 ['missing native posted state',(d,s,p)=>{if(p!=='/jobs')delete d.jobPostingInfo.posted}],
 ['wrong requisition',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.jobReqId='unrelated'}],
 ['wrong native posting UID',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.id='unavailable'}],
 ['explicit foreign primary label under India country',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.location='New York, United States of America'}],
 ['explicit foreign address under India country',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.jobRequisitionLocation.descriptor='New York, United States of America'}],
 ['foreign terminal ISO code under India country',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.location='New York, US'}],
 ['foreign terminal ISO address code under India country',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.jobRequisitionLocation.descriptor='Sydney, AU'}],
 ['nonprimitive native posting UID',(d,s,p)=>{if(p!=='/jobs')d.jobPostingInfo.id=[d.jobPostingInfo.id]}],
])test('BlackBerry rejects '+name+' without inherited success or zero',async t=>{
  mock(t,change)
  await assert.rejects(createCatalogScraper(provider('blackberry')).run({requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000}))
})

test('a source-scoped fallback can never inherit complete inventory or turn unknown coverage into zero',async t=>{
  mock(t)
  const helper=await import('../shared/workdayBoardUnion.js')
  assert.equal(typeof helper.runWorkdayWithPartialFallback,'function')
  const board={tenant:'bb',site:'BlackBerry',baseUrl:'https://bb.wd3.myworkdayjobs.com/en-US/BlackBerry',scraperDir:provider('blackberry').sourceDirectory}
  const failed={source:'blackberry',company:'BlackBerry',boards:[{...board,scraperDir:path.join(board.scraperDir,'missing-config')}],employerPattern:/BlackBerry/}
  const fallback={...failed,boards:[board],completeSourceScope:true}
  // A contract/config failure cannot activate a fallback intended only for
  // explicitly classified, incomplete native geography.
  await assert.rejects(helper.runWorkdayWithPartialFallback(failed,fallback,{requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000}),/config|incomplete|unavailable/)
})

test('classified unknown geography activates a truthful positive subset and forces company counts unknown',async t=>{
  let primaryDetailReturned=false
  mock(t,(data,site,part)=>{
    if(primaryDetailReturned)return
    if(part==='/jobs')data.jobPostings[0].locationsText='2 Locations'
    else{
      Object.assign(data.jobPostingInfo,{location:'Boston',additionalLocations:['UnknownCampus'],country:{descriptor:'United States of America'},jobRequisitionLocation:{country:{descriptor:'United States of America',alpha2Code:'US'}}})
      primaryDetailReturned=true
    }
  })
  const {runWorkdayWithPartialFallback}=await import('../shared/workdayBoardUnion.js')
  assert.equal(typeof runWorkdayWithPartialFallback,'function')
  const settings={source:'blackberry',company:'BlackBerry',employerPattern:/BlackBerry/,boards:[{tenant:'bb',site:'BlackBerry',baseUrl:'https://bb.wd3.myworkdayjobs.com/en-US/BlackBerry',scraperDir:provider('blackberry').sourceDirectory}]}
  const jobs=await runWorkdayWithPartialFallback(settings,settings,{requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.equal(jobs[0].sourceFullScopeFailure.failureKind,'incomplete_location_scope')
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

const futureStudentBoards=()=>{
  const boards=structuredClone(fixture.boards),row=structuredClone(boards.BlackBerry.listing.jobPostings[0])
  row.externalPath='/job/Hyderabad-India/Student-Native-Scope-Fixture_20269999'
  row.title='Student native scope fixture'
  row.bulletFields=['20269999']
  const detail=structuredClone(Object.values(boards.BlackBerry.details)[0]),info=detail.jobPostingInfo
  Object.assign(info,{id:'a'.repeat(32),jobReqId:'20269999',jobPostingSiteId:'Student',jobPostingId:row.externalPath.split('/').at(-1),title:row.title,externalUrl:'https://bb.wd3.myworkdayjobs.com/Student'+row.externalPath})
  boards.Student={listing:{total:1,jobPostings:[row]},details:{[row.externalPath]:detail}}
  return boards
}

test('a later nonempty Student board is enumerated and its native India role joins the union',async t=>{
  mock(t,()=>{},futureStudentBoards())
  const jobs=await createCatalogScraper(provider('blackberry')).run({requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000})
  assert.equal(jobs.length,3)
  assert.equal(jobs.find(j=>j.jobId==='20269999').nativeBoardProvenance[0].site,'Student')
  assert.equal(jobs[0].sourceBoardInventories.find(b=>b.site==='Student').explicitGlobalEmpty,false)
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,3)
})

test('a later Student role with unknown native geography rejects rather than reusing earlier global-empty evidence',async t=>{
  const boards=futureStudentBoards(),row=boards.Student.listing.jobPostings[0],info=Object.values(boards.Student.details)[0].jobPostingInfo
  row.locationsText='UnknownCampus'
  Object.assign(info,{location:'UnknownCampus',country:null,jobRequisitionLocation:{descriptor:'UnknownCampus',country:null}})
  mock(t,()=>{},boards)
  await assert.rejects(createCatalogScraper(provider('blackberry')).run({requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000}),/India scope/)
})

test('native date-only closing remains date-only and eligible through its current calendar day',async t=>{
  // Keep posting age eligible so this case isolates the date-only closing rule.
  mock(t,(data,site,part)=>{if(part!=='/jobs')Object.assign(data.jobPostingInfo,{startDate:'2026-10-19',endDate:'2026-10-20'})})
  const jobs=await createCatalogScraper(provider('blackberry')).run({requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000,now:()=> '2026-10-20T22:12:21.965Z'})
  assert.ok(jobs.every(j=>j.closingDate==='2026-10-20T00:00:00.000Z' && j.sourceClosingDateIsExact===false))
  assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-20T22:12:21.965Z')}).eligibleJobs.length,2)
  assert.equal(analyzePublishableJobs(jobs,{now:new Date('2026-10-21T00:00:00Z')}).eligibleJobs.length,0)
})

test('BlackRock finite foreign program scope is distinct from a partial Workday India inventory',async()=>{
  const {reconcileBlackRockEarlyCareers}=await import('../../scraper/blackrock.workday/script.js')
  assert.equal(typeof reconcileBlackRockEarlyCareers,'function')
  const f=JSON.parse(fs.readFileSync(new URL('./fixtures/blackrockTalnet/native-excerpts.json',import.meta.url)))
  const fetchText=async url=>url===f.apacUrl?f.apacHtml:f.corporate[url]||
    (url===f.applicationUrl?{status:200,body:f.applicationHtml,finalURL:f.applicationFinalUrl}:null)||
    (url===f.boardNavigationUrl||url==='https://blackrock.tal.net/vx/lang-en-GB/mobile-0/brand-3/candidate/jobboard/vacancy/1/adv/'?f.boardHtml:f.details[url])
  const partial=attachInventoryEvidence([{jobId:'Rscope',sourceListingComplete:false}],{status:'coverage-gap',surface:'https://blackrock.wd1.myworkdayjobs.com/BlackRock_Professional',firstParty:true,listingComplete:false,pagesFetched:3,reportedTotal:null,indiaFacetCount:null,verifiedAt:new Date().toISOString()})
  const jobs=await reconcileBlackRockEarlyCareers(partial,{fetchText})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceEarlyCareersInventory.reportedProgramRecords,13)
  assert.equal(jobs[0].sourceEarlyCareersInventory.observedIndia,0)
  assert.equal(readInventoryEvidence(jobs).listingComplete,false)
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})

test('future India or unknown early-career scope retains Workday positives with unknown company counts',async()=>{
  const {reconcileBlackRockEarlyCareers}=await import('../../scraper/blackrock.workday/script.js')
  assert.equal(typeof reconcileBlackRockEarlyCareers,'function')
  const partial=attachInventoryEvidence([{jobId:'Rscope',sourceListingComplete:true}],{status:'complete-inventory',surface:'https://blackrock.wd1.myworkdayjobs.com/BlackRock_Professional',firstParty:true,listingComplete:true,pagesFetched:1,reportedTotal:1,indiaFacetCount:1,verifiedAt:new Date().toISOString()})
  const jobs=await reconcileBlackRockEarlyCareers(partial,{fetchText:async()=>{throw Error('New India program requires native extraction')}})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceListingComplete,false)
  assert.match(jobs[0].sourceEarlyCareersFailure.message,/India/)
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('caller abort during the final native recheck cannot return a complete inventory from a transport that ignores abort',async t=>{
  const controller=new AbortController();let studentPosts=0
  mock(t,(data,site,part)=>{if(site==='Student'&&part==='/jobs'&&++studentPosts===2)controller.abort(new Error('Caller cancelled final recheck'))})
  await assert.rejects(createCatalogScraper(provider('blackberry')).run({signal:controller.signal,requestScheduler:scheduler,retryBaseDelayMs:0,requestTimeoutMs:1000}),/cancelled/)
  assert.equal(controller.signal.aborted,true)
})
