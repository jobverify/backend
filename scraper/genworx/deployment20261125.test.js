import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261125/native-capture.json.gz',import.meta.url))))
const home='https://genworx.ai/',board='https://genworx.zohorecruit.com/jobs/Careers'
const primaryClient='https://genworx.ai/assets/index-fj3es2KT.js'
const nativeClient='https://static.zohocdn.com/recruit/javascript/career-website-common.9fd02c455a4e51be503952e51dbd6dea.js'
const marketing='802719000002492042',software='802719000000585025'
const content=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
function replay(edit=(url,body)=>body){
 const counts=new Map(),reads=[]
 return{reads,options:{requestIntervalMs:0,fetchImpl:async(url,init)=>{
  url=String(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const count=(counts.get(url)??0)+1;counts.set(url,count)
  const packet=fixture.responses.filter(packet=>packet.requestedUrl===url)[count-1]
  assert.ok(packet,'Only separately retained current response '+url+' observation '+count);reads.push(url)
  return Object.defineProperty(new Response(edit(url,content(packet),count),{status:packet.status,headers:packet.headers}),'url',{value:packet.responseUrl})
 }}}
}
const encode=value=>value.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
function editHidden(html,name,edit){
 const nodes=readNativeDocument(html,{sourceRanges:true}).nodes(node=>node.tag==='input'&&node.attrs.id===name)
 assert.equal(nodes.length,1);const node=nodes[0],tag=html.slice(node.sourceStart,node.sourceOpenEnd)
 const value=JSON.parse(node.attrs.value);edit(value)
 const changed=tag.replace(/\bvalue=(["'])([\s\S]*?)\1/,(_m,quote)=>'value='+quote+encode(JSON.stringify(value))+quote)
 assert.notEqual(changed,tag);return html.slice(0,node.sourceStart)+changed+html.slice(node.sourceOpenEnd)
}
function editDetailRows(html,edit){return html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi,(_all,open,source,close)=>{
 if(!source.includes('var jobs ='))return open+source+close
 const ast=parse(source,{ecmaVersion:'latest'}),declaration=ast.body.flatMap(node=>node.type==='VariableDeclaration'?node.declarations:[]).find(node=>node.id?.name==='jobs')
 const rows=JSON.parse(declaration.init.arguments[0].value);edit(rows)
 return open+source.slice(0,declaration.init.start)+'JSON.parse('+JSON.stringify(JSON.stringify(rows))+')'+source.slice(declaration.init.end)+close
})}
const contract=error=>error.failureKind==='parser_or_contract_error'

test('GENWORX exact current deployment retains both India vacancies and every public application field without certifying conditional validation',async()=>{
 const{reads,options}=replay(),jobs=await run(options),evidence=jobs.nativeCollectionEvidence
 assert.equal(fixture.synthetic,false);assert.equal(reads.length,16)
 assert.equal(readSourceObservationEvidence(jobs,'genworx').observedRecordCount,2)
 assert.equal(evidence.nativeOpeningInventory.meta.org_info.company_name,'Genworx.Ai Technology Solutions Private Limited')
 assert.ok(evidence.nativeOpeningInventory.rows.every(row=>row.Country==='India'))
 assert.deepEqual(evidence.nativeOpeningInventory,evidence.nativeClosingInventory)
 for(const detail of evidence.nativeOpeningInventory.details){
  const original=fixture.responses.find(packet=>packet.requestedUrl===detail.applicationURL)
  assert.deepEqual(detail.application,JSON.parse(content(original)))
  assert.equal(detail.application.webforms[0].sections.length,8)
  assert.deepEqual(detail.application.meta.layout_rules,[])
  assert.equal(detail.row.Country,'India');assert.ok(detail.row.Job_Description.length>1000)
 }
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,marketing);assert.equal(jobs[0].country,'India')
 assert.match(jobs[0].jobDescription,/Five to eight years in B2B marketing/)
 assert.equal(evidence.failures[0].id,software);assert.match(evidence.failures[0].reason,/criteria/)
 assert.equal(jobs[0].publicEligibility,null);assert.equal(jobs[0].applicationValidationQualified,false)
 assert.equal(evidence.applicationValidationQualified,false);assert.equal(evidence.browserEquivalenceComplete,false)
 assert.equal(evidence.companyIndiaTotal,null);assert.equal(evidence.sourceScopeComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('GENWORX current primary proof rejects mixed or modified homepage/module deployments',async()=>{
 for(const mode of['mixed','primary-code','handoff']){
  let changed=false
  const{reads,options}=replay((url,body)=>{
   if(url===home&&mode==='mixed'){changed=true;return body.replace('index-fj3es2KT.js','index-DHSlVCQC.js')}
   if(url===home&&mode==='primary-code'){changed=true;return body.replace('</head>','<script>globalThis.changed=true</script></head>')}
   if(url===primaryClient&&mode==='handoff'){changed=true;return body.replaceAll(board,'https://foreign.invalid/jobs/Careers')}
   return body
  })
  await assert.rejects(run(options),contract,mode);assert.equal(changed,true,mode)
  assert.ok(!reads.includes(board),mode)
 }
})

test('GENWORX current native code and declared complete graph stay exact including video-interview validation guards',async()=>{
 for(const mode of['body','conditional','graph']){
  let changed=false
  const{options}=replay((url,body)=>{
   if(url===nativeClient&&mode==='body'){changed=true;return body+';globalThis.changed=true'}
   if(url===nativeClient&&mode==='conditional'){const next=body.replace('!n.isFieldNotRendered(e,a)','true');changed=next!==body;return next}
   if(url===board&&mode==='graph'){changed=true;return body.replace('career-website-common.9fd02c455a4e51be503952e51dbd6dea','career-website-common.unreviewed')}
   return body
  })
  await assert.rejects(run(options),contract,mode);assert.equal(changed,true,mode)
 }
})

test('GENWORX current model remains bound to its exact published legal employer',async()=>{
 let changed=false
 const{options}=replay((url,body)=>url===board?editHidden(body,'meta',meta=>{changed=true;meta.org_info.company_name='Another employer'}):body)
 await assert.rejects(run(options),/native legal employer/);assert.equal(changed,true)
})

test('GENWORX current full application question, layout-rule and passive metadata drift invalidate closing proof',async()=>{
 for(const mode of['question','layout-rule','metadata']){
  let changed=false
  const{options}=replay((url,body,count)=>{
   if(!url.includes('/'+marketing+'/apply/')||count!==2)return body
   changed=true;const value=JSON.parse(body)
   if(mode==='question')value.webforms[0].sections[0].fields[0].required=!value.webforms[0].sections[0].fields[0].required
   if(mode==='layout-rule')value.meta.layout_rules.push({unreviewedRule:'additional-criterion'})
   if(mode==='metadata')value.meta.unreviewedAssessmentContext={required:true}
   return JSON.stringify(value)
  })
  await assert.rejects(run(options),/whole closing native/);assert.equal(changed,true,mode)
 }
})

test('GENWORX current dialing locale never replaces native workplace country proof',async()=>{
 for(const country of[null,'United States']){
  const{options}=replay((url,body)=>url===board?editHidden(body,'jobs',rows=>{rows.find(row=>row.id===marketing).Country=country})
   :url.includes('/jobs/Careers/'+marketing+'/')?editDetailRows(body,rows=>{rows[0].Country=country}):body)
  const jobs=await run(options)
  assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observedListingCount,2)
  assert.ok(jobs.nativeCollectionEvidence.failures.some(row=>row.id===marketing&&row.reason===(country?'native-explicit-foreign-country':'native-country-unknown')))
  assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 }
})

test('GENWORX current unsupported linked criteria remain a retained unqualified observation',async()=>{
 const addition='<a href="https://example.invalid/mandatory">Additional mandatory criteria</a>'
 const{options}=replay((url,body)=>url.includes('/jobs/Careers/'+marketing+'/')?editDetailRows(body,rows=>{rows[0].Job_Description+=addition}):body)
 const jobs=await run(options),evidence=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(evidence.observedListingCount,2)
 assert.ok(evidence.nativeOpeningInventory.details.find(detail=>detail.row.id===marketing).row.Job_Description.endsWith(addition))
 assert.equal(evidence.publicEligibility,null);assert.equal(evidence.applicationValidationQualified,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})
