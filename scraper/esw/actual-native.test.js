import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
globalThis.fetch=()=>{throw Error('OFFLINE actual native replay tripwire before imports')}
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {readInventoryEvidence}=await import('../../scraper-support/utils/inventoryEvidence.js')
const {analyzePublishableJobs}=await import('../../scraper-support/utils/publishableJobMetrics.js')
const source='esw'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/registered-native-20261027.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(p=>p.source===source)

test(source+': actual registered native replay preserves every original record and completes scope with qualified official geography',async()=>{
 assert.equal(provider.adapter,'script')
 assert.equal(provider.sourceScopeComplete,null)
 const calls=[],queues=new Map();for(const response of fixture.responses){if(!queues.has(response.requestedUrl))queues.set(response.requestedUrl,[]);queues.get(response.requestedUrl).push(response)}
 let audit
 const load=async(url,options)=>{assert.equal(options.method,'GET');assert.equal(options.body,undefined);const queue=queues.get(url);assert.ok(queue?.length,'Unexpected offline URL '+url);const response=queue.shift();calls.push(url);assert.equal(response.status,200);return response.body}
 const jobs=await createCatalogScraper(provider).run({fetchPage:load,fetchJson:async(u,o)=>JSON.parse(await load(u,o)),onAudit:a=>{audit=a}})
 const raw=JSON.parse(fixture.responses.find(r=>r.requestedUrl.endsWith('/jobs?content=true')).body)
 assert.equal(audit.fullContentCount,raw.jobs.length)
 assert.equal(audit.nativeJobs.length,raw.jobs.length)
 assert.equal(audit.healthyNativeCount,3)
 assert.equal(audit.channels.length,fixture.expected.channels)
 assert.deepEqual(audit.reasons,[])
 assert.deepEqual(calls,fixture.responses.map(r=>r.requestedUrl),'same request order and every actual opening/closing response consumed')
 assert.ok([...queues.values()].every(q=>q.length===0))
 assert.equal(jobs.length,0);assert.equal(analyzePublishableJobs(jobs).eligibleJobs.length,0)
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.listingComplete,true);assert.equal(evidence.reportedTotal,4);assert.equal(evidence.indiaFacetCount,0)
 for(const row of raw.jobs){const job=audit.nativeJobs.find(j=>j.jobId===String(row.id));assert.ok(job);assert.equal(job.nativeInternalJobId,row.internal_job_id==null?null:String(row.internal_job_id));assert.equal(job.requisitionId,row.requisition_id==null?null:String(row.requisition_id));assert.equal(job.nativeApiDescriptionHtml,row.content);assert.deepEqual(job.nativeRecord,row);assert.equal(job.nativeFirstPublished,row.first_published);assert.equal(job.nativeUpdatedAt,row.updated_at);assert.equal(job.postingDate,new Date(row.first_published).toISOString());assert.equal(job.postingDatePrecision,'instant');assert.equal(job.applyUrl,row.absolute_url);assert.equal(job.lifecycleCleanupAllowed,true);assert.equal(job.sourceScopeComplete,true);assert.equal(job.sourceListingComplete,true);assert.equal(job.sourceLocations.filter(l=>l.kind==='office').length,row.offices.length);assert.ok(job.sourceDescription.length>0)}
 const direct=await import('./script.js');const bodies=new Map(fixture.responses.map(r=>[r.requestedUrl,r.body]));let directAudit;const directJobs=await direct.run({fetchPage:async u=>bodies.get(u),fetchJson:async u=>JSON.parse(bodies.get(u)),onAudit:a=>{directAudit=a}});assert.equal(directJobs.length,0);assert.deepEqual(directAudit.reasons,audit.reasons)
})
