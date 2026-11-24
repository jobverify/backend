import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const raw=fs.readFileSync(new URL('./test-data-20261121/current-originals.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(raw)),manifest=JSON.parse(fs.readFileSync(new URL('./test-data-20261121/manifest.json',import.meta.url)))
assert.equal(sha(raw),manifest.fixtureSHA256)
const oldManifest=JSON.parse(fs.readFileSync(new URL('./test-data-20261110/manifest.json',import.meta.url)))
const oldPackets=new Map(oldManifest.records.map(row=>{const packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261110/'+row.file,import.meta.url))));return[row.id,{...packet,body:Buffer.from(packet.bodyBase64,'base64')}]}))
const oldCompany=oldPackets.get('opening-company').body
function replay(edit=page=>page,options={},legacy=false){
 const calls=[],mutated=[],responses=[],visits=new Map()
 const fetchImpl=async(url,init)=>{
  const index=calls.length,visit=(visits.get(url)??0)+1;visits.set(url,visit);calls.push({url,init})
  let packet,id
  if(legacy){const record=oldManifest.records.find(row=>row.requestUrl===url);assert(record);id=record.id.split('-').slice(1).join('-');const old=oldPackets.get((visit===1?'opening-':'closing-')+id);packet={requestedURL:url,finalURL:old.finalUrl,status:old.status,headers:old.headers,bodyBase64:old.bodyBase64,bodySHA256:sha(old.body),bodyBytes:old.body.length}}
  else{id=fixture.sequence[index];packet=fixture.packets[id];assert(packet,'No undeclared request');assert.equal(url,packet.requestedURL)}
  const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(sha(body),packet.bodySHA256);assert.equal(body.length,packet.bodyBytes)
  const page={url:packet.finalURL,status:packet.status,headers:structuredClone(packet.headers),body},before=JSON.stringify(page.headers),changed=edit(page,{id,index,visit,text:body.toString('utf8')})
  if(sha(changed.body)!==packet.bodySHA256||changed.url!==page.url||changed.status!==page.status||JSON.stringify(changed.headers)!==before)mutated.push(index)
  assert.equal(init.method,'GET');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'error');assert.equal(init.cache,'no-store')
  const response=new Response(changed.body,{status:changed.status,headers:changed.headers});Object.defineProperty(response,'url',{value:changed.url});responses.push(response);return response
 }
 return{calls,mutated,responses,run:()=>run({fetchImpl,...options})}
}
function finite(jobs,requests){
 assert.equal(jobs.length,0);assert(isVerifiedEmptyEvidence(readInventoryEvidence(jobs)))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,0);assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 const audit=jobs.nativeCollectionEvidence;assert.equal(audit.receipts.length,requests);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(audit.opening.jobs.emptyText,'No Open Positions');assert(audit.opening.jobs.generalInterestOptions.every(row=>row.disposition==='general-interest-only'))
 assert.equal(audit.currentContextRechecked,true);assert.equal(audit.nativeProgrammeScopeComplete,true)
}
test('actual current originals qualify only the finite empty Jobs and Students programme',async()=>{const r=replay(),jobs=await r.run();finite(jobs,14);assert.equal(r.calls.length,14);assert.equal(fixture.closingObserved,false);assert.equal(fixture.legacyRedactedExportsExcluded,true);for(const response of r.responses)assert.equal(response.body.locked,false)})
test('retained legacy originals also hold company-global zero and retain their twelve-read proof',async()=>{const r=replay(page=>page,{},true);finite(await r.run(),12);assert.equal(r.calls.length,12)})
async function held(id,visit,change,pattern,count,options={}){
 const r=replay((page,c)=>c.id===id&&c.visit===visit?change(page,c):page,options)
 await assert.rejects(r.run(),pattern);assert(r.mutated.length>0,'Intended acquired original must change');assert.equal(r.calls.length,count);return r
}
for(const[label,change]of[
 ['unknown corporate employer',text=>text.replace('<title>Kreeti Technologies Pvt. Ltd.</title>','<title>Other Employer</title>')],
 ['new corporate recruitment programme',text=>text.replace('</body>','<a href="https://other.example/jobs">Additional jobs</a></body>')],
 ['unknown consent loader',text=>text.replace('cookie_consent/v1.0.0.js','cookie_consent/v1.0.1.js')],
 ['missing publisher SRI',text=>text.replace(/integrity="sha384-[^"]+"/,'')],
 ['new consent activation carrier',text=>text.replace('</body>','<script type="text/plain" data-kawach-category="functional">fetch("/new-jobs")</script></body>')]
])test('current corporate guard holds '+label,()=>held('company',1,(page,c)=>({...page,body:Buffer.from(change(c.text))}),/publisher|identity|review|scope/i,1))
for(const[label,visit,count]of [['opening',1,2],['closing',2,12]])test('current consent complete body '+label+' must stay exact',()=>held('consent',visit,(page,c)=>({...page,body:Buffer.from(c.text+'\n/* unreviewed complete program */')}),/consent|program|changed/i,count))
test('current consent response type is checked as JavaScript',()=>held('consent',1,page=>({...page,headers:{...page.headers,'content-type':'text/html'}}),/MIME/i,2))
for(const[label,id,change,count]of[
 ['hidden explicit empty heading','jobs',text=>text.replace('<h3 class="section-title">No Open Positions</h3>','<h3 hidden class="section-title">No Open Positions</h3>'),5],
 ['current vacancy in empty section','jobs',text=>text.replace('<section class="jobs">','<section class="jobs"><a href="/jobs/999">Current Engineer</a>'),5],
 ['additional country filter','jobs',text=>text.replace('<section class="jobs">','<section class="jobs"><select name="country"><option>India</option></select>'),5],
 ['new student vacancy','students',text=>text.replace('</body>','<a href="/jobs/999">Current Internship</a></body>'),4],
 ['new native renderer','home',text=>text.replace('</head>','<script src="/unknown-jobs.js"></script></head>'),3],
 ['new hidden job state','jobs',text=>text.replace('<button','<button data-jobs="/jobs/current"'),5],
 ['CSRF metadata extra authority','jobs',text=>text.replace('<meta name="csrf-token"','<meta data-jobs="/jobs/current" name="csrf-token"'),5]
])test('current native guard holds '+label,()=>held(id,1,(page,c)=>({...page,body:Buffer.from(change(c.text))}),/empty|positions|openings|vacancy|pagination|country|filter|scope|renderer|context|structure|CSRF/i,count))
test('current closing vacancy cannot be hidden by unchanged opening state',()=>held('jobs',2,(page,c)=>({...page,body:Buffer.from(c.text.replace('No Open Positions','Current Engineer Vacancy'))}),/positions|empty|openings|context/i,8))
test('current closing corporate cannot mix the legacy whole document',()=>held('company',2,page=>({...page,body:oldCompany}),/closing|company|context|changed/i,11))
test('legacy closing corporate cannot mix the current whole document',async()=>{const r=replay((page,c)=>c.id==='company'&&c.visit===2?{...page,body:Buffer.from(fixture.packets.company.bodyBase64,'base64')}:page,{},true);await assert.rejects(r.run(),/closing|company|context|changed/i);assert.equal(r.calls.length,10);assert.equal(r.mutated.length,1)})
for(const[label,id,count]of [['renderer','renderer',13],['style','style',14]])test('current closing '+label+' retains its complete historical body proof',()=>held(id,2,(page,c)=>({...page,body:Buffer.from(c.text+'\n/* changed */')}),/program|CSS|changed/i,count))
test('a caller cannot supply an unreviewed corporate profile',async()=>{const text=Buffer.from(fixture.packets.company.bodyBase64,'base64').toString('utf8')+'\n';await held('company',1,page=>({...page,body:Buffer.from(text)}),/review/i,1,{companySHA256:sha(text),corporateProfile:{sha256:sha(text)}})})
for(const reason of [null,Object.freeze({stop:'current Kreeti'}),new Error('current Kreeti stop')])test('current cancellation identity survives at consent read: '+String(reason),async()=>{
 const controller=new AbortController();let calls=0
 await assert.rejects(run({signal:controller.signal,fetchImpl:async(url)=>{calls++;if(calls===2){controller.abort(reason);return new Promise(()=>{})}const row=fixture.packets.company;assert.equal(url,row.requestedURL);const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response}}),error=>error===reason)
 assert.equal(calls,2)
})
