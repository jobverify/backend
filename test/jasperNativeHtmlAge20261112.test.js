import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync,gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readJasperBoard,readJasperOwn} from '../scraper/jasper/currentProgrammeData.js'
import {readCurrentJasperProgramme} from '../scraper/jasper/currentProgramme.js'

// Three actual37 packets contain ONE genuine own pair inside a FAILED source
// attempt. Added headers and reused historical closes are CONTROLLED evidence.
globalThis.fetch=()=>assert.fail('Native HTML Age tests forbid publisher HTTP')
const sha=body=>createHash('sha256').update(body).digest('hex')
const bytes=fs.readFileSync(new URL('./fixtures/jasper-native-html-age-originals-20261112.json.gz',import.meta.url))
const fixture=JSON.parse(gunzipSync(bytes)),[actualBoard,actualOpening,actualClosing]=fixture.responses
const history=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/jasper-server-programme-originals-20261111.json.gz',import.meta.url))))
const originals=new Map(history.responses.map(item=>[item.originalReceipt.requestedURL,item]))
const C='https://www.jasper.ai/careers',B='https://jobs.ashbyhq.com/Jasper%20AI',A='https://api.ashbyhq.com/posting-api/job-board/Jasper%20AI'
const actualPacket=row=>({...structuredClone(row.originalResponse),body:Buffer.from(row.bodyBase64,'base64')})
const historicalPacket=row=>({...structuredClone(row.originalReceipt),body:Buffer.from(row.bodyBase64,'base64')})
const payload=JSON.parse(Buffer.from(originals.get(A).bodyBase64,'base64'))
const channels=[['B',readJasperBoard,actualBoard],['O',readJasperOwn,actualOpening]]
function header(input,name,value){
 const result={...input,headers:{...input.headers},headerEntries:input.headerEntries.filter(([key])=>key.toLowerCase()!==name).map(pair=>[...pair])}
 if(value===undefined)delete result.headers[name]
 else{result.headers[name]=value;result.headerEntries.push([name,value])}
 return result
}
function changedBody(input,text){
 const body=Buffer.from(text)
 return{...input,body,bodyBytes:body.length,bodySHA256:sha(body),consumedBodyBytes:body.length}
}
function changedLD(input,edit){
 const text=input.body.toString('utf8'),match=/<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(text)
 assert.ok(match,'The genuine source must supply its original LD carrier')
 const value=JSON.parse(match[1]);edit(value)
 return changedBody(input,text.replace(match[0],'<script type="application/ld+json">'+JSON.stringify(value)+'</script>'))
}
const hold=(operation,reasons)=>assert.throws(operation,error=>error.code==='JASPER_PROGRAMME_HOLD'&&error.failureKind==='coverage_gap'&&(!reasons||reasons.includes(error.reason)))

test('genuine actual37 closing own Age0 preserves the complete original pair without releasing actual37',()=>{
 assert.equal(sha(bytes),'1a3171a98765915b18c48280b930888cc20beffbba515b32543367cee774adb6')
 assert.deepEqual(fixture.acquisition.originalCaptureRowIndices,[1,9,10])
 assert.equal(fixture.acquisition.originalCapture.SHA256,'33343facfe17a167eccf2cf3de68c9eb95c333807c762a18338f4381f83ac96a')
 assert.equal(fixture.genuineOpeningResponses,2);assert.equal(fixture.genuineClosingResponses,1);assert.equal(fixture.genuineBoardClosingResponses,0)
 assert.equal(fixture.currentProgrammeQualified,false);assert.equal(fixture.actual37Requalified,false)
 assert.equal(actualClosing.bodyBytes,54837);assert.equal(actualClosing.bodySHA256,'b10f2937723507ef633544971d3c97b73e865ca5e1e99a00fae8b81075c678c5')
 assert.equal(actualClosing.headers.age,'0');assert.equal(actualClosing.bodyBase64,actualOpening.bodyBase64)
 const opening=readJasperOwn(actualPacket(actualOpening)),closing=readJasperOwn(actualPacket(actualClosing))
 assert.deepEqual(closing.originalAppData,opening.originalAppData);assert.deepEqual(closing.originalLD,opening.originalLD)
 assert.deepEqual(closing.originalHead,opening.originalHead);assert.deepEqual(closing.primaryProjection,opening.primaryProjection)
 assert.deepEqual(closing.securityFacts.original,opening.securityFacts.original);assert.equal(Object.keys(closing.securityFacts.original).length,17)
 for(const[key,value]of Object.entries(actualClosing.originalResponse))assert.deepEqual(closing.originalResponse[key],value,key)
 assert.equal(closing.originalResponse.bodyBase64,actualClosing.bodyBase64)
 assert.equal(closing.originalAppData.posting.descriptionHtml,closing.originalLD.description)
 assert.equal(closing.originalAppData.posting.shouldAskForTextingConsent,true)
 assert.equal(closing.originalAppData.posting.candidateTextingPrivacyPolicyUrl,'https://legal.jasper.ai/#candidate-notice')
 assert.match(closing.originalAppData.posting.applicationLimitCalloutHtml,/2 times in 60 days/)
 assert.match(closing.originalAppData.posting.applicationLimitCalloutHtml,/within 30 days/)
 for(const flag of ['currentnessQualified','programmeZeroQualified','sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','sourceBodiesQualified','rendererConsumptionQualified','fullRenderedCriteriaQualified','applicationVisited','applicantEligibilityQualified'])assert.equal(closing[flag],false,flag)
 assert.notEqual(closing.sourceTimeSemanticsQualified,true);assert.notEqual(closing.originContactQualified,true)
})

for(const[channel,reader,row]of channels){
 test('genuine '+channel+' optional Age absence remains absent',()=>{
  const model=reader(actualPacket(row))
  assert.equal(Object.hasOwn(row.headers,'age'),false);assert.equal(Object.hasOwn(model.originalResponse.headers,'age'),false)
  assert.deepEqual(model.originalResponse.headerEntries,row.headerEntries)
  assert.equal(model.originalResponse.bodyBase64,row.bodyBase64)
 })
 for(const value of ['0','21','2147483648','0000000000','0000000021','021'])test('CONTROLLED '+channel+' Age preserves valid original literal '+value,()=>{
  const input=header(actualPacket(row),'age',value),model=reader(input)
  assert.deepEqual(model.originalResponse.headers,input.headers);assert.deepEqual(model.originalResponse.headerEntries,input.headerEntries)
  assert.equal(model.originalResponse.headers.age,value);assert.equal(model.originalResponse.bodyBase64,row.bodyBase64)
  assert.deepEqual(model.securityFacts.original,reader(actualPacket(row)).securityFacts.original)
  assert.equal(model.currentnessQualified,false);assert.notEqual(model.originFreshnessQualified,true)
 })
 for(const[label,value]of [
  ['empty',''],['positive sign','+1'],['negative','-1'],['fraction','0.5'],['exponent','1e1'],['list','0, 1'],
  ['leading whitespace',' 0'],['trailing whitespace','0 '],['tab','0\t'],['line separator','0\u2028'],['paragraph separator','0\u2029'],
  ['line feed','0\n'],['NUL','0\0'],['Unicode digits','\u0660'],['overflow','2147483649'],['ten-digit overflow','9999999999'],
  ['eleven zeros','00000000000'],['eleven-digit bounded value','00000000021'],
 ])test('CONTROLLED '+channel+' Age holds '+label,()=>hold(()=>reader(header(actualPacket(row),'age',value)),['security','headers']))
 for(const[label,value]of [['number',0],['null',null],['array',['0']],['object',{value:'0'}]])test('CONTROLLED '+channel+' Age holds non-string '+label,()=>hold(()=>reader(header(actualPacket(row),'age',value)),['headers','input']))
 test('CONTROLLED '+channel+' duplicate Age views hold even when values agree',()=>{
  const input=header(actualPacket(row),'age','0');input.headerEntries.push(['Age','0'])
  hold(()=>reader(input),['headers'])
 })
 test('CONTROLLED '+channel+' disagreeing Age views hold',()=>{
  const input=header(actualPacket(row),'age','0');input.headerEntries=input.headerEntries.map(([name,value])=>[name,name==='age'?'1':value])
  hold(()=>reader(input),['headers'])
 })
 for(const[name,value]of [['x-unreviewed','value'],['authorization','Bearer CONTROLLED'],['refresh','0; url=https://example.invalid/'],
  ['cf-mitigated','challenge'],['cf-chl-out','CONTROLLED'],['x-captcha-required','true'],['permissions-policy','camera=()'],['document-policy','force-load-at-top']])test('valid '+channel+' Age cannot bypass '+name,()=>{
  hold(()=>reader(header(header(actualPacket(row),'age','0'),name,value)),['security'])
 })
 test('valid '+channel+' Age cannot bypass a known changed policy value',()=>hold(()=>reader(header(header(actualPacket(row),'age','0'),'x-frame-options','SAMEORIGIN')),['security']))
 test('valid '+channel+' Age cannot bypass a changed nonce binding',()=>{
  const input=header(actualPacket(row),'age','0'),text=input.body.toString('utf8')
  assert.match(text,/<meta name="csp-nonce" id="csp-nonce"/)
  const model=reader(actualPacket(row)),nonce=model.securityFacts.originalNonce
  assert.equal(nonce.length,43)
  hold(()=>reader(changedBody(input,text.replaceAll(nonce,'A'.repeat(43)))),['security'])
 })
 test('valid '+channel+' Age cannot bypass raw entity hash disagreement',()=>{
  const input=header(actualPacket(row),'age','0');input.body=Buffer.concat([input.body,Buffer.from('\n')])
  hold(()=>reader(input),['response'])
 })
 for(const[key,value]of [['bodyComplete',false],['decodedPrefixOnly',true],['streamDone',false],['error',{message:'CONTROLLED interrupted'}],['consumedBodyBytes',1],['discardedOverflowBytes',1]])test('valid '+channel+' Age cannot bypass contradictory '+key,()=>{
  const input=header(actualPacket(row),'age','0');input[key]=value;hold(()=>reader(input),['response'])
 })
 test(channel+' Age accessors and proxies hold without callbacks',()=>{
  let callbacks=0
  const input=actualPacket(row);Object.defineProperty(input.headers,'age',{enumerable:true,get(){callbacks++;return'0'}})
  hold(()=>reader(input),['input'])
  const second=actualPacket(row);second.headers=new Proxy(second.headers,{get(){callbacks++;throw Error('No proxy read')},ownKeys(){callbacks++;throw Error('No proxy keys')},getOwnPropertyDescriptor(){callbacks++;throw Error('No proxy descriptors')}})
  hold(()=>reader(second),['input']);assert.equal(callbacks,0)
 })
 test(channel+' valid Age retains immutable private originals without byte conversion hooks',()=>{
  let callbacks=0
  const input=header(actualPacket(row),'age','0000000021');input.body.valueOf=()=>{callbacks++;throw Error('No byte hook')}
  const model=reader(input);input.headers.age='0';input.headerEntries.length=0;input.body.fill(0)
  assert.equal(model.originalResponse.headers.age,'0000000021');assert.equal(model.originalResponse.bodyBase64,row.bodyBase64)
  assert.ok(Object.isFrozen(model.originalResponse));assert.throws(()=>{model.originalResponse.headers.age='0'},TypeError)
  assert.equal(callbacks,0)
 })
}

test('valid own Age cannot bypass a contradictory complete original criterion',()=>{
 const input=header(actualPacket(actualOpening),'age','0')
 hold(()=>readJasperOwn(changedLD(input,value=>{value.description+=' An additional authored requirement.'})),['criteria'])
})
test('valid own Age cannot bypass explicit additional India work country',()=>{
 const input=header(actualPacket(actualOpening),'age','0')
 hold(()=>readJasperOwn(changedLD(input,value=>{value.jobLocation.address.addressCountry='India'})),['country'])
})

function controlledReplayReader(calls,edit){
 const urls=payload.jobs.map(record=>record.jobUrl),order=[C,B,A,...urls,...urls.toReversed(),A,B,C]
 return async(url,init)=>{
  assert.equal(url,order[calls.length]);calls.push(url)
  assert.equal(init.method,'GET');assert.equal(init.cache,'no-store');assert.equal(init.credentials,'omit');assert.equal(init.redirect,'manual')
  const closing=calls.length>10
  let input
  if(url===B)input=actualPacket(actualBoard)
  else if(url===actualOpening.requestedURL)input=actualPacket(closing?actualClosing:actualOpening)
  else input=historicalPacket(originals.get(url))
  if(url!==C)input=header(input,'age',closing?(url===actualOpening.requestedURL?'0':'2147483648'):(url===A?'0000000021':'0000000000'))
  input.controlledEvidence='CONTROLLED mixed original actual37/historical openings, varied metadata and reused closes; no genuine complete interval.'
  return edit?edit(input,calls.length):input
 }
}

test('CONTROLLED full N7 retains varied A B O Age literals with every full model and raw closing rule',async t=>{
 const calls=[],jobs=await readCurrentJasperProgramme({readPage:controlledReplayReader(calls)}),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(calls.length,20);assert.equal(audit.rawPages.length,20)
 assert.deepEqual(audit.nativePayload,payload);assert.equal(audit.nativeRecords.length,7)
 for(const record of audit.nativeRecords){
  assert.equal(record.originalFullHTML,record.originalAPIHTML);assert.equal(record.originalLDHTML,record.originalAPIHTML)
  assert.equal(record.originalAPIPlain,record.originalAPI.descriptionPlain)
  assert.equal(record.primaryWorkCountry,'USA');assert.equal(record.publishedApplicantCountry,'USA')
  assert.equal(record.originalPosting.shouldAskForTextingConsent,true)
  assert.equal(record.originalPosting.candidateTextingPrivacyPolicyUrl,'https://legal.jasper.ai/#candidate-notice')
  assert.match(record.originalApplicationLimitHTML,/2 times in 60 days/);assert.match(record.originalApplicationLimitHTML,/within 30 days/)
 }
 for(const pair of audit.openingClosingEquality){
  assert.equal(pair.wholeRawEntityEqual,true);assert.equal(pair.securityPolicyEqual,true)
  const rows=audit.rawPages.filter(row=>row.requestedURL===pair.url)
  assert.equal(rows.length,2);assert.equal(rows[0].bodyBase64,rows[1].bodyBase64);assert.deepEqual(rows[0].securityPolicy,rows[1].securityPolicy)
  assert.deepEqual(rows.map(row=>row.headers),rows.map(row=>row.originalResponse.headers))
  if(pair.url!==C)assert.notEqual(rows[0].headers.age,rows[1].headers.age)
 }
 assert.equal(audit.rawPages[1].headers.age,'0000000000');assert.equal(audit.rawPages[18].headers.age,'2147483648')
 assert.equal(audit.rawPages[2].headers.age,'0000000021');assert.equal(audit.rawPages[17].headers.age,'2147483648')
 assert.equal(audit.rawPages[10].headers.age,'0');assert.equal(audit.rawPages[10].bodyBase64,actualClosing.bodyBase64)
 assert.equal(audit.observedRecordCount,7);assert.equal(audit.observedVacancyCount,7);assert.equal(audit.recordKind,'vacancy-rows');assert.equal(audit.reportedTotal,null)
 for(const flag of ['sourceTimeSemanticsQualified','sourceScopeComplete','companyGlobalScopeQualified','lifecycleCleanupAllowed','sourceBodiesQualified','rendererConsumptionQualified','fullRenderedCriteriaQualified','applicationVisited','applicantEligibilityQualified'])assert.equal(audit[flag],false,flag)
 assert.notEqual(audit.originContactQualified,true);assert.notEqual(audit.originFreshnessQualified,true)
 const evidence={evidenceClass:'CONTROLLED_MIXED_HISTORICAL_AND_ACTUAL37_COMPONENTS_WITH_REUSED_CLOSINGS',genuineCompleteCurrentInterval:false,actual37Requalified:false,HTTP:0,calls,audit}
 if(process.env.JASPER_NATIVE_HTML_AGE_CONTROLLED_AUDIT_OUTPUT)fs.writeFileSync(process.env.JASPER_NATIVE_HTML_AGE_CONTROLLED_AUDIT_OUTPUT,gzipSync(Buffer.from(JSON.stringify(evidence)+'\n')),{flag:'wx'})
 t.diagnostic(JSON.stringify({controlledOnly:true,reads:20,records:7,wholePairs:audit.openingClosingEquality.length,sourceTimeSemanticsQualified:false,HTTP:0}))
})

test('CONTROLLED valid native Age cannot release changed whole closing bytes and retains the held audit',async()=>{
 const calls=[]
 await assert.rejects(readCurrentJasperProgramme({readPage:controlledReplayReader(calls,(input,index)=>index===11?changedBody(input,input.body.toString('utf8')+'\n'):input)}),error=>{
  assert.equal(error.reason,'closing');assert.equal(error.failureKind,'coverage_gap')
  const audit=error.nativeCollectionEvidence
  assert.equal(calls.length,11);assert.equal(audit.rawPages.length,11);assert.equal(audit.rawPages[10].headers.age,'0')
  assert.notEqual(audit.rawPages[9].bodySHA256,audit.rawPages[10].bodySHA256)
  assert.equal(audit.currentTransactionQualified,false);assert.equal(audit.currentDeclaredSourceProgramComplete,false)
  assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.sourceScopeComplete,false)
  const evidence={evidenceClass:'CONTROLLED_CHANGED_CLOSING_ENTITY_HOLD_ONLY',genuineCompleteCurrentInterval:false,actual37Requalified:false,HTTP:0,calls,audit}
  if(process.env.JASPER_NATIVE_HTML_AGE_HELD_AUDIT_OUTPUT)fs.writeFileSync(process.env.JASPER_NATIVE_HTML_AGE_HELD_AUDIT_OUTPUT,gzipSync(Buffer.from(JSON.stringify(evidence)+'\n')),{flag:'wx'})
  return true
 })
})
