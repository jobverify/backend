import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {parse} from 'acorn'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261127/native-capture.json.gz',import.meta.url))))
const previous=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261125/native-capture.json.gz',import.meta.url))))
const home='https://genworx.ai/',board='https://genworx.zohorecruit.com/jobs/Careers'
const primary=home+'assets/index-fj3es2KT.js',feature=home+'assets/features-Bm6nNtIc.js'
const native='https://static.zohocdn.com/recruit/javascript/career-website-common.11cec0a8418343c5dcf66dc619a0e1f1.js'
const marketing='802719000002492042',software='802719000000585025'
const content=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
function replay(edit=(url,body)=>body){
 const counts=new Map(),reads=[]
 return {reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  url=String(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const count=(counts.get(url)??0)+1;counts.set(url,count)
  const packet=fixture.responses.filter(packet=>packet.requestedUrl===url)[count-1]
  assert.ok(packet,'Only separately captured current declared public GET '+url+' observation '+count);reads.push(url)
  return Object.defineProperty(new Response(edit(url,content(packet),count),{status:packet.status,headers:packet.headers}),'url',{value:packet.responseUrl})
 }}}
}
function replaceOne(body,before,after){assert.equal(body.split(before).length,2,'Mutation must target one actual current value');const changed=body.replace(before,after);assert.notEqual(changed,body);return changed}
const encode=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function hidden(html,name,edit){
 const nodes=readNativeDocument(html,{sourceRanges:true}).nodes(node=>node.tag==='input'&&node.attrs.id===name)
 assert.equal(nodes.length,1);const node=nodes[0],tag=html.slice(node.sourceStart,node.sourceOpenEnd),value=JSON.parse(node.attrs.value)
 edit(value);const changed=tag.replace(/\bvalue=(["'])([\s\S]*?)\1/,(_m,quote)=>'value='+quote+encode(JSON.stringify(value))+quote)
 assert.notEqual(changed,tag);return html.slice(0,node.sourceStart)+changed+html.slice(node.sourceOpenEnd)
}
function detailRows(html,edit){let changed=false;const result=html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_all,open,source,close)=>{
 if(!source.includes('var jobs ='))return open+source+close
 const ast=parse(source,{ecmaVersion:'latest'}),d=ast.body.flatMap(st=>st.type==='VariableDeclaration'?st.declarations:[]).find(d=>d.id?.name==='jobs')
 const rows=JSON.parse(d.init.arguments[0].value);edit(rows);changed=true
 return open+source.slice(0,d.init.start)+'JSON.parse('+JSON.stringify(JSON.stringify(rows))+')'+source.slice(d.init.end)+close
});assert.equal(changed,true);assert.notEqual(result,html);return result}
const contract=error=>error.failureKind==='parser_or_contract_error'

test('GENWORX genuine current deployment retains complete native records and preserves the independent criteria hold',async()=>{
 assert.equal(fixture.synthetic,false);assert.equal(fixture.responses.length,18)
 for(const packet of fixture.responses){const body=Buffer.from(packet.bodyBase64,'base64');assert.equal(packet.status,200);assert.equal(body.length,packet.bytes);assert.equal(createHash('sha256').update(body).digest('hex'),packet.sha256)}
 const {reads,options}=replay(),jobs=await run(options),evidence=jobs.nativeCollectionEvidence
 assert.equal(reads.length,18);assert.equal(reads.filter(url=>url===feature).length,2)
 assert.equal(readSourceObservationEvidence(jobs,'genworx').observedRecordCount,2)
 assert.equal(evidence.nativeOpeningInventory.meta.org_info.company_name,'Genworx.Ai Technology Solutions Private Limited')
 assert.deepEqual(evidence.nativeOpeningInventory,evidence.nativeClosingInventory)
 for(const detail of evidence.nativeOpeningInventory.details){
  const original=fixture.responses.find(packet=>packet.requestedUrl===detail.applicationURL)
  assert.deepEqual(detail.application,JSON.parse(content(original)));assert.equal(detail.application.webforms[0].sections.length,8)
  assert.equal(detail.row.Country,'India');assert.ok(detail.row.Job_Description.length>1000)
 }
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,marketing);assert.equal(jobs[0].country,'India')
 assert.match(jobs[0].jobDescription,/Five to eight years in B2B marketing/)
 assert.deepEqual(jobs[0].nativeDetailRecord,evidence.nativeOpeningInventory.details.find(row=>row.row.id===marketing).row)
 assert.ok(evidence.failures.some(row=>row.id===software&&/criteria/.test(row.reason)))
 assert.equal(jobs[0].applicationValidationQualified,false);assert.equal(jobs[0].publicEligibility,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(evidence.sourceScopeComplete,false)
 assert.equal(evidence.companyIndiaTotal,null);assert.equal(evidence.browserEquivalenceComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('GENWORX current native revision qualifies independently of the current social-image shell variant',async()=>{
 const original=content(previous.responses.find(packet=>packet.requestedUrl===home))
 const {reads,options}=replay((url,body)=>url===home?original:body),jobs=await run(options)
 assert.equal(reads.length,16);assert.equal(reads.includes(feature),false)
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,marketing);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const mode of ['title','canonical','module-route','module-program','handoff','foreign-module','duplicate-meta','mixed-images','unreviewed-images','meta-handler','extra-script'])test('GENWORX current employer shell rejects '+mode,async()=>{
 let changed=false
 const {reads,options}=replay((url,body)=>{
  let next=body
  if(url===home&&mode==='title')next=replaceOne(body,'<title>Genworx | Bespoke AI, proven in 72 hours</title>','<title>Another employer</title>')
  if(url===home&&mode==='canonical')next=replaceOne(body,'<link rel="canonical" href="https://genworx.ai/" />','<link rel="canonical" href="https://foreign.invalid/" />')
  if(url===primary&&mode==='module-route')next=replaceOne(body,'path:"/team"','path:"/careers"')
  if(url===primary&&mode==='module-program')next=body+';globalThis.fetch=()=>Promise.resolve([])'
  if(url===primary&&mode==='handoff'){assert.equal(body.split(board).length,3);next=body.replaceAll(board,'https://foreign.invalid/jobs/Careers')}
  if(url===home&&mode==='foreign-module')next=replaceOne(body,'src="/assets/index-fj3es2KT.js"','src="https://foreign.invalid/assets/index-fj3es2KT.js"')
  if(url===home&&mode==='duplicate-meta')next=replaceOne(body,'</head>','<meta property="og:image" content="https://genworx.ai/og-image-v4.jpg" /></head>')
  if(url===home&&mode==='mixed-images')next=replaceOne(body,'name="twitter:image" content="https://genworx.ai/og-image-v4.jpg"','name="twitter:image" content="https://genworx.ai/og-image-v3.jpg"')
  if(url===home&&mode==='unreviewed-images'){assert.equal(body.split('https://genworx.ai/og-image-v4.jpg').length,3);next=body.replaceAll('https://genworx.ai/og-image-v4.jpg','https://genworx.ai/og-image-v5.jpg')}
  if(url===home&&mode==='meta-handler')next=replaceOne(body,'property="og:image" content=','property="og:image" onload="globalThis.changed=true" content=')
  if(url===home&&mode==='extra-script')next=replaceOne(body,'</head>','<script>globalThis.changed=true</script></head>')
  changed||=next!==body;return next
 })
 await assert.rejects(run(options),contract);assert.equal(changed,true,'Witnessed '+mode);assert.equal(reads.includes(board),false)
})

for(const [name,url]of [['declared animation dependency',feature],['current native client',native]])test('GENWORX rejects modified '+name,async()=>{
 let changed=false;const {options}=replay((request,body)=>{if(request!==url)return body;changed=true;return body+';globalThis.changed=true'})
 await assert.rejects(run(options),contract);assert.equal(changed,true)
})

test('GENWORX rejects an unreviewed native client declaration',async()=>{
 let changed=false;const {options}=replay((url,body)=>{if(url!==board)return body;changed=true;return replaceOne(body,native,native.replace('.11cec0a8418343c5dcf66dc619a0e1f1.','.unreviewed.'))})
 await assert.rejects(run(options),contract);assert.equal(changed,true)
})

test('GENWORX current deployment remains bound to the exact native legal employer',async()=>{
 let changed=false;const {options}=replay((url,body)=>url===board?hidden(body,'meta',meta=>{assert.equal(meta.org_info.company_name,'Genworx.Ai Technology Solutions Private Limited');meta.org_info.company_name='Another employer';changed=true}):body)
 await assert.rejects(run(options),/native legal employer/);assert.equal(changed,true)
})

for(const country of [null,'United States'])test('GENWORX current native workplace country remains explicit: '+country,async()=>{
 let changed=0;const {options}=replay((url,body)=>url===board?hidden(body,'jobs',rows=>{rows.find(row=>row.id===marketing).Country=country;changed++})
  :url.includes('/jobs/Careers/'+marketing+'/')?detailRows(body,rows=>{rows[0].Country=country;changed++}):body)
 const jobs=await run(options),evidence=jobs.nativeCollectionEvidence;assert.equal(changed,4);assert.equal(jobs.length,0)
 assert.equal(evidence.observedListingCount,2);assert.ok(evidence.failures.some(row=>row.id===marketing&&row.reason===(country?'native-explicit-foreign-country':'native-country-unknown')))
 assert.equal(evidence.nativeOpeningInventory.rows.find(row=>row.id===marketing).Country,country)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('GENWORX current full criteria word-boundary disagreement stays held',async()=>{
 let changed=0;const {options}=replay((url,body)=>url===board?hidden(body,'jobs',rows=>{const row=rows.find(row=>row.id===marketing);row.Job_Description=replaceOne(row.Job_Description,'Five to eight','Fivetoeight');changed++}):body)
 const jobs=await run(options);assert.equal(changed,2);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedListingCount,2)
 assert.ok(jobs.nativeCollectionEvidence.failures.some(row=>row.id===marketing&&row.reason==='native-listing-detail-criteria-presentation-not-certified'))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

for(const addition of ['<a href="https://example.invalid/mandatory">Additional mandatory criteria</a>','<div hidden>Additional mandatory criteria</div>'])test('GENWORX retains unsupported current criteria markup as an unqualified observation: '+addition,async()=>{
 let changed=0;const {options}=replay((url,body)=>url.includes('/jobs/Careers/'+marketing+'/')?detailRows(body,rows=>{rows[0].Job_Description+=addition;changed++}):body)
 const jobs=await run(options);assert.equal(changed,2);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedListingCount,2)
 assert.ok(jobs.nativeCollectionEvidence.nativeOpeningInventory.details.find(row=>row.row.id===marketing).row.Job_Description.endsWith(addition))
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('GENWORX current closing application question drift invalidates the full native proof',async()=>{
 let changed=false;const {options}=replay((url,body,count)=>{
  if(!url.includes('/'+marketing+'/apply/')||count!==2)return body
  const value=JSON.parse(body),field=value.webforms[0].sections[0].fields[0];assert.equal(typeof field.required,'boolean');field.required=!field.required;changed=true;return JSON.stringify(value)
 })
 await assert.rejects(run(options),/whole closing native/);assert.equal(changed,true)
})
