import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test,{mock} from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {createSorocoScraper} from './script.js'
import {parse} from 'acorn'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readSorocoListing,readSorocoDetail} from './currentNative.js'
import {CURRENT_SOROCO_PROFILE} from './currentProfile.js'

const current=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261114.json.gz',import.meta.url))))
const rows=JSON.parse(Buffer.from(current.captures.find(row=>row.requestUrl.includes('/Job_Openings?')).bodyBase64,'base64')).data
const source=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='soroco'))
function transport(change=()=>{}){
 const packets=structuredClone(current.captures),counts=new Map(),calls=[]
 return{calls,fetchImpl:async(url,init={})=>{
  const row=structuredClone(packets.find(packet=>packet.requestUrl===url));assert.ok(row,'Unexpected original public request '+url)
  const phase=counts.get(url)||0;counts.set(url,phase+1);change(row,phase)
  calls.push({url,method:init.method||'GET',signal:init.signal})
  const response=new Response(Buffer.from(row.bodyBase64,'base64'),{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalUrl});return response
 }}
}
async function run(change,options={}){
 const wire=transport(change),nativeFetch=mock.method(globalThis,'fetch',wire.fetchImpl)
 try{return{jobs:await source().run({fetchImpl:wire.fetchImpl,now:()=>current.capturedAt,...options}),calls:wire.calls}}
 finally{nativeFetch.mock.restore()}
}

test('registered current Soroco retains two exact native India full roles and original native dates',async()=>{
 const {jobs,calls}=await run()
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(row=>row.jobId),rows.map(row=>row.id))
 for(const job of jobs){
  const row=rows.find(row=>row.id===job.jobId)
  assert.equal(job.company,'Soroco');assert.equal(job.country,'India')
  assert.equal(job.sourceNativeListingRecord.Job_Description,row.Job_Description)
  assert.equal(job.sourceNativeDetailRecord.Country,'India')
  assert.equal(job.sourceNativeDetailRecord.Zip_Code,'560078')
  assert.equal(job.sourceDescriptionHTML,job.sourceNativeDetailRecord.Job_Description)
  assert.equal(job.sourceDescription,job.sourceNativeDetailRecord.Job_Description)
  assert.equal(job.jobDescription,job.sourceNativeDetailRecord.Job_Description)
  assert.ok(job.sourceDescriptionHTML.length>job.sourceNativeListingRecord.Job_Description.length)
  assert.ok(job.sourceDescription.length>300&&job.sourceDetailComplete)
  assert.equal(job.nativePublicationDateProvenance,'original-public-Zoho-Date_Opened')
  assert.equal(job.nativeFirstEverPublicationUnverified,true)
  assert.equal(job.postingDate,job.sourceNativeDetailRecord.Date_Opened)
  assert.equal(job.sourceClosingReconciled,true)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.activationVerified,false)
  assert.equal(job.link,row.$url);assert.equal(job.applyUrl,row.$url)
 }
 assert.deepEqual(jobs.map(row=>row.postingDate),['2026-08-17','2026-08-26'])
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(calls.every(call=>call.method==='GET'))
 assert.ok(calls.every(call=>!call.url.includes('/apply')&&!call.url.includes('candidatedetail')))
 assert.equal(calls.length,24)
})

test('legacy city-only title brief cannot be emitted as a current India vacancy',async()=>{
 const legacy='<html><head><title>Grow with Soroco</title></head><body><a href="/all-job-openings/">View Career Opportunities</a><div id="job-title"><span class="elementor-heading-title">Account Based Marketing Manager</span><span class="elementor-heading-title">Bangalore</span><a href="#">Apply</a></div></body></html>'
 await assert.rejects(createSorocoScraper().run({fetchText:async()=>legacy}),/Original HTTP metadata is required/)
})

const packet=url=>{const value=current.captures.find(row=>row.requestUrl===url);assert.ok(value,url);return value}
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const replace=(row,body)=>{row.bodyBase64=Buffer.from(body).toString('base64')}
const api=current.captures.find(row=>row.requestUrl.includes('/Job_Openings?')).requestUrl
const rawList=()=>JSON.parse(text(packet(api)))
const nativeBody=()=>text(packet(rows[0].$url))
const astValue=node=>node.type==='Literal'?node.value:node.type==='ArrayExpression'?node.elements.map(astValue)
 :Object.fromEntries(node.properties.map(field=>[field.key.name??field.key.value,astValue(field.value)]))
function changeBinding(html,name,change){
 const scripts=readNativeDocument(html).nodes(node=>node.tag==='script'&&!node.attrs.src&&node.raw?.includes('var jobs = JSON.parse'))
 assert.equal(scripts.length,1)
 const program=scripts[0].raw,ast=parse(program,{ecmaVersion:'latest'}),declaration=ast.body.filter(node=>node.type==='VariableDeclaration').flatMap(node=>node.declarations).find(node=>node.id.name===name)
 assert.ok(declaration,name)
 const expression=declaration.init
 const value=name==='jobs'?JSON.parse(expression.arguments[0].value):astValue(expression)
 change(value)
 const newValue=JSON.stringify(value),replacement=name==='jobs'?'JSON.parse('+JSON.stringify(newValue)+')':newValue
 const updated=program.slice(0,expression.start)+replacement+program.slice(expression.end)
 assert.equal(html.split(program).length,2)
 return html.replace(program,updated)
}
function nativeMutation(change,name='jobs'){
 return changeBinding(nativeBody(),name,value=>change(name==='jobs'?value[0]:value))
}
async function held(change,reason){
 await assert.rejects(run(change),reason)
}

test('current Soroco rejects unreviewed complete listing field declarations',()=>{
 const payload=rawList();payload.info.fields.push({api_name:'Unreviewed_Country_Control',field_label:'Worksite country'})
 assert.throws(()=>readSorocoListing(JSON.stringify(payload)),/Native listing metadata changed/)
})
for(const[name,change,reason]of[
 ['foreign country',r=>{r.Country='United States'},/Country mismatch/],
 ['conflicting state',r=>{r.State='Unreviewed state'},/State mismatch/],
 ['different native ID',r=>{r.id='836634999999999999'},/id mismatch/],
 ['unpublished detail',r=>{r.Publish=false},/Publish mismatch/],
 ['locked detail',r=>{r.Is_Locked=true},/Is_Locked mismatch/],
 ['missing native postal field',r=>{delete r.Zip_Code},/full role field schema changed/],
 ['unknown renderer state',r=>{r.$read_only_job=true},/full role field schema changed/],
 ['title-only criteria',r=>{r.Job_Description='<p>'+r.Posting_Title+'</p>'},/full original role criteria unavailable/],
 ['description carrier drift',r=>{r.Job_Description+='<p>Additional required experience.</p>'},/complete criteria carriers disagree/],
 ['hidden original criteria',r=>{r.Job_Description='<div hidden>'+r.Job_Description+'</div>'},/hidden or incomplete/],
 ['delegated criteria',r=>{r.Job_Description+='<iframe src="https://soroco.com/criteria"></iframe>'},/Delegated or executable/],
 ['explicit closed notice',r=>{r.Job_Description+='<p>This position has been filled.</p>'},/Explicit native closed role notice/],
 ['date drift',r=>{r.Date_Opened='2026-08-18'},/Date_Opened mismatch/],
 ['invalid date',r=>{r.Date_Opened='2026-02-30'},/Impossible native Date_Opened/],
])test('original Soroco full detail rejects '+name,()=>{
 assert.throws(()=>readSorocoDetail(nativeMutation(change),rows[0]),reason)
})
for(const[name,binding,change,reason]of[
 ['different employer','meta',v=>{v.org_info.company_name='Different Company'},/employer\/public detail metadata changed/],
 ['parent remap','meta',v=>{v.org_info.type='external'},/employer\/public detail metadata changed/],
 ['different tenant handoff','meta',v=>{v.detail_url=v.detail_url.replace('soroco.zohorecruit.com','foreign.zohorecruit.com')},/employer\/public detail metadata changed/],
 ['authenticated page state','meta',v=>{v.portal_user.is_loggedin=true},/employer\/public detail metadata changed/],
 ['unknown full-detail layout','portalPageJson',v=>{v.detail.section.data[0].detaillayout=4},/full field\/layout metadata changed/],
 ['hidden criteria schema','moduleMeta',v=>{
  let changed=0;const visit=node=>{if(!node||typeof node!=='object')return;if(node.api_name==='Job_Description'){node.data_type='text';changed++}for(const value of Object.values(node))if(Array.isArray(value))for(const child of value)visit(child);else if(value&&typeof value==='object')visit(value)}
  visit(v);assert.equal(changed,1)
 },/full field\/layout metadata changed/],
])test('original Soroco carrier rejects '+name,()=>{
 assert.throws(()=>readSorocoDetail(nativeMutation(change,binding),rows[0]),reason)
})
for(const[name,change,reason]of[
 ['hidden body',html=>html.replace('<body class="cw-pages','<body hidden class="cw-pages'),/hidden or inert|active detail mount/],
 ['missing mount',html=>html.replace('id="career-website-main"','id="unmounted"'),/active detail mount/],
 ['document CSS hiding mount',html=>html.replace('</head>','<style>#career-website-main{display:none!important}</style></head>'),/stylesheet fragment layout changed|stylesheet charset|active detail mount|document CSS changed/],
 ['dormant original jobs',html=>html.replace('var jobs = JSON.parse','if(false) var jobs = JSON.parse'),/carrier execution plan changed/],
 ['reassigned original jobs',html=>html.replace('var page_id  =','jobs=[];var page_id  ='),/carrier execution plan changed/],
 ['different initialization',html=>html.replace('initializeMeta(false,false)','initializeMeta(true,false)'),/carrier executable statement changed/],
 ['additional criteria attachment',html=>html.replace('var public_attachments_info = null;','var public_attachments_info = [];'),/literal program configuration changed/],
])test('original Soroco document rejects '+name,()=>{
 const body=nativeBody(),mutated=change(body);assert.notEqual(mutated,body)
 assert.throws(()=>readSorocoDetail(mutated,rows[0]),reason)
})
test('unqualified literal country retains exact unresolved accounting without city promotion',async()=>{
 const {jobs,calls}=await run(row=>{if(row.requestUrl===api){const payload=JSON.parse(text(row));payload.data[0].Country='';replace(row,JSON.stringify(payload))}})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,rows[1].id)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.observedRecordCount,2);assert.equal(audit.returnedCount,1);assert.equal(audit.holds.length,1)
 assert.equal(audit.holds[0].reason,'native-country-unqualified');assert.equal(audit.holds[0].record.Country,'')
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.ok(calls.every(call=>call.url!==rows[0].$url))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})
test('duplicate native listing identities reject before any detail read',async()=>{
 const wire=transport(row=>{if(row.requestUrl===api){const payload=JSON.parse(text(row));payload.data[1].id=payload.data[0].id;replace(row,JSON.stringify(payload))}})
 await assert.rejects(createSorocoScraper().run({fetchImpl:wire.fetchImpl}),/listing role identity changed/)
 assert.ok(wire.calls.every(call=>!call.url.includes('/jobs/Careers/')))
})
for(const[name,change,reason]of[
 ['full listing order',(row,phase)=>{if(row.requestUrl===api&&phase===1){const payload=JSON.parse(text(row));payload.data.reverse();replace(row,JSON.stringify(payload))}},/complete listing or corporate handoff changed at closing/],
 ['full detail criteria',(row,phase)=>{if(row.requestUrl===rows[0].$url&&phase===1)replace(row,changeBinding(text(row),'jobs',value=>{value[0].Job_Description+='<p>Updated native criteria.</p>'}))},/complete criteria carriers disagree/],
 ['full detail postal field',(row,phase)=>{if(row.requestUrl===rows[0].$url&&phase===1)replace(row,changeBinding(text(row),'jobs',value=>{value[0].Zip_Code='560079'}))},/full detail changed at closing/],
 ['corporate original document',(row,phase)=>{if(row.requestUrl==='https://soroco.com/careers'&&phase===1)replace(row,text(row)+'<div hidden>Changed</div>')},/corporate document original entity changed/],
])test('registered Soroco closing rejects changed '+name,async()=>held(change,reason))
for(const asset of current.captures.filter(row=>!row.requestUrl.includes('soroco.zohorecruit.com')&&!row.requestUrl.startsWith('https://soroco.com/')))for(const phase of[0,1]){
 test('actual Response BOM cannot inherit pinned asset '+new URL(asset.requestUrl).pathname.split('/').at(-1)+' phase'+phase,async()=>{
  await held((row,count)=>{if(row.requestUrl===asset.requestUrl&&count===phase)row.bodyBase64=Buffer.concat([Buffer.from([239,187,191]),Buffer.from(row.bodyBase64,'base64')]).toString('base64')},/Original native BOM requires review/)
 })
}
test('registered Soroco metadata final URL and MIME remain required',async()=>{
 await held(row=>{if(row.requestUrl===api)row.finalUrl=api+'&unreviewed=true'},/Original native final URL changed/)
 await held(row=>{if(row.requestUrl===api)row.headers['content-type']='text/html; note=application/json'},/native json MIME changed/)
 await held(row=>{if(row.requestUrl===rows[0].$url)row.status=404},/Original native HTTP 404/)
})
test('registered Soroco only follows exact observed corporate slash redirect',async()=>{
 await held(row=>{if(row.requestUrl==='https://soroco.com/careers/')row.headers.location='https://foreign.example/careers'},/corporate slash redirect changed/)
})
test('Soroco preserves opaque cancellation and schedules no later work',async()=>{
 const caller=new AbortController(),reason=Object.freeze({stop:'Soroco original caller'}),wire=transport()
 await assert.rejects(createSorocoScraper().run({signal:caller.signal,fetchImpl:async(url,init)=>{const response=await wire.fetchImpl(url,init);caller.abort(reason);return response}}),error=>error===reason)
 await new Promise(resolve=>setImmediate(resolve));assert.equal(wire.calls.length,1);assert.equal(wire.calls[0].signal.aborted,true)
})
test('Soroco original request budget and source/request ceilings cannot be extended',async()=>{
 const wire=transport()
 await assert.rejects(createSorocoScraper().run({fetchImpl:wire.fetchImpl,maxRequests:1}),/excessive original native request/)
 assert.equal(wire.calls.length,1)
 for(const options of[{maxRequests:29},{requestTimeoutMs:15001},{sourceTimeoutMs:180001}])await assert.rejects(createSorocoScraper().run(options),/Invalid native/)
})
test('Soroco bounded request aborts an uncooperative transport without later work',async()=>{
 let reads=0,requestSignal
 await assert.rejects(createSorocoScraper().run({requestTimeoutMs:5,fetchImpl:async(_url,init)=>{reads++;requestSignal=init.signal;return new Promise(()=>{})}}),error=>error.name==='TimeoutError')
 assert.equal(reads,1);assert.equal(requestSignal.aborted,true)
})
test('Soroco internal source deadline aborts an uncooperative transport before the request ceiling',async()=>{
 let reads=0,requestSignal
 await assert.rejects(createSorocoScraper().run({sourceTimeoutMs:5,fetchImpl:async(_url,init)=>{reads++;requestSignal=init.signal;return new Promise(()=>{})}}),error=>error.name==='TimeoutError')
 assert.equal(reads,1);assert.equal(requestSignal.aborted,true)
})
test('Soroco closing cancellation propagates the original reason and emits no completed opening roles',async()=>{
 const caller=new AbortController(),reason=Object.freeze({stop:'Soroco closing caller'}),wire=transport(),counts=new Map()
 await assert.rejects(createSorocoScraper().run({signal:caller.signal,fetchImpl:async(url,init)=>{
  const count=counts.get(url)||0;counts.set(url,count+1)
  const response=await wire.fetchImpl(url,init)
  if(url===api&&count===1)caller.abort(reason)
  return response
 }}),error=>error===reason)
 const completed=wire.calls.length;await new Promise(resolve=>setImmediate(resolve))
 assert.equal(wire.calls.length,completed)
 assert.equal(wire.calls.filter(call=>call.url===rows[0].$url).length,1)
 assert.ok(wire.calls.every(call=>call.signal.aborted))
})

for(const[name,change]of[
 ['native mount class controlled by declared CSS',html=>html.replace('id="career-website-main"','id="career-website-main" class="disN"')],
 ['original criteria class controlled by declared CSS',html=>changeBinding(html,'jobs',value=>{value[0].Job_Description='<div class="disN">'+value[0].Job_Description+'</div>'})],
 ['hidden duplicate native mount owner',html=>html.replace('<div id="career-website-main"','<div hidden id="career-website-main"></div><div id="career-website-main"')],
 ['inert duplicate native mount owner',html=>html.replace('<div id="career-website-main"','<div inert id="career-website-main"></div><div id="career-website-main"')],
 ['template native mount owner',html=>html.replace('<div id="career-website-main"','<template id="career-website-main"></template><div id="career-website-main"')],
]){
 test('native presentation rejects '+name,()=>{
  const body=nativeBody(),mutated=change(body);assert.notEqual(mutated,body)
  assert.throws(()=>readSorocoDetail(mutated,rows[0]),/Native (?:document|criteria) presentation|Native .*owner/)
 })
 for(const phase of[0,1])test('registered native presentation rejects '+name+' phase'+phase,async()=>{
  await held((row,count)=>{if(row.requestUrl===rows[0].$url&&count===phase)replace(row,change(text(row)))},/Native (?:document|criteria) presentation|Native .*owner/)
 })
}

test('registered native presentation rejects unchanged hidden criteria in both opening and closing carriers',async()=>{
 await held(row=>{if(row.requestUrl===rows[0].$url)replace(row,changeBinding(text(row),'jobs',value=>{value[0].Job_Description='<div class="disN">'+value[0].Job_Description+'</div>'}))},/Native criteria presentation/)
})

test('native presentation review retains six exact original declared CSS entities without claiming live CSS coverage',async()=>{
 const sha=value=>createHash('sha256').update(value).digest('hex')
 assert.equal(current.presentationCSS.length,6)
 assert.deepEqual(current.presentationCSS.map(row=>row.requestUrl),CURRENT_SOROCO_PROFILE.nativeStylesheets.filter(row=>row.rel==='stylesheet').map(row=>row.href))
 for(const row of current.presentationCSS){
  const bytes=Buffer.from(row.bodyBase64,'base64'),review=CURRENT_SOROCO_PROFILE.nativePresentationReview.css.find(item=>item.url===row.requestUrl)
  assert.equal(row.status,200);assert.equal(row.finalUrl,row.requestUrl);assert.match(row.headers['content-type'],/^text\/css(?:;|$)/)
  assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);assert.equal(review.bytes,row.bytes);assert.equal(review.sha256,row.sha256)
 }
 const common=current.presentationCSS.find(row=>row.requestUrl.includes('career-website-common.'))
 assert.match(Buffer.from(common.bodyBase64,'base64').toString('utf8'),/\.disN\{display:none\}/)
 const {jobs,calls}=await run()
 assert.equal(jobs.nativeCollectionEvidence.currentCSSCoverage,false)
 assert.ok(jobs.every(job=>job.nativeCriteriaTextComplete===true&&job.currentCSSCoverage===false&&job.activationVerified===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>/complete-original-native-criteria-text/.test(job.sourceCriteriaPresentation)&&/live-external-CSS-and-rendered-activation-unverified/.test(job.sourceCriteriaPresentation)))
 assert.ok(calls.every(call=>!current.presentationCSS.some(row=>row.requestUrl===call.url)))
 assert.equal(calls.length,24)
})

for(const[name,change]of[
 ['body ancestor CSS class',html=>html.replace('<body class="cw-pages','<body class="disN cw-pages')],
 ['unreviewed mount attribute',html=>html.replace('id="career-website-main"','id="career-website-main" data-unreviewed="true"')],
 ['different role-owned title metadata',html=>html.replace(/(<meta\s+[^>]*(?:name|property)="(?:twitter|og):title"[^>]*content=")[^"]*/, '$1Unreviewed role')],
 ['different role-owned URL metadata',html=>html.replace(/(<meta\s+[^>]*property="og:url"[^>]*content=")[^"]*/, '$1https://soroco.zohorecruit.com/other')],
])test('complete native presentation envelope rejects '+name,()=>{
 const original=nativeBody(),mutated=change(original);assert.notEqual(mutated,original)
 assert.throws(()=>readSorocoDetail(mutated,rows[0]),/Native document presentation/)
})
