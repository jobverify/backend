import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import http from 'node:http'
import https from 'node:https'
import {syncBuiltinESMExports} from 'node:module'
import test,{after} from 'node:test'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readInventoryEvidence,isVerifiedEmptyEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const sha=value=>createHash('sha256').update(value).digest('hex')
const fixtureBytes=fs.readFileSync(new URL('./fixtures/native-label-originals-20261119.json.gz',import.meta.url))
assert.equal(sha(fixtureBytes),'e47cb5e052cb3a2f4138121075afd656bca1aaa577e4bc6bc1625474104ae8f5')
const originals=JSON.parse(gunzipSync(fixtureBytes)).responses
assert.equal(originals.length,58)
for(const row of originals){const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(bytes.length,row.bytes);assert.equal(sha(bytes),row.sha256);assert.equal(row.status,200);assert.equal(row.method,'GET')}
const ID='8337921',AT='2026-11-19T02:59:26.974Z',CARRIERS=[6,12,21,27,39,53]

const LOCATION_P='<p><strong>Location: Remote U.S. (</strong>New York or New Jersey preferred.)</p>';
const LOCATION_DIV='<div><strong>Location: Remote, India (</strong>New York or New Jersey preferred.)</div>';
const htmlEncoded=s=>s.replaceAll('<','&lt;').replaceAll('>','&gt;');
const scriptEncoded=s=>s.replaceAll('<','\\u003c').replaceAll('>','\\u003e');
function semanticLocationDiv(text,row){
 assert.ok([6,12,21,27,39,53].includes(row.index));
 const field=value=>{
  const encodings=[s=>s,htmlEncoded,scriptEncoded];
  const matches=encodings.map(encode=>({from:encode(LOCATION_P),to:encode(LOCATION_DIV)})).filter(pair=>value.includes(pair.from));
  assert.equal(matches.length,1,'Exactly one genuine decoded-field Location encoding '+row.index);
  const pair=matches[0];assert.equal(value.split(pair.from).length-1,1);assert.equal(value.includes(pair.to),false);
  return value.replace(pair.from,()=>pair.to);
 };
 if(row.index===6||row.index===12||row.index===21||row.index===27){
  const j=JSON.parse(text),target=Array.isArray(j.jobs)?j.jobs.find(r=>r.id===Number(ID)):j;
  assert.equal(target.id,Number(ID));target.content=field(target.content);
  assert.equal(target.content.split(htmlEncoded(LOCATION_DIV)).length-1,1);
  return JSON.stringify(j);
 }
 assert.equal(text.split(LOCATION_P).length-1,1,'Exactly one actual visible role Location paragraph');
 text=text.replace(LOCATION_P,()=>LOCATION_DIV);
 let doc=readNativeDocument(text),nodes=doc.nodes(n=>n.tag==='script'&&!n.attrs.src&&n.raw?.includes('window.__remixContext'));
 assert.equal(nodes.length,1);const raw=nodes[0].raw,ast=parse(raw,{ecmaVersion:'latest'}),node=ast.body[0].expression.right;
 const model=JSON.parse(raw.slice(node.start,node.end));
 const post=model.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost;
 post.content=field(post.content);
 assert.equal(post.content.split(LOCATION_DIV).length-1,1);
 const changed=raw.slice(0,node.start)+JSON.stringify(model).replaceAll('<','\\u003c')+raw.slice(node.end);
 assert.equal(text.split(raw).length,2);text=text.replace(raw,()=>changed);
 doc=readNativeDocument(text);const visible=doc.nodes(n=>n.tag==='div'&&(n.attrs.class||'').split(/\s+/).includes('job__description'));
 assert.equal(visible.length,1);assert.ok(doc.text(visible[0]).includes('Location: Remote, India ('));
 return text;
}

// Other named cases use the identical actual role fields and replace only
// the same selected Location block. These are counterfactual originals.
function semanticBlock(text,row,replacement){
 assert(CARRIERS.includes(row.index))
 const field=value=>{
  const matches=[s=>s,htmlEncoded,scriptEncoded].map(encode=>({from:encode(LOCATION_P),to:encode(replacement)})).filter(pair=>value.includes(pair.from))
  assert.equal(matches.length,1);const pair=matches[0];assert.equal(value.split(pair.from).length-1,1)
  return value.replace(pair.from,()=>pair.to)
 }
 if([6,12,21,27].includes(row.index)){
  const model=JSON.parse(text),target=Array.isArray(model.jobs)?model.jobs.find(value=>value.id===Number(ID)):model
  assert.equal(target.id,Number(ID));target.content=field(target.content);return JSON.stringify(model)
 }
 assert.equal(text.split(LOCATION_P).length-1,1);text=text.replace(LOCATION_P,()=>replacement)
 const doc=readNativeDocument(text),nodes=doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&node.raw?.includes('window.__remixContext'))
 assert.equal(nodes.length,1);const raw=nodes[0].raw,ast=parse(raw,{ecmaVersion:'latest'}),node=ast.body[0].expression.right
 const model=JSON.parse(raw.slice(node.start,node.end)),post=model.state.loaderData['routes/$url_token_.jobs_.$job_post_id'].jobPost
 post.content=field(post.content)
 const changed=raw.slice(0,node.start)+JSON.stringify(model).replaceAll('<','\\u003c')+raw.slice(node.end)
 assert.equal(text.split(raw).length,2);return text.replace(raw,()=>changed)
}
const US_DIV=LOCATION_P.replaceAll('<p>','<div>').replaceAll('</p>','</div>')
const INDIA_TEXT='<strong>Location: Remote, India (</strong>New York or New Jersey preferred.)'
const US_TEXT='<strong>Location: Remote U.S. (</strong>New York or New Jersey preferred.)'
const controls=[
 {name:'exact peer div Location India prevents configured completeness',negative:true,exactPeer:true},
 {name:'coherent same US div retains full configured account',html:US_DIV},
 {name:'role-owned section Location India prevents configured completeness',negative:true,html:'<section>'+INDIA_TEXT+'</section>'},
 {name:'role-owned label Location India prevents configured completeness',negative:true,html:'<label>'+INDIA_TEXT+'</label>'},
 {name:'role-owned leaf span Location India prevents configured completeness',negative:true,html:'<span>'+INDIA_TEXT+'</span>'},
 {name:'outer Location container spanning About headings and sections is not a criterion',html:'<div>Location: Remote U.S.<section><h2>About Doximity</h2><div>Location: India</div></section></div>',excludedText:'About Doximity'},
 {name:'outer Location container spanning a company paragraph is not a criterion',html:'<div>Location: Remote U.S.<p>Our company headquarters supports teams in India.</p></div>',excludedText:'company headquarters'},
 {name:'headquarters section Location India does not contradict the actual US criterion',html:US_DIV+'<section><h2>Headquarters</h2><div>Location: India</div></section>',excludedText:'Location: India'},
 {name:'application form cannot supply workplace country or bypass the existing role-criteria rejection',html:US_DIV+'<form><label>Location: India</label></form>',expectedError:{code:'DOXIMITY_NATIVE_PROOF',message:/complete visible role criteria missing or includes a form/}},
 {name:'inert semantic Location India does not contradict the actual US criterion',html:US_DIV+'<section inert><div>Location: India</div></section>',excludedText:'Location: India'},
]
const OTHER_IDS=['8262005','8222144','8155070','8222141','8379024','8159875','8311167','8126522','8331642','8372697']
let networkCalls=0
const saved={f:globalThis.fetch,hr:http.request,hg:http.get,sr:https.request,sg:https.get}
const blocked=()=>{networkCalls++;throw Error('Doximity semantic-criterion saved-original network fence')}
globalThis.fetch=blocked;http.request=http.get=https.request=https.get=blocked;syncBuiltinESMExports()
after(()=>{globalThis.fetch=saved.f;http.request=saved.hr;http.get=saved.hg;https.request=saved.sr;https.get=saved.sg;syncBuiltinESMExports();assert.equal(networkCalls,0)})

for(const control of controls)test(control.name,async()=>{
 const queues=new Map(),edits=[],requests=[]
 for(const row of originals){
  const original=Buffer.from(row.bodyBase64,'base64').toString('utf8')
  const changed=!CARRIERS.includes(row.index)?original:control.exactPeer?semanticLocationDiv(original,row):semanticBlock(original,row,control.html)
  if(changed!==original)edits.push({index:row.index,originalSHA256:row.sha256,counterfactualSHA256:sha(changed),counterfactualNotGenuine:true})
  if(!queues.has(row.url))queues.set(row.url,[])
  queues.get(row.url).push({row,original,changed})
 }
 assert.deepEqual(edits.map(value=>value.index),CARRIERS)
 const {createDoximityScraper}=await import('./script.js')
 let jobs=null,error=null
 try{jobs=await createDoximityScraper().run({rateLimitMs:0,maxRequests:58,sourceTimeoutMs:120000,now:()=>new Date(AT),fetchPage:async(url,init={})=>{
  const packet=queues.get(String(url))?.shift();assert(packet,'No extra acquisition may satisfy '+url)
  const {row,original,changed}=packet,bytes=changed===original?Buffer.from(row.bodyBase64,'base64'):Buffer.from(changed),headers=new Headers(row.headers)
  assert.equal(init.method??'GET','GET');assert(init.body==null);assert(init.signal instanceof AbortSignal)
  if(changed!==original&&headers.has('content-length'))headers.set('content-length',String(bytes.length))
  requests.push(row.index);return{url:row.url,status:row.status,headers:Object.fromEntries(headers),bodyBase64:bytes.toString('base64')}
 }})}catch(cause){if(cause.code==='ERR_ASSERTION'||cause.cause?.code==='ERR_ASSERTION')throw cause;error=cause}
 const audit=jobs?.nativeCollectionEvidence??error?.nativeEvidence,inventory=jobs?readInventoryEvidence(jobs):null,target=audit?.observations?.find(row=>row.jobId===ID)
 console.log('SEMANTIC_CRITERION_CONTROL '+JSON.stringify({name:control.name,exactPeer:control.exactPeer??false,edits,reads:requests.length,error:error?{name:error.name,code:error.code,message:error.message}:null,returnedJobs:jobs?.length??null,inventory:inventory?.status??null,configured:audit?.configuredPublicBoardEvidence?.qualified??null,target:target?{country:target.country,unknown:target.sourceCountryScopeUnresolved,conflict:target.sourceNativeCountryConflict,roleQualified:target.sourceCurrentNativeRoleQualified,criteria:target.sourceNativeRoleLocationCriteriaEvidence?.criterionCountries}:null}))
 assert.equal(networkCalls,0)
 if(error){if(control.expectedError){assert.equal(error.code,control.expectedError.code);assert.match(error.message,control.expectedError.message);assert(audit);assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);return}assert(control.negative);assert.notEqual(error.name,'TypeError');assert(audit);return}
 assert.equal(control.expectedError,undefined,'The existing full-role form guard must reject this payload')
 assert.equal(requests.length,58);assert.equal(new Set(requests).size,58);assert([...queues.values()].every(value=>value.length===0))
 assert.equal(audit.observations.length,11);assert(target)
 const others=audit.observations.filter(row=>row.jobId!==ID)
 assert.deepEqual(others.map(row=>row.jobId),OTHER_IDS)
 for(const row of others){assert.equal(row.country,'United States');assert.equal(row.sourceCountryScopeUnresolved,false);assert.equal(row.sourceNativeCountryConflict,false);assert.equal(row.sourceCurrentNativeRoleQualified,true)}
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(inventory.indiaFacetCount,null);assert.equal(isVerifiedEmptyEvidence(inventory),false)
 assert.equal(target.requisitionId,'661-SPH');assert.equal(target.postingDate,'2026-11-04T20:01:07-05:00')
 assert.equal(target.sourceNativePrimaryLabelEvidence.qualified,true);assert.equal(target.activeApplyVerified,false);assert.equal(target.applicationVisited,false)
 const criteria=target.sourceNativeRoleLocationCriteriaEvidence
 assert.equal(criteria.criteriaUsedToSupplyCountry,false)
 if(control.negative){
  assert.equal(inventory.status,'coverage-gap','A role-owned explicit Location contradiction must hold configured completeness')
  assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(audit.configuredPublicBoardEvidence.qualified,false)
  assert.equal(target.country,null);assert.equal(target.sourceCountryScopeUnresolved,true);assert.equal(target.sourceNativeCountryConflict,true);assert.equal(target.sourceCurrentNativeRoleQualified,false)
  assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,ID);assert.equal(jobs[0].country,null)
  assert.deepEqual(criteria.conflictingCountries,['India'])
  for(const source of ['native-api-record','native-api-history','hosted-model','visible-role-criteria'])assert(criteria.carriers.some(carrier=>carrier.source===source&&carrier.paragraphs.some(value=>value.countries.includes('India'))))
  for(const phase of ['opening','closing'])assert(criteria.carriers.some(carrier=>carrier.phase===phase&&carrier.paragraphs.some(value=>value.countries.includes('India'))))
 }else{
  assert.equal(target.country,'United States');assert.equal(target.sourceCountryScopeUnresolved,false);assert.equal(target.sourceNativeCountryConflict,false);assert.equal(target.sourceCurrentNativeRoleQualified,true)
  assert.equal(jobs.length,0);assert.equal(inventory.status,'complete-inventory');assert.equal(inventory.reportedTotal,11);assert.equal(inventory.verifiedAt,AT);assert.equal(inventory.lifecycleCleanupAllowed,false);assert.equal(audit.configuredPublicBoardEvidence.qualified,true)
  assert.equal(criteria.conflict,false);assert(!criteria.criterionCountries.includes('India'))
  if(control.excludedText)for(const carrier of criteria.carriers)for(const unit of carrier.paragraphs)assert(!unit.text.includes(control.excludedText),'Selected criterion must exclude parent/company/form text')
 }
})
