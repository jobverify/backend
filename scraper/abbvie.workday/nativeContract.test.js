import fs from 'node:fs'
import test from 'node:test'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const api='https://api.smartrecruiters.com/v1/companies/AbbVie/postings',board=api+'?limit=100&offset=0&country=in',official='https://careers.abbvie.com/en/job/senior-payroll-specialist-in-bengaluru-ka-jid-34541',binding=api+'/f4c48885-c0b4-4336-9afd-fb1783119848',fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
function mock(mutate=r=>r){const requests=[],index=new Map(),calls=new Map();for(const r of fixture().requests)index.set(r.url,[...(index.get(r.url)||[]),r]);const root='https://careers.abbvie.com/en/';index.set(root,[{url:root,status:200,headers:{'content-type':'text/html'},bodyComplete:true,rawBodyBase64:Buffer.from('<title>Careers | AbbVie</title><a href="'+official+'">Current public role</a>').toString('base64')}]);return{requests,transport:async url=>{requests.push(url);const rows=index.get(url);assert.ok(rows,url);const i=calls.get(url)||0;calls.set(url,i+1);return mutate({...rows[Math.min(i,rows.length-1)],body:Buffer.from(rows[Math.min(i,rows.length-1)].rawBodyBase64,'base64')},requests)}}}
const json=(r,fn)=>({...r,body:Buffer.from(JSON.stringify(fn(JSON.parse(r.body))))})

test('AbbVie discovers its current role binding from the official landing page instead of depending on an expired role',async()=>{
 const m=mock(),root='https://careers.abbvie.com/en/'
 const transport=async url=>url===root?{url,status:200,headers:{'content-type':'text/html'},body:Buffer.from(`<title>Careers | AbbVie</title><a href="${official}">Current public role</a>`),bodyComplete:true}:m.transport(url)
 const calls=[]
 const jobs=await run({transport:async url=>{calls.push(url);return transport(url)}})
 assert.equal(calls[0],root)
 assert.equal(jobs.length,27)
})

test('an expired historical AbbVie role is never requested when the landing page publishes another current role',async()=>{
 const m=mock(),root='https://careers.abbvie.com/en/',current=official.replace('jid-34541','jid-99999'),calls=[]
 const retained=fixture().requests.find(r=>r.url===official)
 const original=Buffer.from(retained.rawBodyBase64,'base64').toString()
 const rawPosting=original.match(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/)[1]
 const posting=JSON.parse(rawPosting)
 const body=original.replace(rawPosting,JSON.stringify({...posting,url:current}))
 const jobs=await run({transport:async url=>{
  calls.push(url)
  assert.notEqual(url,official,'The expired pinned URL must stay unused')
  if(url===root)return {url,status:200,headers:{'content-type':'text/html'},body:Buffer.from(`<title>AbbVie Careers</title><a href="${current}">Current role</a>`),bodyComplete:true}
  if(url===current)return {...retained,url,body:Buffer.from(body)}
  return m.transport(url)
 }})
 assert.equal(jobs.length,27)
 assert.ok(calls.includes(current))
})

test('hidden, foreign or absent official roles cannot authorize an AbbVie native account',async()=>{
 for(const content of [`<a hidden href="${official}">Role</a>`,`<a href="https://other.test/en/job/engineer-jid-123">Role</a>`, '<p>No current role link</p>']){
  let calls=0
  await assert.rejects(run({transport:async url=>{calls++;return {url,status:200,headers:{'content-type':'text/html'},body:Buffer.from('<title>AbbVie Careers</title>'+content),bodyComplete:true}}}),error=>error.nativeEvidence.cleanupAllowed===false)
  assert.equal(calls,1)
 }
})
test('AbbVie replaces sentinel with30native India rows and27complete details bound by official job-ad ID',async()=>{const m=mock(),jobs=await run({transport:m.transport});assert.equal(jobs.length,27);const n=jobs[0].nativeCollectionEvidence;assert.equal(n.nativeReportedTotal,30);assert.equal(n.observedListingCount,30);assert.equal(n.pagesFetched,1);assert.equal(n.failures.length,3);assert.equal(n.listingPaginationComplete,true);assert.equal(n.closingInventoryMatches,true);assert.equal(m.requests.length,35);assert.ok(m.requests.every(u=>!u.includes('oga=')&&!/Workflow|applications|login/.test(u)));for(const j of jobs){assert.equal(j.company,'AbbVie');assert.equal(j.source,'abbvie');assert.equal(j.country,'India');assert.ok(j.requisitionId.startsWith('R'));assert.ok(j.sourceDescription.length>200);assert.equal(j.postingDate,j.nativeFacts.nativeSmartRecruitersPosting.releasedDate);assert.equal(j.sourceScopeComplete,false);assert.equal(j.lifecycleCleanupAllowed,false);assert.notEqual(j.jobId,j.nativeFacts.nativeSmartRecruitersPosting.jobAdId)}assert.equal(readInventoryEvidence(jobs).reportedTotal,30);assert.equal(readInventoryEvidence(jobs).listingComplete,false)})
test('native jobAdId binds official UUID separately from posting UUID and requisite R number',async()=>{const m=mock(r=>r.url===binding?json(r,p=>({...p,jobAdId:'foreign-ad'})):r);await assert.rejects(run({transport:m.transport}),/incomplete|forbidden/i)})
test('a missing description, country, date or wrong application remains one failed role',async()=>{const target=api+'/3743990016328567';for(const kind of['description','country','date','application','HTTP']){const m=mock(r=>r.url!==target?r:kind==='HTTP'?{...r,status:503}:json(r,p=>{if(kind==='description')p.jobAd.sections.jobDescription.text='';if(kind==='country')p.location.country='us';if(kind==='date')p.releasedDate='2099-01-01T00:00:00.000Z';if(kind==='application')p.applyUrl=p.applyUrl.replace(p.id,'FOREIGN');return p})),jobs=await run({transport:m.transport});assert.equal(jobs.length,26,kind);assert.equal(jobs[0].nativeCollectionEvidence.failures.length,4,kind);assert.ok(!jobs.some(j=>j.jobId==='3743990016328567'))}})
test('first listing or binding failures are not verified empty inventories',async()=>{for(const target of[board,binding,official]){const m=mock(r=>r.url===target?{...r,status:503}:r);await assert.rejects(run({transport:m.transport}),e=>{assert.equal(e.nativeEvidence.verifiedZeroInventory,false);assert.equal(e.nativeEvidence.cleanupAllowed,false);return true})}})
test('closing inventory drift preserves positive jobs with incomplete evidence',async()=>{const m=mock((r,calls)=>r.url===board&&calls.filter(u=>u===board).length===2?json(r,p=>({...p,content:p.content.map((j,i)=>i===0?{...j,name:'Changed title'}:j)})):r),jobs=await run({transport:m.transport});assert.equal(jobs.length,27);assert.equal(jobs[0].nativeCollectionEvidence.closingInventoryMatches,false)})
test('native zero with no rows remains explicit India API zero and forbids whole-employer cleanup',async()=>{const m=mock(r=>r.url===board?json(r,p=>({...p,totalFound:0,content:[]})):r),jobs=await run({transport:m.transport});assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,0);assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(jobs[Symbol.for('jobverify.native-html-evidence')].verifiedZeroInventory,false)})
test('complete pagination follows native100row offsets,reads101details and reconciles total',async()=>{const f=fixture(),p=JSON.parse(Buffer.from(f.requests.find(r=>r.url===board).rawBodyBase64,'base64')),base=p.content.find(r=>r.id==='3743990016328567'),detail=JSON.parse(Buffer.from(f.requests.find(r=>r.url===base.ref).rawBodyBase64,'base64')),all=Array.from({length:101},(_,i)=>({...base,id:String(4000000000000000+i),uuid:'00000000-0000-4000-8000-'+String(i).padStart(12,'0'),jobAdId:'10000000-0000-4000-8000-'+String(i).padStart(12,'0'),refNumber:'R'+(900000+i),ref:api+'/'+(4000000000000000+i)})),offsets=[],m=mock(),response=(url,p)=>({url,status:200,headers:{'content-type':'application/json'},body:Buffer.from(JSON.stringify(p)),bodyComplete:true}),transport=async url=>{if(url.startsWith(api+'?')){const offset=Number(new URL(url).searchParams.get('offset'));offsets.push(offset);return response(url,{offset,limit:100,totalFound:101,content:all.slice(offset,offset+100)})}const r=all.find(r=>r.ref===url);if(r)return response(url,{...detail,...r,postingUrl:detail.postingUrl.replace(detail.id,r.id),applyUrl:detail.applyUrl.replace(detail.id,r.id)});return m.transport(url)},jobs=await run({transport});assert.equal(jobs.length,101);assert.equal(jobs[0].nativeCollectionEvidence.failures.length,0);assert.equal(jobs[0].nativeCollectionEvidence.pagesFetched,2);assert.equal(jobs[0].nativeCollectionEvidence.listingPaginationComplete,true);assert.deepEqual(offsets,[0,100,0])})
test('upstream country filter violations retain explicit row errors rather than geographic inference',async()=>{const m=mock(r=>r.url===board?json(r,p=>({...p,content:p.content.map((j,i)=>i===0?{...j,location:{...j.location,country:'us'}}:j)})):r),jobs=await run({transport:m.transport}),n=jobs[0].nativeCollectionEvidence;assert.equal(jobs.length,27);assert.equal(n.listingPaginationComplete,false);assert.equal(n.failures.filter(f=>f.stage==='native-listing-row').length,1);assert.equal(n.observedListingCount,30)})
