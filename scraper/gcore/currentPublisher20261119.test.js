import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,readGcoreEvidence} from './script.js'
import {verifyCurrentDocumentActivation} from './currentPublisher.js'
import {readCurrentHydrationFrame} from './currentActivation20261119.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publisher-20261119.json.gz',import.meta.url))))
const legacy=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-publisher-20261106.json.gz',import.meta.url))))
const documents=current.packets.filter(p=>!p.requestedURL.endsWith('.js'))
const all=[...current.packets,...legacy.packets]
const execute=async(change=()=>{},options={},packets=all)=>{
 const calls=[],visits=new Map()
 const read=async(url,kind)=>{
  const visit=(visits.get(url)||0)+1;visits.set(url,visit)
  const exact=packets.filter(p=>p.requestedURL===url)
  const p=structuredClone(exact[visit-1]??(!packets[0].singleUse&&(exact[0]||packets.find(p=>new URL(p.requestedURL).origin===new URL(url).origin&&new URL(p.requestedURL).pathname===new URL(url).pathname))))
  assert.ok(p,'only genuine declared public reads '+url)
  assert.equal(createHash('sha256').update(p.body).digest('hex'),p.sha256)
  calls.push(url)
  const response={status:p.status,url:p.finalURL,body:p.body,contentType:p.contentType}
  change(response,url,visit)
  return kind==='page'?response:kind==='json'?JSON.parse(response.body):response.body
 }
 const jobs=await run({fetchText:url=>read(url,'text'),fetchJson:url=>read(url,'json'),fetchPage:url=>read(url,'page'),...options})
 return{jobs,calls,evidence:readGcoreEvidence(jobs),inventory:readInventoryEvidence(jobs)}
}

test('Gcore current actual publisher snapshots accept only their complete reviewed activation class',()=>{
 assert.equal(documents.length,5)
 for(const p of documents)assert.match(verifyCurrentDocumentActivation(p.body,p.requestedURL),/^[a-f0-9]{64}$/)
})

test('Gcore current module chain qualifies the retained real15-role native cohort without claiming India zero or company completeness',async()=>{
 const {jobs,evidence,inventory}=await execute()
 assert.equal(jobs.length,0)
 assert.equal(evidence.observedNativeRecords,15)
 assert.equal(evidence.unknownCountryRecords,11)
 assert.equal(evidence.currentPublisherProof.opening.resources.length,9)
 assert.equal(evidence.currentPublisherProof.closing.resources.length,9)
 assert.equal(evidence.rawNativeDetailRecords.length,15)
 assert.ok(jobs.nativeCollectionEvidence===evidence)
 assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(inventory.listingComplete,false)
 assert.notEqual(inventory.status,'verified-empty')
})

test('Gcore existing native fixture also preserves the full raw array audit and explicit cleanup hold',async()=>{
 const {jobs,evidence,inventory}=await execute(undefined,{},legacy.packets)
 assert.ok(jobs.nativeCollectionEvidence===evidence)
 assert.equal(evidence.rawNativeListingRecords.length,15)
 assert.equal(inventory.lifecycleCleanupAllowed,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Gcore45 actual current responses retain19 raw vacancies,14 unresolved country records and honest unsuccessful India zero',async()=>{
 const native=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261119.json.gz',import.meta.url))))
 const packets=native.packets.map(p=>({singleUse:true,requestedURL:p.requestedUrl,finalURL:p.finalUrl,status:p.status,contentType:p.headers['content-type'],body:p.text,sha256:p.sha256}))
 const {jobs,calls,evidence,inventory}=await execute(undefined,{},packets)
 assert.equal(calls.length,45);assert.equal(jobs.length,0)
 assert.equal(evidence.observedNativeRecords,19);assert.equal(evidence.observedPublicRecords,19)
 assert.equal(evidence.unknownCountryRecords,14);assert.equal(evidence.nativeEnumerationComplete,true)
 assert.equal(evidence.rawNativeListingRecords.length,19);assert.equal(evidence.rawNativeDetailRecords.length,19)
 assert.equal(evidence.rawClosingNativeListingRecords.length,19)
 assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.lifecycleCleanupAllowed,false)
 assert.equal(inventory.listingComplete,false);assert.notEqual(inventory.status,'verified-empty')
})

const official=documents.find(p=>p.requestedURL==='https://gcore.com/careers')
const hydration=html=>{
 const doc=readNativeDocument(html),walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)]
 return walk(doc.nodes(n=>n.tag==='root')[0]).find(n=>n.tag==='script'&&n.attrs.id==='ng-state').raw
}
const replaceState=(html,edit)=>{const raw=hydration(html),changed=edit(raw);assert.notEqual(changed,raw);return html.replace(raw,changed)}
const syntheticState=raw=>{
 const data=JSON.parse(raw),base=Number(data.__nghData__[22].c[0][0].t[7].slice(1))
 const ids=new Map([0,1,2,3].map(i=>['t'+(base+i),'t'+(750001+i)]))
 return raw.replace(/"t[1-9]\d*"/g,token=>ids.has(JSON.parse(token))?JSON.stringify(ids.get(JSON.parse(token))):token)
}
test('Gcore admits only the six paired typed SSR IDs while preserving every other current raw JSON byte',()=>{
 const changed=replaceState(official.body,syntheticState)
 assert.equal(readCurrentHydrationFrame(hydration(changed)),readCurrentHydrationFrame(hydration(official.body)))
 assert.notEqual(verifyCurrentDocumentActivation(changed,official.requestedURL),verifyCurrentDocumentActivation(official.body,official.requestedURL))
})
for(const [name,edit]of[
 ['broken template reference relation',raw=>{const data=JSON.parse(raw),id=data.__nghData__[22].c[0][0].t[7];return raw.replace(JSON.stringify(id),JSON.stringify('t750099'))}],
 ['escaped template ID literal',raw=>{const data=JSON.parse(raw),id=data.__nghData__[22].c[0][0].t[7];return raw.replace(JSON.stringify(id),'"\\u0074'+id.slice(1)+'"')}],
 ['new outside-ID binding',raw=>{const data=JSON.parse(raw),id=data.__nghData__[22].c[0][0].t[7];return raw.replace('{','{"outsideBinding":'+JSON.stringify(id)+',')}],
 ['new native state criteria',raw=>raw.replace('{','{"mandatoryCriteria":"unreviewed",')],
 ['changed exact JSON whitespace',raw=>raw+' '],
])test('Gcore rejects '+name+' in the current hydration program',()=>{
 const html=replaceState(official.body,edit)
 assert.throws(()=>verifyCurrentDocumentActivation(html,official.requestedURL),/unreviewed complete document activation/)
})
for(const [name,change]of[
 ['unknown runtime employer endpoint',h=>h.replace('https://api.smartrecruiters.com','https://foreign.example')],
 ['added hidden script',h=>h.replace('<head>','<head><script hidden>document.querySelector("[data-angular-vacancies]").remove()</script>')],
 ['unknown main URL',h=>h.replace('/main-BEJHN4PW.js','/main-UNREVIEWED.js')],
 ['changed PRLST whole cookie directive',h=>h.replace("SameSite=Lax; Secure;';}}var sbbeccf", "SameSite=Lax;';}}var sbbeccf")],
 ['changed typed UTGv2 cookie suffix',h=>h.replace(/(;expires=[^']*); Secure;'/,"$1;'")],
])test('Gcore current whole activation rejects '+name,()=>{
 const changed=change(official.body);assert.notEqual(changed,official.body)
 assert.throws(()=>verifyCurrentDocumentActivation(changed,official.requestedURL),/unreviewed complete document activation/)
})
for(const [name,change]of[
 ['foreign tenant in current native client',(r,url)=>{if(url.endsWith('/chunk-I2PIHQMX.js'))r.body=r.body.replace('he="Gcore"','he="OtherEmployer"')}],
 ['changed whole current CMS service',(r,url)=>{if(url.endsWith('/chunk-B6U2FXCK.js'))r.body+=';void 1;'}],
 ['closing current client mutation',(r,url,visit)=>{if(url.endsWith('/chunk-I2PIHQMX.js')&&visit===2)r.body+=';void 1;'}],
 ['hidden current vacancy mount',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=r.body.replace('data-angular-vacancies=""','data-angular-vacancies="" hidden')}],
 ['mixed official/positions deployment',(r,url)=>{if(url==='https://gcore.com/open-positions')r.body=legacy.packets.find(p=>p.requestedURL===url).body}],
 ['changed complete closing release',(r,url,visit)=>{if(['https://gcore.com/careers','https://gcore.com/open-positions'].includes(url)&&visit===2)r.body=legacy.packets.find(p=>p.requestedURL===url).body}],
])test('Gcore current qualification rejects '+name,async()=>{
 let changed=0
 await assert.rejects(execute((r,url,visit)=>{const before=r.body;change(r,url,visit);if(before!==r.body)changed++}),/Gcore.*(?:publisher|program|tuple|mount)/i)
 assert.ok(changed>0)
})
test('Gcore current declared module path preserves exact caller cancellation and reads no next module',async()=>{
 const controller=new AbortController(),reason=Error('cancelled new Gcore deployment'),reads=[]
 await assert.rejects(execute((r,url)=>{reads.push(url);if(url.endsWith('/main-BEJHN4PW.js'))controller.abort(reason)},{signal:controller.signal}),e=>e===reason)
 assert.equal(reads.at(-1),'https://gcore.com/main-BEJHN4PW.js')
})
