import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync,gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readJasperApi,readJasperBoard,readJasperOwn,readJasperCorporate,reconcileJasperServerProgramme} from '../scraper/jasper/currentProgrammeData.js'
import {readCurrentJasperProgramme} from '../scraper/jasper/currentProgramme.js'

// The new fixture is ONE genuine opening from FAILED actual36. All alterations,
// mixed historical deliveries and reused closings below are CONTROLLED tests.
globalThis.fetch=()=>assert.fail('Jasper Age tests forbid publisher HTTP')
const sha=body=>createHash('sha256').update(body).digest('hex')
const fixtureBytes=fs.readFileSync(new URL('./fixtures/jasper-api-age-original-20261112.json.gz',import.meta.url))
const fixture=JSON.parse(gunzipSync(fixtureBytes)),actual=fixture.responses[0]
const history=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/jasper-server-programme-originals-20261111.json.gz',import.meta.url))))
const C='https://www.jasper.ai/careers',B='https://jobs.ashbyhq.com/Jasper%20AI',A='https://api.ashbyhq.com/posting-api/job-board/Jasper%20AI'
const api=()=>({...structuredClone(actual.originalResponse),body:Buffer.from(actual.bodyBase64,'base64')})
const packet=item=>({...structuredClone(item.originalReceipt),body:Buffer.from(item.bodyBase64,'base64')})
const originals=new Map(history.responses.map(item=>[item.originalReceipt.requestedURL,item]))
const payload=JSON.parse(Buffer.from(actual.bodyBase64,'base64'))
function header(input,name,value){
 const result={...input,headers:{...input.headers},headerEntries:input.headerEntries.filter(([key])=>key!==name).map(pair=>[...pair])}
 if(value===undefined)delete result.headers[name]
 else{result.headers[name]=value;result.headerEntries.push([name,value])}
 return result
}
function body(input,value){
 const bytes=Buffer.from(value)
 return{...input,body:bytes,bodyBytes:bytes.length,bodySHA256:sha(bytes),consumedBodyBytes:bytes.length}
}
const hold=(operation,reasons)=>assert.throws(operation,error=>error.code==='JASPER_PROGRAMME_HOLD'&&error.failureKind==='coverage_gap'&&(!reasons||reasons.includes(error.reason)))

test('actual36 API Age21 preserves the complete genuine opening without source-time claims',()=>{
 assert.equal(fixture.genuineOpeningResponses,1);assert.equal(fixture.genuineClosingResponses,0)
 assert.equal(fixture.currentProgrammeQualified,false);assert.equal(fixture.actual36Requalified,false)
 assert.equal(fixture.acquisition.sourceFailureKind,'coverage_gap')
 assert.equal(fixture.acquisition.originalCapture.SHA256,'0e3c63c8c202f2dbc26909c1f3749390ffebcf69f6a0eaa2160a2b4fff0f19b9')
 assert.equal(actual.bodyBytes,108160);assert.equal(sha(Buffer.from(actual.bodyBase64,'base64')),'47a9ee26da48447afe0757826aa55493c6b3908a5dde95febd66ff3e8d2cbcd1')
 const model=readJasperApi(api())
 assert.deepEqual(model.nativePayload,payload)
 assert.equal(model.originalText,Buffer.from(actual.bodyBase64,'base64').toString('utf8'))
 for(const [key,value]of Object.entries(actual.originalResponse))assert.deepEqual(model.originalResponse[key],value,key)
 assert.equal(model.originalResponse.bodyBase64,actual.bodyBase64)
 for(const key of ['currentnessQualified','programmeZeroQualified','sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed'])assert.equal(model[key],false,key)
 assert.notEqual(model.sourceTimeSemanticsQualified,true);assert.notEqual(model.originContactQualified,true)
 assert.equal(model.originalResponse.headers.age,'21')
})

for(const value of [undefined,'0','21','2147483648','0000000000','0000000021','021'])test('API Age retains valid original literal '+String(value),()=>{
 const input=header(api(),'age',value),model=readJasperApi(input)
 assert.deepEqual(model.nativePayload,payload)
 assert.deepEqual(model.originalResponse.headers,input.headers)
 assert.deepEqual(model.originalResponse.headerEntries,input.headerEntries)
 assert.equal(Object.hasOwn(model.originalResponse.headers,'age'),value!==undefined)
 if(value!==undefined)assert.equal(model.originalResponse.headers.age,value)
 assert.equal(model.currentnessQualified,false)
})

for(const [label,value]of [
 ['empty',''],['positive sign','+21'],['negative','-1'],['decimal','21.0'],['exponent','2e1'],
 ['list','21, 22'],['leading space',' 21'],['trailing space','21 '],['tab','21\t'],
 ['line separator','21\u2028'],['paragraph separator','21\u2029'],['unicode digits','\u0662\u0661'],
 ['overflow','2147483649'],['ten-digit overflow','9999999999'],['eleven zeros','00000000000'],['overlong bounded number','02147483648'],
])test('API Age rejects '+label,()=>hold(()=>readJasperApi(header(api(),'age',value)),['security']))

for(const [label,value]of [['number',21],['null',null],['array',['21']],['object',{value:'21'}]])test('API Age rejects original non-string '+label,()=>hold(()=>readJasperApi(header(api(),'age',value)),['headers','input']))

test('API Age cannot make disagreeing original header views qualify',()=>{
 const input=api();input.headerEntries=input.headerEntries.map(([name,value])=>[name,name==='age'?'22':value])
 hold(()=>readJasperApi(input),['headers'])
})
test('API Age rejects duplicate original entries even when values agree',()=>{
 const input=api();input.headerEntries.push(['Age','21']);hold(()=>readJasperApi(input),['headers'])
})
for(const [channel,reader,url]of [['B',readJasperBoard,B],['O',readJasperOwn,payload.jobs[0].jobUrl]])test('Invalid Age still holds on '+channel+' native HTML',()=>{
 hold(()=>reader(header(packet(originals.get(url)),'age','21 ')),['security'])
})
for(const [name,value]of [['x-unreviewed','value'],['authorization','Bearer controlled'],['refresh','0; url=https://example.invalid/'],
 ['cf-mitigated','challenge'],['permissions-policy','camera=()'],['document-policy','force-load-at-top'],['content-security-policy',"script-src 'none'"]])test('valid Age cannot bypass '+name+' header hold',()=>{
 hold(()=>readJasperApi(header(api(),name,value)),['security'])
})
test('Age cannot bypass a changed known initial security value',()=>hold(()=>readJasperApi(header(api(),'x-frame-options','SAMEORIGIN')),['security']))
test('Age cannot bypass body hash disagreement',()=>{
 const input=api();input.body=Buffer.concat([input.body,Buffer.from(' ')]);hold(()=>readJasperApi(input),['response'])
})
test('Age cannot bypass contradictory complete-response metadata',()=>{
 const input=api();input.decodedPrefixOnly=true;hold(()=>readJasperApi(input),['response'])
})
test('Age cannot bypass an unknown API field',()=>{
 const changed=structuredClone(payload);changed.extraPublishedCriterion='unreviewed'
 hold(()=>readJasperApi(body(api(),JSON.stringify(changed))),['api-shape'])
})
test('Age cannot bypass an explicit additional India country',()=>{
 const changed=structuredClone(payload);changed.jobs[0].address.postalAddress.addressCountry='India'
 hold(()=>readJasperApi(body(api(),JSON.stringify(changed))),['country'])
})
test('Age cannot drop a changed original primary criterion in full reconciliation',()=>{
 const changed=structuredClone(payload);changed.jobs[0].descriptionPlain+='\nAn additional authored requirement.'
 hold(()=>reconcileJasperServerProgramme({corporate:readJasperCorporate(packet(originals.get(C))),board:readJasperBoard(packet(originals.get(B))),
  api:readJasperApi(body(api(),JSON.stringify(changed))),roles:payload.jobs.map(record=>readJasperOwn(packet(originals.get(record.jobUrl))))}),['criteria'])
})

test('Age getters and proxy header carriers reject without callbacks',()=>{
 let callbacks=0
 const input=api();Object.defineProperty(input.headers,'age',{enumerable:true,get(){callbacks++;return'21'}})
 hold(()=>readJasperApi(input),['input'])
 const next=api();next.headers=new Proxy(next.headers,{get(){callbacks++;throw Error('No proxy reads')},ownKeys(){callbacks++;throw Error('No proxy keys')},getOwnPropertyDescriptor(){callbacks++;throw Error('No proxy descriptors')}})
 hold(()=>readJasperApi(next),['input']);assert.equal(callbacks,0)
})
test('valid Age preserves independent immutable original ownership without byte hooks',()=>{
 let callbacks=0
 const input=api();input.body.valueOf=()=>{callbacks++;throw Error('No byte hooks')}
 const model=readJasperApi(input);input.headers.age='0';input.headerEntries.length=0;input.body.fill(0)
 assert.equal(model.originalResponse.headers.age,'21');assert.equal(model.originalResponse.bodyBase64,actual.bodyBase64)
 assert.deepEqual(model.nativePayload,payload);assert.equal(callbacks,0)
})

test('controlled full N7 replay retains different valid API Age literals without origin-time claims',async t=>{
 const urls=payload.jobs.map(record=>record.jobUrl),order=[C,B,A,...urls,...urls.toReversed(),A,B,C],calls=[]
 const jobs=await readCurrentJasperProgramme({readPage:async(url,init)=>{
  assert.equal(url,order[calls.length]);calls.push(url)
  assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const input=url===A?header(api(),'age',calls.length===3?'0000000021':'2147483648'):packet(originals.get(url))
  return{...input,controlledEvidence:'CONTROLLED historical opening delivery/reused closing; no actual interval.'}
 }})
 assert.equal(jobs.length,0);assert.equal(calls.length,20)
 const audit=jobs.nativeCollectionEvidence,opening=audit.rawPages[2],closing=audit.rawPages[17]
 assert.equal(opening.headers.age,'0000000021');assert.equal(closing.headers.age,'2147483648')
 assert.equal(opening.originalResponse.headers.age,'0000000021');assert.equal(closing.originalResponse.headers.age,'2147483648')
 assert.equal(opening.bodyBase64,actual.bodyBase64);assert.equal(closing.bodyBase64,actual.bodyBase64)
 assert.deepEqual(opening.securityPolicy,closing.securityPolicy)
 assert.ok(audit.openingClosingEquality.every(pair=>pair.wholeRawEntityEqual&&pair.securityPolicyEqual))
 assert.deepEqual(audit.nativePayload,payload);assert.equal(audit.nativeRecords.length,7)
 assert.equal(audit.sourceTimeSemanticsQualified,false);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.notEqual(audit.originContactQualified,true);assert.notEqual(audit.originFreshnessQualified,true)
 const evidence={evidenceClass:'CONTROLLED_MIXED_HISTORICAL_OPENINGS_AND_REUSED_CLOSINGS_ONLY',genuineCurrentClosingResponses:0,actual36Reclassified:false,originContactOrSourceTimeQualified:false,calls,audit}
 if(process.env.JASPER_API_AGE_CONTROLLED_AUDIT_OUTPUT)fs.writeFileSync(process.env.JASPER_API_AGE_CONTROLLED_AUDIT_OUTPUT,gzipSync(Buffer.from(JSON.stringify(evidence)+'\n')),{flag:'wx'})
 t.diagnostic(JSON.stringify({controlledHistoricalReplayOnly:true,nativeReads:20,openingApiAge:'0000000021',closingApiAge:'2147483648',bothOriginalBodiesSHA256:opening.bodySHA256,sourceTimeSemanticsQualified:false,originContactQualified:false,HTTP:0}))
})
