import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {CEIPAL_WIDGET_URL} from './script.js'
import {createComvivaScraper} from './script.js'
import {createPublicReader} from './publicRead.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261113/current-native.json.gz',import.meta.url))))
const packets=new Map(fixture.packets.map(packet=>[packet.requestedURL,packet]))
const hash=value=>createHash('sha256').update(value).digest('hex')
for(const packet of fixture.packets){const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(bytes.length,packet.bodyBytes);assert.equal(hash(bytes),packet.bodySHA256)}
const careers='https://www.comviva.com/careers/explore-opportunity/'
const key='VkZUbnpKcFNPaUFzWitxQUNzU25sZz09',cp='Z3RkUkt2OXZJVld2MjFpOVRSTXoxZz09'
const api='https://careerapi.ceipal.com/'+key+'/CareerPortalJobPostings/'
const countriesURL='https://careerapi.ceipal.com/'+key+'/CareerPortalCountries/'
const statesURL='https://careerapi.ceipal.com/'+key+'/CareerPortalStates/?country=356'
const body=url=>Buffer.from(packets.get(url===CEIPAL_WIDGET_URL?url+'&job_id=':url).bodyBase64,'base64').toString('utf8')
const registered=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='comviva'))
function replay(change=(value)=>value){const calls=[],seen=new Map();return{calls,options:{now:()=>fixture.capturedAt,fetchText:async(url,options={})=>{
 calls.push({url,method:options.method||'GET',headers:options.headers,body:options.body,signal:options.signal})
 assert.ok(packets.has(url)||url===CEIPAL_WIDGET_URL,'only actual declared native reads '+url)
 const index=seen.get(url)||0;seen.set(url,index+1);return change(body(url),url,index,options)
}}}}

test('registered Comviva retains every actual native model and individually qualified candidate while corporate rendering remains held',async()=>{
 const {calls,options}=replay(),jobs=await registered().run(options)
 assert.equal(jobs.length,0,'unreviewed corporate programs and styles cannot qualify public availability')
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.sourceNativeRaw.length,159);assert.equal(audit.nativeIndiaDetailProofs.length,150)
 assert.equal(audit.intrinsicallyQualifiedIndiaCount,63);assert.equal(audit.individuallyUnqualifiedIndiaCount,87)
 assert.equal(audit.publisherBlockedIndiaCount,63);assert.equal(audit.withheldIndiaCount,150)
 assert.equal(audit.nativeIndiaDetailProofs.find(row=>row.jobCode==='4528').nativeComplete,true)
 assert.equal(audit.nativeIndiaDetailProofs.find(row=>row.jobCode==='4340').nativeComplete,false,'a four-byte original JD cannot qualify from common overview')
 assert.ok(audit.nativeIndiaDetailProofs.every(row=>!row.complete&&!row.openingProof.application.activePublicUI))
 assert.equal(audit.sourceNativeRaw.filter(row=>row.country==='India').length,150)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.ok(audit.nativeIndiaDetailProofs.every(row=>row.openingNativeDetail&&row.closingNativeDetail))
 assert.equal(calls.filter(call=>call.method==='POST').length,16)
 assert.ok(calls.filter(call=>call.method==='POST').every(call=>/^https:\/\/careerapi\.ceipal\.com\/[^/]+\/CareerPortalJobPostings\/\?page=[1-8]$/.test(call.url)))
 assert.equal(readSourceObservationEvidence(jobs,'comviva').observedRecordCount,159)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 const role=audit.nativeIndiaDetailProofs.find(row=>row.jobCode==='4528'),detail=JSON.parse(body(api+audit.sourceNativeRaw.find(row=>row.job_code==='4528').id+'/?from_career_portal=1&cp_id='+cp))
 assert.deepEqual(role.openingNativeDetail,detail);assert.deepEqual(role.closingNativeDetail,detail)
 assert.equal(role.openingNativeDetail.custom_fields.is_ijp_job,'True')
 assert.equal(role.openingProof.application.submissionAttempted,false)
})

// Adverse cases below are labelled controls built from one unchanged real
// native role. The reduced, coherent one-page envelope is synthetic; it does
// not claim that the actual employer board contains only one vacancy.
const firstNative=JSON.parse(body(api+'?page=1')).results[0]
const firstDetail=api+firstNative.id+'/?from_career_portal=1&cp_id='+cp
function control(change=(value)=>value,rows=[firstNative]){
 return replay((value,url,index,init)=>{
  if(url===api+'?page=1')value=JSON.stringify({...JSON.parse(value),count:rows.length,num_pages:1,page_count:rows.length,next:null,results:structuredClone(rows)})
  return change(value,url,index,init)
 })
}
const editDetail=(value,url,edit)=>{if(url!==firstDetail)return value;const parsed=JSON.parse(value);edit(parsed);return JSON.stringify(parsed)}

test('actual visible company overview is preserved before the original role JD in publisher order',async()=>{
 const {options}=control(),jobs=await registered().run(options),detail=JSON.parse(body(firstDetail))
 const doc=readNativeDocument(detail.overview_final_data.subject),overview=doc.text(doc.nodes(node=>node.tag==='root')[0]).replace(/\s+/g,' ').trim()
 const proof=jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0]
 assert.ok(overview.length>1000)
 assert.equal(proof.nativeComplete,true)
 assert.ok(proof.openingProof.renderedDescription.startsWith(overview),'the actual publisher overview must precede the original job criteria')
 assert.ok(proof.openingProof.renderedDescription.indexOf('Key Responsibilities')>overview.length)
 assert.equal(proof.openingNativeDetail.public_job_desc,detail.public_job_desc)
})

test('required applicant country/state controls bind the actual current declared public lookups',async()=>{
 const {calls,options}=control(),jobs=await registered().run(options)
 assert.equal(calls.filter(call=>call.url===countriesURL).length,2)
 assert.equal(calls.filter(call=>call.url===statesURL).length,2)
 assert.equal(jobs.length,0)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.openingApplicationLookups.countries.length,249)
 assert.equal(audit.openingApplicationLookups.states.length,36)
 assert.equal(audit.openingApplicationLookups.complete,true)
 assert.equal(audit.openingApplicationLookups.india.id,356)
 assert.equal(audit.closingApplicationLookups.complete,true)
 assert.equal(audit.nativeIndiaDetailProofs[0].nativeComplete,true)
 assert.equal(audit.nativeIndiaDetailProofs[0].openingProof.application.requiredApplicantControlsQualified,true)
 assert.equal(audit.nativeIndiaDetailProofs[0].openingProof.country.method,'matching-role-owned-native-list-and-detail-country-for-all-native-alternatives')
})

for(const [name,change]of [
 ['missing applicant countries',(value,url)=>url===countriesURL?'[]':value],
 ['missing required applicant states',(value,url)=>url===statesURL?'[]':value],
 ['foreign required applicant states',(value,url)=>url===statesURL?JSON.stringify(JSON.parse(value).map(row=>({...row,country:'United Kingdom'}))):value],
 ['unreviewed applicant lookup restriction',(value,url)=>url===countriesURL?JSON.stringify(JSON.parse(value).map(row=>({...row,employee_only:true}))):value],
 ['explicit employee-only public lookup restriction',(value,url)=>{if(url!==countriesURL)return value;const rows=JSON.parse(value);rows[0].name='Current employees only';return JSON.stringify(rows)}],
 ['closing required applicant controls drift',(value,url,index)=>url===statesURL&&index?JSON.stringify(JSON.parse(value).slice(1)):value],
])test(name+' withholds roles while preserving full native vacancy observations',async()=>{
 const {options}=control(change),jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,1)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].complete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].nativeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingNativeDetail.job_code,'4528')
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 if(name.startsWith('closing'))assert.equal(jobs.nativeCollectionEvidence.openingClosingMatched,false)
})

test('native request preserves the complete unfiltered form, duplicate state and published public XHR context',async()=>{
 const {calls,options}=control(),jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].nativeComplete,true)
 const searches=calls.filter(call=>call.method==='POST');assert.equal(searches.length,2)
 for(const call of searches){
  const fields=[...call.body.matchAll(/name="([^"]+)"\r\n\r\n([^\r]*)\r\n/g)].map(match=>[match[1],match[2]])
  assert.equal(fields.length,26);assert.equal(fields.filter(([key])=>key==='state').length,2)
  assert.deepEqual(fields.slice(-5),[['page','1'],['api_key',key],['method','CareerPortalJobPostings'],['cp_id',cp],['from_career_portal','1']])
  assert.ok(fields.slice(1,-5).every(([,value])=>value===''))
 }
 for(const call of calls.filter(call=>call.url.startsWith(api))){assert.equal(call.headers.Origin,'https://jobsapi.ceipal.com');assert.equal(call.headers.Referer,CEIPAL_WIDGET_URL);assert.equal(call.headers['User-Agent'],'Mozilla/5.0')}
 assert.ok(!calls.some(call=>/ApplyJob|Registration|Resume|\/login\//.test(call.url)))
})

for(const [name,markup]of [
 ['offscreen','<p style="position:fixed;left:-9999px">Mandatory security clearance.</p>'],
 ['negative-margin','<p style="margin-left:-9999px">Mandatory security clearance.</p>'],
 ['transparent','<p style="color:transparent">Mandatory security clearance.</p>'],
 ['inert-script','<script type="application/json">Mandatory security clearance.</script>'],
 ['hidden-attribute','<p hidden>Mandatory security clearance.</p>'],
 ['unreviewed-class','<p class="hidden-criteria">Mandatory security clearance.</p>'],
])test('full original '+name+' native criteria are retained and withheld',async()=>{
 const {options}=control((value,url)=>editDetail(value,url,detail=>{detail.public_job_desc+=markup}))
 const jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].complete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingProof.complete,false)
 assert.match(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingNativeDetail.public_job_desc,/Mandatory security clearance/)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

for(const [name,edit]of [
 ['four-byte JD with long common overview',detail=>{detail.public_job_desc='test'}],
 ['missing original JD',detail=>{delete detail.public_job_desc}],
 ['unknown native criterion',detail=>{detail.security_clearance='Mandatory'}],
 ['unknown custom criterion',detail=>{detail.custom_fields.mandatory_criterion='Current employees only'}],
 ['missing country despite applicant India options',detail=>{delete detail.country}],
 ['foreign country despite applicant India options',detail=>{detail.country='United Kingdom'}],
 ['retired public application',detail=>{detail.apply_with_out_registration=0}],
 ['unknown required field',detail=>{detail.form_fields.standard_fields.push({key:'security_clearance',label:'Mandatory clearance',type:'text',is_required:1})}],
 ['readonly required field',detail=>{detail.form_fields.standard_fields[0].readonly=true}],
 ['disabled required field',detail=>{detail.form_fields.standard_fields[0].disabled=true}],
 ['offscreen required field',detail=>{detail.form_fields.standard_fields[0].style='position:fixed;left:-9999px'}],
 ['missing required schema',detail=>{delete detail.form_fields}],
 ['foreign native employer',detail=>{detail.company_url='foreign.example'}],
 ['foreign application URL',detail=>{detail.apply_job='https://foreign.example/application'}],
 ['unknown native question',detail=>{detail.job_posting_questions.push({label:'Mandatory security clearance'})}],
 ['hidden changed overview',detail=>{detail.overview_final_data.subject+='<p hidden>Mandatory security clearance.</p>'}],
 ['unknown pay criteria',detail=>{detail.pay_rates[0].unreviewed_condition='Mandatory'}],
 ['explicit current employee restriction',detail=>{detail.public_job_desc+='<p>Current employees only.</p>'}],
])test('Comviva withholds '+name+' while retaining the complete native observation',async()=>{
 const {options}=control((value,url)=>editDetail(value,url,edit)),jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,1)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].complete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingProof.complete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

test('native alternatives with an explicit foreign country contradict the India carrier',async()=>{
 const changed={...firstNative,multpile_job_location:'(London, United Kingdom)'}
 const {options}=control((value,url)=>editDetail(value,url,detail=>{detail.multpile_job_location=changed.multpile_job_location}),[changed])
 const jobs=await registered().run(options);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].nativeComplete,false)
})

test('volatile native login ciphertext rotation does not change same-job public form identity',async()=>{
 const {options}=control((value,url,index)=>{
  if(!index||!url.startsWith(api))return value
  const parsed=JSON.parse(value)
  if(url===api+'?page=1')parsed.results[0].apply_job_login=parsed.results[0].apply_job_login.slice(0,-1)+'x'
  if(url===firstDetail)for(const key of ['apply_job','apply_job_login','easy_apply_job_login_hc'])parsed[key]=parsed[key].slice(0,-1)+'x'
  return url.startsWith(api)?JSON.stringify(parsed):value
 })
 const jobs=await registered().run(options);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].nativeComplete,true)
})

test('closing original criteria change withholds the role despite unchanged listing identity',async()=>{
 const {options}=control((value,url,index)=>index?editDetail(value,url,detail=>{detail.public_job_desc+='<p>New mandatory closing requirement.</p>'}):value)
 const jobs=await registered().run(options);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].stableNativeRole,false)
})

test('duplicate native inventory identity fails before any detail can be published',async()=>{
 const {options}=control(value=>value,[firstNative,firstNative])
 await assert.rejects(registered().run(options),/duplicate|identity/)
})

test('original native page budget cannot silently truncate current declared pagination',async()=>{
 const {options}=replay();await assert.rejects(createComvivaScraper({maxPages:1}).run(options),/page budget/)
})

for(const kind of ['empty','foreign','missing-country'])test(kind+' native inventory preserves all observations and company cleanup hold',async()=>{
 const rows=kind==='empty'?[]:[{...firstNative,country:kind==='foreign'?'United Kingdom':undefined}]
 const {options}=control(value=>value,rows),jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,rows.length)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false);assert.equal(readSourceObservationEvidence(jobs,'comviva').sourceScopeComplete,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

for(const target of ['https://jobsapi.ceipal.com/APISource/widget.js','https://jobsapi.ceipal.com/APISource/v2/js/app.min.js','https://jobsapi.ceipal.com/APISource/v2/css/custom.css'])test('changed declared contract is rejected: '+target,async()=>{
 const {options}=control((value,url)=>url===target?value+'\n/* changed current program or stylesheet */':value)
 await assert.rejects(registered().run(options),/program|renderer|stylesheet/)
})

test('current employer handoff cannot change its native company identifier',async()=>{
 const {options}=control((value,url)=>url===careers?value.replace('data-ceipal-api-key="'+key+'"','data-ceipal-api-key="foreign"'):value)
 await assert.rejects(registered().run(options),/employer identifiers/)
})

test('retired current corporate handoff cannot revive stale historical job markup',async()=>{
 const {options}=control((value,url)=>url===careers?value.replace(/<script\b[^>]*src="https:\/\/jobsapi\.ceipal\.com\/APISource\/widget\.js"[^>]*><\/script>/,''):value)
 await assert.rejects(registered().run(options),/publisher handoff/)
})

for(const attribute of ['readonly','disabled','hidden','style="position:fixed;left:-9999px"'])test('changed '+attribute+' native application shell is unqualified',async()=>{
 const {options}=control((value,url)=>url===CEIPAL_WIDGET_URL+'&job_id='?value.replace('id="apply_with_application_form"',attribute+' id="apply_with_application_form"'):value)
 await assert.rejects(registered().run(options),/application shell/)
})

test('closing native country membership cannot drift silently',async()=>{
 const {options}=control((value,url,index)=>{if(url!==api+'?page=1'||!index)return value;const parsed=JSON.parse(value);parsed.results[0].country='United Kingdom';return JSON.stringify(parsed)})
 await assert.rejects(registered().run(options),/closing full native inventory/)
})

test('duplicate native detail country cannot erase a conflicting original country',async()=>{
 const {options}=control((value,url)=>url===firstDetail?value.replace('"country":"India"','"country":"United Kingdom","country":"India"'):value)
 const jobs=await registered().run(options);assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].complete,false)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].nativeComplete,false)
})

test('duplicate native listing country cannot erase a conflicting original country',async()=>{
 const {options}=control((value,url)=>url===api+'?page=1'?value.replace('"country":"India"','"country":"United Kingdom","country":"India"'):value)
 await assert.rejects(registered().run(options),/duplicate.*key/)
})

test('an explicit zero remaining positions cannot qualify as an active native vacancy',async()=>{
 const {options}=control((value,url)=>editDetail(value,url,detail=>{detail.number_of_positions=0}))
 const jobs=await registered().run(options);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingProof.complete,false)
})

test('explicit native access denial stops the source instead of continuing all role reads',async()=>{
 const {options,calls}=control((value,url)=>{if(url===firstDetail)throw Object.assign(Error('explicit HTTP403'),{status:403});return value})
 await assert.rejects(registered().run(options),/HTTP403/)
 assert.equal(calls.filter(call=>call.url===firstDetail).length,1)
})

test('cancellation after a native read prevents subsequent source work',async()=>{
 const controller=new AbortController(),reason={cancel:'comviva'},calls=[]
 await assert.rejects(registered().run({signal:controller.signal,fetchText:async(url)=>{calls.push(url);controller.abort(reason);return body(careers)}}),error=>error===reason)
 assert.equal(calls.length,1)
})

test('public native response byte budget cancels the underlying reader',async()=>{
 let cancelled=false
 const reader=createPublicReader({fetchImpl:async()=>new Response(new ReadableStream({start(controller){controller.enqueue(new Uint8Array(4000001))},cancel(){cancelled=true}}),{headers:{'Content-Type':'application/json'}})},[])
 await assert.rejects(reader(api+'?page=1'),/byte budget/);assert.equal(cancelled,true)
})

test('an unqualified native response cancels its public response body',async()=>{
 let cancelled=false
 const reader=createPublicReader({fetchImpl:async()=>new Response(new ReadableStream({cancel(){cancelled=true}}),{status:403,headers:{'Content-Type':'application/json'}})},[])
 await assert.rejects(reader(api+'?page=1'),/status/);assert.equal(cancelled,true)
})

for(const [name,change]of [
 ['offscreen corporate body',html=>html.replace('<body ','<body style="position:fixed;left:-9999px" ')],
 ['corporate stylesheet hiding the body',html=>html.replace('</head>','<style>body{position:fixed;left:-9999px!important}</style></head>')],
 ['new corporate body class',html=>html.replace('<body class="','<body class="hidden-native-publisher ')],
 ['hidden raw corporate style',html=>html.replace('</head>','<style hidden>body{display:none}</style></head>')],
 ['inert raw corporate stylesheet',html=>html.replace('</head>','<template><link rel="stylesheet" href="/hide-publisher.css"></template></head>')],
 ['preloaded corporate stylesheet',html=>html.replace('</head>','<link rel="preload" as="style" href="/hide-publisher.css"/></head>')],
])test(name+' cannot qualify the public application while native models remain auditable',async()=>{
 const {options}=control((value,url)=>url===careers?change(value):value),jobs=await registered().run(options)
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,1)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingNativeDetail.job_code,'4528')
 assert.equal(jobs.nativeCollectionEvidence.openingSurface.publisher.complete,false)
 assert.equal(jobs.nativeCollectionEvidence.openingSurface.publisher.contextMatched,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

test('the actual five unreviewed corporate styles cannot establish current public UI availability',async()=>{
 const {options}=control(),jobs=await registered().run(options)
 assert.equal(jobs.length,0)
 assert.equal(jobs.nativeCollectionEvidence.openingSurface.publisher.stylesheets.length,5)
 assert.equal(jobs.nativeCollectionEvidence.openingSurface.publisher.complete,false)
 assert.equal(jobs.nativeCollectionEvidence.openingSurface.publisher.contextMatched,true)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingProof.application.activePublicUI,false)
})

test('a closing corporate visibility change withholds publication while retaining both native detail models',async()=>{
 const {options}=control((value,url,index)=>url===careers&&index?value.replace('<body ','<body style="position:fixed;left:-9999px" '):value)
 const jobs=await registered().run(options),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(audit.sourceNativeRaw.length,1)
 assert.equal(audit.nativeIndiaDetailProofs[0].nativeComplete,true)
 assert.equal(audit.nativeIndiaDetailProofs[0].openingNativeDetail.job_code,'4528')
 assert.equal(audit.nativeIndiaDetailProofs[0].closingNativeDetail.job_code,'4528')
 assert.equal(audit.publisherOpeningClosingMatched,false)
 assert.equal(audit.openingClosingMatched,false)
 assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
})

for(const [name,edit]of [
 ['native title stylesheet',value=>{value.public_job_title+='<style>.job_description{display:none}</style>'}],
 ['native title hidden markup',value=>{value.public_job_title+='<span hidden>Mandatory security clearance.</span>'}],
 ['listing preview stylesheet',value=>{value.public_job_desc+='<style>.job_description{display:none}</style>'}],
 ['listing preview offscreen text',value=>{value.public_job_desc+='<p style="position:fixed;left:-9999px">Mandatory security clearance.</p>'}],
 ['listing location HTML',value=>{value.multpile_job_location+='<style>.job_description{display:none}</style>'}],
 ['listing tax terms HTML',value=>{value.tax_terms='<style>.job_description{display:none}</style>'}],
])test(name+' is retained but cannot qualify a native role',async()=>{
 const rows=[structuredClone(firstNative)];edit(rows[0])
 const {options}=control((value,url)=>editDetail(value,url,detail=>{if(name.startsWith('native title'))detail.public_job_title=rows[0].public_job_title}),rows)
 const jobs=await registered().run(options),proof=jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0]
 assert.equal(proof.openingProof.complete,false)
 assert.equal(proof.openingProof.application.activePublicUI,false)
 assert.equal(jobs.length,0)
 assert.deepEqual(jobs.nativeCollectionEvidence.sourceNativeRaw[0],rows[0])
})

for(const stage of ['fetchText','fetch','body','arrayBuffer'])test('caller cancellation settles an uncooperative '+stage+' read and cancels an acquired body',async()=>{
 const controller=new AbortController(),reason={cancel:stage};let finish,cancelled=false
 const neverUntilCleanup=()=>new Promise(resolve=>{finish=resolve})
 const options={signal:controller.signal}
 if(stage==='fetchText')options.fetchText=neverUntilCleanup
 else if(stage==='fetch')options.fetchImpl=neverUntilCleanup
 else if(stage==='body')options.fetchImpl=async()=>({status:200,url:api,headers:new Headers({'Content-Type':'application/json'}),body:{getReader:()=>({read:neverUntilCleanup,cancel:async()=>{cancelled=true;finish({done:true})},releaseLock(){}})}})
 else options.fetchImpl=async()=>({status:200,url:api,headers:new Headers({'Content-Type':'application/json'}),body:{cancel:async()=>{cancelled=true}},arrayBuffer:neverUntilCleanup})
 const read=createPublicReader(options,[]),pending=read(api).then(()=>({resolved:true}),error=>({error}))
 await new Promise(resolve=>setTimeout(resolve,10));controller.abort(reason)
 let timer
 try{
  const result=await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve({stalled:true}),100)})])
  assert.equal(result.error,reason)
  if(stage==='body'||stage==='arrayBuffer')assert.equal(cancelled,true)
 }finally{clearTimeout(timer);finish(stage==='fetchText'?'{}':stage==='fetch'?new Response('{}',{headers:{'Content-Type':'application/json'}}):{done:true});await pending}
})

test('a foreign listing CSS payload holds the shared native renderer before a healthy India sibling can qualify',async()=>{
 const foreign={...firstNative,id:'synthetic_foreign_native_id',job_code:'999999',country:'United Kingdom',public_job_desc:'<style>.job_description{display:none}</style>'}
 const {options}=control(value=>value,[firstNative,foreign]),jobs=await registered().run(options)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.sourceNativeRaw.length,2)
 assert.equal(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].nativeComplete,false)
 assert.ok(jobs.nativeCollectionEvidence.nativeIndiaDetailProofs[0].openingProof.holds.includes('unqualified-shared-native-listing-render-context'))
})

test('original public read deadline settles a transport that ignores its signal',async()=>{
 let finish,timer
 const pending=createPublicReader({fetchText:()=>new Promise(resolve=>{finish=resolve})},[])(api).then(()=>({resolved:true}),error=>({error}))
 try{
  const result=await Promise.race([pending,new Promise(resolve=>{timer=setTimeout(()=>resolve({stalled:true}),16000)})])
  assert.match(result.error?.message||'',/public read timeout/)
 }finally{clearTimeout(timer);finish('{}');await pending}
})
