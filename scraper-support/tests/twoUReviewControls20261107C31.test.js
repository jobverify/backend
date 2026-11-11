import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from '../../scraper/2u/script.js'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {createTwoUOriginalReader} from '../../test/helpers/twoUCurrentFixture20261110.js'

const folder=new URL('./fixtures/twoUCurrent20261110/',import.meta.url)
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',folder),'utf8'))
const originals=new Map(manifest.records.map(row=>[row.requestedUrl,{url:row.finalUrl,status:row.status,headers:row.headers,
 bodyBase64:gunzipSync(fs.readFileSync(new URL(row.bodyFile,folder))).toString('base64'),requestedAt:row.sourceRequestedAt,completedAt:row.sourceCompletedAt}]))
const CAREERS='https://2u.com/careers/',JOBS=CAREERS+'jobs/',ROLE=JOBS+'8871017002/'
const QUERY='https://2u.com/page-data/sq/d/1843004117.json',OFFICES='https://2u.com/page-data/sq/d/3494932948.json'
const text=page=>Buffer.from(page.bodyBase64,'base64').toString('utf8')
const changed=(page,body)=>({...page,bodyBase64:Buffer.from(body).toString('base64')})
const caught=async promise=>{try{return{resolved:true,value:await promise}}catch(reason){return{resolved:false,reason}}}
function reader(mutate){const calls=[],readOriginal=createTwoUOriginalReader();return{calls,fetchPage:async(url,init)=>{
 calls.push(url);assert.equal(init.redirect,'manual');assert.ok(originals.has(url),'Only original public fixture requests')
 const page=readOriginal(url);return mutate?mutate(page,url):page
}}}
const india=(page,url,{visible=true,title=true}={})=>{
 if(url===QUERY){const v=JSON.parse(text(page));v.data.greenhouseJobs.jobs.find(row=>row.alternative_id===8871017002).offices[0].name='India Remote';return changed(page,JSON.stringify(v))}
 if(url===OFFICES){const v=JSON.parse(text(page)),o=v.data.cms.pages.find(r=>r.id==='215');o.abbreviation='IN';if(title)o.title='Remote: India';return changed(page,JSON.stringify(v))}
 return visible&&url===ROLE?changed(page,text(page).replaceAll('Remote: US, US','Remote: India, IN')):page
}

test('conflicting visible US role cannot become an India vacancy from native models alone',async()=>{
 const jobs=await run(reader((page,url)=>india(page,url,{visible:false})))
 assert.equal(jobs.length,0)
 assert.equal(jobs.sourceAudit.observations.find(row=>row.id==='8871017002').sourceCountryComplete,false)
 assert.equal(jobs.sourceAudit.observations.find(row=>row.id==='8871017002').visibleCountryMatch,false)
 assert.ok(jobs.sourceAudit.originalPages.find(p=>p.requestedURL===ROLE).originalText.includes('Remote: US, US'))
})

test('CMS title and abbreviation country contradictions remain unresolved',async()=>{
 const jobs=await run(reader((page,url)=>india(page,url,{title:false})))
 assert.equal(jobs.length,0)
 const row=jobs.sourceAudit.observations.find(row=>row.id==='8871017002')
 assert.equal(row.sourceCountryComplete,false)
 assert.equal(row.sourceNativeCountryEvidence[0].countryConflict,true)
 assert.equal(row.sourceNativeCountryEvidence[0].nativeCMSOffice.title,'Remote: US')
})

test('complete consistent India control still returns the entire criteria after country checks',async()=>{
 const jobs=await run(reader(india))
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].visibleCountryMatch,true);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.equal(jobs[0].sourceScopeComplete,false);assert.equal(jobs[0].postingDate,null)
 assert.ok(jobs[0].jobDescription.includes('2U is an equal opportunity employer'))
})

test('frozen original read failures preserve identity when audit metadata cannot be attached',async()=>{
 const reason=Object.freeze(Object.assign(Error('Frozen original transport sentinel'),{code:'TRANSPORT_SENTINEL'}))
 const result=await caught(run({fetchPage:()=>{throw reason}}))
 assert.equal(result.resolved,false);assert.equal(result.reason,reason)
})

test('a rejected audit sink cannot replace the first original read failure including falsy values',async()=>{
 for(const reason of [Error('Original transport sentinel'),null,undefined,0,false,'']){
  const result=await caught(run({fetchPage:()=>{throw reason},onAudit:()=>{throw Error('Audit sink sentinel')}}))
  assert.equal(result.resolved,false);assert.equal(result.reason,reason)
 }
})

test('native denied headers retain HTTP403 and cancel a hung entity without reading it',async()=>{
 let read=false,cancelled=false,released=false
 const response={url:CAREERS,status:403,redirected:false,headers:new Headers({'content-type':'text/html'}),
  body:{getReader:()=>({read(){read=true;return new Promise(()=>{})},cancel(){cancelled=true;return new Promise(()=>{})},releaseLock(){released=true}})}}
 const result=await caught(run({requestTimeoutMs:20,fetchImpl:()=>response}))
 assert.equal(result.resolved,false);assert.equal(result.reason.status,403)
 assert.equal(result.reason.failureKind,'blocked_or_access_denied')
 assert.equal(read,false);assert.equal(cancelled,true);assert.equal(released,true)
 const original=result.reason.sourceAudit.originalPages[0]
 assert.equal(original.status,403);assert.equal(original.bodyBase64,null)
 assert.equal(original.bodySHA256,null);assert.equal(original.bytes,null)
 assert.equal(original.completedAt,null)
 assert.ok(Number.isFinite(Date.parse(original.headersObservedAt)))
})

test('a synchronously blocking audit sink cannot pass its elapsed deadline',async()=>{
 const result=await caught(run({...reader(),auditTimeoutMs:1,onAudit:()=>{const at=performance.now();while(performance.now()-at<20){ /* Deliberately stall the event loop to test the elapsed deadline. */ }}}))
 assert.equal(result.resolved,false);assert.equal(result.reason.code,'TWO_U_PUBLIC_AUDIT_TIMEOUT')
})

test('a synchronously blocking injected read cannot pass its elapsed source deadline',async()=>{
 const result=await caught(run({sourceTimeoutMs:1,fetchPage:()=>{const at=performance.now();while(performance.now()-at<20){ /* Deliberately stall the event loop to test the elapsed deadline. */ };return structuredClone(originals.get(CAREERS))}}))
 assert.equal(result.resolved,false);assert.equal(result.reason.code,'TWO_U_PUBLIC_SOURCE_TIMEOUT')
})

test('an active external document base stops relative careers or program authority',async()=>{
 for(const surface of [CAREERS,JOBS]){
  const io=reader((page,url)=>url===surface?changed(page,text(page).replace('<head>','<head><base href="https://external.invalid/">')):page)
  await assert.rejects(run(io),/base|declaration/i)
  assert.equal(io.calls.length,surface===CAREERS?1:2)
 }
})

test('MIME parameters cannot impersonate the declared HTML, JSON or JavaScript essence',async()=>{
 for(const [surface,mime] of [[CAREERS,'text/plain; ignored=text/html'],[QUERY,'text/plain; ignored=application/json'],
  ['https://2u.com/careers-teams-locations-f81784e5e6f699b2511b.js','text/plain; ignored=application/javascript']]){
  const io=reader((page,url)=>url===surface?{...page,headers:{...page.headers,'content-type':mime}}:page)
  await assert.rejects(run(io),/response type/i)
  assert.equal(io.calls.at(-1),surface)
 }
})

test('default catalog preserves complete US positive and original bytes/clocks without audit callbacks',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='2u')
 const jobs=await createCatalogScraper(provider).run(reader())
 assert.equal(jobs.length,0)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.source,'2u');assert.equal(audit.observations.length,2)
 assert.equal(audit.observations.find(row=>row.id==='8871017002').id,'8871017002');assert.equal(audit.observations.find(row=>row.id==='8871017002').country,'United States')
 assert.equal(audit.observations.find(row=>row.id==='8871017002').sourceDetailComplete,true)
 assert.equal(audit.originalPages.length,18)
 for(const [index,page]of audit.originalPages.entries()){
  const original=originals.get(page.requestedURL)
  assert.equal(page.bodyBase64,original.bodyBase64)
  assert.equal(page.requestedURL,manifest.records[index].requestedUrl)
  assert.equal(page.requestedAt,manifest.records[index].sourceRequestedAt)
  assert.equal(page.completedAt,manifest.records[index].sourceCompletedAt)
 }
 assert.equal(readSourceObservationEvidence(jobs,'2u').observedVacancyCount,2)
 assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
})

test('optional failure diagnostics do not invoke an original Error metadata setter',async()=>{
 const reason=Object.assign(Error('Original blocked transport sentinel'),{failureKind:'blocked_or_access_denied'})
 let called=false
 Object.defineProperty(reason,'recruitmentObservations',{configurable:true,set(){called=true;throw Error('Metadata setter sentinel')}})
 const result=await caught(run({fetchPage:()=>{throw reason}}))
 assert.equal(result.resolved,false);assert.equal(result.reason,reason);assert.equal(called,false)
})

test('a closing-only visible country conflict cannot reuse a qualified opening India row',async()=>{
 let details=0
 const io=reader((page,url)=>url===ROLE&&++details===2?page:india(page,url))
 const result=await caught(run(io))
 assert.equal(result.resolved,false)
 assert.match(result.reason.message,/closing.*changed/i)
 const audit=result.reason.sourceAudit
 assert.equal(audit.observations.find(row=>row.id==='8871017002').country,'India')
 assert.equal(audit.observations.find(row=>row.id==='8871017002').visibleCountryMatch,true)
 assert.equal(audit.closing.observations.find(row=>row.id==='8871017002').visibleCountryMatch,false)
 assert.equal(audit.closingMatches,false);assert.equal(audit.sourceScopeComplete,false)
})
