import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const hash=b=>createHash('sha256').update(b).digest('hex')
const archive=fs.readFileSync(new URL('./fixtures/actual-http-20261030.json.gz',import.meta.url)),fixture=JSON.parse(gunzipSync(archive))
const expected=JSON.parse(fs.readFileSync(new URL('./fixtures/application-facts-20261030.json',import.meta.url)))
assert.equal(hash(archive),expected.fixtureSha256)
for(const r of fixture.responses){const b=Buffer.from(r.bodyBase64,'base64');assert.equal(hash(b),r.receipt.sha256);assert.equal(b.length,r.receipt.bytes);assert.equal(r.receipt.status,200)}
const BOARD='https://careers.kula.ai/saas-labs',listing=fixture.responses.find(r=>r.receipt.url===BOARD&&r.receipt.phase==='opening')
const opening=new Map(fixture.responses.filter(r=>r.receipt.phase==='opening-details').map(r=>[r.receipt.url,r]))
const closing=new Map(fixture.responses.filter(r=>r.receipt.phase==='closing-native-role-or-application').map(r=>[r.receipt.url,r]))
const decode=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
const first=expected.forms[0].url
const change=(body,from,to)=>{let count=0;const output=body.replace(/(<script\b[^>]*>)(self\.__next_f\.push\([\s\S]*?)(<\/script>)/g,(all,a,call,c)=>{const m=call.match(/^self\.__next_f\.push\(([\s\S]*)\);?$/),frame=JSON.parse(m[1]);if(frame[0]!==1||!frame[1].includes(from))return all;count++;frame[1]=frame[1].replaceAll(from,to);return a+'self.__next_f.push('+JSON.stringify(frame)+')'+c});assert.ok(count);return output}
const replay=async({edit,failURL,signal,onAudit,onlyListing=false,closingPass=false,fetchOverride}={})=>{
 const prior=globalThis.fetch,network=Error('Real network prohibited in source criteria fixtures');globalThis.fetch=async()=>{throw network}
 let audit;const calls=[]
 try{const provider=getScraperCatalog().find(p=>p.source==='saaslabs'),jobs=await createCatalogScraper(provider).run({signal,fetchText:fetchOverride|| (async(url,init)=>{calls.push(url);if(signal)assert.equal(init.signal,signal);if(url===BOARD)return decode(listing);if(onlyListing||url===failURL)throw Error('Authentic native detail unavailable: '+url);const r=(closingPass?closing:opening).get(url);assert.ok(r,'No observed native URL '+url);const h=decode(r);return edit?edit(url,h):h}),onAudit:onAudit|| (a=>{audit=a})});return{jobs,audit,calls,evidence:readInventoryEvidence(jobs)}}finally{globalThis.fetch=prior}
}

test('registered actual75-response corpus fetches only17 genuine bound URLs and retains all69 mandatory custom fields',async()=>{
 const {jobs,audit,calls,evidence}=await replay()
 assert.equal(calls.length,18);assert.deepEqual(calls,[BOARD,...expected.forms.map(r=>r.url)])
 assert.equal(jobs.length,17);assert.equal(audit.nativeApplicationDetails.length,17)
 let mandatory=0,staticMandatory=0
 for(const job of jobs){const original=expected.forms.find(f=>f.url===job.sourceUrl)
  assert.equal(job.country,'India');assert.equal(job.postingDate,null);assert.equal(job.legalHiringEmployer,null)
  assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceListingDescriptionComplete,true)
  assert.equal(job.sourceNativeApplicationDataRetained,true)
  assert.deepEqual(job.sourceNativeApplication.rawProps,original.rawProps)
  assert.deepEqual(job.sourceApplicationStaticFields,original.rawProps.form.static_fields)
  assert.deepEqual(job.sourceApplicationCustomFields,original.rawProps.form.ats_custom_fields)
  assert.deepEqual(job.sourceApplicationRejectionRules,original.rawProps.form.ats_auto_rejection_rules)
  assert.equal(job.sourceNativeApplication.rawHTML,decode(opening.get(job.sourceUrl)))
  mandatory+=job.sourceApplicationCustomFields.filter(f=>f.required).length
  for(const group of job.sourceApplicationStaticFields)staticMandatory+=group.fields.filter(f=>f.required).length
  assert.ok(job.sourceCriteriaIssues.includes('native-form-client-activation-unverified'))
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(mandatory,69);assert.equal(staticMandatory,66)
 assert.equal(evidence.firstParty,false);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
})

test('JD-only listing can never certify complete detail and missing detail preserves17 healthy roles',async()=>{
 const {jobs,audit,calls}=await replay({onlyListing:true})
 assert.equal(jobs.length,17);assert.equal(calls.length,18)
 assert.ok(jobs.every(j=>j.sourceDetailComplete===false&&j.jobDescription&&j.country==='India'))
 assert.ok(jobs.every(j=>j.sourceApplicationStaticFields===null&&j.sourceApplicationCustomFields===null))
 assert.ok(audit.nativeApplicationDetails.every(d=>d.evidence.failure))
})

test('single detail failure retains all original listing criteria and healthy other16 application models',async()=>{
 const {jobs}=await replay({failURL:first});assert.equal(jobs.length,17)
 const failed=jobs.find(j=>j.sourceUrl===first);assert.equal(failed.sourceDetailComplete,false);assert.equal(failed.sourceNativeApplicationDataRetained,false);assert.equal(failed.sourceApplicationCustomFields,null);assert.ok(failed.sourceNativeApplication.failure)
 assert.equal(jobs.filter(j=>j.sourceNativeApplicationDataRetained).length,16)
 assert.ok(jobs.every(j=>j.sourceNativeRecord&&j.sourceNativeDescription&&j.sourceNativeOffices[0].country_code==='IN'))
})

test('unbound foreign-account questions remain raw evidence instead of assigned application criteria',async()=>{
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,'"c":["","saas-labs",','"c":["","foreign-account",'):h})
 const j=jobs.find(j=>j.sourceUrl===first)
 assert.equal(j.sourceNativeApplicationIdentityReconciled,false)
 assert.equal(j.sourceApplicationCustomFields,null)
 assert.deepEqual(j.sourceNativeApplication.rawProps.form,expected.forms[0].rawProps.form)
})

test('active rejection metadata never becomes guessed thresholds or complete criterion predicates',async()=>{
 const {jobs}=await replay();const affected=jobs.filter(j=>j.sourceApplicationRejectionRules?.length)
 assert.equal(affected.length,4)
 for(const j of affected){assert.equal(j.sourceNativeCriteriaCopyComplete,false);assert.ok(j.sourceCriteriaIssues.includes('native-rejection-predicate-unavailable'));assert.equal(j.experienceRequired,undefined)}
 const manager=jobs.find(j=>j.jobId==='34903'),choice=manager.sourceApplicationCustomFields.find(f=>f.id===113056)
 assert.deepEqual(choice.values,[{id:109155,value:'< 8 years'},{id:109156,value:'8 - 16 years'},{id:109157,value:'> 17 years'}]);assert.equal(choice.ats_auto_rejection_rules[0].id,4002)
})

test('actual optional LinkedIn URL field has a recognized literal shape without becoming a mandatory requirement',async()=>{
 const {jobs}=await replay(),j=jobs.find(j=>j.jobId==='49943')
 const field=j.sourceApplicationStaticFields.flatMap(g=>g.fields).find(f=>f.id==='linkedin_url')
 assert.equal(field.type,'url');assert.equal(field.required,false);assert.equal(j.sourceNativeCriteriaCopyComplete,true)
 assert.equal(j.sourceDetailComplete,false);assert.equal(j.country,'India');assert.equal(j.sourceNativeOffices[0].country_code,'IN')
})

for(const [name,from,to,reason] of [
 ['unknown mandatory nested criterion','"required":true','"required":true,"mandatory_license":{"kind":"professional"}','unreviewed-native-form-field'],
 ['malformed mandatory flag','"required":true','"required":"true"','invalid-native-form-schema'],
 ['foreign detail account route','"c":["","saas-labs",','"c":["","foreign-account",','native-detail-route-mismatch'],
 ['unlisted native form','"listed":true','"listed":false','native-detail-not-public'],
 ['preview native form','"isPreview":false','"isPreview":true','native-detail-not-public'],
 ['contradictory detail office country','"country_code":"IN"','"country_code":"US"','native-detail-office-mismatch'],
 ['new alternative-office field','"country_code":"IN"','"country_code":"IN","mandatory_license":{"country":"US"}','unreviewed-native-form-field'],
 ['missing criteria reference','"job_description":"$1d"','"job_description":"$dead"','missing-frame'],
])test(name+' remains explicit partial evidence without losing listing roles',async()=>{
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,from,to):h});assert.equal(jobs.length,17)
 const job=jobs.find(j=>j.sourceUrl===first);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceNativeCriteriaCopyComplete,false)
 assert.ok(job.sourceCriteriaIssues.some(r=>r.includes(reason)),job.sourceCriteriaIssues.join(','));assert.ok(job.sourceNativeApplication.rawHTML)
})

test('opaque conflicting control frames retained but conflicting criteria targets never selected',async()=>{
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,'"job_description":"$1d"','"job_description":"$d"'):h})
 const j=jobs.find(j=>j.sourceUrl===first);assert.equal(j.sourceNativeCriteriaCopyComplete,false);assert.ok(j.sourceNativeApplication.ambiguousFrameIds.includes('d'));assert.ok(j.sourceCriteriaIssues.some(x=>x.includes('ambiguous-frame')))
})

test('duplicate static control IDs are uncertain rather than a complete criterion contract',async()=>{
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,'"id":"name","label":"Name"','"id":"email","label":"Name"'):h})
 const j=jobs.find(j=>j.sourceUrl===first);assert.equal(j.sourceNativeCriteriaCopyComplete,false);assert.ok(j.sourceCriteriaIssues.some(x=>x.includes('native-form-control-identity-conflict')))
})

test('unreachable form model cannot be attributed through unrelated title or canonical metadata',async()=>{
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,'"$L16","$L17","$L18"','"$L16",null,"$L18"'):h})
 const j=jobs.find(j=>j.sourceUrl===first);assert.equal(j.sourceNativeCriteriaCopyComplete,false);assert.ok(j.sourceCriteriaIssues.some(x=>x.includes('unbound-native-application-component')));assert.equal(j.sourceApplicationCustomFields,null)
 assert.ok(j.sourceNativeApplication.rawPropCandidates.length>0)
})

test('duplicate choice option IDs remain raw and explicitly uncertain',async()=>{
 const url=expected.forms.find(r=>r.url.includes('/34903-')).url
 const {jobs}=await replay({edit:(u,h)=>u===url?change(h,'"id":109155,"value":"< 8 years"','"id":109156,"value":"< 8 years"'):h})
 const j=jobs.find(j=>j.sourceUrl===url);assert.equal(j.sourceNativeCriteriaCopyComplete,false);assert.ok(j.sourceCriteriaIssues.some(x=>x.includes('native-form-control-identity-conflict')))
})

test('closing authentic forms are a separate offline corpus pass, never a fake second HTTP capture',async()=>{
 const {jobs}=await replay({closingPass:true});assert.equal(jobs.length,17)
 assert.equal(jobs.reduce((n,j)=>n+j.sourceApplicationCustomFields.filter(f=>f.required).length,0),69)
 assert.ok(jobs.every(j=>!j.sourceDetailComplete&&j.postingDate===null))
})

test('caller abort inside first detail transport propagates exact reason instead of optional recovery',async()=>{
 const c=new AbortController(),reason=Error('Stop native criteria');let calls=0
 await assert.rejects(replay({signal:c.signal,fetchOverride:async url=>{calls++;if(url===BOARD)return decode(listing);c.abort(reason);return decode(opening.get(url))}}),e=>e===reason)
 assert.equal(calls,2)
})

test('async audit callback failure propagates after criteria rather than becoming partial success',async()=>{
 const reason=Error('Audit failed');await assert.rejects(replay({onAudit:async()=>{await Promise.resolve();throw reason}}),e=>e===reason)
})

// Revision1: these counterfactuals reproduce the independent review findings
// against the full original response. They are not new native positive proof.
for(const [name,key]of [['literal','required'],['escaped','\\u0072equired']])test(name+' decoded duplicate JSON key cannot silently replace mandatory criteria',async()=>{
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,'"required":true','"required":true,"'+key+'":false'):h})
 assert.equal(jobs.length,17);const j=jobs.find(j=>j.sourceUrl===first)
 assert.equal(j.sourceNativeCriteriaCopyComplete,false);assert.equal(j.sourceApplicationCustomFields,null)
 assert.ok(j.sourceCriteriaIssues.some(x=>x.includes('duplicate-native-JSON-key')))
 assert.ok(j.sourceNativeApplication.duplicateJSONKeys.some(x=>x.key==='required'))
 const raw=j.sourceNativeApplication.literalFrameOccurrences.find(r=>r.raw.includes('"required":true,"'+key+'":false'))
 assert.ok(raw);assert.equal(Object.hasOwn(raw,'value'),false,'No last-wins model object may be selected')
 assert.ok(raw.raw.includes(expected.forms[0].rawProps.form.ats_custom_fields[0].label))
})

test('description contradiction keeps raw form evidence without assigning it to current listed role',async()=>{
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,'"job_description":"$1d"','"job_description":"Different role requires a commercial pilot licence."'):h})
 const j=jobs.find(j=>j.sourceUrl===first);assert.equal(j.sourceApplicationStaticFields,null);assert.equal(j.sourceApplicationCustomFields,null);assert.equal(j.sourceApplicationRejectionRules,null)
 assert.equal(j.sourceNativeApplicationCriteriaReconciled,false);assert.equal(j.sourceNativeCriteriaCopyComplete,false)
 assert.equal(j.sourceNativeApplication.rawProps.job_description,'Different role requires a commercial pilot licence.')
 assert.deepEqual(j.sourceNativeApplication.rawProps.form,expected.forms[0].rawProps.form)
 assert.equal(j.country,'India');assert.equal(j.sourceNativeOffices[0].country_code,'IN','Independent listing country evidence is preserved')
})

for(const [name,key]of [['literal','directApply'],['escaped','\\u0064irectApply']])test(name+' duplicate JSON-LD key invalidates criterion attribution',async()=>{
 const {jobs}=await replay({edit:(url,h)=>{
  if(url!==first)return h;let n=0;const out=h.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(all,a,b,c)=>{assert.ok(b.includes('"directApply":true'));n++;return a+b.replace('"directApply":true','"directApply":true,"'+key+'":false')+c});assert.equal(n,1);return out
 }})
 const j=jobs.find(j=>j.sourceUrl===first);assert.equal(j.sourceApplicationCustomFields,null);assert.equal(j.sourceNativeCriteriaCopyComplete,false)
 assert.ok(j.sourceNativeApplication.duplicateJSONKeys.some(x=>x.boundary==='JSON-LD'&&x.key==='directApply'))
 assert.ok(j.sourceNativeApplication.rawJobPostingSchemas.some(x=>x.raw.includes('"directApply":true,"'+key+'":false')))
})

test('JSON-looking quoted question text is not mistaken for duplicate syntax',async()=>{
 const old=expected.forms[0].rawProps.form.ats_custom_fields[0].label,newLabel=old+' JSON example {"required":true,"required":false}'
 const {jobs}=await replay({edit:(url,h)=>url===first?change(h,JSON.stringify(old),JSON.stringify(newLabel)):h})
 const j=jobs.find(j=>j.sourceUrl===first);assert.equal(j.sourceApplicationCustomFields[0].label,newLabel)
 assert.equal(j.sourceApplicationCustomFields.filter(q=>q.required).length,6);assert.deepEqual(j.sourceNativeApplication.duplicateJSONKeys??[],[])
})

test('duplicate keys in a literal carrier are rejected with the entire carrier retained',async()=>{
 const {jobs}=await replay({edit:(url,h)=>{
  if(url!==first)return h;let changed=0;const out=h.replace(/(self\.__next_f\.push\()([\s\S]*?)(\);?<\/script>)/g,(all,a,literal,c)=>{const frame=JSON.parse(literal);if(frame[0]!==1)return all;changed++;return a+literal.replace(/\]$/,',{"required":true,"\\u0072equired":false}]')+c});assert.ok(changed);return out
 }})
 const j=jobs.find(j=>j.sourceUrl===first);assert.equal(j.sourceApplicationCustomFields,null);assert.equal(j.sourceNativeCriteriaCopyComplete,false)
 assert.ok(j.sourceNativeApplication.duplicateJSONKeys.some(x=>x.boundary==='carrier'&&x.key==='required'))
 assert.ok(j.sourceNativeApplication.rawCarrierScripts.some(x=>x.raw.includes('"required":true,"\\u0072equired":false')))
})
