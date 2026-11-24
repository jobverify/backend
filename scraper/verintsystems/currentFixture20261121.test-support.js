import fs from 'node:fs'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import {parse} from 'acorn'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {createVerintSystemsScraper} from './script.js'
import metadata from './catalog.js'
import {createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'

export const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const bytes=fs.readFileSync(new URL('./fixtures/current-native-20261121.json.gz',import.meta.url))
assert.equal(sha(bytes),'5b8b25349e625d205b531c0a1e7c46eb6c4f3c3ac06366960a93a69065dcbda1')
export const fixture=JSON.parse(gunzipSync(bytes)),AT=fixture.capturedAt
export const HOME='https://www.verint.com/careers/',BOARD='https://jobs.ashbyhq.com/27cfd344-670f-4dcd-8b13-0e18005b0d65',FEED='https://api.ashbyhq.com/posting-api/job-board/verint'
export const TARGET='698d571e-d45c-4624-8a01-7d36224a6673',ROLE='https://jobs.ashbyhq.com/verint/'+TARGET
export const INDIA_IDS=[TARGET,'ede55cfb-b8fc-4ce6-916b-64c1b773d778','5988eff6-4981-4c10-aa87-9dac081169d6']
export const decode=r=>Buffer.from(r.bodyBase64,'base64').toString('utf8')
export const walk=n=>[n,...n.children.filter(c=>typeof c!=='string').flatMap(walk)]
export const exact=(text,old,replacement)=>{assert.equal(text.split(old).length,2,'One actual carrier: '+old.slice(0,80));assert.notEqual(old,replacement);return text.replace(old,()=>replacement)}
export function element(text,predicate,edit){const d=document(text),nodes=walk(d.root).filter(n=>predicate(n,d));assert.equal(nodes.length,1,'One selected actual element');const n=nodes[0],old=d.outer(n),changed=edit(old,n,d);assert.notEqual(changed,old);return text.slice(0,n.start)+changed+text.slice(n.end)}
export const body=(url,edit,phase='closing')=>(r,current,observation)=>{if(current===url&&observation===phase)r.text=edit(r.text)}
export const attr=(url,predicate,value)=>body(url,text=>element(text,predicate,(old,n)=>old.slice(0,n.openEnd-n.start-1)+' '+value+'>'+old.slice(n.openEnd-n.start)))
export const mount=(url,markup,attrs='')=>body(url,text=>element(text,n=>n.attrs.id==='root',(old,n)=>old.slice(0,n.openEnd-n.start-1)+(attrs?' '+attrs:'')+'>'+markup+old.slice(n.closeStart-n.start)))
export function modelEdit(text,edit){return element(text,n=>n.tag==='script'&&(n.raw??'').includes('window.__appData ='),(old,n)=>{const tree=parse(n.raw,{ecmaVersion:'latest'}),assignment=tree.body.find(s=>s.type==='ExpressionStatement'&&s.expression.type==='AssignmentExpression'&&s.expression.left.property?.name==='__appData')?.expression;assert(assignment,'Actual native assignment');const model=JSON.parse(n.raw.slice(assignment.right.start,assignment.right.end));edit(model);const code=n.raw.slice(0,assignment.right.start)+JSON.stringify(model).replaceAll('<','\\u003c')+n.raw.slice(assignment.right.end);parse(code,{ecmaVersion:'latest'});return exact(old,n.raw,code)})}
export const model=(url,edit)=>body(url,text=>modelEdit(text,edit))
export const schema=edit=>body(ROLE,text=>element(text,n=>n.tag==='script'&&(n.attrs.type??'').toLowerCase()==='application/ld+json',(old,n)=>{const s=JSON.parse(n.raw);edit(s);return exact(old,n.raw,JSON.stringify(s).replaceAll('<','\\u003c'))}))
export const feed=edit=>body(FEED,text=>{const value=JSON.parse(text);edit(value.jobs.find(r=>r.id===TARGET),value);return JSON.stringify(value)})
export const ownSchema=value=>body(HOME,text=>exact(text,'</body>','<script type="application/ld+json">'+JSON.stringify(value)+'</script></body>'))
export const ownTitle=title=>body(HOME,text=>element(text,n=>n.tag==='title'&&(n.raw??'').includes('Careers | Verint'),(old,n)=>exact(old,n.raw,title)))

export async function replay({change,options={},registered=false,ordinary=false,factoryOptions=false}={}){
 const oldFetch=globalThis.fetch,calls=[],mutations=[]
 let phase='opening',ownCount=0
 const fetchImpl=async(input,init={})=>{
  const url=String(input?.url??input)
  if(url===HOME){phase=ownCount++===0?'opening':'closing';assert(ownCount<=2,'At most two genuine own observations')}
  const original=fixture.responses.find(r=>r.requestedUrl===url&&r.phase===phase)
  assert(original,'Only an actual retained same-phase public Response: '+url)
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit')
  const entity={text:decode(original),status:original.status,url:original.url,redirected:original.redirected,headers:{...original.headers}},before=JSON.stringify(entity)
  change?.(entity,url,phase)
  if(before!==JSON.stringify(entity))mutations.push({url,phase,originalSHA256:original.sha256,diagnosticSHA256:sha(Buffer.from(entity.text)),status:entity.status})
  calls.push({url,phase,method:init.method,status:entity.status,headers:init.headers})
  return Object.defineProperties(new Response(Buffer.from(entity.text),{status:entity.status,headers:entity.headers}),{url:{value:entity.url},redirected:{value:entity.redirected}})
 }
 globalThis.fetch=ordinary?fetchImpl:async()=>{throw Error('Offline source test prohibits unbound network')}
 let jobs,error
 try{const runOptions=ordinary?{}:{now:()=>AT,requestIntervalMs:0,fetchImpl,...options},source=registered?createCatalogScraper(metadata):createVerintSystemsScraper(factoryOptions?runOptions:{});jobs=await source.run(factoryOptions?{}:runOptions)}catch(e){error=e}finally{globalThis.fetch=oldFetch}
 if(change)assert(mutations.length>0,'Guarded mutation reached an actual original carrier')
 const evidence=jobs?readInventoryEvidence(jobs):null,assessment=jobs?assessSoftFailureAcquisition(metadata,jobs):null
 if(jobs){assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.lifecycleCleanupAllowed,false);assert.equal(assessment.cleanupOptions.replaceExisting,false);assert.notEqual(assessment.zeroJobEvidence,'fetched-zero');for(const job of jobs){assert.equal(job.country,'India');assert.equal(job.nativeLegalEmployer,null);assert.equal(job.requisitionId,null);assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)}}
 return{jobs,error,calls,mutations,evidence,assessment}
}

export function assertRoles(result,count=3){assert.ifError(result.error);assert.equal(result.jobs.length,count);if(count===2)assert(!result.jobs.some(j=>j.jobId===TARGET));return result.jobs}
