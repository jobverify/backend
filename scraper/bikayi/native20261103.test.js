import assert from'node:assert/strict'
import test from'node:test'
import{readFileSync}from'node:fs'
import{gunzipSync}from'node:zlib'
import{createBikayiScraper}from'./script.js'
import{readInventoryEvidence}from'../../scraper-support/utils/inventoryEvidence.js'
const rows=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url)))),pages=new Map(rows.map(row=>[row.requestedUrl,row]))
const active='https://comida.keka.com/careers/api/embedjobs/default/active/a4f89fc2-d9b6-49a1-b6c7-66522d4c7956',career='https://bik.ai/careers'
const seam=(change=()=>{})=>{const visits=new Map(),requests=[];return{requests,fetchPage:async(url,request)=>{assert.ok(pages.has(url),'missing current fixture '+url);requests.push(url);const page=structuredClone(pages.get(url)),visit=(visits.get(url)||0)+1;visits.set(url,visit);await change(page,{url,visit,request});return page}}}
async function run(change,options={}){let audit;const injected=seam(change),jobs=await createBikayiScraper().run({...injected,...options,onAudit:value=>{audit=value;return options.onAudit?.(value)}});return{jobs,audit,requests:injected.requests}}
const rewrite=(page,change)=>{const value=JSON.parse(page.body);change(value);page.body=JSON.stringify(value)}
test('Bikayi current BIK/Keka collector observes all12 public full roles and salvages4country-qualified jobs with8real gaps',async()=>{
 const{jobs,audit,requests}=await run();assert.equal(jobs.length,4);assert.equal(audit.observedListingCount,12);assert.equal(audit.extractedFullDetailCount,12)
 assert.equal(audit.unknownCountryListingCount,8);assert.equal(audit.closingInventoryMatches,true);assert.equal(audit.sourceDeclaredBoardScopeComplete,false)
 assert.ok(jobs.every(job=>job.source==='bikayi'&&job.company==='BIK'&&job.country==='India'&&job.requisitionId===null))
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(requests.filter(url=>url===active).length,3)
 assert.ok(!requests.some(url=>url.includes('/apply')||url.includes('bikglobal.notion')))
})
test('BIK country proof uses role worksites and the labelled India workplace rather than US accounts, INR, company copy or city guesses',async()=>{
 const{jobs,audit}=await run();assert.deepEqual(jobs.map(job=>job.jobId).sort(),['122159','145425','63647','76025'].sort())
 assert.equal(jobs.find(job=>job.jobId==='145425').sourceNativeCountryEvidenceKind,'labelled-native-role-location')
 assert.ok(audit.observedDetails.find(job=>job.jobId==='145434').sourceNativeWorkplaceLabels.some(value=>value.includes('Mumbai')))
 assert.equal(audit.observedDetails.find(job=>job.jobId==='145434').country,null)
 assert.equal(audit.observedDetails.find(job=>job.jobId==='145457').country,null)
 assert.equal(jobs.find(job=>job.jobId==='63647').postingDate,'2026-10-16T17:53:20.72Z')
})
test('BIK full public HTML criteria and raw original native dates remain identity-bound',async()=>{
 const{jobs,audit}=await run();const job=jobs.find(job=>job.jobId==='63647')
 assert.ok(job.jobDescription.includes('Message brokers'));assert.ok(job.jobDescription.includes('Bachelor'));assert.ok(job.jobDescription.includes('Interview Best Practices'))
 assert.equal(job.jobDescription,job.sourceNativeRecord.description);assert.equal(job.sourceNativePostingDate,job.postingDate)
 assert.equal(audit.observedDetails.length,12);assert.ok(audit.observedDetails.every(job=>job.sourceDetailComplete&&job.jobDescription.length>1500))
})
test('a changed BIK legal brand-owner statement prevents unproved historical mapping',async()=>{
 await assert.rejects(run((page,{url})=>{if(url==='https://bik.ai/bik-terms')page.body=page.body.replaceAll('Bikayi, Inc.','Unrelated Platform Inc.')}),/owner|Bikayi|continuity/i)
})
test('a Notion JavaScript shell is not a zero-job BIK inventory',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===career)page.body=pages.get('https://bikayi.com/careers').body}),/careers|identity|native/i)
})
test('a changed current BIK client cannot silently substitute another tenant or active board',async()=>{
 await assert.rejects(run((page,{url})=>{if(url.endsWith('/2974e331711d86bc.js'))page.body=page.body.replaceAll('comida.keka.com','other.keka.com')}),/handoff|client|Keka|AST/)
})
test('same-role public full criteria conflicts quarantine only the changed BIK detail',async()=>{
 const{jobs,audit}=await run((page,{url})=>{if(url.endsWith('/63647'))page.body=page.body.replace('Message brokers','Unrelated platform')})
 assert.equal(jobs.length,3);assert.ok(!jobs.some(job=>job.jobId==='63647'));assert.ok(audit.failures.some(row=>row.nativeJobId==='63647'))
})
test('BIK typed country and explicit labelled workplace conflicts remain unknown',async()=>{
 const{jobs,audit}=await run((page,{url})=>{if(url===active)rewrite(page,records=>{records.find(job=>job.id===145425).jobLocations=[{id:1,name:'Toronto',city:'Toronto',countryCode:'CA',countryName:'Canada'}]})})
 assert.ok(!jobs.some(job=>job.jobId==='145425'));assert.equal(jobs.length,3);assert.equal(audit.observedDetails.find(job=>job.jobId==='145425').country,null)
})
test('BIK closing removal drops that role and retains an inventory gap',async()=>{
 const{jobs,audit}=await run((page,{url,visit})=>{if(url===active&&visit===2)rewrite(page,records=>{records.splice(records.findIndex(job=>job.id===63647),1)})})
 assert.equal(jobs.length,3);assert.equal(audit.closingInventoryMatches,false);assert.ok(!jobs.some(job=>job.jobId==='63647'))
})
test('BIK native duplicate IDs cannot certify pagination or an empty result',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===active)rewrite(page,records=>records.push(structuredClone(records[0])))}),/duplicate|identity/)
})
test('BIK preserves caller cancellation before any current public read',async()=>{
 const controller=new AbortController(),reason=Error('cancel BIK');controller.abort(reason);const injected=seam()
 await assert.rejects(createBikayiScraper().run({...injected,signal:controller.signal}),error=>error===reason);assert.equal(injected.requests.length,0)
})
test('BIK zero-unbounded result limit keeps all qualified roles and their real country gaps',async()=>{
 const{jobs,audit}=await run(undefined,{maxJobs:0});assert.equal(jobs.length,4);assert.equal(audit.unknownCountryListingCount,8);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('BIK deadline bounds a noncooperative read and its audit callback',async()=>{
 await assert.rejects(createBikayiScraper().run({timeoutMs:30,fetchPage:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
 await assert.rejects(run(undefined,{timeoutMs:500,onAudit:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
})
