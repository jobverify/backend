import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCurrentNativeReader} from '../native-sources/boundedCurrentNativeRead20261106.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../utils/sourceObservationEvidence.js'
import {generateFingerprint} from '../utils/applicationIdentity.js'
import {decorateJobsWithProviderMetadata} from '../providers/index.js'
import {DHAN_CATALOG} from '../../scraper/dhan/catalog.js'
import {encodeXML} from 'entities'
import {readCurrentBoard,readCurrentCorporate as readDentalCorporate,runCurrentDentalkart,BOARD_URL as DENTAL_BOARD,CAREERS_URL as DENTAL_CORPORATE} from '../../scraper/dentalkart/currentNative.js'
import {readCurrentWrapper,readCurrentPublicDocument,readCurrentEmbedClient,normalizeCurrentKekaJob,runCurrentDhan,BOARD_URL,ROOT_URL,ACTIVE_URL,PORTAL_URL,GROUP_URL,CLIENT_URL} from '../../scraper/dhan/currentNative.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C26/capture.json.gz',import.meta.url))))
const original=url=>{const row=capture.documents[url];assert.ok(row);return {status:row.status,url:row.finalUrl,headers:row.headers,body:row.body}}
const dental=original(DENTAL_BOARD).body,wrapper=original(BOARD_URL).body,docURL=readCurrentWrapper(wrapper).documentURL,publicDoc=original(docURL).body,client=original(CLIENT_URL).body
const roles=JSON.parse(original(ACTIVE_URL).body),portalInfo=JSON.parse(original(PORTAL_URL).body)
const jsonSHA=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const URL_TEST='https://native.invalid/careers',profile={source:'boundary',admitted:[[URL_TEST,'html']]}
const response=(body='original',{status=200,url=URL_TEST,mime='text/html'}={})=>{const result=new Response(body,{status,headers:{'content-type':mime}});Object.defineProperty(result,'url',{value:url});return result}
const withReader=async(options,body,config=profile)=>{const reader=createCurrentNativeReader(options,config);try{return await body(reader)}finally{reader.close()}}
test('native reader preserves original metadata and rejects body-only certificates',async()=>{
 await assert.rejects(()=>withReader({fetchText:async()=>''},reader=>reader.read(URL_TEST)),/metadata/)
 await assert.rejects(()=>withReader({fetchPage:async()=>({status:200,url:URL_TEST,body:'HTML'})},reader=>reader.read(URL_TEST)),/metadata/)
 const result=await withReader({fetchImpl:async(url,options)=>{assert.equal(url,URL_TEST);assert.equal(options.method,'GET');assert.equal(options.redirect,'manual');assert.equal(options.credentials,'omit');return response()}},reader=>reader.read(URL_TEST))
 assert.equal(result.body,'original');assert.equal(result.headers['content-type'],'text/html')
})
test('native reader validates original status, MIME, final URL and UTF8',async()=>{
 for(const options of [{status:403},{mime:'text/plain'},{url:'https://native.invalid/elsewhere'}])await assert.rejects(()=>withReader({fetchImpl:async()=>response('original',options)},reader=>reader.read(URL_TEST)))
 await assert.rejects(()=>withReader({fetchImpl:async()=>response(new Uint8Array([0xff]))},reader=>reader.read(URL_TEST)),/encoded data|encoding/i)
})
test('native renderer accepts its genuine text/js media type without relabeling HTML',async()=>{
 const result=await withReader({fetchImpl:async()=>response('literal program',{mime:'text/js'})},reader=>reader.read(URL_TEST),{source:'renderer',admitted:[[URL_TEST,'javascript']]})
 assert.equal(result.headers['content-type'],'text/js')
 await assert.rejects(()=>withReader({fetchImpl:async()=>response('<html></html>')},reader=>reader.read(URL_TEST),{source:'renderer',admitted:[[URL_TEST,'javascript']]}),/MIME/)
})
test('native reader rejects unadmitted URLs before transport and preserves pre-abort identity',async()=>{
 let calls=0;await assert.rejects(()=>withReader({fetchImpl:async()=>{calls++;return response()}},reader=>reader.read('https://unrelated.invalid/')),/Unbound/);assert.equal(calls,0)
 const controller=new AbortController(),reason={exact:'caller'};controller.abort(reason)
 await assert.rejects(()=>withReader({signal:controller.signal,fetchImpl:async()=>{calls++;return response()}},reader=>reader.read(URL_TEST)),error=>error===reason);assert.equal(calls,0)
})
test('native reader bounds streaming bytes and releases an overflowing stream',async()=>{
 let canceled=0;const stream=new ReadableStream({start(controller){controller.enqueue(new Uint8Array(16*1024*1024));controller.enqueue(new Uint8Array(1))},cancel(){canceled++}})
 await assert.rejects(()=>withReader({fetchImpl:async()=>response(stream)},reader=>reader.read(URL_TEST)),/byte budget/)
 assert.equal(canceled,1);assert.equal(stream.locked,false)
})
test('native request deadline settles a noncooperative fetch and cancels its late body',async()=>{
 let resolve,canceled=0;const pending=new Promise(done=>{resolve=done})
 await assert.rejects(()=>withReader({requestTimeoutMs:20,sourceTimeoutMs:500,fetchImpl:()=>pending},reader=>reader.read(URL_TEST)),error=>error.name==='TimeoutError')
 resolve(response(new ReadableStream({cancel(){canceled++}})));await new Promise(done=>setImmediate(done));assert.equal(canceled,1)
})
test('native source deadline bounds a noncooperative stream read',async()=>{
 let canceled=0;const stream=new ReadableStream({pull(){return new Promise(()=>{})},cancel(){canceled++}})
 await assert.rejects(()=>withReader({sourceTimeoutMs:20,fetchImpl:async()=>response(stream)},reader=>reader.read(URL_TEST)),error=>error.name==='TimeoutError')
 assert.equal(canceled,1);assert.equal(stream.locked,false)
})
test('native reader cancels and releases a reader acquired exactly as its caller aborts',async()=>{
 const controller=new AbortController(),reason={exact:'abort during native getReader'};let canceled=0
 const stream=new ReadableStream({cancel(received){assert.equal(received,reason);canceled++}}),getReader=stream.getReader.bind(stream)
 stream.getReader=()=>{const reader=getReader();controller.abort(reason);return reader}
 await assert.rejects(()=>withReader({signal:controller.signal,fetchImpl:async()=>response(stream)},reader=>reader.read(URL_TEST)),error=>error===reason)
 assert.equal(canceled,1);assert.equal(stream.locked,false)
})
test('Dentalkart cannot bind a hidden hiring link, body canonical or duplicate document identity',()=>{
 const corporate=original(DENTAL_CORPORATE).body
 for(const changed of [corporate.replace('href="'+DENTAL_BOARD+'"','hidden href="'+DENTAL_BOARD+'"'),corporate.replace('</body>','<link rel="canonical" href="'+DENTAL_CORPORATE+'"></body>'),corporate.replace('</body>','<html><head></head><body></body></html></body>')])assert.throws(()=>readDentalCorporate(changed))
})
test('Dentalkart cannot bind relocated, duplicate or delegated hidden data authority',()=>{
 const tag=dental.match(/<input[^>]*id="jobs"(?:[^>"']|"[^"]*"|'[^']*')*>/i)?.[0];assert.ok(tag)
 for(const changed of [dental.replace(tag,'<template>'+tag+'</template>'),dental.replace(tag,tag+tag),dental.replace(tag,tag.replace('id="jobs"','id="jobs" id="other"')),dental.replace('</head>','<base href="https://unrelated.invalid/"></head>')])assert.throws(()=>readCurrentBoard(changed))
})
test('Dentalkart original inline program cannot overwrite native jobs after initialization',()=>{
 const at=dental.lastIndexOf('</head>');assert.ok(at>0);assert.throws(()=>readCurrentBoard(dental.slice(0,at)+'<script>jobs=[];</script>'+dental.slice(at)),/program/i)
})
test('Keka wrapper rejects altered fetch methods, foreign tenant and appended program aliases',()=>{
 for(const changed of [wrapper.replace(".html')",".html', {method:'POST'})"),wrapper.replaceAll('7669ff3a-2b35-4442-9bac-9f9ae4b718b3','00000000-0000-4000-8000-000000000000'),wrapper.replace('</body>','<script>const alias=window;alias.khConfig={};</script></body>')]){assert.notEqual(changed,wrapper);assert.throws(()=>readCurrentWrapper(changed))}
})
test('Keka config/client reject changed scope, foreign config and arbitrary appended execution',()=>{
 assert.throws(()=>readCurrentPublicDocument(publicDoc.replace("domain: 'https://raise.keka.com/careers/'","domain: 'https://unrelated.invalid/careers/'"),docURL))
 assert.throws(()=>readCurrentEmbedClient(client+';eval("window.khConfig={}");'))
})
test('native country disagreements and multi-country worksites stay unresolved without city inference',()=>{
 const record=structuredClone(roles[0]);record.jobLocations=[{name:'Mumbai',city:'Mumbai',state:'MH',countryCode:'US',countryName:'India'}]
 let job=normalizeCurrentKekaJob(record,{portalInfo});assert.equal(job.country,null);assert.equal(job.sourceNativeCountryConflict,true)
 record.jobLocations=[{name:'Mumbai',city:'Mumbai',state:'MH',countryCode:null,countryName:null}]
 job=normalizeCurrentKekaJob(record,{portalInfo});assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true)
 record.jobLocations=[roles[0].jobLocations[0],{name:'US',city:'Boston',state:'MA',countryCode:'US',countryName:'United States'}]
 job=normalizeCurrentKekaJob(record,{portalInfo});assert.equal(job.country,null);assert.equal(job.sourceNativeCountryConflict,true);assert.equal(job.sourceNativeWorksites.length,2)
})
test('native hidden criteria cannot become a complete visible job',()=>{
 const record={...roles[0],description:'<div hidden>'+roles[0].description+'</div>'};assert.throws(()=>normalizeCurrentKekaJob(record,{portalInfo}),/hidden|incomplete/i)
})
test('Dentalkart closing native record drift withholds only the changed positive',async()=>{
 let reads=0;const jobs=await runCurrentDentalkart({fetchPage:async url=>{const page=original(url);if(url===DENTAL_BOARD&&++reads===2)page.body=page.body.replace('Customer Experience Specialist','Changed Customer Experience Specialist');return page}})
 assert.equal(jobs.length,9);assert.equal(jobs.nativeCollectionEvidence.openingClosingRecordsMatch,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(jobs.nativeCollectionEvidence.holds.some(row=>row.reason==='native-record-missing-unpublished-or-changed-at-closing'))
})
test('closing denial preserves bounded observations with explicit failed closing and no cleanup',async()=>{
 let reads=0;const jobs=await runCurrentDentalkart({fetchPage:async url=>{const page=original(url);if(url===DENTAL_BOARD&&++reads===2)return {...page,status:403,body:'denied'};return page}})
 assert.equal(jobs.length,10);assert.equal(jobs.nativeCollectionEvidence.closingFailure.status,403);assert.equal(jobs.nativeCollectionEvidence.closingReconciled,false)
 assert.ok(jobs.every(job=>job.lifecycleCleanupAllowed===false&&job.sourceClosingReconciled===false));assert.equal(readSourceObservationEvidence(jobs,'dentalkart').sourceScopeComplete,false)
})
test('closing invalid MIME is an authority failure rather than a successful partial certificate',async()=>{
 let reads=0;await assert.rejects(()=>runCurrentDentalkart({fetchPage:async url=>{const page=original(url);if(url===DENTAL_BOARD&&++reads===2)return {...page,headers:{...page.headers,'content-type':'text/plain'}};return page}}),/MIME/)
})
test('output limits apply after the full group cohort and criteria holds are inspected',async()=>{
 const jobs=await runCurrentDhan({maxJobs:1,fetchPage:async url=>original(url)})
 assert.equal(jobs.length,1);assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,31);assert.equal(jobs.nativeCollectionEvidence.incompleteCriteriaCount,1)
 assert.equal(jobs.nativeCollectionEvidence.outputLimited,true);assert.equal(jobs.nativeCollectionEvidence.unknownCountryCount,1);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('C26-R1 Dentalkart keeps a known locked closing role withheld after corporate503',async()=>{
 const latest=structuredClone(readCurrentBoard(dental).records),target=latest.find(row=>row.Publish&&!row.Is_Locked);target.Is_Locked=true
 const tag=dental.match(/<input[^>]*id="jobs"(?:[^>"']|"[^"]*"|'[^']*')*>/i)?.[0];assert.ok(tag)
 let boards=0,corporates=0
 const jobs=await runCurrentDentalkart({fetchPage:async url=>{const page=original(url)
  if(url===DENTAL_BOARD&&++boards===2)page.body=page.body.replace(tag,'<input type="hidden" id="jobs" value="'+encodeXML(JSON.stringify(latest))+'">')
  if(url===DENTAL_CORPORATE&&++corporates===2)return {...page,status:503,body:'upstream unavailable'};return page}})
 assert.equal(jobs.some(job=>job.sourceNativeJobId===target.id),false);assert.equal(jobs.length,9)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,false);assert.equal(jobs.nativeCollectionEvidence.closingFailure.status,503)
 assert.deepEqual(jobs.nativeCollectionEvidence.originalClosingRecords,latest)
})
test('C26-R1 Dhan keeps a known missing closing role withheld after group503',async()=>{
 let activeReads=0,groupReads=0;const target=roles[0].id
 const jobs=await runCurrentDhan({fetchPage:async url=>{const page=original(url)
  if(url===ACTIVE_URL&&++activeReads===2)page.body=JSON.stringify(roles.slice(1))
  if(url===GROUP_URL&&++groupReads===2)return {...page,status:503,body:'upstream unavailable'};return page}})
 assert.equal(jobs.some(job=>job.sourceNativeJobId===String(target)),false);assert.equal(jobs.length,29)
 assert.equal(jobs.nativeCollectionEvidence.closingReconciled,false);assert.equal(jobs.nativeCollectionEvidence.closingFailure.status,503)
 assert.equal(jsonSHA(jobs.nativeCollectionEvidence.originalClosingRecords),jsonSHA(roles.slice(1)))
})
test('C26-R2 Keka original document rejects a new body event program',()=>{
 const changed=publicDoc.replace(/<body(?=[\s>])/i,'<body onload="window.khConfig.domain=\'https://unrelated.invalid/careers/\'"')
 assert.notEqual(changed,publicDoc);assert.throws(()=>readCurrentPublicDocument(changed,docURL))
})
test('C26-R2 Keka wrapper rejects delegated iframe srcdoc programs',()=>{
 const changed=wrapper.replace('</body>','<iframe srcdoc="&lt;script&gt;parent.khConfig={domain:\'https://unrelated.invalid/careers/\'};&lt;/script&gt;"></iframe></body>')
 assert.notEqual(changed,wrapper);assert.throws(()=>readCurrentWrapper(changed))
})
test('C26-R2 Dentalkart outer body rejects a new event program',()=>{
 const at=dental.lastIndexOf('<body');assert.ok(at>0)
 const changed=dental.slice(0,at)+dental.slice(at).replace(/<body(?=[\s>])/i,'<body onload="jobs=[]"')
 assert.notEqual(changed,dental);assert.throws(()=>readCurrentBoard(changed))
})
test('C26-R3 pacing cancellation preserves the exact caller reason',async()=>{
 const controller=new AbortController(),reason={exact:'caller while pacing'};let requests=0
 await withReader({signal:controller.signal,fetchImpl:async()=>{requests++;return response()}},async reader=>{
  await reader.read(URL_TEST);const pending=reader.read(URL_TEST);setTimeout(()=>controller.abort(reason),20)
  await assert.rejects(()=>pending,error=>error===reason)
 });assert.equal(requests,1)
})
test('C26-R3 source deadline during pacing remains a TimeoutError',async()=>{
 let requests=0
 await withReader({sourceTimeoutMs:100,fetchImpl:async()=>{requests++;return response()}},async reader=>{
  await reader.read(URL_TEST);await assert.rejects(()=>reader.read(URL_TEST),error=>error.name==='TimeoutError')
 });assert.equal(requests,1)
})
test('C26-R4 provider metadata preserves explicit unknown native group employer domain',()=>{
 const job=normalizeCurrentKekaJob(roles[0],{portalInfo}),[decorated]=decorateJobsWithProviderMetadata([job],DHAN_CATALOG)
 assert.equal(job.companyDomain,null);assert.equal(decorated.companyDomain,null);assert.equal(decorated.company,'Raise holding');assert.equal(decorated.sourceExactBrandRoleScopeVerified,false)
 const [absent]=decorateJobsWithProviderMetadata([{title:'Role'}],DHAN_CATALOG);assert.equal(absent.companyDomain,'dhan.co')
 const [explicit]=decorateJobsWithProviderMetadata([{title:'Role',companyDomain:'native-employer.example'}],DHAN_CATALOG);assert.equal(explicit.companyDomain,'native-employer.example')
})
test('C26-review baseline generic board entries retain distinct native application identities',()=>{
 const active=readCurrentBoard(dental).records.filter(row=>row.Publish&&!row.Is_Locked)
 const a={...active[0]},b={...active[1],Posting_Title:active[0].Posting_Title,City:active[0].City,State:active[0].State}
 return import('../../scraper/dentalkart/currentNative.js').then(({normalizeCurrentDentalkartRecord:normalize})=>{
  const first=normalize(a),second=normalize(b);assert.equal(first.applyUrl,second.applyUrl);assert.notEqual(generateFingerprint(first),generateFingerprint(second));assert.equal(first.requisitionId,null)
 })
})
test('C26-review baseline explicit foreign and unknown native countries never inherit Mumbai country',()=>{
 const place={name:'Mumbai',city:'Mumbai',state:'Maharashtra',countryCode:'CA',countryName:'Canada'}
 const foreign=normalizeCurrentKekaJob({...roles[0],jobLocations:[place]},{portalInfo}),unknown=normalizeCurrentKekaJob({...roles[0],jobLocations:[{...place,countryCode:'ZZ',countryName:'Unknown'}]},{portalInfo})
 assert.equal(foreign.country,'Canada');assert.equal(unknown.country,null);assert.equal(unknown.sourceCountryScopeUnresolved,true)
})
