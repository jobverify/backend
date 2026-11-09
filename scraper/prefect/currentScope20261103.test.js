import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'
import { mutateHTML } from '../../scraper-support/native-sources/declaredJobFeeds/fixtureReplay.js'

const directory=new URL('./test-data/current-20261103/',import.meta.url)
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',directory),'utf8'))
const packets=await Promise.all(manifest.responses.map(async entry=>({...entry,body:gunzipSync(await fs.readFile(new URL(entry.bodyFile,directory)))})))
const api='https://api.ashbyhq.com/posting-api/job-board/prefect?includeCompensation=true'
const uk='9b57f626-7a99-4a8b-99b1-b438305a977d'
const board='https://jobs.ashbyhq.com/prefect'
const replay=(mutate=()=>{})=>{
 const counts=new Map(),reads=[]
 const fetchPage=async(url,options={})=>{
  reads.push(url)
  const sequence=packets.filter(packet=>packet.requestedURL===url||packet.requestedUrl===url)
  assert.ok(sequence.length,'Unexpected public GET '+url)
  const index=counts.get(url)||0;counts.set(url,index+1)
  const original=sequence[Math.min(index,sequence.length-1)]
  const packet={status:original.status,url:original.finalURL??original.finalUrl??url,headers:{'content-type':original.contentType},bodyBase64:original.body.toString('base64')}
  await mutate({url,index,packet,reads,options})
  return packet
 }
 return{fetchPage,reads,counts}
}
const jsonMutation=(packet,change)=>{const value=JSON.parse(Buffer.from(packet.bodyBase64,'base64'));change(value);packet.bodyBase64=Buffer.from(JSON.stringify(value)).toString('base64')}
const indiaIds=JSON.parse(packets.find(packet=>packet.requestedUrl===api).body).jobs.slice(0,2).map(row=>row.id)
const asIndia=({url,packet})=>{
 if(url===api)jsonMutation(packet,feed=>{for(const row of feed.jobs)if(indiaIds.includes(row.id)){row.location='India';row.address={postalAddress:{addressCountry:'India'}}}})
 else if(url===board||indiaIds.some(id=>url===board+'/'+id)){
  const changed=mutateHTML(packet,(data,schemas)=>{
   for(const row of data?.jobBoard?.jobPostings??[])if(indiaIds.includes(row.id))row.locationName='India'
   if(data?.posting&&indiaIds.includes(data.posting.id)){data.posting.locationName='India';data.posting.locationAddress={addressCountry:'India'}}
   for(const schema of schemas){schema.jobLocation={'@type':'Place',address:{'@type':'PostalAddress',addressCountry:'India'}};schema.applicantLocationRequirements={'@type':'Country',name:'India'}}
  })
  Object.assign(packet,changed)
 }
}

test('Prefect current complete configured board resolves exact own UK-Based restriction without expanding EMEA',async()=>{
 const mock=replay();let audit
 const jobs=await run({...mock,maxJobs:0,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,7)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
 assert.equal(audit.observations.length,7)
 const row=audit.observations.find(value=>value.jobId===uk)
 assert.equal(row.country,'United Kingdom')
 assert.equal(row.sourceNativeListingRecord.location,'EMEA')
 assert.equal(row.sourceNativeListingRecord.address,null)
 assert.equal(row.sourceScopeComplete,false)
 assert.equal(row.lifecycleCleanupAllowed,false)
 assert.equal(row.sourceDetailComplete,true)
 assert.equal(mock.counts.get(api),3)
 assert.ok(mock.reads.lastIndexOf(api)>Math.max(...mock.reads.map((url,index)=>url.startsWith(board+'/')?index:-1)))
 assert.ok(mock.reads.lastIndexOf(board)>Math.max(...mock.reads.map((url,index)=>url.startsWith(board+'/')?index:-1)))
})

test('Prefect closing inventory removal after own details cannot qualify a zero',async()=>{
 const mock=replay(({url,index,packet})=>{if(url===api&&index===2)jsonMutation(packet,feed=>{feed.jobs=feed.jobs.filter(row=>row.id!==uk)})})
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.equal(mock.counts.get(api),3)
})

test('Prefect original publication and full criteria changes between passes remain partial',async()=>{
 const mock=replay(({url,index,packet})=>{if(url===api&&index>0)jsonMutation(packet,feed=>{feed.jobs[0].publishedAt='2026-11-03T00:00:00.000Z'})})
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('Prefect title proof rejects country alternatives, private market wording and unknown secondary sites',async()=>{
 const {resolvePrefectWorksite}=await import('./currentNative.js')
 const observations=JSON.parse(gunzipSync(await fs.readFile(new URL('observations.json.gz',directory))))
 const original=observations.find(row=>row.jobId===uk)
 assert.equal(resolvePrefectWorksite(original).country,'United Kingdom')
 for(const alter of [
  row=>{row.sourceNativeListingRecord.title='Developer Success Engineer (UK-Based customers)'},
  row=>{row.sourceNativeListingRecord.address={postalAddress:{addressCountry:'India'}}},
  row=>{row.sourceNativeListingRecord.address={postalAddress:{addressCountry:{name:'United Kingdom',alternative:'India'}}}},
  row=>{row.sourceNativeListingRecord.secondaryLocations=[{location:'Remote'}]},
  row=>{row.sourceNativePosting.secondaryLocationNames=['Remote']},
  row=>{row.sourceNativeJobPosting.applicantLocationRequirements={ '@type':'Country',name:'India'}},
  row=>{row.sourceNativeJobPosting.jobLocation=[{'@type':'Place',address:{addressLocality:'London'}}]},
 ]){
  const row=structuredClone(original);alter(row)
  assert.equal(resolvePrefectWorksite(row).sourceCountryScopeUnresolved,true)
 }
})

test('Prefect ignored public reader and observer are bounded; caller abort identity survives',async()=>{
 const cause=Object.freeze({caller:'cancelled'}),controller=new AbortController()
 const pending=run({fetchPage:()=>new Promise(()=>{}),signal:controller.signal,collectionBudgetMs:1000})
 controller.abort(cause)
 await assert.rejects(pending,error=>error===cause)
 await assert.rejects(run({fetchPage:()=>new Promise(()=>{}),collectionBudgetMs:15}),error=>error.code==='PREFECT_COLLECTION_TIMEOUT')
 const mock=replay()
 await assert.rejects(run({...mock,onAudit:()=>new Promise(()=>{}),collectionBudgetMs:1000}),error=>error.code==='PREFECT_COLLECTION_TIMEOUT')
})

test('Prefect typed foreign countries cannot silently discard structured alternatives',async()=>{
 const mock=replay(({url,packet})=>{
  if(url===api)jsonMutation(packet,feed=>{feed.jobs[0].address.postalAddress.addressCountry={name:'United States',alternative:'India'}})
 })
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('Prefect preserves outer and nested native country alternatives instead of choosing one address shape',async()=>{
 const mock=replay(({url,packet})=>{
  if(url===api)jsonMutation(packet,feed=>{feed.jobs.find(row=>row.id===uk).address={addressCountry:'India',postalAddress:{addressCountry:'United Kingdom'}}})
 })
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('Prefect final native board continuation prevents a complete zero despite an unpaginated API',async()=>{
 const mock=replay(({url,index,packet})=>{if(url===board&&index===2)Object.assign(packet,mutateHTML(packet,data=>{data.jobBoard.hasMore=true;data.jobBoard.nextCursor='public-next-page'}))})
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('Prefect future typed India roles retain full criteria; zero cap is unlimited and positive caps are partial',async()=>{
 const jobs=await run({...replay(asIndia),maxJobs:0})
 assert.equal(jobs.length,2)
 assert.ok(jobs.every(row=>row.country==='India'&&row.sourceDetailComplete&&row.jobDescription.length>1000))
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 const capped=await run({...replay(asIndia),maxJobs:1})
 assert.equal(capped.length,1)
 assert.equal(readInventoryEvidence(capped).listingComplete,false)
 assert.equal(readInventoryEvidence(capped).indiaFacetCount,2)
})

test('Prefect private application consent changes do not veto stable public vacancies',async()=>{
 const mock=replay(({url,index,packet})=>{if(url.startsWith(board+'/')&&index===1)Object.assign(packet,mutateHTML(packet,data=>{data.posting.shouldAskForTextingConsent=!data.posting.shouldAskForTextingConsent}))})
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('Prefect source-local access denial preserves status and stops actual requests to the denied host',async()=>{
 const mock=replay(({url,packet})=>{if(url===api)packet.status=403})
 await assert.rejects(run(mock),error=>error.status===403&&error.failureKind==='blocked'&&error.abortRetries===true&&!error.abortPipeline&&!error.isPipelineFatal)
 assert.equal(mock.counts.get(api),1)
})

for(const scenario of ['error','continuation','duplicate','rollover-date'])test('Prefect cannot verify '+scenario+' final native evidence',async()=>{
 const mock=replay(({url,index,packet})=>{
  if(url!==api||index!==2)return
  jsonMutation(packet,feed=>{
   if(scenario==='error'){feed.error='Unavailable';feed.jobs=[]}
   if(scenario==='continuation')feed.meta={hasMore:true,nextCursor:'next'}
   if(scenario==='duplicate')feed.jobs.push(feed.jobs[0])
   if(scenario==='rollover-date')feed.jobs[0].publishedAt='2026-02-31T00:00:00Z'
  })
 })
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})
