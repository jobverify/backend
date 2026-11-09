import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createBounteousScraper,extractSearchResults,LEVER_ENDPOINT,TURBOHIRE_ENDPOINT,CAREER_PAGE_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'

const packets=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/native-20261103.json.gz',import.meta.url))))
const original=new Map(packets.map(p=>[p.requestedUrl,p]))
const turbo=()=>JSON.parse(original.get(TURBOHIRE_ENDPOINT).body)
const lever=()=>JSON.parse(original.get(LEVER_ENDPOINT).body)
const nativeOptions=(change=()=>{})=>{
 const counts=new Map(),requests=[]
 return{requests,fetchJson:async url=>url===LEVER_ENDPOINT?lever():turbo(),fetchPage:async(url,request)=>{
  assert.equal(request.headers.Accept,url.includes('api.lever.co')||url.includes('/turbohire/api')?'application/json':'text/html,application/javascript;q=0.9,*/*;q=0.8')
  assert.ok(original.has(url),'fixture missing '+url)
  const page=structuredClone(original.get(url)),visit=(counts.get(url)||0)+1;counts.set(url,visit);requests.push(url)
  await change(page,{url,visit,request});return page
 }}
}
const run=async(change,options={})=>{let audit;const seam=nativeOptions(change),jobs=await createBounteousScraper({maxJobs:null}).run({...seam,...options,onAudit:value=>{audit=value;return options.onAudit?.(value)}});return{jobs,audit,requests:seam.requests}}
const rewrite=(page,callback)=>{const json=JSON.parse(page.body);callback(json);page.body=JSON.stringify(json)}

test('Bounteous current declared two-feed board closes all109 identities and69 full India roles',async()=>{
 const {jobs,audit,requests}=await run()
 assert.equal(jobs.length,69);assert.equal(audit.observedListingCount,109)
 assert.equal(audit.closingInventoryMatches,true);assert.equal(audit.sourceDeclaredBoardScopeComplete,true)
 assert.equal(audit.sourceCompanyWideScopeComplete,false);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,109)
 assert.equal(extractionDetailHealth(jobs).complete,true)
 assert.ok(jobs.every(j=>j.source==='bounteous'&&j.company==='Bounteous'&&j.sourceDetailComplete))
 assert.equal(requests.filter(url=>url===LEVER_ENDPOINT).length,2);assert.equal(requests.filter(url=>url===TURBOHIRE_ENDPOINT).length,2)
 assert.equal(requests.filter(url=>url.includes('?id=')).length,69)
})
test('Bounteous retains original criteria, absent dates, opaque IDs and multi-worksite uncertainty',async()=>{
 const {jobs}=await run(),first=jobs.find(j=>j.jobId===turbo().response[0].id)
 assert.equal(first.sourceNativeRecord.description,turbo().response[0].description)
 assert.equal(first.jobDescription,turbo().response[0].description)
 assert.equal(first.requisitionId,null);assert.equal(first.postingDate,null);assert.equal(first.sourceOriginalPostingDatePublished,false)
 assert.equal(first.city,null);assert.equal(first.sourceNativeRecord.cities.length,2)
 assert.deepEqual(new Set(jobs.map(j=>j.department)),new Set(['BU','Practice','Corporate']))
})
test('Lever uses its full HTML plus every labelled criteria list, not the incomplete plain summary',()=>{
 const row=lever()[0];row.country='IN';row.categories.location='Bengaluru, India';row.categories.allLocations=['Bengaluru, India']
 const [job]=extractSearchResults({leverJobs:[row]})
 assert.ok(job.jobDescription.includes('Serve as the primary platform expert'))
 assert.ok(job.jobDescription.includes('Information Security Responsibilities'))
 assert.ok(job.jobDescription.includes('Promote and enforce awareness'))
 assert.equal(job.postingDate,new Date(row.createdAt).toISOString());assert.equal(job.requisitionId,null)
})
test('a native JSON endpoint returning HTML fails as unavailable rather than verified zero',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===LEVER_ENDPOINT)page.body='<html>careers preview</html>'}),/JSON/)
})
test('an unpublished replacement careers client cannot certify the feeds',async()=>{
 await assert.rejects(run((page,{url})=>{if(url===CAREER_PAGE_URL)page.body=page.body.replaceAll('components-CareersHero-CareersHero-','unqualified-client-')}),/client/)
})
test('an additional unqualified public client feed cannot hide behind the two known endpoint strings',async()=>{
 await assert.rejects(run((page,{url})=>{if(url.includes('/components-CareersHero-'))page.body+=';fetch("https://api.lever.co/v0/postings/another-board/")'}),/client|feed/)
})
test('a native published invalid calendar date is retained unresolved and held',async()=>{
 const target=turbo().response[0].id
 const {jobs,audit}=await run((page,{url})=>{if(url===TURBOHIRE_ENDPOINT)rewrite(page,p=>{p.response[0].postedDate='2026-02-31'});if(url.endsWith('?id='+target))rewrite(page,p=>{p.response.postedDate='2026-02-31'})})
 assert.equal(jobs.length,68);assert.ok(audit.failures.some(row=>row.nativeJobId===target&&/date/.test(row.message)))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('native country disagreement keeps healthy details but prevents complete India inventory',async()=>{
 const target=turbo().response[0].id
 const {jobs,audit}=await run((page,{url})=>{if(url===TURBOHIRE_ENDPOINT)rewrite(page,p=>{p.response[0].countryName='Canada'})})
 assert.equal(jobs.length,68);assert.ok(!jobs.some(j=>j.jobId===target));assert.equal(audit.sourceDeclaredBoardScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
})
test('same-ID public detail criteria disagreement quarantines only that role',async()=>{
 const target=turbo().response[0].id
 const {jobs,audit}=await run((page,{url})=>{if(url.endsWith('?id='+target))rewrite(page,p=>{p.response.description+='<p>Additional current requirements.</p>'})})
 assert.equal(jobs.length,68);assert.ok(!jobs.some(j=>j.jobId===target));assert.ok(audit.failures.some(f=>f.nativeJobId===target&&/criteria|model/i.test(f.message)))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('a public detail for a different identity is never assigned to the requested role',async()=>{
 const target=turbo().response[0].id
 const {jobs}=await run((page,{url})=>{if(url.endsWith('?id='+target))rewrite(page,p=>{p.response.id=turbo().response[1].id})})
 assert.equal(jobs.length,68);assert.ok(!jobs.some(j=>j.jobId===target))
})
test('closing removal excludes the removed role and retains the inventory gap',async()=>{
 const target=turbo().response[0].id
 const {jobs,audit}=await run((page,{url,visit})=>{if(url===TURBOHIRE_ENDPOINT&&visit===2)rewrite(page,p=>{p.response.shift()})})
 assert.equal(jobs.length,68);assert.ok(!jobs.some(j=>j.jobId===target));assert.equal(audit.closingInventoryMatches,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('closing added identities prevent complete inventory without inventing an unopened detail',async()=>{
 const {jobs,audit}=await run((page,{url,visit})=>{if(url===TURBOHIRE_ENDPOINT&&visit===2)rewrite(page,p=>{p.response.push({...p.response[0],id:'t__new-current-role'})})})
 assert.equal(jobs.length,69);assert.equal(audit.closingInventoryMatches,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('an explicit result cap remains partial after complete native enumeration',async()=>{
 const {jobs}=await run(undefined,{maxJobs:2});assert.equal(jobs.length,2);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('Bounteous preserves the existing zero-unbounded result limit contract',async()=>{
 const{jobs}=await run(undefined,{maxJobs:0});assert.equal(jobs.length,69);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('pre-aborted Bounteous run makes no native requests and preserves the caller reason',async()=>{
 const controller=new AbortController(),reason=Error('caller cancelled Bounteous');controller.abort(reason)
 const seam=nativeOptions();await assert.rejects(createBounteousScraper().run({...seam,signal:controller.signal}),error=>error===reason);assert.equal(seam.requests.length,0)
})
test('caller cancellation bounds an injected HTTP reader that never settles',async()=>{
 const controller=new AbortController(),reason=Error('caller stopped pending Bounteous')
 const pending=createBounteousScraper().run({signal:controller.signal,fetchPage:()=>new Promise(()=>{}),fetchJson:()=>new Promise(()=>{})});setTimeout(()=>controller.abort(reason),10)
 await assert.rejects(pending,error=>error===reason)
})
test('source deadline bounds audit callbacks that never settle',async()=>{
 await assert.rejects(run(undefined,{timeoutMs:500,onAudit:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError')
})
