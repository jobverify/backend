import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {API,readCloudinaryNative} from './currentProgrammeData.js'
import {readCurrentCloudinaryProgramme,runCurrentCloudinaryProgramme} from './currentProgramme.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const bytes=fs.readFileSync(new URL('./fixtures/current-programme-20261121.json.gz',import.meta.url))
const fixture=JSON.parse(gunzipSync(bytes)),manifest=JSON.parse(fs.readFileSync(new URL('./fixtures/current-programme-20261121.manifest.json',import.meta.url)))
const old=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/fixtures/cloudinary-current-programme-20261111.json.gz',import.meta.url))))
assert.equal(sha(bytes),manifest.fixtureSHA256)
const now=()=>fixture.capturedAtLast,originalNative=Buffer.from(fixture.responses[2].bodyBase64,'base64')
assert.equal(sha(originalNative),'a1a235f0f0bf075b47c3fdb38f882536d03968c2d852612d91c47ab290d52ee2')
const roleID='e8b76222-c0ac-40c5-b589-81a26f1830e7'
function replay(change=page=>page,options={}){
 const calls=[],mutated=[]
 const readPage=async(url,init)=>{
  const index=calls.length,row=fixture.responses[index];calls.push({url,init})
  assert(row,'No undeclared/recovery read is allowed');assert.equal(url,row.requestedURL)
  const body=Buffer.from(row.bodyBase64,'base64');assert.equal(sha(body),row.bodySHA256);assert.equal(body.length,row.bodyBytes)
  const page={url:row.finalURL,status:row.status,headers:structuredClone(row.headers),body},before=JSON.stringify(page.headers)
  const changed=change(page,{index,url,text:body.toString('utf8')})
  if(!(changed.body instanceof Uint8Array)||sha(changed.body)!==row.bodySHA256||JSON.stringify(changed.headers)!==before)mutated.push(index)
  return changed
 }
 return{calls,mutated,run:()=>readCurrentCloudinaryProgramme({readPage,now,...options})}
}
const nativeChange=change=>(page,{url,text})=>url===API?{...page,body:Buffer.from(JSON.stringify(change(JSON.parse(text))))}:page
async function held(change,pattern,index){
 const r=replay(change)
 await assert.rejects(r.run(),error=>{assert.match(error.message,pattern);assert.equal(error.nativeCollectionEvidence.currentDeclaredSourceProgramComplete,false);assert.equal(error.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(error.nativeCollectionEvidence.companyGlobalScopeQualified,false);assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false);return true})
 assert(r.mutated.length>0,'The intended acquired packet must actually change')
 if(index!==undefined)assert.equal(r.calls.length,index+1)
 return r
}

test('actual current original packets retain the full finite six-row programme',async()=>{
 const r=replay(),jobs=await r.run(),a=jobs.nativeCollectionEvidence,e=readInventoryEvidence(jobs)
 assert.deepEqual(jobs,[]);assert.equal(r.calls.length,6);assert.equal(a.nativeProgrammeRequests,6)
 assert.deepEqual(a.nativePayload,JSON.parse(originalNative));assert.equal(a.nativeOpeningBodySHA256,sha(originalNative));assert.equal(a.nativeClosingBodySHA256,sha(originalNative))
 assert.equal(a.currentDeclaredSourceProgramComplete,true);assert.equal(a.nativeIndiaCount,0);assert.equal(e.reportedTotal,6);assert.equal(e.indiaFacetCount,0);assert.equal(e.listingComplete,true)
 assert.equal(a.sourceScopeComplete,false);assert.equal(a.companyGlobalScopeQualified,false);assert.equal(a.companyGlobalTotal,null);assert.equal(a.companyIndiaTotal,null)
 for(const key of ['legalEmployerQualified','nativePerRoleEmployerFieldQualified','ownRoleUIQualified','schemaQualified','applicationVisited','screeningQualified','browserCORSExecutionQualified','CFScriptExecuted','lifecycleCleanupAllowed'])assert.equal(a[key],false,key)
 for(const key of ['publicationDate','firstEverPostedAt','closingDate','remoteStatus'])assert.equal(a[key],null,key)
 assert.equal(e.lifecycleCleanupAllowed,false);assert(sourceLifecycleCleanupForbidden(jobs));assert.equal(readSourceObservationEvidence(jobs,'cloudinary').observedVacancyCount,6)
 assert.deepEqual(a.nativePayload.map(row=>({id:row.id,country:row.country,location:row.categories.location,allLocations:row.categories.allLocations,createdAt:row.createdAt,lists:row.lists})),JSON.parse(originalNative).map(row=>({id:row.id,country:row.country,location:row.categories.location,allLocations:row.categories.allLocations,createdAt:row.createdAt,lists:row.lists})))
 assert(r.calls.every(({init})=>init.method==='GET'&&init.redirect==='manual'&&init.credentials==='omit'&&init.cache==='no-store'))
 assert.equal(fixture.newHTTPRequestsForFixture,0);assert.equal(manifest.actualNativeClosingAcquisition,false)
})
test('actual current native role keeps its own exact San Jose US binding and every original field',()=>{
 const rows=readCloudinaryNative(originalNative.toString('utf8'))
 assert.deepEqual(rows,JSON.parse(originalNative));assert.equal(rows.length,6)
 const role=rows.find(row=>row.id===roleID)
 assert.equal(role.country,'US');assert.equal(role.categories.location,'San Jose, CA');assert.deepEqual(role.categories.allLocations,['San Jose, CA'])
})

for(const[name,change,index]of[
 ['missing enforced policy',headers=>{delete headers['content-security-policy'];return headers},0],
 ['report-only cannot authorize',headers=>{headers['content-security-policy-report-only']=headers['content-security-policy'];delete headers['content-security-policy'];return headers},0],
 ['unknown additional origin',headers=>({...headers,'content-security-policy':headers['content-security-policy'].replace('b-code.liadm.com','other.example')}),0],
 ['missing reviewed origin',headers=>({...headers,'content-security-policy':headers['content-security-policy'].replace('b-code.liadm.com ','')}),1],
 ['missing directive',headers=>({...headers,'content-security-policy':headers['content-security-policy'].replace(/script-src-elem [^;]+;?/, '')}),1],
 ['unknown directive',headers=>({...headers,'content-security-policy':headers['content-security-policy']+'; sandbox allow-scripts'}),1],
 ['unsafe keyword mutation',headers=>({...headers,'content-security-policy':headers['content-security-policy'].replace("script-src-elem 'self' 'unsafe-inline'","script-src-elem 'self' 'unsafe-eval'")}),1],
 ['closing unreviewed CSP',headers=>({...headers,'content-security-policy':"script-src 'none'"}),4],
 ['API unexpected CSP',headers=>({...headers,'content-security-policy':fixture.responses[0].headers['content-security-policy']}),2]
])test('current policy guard holds '+name,()=>held((page,c)=>c.index===index?{...page,headers:change(page.headers)}:page,/CSP|security|policy/i,index))

for(const[name,indices,rejectionIndex]of[
 ['opening channels from different reviewed policy releases',[1,4],1],
 ['opening prior corporate with current jobs',[0,5],1],
 ['corporate closing from the prior reviewed policy',[5],5],
 ['jobs closing from the prior reviewed policy',[4],4]
])test('mixed policy cohort holds '+name,()=>held((page,c)=>indices.includes(c.index)?{...page,headers:{...page.headers,'content-security-policy':old.responses[0].headers['content-security-policy']}}:page,/policy|security|CSP/i,rejectionIndex))

for(const[name,change]of[
 ['different role ID cannot inherit San Jose',rows=>{const role=rows.find(row=>row.id===roleID);role.id='e8b76222-c0ac-40c5-b589-81a26f1830e8';role.hostedUrl='https://jobs.lever.co/cloudinary/'+role.id;role.applyUrl=role.hostedUrl+'/apply';return rows}],
 ['different country cannot inherit San Jose',rows=>{rows.find(row=>row.id===roleID).country='CA';return rows}],
 ['unknown native country',rows=>{rows.find(row=>row.id===roleID).country='ZZ';return rows}],
 ['India primary country',rows=>{rows.find(row=>row.id===roleID).country='IN';return rows}],
 ['additional native country alternative',rows=>{rows.find(row=>row.id===roleID).categories.allLocations.push('India');return rows}],
 ['different same-ID city',rows=>{const role=rows.find(row=>row.id===roleID);role.categories.location='San Jose';role.categories.allLocations=['San Jose'];return rows}],
 ['authored applicant country',rows=>{rows.find(row=>row.id===roleID).additional+='<p>Applicants must reside in Ind<span style="display:inline">ia</span>.</p>';return rows}],
 ['new mandatory criterion model',rows=>{rows.find(row=>row.id===roleID).mandatoryRequirements='Must hold a licence';return rows}],
 ['foreign employer account',rows=>{rows.find(row=>row.id===roleID).hostedUrl='https://jobs.lever.co/other/'+roleID;return rows}],
 ['missing full criteria',rows=>{const role=rows.find(row=>row.id===roleID);for(const field of ['opening','openingPlain','description','descriptionPlain','descriptionBody','descriptionBodyPlain','additional','additionalPlain'])role[field]='';role.lists=[];return rows}]
])test('current native guard holds '+name,()=>held(nativeChange(change),/country|location|criteria|content|model|schema|account|identity|URL|field|authored|India/i,2))

for(const[name,change]of[
 ['criterion',rows=>{rows[0].additional+='<p>Must hold a new certification.</p>';return rows}],
 ['membership',rows=>rows.slice(0,-1)],
 ['original creation date',rows=>{rows[0].createdAt+=1;return rows}],
 ['country',rows=>{rows.find(row=>row.id===roleID).country='CA';return rows}]
])test('current closing native guard holds changed '+name,()=>held((page,c)=>c.index===3?{...page,body:Buffer.from(JSON.stringify(change(JSON.parse(c.text))))}:page,/closing|changed|country|location/i,3))
test('current CSP cannot authorize a different whole corporate authority',()=>held((page,c)=>c.index===0?{...page,body:Buffer.from(c.text.replace('SEE OPEN ROLES','SEE OTHER ROLES'))}:page,/corporate|profile|changed/i,0))
test('current CSP cannot authorize changed client criteria projection',()=>held((page,c)=>c.index===1?{...page,body:Buffer.from(c.text.replace('return jobs.filter(job => job && job.categories && job.text);','return jobs.slice(0, 1);'))}:page,/client|profile|changed/i,1))
test('current runtime uses only six declared original packets and releases their bodies',async()=>{
 let calls=0;const responses=[]
 const jobs=await runCurrentCloudinaryProgramme({now,requestIntervalMs:0,fetchImpl:async(url,init)=>{const row=fixture.responses[calls++];assert(row);assert.equal(url,row.requestedURL);assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const headers=new Headers(init.headers);assert.equal(headers.get('cookie'),null);assert.equal(headers.get('authorization'),null);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});responses.push(response);return response}})
 assert.equal(calls,6);assert.equal(jobs.nativeCollectionEvidence.nativePayload.length,6);for(const response of responses)assert.equal(response.body.locked,false)
})
for(const reason of [null,Object.freeze({stop:'frozen Cloudinary'}),new Error('stop Cloudinary current')])test('current caller cancellation preserves '+String(reason),async()=>{
 const controller=new AbortController();let calls=0
 await assert.rejects(readCurrentCloudinaryProgramme({now,signal:controller.signal,readPage:async(url)=>{const row=fixture.responses[calls++];assert.equal(url,row.requestedURL);if(calls===3){controller.abort(reason);return new Promise(()=>{})}return{url:row.finalURL,status:row.status,headers:row.headers,body:Buffer.from(row.bodyBase64,'base64')}}}),error=>error===reason)
 assert.equal(calls,3)
})
test('current request reserve rejects before transport',async()=>{const r=replay(page=>page,{maxRequests:5});await assert.rejects(r.run(),/budget/);assert.equal(r.calls.length,0)})
test('current byte budget still bounds originals',async()=>{const r=replay(page=>page,{maxResponseBytes:100});await assert.rejects(r.run(),/byte bound/);assert.equal(r.calls.length,1)})
