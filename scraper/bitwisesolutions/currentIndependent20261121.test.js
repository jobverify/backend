import test from 'node:test'
import assert from 'node:assert/strict'
import {parse} from 'acorn'
import {createBitwiseSolutionsScraper} from './script.js'
import {networkFences,originalPacket,replay,dependencyPacket} from './fixtures/currentReviewedReplay20261121.js'
const packet=originalPacket,need=(v,m)=>assert.ok(v,m)
const apiRecord=packet.records.find(r=>r.method==='POST'),programmeRecord=packet.records.find(r=>r.acquisitionStage==='programme'||r.stage==='programme'||r.requestedUrl.endsWith('.js'))
need(apiRecord&&programmeRecord,'actual listing/programme originals missing')
const apiURL=apiRecord.requestedUrl,programURL=programmeRecord.requestedUrl
const listing=JSON.parse(Buffer.from(apiRecord.bodyBase64,'base64').toString('utf8'))
const qualified=listing.jobs.filter(row=>row.locationGroup==='india'&&packet.records.some(r=>r.requestedUrl==='https://www.bitwiseglobal.com/company/careers/'+row.slug&&Buffer.from(r.bodyBase64,'base64').toString('utf8').includes(row.title+' position at Bitwise. Location: '+row.location+'. Experience: '+row.experience+'.')))
need(qualified.length===3,'genuine coherent baseline selection differs')
const expected=qualified.map(r=>r.id).sort(),target=qualified[0],targetURL='https://www.bitwiseglobal.com/company/careers/'+target.slug,applyURL=targetURL+'/apply'
const program=Buffer.from(programmeRecord.bodyBase64,'base64').toString('utf8')
const tree=parse(program,{ecmaVersion:'latest',sourceType:'script'}),nodes=[],parents=new Map()
function walk(n,parent){if(!n||typeof n!=='object'||typeof n.type!=='string')return;nodes.push(n);if(parent)parents.set(n,parent);for(const v of Object.values(n)){if(Array.isArray(v)){for(const c of v)walk(c,n)}else if(v&&typeof v==='object')walk(v,n)}}
walk(tree)
const member=n=>n?.type==='MemberExpression'?(n.computed?n.property.value:n.property.name):null
const prop=(n,k)=>n?.properties?.find(p=>(p.key.name??p.key.value)===k)?.value
const only=(v,m)=>{need(v.length===1,m+' ('+v.length+')');return v[0]}
const request=only(nodes.filter(n=>n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='fetch'&&n.arguments[0]?.value==='/api/careers'),'actual listing fetch')
const options=request.arguments[1],body=prop(options,'body'),choice=body.arguments[0]
const responseDecl=parents.get(parents.get(request)),decl=parents.get(responseDecl),jobsDecl=decl.declarations[decl.declarations.indexOf(responseDecl)+1]
const setter=only(nodes.filter(n=>n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.arguments.length===1&&n.arguments[0]?.type==='Identifier'&&n.arguments[0].name===jobsDecl.id.name),'actual jobs setter')
const map=only(nodes.filter(n=>n.type==='CallExpression'&&member(n.callee)==='map'&&n.arguments[0]?.type==='ArrowFunctionExpression'&&prop(n.arguments[0].body?.arguments?.[1],'href')?.type==='TemplateLiteral'&&prop(n.arguments[0].body.arguments[1],'href').quasis[0]?.value.cooked==='/company/careers/'),'actual returned role map')
const selected=only(nodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.id.name===map.callee.object.name),'actual map row selector').init
need(member(selected.callee)==='filter','actual selected filter differs')
const selectedReturn=selected.arguments[0]?.body?.body?.at(-1)
need(selectedReturn?.type==='ReturnStatement','actual final filter return missing')
const unwrap=n=>n?.type==='SequenceExpression'?n.expressions.at(-1):n
const effect=nodes.find(n=>n.type==='CallExpression'&&member(unwrap(n.callee))==='useEffect')
need(effect,'actual useEffect missing')
const hookName=unwrap(effect.callee).object.name
const hookImport=only(nodes.filter(n=>n.type==='VariableDeclarator'&&n.id.type==='Identifier'&&n.id.name===hookName&&member(n.init?.callee)==='i'),'actual hook import')
need(hookImport.init.arguments[0]?.type==='Literal','actual hook import literal missing')
const replace=(node,text)=>program.slice(0,node.start)+text+program.slice(node.end)
const mutateRow=(raw,fn)=>{const model=JSON.parse(raw);const row=only(model.jobs.filter(r=>r.id===target.id),'target native row');fn(row);return JSON.stringify(model)}


const sameIDs=jobs=>JSON.stringify(jobs.map(j=>String(j.jobId)).sort())===JSON.stringify(expected)
 const controls=[
  {name:'genuine-opening-baseline-with-explicitly-simulated-closing',kind:'positive',oracle:r=>sameIDs(r.jobs)&&r.requests.length===18&&r.audit?.nativeOpeningInventory.length===5&&r.audit?.nativeClosingInventory.length===5&&r.jobs.every(j=>j.nativeCountry===null&&j.nativeLegalEmployer===null&&j.companyIndiaTotal===null&&j.companyGlobalTotal===null&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false)},
  {name:'coherent-original-listing-JSON-reserialization',kind:'positive',mutate:(r,t)=>r.requestedUrl===apiURL?JSON.stringify(JSON.parse(t),null,2):t,oracle:r=>sameIDs(r.jobs)},
  {name:'coherent-unrelated-programme-comment',kind:'positive',mutate:(r,t)=>r.requestedUrl===programURL?t+'\n/* Independent benign source note. */\n':t,oracle:r=>sameIDs(r.jobs)},
  {name:'actual-listing-method-GET',kind:'programme-negative',program:replace(prop(options,'method'),'"GET"')},
  {name:'actual-initial-POST-body-is-filtered',kind:'programme-negative',program:replace(choice.alternate,'{limit:0}')},
  {name:'actual-listing-JSON-content-type-text',kind:'programme-negative',program:replace(prop(prop(options,'headers'),'Content-Type'),'"text/plain"')},
  {name:'actual-jobs-setter-discards-native-rows',kind:'programme-negative',program:replace(setter.arguments[0],'[]')},
  {name:'actual-returned-role-filter-rejects-every-row',kind:'programme-negative',program:replace(selectedReturn.argument,'!1')},
  {name:'actual-useEffect-namespace-owner-import-unresolved',kind:'programme-negative',program:replace(hookImport.init.arguments[0],'2147483647')},
  {name:'simulated-closing-unknown-role-field-changed',kind:'role-negative',mutate:(r,t,phase)=>r.requestedUrl===apiURL&&phase==='simulated-closing'?mutateRow(t,row=>{row.independentRevisionFact='changed'}):t},
  {name:'nested-role-publication-isPublished-false',kind:'role-negative',row:row=>{row.publication={isPublished:false}}},
  {name:'nested-role-publication-expired',kind:'role-negative',row:row=>{row.publication={validThrough:'2020-01-01T00:00:00Z'}}},
  {name:'same-role-plural-application-foreign-alternative',kind:'role-negative',row:row=>{row.applicationUrls=[applyURL,'https://other.example/apply']}},
  {name:'nested-role-foreign-hiringOrganization',kind:'role-negative',row:row=>{row.publication={hiringOrganization:{name:'Other Employer',url:'https://other.example/'}}}},
  {name:'nested-role-workLocationCountry-United-States',kind:'role-negative',row:row=>{row.publication={workLocationCountry:'United States'}}},
  {name:'date-only-revisions-retain-earliest-original-posted-and-expiry',kind:'positive',mutate:(r,t,phase)=>r.requestedUrl===apiURL?mutateRow(t,row=>{Object.assign(row,phase==='opening'?{datePosted:'2022-01-01T00:00:00Z',validThrough:'2028-01-01T00:00:00Z',publication:{datePosted:'2020-01-01T00:00:00Z',validThrough:'2027-01-01T00:00:00Z'}}:{datePosted:'2025-01-01T00:00:00Z',validThrough:'2030-01-01T00:00:00Z',publication:{datePosted:'2023-01-01T00:00:00Z',validThrough:'2029-01-01T00:00:00Z'}})}):t,oracle:r=>sameIDs(r.jobs)&&r.jobs.find(j=>j.jobId===target.id)?.postingDate?.startsWith('2020-01-01')&&r.jobs.find(j=>j.jobId===target.id)?.closingDate?.startsWith('2027-01-01')&&r.jobs.find(j=>j.jobId===target.id)?.sourceNativeDates.recognizedPostingFields.length>=4&&r.jobs.find(j=>j.jobId===target.id)?.sourceNativeDates.recognizedExpiryFields.length>=4},
  {name:'complete-200-listing-malformed-is-contract-hold',kind:'malformed',mutate:(r,t)=>r.requestedUrl===apiURL?'{"jobs":[':t},
  {name:'optional-selected-role-genuine-transport-error-keeps-unrelated-partials',kind:'role-negative',transport:true}
 ]

const selectedControls=['genuine-opening-baseline-with-explicitly-simulated-closing','actual-returned-role-filter-rejects-every-row','actual-useEffect-namespace-owner-import-unresolved','simulated-closing-unknown-role-field-changed','date-only-revisions-retain-earliest-original-posted-and-expiry']
for(const control of controls.filter(c=>selectedControls.includes(c.name)))test('adopted independent: '+control.name,async t=>{
 const restore=networkFences();t.after(restore)
 let edits=0
 const transport=replay((value,context)=>{
  let text=value.body
  if(control.program&&context.original.requestedUrl===programURL)text=control.program
  if(control.mutate)text=control.mutate(context.original,text,context.phase)
  if(text!==value.body)edits++;value.body=text;return value
 })
 let jobs=[],error=null,audit=null
 try{jobs=await createBitwiseSolutionsScraper().run({fetchImpl:transport.fetchImpl,requestIntervalMs:0,now:()=>packet.completedAt,onAudit:value=>{audit=value}})}catch(caught){if(caught.code==='ERR_ASSERTION'||/unexpected live network/i.test(caught.message))throw caught;error=caught;audit=caught.nativeEvidence??audit}
 if(control.program||control.mutate)assert.ok(edits>0,'the exact real native carrier must be changed')
 if(control.oracle){
  assert.equal(error,null)
  const originalURLs=new Set(packet.records.map(r=>r.requestedUrl))
  // The original byte-exact oracle counts only its original nine request identities;
  // the six supplemental dependency reads are separately required below.
  const originalRequests=transport.calls.filter(r=>originalURLs.has(r.url))
  assert.ok(control.oracle({jobs,requests:originalRequests,audit,error}))
  assert.equal(transport.calls.length,24)
  assert.equal(transport.calls.filter(r=>dependencyPacket.records.some(d=>d.requestedUrl===r.url)).length,6)
  if(control.name==='genuine-opening-baseline-with-explicitly-simulated-closing')t.diagnostic(JSON.stringify({bitwiseReviewedBaseline:true,fixtureTruth:{genuineRoleOpeningOriginals:9,genuineSeparateDependencyOpeningOriginals:3,genuineClosingOriginals:0,simulatedClosingOnly:true},requests:transport.calls.map(r=>({method:r.method,url:r.url,phase:r.phase,originalSHA256:r.originalSHA256??null,counterfactualUnavailableDependency:r.counterfactualUnavailableDependency??false})),jobs:jobs.map(j=>({id:j.jobId,country:j.country,city:j.city,nativeEmployer:j.nativeEmployer,nativeLegalEmployer:j.nativeLegalEmployer,postingDate:j.postingDate,closingDate:j.closingDate,scopeComplete:j.sourceScopeComplete,cleanup:j.lifecycleCleanupAllowed})),inventory:{opening:audit.nativeOpeningInventory.length,closing:audit.nativeClosingInventory.length,held:audit.held.map(r=>({id:r.id,reason:r.reason}))},namespaceProof:audit.originalAuthorityModels.map(a=>({phase:a.phase,exports:a.programme.importedNamespaceProof.namespaceExports,executed:a.programme.importedNamespaceProof.executed}))}))

 }else if(control.kind==='role-negative'){
  assert.equal(error,null);assert.ok(!jobs.some(j=>j.jobId===target.id));assert.deepEqual(jobs.map(j=>j.jobId).sort(),expected.filter(id=>id!==target.id));assert.ok(audit.held.some(r=>r.id===target.id))
 }else assert.ok(error&&!jobs.length,'a false filter or unresolved namespace must not publish')
})
test('coherent native hook import and real module-definition identifier remap preserves partials',async t=>{
 const restore=networkFences();t.after(restore);const before=hookImport.init.arguments[0].value,after=2147483646;let edits=0
 const expression=new RegExp('\\b'+before+'\\b','g')
 const transport=replay((value,context)=>{if(context.original.requestedUrl.endsWith('.js')){const changed=value.body.replace(expression,String(after));if(changed!==value.body)edits++;value.body=changed}return value})
 const jobs=await createBitwiseSolutionsScraper().run({fetchImpl:transport.fetchImpl,requestIntervalMs:0,now:()=>packet.completedAt})
 assert.ok(edits>=4);assert.ok(sameIDs(jobs));assert.equal(transport.calls.length,24)
})
test('actual exported hook function must retain its dispatcher return',async t=>{
 const restore=networkFences();t.after(restore);let edits=0
 const transport=replay((value,context)=>{if(context.original.requestedUrl.endsWith('/0fktdse9yjo.a.js')){const before='r.useState=function(e){return P.H.useState(e)}';assert.ok(value.body.includes(before));value.body=value.body.replace(before,'r.useState=function(e){return null}');edits++}return value})
 let jobs,error;try{jobs=await createBitwiseSolutionsScraper().run({fetchImpl:transport.fetchImpl,requestIntervalMs:0,now:()=>packet.completedAt})}catch(caught){if(caught.code==='ERR_ASSERTION')throw caught;error=caught}
 assert.equal(edits,1);assert.ok(error?.nativeContradiction&&!jobs)
})
