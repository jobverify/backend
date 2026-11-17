import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {selectReviewedCandidateClient} from '../scraper/darwinbox/reviewedCandidateClient.js'
import {readInventoryEvidence} from '../scraper-support/utils/inventoryEvidence.js'
const current=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/darwinbox-current-client-20261116.json.gz',import.meta.url))))
const retained=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/darwinbox-current-client-20261105.json.gz',import.meta.url))))
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const main='main.aad4e9f12624d60f.js'
// Current candidate/corporate bytes pair with retained Nov5 API payloads.
// This compatibility replay does not claim fresh native completeness.
function transport(source,edit=()=>{}){
 const shell=text(current[source].responses[0]),client=text(current[source].responses.find(row=>row.url.endsWith('/'+main)))
 let phase='opening',companyReads=0
 return{fetchImpl:async(url,init={})=>{
  let row
  if(url.endsWith('/'+main))row={url,status:200,contentType:'application/javascript',body:client}
  else if(url.includes('/ms/candidatev2/'))row={url,status:200,contentType:'text/html',body:init.headers?.['User-Agent']?.includes('Chrome/')?shell:''}
  else if(url.includes('/ms/candidateapi/')){
   const path=url.split('/ms/candidateapi/')[1]
   if(path.startsWith('getCompanyConfig?'))phase=++companyReads===1?'opening':'closing'
   const native=retained.native[source][phase]
   const payload=path.startsWith('getCompanyConfig?')?native.company:path.startsWith('groupcompanycareersetting?')?native.group:path.startsWith('job?page=')?native.payloads[Number(new URL(url).searchParams.get('page'))-1]:path.startsWith('job/')?native.detailPayloads.find(value=>value.message.job[0].id===path.slice(4).split('?')[0]):null
   assert.ok(payload,'No retained Nov5 native payload '+url)
   row={url,status:200,contentType:'application/json',body:JSON.stringify(payload)}
  }
  else{
   const original=current[source].corporate.find(row=>row.url===url)
   assert.ok(original,'No current corporate receipt '+url)
   row={url,status:original.status,contentType:original.headers['content-type'],headers:original.headers,body:text(original),finalUrl:original.finalUrl}
  }
  edit(row)
  const response=new Response(row.body||'',{status:row.status,headers:{...row.headers,'Content-Type':row.contentType||'text/html','Set-Cookie':'fixture-public=1; Path=/'}})
  Object.defineProperty(response,'url',{value:row.finalUrl||row.url});return response
 }}
}
for(const source of ['keyence'])test(source+' Nov16 exact main recovers retained native criteria while current unreviewed shell forbids completion and cleanup',async()=>{
 const {run}=await import(`../scraper/${source}/script.js`),jobs=await run(transport(source)),evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,source==='keyence'?4:2)
 assert.equal(evidence.status,'coverage-gap')
 assert.equal(evidence.listingComplete,false)
 assert.match(evidence.reason,/unreviewed-native-candidate-shell/)
 assert.ok(jobs.every(job=>job.country==='India'&&job.lifecycleCleanupAllowed===false&&job.sourceScopeComplete===false))
})
test('both exact Nov16 source origins select only the reviewed main and retain the old renderer hold',()=>{
 for(const source of ['keyence','perfios']){
  const origin='https://'+source+'.darwinbox.in',url=origin+'/ms/candidatev2/'+main
  const release=selectReviewedCandidateClient({source,origin,review:{}},[url])
  assert.equal(release?.clientUrl,url)
  assert.equal(release?.clientSha256,'7d18a53b8cde72423e953eee67317dd245113c4ed0078dbfa65376d04354cfe1')
  assert.notEqual(release?.rendererSha256,'181cf5aa0ed25a92c56ef12ac91bbaf5a25f809acdccdf42bcc430639c21bfbd')
 }
})
test('Nov16 candidate release remains limited to the two exact reviewed source origins',()=>{
 for(const[source,origin]of[['stanplus','https://redhealth.darwinbox.in'],['datapatterns','https://datapatterns.darwinbox.in'],['keyence','https://perfios.darwinbox.in'],['perfios','https://keyence.darwinbox.in']]){
  assert.equal(selectReviewedCandidateClient({source,origin,review:{}},[origin+'/ms/candidatev2/'+main]),undefined)
 }
})
test('Nov16 candidate known main still rejects edited original bytes',async()=>{
 const {run}=await import('../scraper/keyence/script.js')
 await assert.rejects(run(transport('keyence',row=>{if(row.url.endsWith('/'+main))row.body+=';window.changed=true'})),/reviewed public API client changed/)
})
test('Perfios original current legacy API denials remain failures after the finite release registration',async()=>{
 const {run}=await import('../scraper/perfios/script.js'),visits=new Map()
 await assert.rejects(run({fetchImpl:async(url,init)=>{
  const count=visits.get(url)||0;visits.set(url,count+1)
  const row=current.perfios.blockedRun.responses.filter(row=>row.url===url)[count]
  assert.ok(row,'Uncaptured original blocked-run request '+url)
  const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:{...row.headers,'Set-Cookie':'fixture-public=1; Path=/'}})
  Object.defineProperty(response,'url',{value:row.finalURL});return response
 }}),/native API HTTP status\/content type changed: companyinfo/)
 assert.equal(visits.get('https://perfios.darwinbox.in/ms/candidateapi/companyinfo'),2)
})
