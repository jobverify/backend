import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createProvidenceScraper,PROVIDENCE_INDIA_CAREERS_URL} from './currentIndia20261108.js'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/closing-board-full-reads.json.gz',import.meta.url))))
const target='57972044'
const replay=async change=>{
 const pages=new Map(),counts=new Map()
 for(const packet of capture.responses){const queue=pages.get(packet.requestUrl)||[];queue.push(packet);pages.set(packet.requestUrl,queue)}
 return createProvidenceScraper().run({fetchImpl:async url=>{
  const queue=pages.get(url);assert.ok(queue,'Uncaptured request: '+url)
  const index=counts.get(url)||0;counts.set(url,index+1)
  // Controlled stable closing corporate response; the captured live attempt
  // ended at its closing board. The other 167 responses remain original.
  if(index>=queue.length)assert.equal(url,PROVIDENCE_INDIA_CAREERS_URL)
  const packet=queue[Math.min(index,queue.length-1)],body=change?change(packet.body,url):packet.body
  const response=new Response(body,{status:packet.status,headers:packet.headers})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
 }})
}

test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('Unexpected live network in Providence criteria tests')}))

test('Providence recognizes its full native responsibilities and qualification question labels',async()=>{
 const jobs=await replay()
 for(const id of [target,'52914544']){
  const job=jobs.find(job=>job.jobId===id)
  assert.ok(job,'The complete native question-labeled role must survive: '+id)
  assert.match(job.sourceDescription,/what will you be responsible for\?/i)
  assert.match(job.sourceDescription,/who are we looking for\?/i)
  assert.equal(job.country,'India')
  assert.equal(job.sourceDescription,job.sourceNativeCriteriaEvidence.fullText)
  assert.equal(job.lifecycleCleanupAllowed,false)
  const record=jobs.sourceAudit.openingRoles.find(record=>record.row.publicId===id)
  if(id===target)assert.ok(record.authoredCriteriaLabelEvidence.some(value=>value.grammarFamilies.includes('responsibility-question-label')))
  else assert.match(job.nativeDescriptionHTML,/<h2><strong>What Will You Be Responsible For\?<\/strong><\/h2>/)
 }
 assert.ok(!jobs.some(job=>job.jobId==='19021344'),'The role with a native PK address stays held')
 assert.ok(jobs.sourceAudit.held.some(row=>row.row.publicId==='19021344'&&row.reasons.includes('native-explicit-foreign-country-PK')))
})

test('a different question cannot substitute for an authored responsibilities or qualification label',async()=>{
 const jobs=await replay((body,url)=>url.includes('/'+target+'/')
  ? body.replaceAll('What will you be responsible for?','What makes our culture special?').replaceAll('Who are we looking for?','Why join our team?')
  : body)
 assert.ok(!jobs.some(job=>job.jobId===target))
 const held=jobs.sourceAudit.held.find(row=>row.row.publicId===target)
 assert.ok(held?.reasons.includes('native-full-role-criteria-markers-unproven'))
})
