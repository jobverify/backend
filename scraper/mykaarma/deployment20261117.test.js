import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runMyKaarmaNative} from './nativeReader20261107.js'
import {qualifyProgram} from './nativeClientProfile20261107.js'
import {listing} from './nativeContract20261107.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const folder=new URL('./test-data/deployment-20261117/',import.meta.url)
const capture=JSON.parse(gunzipSync(readFileSync(new URL('current-originals.json.gz',folder))))
const hash=bytes=>createHash('sha256').update(bytes).digest('hex')
const ownURL='https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F'
const currentApp='https://ats.us1.rippling.com/_next/static/chunks/pages/_app-adc50512ab52b557.js'
async function replay(mutate=packet=>packet){
 let index=0
 const jobs=await runMyKaarmaNative({now:()=>capture.startedAt,fetchImpl:async(url,init)=>{
  const original=capture.responses[index++];assert.ok(original,'Only original current public reads')
  assert.equal(url,original.requestedURL);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const raw=Buffer.from(original.bodyBase64,'base64');assert.equal(hash(raw),original.bodySHA256);assert.equal(raw.length,original.bodyBytes)
  const packet=mutate({...original,body:raw.toString('utf8')},index)
  return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:{'content-type':packet.contentType}}),'url',{value:packet.finalURL})
 }})
 assert.equal(index,capture.responses.length)
 return jobs
}

test('MyKaarma current original deployment retains seven full India role/application pairs and sixteen canonical observations',async()=>{
 const jobs=await replay(),proof=readInventoryEvidence(jobs)
 assert.equal(jobs.length,7);assert.equal(capture.responses.length,34)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.nativeRoleClosingReconciled
  &&job.nativeApplicationRecord.jobPost.uuid===job.jobId&&job.jobDescription.length>3000&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.observedNativeLocationRows,22)
 assert.equal(jobs.nativeCollectionEvidence.observedNativeUniqueVacancies,16)
 assert.equal(proof.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition({source:'mykaarma',companyName:'MyKaarma'},jobs)
 assert.equal(assessment.runnerOutcome.rawRecords,16);assert.equal(assessment.indiaJobs,7);assert.equal(assessment.eligibleJobs,4)
 assert.equal(assessment.filterCounts.excludedTitle,3)
 assert.equal(assessment.runnerOutcome.partial,true);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('MyKaarma current whole app bytes are finite reviewed originals; telemetry is never stripped at runtime',()=>{
 const original=gunzipSync(readFileSync(new URL('app.gz',folder))).toString('utf8')
 assert.doesNotThrow(()=>qualifyProgram(currentApp,original))
 assert.throws(()=>qualifyProgram(currentApp,original.replaceAll('66a6c6be-5056-42c4-819d-c0a9890ae297','00000000-0000-4000-8000-000000000000')),/Whole native program/)
})

for(const[name,mutate,pattern]of[
 ['unknown build declaration',(p)=>p.requestedURL===ownURL?{...p,body:p.body.replaceAll('-o1k54Bqx8mJwi93As_1h','unknown-current-build')}:p,/declaration|context/],
 ['current application program edits',(p)=>p.requestedURL.includes('apply-530b431e9be29ff9.js')?{...p,body:p.body+'\nwindow.unreviewed=true'}:p,/Whole native program/],
 ['current role employer contradiction',(p)=>p.requestedURL.includes('/mykaarma/jobs/')?{...p,body:p.body.replaceAll('"companyName":"myKaarma"','"companyName":"Other Employer"')}:p,/employer|identity/],
 ['mixed release on closing listing',(p,index)=>p.requestedURL===ownURL&&index>20?{...p,body:p.body.replaceAll('-o1k54Bqx8mJwi93As_1h','6fvxwFNQJCv4SL9RqAcJL')}:p,/declaration|context/],
 ['changed passive program effects',(p)=>p.requestedURL===ownURL?{...p,body:p.body.replaceAll('document.head.appendChild(s)','document.body.appendChild(s)')}:p,/Passive context|passive/],
])test('MyKaarma exact current release rejects '+name,async()=>{
 await assert.rejects(()=>replay(mutate),pattern)
})

test('MyKaarma current release retains typed country and reviewed India worksite holds',()=>{
 const html=Buffer.from(capture.responses.find(p=>p.requestedURL===ownURL).bodyBase64,'base64').toString('utf8')
 for(const [field,value,issue]of[['countryCode','US','unqualified-or-contradictory-country'],['city','Dubai','unreviewed-typed-India-worksite']]){
  let id
  const changed=html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,open,raw,close)=>{
   const model=JSON.parse(raw),query=model.props.pageProps.dehydratedState.queries.find(q=>q.queryKey[2]==='job-posts')
   const row=query.state.data.items.find(row=>row.locations.some(l=>l.country==='India'));id=row.id
   for(const location of row.locations)location[field]=value
   return open+JSON.stringify(model)+close
  })
  assert.notEqual(changed,html)
  assert.ok(listing(changed).groups.find(group=>group.identity.id===id).issues.includes(issue))
 }
})
