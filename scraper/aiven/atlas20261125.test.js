import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/atlas-native.json.gz',import.meta.url))))
const listing='https://aiven.io/careers/job',detail='https://careers.aiven.io/openings/10000002396',client='https://careers.aiven.io/assets/index-BPQcEDLt.js'
const body=packet=>{const bytes=Buffer.from(packet.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256);return bytes.toString()}
const original=body(capture.responses.find(packet=>packet.requestedURL===detail))
const native=JSON.parse(readNativeDocument(original).nodes(node=>node.tag==='script'&&node.attrs.id==='atlas-job')[0].raw)
function replay(edit=(_url,text)=>text){const reads=[],counts=new Map();const packetAt=url=>{
 const count=(counts.get(url)??0)+1;counts.set(url,count)
 const packet=capture.responses.filter(packet=>packet.requestedURL===url)[count-1]
 assert.ok(packet,'Only retained native GET '+url+' observation '+count);reads.push(url)
 return{packet,text:edit(url,body(packet),count)}
};return{reads,options:{requestIntervalMs:0,now:()=>new Date().toISOString(),fetchText:async url=>packetAt(url).text,
 fetchImpl:async(url,init)=>{url=String(url);assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');const{packet,text}=packetAt(url);return Object.defineProperty(new Response(text,{status:packet.status,headers:packet.headers}),'url',{value:packet.responseURL})}}}}
function editModel(html,change){
 const doc=readNativeDocument(html,{sourceRanges:true}),nodes=doc.nodes(node=>node.tag==='script'&&node.attrs.id==='atlas-job');assert.equal(nodes.length,1)
 const node=nodes[0],model=JSON.parse(node.raw);change(model)
 return html.slice(0,node.sourceOpenEnd)+JSON.stringify(model).replace(/</g,'\\u003c')+html.slice(node.sourceCloseStart)
}
function editSemantic(html,type,change){
 const doc=readNativeDocument(html,{sourceRanges:true})
 const node=doc.nodes(node=>node.tag==='script'&&node.attrs.type==='application/ld+json').find(node=>JSON.parse(node.raw)['@type']===type)
 assert.ok(node);const model=JSON.parse(node.raw);change(model)
 return html.slice(0,node.sourceOpenEnd)+JSON.stringify(model).replace(/</g,'\\u003c')+html.slice(node.sourceCloseStart)
}
const contract=error=>error.failureKind==='parser_or_contract_error'

test('Aiven Atlas closes all masked semantic fields and rejects additional or conflicting native requirements',async()=>{
 for(const mode of['qualifications','experienceRequirements','identifier','employer','location','organization']){
  const{reads,options}=replay((url,text)=>url!==detail?text:editSemantic(text,mode==='organization'?'Organization':'JobPosting',model=>{
   if(mode==='qualifications')model.qualifications='Mandatory additional doctorate qualification'
   if(mode==='experienceRequirements')model.experienceRequirements='Additional mandatory ten years experience'
   if(mode==='identifier')model.identifier.additionalProperty='Restricted applicants'
   if(mode==='employer')model.hiringOrganization.eligibility='Additional mandatory clearance'
   if(mode==='location')model.jobLocation.additionalProperty='Additional mandatory relocation'
   if(mode==='organization')model.eligibility='Additional mandatory work permit'
  }))
  await assert.rejects(run(options),contract,mode);assert.ok(reads.includes(detail),mode)
 }
})

test('Aiven Atlas closing structured data cannot add criteria or alter declared employment semantics',async()=>{
 for(const mode of['qualifications','experienceRequirements','employmentType']){
  const{reads,options}=replay((url,text,count)=>url!==detail||count!==2?text:editSemantic(text,'JobPosting',model=>{
   model[mode]=mode==='employmentType'?'CONTRACTOR':'Additional mandatory closing qualification'
  }))
  await assert.rejects(run(options),contract,mode);assert.equal(reads.filter(url=>url===detail).length,2,mode)
 }
})

test('Aiven current registered Atlas acquisition retains explicit India, full criteria and every native application question through a complete closing check',async()=>{
 const{reads,options}=replay(),jobs=await run(options),evidence=jobs.nativeCollectionEvidence
 assert.equal(capture.synthetic,false);assert.deepEqual(reads,[listing,detail,client,listing,detail,client])
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'10000002396');assert.equal(jobs[0].country,'India');assert.equal(jobs[0].location,'India');assert.equal(jobs[0].city,null)
 assert.deepEqual(jobs[0].sourceNativeModel,native);assert.deepEqual(jobs[0].sourceNativeApplicationQuestions,native.questions)
 assert.equal(jobs[0].sourceNativeApplicationQuestions.length,9)
 assert.match(jobs[0].jobDescription,/1\+ years in technical support/)
 assert.match(jobs[0].jobDescription,/reasonable accommodations/)
 assert.match(jobs[0].sourceDescription,/## What we're looking for/)
 assert.equal(jobs[0].postingDate,native.postedAt);assert.equal(jobs[0].applicationValidationQualified,false);assert.equal(jobs[0].publicEligibility,null)
 assert.equal(evidence.observedListingCount,45);assert.equal(evidence.selectedExplicitIndiaCount,1);assert.equal(evidence.closingNativeModelsMatch,true)
 assert.deepEqual(evidence.nativeOpeningModel,evidence.nativeClosingModel)
 assert.equal(evidence.sourceScopeComplete,false);assert.equal(evidence.browserEquivalenceComplete,false)
 assert.equal(evidence.companyIndiaTotal,null);assert.equal(evidence.companyGlobalTotal,null)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('Aiven Atlas country comes from the exact native India workplace, never the title or an absent JSON-LD country',async()=>{
 for(const value of[null,'Remote','United States','Bengaluru']){
  let changed=false
  const{options}=replay((url,text)=>url===detail?editModel(text,model=>{changed=true;model.location=value}):text)
  await assert.rejects(run(options),contract);assert.equal(changed,true)
 }
})

test('Aiven Atlas employer, canonical role identity and current declared program remain exact',async()=>{
 for(const mode of['employer','canonical','id','program']){
  let changed=false
  const{options}=replay((url,text)=>{
   if(mode==='program'&&url===client){changed=true;return text+';globalThis.unreviewed=true'}
   if(url!==detail)return text
   if(mode==='employer'){changed=true;return text.replaceAll('"name":"Aiven"','"name":"Another employer"')}
   if(mode==='canonical'){changed=true;return text.replaceAll('https://careers.aiven.io/openings/10000002396','https://careers.aiven.io/openings/10000002397')}
   if(mode==='id')return editModel(text,model=>{changed=true;model.publicId++})
   return text
  })
  await assert.rejects(run(options),contract,mode);assert.equal(changed,true,mode)
 }
})

test('Aiven Atlas complete HTML frame rejects hidden programs and additional unmodeled recruitment restrictions',async()=>{
 for(const addition of['<script hidden>globalThis.unreviewed=true</script>','<p>Additional required qualification</p>']){
  const{reads,options}=replay((url,text)=>url===detail?text.replace('</main>',addition+'</main>'):text)
  await assert.rejects(run(options),contract)
  assert.ok(reads.includes(detail))
 }
})

test('Aiven Atlas rendered and original full criteria cannot disagree or silently omit a linked condition',async()=>{
 for(const mode of['model','rendered','link']){
  const{reads,options}=replay((url,text)=>{
   if(url!==detail)return text
   if(mode==='model')return editModel(text,model=>{model.description+='\nAdditional mandatory qualification'})
   if(mode==='link')return editModel(text,model=>{model.description+='\n[Additional mandatory qualification](https://example.invalid/criteria)'})
   return text.replace('<h3>What we','<h3>Additional condition. What we')
  })
  await assert.rejects(run(options),contract,mode)
  assert.ok(reads.includes(detail),mode)
 }
})

test('Aiven Atlas closing proof includes application questions, options, required flags and passive native fields',async()=>{
 for(const mode of['required','option','context']){
  const{reads,options}=replay((url,text,count)=>url===detail&&count===2?editModel(text,model=>{
   if(mode==='required')model.questions[0].required=!model.questions[0].required
   if(mode==='option')model.questions.find(question=>question.options.length).options.push('Additional mandatory qualification')
   if(mode==='context')model.unreviewedEligibility={required:true}
  }):text)
  await assert.rejects(run(options),contract,mode)
  assert.equal(reads.filter(url=>url===detail).length,2,mode)
 }
})

test('Aiven Atlas observes a single actual denial and preserves exact caller cancellation',async()=>{
 const caller=new AbortController(),reason=Object.freeze({owner:'aiven-pre-abort'});caller.abort(reason);let reads=0
 await assert.rejects(run({signal:caller.signal,fetchText:async()=>{throw reason},fetchImpl:async()=>{reads++}}),error=>error===reason);assert.equal(reads,0)
 await assert.rejects(run({fetchText:async()=>{throw Object.assign(Error('Controlled native denial'),{httpStatus:403,failureKind:'blocked_or_access_denied'})},fetchImpl:async url=>{reads++;return Object.defineProperty(new Response('Denied',{status:403,headers:{'content-type':'text/html'}}),'url',{value:String(url)})}}),error=>error.httpStatus===403&&error.failureKind==='blocked_or_access_denied')
 assert.equal(reads,1)
})
