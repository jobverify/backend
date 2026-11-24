import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,createSpecIndiaScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-data-20261121.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex')
const replay=async(options={})=>{
 const calls=[],seen=new Map()
 const fetchResponse=async(url,init={})=>{
  assert.equal(init.method,'GET');assert.equal(init.body,null)
  const source=fixture.packets.find(row=>row.requestedURL===url);assert.ok(source,'Declared original only: '+url)
  const occurrence=(seen.get(url)??0)+1;seen.set(url,occurrence);calls.push({url,occurrence})
  const original=Buffer.from(source.bodyBase64,'base64'),bytes=options.change?Buffer.from(options.change(original.toString('utf8'),url,occurrence)):original
  const time=new Date().toISOString()
  return{...source,bytes,html:bytes.toString('utf8'),bodyBase64:bytes.toString('base64'),bodySHA256:sha(bytes),method:'GET',body:null,startedAt:time,completedAt:time}
 }
 let jobs,error
 try{jobs=await(options.scraper?options.scraper.run({...options,fetchResponse:options.fetchResponse??fetchResponse}):run({...options,fetchResponse:options.fetchResponse??fetchResponse}))}catch(value){error=value}
 return{jobs,error,calls}
}
test('current SPEC migration retains three whole native data records after all seven bounded reads',async()=>{
 const r=await replay();assert.ifError(r.error);assert.equal(r.calls.length,7);assert.equal(r.jobs.length,3)
 assert.deepEqual(r.jobs.map(j=>j.nativeSourceRecord.role),fixture.props.jobs)
 for(const j of r.jobs){assert.deepEqual(j.nativeClosingRecord,j.nativeSourceRecord);assert.equal(j.country,'India');assert.equal(j.sourceDetailComplete,true);assert.equal(j.sourceDetailCompletenessScope,'native-data-only');assert.ok(j.sourceRawNativeRole.includes('self.__next_f.push'));assert.ok(j.sourceDescription.includes(j.nativeWholeCriteriaText))}
})
test('current SPEC does not invent publication, role landing pages, application or company completeness',async()=>{
 const r=await replay();assert.ifError(r.error)
 for(const j of r.jobs){assert.equal(j.postingDate,null);assert.equal(j.closingDate,null);assert.equal(j.sourcePublicationDateUnavailable,true);assert.equal(j.sourceUrl,fixture.boardURL);assert.equal(j.nativePublishedRoleURL,null);assert.equal(j.applyUrl,null);assert.equal(j.activeApplyVerified,false);assert.equal(j.sourceRenderedDetailComplete,false);assert.equal(j.sourceClientQualified,false);assert.equal(j.sourceCSSQualified,false);assert.equal(j.sourceListingComplete,false);assert.equal(j.lifecycleCleanupAllowed,false)}
 const e=readInventoryEvidence(r.jobs);assert.equal(e.status,'coverage-gap');assert.equal(e.firstParty,false);assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null)
})
test('current SPEC preserves both the experience label and contradictory authored experience criterion',async()=>{
 const r=await replay();assert.ifError(r.error);const j=r.jobs.find(j=>j.title==='Senior Java Developer');assert.equal(j.experienceRequired,'4-6 Years');assert.match(j.nativeWholeCriteriaText,/2\u20136 years/);assert.deepEqual(j.nativeSourceRecord.role.responsibilities,fixture.props.jobs[0].responsibilities)
})
for(const [name,from,to]of[
 ['country','Ahmedabad, India','Toronto, Canada'],
 ['criteria','Bachelor\u0027s degree','Mandatory changed licence'],
 ['owner','JobOpeningsExplorer','OtherJobOwner'],
 ['client','44swdr4ng0jd8.js','unreviewed.js'],
 ['extra criterion','Required Skills','Additional mandatory country assignment: Canada. Required Skills'],
])test('current SPEC rejects changed '+name+' before observations',async()=>{
 let changed=false
 const r=await replay({change:(text,url)=>{if(url!==fixture.boardURL)return text;const next=text.replace(from,to);changed||=next!==text;return next}})
 assert.ok(changed);assert.ok(r.error);assert.equal(r.jobs,undefined)
})
test('current SPEC rejects changed closing criteria and preserves all original input receipts',async()=>{
 const r=await replay({change:(text,url,n)=>url===fixture.boardURL&&n===2?text.replace('Spring Boot','Changed closing criterion'):text});assert.ok(r.error);assert.equal(r.calls.length,7);assert.equal(r.jobs,undefined)
})
test('current SPEC positive caps apply after all models reconcile',async()=>{const r=await replay({maxJobs:1});assert.ifError(r.error);assert.equal(r.jobs.length,1);assert.equal(r.calls.length,7)})
test('current SPEC null cap overrides a factory zero cap',async()=>{const r=await replay({scraper:createSpecIndiaScraper({maxJobs:0}),maxJobs:null});assert.ifError(r.error);assert.equal(r.jobs.length,3);assert.equal(r.calls.length,7)})
test('current SPEC zero cap performs no IO and retains the coverage hold',async()=>{const r=await replay({maxJobs:0});assert.ifError(r.error);assert.equal(r.calls.length,0);assert.equal(r.jobs.length,0);assert.equal(readInventoryEvidence(r.jobs).status,'coverage-gap')})
test('current SPEC exact caller cancellation stops a pending native response',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'current-native-pending'});let calls=0
 const r=await replay({signal:controller.signal,fetchResponse:()=>{calls++;queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})}})
 assert.equal(r.error,reason);assert.equal(calls,1)
})
test('current SPEC cancellation during the closing phase preserves the caller reason',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'current-native-closing'})
 const r=await replay({signal:controller.signal,change:(text,url,n)=>{if(url===fixture.boardURL&&n===2)controller.abort(reason);return text}});assert.equal(r.error,reason);assert.equal(r.calls.length,7)
})
test('current SPEC cancellation in the observation callback settles without output',async()=>{
 const controller=new AbortController(),reason=Object.freeze({caller:'current-native-audit'})
 const r=await replay({signal:controller.signal,onAudit:()=>{queueMicrotask(()=>controller.abort(reason));return new Promise(()=>{})}});assert.equal(r.error,reason);assert.equal(r.calls.length,7)
})
test('current SPEC body-only responses cannot qualify transport metadata',async()=>{
 const r=await replay({fetchResponse:async url=>{const p=fixture.packets.find(p=>p.requestedURL===url);return{status:p.status,headers:p.headers,html:Buffer.from(p.bodyBase64,'base64').toString('utf8')}}});assert.ifError(r.error);assert.ok(r.jobs.every(j=>!j.sourceDetailComplete))
})
test('current SPEC missing HTML content type cannot qualify current transport metadata',async()=>{
 const r=await replay({fetchResponse:async url=>{const p=fixture.packets.find(p=>p.requestedURL===url),time=new Date().toISOString(),headers={...p.headers};delete headers['content-type'];return{...p,method:'GET',body:null,headers,startedAt:time,completedAt:time}}});assert.ifError(r.error);assert.ok(r.jobs.every(j=>!j.sourceDetailComplete))
})
test('current SPEC audit callback receives an isolated copy of full source data',async()=>{
 const r=await replay({onAudit:audit=>{audit.observations[0].nativeSourceRecord.role.responsibilities.length=0;audit.openingWholeNativeProps.jobs.length=0}});assert.ifError(r.error);assert.equal(r.jobs.length,3);assert.deepEqual(r.jobs[0].nativeSourceRecord.role,fixture.props.jobs[0]);assert.equal(r.jobs.sourceAudit.openingWholeNativeProps.jobs.length,3)
})
test('current SPEC caller profile data cannot authorize changed native country',async()=>{
 const changed=structuredClone(fixture.props);changed.jobs.forEach(job=>job.jobLocation='Toronto, Canada')
 const r=await replay({profile:{props:changed},change:(text,url)=>url===fixture.boardURL?text.replaceAll('Ahmedabad, India','Toronto, Canada'):text});assert.ok(r.error);assert.equal(r.jobs,undefined)
})
test('current SPEC finite source-page truncation fails before any request',async()=>{
 for(const maxPages of[0,1,2]){const r=await replay({maxPages});assert.ok(r.error instanceof RangeError);assert.equal(r.calls.length,0)}
})
test('current SPEC original308 lacking Content-Type accepts the real publicRead empty metadata value',async()=>{
 const r=await replay({fetchResponse:async url=>{const p=fixture.packets.find(p=>p.requestedURL===url),time=new Date().toISOString();return{...p,method:'GET',body:null,contentType:p.headers['content-type']??'',startedAt:time,completedAt:time}}});assert.ifError(r.error);assert.equal(r.jobs.length,3);assert.ok(r.jobs.every(j=>j.sourceDetailComplete))
})
test('current SPEC308 with an unreviewed declared JSON type remains held',async()=>{
 const r=await replay({fetchResponse:async url=>{const p=fixture.packets.find(p=>p.requestedURL===url);return{...p,contentType:'application/json'}}});assert.ok(r.error);assert.equal(r.jobs,undefined)
})
for(const [name,select,contentType]of[
 ['redirect',url=>url===fixture.packets[0].requestedURL,''],
 ['document',url=>url!==fixture.packets[0].requestedURL,'text/html'],
])test('current SPEC contradictory JSON header cannot be hidden by packet Content-Type: '+name,async()=>{
 const r=await replay({fetchResponse:async url=>{const p=structuredClone(fixture.packets.find(p=>p.requestedURL===url)),time=new Date().toISOString();if(select(url)){p.headers['content-type']='application/json';p.contentType=contentType}return{...p,method:'GET',body:null,startedAt:time,completedAt:time}}});assert.ok(r.error);assert.equal(r.jobs,undefined)
})
test('current SPEC packet-only MIME metadata cannot certify absent original HTML headers',async()=>{
 const r=await replay({fetchResponse:async url=>{const p=structuredClone(fixture.packets.find(p=>p.requestedURL===url)),time=new Date().toISOString();p.contentType=p.headers['content-type']??'';delete p.headers['content-type'];return{...p,method:'GET',body:null,startedAt:time,completedAt:time}}});assert.ifError(r.error);assert.ok(r.jobs.every(j=>!j.sourceDetailComplete))
})
const rotateEmail=(text,changeAddress=false)=>text.replace(/((?:data-cfemail="|href="\/cdn-cgi\/l\/email-protection#))([0-9a-f]+)(")/gi,(_whole,prefix,hex,suffix)=>{
 const original=Buffer.from(hex,'hex'),key=original[0]^85,plain=Buffer.from(original.subarray(1).map(byte=>byte^original[0]));if(changeAddress)plain[0]^=1
 return prefix+Buffer.from([key,...plain.map(byte=>byte^key)]).toString('hex')+suffix
})
const reframe=(html,changeBootstrap=false)=>{
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(match=>match[1].startsWith('self.__next_f.push('))
 let data=scripts.map(match=>JSON.parse(/^self\.__next_f\.push\(([\s\S]*)\);?$/.exec(match[1])[1])[1]).join('')
 const imports=[...data.matchAll(/^[0-9a-f]+:I[^\n]*\n/gm)];assert.ok(imports.length>=2)
 const [a,b]=imports;data=data.slice(0,a.index)+b[0]+data.slice(a.index+a[0].length,b.index)+a[0]+data.slice(b.index+b[0].length)
 const middle=Math.floor(data.length/2),frames=[data.slice(0,middle),data.slice(middle)].map(part=>'<script>self.__next_f.push([1,'+JSON.stringify(part).replaceAll('<','\\u003c')+'])</script>').join('')
 let result=html
 for(let index=scripts.length-1;index>=0;index--){const match=scripts[index];result=result.slice(0,match.index)+(index===0?frames:'')+result.slice(match.index+match[0].length)}
 if(changeBootstrap)result=result.replace('(self.__next_f=self.__next_f||[]).push([0])','(self.__next_f=self.__next_f||[]).push([9])')
 return result
}
test('current SPEC actual changed homepage retains exactly the same native data after carrier-only movement',async()=>{
 const packet=fixture.additionalOriginalPackets[0],fresh=Buffer.from(packet.bodyBase64,'base64').toString('utf8')
 const r=await replay({change:(text,url)=>url===packet.requestedURL?fresh:text});assert.ifError(r.error);assert.equal(r.calls.length,7);assert.equal(r.jobs.length,3);assert.ok(r.jobs.every(job=>job.sourceDetailComplete&&!job.sourceRenderedDetailComplete))
})
test('current SPEC exact decoded emails survive new XOR keys without masking full role criteria',async()=>{
 let changed=false;const r=await replay({change:(text,url)=>{if(url===fixture.packets[0].requestedURL)return text;const next=rotateEmail(text);changed||=next!==text;return next}});assert.ok(changed);assert.ifError(r.error);assert.deepEqual(r.jobs.map(job=>job.nativeSourceRecord.role),fixture.props.jobs)
})
test('current SPEC literal Flight repartition and different-ID delivery order preserve only data completeness',async()=>{
 const r=await replay({change:(text,url)=>url===fixture.boardURL?reframe(text):text});assert.ifError(r.error);assert.equal(r.jobs.length,3);assert.ok(r.jobs.every(job=>job.sourceDetailComplete&&!job.sourceClientQualified&&!job.sourceCSSQualified))
})
test('current SPEC changed decoded contact cannot be hidden by the email cipher',async()=>{
 let changed=false;const r=await replay({change:(text,url)=>{if(url!==fixture.packets[1].requestedURL)return text;const next=rotateEmail(text,true);changed=next!==text;return next}});assert.ok(changed);assert.ok(r.error);assert.equal(r.jobs,undefined)
})
test('current SPEC changing the bootstrap programme is not a carrier-only representation',async()=>{
 const r=await replay({change:(text,url)=>url===fixture.boardURL?reframe(text,true):text});assert.ok(r.error);assert.equal(r.jobs,undefined)
})
test('current SPEC unfamiliar data-script attributes remain unqualified',async()=>{
 const r=await replay({change:(text,url)=>url===fixture.boardURL?text.replace('<script>self.__next_f.push(','<script data-unreviewed="1">self.__next_f.push('):text});assert.ok(r.error);assert.equal(r.jobs,undefined)
})

function changedStream(html,change){
 const scripts=[...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].filter(match=>match[1].startsWith('self.__next_f.push('))
 const payload=scripts.map(match=>JSON.parse(/^self\.__next_f\.push\(([\s\S]*)\);?$/.exec(match[1])[1])[1]).join(''),next=change(payload)
 assert.notEqual(payload,next,'The adversarial control must change decoded carrier bytes')
 const frame='<script>self.__next_f.push('+JSON.stringify([1,next]).replaceAll('<','\\u003c')+')</script>'
 for(let index=scripts.length-1;index>=0;index--){const match=scripts[index];html=html.slice(0,match.index)+(index===0?frame:'')+html.slice(match.index+match[0].length)}
 return html
}
for(const[name,change]of[
 ['empty-ID resource hint',payload=>payload.replace(/^:([^\n]*)\n/m,(_whole,raw)=>':'+raw+' \n')],
 ['unaccounted stream LF',payload=>'\n'+payload],
 ['duplicate control occurrence order',payload=>{const rows=[...payload.matchAll(/^b:[^\n]*\n/gm)];assert.equal(rows.length,2);const[a,b]=rows;assert.notEqual(a[0],b[0]);return payload.slice(0,a.index)+b[0]+payload.slice(a.index+a[0].length,b.index)+a[0]+payload.slice(b.index+b[0].length)}],
])test('current SPEC preserves complete carrier bytes for '+name,async()=>{
 const result=await replay({change:(html,url)=>url===fixture.boardURL?changedStream(html,change):html});assert.ok(result.error);assert.equal(result.jobs,undefined)
})

test('current SPEC contact-looking text in an ordinary script remains significant',async()=>{
 const result=await replay({change:(html,url)=>url===fixture.packets[1].requestedURL?html.replace('</body>','<script>const x=\'data-cfemail="204c45414460535045430d494e4449410e434f4d"\'</script></body>'):html});assert.ok(result.error);assert.equal(result.jobs,undefined)
})

const secondCareerOriginal=()=>Buffer.from(fixture.additionalOriginalPackets.find(packet=>packet.requestedURL.endsWith('/about/career')).bodyBase64,'base64').toString('utf8')
test('current SPEC exact second career fragment delivery retains full DATA with unknown rendering',async()=>{
 const result=await replay({change:(html,url)=>url.endsWith('/about/career')?secondCareerOriginal():html});assert.ifError(result.error);assert.equal(result.calls.length,7);assert.equal(result.jobs.length,3);assert.ok(result.jobs.every(row=>row.sourceDetailComplete&&!row.sourceRenderedDetailComplete&&!row.sourceClientQualified&&!row.activeApplyVerified))
})
test('current SPEC closing may use the other exact reviewed career DATA representation',async()=>{
 const result=await replay({change:(html,url,n)=>url.endsWith('/about/career')&&n===2?secondCareerOriginal():html});assert.ifError(result.error);assert.equal(result.calls.length,7);assert.deepEqual(result.jobs.map(row=>row.nativeSourceRecord),result.jobs.map(row=>row.nativeClosingRecord))
})
for(const[name,change]of[
 ['hidden header',html=>html.replace('<div hidden id="S:1">','<div hidden data-unreviewed="1" id="S:1">')],
 ['stream initializer programme',html=>html.replace('$RT=performance.now()','$RT=Date.now()')],
 ['corporate header name',html=>html.replace('SPEC India, 40th Year Anniversary','Other publisher, 40th Year Anniversary')],
])test('current SPEC exact second career representation rejects changed '+name,async()=>{
 let changed=false;const result=await replay({change:(html,url)=>{if(!url.endsWith('/about/career'))return html;const old=secondCareerOriginal(),next=change(old);changed=old!==next;return next}});assert.ok(changed);assert.ok(result.error);assert.equal(result.jobs,undefined)
})

const secondBoardOriginal=()=>Buffer.from(fixture.additionalOriginalPackets.find(packet=>packet.requestedURL===fixture.boardURL).bodyBase64,'base64').toString('utf8')
test('current SPEC exact second board fragment delivery preserves every full native DATA field',async()=>{
 const result=await replay({change:(html,url)=>url===fixture.boardURL?secondBoardOriginal():url.endsWith('/about/career')?secondCareerOriginal():html});assert.ifError(result.error);assert.equal(result.calls.length,7);assert.deepEqual(result.jobs.map(row=>row.nativeSourceRecord.role),fixture.props.jobs);assert.ok(result.jobs.every(row=>row.sourceDetailComplete&&!row.sourceRenderedDetailComplete&&!row.sourceClientQualified&&!row.sourceCSSQualified&&row.applyUrl===null))
})
test('current SPEC closing board may use the other exact reviewed DATA representation with both raw originals retained',async()=>{
 const result=await replay({change:(html,url,n)=>url===fixture.boardURL&&n===2?secondBoardOriginal():html});assert.ifError(result.error);assert.equal(result.calls.length,7)
 for(const row of result.jobs){assert.deepEqual(row.nativeSourceRecord,row.nativeClosingRecord);assert.notEqual(row.sourceRawNativeRoleSHA256,row.sourceRawClosingNativeRoleSHA256);assert.equal(sha(row.sourceRawNativeRole),row.sourceRawNativeRoleSHA256);assert.equal(sha(row.sourceRawClosingNativeRole),row.sourceRawClosingNativeRoleSHA256)}
})
for(const[name,change]of[
 ['hidden header attributes',html=>html.replace('<div hidden id="S:1">','<div hidden data-unreviewed="1" id="S:1">')],
 ['native full criterion',html=>html.replace('Spring Boot','Changed mandatory Canadian assignment')],
])test('current SPEC second board representation rejects changed '+name,async()=>{
 let changed=false;const result=await replay({change:(html,url)=>{if(url!==fixture.boardURL)return html;const old=secondBoardOriginal(),next=change(old);changed=old!==next;return next}});assert.ok(changed);assert.ok(result.error);assert.equal(result.jobs,undefined)
})
