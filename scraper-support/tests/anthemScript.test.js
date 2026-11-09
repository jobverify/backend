import assert from 'node:assert/strict'
import test from 'node:test'

// Set before importing the scraper, registration, or fixture helpers.
globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const anthem=await import('../../scraper/anthem/script.js')
const{scenario}=await import('./peopleStrongNativePair20261027.fixtures.js')
const{readInventoryEvidence}=await import('../utils/inventoryEvidence.js')
const{getScraperCatalog}=await import('../providers/index.js')

test('Anthem public metadata and search builder expose the current verified 45-row protocol',()=>{
 assert.equal(anthem.SOURCE,'anthem');assert.equal(anthem.COMPANY,'Anthem')
 assert.equal(anthem.HOMEPAGE_URL,'https://anthembio.com/')
 assert.equal(anthem.CAREERS_PAGE_URL,'https://anthembio.com/careers/')
 assert.equal(anthem.PORTAL_ORIGIN,'https://anthemhrcp.peoplestrong.com')
 assert.equal(anthem.JOB_LISTINGS_URL,'https://anthemhrcp.peoplestrong.com/')
 assert.equal(anthem.DEFAULT_PAGE_SIZE,45);assert.deepEqual(anthem.DEFAULT_SEARCH_BODY,{})
 assert.equal(anthem.buildApiUrl(),'https://anthemhrcp.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=0&limit=45')
 assert.equal(anthem.buildApiUrl({offset:45}),'https://anthemhrcp.peoplestrong.com/api/cp/rest/altone/cp/jobs/v1?offset=45&limit=45')
 assert.equal(getScraperCatalog().find(p=>p.source==='anthem').jobsApiUrl,anthem.buildApiUrl())
 assert.throws(()=>anthem.buildApiUrl({offset:0,limit:20}),/45|reviewed/i)
 assert.throws(()=>anthem.buildApiUrl({offset:-1}),/offset/i)
})

test('Anthem factory injection reads a synthetic full native role rather than publishing its listing preview',async()=>{
 // Explicitly synthetic future role, not a claim about the current public board.
 const s=scenario('anthem');let report
 const jobs=await anthem.createAnthemScraper({fetchPage:s.fetchPage,now:'2026-10-27T06:00:00Z'}).run({onReport:r=>{report=r}})
 assert.equal(jobs.length,1);assert.match(jobs[0].jobDescription,/Full native responsibilities & safety/)
 assert.doesNotMatch(jobs[0].jobDescription,/PREVIEW|PRIVATE|HIDDEN|INERT/)
 assert.equal(jobs[0].postingId,'P-9001');assert.equal(jobs[0].requisitionId,'1800001')
 assert.deepEqual(jobs[0].qualifications,['B.Tech','Safety diploma']);assert.deepEqual(jobs[0].requiredSkills,['Process safety','CAD'])
 assert.equal(report.nativeInventoryComplete,true);assert.equal(report.sourceScopeComplete,true)
 const searches=s.calls.filter(c=>c.url.includes('jobs/v1?'));assert.equal(searches.length,4)
 for(const c of searches){assert.equal(c.method,'POST');assert.equal(c.body,'{}');assert.match(c.url,/limit=45$/)}
 assert.equal(s.calls.some(c=>c.method==='GET'&&c.url.includes('/job/P-9001/v2?part=basic,organisational,descriprion,workflow,skill,qualification,certification,language,applied&isReqId=false')),true)
 assert.equal(s.calls.some(c=>c.method==='GET'&&c.url.endsWith('organizationDetails?jobCode=P-9001')),true)
})

test('synthetic Anthem corporate five/native zero stays partial and legacy listing-only injection fails closed',async()=>{
 // Historical HTTP captures are unavailable. Exercise the count mismatch using
 // the self-contained protocol scenario without claiming it is a live replay.
 const s=scenario('anthem',{corporateCount:5,empty:true})
 let report
 const jobs=await anthem.createAnthemScraper().run({fetchPage:s.fetchPage,now:'2026-10-27T06:00:00Z',onReport:r=>{report=r}})
 assert.deepEqual(jobs,[]);assert.equal(report.delegation.advertisedCount,5);assert.equal(report.reportedNativeTotal,0)
 assert.equal(report.advertisedCountMismatch,true);assert.equal(report.sourceScopeComplete,false)
 assert.equal(report.rawJobs,null);assert.equal(report.verifiedZeroInventory,false);assert.equal(readInventoryEvidence(jobs).status,'discovery-only')
 let legacyCalls=0;await assert.rejects(anthem.createAnthemScraper().run({fetchJson:async()=>{legacyCalls++;return{totalRecords:0,response:null}}}),/Listing-only injection/);assert.equal(legacyCalls,0)
})

test('Anthem current first-party handoff, portal shell and native client drift stop before search',async()=>{
 for(const stage of ['corporate-brand','corporate-handoff','portal-shell','native-client']){
  const s=scenario('anthem'),original=s.fetchPage
  const fetchPage=async(url,init)=>{const r=await original(url,init);let body=r.body
   if(url==='https://anthembio.com/careers/'&&stage==='corporate-brand')body=body.replace('Careers - Anthem','Careers - Other Company')
   if(url==='https://anthembio.com/careers/'&&stage==='corporate-handoff')body=body.replace('https://anthemhrcp.peoplestrong.com/','https://example.com/jobs')
   if(url==='https://anthemhrcp.peoplestrong.com/'&&stage==='portal-shell')body='<title>Unexpected Portal</title>'
   if(url.endsWith('/main-PUBLIC123.js')&&stage==='native-client')body='public client with no advertised job module'
   return{...r,body,html:body}
  }
  await assert.rejects(anthem.createAnthemScraper().run({fetchPage}),/corporate brand|official native delegation|app shell|job module/i,stage)
  assert.equal(s.calls.some(c=>c.url.includes('jobs/v1?')),false,stage)
 }
})
