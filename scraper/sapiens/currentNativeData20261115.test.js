import assert from 'node:assert/strict'
import test from 'node:test'
import {createHash} from 'node:crypto'
import {getSourceDescription} from '../../src/utils/jobSourceContent.js'
import * as script from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readSapiensStrictJSON,readSapiensFeed,readSapiensForm,readSapiensBoard,readSapiensClient,readSapiensLanding,createSapiensOriginalReader} from './nativeData20261115.js'
import {sapiensFixture,createSapiensReplay,withSapiensReplayClock,assertSapiensCurrentJobs,packetJSON,replacePacket} from './fixtures/replayNativeData20261115.js'

const fixture=sapiensFixture(),packets=fixture.packets,sha=value=>createHash('sha256').update(value).digest('hex')
const authority=error=>error.code==='SAPIENS_NATIVE_DATA_GAP'&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false
const page=(index,change=bytes=>bytes)=>{const packet=packets[index],bytes=Buffer.from(change(Buffer.from(packet.bodyBase64,'base64')));return{label:packet.label,url:packet.requestedUrl,method:packet.method,requestBody:packet.requestBody,bytes,text:bytes.toString('utf8')}}
const alter=(bytes,change)=>{const value=JSON.parse(bytes);change(value);return Buffer.from(JSON.stringify(value))}
const feed=()=>packetJSON(packets[2]),first=()=>feed().jobAdDetails[0]
const provider=()=>getScraperCatalog().find(row=>row.source==='sapiens')
const response=({bytes=Buffer.from(packets[0].bodyBase64,'base64'),status=200,mime='text/html',url=packets[0].finalUrl,redirected=false,body}={})=>{const value=new Response(body??bytes,{status,headers:{'content-type':mime}});Object.defineProperties(value,{url:{value:url},redirected:{value:redirected}});return value}
const readBoard=async options=>{const reader=createSapiensOriginalReader(options);try{return await reader.read('board')}finally{reader.close()}}
const replayRun=(io,route='run')=>withSapiensReplayClock(()=>route==='factory'?script.createSapiensScraper({fetchImpl:io.fetchImpl}).run():route==='registered'?createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl}):script.run({fetchImpl:io.fetchImpl}))

for(const route of ['run','factory','registered'])test('genuine14 complete native responses preserve two distinct India feed/form records: '+route,async()=>{
 const io=createSapiensReplay(),jobs=await replayRun(io,route);assertSapiensCurrentJobs(jobs);assert.equal(io.calls.length,14)
 assert.equal(jobs[0].title,jobs[1].title);assert.equal(jobs[0].nativeOriginalRichDescription,jobs[1].nativeOriginalRichDescription);assert.notEqual(jobs[0].nativeActualApplicationFormId,jobs[1].nativeActualApplicationFormId)
 for(const call of io.calls){assert.equal(call.init.redirect,'manual');assert.equal(call.init.credentials,'omit');assert.equal(call.init.headers.Cookie,undefined);assert.equal(call.init.headers.Authorization,undefined);assert.equal(call.init.headers['User-Agent'],'Mozilla/5.0 (compatible; Jobverify careers inventory check)');assert.equal(call.init.headers.companyIdentifier,call.packet.kind==='json'?'sapiens':undefined)}
})
test('genuine fixture retains14 complete originals, seven real byte pairs and scoped provenance without registered recovery claim',()=>{
 assert.equal(packets.length,14);assert.equal(fixture.totalOriginalBytes,1964084);assert.equal(fixture.actualSingleFourteenReadDiscoveryProved,true);assert.equal(fixture.currentRegisteredProductionCaptureProved,false)
 for(const [index,packet]of packets.entries()){const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(bytes.length,packet.bytes);assert.equal(sha(bytes),packet.sha256);assert.equal(packet.provenance.receiptIndex,index);assert.equal(packet.provenance.physicalOriginalObserved,true);assert.match(packet.provenance.originalNamedScopeCorrection,/scope-correction/);if(index>=7)assert.equal(packet.bodyBase64,packets[index-7].bodyBase64)}
})
test('persistable selected sourceDescription contains original rich prefix, full24feed and actual4data including intake constraints',async()=>{
 const jobs=await replayRun(createSapiensReplay())
 for(const job of jobs){assert.equal(getSourceDescription(job),job.sourceDescription);assert(job.sourceDescription.startsWith(job.nativeSourceRecord.description));assert.match(job.sourceDescription,/applicationFormField\/isMandatory/);assert.match(job.sourceDescription,/supportedFileTypes/);assert.match(job.sourceDescription,/reference options, not additional screening requirements/);assert.equal(job.nativeDescriptionPresence.filter(row=>!row.formHasOwn).length,8);assert.equal(Object.hasOwn(job.nativePublicForm.data.jobAd.jobDescription,'/jobAd/descriptionId./jobDescription/requirements'),false)}
})

// These mutations are explicitly synthetic/counterfactual supported live-data
// updates. No modified packet is claimed as a physical captured original.
function syntheticScenario(change){
 const items=structuredClone(packets),data=feed(),forms=[packetJSON(items[3]),packetJSON(items[5])],ids=data.jobAdDetails.slice(0,2).map(row=>row.id)
 change(data,forms)
 for(let index=0;index<2;index++){
  const id=data.jobAdDetails[index].id
  for(const position of [3+index*2,10+index*2]){items[position]={...replacePacket(items[position],forms[index]),label:'form-'+id,requestedUrl:items[position].requestedUrl.replace(ids[index],id),finalUrl:items[position].finalUrl.replace(ids[index],id)}}
  for(const position of [4+index*2,11+index*2])items[position]={...items[position],label:'landing-'+id,requestedUrl:items[position].requestedUrl.replace(ids[index],id),finalUrl:items[position].finalUrl.replace(ids[index],id),syntheticCounterfactual:true}
 }
 items[2]=replacePacket(items[2],data);items[9]=replacePacket(items[9],data);return items
}
const cases=[
 ['supported rich/title/microdate and mandatory/document/file constraints',(data,forms)=>{
  for(const[index,form]of forms.entries()){const row=data.jobAdDetails[index],job=form.data.jobAd;row.title+=' synthetic updated';job.title=row.title;row.description+=' <br>Additional native criteria remain completely preserved & explicitly synthetic.';job.jobDescription['/jobAd/descriptionId./jobDescription/description'].value=row.description;row.publishedAt='2026-11-15T01:02:03.123456Z';job.applicationForm['/applicationForm/fields'].value[3]['/applicationFormField/isMandatory'].value=true;const doc=job.applicationForm['/applicationForm/documents'].value[0];doc['/applicationFormDocument/isMandatory'].value=true;doc['/applicationFormDocument/instructions'].value='';form.data.supportedFileTypes=['.pdf','.docx']}
 }],
 ['new live UUIDs and positive distinct form/child identities',(data,forms)=>{
  for(const[index,form]of forms.entries()){data.jobAdDetails[index].id='00000000-0000-4000-8000-00000000000'+(index+1);const app=form.data.jobAd.applicationForm;app.id=10001+index;for(const[type,group]of [['Field','fields'],['Document','documents']])for(const[order,child]of app['/applicationForm/'+group].value.entries()){child.id=20000+index*1000+(type==='Field'?0:100)+order;child['/applicationForm'+type+'/applicationFormId'].value=app.id}}
 }],
 ['added removed reordered nonselected records plus populated matching optional criteria/pay',(data,forms)=>{
  const others=data.jobAdDetails.slice(2,-2).reverse(),extra=structuredClone(others.find(row=>row.country!=='India'));extra.id='00000000-0000-4000-8000-000000000099';extra.country='';data.jobAdDetails=[...data.jobAdDetails.slice(0,2),...others,extra]
  const row=data.jobAdDetails[0],description=forms[0].data.jobAd.jobDescription
  Object.assign(row,{requirements:'Synthetic native qualifications remain explicit<br>No extra markup.',sectionLabels:{requirements:'Original qualifications'},payTransparencyMinSalary:0,payTransparencyMaxSalary:500000,payTransparencySalaryCurrency:'INR',payTransparencySalaryPayPeriod:'Annual',payTransparencySalaryAdditionalInfo:'Native pay statement is preserved unchanged.'})
  for(const key of ['requirements','sectionLabels','payTransparencyMinSalary','payTransparencyMaxSalary','payTransparencySalaryCurrency','payTransparencySalaryPayPeriod','payTransparencySalaryAdditionalInfo'])description['/jobAd/descriptionId./jobDescription/'+key]={value:structuredClone(row[key])}
 }],
]
for(const[name,change]of cases)test('explicit synthetic supported-update positive: '+name,async()=>{
 const items=syntheticScenario(change),io=createSapiensReplay(undefined,items),jobs=await replayRun(io,'registered');assertSapiensCurrentJobs(jobs,items);assert.equal(io.calls.length,14);assert(jobs.every(job=>getSourceDescription(job)===job.sourceDescription));assert.equal(jobs.nativeCollectionEvidence.volatileFixtureValuesUsedAsAdmissionPins,false)
})

for(const text of ['{"x":1,"x":2}','{"x":1,"\\u0078":2}','{"x":1e999}','{"x":NaN}','{"x":Infinity}','{"x":1} null','{"x":01}','{"x":"\\ud800"}','{"x":1,}','[1,]','['.repeat(66)+'0'+']'.repeat(66)])test('strict native JSON rejects duplicate/nonfinite/trailing/invalid representation '+text.slice(0,45),()=>assert.throws(()=>readSapiensStrictJSON(text),authority))
test('strict JSON preserves ordinary explicit false/null/empty values without defaulting',()=>assert.deepEqual(readSapiensStrictJSON('{"a":null,"b":false,"c":"","d":[],"e":{},"f":0}'),{a:null,b:false,c:'',d:[],e:{},f:0}))

for(const[name,change]of [
 ['unknown nonselected field',value=>value.jobAdDetails.at(-1).unknownControl=true],['nonselected wrong date type',value=>value.jobAdDetails.at(-1).publishedAt=null],['unsafe site identity',value=>value.jobAdDetails[0].siteId=Number.MAX_SAFE_INTEGER+1],['duplicate role UUID',value=>value.jobAdDetails[1].id=value.jobAdDetails[0].id],['noncanonical uppercase UUID',value=>value.jobAdDetails[0].id=value.jobAdDetails[0].id.toUpperCase()],['filter mismatch',value=>value.filterGroups.sites[0].value+=' changed'],['duplicate filter ID',value=>value.filterGroups.countries.push(value.filterGroups.countries[0])],['new pagination envelope',value=>value.next='/jobs?page=2'],['metadata control change',value=>value.jobOpeningMetadata=[]],['new worksite schema',value=>value.jobAdDetails[0].postingLocations[0].hidden=true],['invalid calendar',value=>value.jobAdDetails[0].publishedAt='2026-02-30T01:02:03.123456Z'],['nonfinite salary',value=>value.jobAdDetails[0].payTransparencyMinSalary='100'],
])test('complete feed schema and joins reject '+name,()=>assert.throws(()=>readSapiensFeed(page(2,bytes=>alter(bytes,change))),authority))
test('all current foreign-country conflicts stay raw and held rather than being promoted to India',()=>{
 const value=readSapiensFeed(page(2));assert.equal(value.rows.length,109);assert.equal(value.declaredIndiaIds.length,28);assert.equal(value.countryConflicts.length,2);for(const conflict of value.countryConflicts){assert(value.held.some(row=>row.id===conflict.id));assert(!value.eligible.some(row=>row.id===conflict.id))}
})
for(const mode of ['unknown country','conflicting native worksite','unsupported rich hidden control'])test('fewer than two safe candidates is a typed observed coverage hold: '+mode,async()=>{
 const io=createSapiensReplay((bytes,packet)=>packet.label==='feed'?alter(bytes,value=>{if(mode==='conflicting native worksite')value.filterGroups.countries.push({serverId:'Unknown',value:'Unknown'});for(const row of value.jobAdDetails.filter(row=>row.country==='India')){if(mode==='unknown country')row.country='Unknown';else if(mode==='conflicting native worksite')row.postingLocations=[{...value.jobAdDetails[0].postingLocations[0],country:'Unknown'}];else row.description='<p hidden>'+row.description+'</p>'}}):bytes)
 await withSapiensReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl}),error=>authority(error)&&/Fewer than two/.test(error.message)&&error.recruitmentObservations.nativeFeed.jobAdDetails.length===109));assert.equal(io.calls.length,3)
})

for(const[name,change]of [
 ['title',value=>value.data.jobAd.title+=' changed'],['site',value=>value.data.jobAd.site='Bengaluru'],['language',value=>value.data.jobAd.languageCode='fr'],['posting country',value=>value.data.jobAd.postingLocations[0].country='Unknown'],['agency new control',value=>value.data.agency={}],['metadata controls',value=>value.metadata={}],['lookup controls',value=>value.data.companyLists.countries=[]],['unknown form key',value=>value.data.jobAd.hidden=true],['missing description',value=>delete value.data.jobAd.jobDescription['/jobAd/descriptionId./jobDescription/description']],['null actual section labels',value=>value.data.jobAd.jobDescription['/jobAd/descriptionId./jobDescription/sectionLabels'].value=null],['null populated description',value=>value.data.jobAd.jobDescription['/jobAd/descriptionId./jobDescription/description'].value=null],['unexplained criteria control',value=>value.data.jobAd.jobDescription.hidden={value:true}],['unsafe form ID',value=>value.data.jobAd.applicationForm.id=0],['duplicate child ID',value=>{const fields=value.data.jobAd.applicationForm['/applicationForm/fields'].value;fields[1].id=fields[0].id}],['foreign parent ID',value=>value.data.jobAd.applicationForm['/applicationForm/fields'].value[0]['/applicationFormField/applicationFormId'].value++],['duplicate ordinal',value=>value.data.jobAd.applicationForm['/applicationForm/fields'].value[1]['/applicationFormField/ordinal'].value=0],['unknown intake path',value=>value.data.jobAd.applicationForm['/applicationForm/fields'].value[0]['/applicationFormField/fieldPath'].value='/candidate/passport'],['mandatory string',value=>value.data.jobAd.applicationForm['/applicationForm/fields'].value[0]['/applicationFormField/isMandatory'].value='true'],['actual new question',value=>value.data.jobAd.applicationForm['/applicationForm/questions'].value=[{question:'new'}]],['unknown document type',value=>value.data.jobAd.applicationForm['/applicationForm/documents'].value[0]['/applicationFormDocument/type'].value='passport'],['wrapper control',value=>value.data.jobAd.applicationForm['/applicationForm/documents'].hidden=true],['file constraints type',value=>value.data.supportedFileTypes=[null]],
])test('full actual form authority/control schema rejects '+name,()=>assert.throws(()=>readSapiensForm(page(3,bytes=>alter(bytes,change)),first()),authority))
for(const key of ['requirements','payTransparencyMinSalary','sectionLabels'])test('populated native '+key+' cannot be imputed into an absent/null conflicting form carrier',()=>{
 const row=first();row[key]=key==='sectionLabels'?{requirements:'Native label'}:key==='requirements'?'Original qualifications':500
 assert.throws(()=>readSapiensForm(page(3),row),authority)
})
test('distinct selected feed UUIDs cannot reuse the same actual form ID',async()=>{
 const io=createSapiensReplay((bytes,packet)=>packet.label===packets[5].label?alter(bytes,value=>{const app=value.data.jobAd.applicationForm;app.id=packetJSON(packets[3]).data.jobAd.applicationForm.id;for(const[type,group]of [['Field','fields'],['Document','documents']])for(const child of app['/applicationForm/'+group].value)child['/applicationForm'+type+'/applicationFormId'].value=app.id}):bytes)
 await withSapiensReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl}),error=>authority(error)&&/reused one form ID/.test(error.message)));assert.equal(io.calls.length,6)
})
for(const markup of ['<p hidden>Hidden role</p>','<script>steal()</script>','<br onclick="hidden=true">','<style>body{display:none}</style>','<!-- omitted -->','This position is closed. We are no longer accepting applications.'])test('unsupported rich semantics are held without stripping criteria: '+markup.slice(0,40),()=>{
 const value=readSapiensFeed(page(2,bytes=>alter(bytes,data=>data.jobAdDetails[0].description+=markup)));assert(!value.eligible.some(row=>row.id===first().id));assert(value.held.some(row=>row.id===first().id&&/rich-criteria/.test(row.reason)))
})
for(const[index,reader]of [[0,readSapiensBoard],[1,readSapiensClient],[4,value=>readSapiensLanding(value,first().id)]])test('reviewed static owner/program/config shell remains immutable: '+index,()=>assert.throws(()=>reader(page(index,bytes=>Buffer.concat([bytes,Buffer.from(' ')]))),authority))
for(let position=8;position<=14;position++)test('complete within-run closing byte changes stop at physical read '+position,async()=>{
 const io=createSapiensReplay((bytes,_packet,count)=>count===position?Buffer.concat([bytes,Buffer.from(' ')]):bytes)
 await withSapiensReplayClock(()=>assert.rejects(createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl}),error=>authority(error)&&/closing body changed/.test(error.message)));assert.equal(io.calls.length,position)
})
test('closing change to an unselected row remains a failure',async()=>{
 const io=createSapiensReplay((bytes,packet)=>packet.label==='feed'&&packet.phase==='closing'?alter(bytes,value=>value.jobAdDetails.at(-1).title+=' changed'):bytes)
 await withSapiensReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl}),authority));assert.equal(io.calls.length,10)
})

for(const[name,options]of [
 ['missing Response authority',{fetchImpl:async()=>({status:200,url:packets[0].finalUrl})}],['foreign final URL',{fetchImpl:async()=>response({url:'https://example.org/'})}],['followed redirect',{fetchImpl:async()=>response({redirected:true})}],['wrong MIME',{fetchImpl:async()=>response({mime:'application/json'})}],['wrong charset',{fetchImpl:async()=>response({mime:'text/html;charset=iso-8859-1'})}],['unbalanced charset',{fetchImpl:async()=>response({mime:'text/html;charset="UTF-8'})}],['unknown MIME parameter',{fetchImpl:async()=>response({mime:'text/html;profile=unknown'})}],['BOM',{fetchImpl:async()=>response({bytes:Buffer.concat([Buffer.from([239,187,191]),Buffer.from(packets[0].bodyBase64,'base64')])})}],['invalid UTF8',{fetchImpl:async()=>response({bytes:Buffer.from([195,40])})}],
])test('strict original Response guard: '+name,async()=>assert.rejects(readBoard(options),error=>authority(error)||name==='foreign final URL'&&/final URL/.test(error.message)))
test('native403 status is preserved with its original response body and no fallback',async()=>{
 const io=createSapiensReplay((_bytes,_packet,count)=>count===1?response({status:403,bytes:Buffer.from('original denied')}):undefined)
 await assert.rejects(createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl}),error=>authority(error)&&error.status===403&&error.recruitmentObservations.originalResponses[0].bodyBase64===Buffer.from('original denied').toString('base64'));assert.equal(io.calls.length,1)
})
test('genuine quoted UTF8 MIME accepted while original bytes stay exact',async()=>{const value=await readBoard({fetchImpl:async()=>response({mime:'text/html; charset="UTF-8"'})});assert.equal(sha(value.bytes),packets[0].sha256)})
for(const options of [{fetchText:()=>{}},{fetchJson:()=>{}},{fetchPage:()=>{}},{maxJobs:1},{maxRequests:17},{sourceTimeoutMs:45001},{timeoutMs:NaN},{timeoutMs:1,sourceTimeoutMs:45001},{requestTimeoutMs:15001},{maxDiscoveryReads:7},{maxDetails:9},{maxEntityBytes:4000001},{maxTotalBytes:24000001}])test('invalid/upward/body-only option rejects before I/O '+Object.keys(options).join('/'),()=>{let calls=0;assert.throws(()=>createSapiensOriginalReader({...options,fetchImpl:()=>{calls++}}),authority);assert.equal(calls,0)})
test('both source timeout aliases enforce the smaller valid caller reduction in either order',()=>{
 for(const options of [{timeoutMs:45000,sourceTimeoutMs:1000},{timeoutMs:1000,sourceTimeoutMs:45000}]){const reader=createSapiensOriginalReader(options);assert.equal(reader.limits.sourceTimeoutMs,1000);reader.close()}
})
test('reduced total budget cannot spend missing closing reservations',async()=>{let calls=0;await assert.rejects(script.run({maxRequests:13,fetchImpl:()=>{calls++}}),authority);assert.equal(calls,0);await assert.rejects(readBoard({maxTotalBytes:5767168,fetchImpl:()=>{calls++}}),authority);assert.equal(calls,0)})
test('original reader rejects concurrent acquisition before pacing and reserves no extra physical read',async()=>{
 let finish,calls=0;const reader=createSapiensOriginalReader({fetchImpl:()=>{calls++;return new Promise(resolve=>finish=resolve)}})
 try{const pending=reader.read('board');await assert.rejects(reader.read('board'),authority);while(!finish)await new Promise(resolve=>setTimeout(resolve,0));finish(response());await pending;assert.equal(calls,1)}finally{reader.close()}
})
test('opaque caller abort identity survives before I/O and pending transport',async()=>{
 const reason={opaque:'caller stop'},before=new AbortController();before.abort(reason);assert.throws(()=>createSapiensOriginalReader({signal:before.signal}),error=>error===reason)
 const controller=new AbortController();let started;const begin=new Promise(resolve=>started=resolve),reader=createSapiensOriginalReader({signal:controller.signal,fetchImpl:()=>{started();return new Promise(()=>{})}})
 try{const pending=reader.read('board');await begin;controller.abort(reason);await assert.rejects(pending,error=>error===reason)}finally{reader.close()}
})
test('request deadline bounds a transport that ignores abort',async()=>{const start=performance.now();await assert.rejects(readBoard({requestTimeoutMs:15,fetchImpl:()=>new Promise(()=>{})}),error=>error.name==='TimeoutError');assert(performance.now()-start<1000)})
test('intrinsic stream byte accounting rejects shadowed chunk length and actual HTML overflow',async()=>{
 const chunk=new Uint8Array(524289);Object.defineProperty(chunk,'byteLength',{value:1})
 await assert.rejects(readBoard({fetchImpl:async()=>response({body:new ReadableStream({start(controller){controller.enqueue(chunk);controller.close()}})})}),authority)
})
test('typed-array offsets and shadowed length cannot change qualified original bytes',async()=>{
 const original=Buffer.from(packets[0].bodyBase64,'base64'),outer=Buffer.concat([Buffer.from('prefix'),original,Buffer.from('suffix')]),chunk=new Uint8Array(outer.buffer,outer.byteOffset+6,original.length);Object.defineProperty(chunk,'byteLength',{value:0})
 const value=await readBoard({fetchImpl:async()=>response({body:new ReadableStream({start(controller){controller.enqueue(chunk);controller.close()}})})});assert.equal(sha(value.bytes),packets[0].sha256)
})
test('JSON oneMiB bound is enforced during its original body read',async()=>{
 const io=createSapiensReplay((bytes,packet)=>packet.label==='client'?Buffer.alloc(1048577,32):bytes)
 await withSapiensReplayClock(()=>assert.rejects(script.run({fetchImpl:io.fetchImpl}),authority));assert.equal(io.calls.length,2)
})
test('500ms origin pacing rechecks early timer wakes rather than trusting elapsed wall time',async()=>{
 const clock=Object.getOwnPropertyDescriptor(performance,'now'),timer=globalThis.setTimeout;let now=0,wakes=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now});globalThis.setTimeout=(callback,ms,...args)=>ms<=500?timer(()=>{now+=Math.min(100,ms);wakes++;callback(...args)},0):timer(callback,ms,...args)
 const io=createSapiensReplay(),reader=createSapiensOriginalReader({fetchImpl:io.fetchImpl})
 try{await reader.read('board');await reader.read('client');assert(now>=500);assert(wakes>=5);assert.equal(io.calls.length,2)}finally{reader.close();globalThis.setTimeout=timer;if(clock)Object.defineProperty(performance,'now',clock);else delete performance.now}
})
async function finalClockProbe(kind){
 const clone=globalThis.structuredClone,timer=globalThis.setTimeout,clock=Object.getOwnPropertyDescriptor(performance,'now');let now=0,deadline,advanced=false,early=false,rescheduled=false,physicalCalls=0
 Object.defineProperty(performance,'now',{configurable:true,value:()=>now})
 globalThis.setTimeout=(callback,ms,...args)=>{if(ms===45000)deadline=()=>callback(...args);if(early&&ms===1)rescheduled=true;return ms>=1&&ms<=500?timer(()=>{now=kind==='early-source-timer'&&physicalCalls===13?44498:now+Math.ceil(ms);callback(...args)},0):timer(callback,ms,...args)}
 globalThis.structuredClone=value=>{const result=clone(value);if(kind==='final-processing'&&Array.isArray(value)&&value.length===14&&value.every(row=>row?.bodyComplete)){now=45001;advanced=true}return result}
 const io=createSapiensReplay((_bytes,_packet,position)=>{physicalCalls=position;if(kind==='early-source-timer'&&position===14){assert.equal(now,44498);now=44999;early=true;deadline()}})
 let jobs,error
 try{jobs=await script.run({fetchImpl:io.fetchImpl})}catch(caught){error=caught}finally{globalThis.structuredClone=clone;globalThis.setTimeout=timer;if(clock)Object.defineProperty(performance,'now',clock);else delete performance.now}
 return{jobs,error,now,advanced,early,rescheduled,calls:io.calls.length}
}
test('final synchronous projection and stats cannot return jobs at45001ms',async()=>{const result=await finalClockProbe('final-processing');assert.equal(result.calls,14);assert.equal(result.advanced,true);assert.equal(result.jobs,undefined);assert.equal(result.error?.name,'TimeoutError')})
test('early source timer at44999ms reschedules the remaining1ms with final request still within15s',async()=>{const result=await finalClockProbe('early-source-timer');assert.equal(result.calls,14);assert.equal(result.early,true);assert.equal(result.rescheduled,true);assert.equal(result.error,undefined);assert.equal(result.now,44999);assert.equal(result.jobs.length,2)})

// Independent review corrections. Every changed response below is explicitly
// synthetic. Both original complete models and current closing bytes agree;
// these checks do not use an uncaptured fallback request as a failure oracle.
for(const notice of ['This role has been filled.','The position is closed.','This role<br />has been filled.','The position&nbsp;is closed.'])test('review correction: paired explicit native availability notice remains held: '+notice,async()=>{
 const items=syntheticScenario((data,forms)=>{
  for(const row of data.jobAdDetails.slice(2))if(row.country==='India')row.country='Unknown'
  for(const[index,form]of forms.entries()){const row=data.jobAdDetails[index];row.description+=' '+notice;form.data.jobAd.jobDescription['/jobAd/descriptionId./jobDescription/description'].value=row.description}
 }),io=createSapiensReplay(undefined,items)
 await withSapiensReplayClock(()=>assert.rejects(createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl}),error=>authority(error)&&/Fewer than two safely qualified/.test(error.message)&&error.recruitmentObservations.nativeFeed.jobAdDetails.length===109))
 assert.equal(io.calls.length,3)
})
for(const[name,change]of [
 ['actual site ID/name',data=>data.jobAdDetails[0].postingLocations[0].name='United States'],
 ['name display control',data=>data.jobAdDetails[0].postingLocations[0].displayValue='United States'],
 ['current native countries lookup',data=>data.filterGroups.countries=data.filterGroups.countries.filter(item=>item.serverId!=='India')],
 ['current native cities lookup',data=>data.filterGroups.cities.find(item=>item.serverId==='Bengaluru').value='Conflicting label'],
 ['current nonnull native regions lookup',data=>data.filterGroups.regions=data.filterGroups.regions.filter(item=>item.serverId!=='KA')],
])test('review correction: paired actual worksite/current-filter relationship rejects '+name,async()=>{
 const items=syntheticScenario((data,forms)=>{change(data);forms[0].data.jobAd.postingLocations=structuredClone(data.jobAdDetails[0].postingLocations)}),io=createSapiensReplay(undefined,items)
 await withSapiensReplayClock(()=>assert.rejects(createCatalogScraper(provider()).run({fetchImpl:io.fetchImpl}),error=>authority(error)&&/Native worksite/.test(error.message)))
 assert.equal(io.calls.length,3)
})
for(const notice of ['This job was closed.','The role has been filled.','This position has expired.','The vacancy is unavailable.','This opening is no longer available.','Applications for this position are closed.'])test('review correction: vacancy-directed closure grammar holds '+notice,()=>{
 const value=readSapiensFeed(page(2,bytes=>alter(bytes,data=>data.jobAdDetails[0].description+=' '+notice)));assert(!value.eligible.some(row=>row.id===first().id));assert(value.held.some(row=>row.id===first().id))
})
test('review correction: typed current location/filter changes remain live without primary-site identity or city-country inference',async()=>{
 const items=syntheticScenario((data,forms)=>{
  data.filterGroups.sites.push({serverId:'4000001',value:'Synthetic delivery office'});data.filterGroups.cities.push({serverId:'Synthetic City',value:'Synthetic City'});data.filterGroups.regions.push({serverId:'Synthetic Region',value:'Synthetic Region'})
  for(const[index,form]of forms.entries()){const row=data.jobAdDetails[index];Object.assign(row.postingLocations[0],{locationId:4000001,name:'Synthetic delivery office',displayValue:'Synthetic delivery office',city:'Synthetic City',region:'Synthetic Region'});form.data.jobAd.postingLocations=structuredClone(row.postingLocations)}
 }),io=createSapiensReplay(undefined,items),jobs=await replayRun(io,'registered')
 assertSapiensCurrentJobs(jobs,items);assert.equal(io.calls.length,14);for(const job of jobs){assert.equal(job.nativeSourceRecord.siteId,2590157);assert.equal(job.nativeSourceRecord.postingLocations[0].locationId,4000001);assert.equal(job.country,'India')}
})
