import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readCurrentSapphireProgramme} from './currentProgramme20261121.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-declared-20261121.json.gz',import.meta.url))))
const CAREERS='https://www.sapphiresolutions.net/careers?tab=CurrentOpenings',LIST='https://erpnew.onlinevidyalaya.net/Website/getvacancylist'
const programme=Buffer.from(fixture.packets.find(p=>p.requestedURL.endsWith('.js')).bodyBase64,'base64').toString()
test('actual current own declaration acquires four whole vacancy observations without a client filename or byte pin',async()=>{
 const calls=[]
 const jobs=await run({requestIntervalMs:0,fetchImpl:async(url,init)=>{
  const p=fixture.packets.find(p=>p.requestedURL===url);assert.ok(p,'Only actual retained declared URL: '+url)
  calls.push({url,method:init.method??'GET'});assert.equal(init.redirect,'manual')
  if(url===LIST){assert.equal(init.method,'POST');assert.equal(init.body,undefined)}
  const response=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 }})
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,4)
 assert.equal(jobs.nativeCollectionEvidence.observations.length,4)
 assert.ok(jobs.nativeCollectionEvidence.observations.every(r=>r.country===null&&r.nativeRecord.location===null&&r.fullOwnRoleCriteriaQualified===false))
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 const denied=calls.findIndex(c=>/\/jobs\//.test(new URL(c.url).pathname))
 assert.ok(denied>=0,'Retain actual historical public own role dependency observation')
 assert.ok(calls.slice(denied+1).every(c=>new URL(c.url).hostname!=='www.sapphiresolutions.net'),'Publisher denial stops later same-host reads')
 assert.ok(calls.some(c=>c.url===CAREERS))
})

test('actual current programme projects only recruitment semantics and accepts cosmetic changes',()=>{
 const actual=readCurrentSapphireProgramme(programme)
 const cosmetic=programme.replaceAll('commonbtnsty','newCosmeticButtonClass')+'\n/* unrelated visual deployment */\n'
 assert.notEqual(cosmetic,programme)
 assert.deepEqual(readCurrentSapphireProgramme(cosmetic),actual)
 const before='function i(){return window.location.hostname,"https://erpnew.onlinevidyalaya.net"}r.d(a,{k:function(){return i}})'
 const after='function renamedOrigin(){return window.location.hostname,"https://erpnew.onlinevidyalaya.net"}r.d(a,{k:function(){return renamedOrigin}})'
 assert.ok(programme.includes(before))
 assert.deepEqual(readCurrentSapphireProgramme(programme.replace(before,after)),actual)
})

test('actual current programme requires its webpack carrier to execute at top level',()=>{
 const changed='function uncalledRecruitmentCarrier(){'+programme+'\n}'
 assert.throws(()=>readCurrentSapphireProgramme(changed),/Native recruitment programme/)
})

for(const [label,before,after]of [
 ['foreign API origin','https://erpnew.onlinevidyalaya.net','https://unrelated.example'],
 ['changed public route','/Website/getvacancylist','/Website/different'],
 ['changed method','{method:"POST"}','{method:"GET"}'],
 ['added body','{method:"POST"}','{method:"POST",body:"{}"}'],
 ['added headers','{method:"POST"}','{method:"POST",headers:{Authorization:"unknown"}}'],
 ['different payload array','r(i.vacancyList||[])','r(i.differentArray||[])'],
 ['different role URL field','"/jobs/".concat(a.applyURL)','"/jobs/".concat(a.otherURL)'],
 ['different title field','children:a.position','children:a.differentTitle'],
 ['disconnected native row','{item:e,cardImage:r}','{item:unrelatedRow,cardImage:r}'],
 ['reassigned native card row','let{item:a,cardImage:r}=e;return','let{item:a,cardImage:r}=e;a=unrelatedRow;return'],
 ['mutated native application field','let{item:a,cardImage:r}=e;return','let{item:a,cardImage:r}=e;a.applyURL="unrelated";return'],
 ['deleted native application field','let{item:a,cardImage:r}=e;return','let{item:a,cardImage:r}=e;delete a.applyURL;return'],
 ['shadowed public fetch','async()=>{try{let a=await fetch','async()=>{const fetch=unrelatedFetch;try{let a=await fetch'],
 ['different provider export','k:function(){return i}','k:function(){return unrelatedGetter}'],
 ['dormant Next page registration','(window.__NEXT_P=window.__NEXT_P||[]).push(["/careers",function(){return r(54179)}])','function uncalledPageRegistration(){(window.__NEXT_P=window.__NEXT_P||[]).push(["/careers",function(){return r(54179)}])}'],
 ['different scheduled native entry','return e(e.s=46447)','return e(e.s=33183)'],
 ['different registered careers module','["/careers",function(){return r(54179)}]','["/careers",function(){return r(33183)}]'],
 ['different default page export','var er=ea','var er=unrelatedPage'],
 ['disconnected active vacancy component','(0,i.jsx)(f,{})','(0,i.jsx)(unrelatedComponent,{})'],
])test('actual source programme rejects '+label,()=>{
 assert.ok(programme.includes(before),'Mutation changes actual original syntax: '+label)
 const changed=programme.replaceAll(before,after)
 assert.throws(()=>readCurrentSapphireProgramme(changed),/Native recruitment programme/)
})

for(const reason of [Object.freeze({caller:'frozen-owner'}),null])for(const mode of ['observations','identity-error','http403'])test('caller exact reason survives final source close: '+mode+'/'+(reason===null?'null':'object'),async()=>{
 const controller=new AbortController()
 let calls=0
 await assert.rejects(run({signal:controller.signal,requestIntervalMs:0,fetchImpl:async(url,init)=>{
  calls++
  init.signal.addEventListener('abort',()=>controller.abort(reason),{once:true})
  const p=fixture.packets.find(p=>p.requestedURL===url);assert.ok(p)
  let bytes=Buffer.from(p.bodyBase64,'base64'),status=p.status
  if(url===CAREERS&&mode==='identity-error')bytes=Buffer.from(bytes.toString().replace('Career at Sapphire Software Solutions','Different employer'))
  if(url===CAREERS&&mode==='http403')status=403
  const response=new Response(bytes,{status,headers:p.headers});Object.defineProperty(response,'url',{value:p.url});return response
 }}),error=>error===reason)
 assert.ok(calls>0)
})
