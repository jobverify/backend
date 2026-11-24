import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-deployment-20261121.json.gz',import.meta.url))))
const FEED='https://hiverhq.pinpointhq.com/postings.json',BOARD='https://hiverhq.pinpointhq.com/'
const feed=JSON.parse(Buffer.from(fixture.packets.find(packet=>packet.requestedURL===FEED).bodyBase64,'base64').toString('utf8'))
const dates=[['619893','2026-11-16T04:55:10+00:00'],['620099','2026-11-16T12:28:01+00:00'],['621350','2026-11-17T17:06:05+00:00'],['622691','2026-11-19T10:38:12+00:00'],['623018','2026-11-19T15:10:26+00:00'],['623060','2026-11-19T16:07:28+00:00'],['623066','2026-11-19T16:14:54+00:00']]
const bodyEdit=(packet,change)=>{const before=Buffer.from(packet.bodyBase64,'base64').toString('utf8'),after=change(before);assert.notEqual(after,before,'Control changes actual current bytes');packet.bodyBase64=Buffer.from(after).toString('base64')}
async function replay(change=()=>{},options={}){
 const calls=[],counts=new Map()
 const jobs=await run({now:()=>fixture.capturedAt,requestIntervalMs:0,...options,fetchImpl:async url=>{
  const original=fixture.packets.find(packet=>packet.requestedURL===url);assert.ok(original,'Only retained current declared URLs: '+url)
  const visit=(counts.get(url)??0)+1;counts.set(url,visit);assert.ok(visit<=2,'Bounded original opening/closing reads')
  const packet=structuredClone(original);change(packet,url,visit);calls.push(url)
  const response=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(response,'url',{value:packet.url});return response
 }})
 return {jobs,calls}
}
test('current Hiver publication hydrates seven advertised typed India roles with complete original criteria and publication dates',async()=>{
 const {jobs,calls}=await replay(),audit=jobs.nativeCollectionEvidence,inventory=readInventoryEvidence(jobs)
 assert.deepEqual(jobs.map(job=>[job.jobId,job.postingDate]),dates)
 assert.equal(audit.opening.rows.length,10);assert.equal(audit.opening.originalTypedPostingModels.length,7);assert.equal(audit.opening.held.length,3)
 assert.equal(audit.originalResponses.length,38);assert.equal(calls.length,38)
 assert.ok(calls.every(url=>!url.includes('64a310b6-2717-4478-bd32-d299502f5e89')),'Closed historical posting is never reused')
 for(const job of jobs){
  assert.equal(job.country,'India');assert.equal(job.sourceDetailComplete,true);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  const row=feed.data.find(row=>row.id===job.jobId)
  assert.deepEqual(JSON.parse(JSON.stringify(job.sourceNativeModel)),row)
  for(const field of ['description','key_responsibilities','skills_knowledge_expertise','benefits'])if(typeof row[field]==='string'&&row[field].trim())assert.ok(job.sourceDescription.includes(row[field]),'Every whole original authored section retained: '+job.jobId+'/'+field)
  const own=fixture.packets.find(packet=>packet.requestedURL===row.url),document=readNativeDocument(Buffer.from(own.bodyBase64,'base64').toString('utf8'))
  const stage=JSON.parse(document.nodes(node=>node.tag==='script'&&node.attrs['data-component-name']==='External::Jobs::Stagescarousel')[0].raw)
  assert.deepEqual(JSON.parse(JSON.stringify(job.sourceNativeHiringConditions)),stage)
  for(const item of stage.stages)assert.ok(job.sourceDescription.includes(item.description),'Whole original hiring stage retained: '+job.jobId+'/'+item.externalName)
  assert.equal(job.sourceNativeJobPosting.datePosted,job.postingDate);assert.equal(job.sourceNativeJobPosting.hiringOrganization.name,'Hiver')
  assert.equal(job.sourceNativeJobPosting.jobLocation.address.addressCountry,'IN');assert.equal(job.sourceNativeJobPosting.applicantLocationRequirements.name,'India')
  assert.equal(job.sourceRenderedFullCriteriaQualified,false);assert.equal(job.sourceRenderedApplicationQualified,false)
 }
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.lifecycleCleanupAllowed,false)
})
test('caller limit retains current observations and fully hydrated role count before limiting output',async()=>{
 const {jobs}=await replay(()=>{},{maxJobs:1})
 assert.equal(jobs.length,1);assert.equal(jobs.nativeCollectionEvidence.opening.originalTypedPostingModels.length,7)
 assert.equal(jobs.nativeCollectionEvidence.opening.rows.length,10)
})
test('current native CSP and renderer version must remain a coherent reviewed deployment',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url===BOARD)packet.headers['content-security-policy']=packet.headers['content-security-policy'].replace("worker-src 'self' https: blob:; ",'')}),error=>error.failureKind==='coverage_gap')
})
test('current declared stylesheet changes cannot hide native roles',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url.endsWith('/application-35bf5897.css'))bodyEdit(packet,raw=>raw+'\nbody{display:none}\n')}),error=>error.failureKind==='coverage_gap')
})
test('current typed country conflict remains held',async()=>{
 await assert.rejects(replay((packet,url)=>{if(url.endsWith('/56e85315-0682-4d11-b1ce-0a0daddc025e'))bodyEdit(packet,raw=>raw.replace('"addressCountry":"IN"','"addressCountry":"US"'))}),error=>error.failureKind==='coverage_gap')
})
test('current closing original criteria drift cannot publish a reconciled result',async()=>{
 await assert.rejects(replay((packet,url,visit)=>{if(url===FEED&&visit===2)bodyEdit(packet,raw=>{const value=JSON.parse(raw);value.data.find(row=>row.id==='621350').skills_knowledge_expertise+='<div>Additional certification required.</div>';return JSON.stringify(value)})}),error=>error.failureKind==='coverage_gap')
})
