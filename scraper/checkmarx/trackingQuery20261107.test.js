import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeData} from './nativeData.js'
import {parseCheckmarxBoard} from './nativeContract.js'
import {createRequire,registerHooks} from 'node:module'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,isFreshCompleteInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const compressed=fs.readFileSync(new URL('./test-inputs/current-tracking-query-board-20261107.json.gz',import.meta.url))
assert.equal(sha(compressed),'169e4547437c2dcf5b6228f4f2539a9a4db8f35ef32a85456bb6c05afd328f0f')
const fixture=JSON.parse(gunzipSync(compressed)),bytes=Buffer.from(fixture.packet.bodyBase64,'base64')
assert.equal(bytes.length,fixture.packet.bodyBytes);assert.equal(sha(bytes),fixture.packet.bodySHA256)
const html=bytes.toString('utf8'),rows=readNativeData(html,'COMPANY_POSITIONS_DATA'),now=fixture.now
const profiles=fixture.observedQueryProfiles
assert.equal(rows.length,40);assert.equal(profiles.length,2)
function withRows(next){return html.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/,(_all,prefix,line)=>prefix+JSON.stringify(next).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||''))}
const single=row=>parseCheckmarxBoard(withRows([row]),{now})
const official=(row,change)=>{const u=new URL(row.url_active_page);change(u);row.url_active_page=u.href;row.url_detected_page=u.href}

test('genuine current board retains all40 records, typed India identity and unresolved missing-country hold',()=>{
 const parsed=parseCheckmarxBoard(html,{now})
 assert.deepEqual(parsed.rows,rows);assert.deepEqual(parsed.rows.filter(r=>r.location.country==='IN').map(r=>r.uid),['5D.474'])
 assert.equal(parsed.heldNativeRows.length,1);assert.equal(parsed.heldNativeRows[0].uid,'5C.271')
 assert.deepEqual(parsed.heldNativeRows[0].nativeRecord,rows.find(r=>r.uid==='5C.271'))
 assert.equal(parsed.companyGlobalTotal,null);assert.equal(parsed.companyIndiaTotal,null)
})

for(const profile of profiles){
 const original=rows.find(r=>r.uid===profile.uid)
 test('exact genuine foreign-public tracking data is retained for '+profile.uid,()=>{
  const url=new URL(original.url_active_page)
  assert.equal(url.origin,'https://checkmarx.com');assert.equal(url.pathname,profile.path)
  assert.equal(sha(url.search.slice(1)),profile.rawQuerySHA256);assert.equal(original.location.country,'US');assert.equal(original.is_internal,false)
  const parsed=single(original);assert.deepEqual(parsed.rows,[original]);assert.equal(new URL(parsed.rows[0].url_comeet_hosted_page).search,'')
 })
 const mutations=[
  ['changed query value',r=>official(r,u=>{const key=[...u.searchParams.keys()][0];u.searchParams.set(key,u.searchParams.get(key)+'x')})],
  ['unknown query key',r=>official(r,u=>u.search+='&unreviewed=1')],
  ['duplicate query key',r=>official(r,u=>{const key=[...u.searchParams.keys()][0];u.search+='&'+key+'='+encodeURIComponent(u.searchParams.get(key))})],
  ['equivalent encoded key spelling',r=>official(r,u=>{const q=u.search.slice(1);u.search='?%'+q.charCodeAt(0).toString(16)+q.slice(1)})],
  ['raw key order',r=>official(r,u=>{u.search='?'+u.search.slice(1).split('&').reverse().join('&')})],
  ['extra legacy tracker',r=>official(r,u=>u.search+='&ref=search')],
  ['same identity without observed slash',r=>official(r,u=>{u.pathname=u.pathname.slice(0,-1)})],
  ['raw dot-segment path concealed by URL normalization',r=>{const u=new URL(r.url_active_page);r.url_active_page=u.origin+'/job-openings/position/other/../'+r.uid+'/'+u.search;r.url_detected_page=u.href}],
  ['changed role UID with otherwise matching native links',r=>{const previous=r.uid;r.uid='00.000';for(const key of ['url_active_page','url_detected_page','url_comeet_hosted_page','url_recruit_hosted_page'])r[key]=r[key].replace(previous,r.uid)}],
  ['another reviewed row query',r=>official(r,u=>{u.search=new URL(rows.find(x=>x.uid===profiles.find(p=>p.uid!==profile.uid).uid).url_active_page).search})],
  ['typed India instead of observed US',r=>{r.location={...r.location,country:'IN',city:'Pune',state:null,name:'India - Pune'}}],
  ['other known country',r=>{r.location={...r.location,country:'PT',city:'Lisbon',state:null,name:'Portugal - Lisbon'}}],
  ['missing country hold',r=>{r.location.country=''}],
  ['employee-only record',r=>{r.is_internal=true}],
  ['foreign official origin',r=>official(r,u=>{u.hostname='unrelated.invalid'})],
  ['wrong official path identity',r=>official(r,u=>{u.pathname='/job-openings/position/00.000/'})],
  ['official fragment',r=>official(r,u=>{u.hash='other'})],
  ['official credentials',r=>official(r,u=>{u.username='other'})],
  ['employer mismatch',r=>{r.company_name='Other employer'}],
  ['invalid native update calendar',r=>{r.time_updated='2026-02-30T00:00:00Z'}],
  ['extra typed country carrier',r=>{r.location.countryCode='IN'}],
  ['unverified secondary worksite',r=>{r.additional_locations=[{country:'IN'}]}],
  ['unreviewed publication date',r=>{r.datePosted='2026-11-07'}],
 ]
 for(const [name,change]of mutations)test('exact tracking profile '+profile.uid+' rejects '+name,()=>{
  const row=structuredClone(original);change(row);assert.throws(()=>single(row),/Checkmarx native contract:/)
 })
}

const captured=fixture.registeredDefault,provider=getScraperCatalog().find(p=>p.source==='checkmarx')
function dbTripwire(t){
 let attempts=0
 const deny=()=>{attempts++;throw Error('Checkmarx offline DB tripwire')},require=createRequire(import.meta.url),mongoose=require('mongoose'),{MongoClient}=require('mongodb')
 for(const [object,key]of [[mongoose,'connect'],[mongoose,'createConnection'],[mongoose.Connection.prototype,'openUri'],[MongoClient,'connect'],[MongoClient.prototype,'connect']])t.mock.method(object,key,deny)
 const hook=registerHooks({load(url,context,next){if(/\/utils\/saveToDB\.js(?:\?|$)/.test(url))deny();return next(url,context)}})
 t.after(()=>{hook.deregister();assert.equal(attempts,0)})
}
function setupReplay(t,{change=(_p,_i,b)=>b,status=(_p,_i)=>200}={}){
 dbTripwire(t)
 const RealDate=Date,calls=[],clocks=[...captured.sourceClocks]
 t.mock.method(globalThis,'Date',new Proxy(RealDate,{construct(Target,args,newTarget){
  if(args.length===0&&/scraper[\\/]checkmarx[\\/]nativeRun\.js/.test(new Error().stack)){assert.ok(clocks.length,'No unrecorded source clocks');return Reflect.construct(Target,[clocks.shift()],newTarget)}
  return Reflect.construct(Target,args,newTarget)
 }}))
 t.mock.method(globalThis,'fetch',async(input,init={})=>{
  const index=calls.length,p=captured.packets[index];assert.ok(p,'No extra native or application requests')
  assert.equal(String(input),p.url);assert.deepEqual(Object.keys(init).sort(),['headers','signal']);assert.equal(init.method,undefined);assert.equal(init.redirect,undefined);assert.equal(init.credentials,undefined);assert.equal(init.body,undefined)
  assert.deepEqual(Object.fromEntries(new Headers(init.headers)),p.sourceHeaders);assert.ok(init.signal instanceof AbortSignal)
  assert.equal(p.method,'GET');assert.equal(p.redirect,null);assert.equal(p.credentials,null);assert.equal(p.requestBodyBytes,0);assert.equal(sha(Buffer.alloc(0)),p.requestBodySHA256)
  const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(sha(b),p.bodySHA256)
  calls.push(p.bodySHA256)
  const r=new Response(change(p,index,b),{status:status(p,index),headers:p.responseHeaders});Object.defineProperty(r,'url',{value:p.finalURL});return r
 })
 return{calls,clocks,run:options=>createCatalogScraper(provider).run(options)}
}
function fullOutput(jobs){return{jobs,inventory:readInventoryEvidence(jobs),observations:readSourceObservationEvidence(jobs,'checkmarx'),nativeCollectionEvidence:jobs.nativeCollectionEvidence,error:null}}

test('actual registered no-options default replays all3 original responses, exact init, seven clocks and ENTIRE full output',async t=>{
 const r=setupReplay(t),jobs=await r.run()
 assert.equal(r.calls.length,3);assert.equal(r.clocks.length,0);assert.deepEqual(fullOutput(jobs),captured.fullOutput)
 assert.equal(sha(JSON.stringify(fullOutput(jobs))),captured.result.fullOutput.SHA256)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'5D.474');assert.equal(jobs[0].requisitionId,'C169');assert.equal(jobs[0].nativeCountry,'IN');assert.equal(jobs[0].nativeEmployer,'Checkmarx')
 assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].closingDate,null);assert.equal(jobs[0].sourceDetailComplete,true)
 assert.ok(jobs[0].jobDescription.includes('Mumbai or Pune'));assert.equal(jobs[0].applicationVisited,false)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.openingNativeRows.length,40);assert.deepEqual(audit.openingNativeRows,audit.closingNativeRows);assert.equal(audit.observations.length,40)
 assert.equal(audit.heldNativeRows.length,1);assert.equal(audit.heldNativeRows[0].uid,'5C.271');assert.equal(audit.heldNativeRows[0].nativeRecord.location.country,'')
 assert.deepEqual(audit.heldNativeRows[0].nativeRecord,audit.heldNativeRows[0].closingNativeRecord)
 assert.equal(readSourceObservationEvidence(jobs,'checkmarx').observedVacancyCount,40)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(isFreshCompleteInventoryEvidence(readInventoryEvidence(jobs),{now:captured.sourceClocks[0]}),false)
})

test('an exact-profile query changing only at closing remains fatal to the whole registered run',async t=>{
 const r=setupReplay(t,{change:(_p,index,b)=>{
  if(index!==2)return b
  const h=b.toString('utf8'),next=readNativeData(h,'COMPANY_POSITIONS_DATA'),row=next.find(p=>p.uid===profiles[0].uid)
  official(row,u=>{u.search+='&unreviewed=1'})
  return Buffer.from(h.replace(/(\bCOMPANY_POSITIONS_DATA\s*=\s*)([^\r\n]+)/,(_all,prefix,line)=>prefix+JSON.stringify(next).replaceAll('<','\\u003C').replaceAll('>','\\u003E')+(line.match(/[,;]\s*$/)?.[0]||'')))
 }})
 await assert.rejects(r.run(),/Native official tracking query changed/);assert.equal(r.calls.length,3)
})

test('primary native403 remains a numeric denied failure and cannot become an empty success',async t=>{
 const r=setupReplay(t,{status:()=>403})
 await assert.rejects(r.run(),e=>e.httpStatus===403&&e.failureKind==='upstream_blocked'&&/403/.test(e.message));assert.equal(r.calls.length,1)
})

test('an already-aborted opaque frozen caller reason wins unchanged with zero requests',async t=>{
 const r=setupReplay(t),controller=new AbortController(),reason=Object.freeze(Object.create(null));controller.abort(reason)
 await assert.rejects(r.run({signal:controller.signal}),e=>e===reason);assert.equal(r.calls.length,0)
})
