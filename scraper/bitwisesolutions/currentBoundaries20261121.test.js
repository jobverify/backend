import './currentContract20261121.test.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import {createBitwiseSolutionsScraper} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {networkFences,originalPacket,replay} from './fixtures/currentReviewedReplay20261121.js'

const api='https://www.bitwiseglobal.com/api/careers',program='/18dzz-tmy.l2q.js',target='/6085-project-manager',apply='https://www.bitwiseglobal.com/company/careers/6085-project-manager/apply',otherApply='https://www.bitwiseglobal.com/company/careers/6065-technology-lead/apply'
const replace=(text,from,to)=>{assert.ok(text.includes(from),'Actual original carrier must exist: '+from);return text.replace(from,to)}
async function observed(t,edit=()=>{},options={}){
 const restore=networkFences();t.after(restore);let edits=0
 const transport=replay((value,context)=>{if(edit(value,context))edits++;return value})
 let jobs,error
 try{jobs=await createBitwiseSolutionsScraper().run({fetchImpl:transport.fetchImpl,requestIntervalMs:0,now:()=>originalPacket.completedAt,...options})}catch(caught){error=caught;if(caught.code==='ERR_ASSERTION'||/unexpected live network|allowlist/i.test(caught.message))throw caught}
 return{jobs,error,transport,get edits(){return edits}}
}
const mutateRow=change=>(value,context)=>{if(context.original.requestedUrl!==api)return false;const model=JSON.parse(value.body);change(model.jobs.find(row=>row.id==='6085'),model,context);value.body=JSON.stringify(model);return true}
const mutateRole=(change,closingOnly=false)=>(value,context)=>{if(!context.original.requestedUrl.endsWith(target)||closingOnly&&context.phase!=='simulated-closing')return false;value.body=change(value.body,context);return true}
const mutateProgram=change=>(value,context)=>{if(!context.original.requestedUrl.endsWith(program))return false;value.body=change(value.body);return true}
function unaffected(result){assert.ok(result.edits>0,'The actual selected carrier must be reached');if(result.error){assert.ok(result.error.nativeContradiction||result.error.nativeUnavailable||['ActiveNativeContentError','SyntaxError'].includes(result.error.name),result.error.stack);return}assert.deepEqual(result.jobs.map(job=>job.nativePublicJobId).sort(),['6061','6065']);assert.ok(result.jobs.nativeCollectionEvidence.held.some(row=>row.id==='6085'))}
function rejected(result){assert.ok(result.edits>0,'The actual selected carrier must be reached');assert.ok(result.error,'Whole source contract must reject');assert.ok(result.error.nativeContradiction||result.error.nativeUnavailable||['ActiveNativeContentError','SyntaxError'].includes(result.error.name),result.error.stack)}
function positives(result){assert.equal(result.error,undefined);assert.ok(result.edits>0);assert.deepEqual(result.jobs.map(job=>job.nativePublicJobId).sort(),['6061','6065','6085'])}

for(const [label,edit]of[
 ['active listing method',source=>replace(source,'method:"POST"','method:"GET"')],
 ['initial JSON body',source=>replace(source,'JSON.stringify(e?{locationGroup:e}:{})','JSON.stringify({locationGroup:"us"})')],
 ['active listing endpoint',source=>replace(source,'"/api/careers"','"/api/private"')],
 ['inert registration',source=>'if(false){'+source+'}'],
 ['disconnected named export',source=>replace(source,'"CareerListings"','"UnusedListings"')],
 ['disconnected initial effect',source=>replace(source,'n?x(!0):L()','n?x(!0):void 0')],
 ['filtered initial country state',source=>replace(source,'[h,m]=(0,l.useState)("all")','[h,m]=(0,l.useState)("us")')],
 ['changed returned card identity',source=>replace(source,'/company/careers/${e.slug}','/company/careers/${e.id}')],
])test('current programme rejects '+label,async t=>rejected(await observed(t,mutateProgram(edit))))

test('complete200 malformed listing is a source contract failure',async t=>{const result=await observed(t,(value,context)=>{if(context.original.requestedUrl!==api)return false;value.body='{"jobs":{}}';return true});rejected(result);assert.equal(result.error.nativeUnavailable,undefined)})
test('original Response URL mismatch rejects before treating body as evidence',async t=>rejected(await observed(t,(value,context)=>{if(context.original.requestedUrl!==api)return false;value.url='https://www.bitwiseglobal.com/api/wrong';return true})))
test('foreign current own publisher metadata rejects navigation authority',async t=>rejected(await observed(t,(value,context)=>{if(context.original.requestedUrl!=='https://www.bitwiseglobal.com/')return false;value.body=replace(value.body,'<title>Bitwise | Enterprise AI Engineering &amp; Data Services</title>','<title>Acme | Enterprise AI Engineering &amp; Data Services</title>');return true})))
test('foreign actual Careers destination cannot be followed',async t=>rejected(await observed(t,(value,context)=>{if(context.original.requestedUrl!=='https://www.bitwiseglobal.com/')return false;value.body=replace(value.body,'href="/company/careers"','href="https://careers.acme.invalid/"');return true})))

test('closing membership loss holds that role and preserves unrelated partials',async t=>unaffected(await observed(t,(value,context)=>{if(context.original.requestedUrl!==api||context.phase!=='simulated-closing')return false;const data=JSON.parse(value.body);data.jobs=data.jobs.filter(row=>row.id!=='6085');value.body=JSON.stringify(data);return true})))
test('closing native title mismatch holds only its role',async t=>unaffected(await observed(t,mutateRow((row,_data,context)=>{if(context.phase==='simulated-closing')row.title='Other Project Manager'}))))
test('native contract mismatch against the actual full-role summary holds its role',async t=>unaffected(await observed(t,mutateRow(row=>{row.jobType='Contract'}))))
test('duplicate conflicting native ID holds only the duplicated role',async t=>unaffected(await observed(t,mutateRow((row,data)=>data.jobs.push({...row,title:'Other Project Manager'})))))
test('explicit closing foreign country group holds its role',async t=>unaffected(await observed(t,mutateRow((row,_data,context)=>{if(context.phase==='simulated-closing')row.locationGroup='us'}))))
test('explicit foreign full-role employer holds its role',async t=>unaffected(await observed(t,mutateRole(html=>replace(html,'<h1 ','<h1 data-employer="Acme" ')))))
test('closing country contradiction in actual role criteria holds its role',async t=>unaffected(await observed(t,mutateRole(html=>replace(html,'<h1 ','<h1 data-country="Canada" '),true))))
test('hidden same-role semantic country contradiction is retained and holds its role',async t=>unaffected(await observed(t,mutateRole(html=>replace(html,'</main>','<p hidden>Country: Canada</p></main>')))))
test('one conflicting actual Apply candidate cannot be deduplicated away',async t=>unaffected(await observed(t,mutateRole(html=>replace(html,'href="/company/careers/6085-project-manager/apply"','href="'+otherApply+'"')))))
test('invalid candidate preceding coherent application array is held before dedup',async t=>unaffected(await observed(t,mutateRow(row=>{row.applicationUrls=['not a valid application URI',apply,apply]}))))
test('foreign same-role array candidate holds even when first candidate is valid',async t=>unaffected(await observed(t,mutateRow(row=>{row.applicationUrls=[apply,otherApply]}))))
test('expired native row date holds its role',async t=>unaffected(await observed(t,mutateRow(row=>{row.validThrough='2000-01-01'}))))
test('future native row publication holds its role',async t=>unaffected(await observed(t,mutateRow(row=>{row.datePosted='2099-01-01'}))))
test('closing explicit role closure preserves unrelated partials',async t=>unaffected(await observed(t,mutateRole(html=>replace(html,'<h1 ','<h1 data-status="closed" '),true))))
test('optional503 role outage is partial and does not become company zero',async t=>{const result=await observed(t,(value,context)=>{if(!context.original.requestedUrl.endsWith(target)||context.phase!=='opening')return false;value.status=503;return true});unaffected(result);assert.equal(readInventoryEvidence(result.jobs).status,'coverage-gap');assert.equal(result.jobs.nativeCollectionEvidence.held.find(row=>row.id==='6085').openingError.failureKind,'optional-native-unavailable')})
test('complete200 malformed role remains parser failure rather than optional outage',async t=>{const result=await observed(t,mutateRole(()=>'<html><head><title>Other</title></head><body>bad</body></html>'));unaffected(result);assert.equal(result.jobs.nativeCollectionEvidence.held.find(row=>row.id==='6085').openingError.failureKind,'parser_or_contract_error')})

test('coherent duplicate same-role application array preserves partials',async t=>positives(await observed(t,mutateRow(row=>{row.applicationUrls=[apply,apply]}))))
test('native JSON property reordering and unknown arrays preserve partials and raw values',async t=>{const result=await observed(t,(value,context)=>{if(context.original.requestedUrl!==api)return false;const data=JSON.parse(value.body);data.jobs=data.jobs.map(row=>Object.fromEntries(Object.entries({...row,publicNotes:['native note',null]}).reverse()));value.body=JSON.stringify(data);return true});positives(result);assert.deepEqual(result.jobs.find(job=>job.jobId==='6085').sourceNativeRecord.original.publicNotes,['native note',null])})
test('semantic JobID wrapper variation preserves the exact public ID binding',async t=>positives(await observed(t,mutateRole(html=>replace(html,'<p class="text-body-lg text-bw-neutral-600 mt-4">Job ID - <!-- -->6085</p>','<div class="text-body-lg text-bw-neutral-600 mt-4">Job ID - <!-- -->6085</div>')))))
test('coherent explicit India role criterion preserves the native group scope',async t=>positives(await observed(t,mutateRole(html=>replace(html,'</main>','<div><p>Country</p><p>India</p></div></main>')))))
test('recognized nested row publication dates are retained raw and never reset from acquisition',async t=>{const result=await observed(t,mutateRow(row=>{row.publication={datePosted:'2024-01-02'}}));positives(result);const job=result.jobs.find(job=>job.jobId==='6085');assert.equal(job.postingDate,'2024-01-02T00:00:00.000Z');assert.equal(job.sourceNativeDates.datePostedRaw,'2024-01-02')})
test('earliest observed native row publication survives a coherent closing date revision',async t=>{const result=await observed(t,mutateRow((row,_data,context)=>{row.datePosted=context.phase==='opening'?'2024-02-02':'2024-01-02'}));positives(result);const job=result.jobs.find(job=>job.jobId==='6085');assert.equal(job.postingDate,'2024-01-02T00:00:00.000Z');assert.ok(job.sourceNativeDates.recognizedPostingFields.some(model=>model.raw==='2024-02-02'));assert.ok(job.sourceNativeDates.recognizedPostingFields.some(model=>model.raw==='2024-01-02'))})

for(const status of[202,401,402,403,406,407,429,451])test('native barrier'+status+' stops the origin without retry',async t=>{const result=await observed(t,(value,context)=>{if(context.index!==0)return false;value.status=status;return true});rejected(result);assert.equal(result.transport.calls.length,1)})
test('caller zero cap performs no acquisition and supplies no empty-inventory proof',async t=>{const result=await observed(t,()=>{}, {maxJobs:0});assert.equal(result.error,undefined);assert.equal(result.jobs.length,0);assert.equal(result.transport.calls.length,0);assert.equal(readInventoryEvidence(result.jobs).listingComplete,false);assert.equal(readInventoryEvidence(result.jobs).verifiedAt,null)})
test('positive output cap retains scope and cleanup holds',async t=>{const result=await observed(t,()=>{}, {maxJobs:1});assert.equal(result.error,undefined);assert.equal(result.jobs.length,1);assert.equal(result.jobs.nativeCollectionEvidence.sourceCallerLimited,true);assert.equal(readInventoryEvidence(result.jobs).listingComplete,false)})
test('explicit historical body-only seam is observation-only despite fresh caller time',async t=>{const restore=networkFences();t.after(restore);const transport=replay();const jobs=await createBitwiseSolutionsScraper().run({fetchText:transport.fetchText,now:()=>new Date().toISOString()});assert.equal(jobs.length,0);assert.equal(transport.legacyTextCalls.length,2);assert.equal(transport.calls.length,0);const inventory=readInventoryEvidence(jobs);assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.firstParty,false);assert.equal(inventory.listingComplete,false);assert.equal(inventory.verifiedAt,null);assert.equal(inventory.lifecycleCleanupAllowed,false)})
