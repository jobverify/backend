import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runMyKaarmaNative} from './nativeReader20261107.js'
import {qualifyProgram} from './nativeClientProfile20261107.js'
import {E,listing,mergeListings} from './nativeContract20261107.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

const capture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261118/current-originals.json.gz',import.meta.url))))
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
const originals=new Map(capture.responses.map(row=>[row.url,row]))
const text=url=>Buffer.from(originals.get(url).bodyBase64,'base64').toString('utf8')
const currentBuild='DZ554rXjs25aVcEecNGXp'
const programURLs=[
 'https://ats.us1.rippling.com/_next/static/chunks/main-73465e06eee9a8f2.js',
 'https://ats.us1.rippling.com/_next/static/chunks/pages/_app-df6557919049cce8.js',
 'https://ats.us1.rippling.com/_next/static/chunks/387-77dfce139cfbd362.js',
 'https://ats.us1.rippling.com/_next/static/chunks/788-4f6f260a8769e9da.js',
 'https://ats.us1.rippling.com/_next/static/chunks/pages/%5BjobBoardSlug%5D/jobs/%5BjobId%5D/apply-3fe9d85435bea2fa.js',
]
async function replay(mutate=packet=>packet){
 const reads=[]
 const jobs=await runMyKaarmaNative({now:()=>capture.startedAt,fetchImpl:async(url,init)=>{
  const original=originals.get(url);assert.ok(original,'Only captured original public URLs: '+url)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const raw=Buffer.from(original.bodyBase64,'base64');assert.equal(digest(raw),original.bodySHA256);assert.equal(raw.length,original.bodyBytes)
  const packet=mutate({...original,body:raw.toString('utf8')},reads.push(url))
  return Object.defineProperty(new Response(packet.body,{status:packet.status,headers:packet.headers}),'url',{value:packet.finalURL})
 }})
 return{jobs,reads}
}

test('MyKaarma November 18 exact original declarations retain the complete native listing identity and typed India rows',()=>{
 const list=mergeListings([listing(text(E)),listing(text(E+'&page=1'),1)])
 assert.equal(list.items.length,22);assert.equal(list.groups.length,16)
 const india=list.groups.filter(group=>group.country==='IN'&&group.issues.length===0)
 assert.equal(india.length,7)
 assert.ok(india.some(group=>group.identity.id==='5aeede94-9f77-4171-8c6f-fe5cca03c9cc'))
})

test('MyKaarma November 18 originals retain seven full India role and application pairs with cleanup held',async()=>{
 const{jobs,reads}=await replay(),proof=readInventoryEvidence(jobs)
 assert.equal(jobs.length,7);assert.equal(reads.length,34)
 assert.ok(jobs.every(job=>job.country==='India'&&job.sourceDetailComplete&&job.nativeRoleClosingReconciled
  &&job.nativeApplicationRecord.jobPost.uuid===job.jobId&&job.nativeClosingRecord.jobPost.uuid===job.jobId
  &&job.jobDescription.length>3000&&job.lifecycleCleanupAllowed===false))
 assert.equal(jobs.nativeCollectionEvidence.observedNativeLocationRows,22)
 assert.equal(jobs.nativeCollectionEvidence.observedNativeUniqueVacancies,16)
 assert.equal(proof.listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 const assessment=assessSoftFailureAcquisition({source:'mykaarma',companyName:'MyKaarma'},jobs)
 assert.equal(assessment.indiaJobs,7);assert.equal(assessment.eligibleJobs,4)
 assert.equal(assessment.runnerOutcome.rawRecords,16);assert.equal(assessment.runnerOutcome.partial,true)
 assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('MyKaarma current complete programs use exact hashes including telemetry, upload and display code',()=>{
 for(const url of programURLs){
  const original=text(url)
  assert.doesNotThrow(()=>qualifyProgram(url,original))
  assert.throws(()=>qualifyProgram(url,original+'\nwindow.unreviewed=true'),/Whole native program/)
 }
})

for(const[name,mutate,pattern]of[
 ['unknown build declaration',p=>p.url===E?{...p,body:p.body.replaceAll(currentBuild,'unknown-current-build')}:p,/declaration|context/],
 ['known older build with current programs',p=>p.url===E?{...p,body:p.body.replaceAll(currentBuild,'-o1k54Bqx8mJwi93As_1h')}:p,/declaration|context/],
 ['current application program edits',p=>p.url===programURLs[4]?{...p,body:p.body+'\nwindow.unreviewed=true'}:p,/Whole native program/],
 ['own role employer contradiction',p=>/\/mykaarma\/jobs\/[^/]+$/.test(p.url)?{...p,body:p.body.replaceAll('"companyName":"myKaarma"','"companyName":"Other Employer"')}:p,/employer|identity/],
 ['passive declaration changed effects',p=>p.url===E?{...p,body:p.body.replaceAll('document.head.appendChild(s)','document.body.appendChild(s)')}:p,/Passive context|passive/],
])test('MyKaarma November 18 profile rejects '+name,async()=>{
 await assert.rejects(()=>replay(mutate),pattern)
})

test('MyKaarma current typed country and worksite contradictions remain held',()=>{
 const html=text(E)
 for(const[field,value,issue]of[['countryCode','US','unqualified-or-contradictory-country'],['city','Dubai','unreviewed-typed-India-worksite']]){
  let id
  const changed=html.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,open,raw,close)=>{
   const model=JSON.parse(raw),query=model.props.pageProps.dehydratedState.queries.find(q=>q.queryKey[2]==='job-posts')
   const row=query.state.data.items.find(row=>row.locations.some(location=>location.country==='India'));id=row.id
   for(const location of row.locations)location[field]=value
   return open+JSON.stringify(model)+close
  })
  assert.notEqual(changed,html)
  assert.ok(listing(changed).groups.find(group=>group.identity.id===id).issues.includes(issue))
 }
})
