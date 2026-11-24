import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,HOMEPAGE_URL,CAREERS_URL} from './script.js'
import * as publication from './currentPublication.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261121.json.gz',import.meta.url))))
const role=fixture.pages.find(p=>p.requestedUrl.startsWith(CAREERS_URL+'/'))
const transport=()=>{
 const calls=[]
 return{calls,fetchPage:async url=>{calls.push(url);const packet=[...fixture.pages,...fixture.assets].find(p=>p.requestedUrl===url);assert.ok(packet,'Only original advertised public responses: '+url);return structuredClone(packet)}}
}

test('the actual current publication preserves its full role and publisher date while holding unknown country',async()=>{
 const replay=transport(),diagnostics=[]
 await assert.rejects(run({fetchPage:replay.fetchPage,onDiagnostic:d=>diagnostics.push(d)}),error=>{
  assert.equal(error.code,'incomplete_location_scope')
  const observation=error.diagnostic.unknownJobs[0]
  assert.equal(error.diagnostic.unknownJobs.length,1)
  assert.equal(observation.jobId,'-_XqzlxISa-lBr5iUvOFOg')
  assert.equal(observation.title,'Director of Engineering - AI')
  assert.equal(observation.country,null)
  assert.equal(observation.location,null)
  assert.equal(observation.postingDate,'2026-11-19')
  assert.equal(observation.updatedAt,'2026-11-19T07:38:18.518794+00:00')
  assert.match(observation.jobDescription,/14\+ years in software engineering/)
  assert.match(observation.jobDescription,/Comfort working in a fast-paced, evolving startup environment/)
  assert.match(observation.sourceDescription,/<p>Role Overview<\/p>/)
  assert.match(observation.sourceDescriptionRaw,/<p>Role Overview<br>/)
  assert.equal(observation.sourceListingComplete,false)
  assert.equal(error.nativeCollectionEvidence.completeInventory,false)
  assert.equal(error.nativeCollectionEvidence.companyScopeComplete,false)
  assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  assert.equal(error.nativeCollectionEvidence.boardInventoryComplete,true)
  return true
 })
 assert.equal(diagnostics.length,1)
 assert.equal(replay.calls.filter(url=>url===HOMEPAGE_URL).length,2,'Revalidate corporate authority at closing')
 assert.equal(replay.calls.filter(url=>url===CAREERS_URL).length,2,'Revalidate the complete native model at closing')
 assert.equal(replay.calls.filter(url=>url===role.requestedUrl).length,2,'Revalidate complete criteria and date at closing')
})

test('caller cancellation preserves the exact reason before any public request',async()=>{
 const controller=new AbortController(),reason=new Error('explicit caller cancellation')
 controller.abort(reason)
 const replay=transport()
 await assert.rejects(run({signal:controller.signal,fetchPage:replay.fetchPage,onDiagnostic:()=>{}}),error=>error===reason)
 assert.deepEqual(replay.calls,[])
})

test('caller cancellation interrupts an injected transport before its late resolution',async()=>{
 const controller=new AbortController(),reason=new Error('cancel during public request')
 let transportResolved=false
 const pending=run({signal:controller.signal,fetchPage:async()=>{
  setTimeout(()=>controller.abort(reason),5)
  return new Promise(resolve=>setTimeout(()=>{transportResolved=true;resolve(fixture.pages[0])},100))
 },onDiagnostic:()=>{}})
 await assert.rejects(pending,error=>error===reason)
 assert.equal(transportResolved,false,'Do not wait for a transport that ignores caller cancellation')
})

const changeJobPosting=(html,change)=>{
 let count=0
 const result=html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi,(all,attrs,body)=>{
  if(!/type="application\/ld\+json"/.test(attrs))return all
  const value=JSON.parse(body)
  if(value['@type']!=='JobPosting')return all
  count++;change(value)
  return '<script'+attrs+'>'+JSON.stringify(value)+'</script>'
 })
 assert.equal(count,1)
 assert.notEqual(result,html)
 return result
}

test('native model and full JobPosting agree independently of the publication hash guard',()=>{
 const model=publication.readCurrentNativeJobs(fixture.pages[1].html)
 assert.equal(model.length,1)
 const record=publication.readCurrentNativeRole(role,model[0])
 assert.equal(record.postingDate,'2026-11-19')
 assert.equal(record.jobDescription.length,4159)
 assert.equal(record.country,null)
 const schema=[...role.html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1])).find(value=>value['@type']==='JobPosting')
 assert.equal(record.sourceDescriptionRaw,schema.description)
})

for(const [name,mutate]of [
 ['employer',schema=>{schema.hiringOrganization.name='Another Employer'}],
 ['role country',schema=>{schema.jobLocation={address:{addressCountry:'IN'}}}],
 ['numeric identity',schema=>{schema.identifier.value='32'}],
 ['canonical role identity',schema=>{schema.url=CAREERS_URL+'/another-role'}],
 ['complete criteria',schema=>{schema.description=schema.description.replace('Comfort working in a fast-paced, evolving startup environment.','')}],
 ['native publication date',schema=>{delete schema.datePosted}],
])test('independent native semantics reject changed '+name,()=>{
 const model=publication.readCurrentNativeJobs(fixture.pages[1].html)[0]
 assert.throws(()=>publication.readCurrentNativeRole({...role,html:changeJobPosting(role.html,mutate)},model),/Techjays reviewed current publication/)
})

for(const injectCountry of [false,true])test('current deployment cannot escape qualification by adopting the legacy title'+(injectCountry?' with an invented role location':''),async()=>{
 const replay=transport()
 await assert.rejects(run({fetchPage:async url=>{
  const page=await replay.fetchPage(url)
  if(url===CAREERS_URL)page.html=page.html.replace('<title>Careers</title>','<title>Careers | Techjays</title>')
  if(injectCountry&&url===role.requestedUrl)page.html=page.html.replace('<h1 ','<span>Coimbatore</span><h1 ')
  return page
 },onDiagnostic:()=>{}}),/unreviewed complete original document/)
 assert.equal(replay.calls.length,2,'Reject changed current deployment before a legacy detail read')
})

test('independent native semantics reject criteria moved into hidden markup',()=>{
 const model=publication.readCurrentNativeJobs(fixture.pages[1].html)[0]
 const html=role.html.replace('class="blog-content"','class="blog-content" hidden')
 assert.notEqual(html,role.html)
 assert.throws(()=>publication.readCurrentNativeRole({...role,html},model),/complete active criteria/)
})

for(const [name,select,change]of [
 ['stylesheet',p=>p.requestedUrl.endsWith('.css'),p=>{p.html+='\n.careers-job-card { display:none }'}],
 ['card reveal client',p=>p.requestedUrl.endsWith('/20s-4ogx47ho1.js'),p=>{p.html=p.html.replace('whileInView:{opacity:1,y:0}','whileInView:{opacity:0,y:0}')}],
 ['HTTP denial',p=>p.requestedUrl.endsWith('/20s-4ogx47ho1.js'),p=>{p.status=403}],
 ['declared asset redirect',p=>p.requestedUrl.endsWith('/20s-4ogx47ho1.js'),p=>{p.status=302;p.url='https://other.example/asset.js'}],
])test('the current deployment holds '+name+' changes without retry or empty success',async()=>{
 const replay=transport(),calls=[]
 let changed=0
 await assert.rejects(run({fetchPage:async url=>{calls.push(url);const page=await replay.fetchPage(url);if(select(page)){const before=JSON.stringify(page);change(page);assert.notEqual(JSON.stringify(page),before);changed++}return page},onDiagnostic:()=>assert.fail('No complete inventory diagnostic before deployment qualification')}),error=>{
  assert.match(error.message,/declared stylesheet\/client/)
  assert.equal(error.nativeCollectionEvidence.completeInventory,false)
  assert.equal(error.nativeCollectionEvidence.boardInventoryComplete,false)
  assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  return true
 })
 assert.equal(changed,1)
 assert.equal(new Set(calls).size,calls.length,'Stop at the first failed asset, before any closing request')
})

for(const [name,url,change]of [
 ['listing',CAREERS_URL,html=>html.replace('Director of Engineering - AI','Changed native role')],
 ['full role criteria',role.requestedUrl,html=>html.replace('Comfort working in a fast-paced, evolving startup environment.','Changed closing criterion.')],
 ['publisher date',role.requestedUrl,html=>html.replace('"datePosted":"2026-11-19"','"datePosted":"2026-11-20"')],
])test('closing '+name+' drift preserves the observation and keeps cleanup held',async()=>{
 const replay=transport(),counts=new Map()
 await assert.rejects(run({fetchPage:async requested=>{const page=await replay.fetchPage(requested),count=(counts.get(requested)??0)+1;counts.set(requested,count);if(requested===url&&count===2){const changed=change(page.html);assert.notEqual(changed,page.html);page.html=changed}return page},onDiagnostic:()=>assert.fail('No closing certification after changed original content')}),error=>{
  assert.match(error.message,/unreviewed complete original document/)
  assert.equal(error.nativeCollectionEvidence.records.length,1)
  assert.equal(error.nativeCollectionEvidence.boardInventoryComplete,false)
  assert.equal(error.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
  return true
 })
})
