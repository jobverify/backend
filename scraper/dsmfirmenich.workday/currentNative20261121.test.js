import fs from 'node:fs'
import {decodeHTML} from 'entities'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readCurrentDsmEntry,readCurrentDsmRoles} from './currentProgramme20261121.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-declared-20261121.json.gz',import.meta.url))))
const packets=fixture.packets
const entrySource=Buffer.from(packets.find(p=>/\/pcsxPwa\./.test(p.requestedURL)).bodyBase64,'base64').toString()
const componentSource=Buffer.from(packets.find(p=>/\/12480\./.test(p.requestedURL)).bodyBase64,'base64').toString()
const pageSource=Buffer.from(packets.find(p=>/\/single-position-page\./.test(p.requestedURL)).bodyBase64,'base64').toString()
const entry=readCurrentDsmEntry(entrySource)
async function replay(options={},change=(p,b)=>b){
 const calls=[],original=globalThis.fetch
 const fetchImpl=async(url,init={})=>{
  const p=packets.find(p=>p.requestedURL===url);assert.ok(p,'Only actual declared retained route: '+url)
  assert.equal(init.method??'GET',p.method);assert.equal(init.body,undefined)
  calls.push(url)
  const bytes=change(p,Buffer.from(p.bodyBase64,'base64'),calls.filter(u=>u===url).length)
  return Object.defineProperty(new Response(bytes,{status:p.status,headers:p.headers}),'url',{value:p.url})
 }
 globalThis.fetch=fetchImpl
 try{return{jobs:await run({maxHydratedJobs:1,requestIntervalMs:0,fetchImpl,...options}),calls}}
 finally{globalThis.fetch=original}
}
test('actual current DSM declarations retain one independently qualified India role with selected-page and company cleanup held',async()=>{
 const {jobs}=await replay()
 assert.equal(jobs.length,1)
 assert.equal(String(jobs[0].jobId),'562949978305971')
 assert.equal(jobs[0].country,'India')
 assert.equal(jobs[0].activeApplyVerified,false)
 assert.equal(jobs[0].applicationVisited,false)
 assert.equal(jobs[0].applyUrl,'https://jobs.dsm-firmenich.com/careers/apply?pid=562949978305971')
 assert.equal(readSourceObservationEvidence(jobs,'dsmfirmenich').observedRecordCount,10)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(jobs[0].sourceNativeCountry,null)
 assert.equal(jobs[0].sourceNativeDatePostedLiteral,'2026-10-15T07:33:16')
 assert.equal(jobs[0].postingDate,'2026-10-15T07:33:16.000Z')
 assert.ok(jobs[0].sourceDescriptionChannels.nativeSupplementalContent)
})

test('actual declared native programme accepts cosmetic and local identifier changes',()=>{
 const cosmetic=componentSource.replaceAll('position-header-container','restyled-position-header')+'\n/* unrelated visual deployment */'
 const changed=cosmetic.replaceAll('A=new URLSearchParams({pid:String(null==w?void 0:w.id)})','renamedParams=new URLSearchParams({pid:String(null==w?void 0:w.id)})').replaceAll('A.append(','renamedParams.append(').replaceAll('A.toString()','renamedParams.toString()')
 assert.notEqual(changed,componentSource)
 assert.doesNotThrow(()=>readCurrentDsmRoles(entry,changed,pageSource))
 const own=entrySource.replaceAll('Error fetching data:','Different incidental error log')
 assert.doesNotThrow(()=>readCurrentDsmEntry(own))
})
test('unrelated native module count does not gate intact recruitment semantics',()=>{
 const object=entry.tree.all.find(n=>n.type==='ObjectExpression'&&n.properties.length===entry.modules.size&&n.properties.every(p=>p.value?.type==='FunctionExpression'))
 assert.ok(object)
 const kept=object.properties.filter(p=>Number(p.key.value)===68613||/JOB_DETAILS|\/api\/pcsx\//.test(entrySource.slice(p.value.start,p.value.end)))
 assert.ok(kept.length>0&&kept.length<100)
 const changed=entrySource.slice(0,object.start)+'{'+kept.map(p=>entrySource.slice(p.start,p.end)).join(',')+'}'+entrySource.slice(object.end)
 assert.doesNotThrow(()=>readCurrentDsmRoles(readCurrentDsmEntry(changed),componentSource,pageSource))
})
for(const[label,kind,before,after]of[
 ['changed search route','entry','/api/pcsx/search?domain=','/api/pcsx/other?domain='],
 ['search GET query options','entry','o.Gx.get(f,{signal:t})','o.Gx.get(f,{signal:t,params:{other:1}})'],
 ['hardcoded native detail ID','entry','position_id:(null==r?void 0:r.toString())||""','position_id:"999"'],
 ['changed native route parameter','entry','var{pid:e}=(0,o.g)()','var{other:e}=(0,o.g)()'],
 ['hardcoded selected route ID','page','t.selectPosition(Number(e))','t.selectPosition(Number("999"))'],
 ['disconnected exported position component','page','a.createElement(o.U,null)','a.createElement(o.Unrelated,null)'],
 ['hardcoded application PID','component','pid:String(null==w?void 0:w.id)','pid:"999"'],
 ['foreign application target','component','"/careers/apply?"','"https://foreign.example/apply?"'],
 ['changed application action source','component','null==E||null==(b=E.positionUserActions)','null==unrelatedPosition||null==(b=unrelatedPosition.positionUserActions)'],
 ['disconnected native header','component','l.createElement(tT,null)','l.createElement(unrelatedHeader,null)'],
 ['application PID query overwrite','component','var N="/r?"','A.set("pid","999");var N="/r?"'],
 ['shadowed PID String constructor','component','tk=(0,f.PA)(e=>{var t','tk=(0,f.PA)(e=>{const String=()=>"999";var t'],
 ['disabled allowed application carrier','component','allowed:l.createElement(k.D,{text:','allowed:l.createElement(k.D,{disabled:true,text:'],
 ['new authored application condition','component','size:g.Mp.Large,href:j}),apply_and_interview:','size:g.Mp.Large,href:j},"Applicants must hold another certification."),apply_and_interview:'],
])test('actual programme rejects '+label,()=>{
 const source=kind==='entry'?entrySource:kind==='page'?pageSource:componentSource
 assert.ok(source.includes(before),'Actual original mutation: '+label)
 const changed=source.replaceAll(before,after)
 assert.throws(()=>kind==='entry'?readCurrentDsmRoles(readCurrentDsmEntry(changed),componentSource,pageSource):readCurrentDsmRoles(entry,kind==='component'?changed:componentSource,kind==='page'?changed:pageSource),/Current public programme/)
})
for(const kind of ['entry','component','page'])test('actual native '+kind+' carrier must execute at top level',()=>{
 const wrap=s=>'function uncalledNativeProgramme(){'+s+'\n}'
 assert.throws(()=>kind==='entry'?readCurrentDsmEntry(wrap(entrySource)):readCurrentDsmRoles(entry,kind==='component'?wrap(componentSource):componentSource,kind==='page'?wrap(pageSource):pageSource),/Current public programme/)
})
function mutateNative(change){return(p,b)=>{if(!p.requestedURL.includes('/api/pcsx/position_details?'))return b;const m=JSON.parse(b);change(m.data);return Buffer.from(JSON.stringify(m))}}
for(const[label,change,reason]of[
 ['foreign detail geography',d=>{d.locations=['Amsterdam, Netherlands'];d.standardizedLocations=['Amsterdam, NH, NL'];d.location='Amsterdam, Netherlands'},'country'],
 ['withdrawn native application',d=>{d.positionUserActions.applyAction.status='withdrawn'},'application'],
 ['additional detail-only date',d=>{d.publicationDate='2026-11-21'},'fields-or-dates'],
 ['additional detail-only active flag',d=>{d.isActive=false},'fields-or-dates'],
 ['changed full native criteria',d=>{d.jobDescription+='<p>Applicants must hold another certification.</p>'},'criteria'],
 ['different native role identity',d=>{d.id++},'id-conflict'],
])test('actual complete native evidence holds only an unqualified role: '+label,async()=>{
 const {jobs}=await replay({},mutateNative(change))
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,10)
 const row=jobs.nativeCollectionEvidence.observations.find(o=>o.detail)
 assert.ok(row.holdReasons.some(r=>r.includes(reason)))
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('actual own published employer conflict cannot become a target-employer role',async()=>{
 const {jobs}=await replay({},(p,b)=>{
  if(!p.requestedURL.includes('/careers/job/'))return b
  const html=b.toString(),node=readNativeDocument(html).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').find(n=>JSON.parse(n.raw)['@type']==='JobPosting'),model=JSON.parse(node.raw)
  model.hiringOrganization.name='Unrelated employer'
  return Buffer.from(html.replace(node.raw,JSON.stringify(model)))
 })
 assert.equal(jobs.length,0)
 assert.ok(jobs.nativeCollectionEvidence.observations.find(o=>o.detail).holdReasons.includes('own-published-employer-unqualified'))
})
test('an explicitly expired own published role stays an observation despite an allowed native action',async()=>{
 const {jobs}=await replay({},(p,b)=>{
  if(!p.requestedURL.includes('/careers/job/'))return b
  const html=b.toString(),node=readNativeDocument(html).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').find(n=>JSON.parse(n.raw)['@type']==='JobPosting'),model=JSON.parse(node.raw)
  model.validThrough='2020-01-01T07:33:16'
  return Buffer.from(html.replace(node.raw,JSON.stringify(model)))
 })
 assert.equal(jobs.length,0)
 assert.ok(jobs.nativeCollectionEvidence.observations.find(o=>o.detail).holdReasons.includes('own-published-application-validity-unqualified-or-expired'))
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})
test('changing full native closing count stays held with the complete observation prefix',async()=>{
 await assert.rejects(replay({},(p,b,n)=>{if(!p.requestedURL.includes('/api/pcsx/search?')||n!==2)return b;const m=JSON.parse(b);m.data.count++;return Buffer.from(JSON.stringify(m))}),error=>{
  assert.match(error.message,/Closing whole first-page/)
  assert.equal(error.recruitmentObservations.observedRecordCount,10)
  assert.equal(error.recruitmentObservations.lifecycleCleanupAllowed,false)
  return true
 })
})
for(const reason of [Object.freeze({caller:'source-owner'}),null])for(const mode of ['qualified','identity-error','http403'])test('exact caller reason survives source close: '+mode+'/'+(reason===null?'null':'object'),async()=>{
 const controller=new AbortController();let calls=0
 await assert.rejects(run({maxHydratedJobs:1,requestIntervalMs:0,signal:controller.signal,fetchImpl:async(url,init)=>{
  calls++;init.signal.addEventListener('abort',()=>controller.abort(reason),{once:true})
  const p=packets.find(p=>p.requestedURL===url);assert.ok(p)
  let bytes=Buffer.from(p.bodyBase64,'base64'),status=p.status
  if(url.includes('careers.dsm-firmenich.com')&&mode==='identity-error')bytes=Buffer.from(bytes.toString().replaceAll('https://jobs.dsm-firmenich.com/careers','https://unrelated.example/careers'))
  if(url.includes('careers.dsm-firmenich.com')&&mode==='http403')status=403
  return Object.defineProperty(new Response(bytes,{status,headers:p.headers}),'url',{value:p.url})
 }}),error=>error===reason)
 assert.ok(calls>0)
})
test('observed403 outranks a local deadline while denied body cancellation never settles',async()=>{
 await assert.rejects(run({requestTimeoutMs:20,requestIntervalMs:0,fetchImpl:async url=>({status:403,url,headers:new Headers({'content-type':'text/html'}),body:{cancel:()=>new Promise(()=>{})}})}),error=>{
  assert.equal(error.httpStatus??error.status,403)
  assert.equal(error.recruitmentObservations.originalResponses[0].status,403)
  return true
 })
})
test('native202 WAF challenge remains a classified denial',async()=>{
 await assert.rejects(run({requestIntervalMs:0,fetchImpl:async url=>Object.defineProperty(new Response(null,{status:202,headers:{'x-amzn-waf-action':'challenge'}}),'url',{value:url})}),error=>{assert.equal(error.httpStatus??error.status,202);assert.equal(error.failureKind,'blocked_or_access_denied');return true})
})

for(const kind of ['search','detail','JobPosting'])test('decoded duplicate keys cannot donate native '+kind+' evidence',async()=>{
 await assert.rejects(replay({},(p,b)=>{
  const raw=b.toString()
  if(kind==='search'&&p.requestedURL.includes('/api/pcsx/search?'))return Buffer.from(raw.replace(/"count"\s*:/,'"co\\u0075nt":0,"count":'))
  if(kind==='detail'&&p.requestedURL.includes('/api/pcsx/position_details?'))return Buffer.from(raw.replace(/"id"\s*:/,'"i\\u0064":999,"id":'))
  if(kind==='JobPosting'&&p.requestedURL.includes('/careers/job/')){
   const node=readNativeDocument(raw).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').find(n=>JSON.parse(n.raw)['@type']==='JobPosting')
   return Buffer.from(raw.replace(node.raw,node.raw.replace(/"title"\s*:/,'"t\\u0069tle":"Donated title","title":')))
  }
  return b
 }),/duplicate/i)
})
for(const[label,change]of[
 ['new nested custom criteria',d=>{d.positionExtraDetails.customContent=[{title:'Eligibility',content:'Applicants must hold another certification.'}]}],
 ['changed benefit work requirement',d=>{d.positionExtraDetails.perks[3].description+=' Applicants must hold security clearance.'}],
 ['new nested application restriction',d=>{d.positionUserActions.applyAction.requirements='Applicants must hold a licence.'}],
])test('new unreconciled authored native supplement holds only its own role: '+label,async()=>{
 const {jobs}=await replay({},mutateNative(change))
 assert.equal(jobs.length,0)
 const row=jobs.nativeCollectionEvidence.observations.find(o=>o.detail)
 assert.ok(row.holdReasons.some(r=>/supplemental|application-model/.test(r)))
 assert.ok(row.detail.data.positionExtraDetails)
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,10)
})
for(const nested of [false,true])test('new JobPosting eligibility field remains observed and held: '+nested,async()=>{
 const {jobs}=await replay({},(p,b)=>{
  if(!p.requestedURL.includes('/careers/job/'))return b
  const html=b.toString(),node=readNativeDocument(html).nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json').find(n=>JSON.parse(n.raw)['@type']==='JobPosting'),model=JSON.parse(node.raw)
  ;(nested?model.hiringOrganization:model).qualifications='Applicants must hold another certification.'
  return Buffer.from(html.replace(node.raw,JSON.stringify(model)))
 })
 assert.equal(jobs.length,0)
 const row=jobs.nativeCollectionEvidence.observations.find(o=>o.detail)
 assert.ok(row.holdReasons.includes('own-published-supplemental-or-eligibility-fields-unreconciled'))
 assert.equal((nested?row.ownJobPosting.hiringOrganization:row.ownJobPosting).qualifications,'Applicants must hold another certification.')
})
test('reviewed authored supplements survive output while cosmetic benefit icons may change',async()=>{
 const {jobs}=await replay({},mutateNative(d=>{d.positionExtraDetails.perks[0].icon='new-decorative-icon'}))
 assert.equal(jobs.length,1)
 assert.ok(decodeHTML(jobs[0].sourceDescription).includes('Our teams are on site at least 60%'))
 assert.ok(jobs[0].sourceDescriptionChannels.nativeSupplementalAuthoredText.includes('Our teams are on site at least 60%'))
})
test('invalid request pacing allocates no source deadline timer',async()=>{
 const {createDsmNativeReader}=await import('./nativeReader20261121.js')
 const original=globalThis.setTimeout;let calls=0
 globalThis.setTimeout=()=>{calls++;return 0}
 try{assert.throws(()=>createDsmNativeReader({requestIntervalMs:-1}),/pacing/)}
 finally{globalThis.setTimeout=original}
 assert.equal(calls,0)
})
