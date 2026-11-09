import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createRaveTechnologiesScraper,SUCCESSOR_HOMEPAGE_URL,CAREERS_URL,SMARTRECRUITERS_BOARD_URL,SMARTRECRUITERS_LISTING_API_URL} from '../scraper/ravetechnologies/script.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
import {inventoryCleanupOptions} from '../scraper-support/utils/scraperOutcome.js'

const detail=JSON.parse(readFileSync(new URL('./test-data/recruitmentGoal20261106/rave-current-detail.json',import.meta.url)))
const listing=()=>({id:detail.id,name:detail.name,company:detail.company,location:detail.location,releasedDate:detail.releasedDate,visibility:'PUBLIC',ref:`${SMARTRECRUITERS_LISTING_API_URL}/${detail.id}`,postingUrl:detail.postingUrl,applyUrl:detail.applyUrl})
const fetchText=async url=>url===SUCCESSOR_HOMEPAGE_URL?'<title>NEC Software Solutions - Orchestrating a Brighter World</title><h1>NEC Software Solutions</h1><a href="https://www.necsws.com/india/careers/">Careers</a>':url===CAREERS_URL?'<title>Careers - NEC Software Solutions</title><h1>Careers</h1><a href="https://jobs.smartrecruiters.com/NECSWS/123-role">Jobs</a>':url===SMARTRECRUITERS_BOARD_URL?'<title>Careers at NECSWS</title><script>window._jsErrorTrackerOptions={}</script><div id="career-site-ui"></div>':assert.fail(`Unexpected page ${url}`)
const run=(options={},maxJobs=null)=>{
 const requests=[]
 return {requests,promise:createRaveTechnologiesScraper({maxJobs}).run({fetchText,fetchJson:async url=>{requests.push(url);return url.includes('/postings?')?{offset:0,limit:100,totalFound:1,content:[listing()]}:structuredClone(detail)},...options})}
}

test('Rave preserves current native qualifications when the native jobDescription section is empty and proves a closing listing',async()=>{
 const {promise,requests}=run();const jobs=await promise
 assert.equal(jobs.length,1)
 assert.match(jobs[0].jobDescription,/minimum 5\+ years in Java\/Javascript programming experience/)
 assert.match(jobs[0].jobDescription,/Our philosophy is to understand our customers/)
 assert.doesNotMatch(jobs[0].jobDescription,/Apply via the NEC/)
 assert.equal(jobs[0].postingDate,detail.releasedDate)
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].applyUrl,detail.applyUrl)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
 assert.equal(jobs[0].sourceScopeComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete,true)
 assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,true)
 assert.deepEqual(inventoryCleanupOptions({inventoryEvidence:readInventoryEvidence(jobs)}),{replaceExisting:false})
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,1)
 assert.equal(requests.filter(u=>u.includes('/postings?')).length,2)
})

test('Rave rejects listing/detail identity, country, date and role-URL contradictions',async()=>{
 const mutations=[d=>d.id='foreign',d=>d.name='Different role',d=>d.company.identifier='FOREIGN',d=>d.location.country='gb',d=>d.releasedDate='2020-01-01',d=>d.postingUrl='https://jobs.smartrecruiters.com/FOREIGN/744000159056770-role',d=>d.applyUrl='https://jobs.smartrecruiters.com/NECSWS/other-role?oga=true',d=>d.active=false]
 for(const mutate of mutations){const changed=structuredClone(detail);mutate(changed);await assert.rejects(run({fetchJson:async url=>url.includes('/postings?')?{totalFound:1,content:[listing()]}:changed}).promise,/Rave native.*(?:identity|country|date|URL|active)/i)}
})

test('Rave company boilerplate alone cannot replace missing role criteria',async()=>{
 const changed=structuredClone(detail);changed.jobAd.sections.qualifications.text='';changed.jobAd.sections.additionalInformation.text=''
 await assert.rejects(run({fetchJson:async url=>url.includes('/postings?')?{totalFound:1,content:[listing()]}:changed}).promise,/Rave native.*criteria/i)
})

test('Rave refuses unknown advertised native criteria sections instead of silently omitting them',async()=>{
 const changed=structuredClone(detail)
 changed.jobAd.sections.mandatoryRequirements={title:'Mandatory Requirements',text:'Must hold a valid professional certification before applying.'}
 await assert.rejects(run({fetchJson:async url=>url.includes('/postings?')?{totalFound:1,content:[listing()]}:changed}).promise,/Rave native.*unknown.*section/i)
})

test('Rave preserves complete roles and reports an unpublishable native role without certifying complete coverage',async()=>{
 const missing=structuredClone(detail);missing.id='744000131629039';missing.name='Native role without criteria';missing.postingUrl=`https://jobs.smartrecruiters.com/NECSWS/${missing.id}-native-role`;missing.applyUrl=missing.postingUrl+'?oga=true';missing.jobAd.sections.jobDescription.text='';missing.jobAd.sections.qualifications.text='';missing.jobAd.sections.additionalInformation.text=''
 const missingListing={...listing(),id:missing.id,name:missing.name,postingUrl:missing.postingUrl,applyUrl:missing.applyUrl,ref:`${SMARTRECRUITERS_LISTING_API_URL}/${missing.id}`}
 const jobs=await run({fetchJson:async url=>url.includes('/postings?')?{totalFound:2,content:[listing(),missingListing]}:url.endsWith(missing.id)?missing:detail}).promise
 assert.equal(jobs.length,1)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,2)
 assert.equal(jobs[0].sourceListingComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].nativeCollectionEvidence.candidateDetails,2)
 assert.equal(jobs[0].nativeCollectionEvidence.extractedDetailJobs,1)
 assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1)
 assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,true)
})

test('Rave does not request a detail URL supplied by a foreign listing',async()=>{
 let detailReads=0;const changed=listing();changed.ref='https://foreign.example/role'
 await assert.rejects(run({fetchJson:async url=>{if(url.includes('/postings?'))return{totalFound:1,content:[changed]};detailReads++;return detail}}).promise,/Rave native.*URL/i)
 assert.equal(detailReads,0)
})

test('Rave capped collection cannot certify inventory completeness',async()=>{
 const jobs=await run({},1).promise
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})

test('Rave refuses incomplete pagination and changed closing inventory',async()=>{
 let reads=0
 await assert.rejects(run({fetchJson:async url=>{if(!url.includes('/postings?'))return detail;if(++reads===1)return{totalFound:2,content:[listing()]};return{totalFound:2,content:[]}}}).promise,/Rave native.*pagination/i)
 reads=0
 await assert.rejects(run({fetchJson:async url=>{if(!url.includes('/postings?'))return detail;const row=listing();if(++reads>1)row.name='Changed during collection';return{totalFound:1,content:[row]}}}).promise,/Rave native.*closing/i)
})

test('Rave caller cancellation remains opaque and aggregate deadline bounds uncooperative transports',async()=>{
 const controller=new AbortController(),reason={opaque:'caller cancellation'};controller.abort(reason)
 await assert.rejects(run({signal:controller.signal}).promise,error=>error===reason)
 await assert.rejects(run({collectionTimeoutMs:20,fetchText:async()=>new Promise(()=>{})}).promise,/Rave native.*deadline/i)
})

test('Rave immediate caller cancellation prevents the queued operation from invoking any transport',async()=>{
 const controller=new AbortController(),reason={opaque:'cancel before queued operation'};let calls=0
 const promise=createRaveTechnologiesScraper().run({signal:controller.signal,fetchText:async()=>{calls++;return new Promise(()=>{})}})
 controller.abort(reason)
 await assert.rejects(promise,error=>error===reason)
 await Promise.resolve()
 assert.equal(calls,0)
})

test('Rave public access denial stops after one exact request without challenge retry',async()=>{
 const actual=globalThis.fetch;let calls=0
 globalThis.fetch=async()=>{calls++;return new Response('Access denied',{status:403})}
 try{await assert.rejects(createRaveTechnologiesScraper().run(),/HTTP 403/);assert.equal(calls,1)}finally{globalThis.fetch=actual}
})
