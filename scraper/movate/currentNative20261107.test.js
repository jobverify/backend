import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createMovateScraper,HOMEPAGE_URL,JOBS_PAGE_URL} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {nativeText} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const page=url=>{const row=capture.packets.find(row=>row.requestUrl===url);assert.ok(row,'Only publisher-declared native URLs: '+url);return row}
const options=(change=(_url,body)=>body)=>{
 const seen=new Map()
 return {fetchText:async url=>page(url).body,fetchImpl:async url=>{
  const row=page(url),count=(seen.get(url)??0)+1;seen.set(url,count)
  const response=new Response(change(url,row.body,count),{status:row.status,headers:{'content-type':row.contentType??'text/html'}})
  Object.defineProperty(response,'url',{value:row.url});return response
 }}
}
test('Movate enumerates all current native India pages with full published criteria and an unchanged closing inventory',async()=>{
 const jobs=await createMovateScraper().run(options())
 assert.equal(jobs.length,610)
 const proof=readInventoryEvidence(jobs)
 assert.equal(proof.reportedTotal,610);assert.equal(proof.listingComplete,true)
 const first=jobs.find(job=>job.jobId==='43885')
 assert.equal(first.title,'Trainee');assert.equal(first.location,'Chennai, Tamil Nadu, India')
 assert.ok(first.jobDescription.includes('UiPath RPA Developer'))
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.some(job=>job.sourceNativeJobRecord.nativePage===61))
})
test('Movate preserves the complete description and skill fields seen on every retained original role detail',async()=>{
 const jobs=await createMovateScraper().run(options())
 const details=capture.packets.filter(row=>/^https:\/\/www\.movate\.com\/careers\/job\/\d+-/.test(row.requestUrl))
 assert.equal(details.length,10)
 for(const row of details){
  const job=jobs.find(job=>job.sourceUrl===row.requestUrl);assert.ok(job)
  const doc=readNativeDocument(row.body)
  const description=doc.nodes(node=>(node.attrs.class??'').split(/\s+/).includes('mvc-job-description__body'))
  assert.equal(description.length,1)
  assert.equal(job.sourceNativeJobRecord.fields['job description'],nativeText(description[0]).replace(/\s+/g,' ').trim())
  const skillNodes=doc.nodes(node=>(node.attrs.class??'').split(/\s+/).includes('mvc-chip'))
  for(const node of skillNodes)assert.ok(job.jobDescription.includes(nativeText(node)))
 }
})
test('Movate rejects a changed native country and a mismatched role-entry ID',async()=>{
 for(const change of [
  (url,body)=>url===JOBS_PAGE_URL?body.replaceAll('Chennai, Tamil Nadu, India','Chennai, United States'):body,
  (url,body)=>url===JOBS_PAGE_URL?body.replaceAll('/43885-trainee/','/99999-trainee/'):body,
 ])await assert.rejects(createMovateScraper().run(options(change)),/country|role|identity|India/i)
})
test('Movate rejects new native client code and changed closing criteria',async()=>{
 await assert.rejects(createMovateScraper().run(options((url,body)=>url.endsWith('/job-results/view.js')?body+'\nfetch("/other-jobs")':body)),/program|client/i)
 await assert.rejects(createMovateScraper().run(options((url,body,count)=>url===JOBS_PAGE_URL&&count===2?body.replace('UiPath RPA Developer','Replacement native criterion'):body)),/closing|changed/i)
})
test('Movate rejects a different canonical employer and never treats a missing results region as empty',async()=>{
 await assert.rejects(createMovateScraper().run(options((url,body)=>url===JOBS_PAGE_URL?body.replace('rel="canonical" href="'+JOBS_PAGE_URL+'"','rel="canonical" href="https://other.example/jobs/"'):body)),/canonical|identity/i)
 await assert.rejects(createMovateScraper().run(options((url,body)=>url===JOBS_PAGE_URL?'<title>Latest Job Openings India - Movate</title>':body)),/native|results|canonical/i)
})
