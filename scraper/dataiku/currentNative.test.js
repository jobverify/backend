import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

// Exact original fixture bytes are packaged in a trackable test directory.
const fixture=source=>JSON.parse(gunzipSync(readFileSync(new URL(`./native-captures/legacy-${source}-20261030.json.gz`,import.meta.url))))
async function execute(t,source,change=()=>{},options={}){
 const data=fixture(source),calls=[]
 const transport=async(url,init={})=>{init.signal?.throwIfAborted();const entry=data.entries[url];assert.ok(entry,`Unexpected native request ${url}`);calls.push(url);const response={...entry};change(response,url,calls);return{status:response.status,url:response.url,ok:response.status===200,text:async()=>response.body,json:async()=>JSON.parse(response.body),headers:{get:()=>null}}}
 t.mock.method(globalThis,'fetch',transport)
 let audit
 const provider=getScraperCatalog().find(p=>p.source===source)
 const jobs=await createCatalogScraper(provider).run({fetchImpl:transport,onAudit:value=>audit=value,...options})
 return{jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}
for(const [source,count]of[['dataiku',15],['assemblyai',18]]){
 test(`${source} registered current native recovery binds employer and preserves full uncertain opening/closing inventory`,async t=>{
  const {jobs,audit,calls,evidence}=await execute(t,source)
  const provider=getScraperCatalog().find(p=>p.source===source)
  assert.equal(provider.adapter,'script')
  const entry=source==='dataiku'?'publicInventory.js':'currentNative.js'
  assert.ok(provider.modulePath.endsWith(`${source}/${entry}`)||provider.modulePath.endsWith(`${source}\\${entry}`))
  assert.equal(provider.sourceScopeComplete,false)
  assert.match(provider.extractionStrategy,/partial-country-scope/)
  assert.match(provider.verifiedSurfaceSummary,/partial source recovery/)
  assert.doesNotMatch(provider.verifiedSurfaceSummary,/zero India openings|empty-india-slice/i)
  assert.equal(jobs.length,0)
  assert.equal(audit?.openingRecords.length,count,'full current native records must be available to audit')
  assert.equal(audit.closingRecords.length,count)
  assert.equal(audit.details.length,count)
  assert.equal(calls[0],source==='dataiku'?'https://www.dataiku.com/company/careers':'https://www.assemblyai.com/careers')
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.indiaFacetCount,null)
  assert.equal(evidence.reportedTotal,null)
  assert.notEqual(evidence.status,'verified-empty')
 })
 test(`${source} current employer delegation is required before native inventory`,async t=>{
  await assert.rejects(execute(t,source,(r,u)=>{if(!u.includes('boards-api'))r.body=r.body.replaceAll(`job-boards.greenhouse.io/${source}`,'job-boards.greenhouse.io/foreign')}),/handoff not established/)
 })
 test(`${source} native HTTP errors cannot become empty inventory`,async t=>{
  await assert.rejects(execute(t,source,r=>r.status=403),/HTTP status/)
 })
 test(`${source} observed response URL must stay bound to the employer or native account`,async t=>{
  await assert.rejects(execute(t,source,r=>r.url='https://unrelated.example/'),/final URL/)
 })
 test(`${source} wrong native employer cannot disappear during country filtering`,async t=>{
  await assert.rejects(execute(t,source,(r,u)=>{if(!u.includes('boards-api'))return;const p=JSON.parse(r.body);for(const row of p.jobs||[p])row.company_name='Unrelated Employer';r.body=JSON.stringify(p)}),/employer mismatch/)
 })
 test(`${source} foreign native account is rejected before geography proof`,async t=>{
  await assert.rejects(execute(t,source,(r,u)=>{if(!u.includes('boards-api'))return;const p=JSON.parse(r.body);for(const row of p.jobs||[p])row.absolute_url=row.absolute_url.replace(`/${source}/jobs/`,'/foreign/jobs/');r.body=JSON.stringify(p)}),/foreign native posting account|role URL identity/)
 })
 test(`${source} native failure envelopes cannot be converted into empty`,async t=>{
  await assert.rejects(execute(t,source,(r,u)=>{if(u.endsWith('/jobs?content=true'))r.body=JSON.stringify({jobs:[],meta:{total:0},error:'unavailable'})}),/inventory|upstream|error|payload/)
 })
 test(`${source} complete listing criteria must match every native role detail`,async t=>{
  await assert.rejects(execute(t,source,(r,u)=>{if(/\/jobs\/\d/.test(u)){const p=JSON.parse(r.body);p.content+='<p>A new mandatory license is required.</p>';r.body=JSON.stringify(p)}}),/criteria or metadata disagree/)
 })
 test(`${source} changed closing cohort cannot leave current inventory certified`,async t=>{
  await assert.rejects(execute(t,source,(r,u,calls)=>{if(u.endsWith('/jobs?content=true')&&calls.filter(v=>v===u).length===2){const p=JSON.parse(r.body);p.jobs.pop();p.meta.total=p.jobs.length;r.body=JSON.stringify(p)}}),/opening\/closing/)
 })
 test(`${source} unreviewed corporate hiring surface remains explicitly incomplete`,async t=>{
  const {audit,evidence}=await execute(t,source,(r,u)=>{if(!u.includes('boards-api'))r.body+='<form action="/new-hiring-channel"><input name="license"></form>'})
  assert.ok(audit.scopeReasons.includes('unreviewed-active-corporate-hiring-scope'))
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
 })
 test(`${source} caps and pre-aborted requests cannot claim complete inventory`,async t=>{
  await assert.rejects(execute(t,source,()=>{},{maxJobs:1}),/caps/)
  const controller=new AbortController();controller.abort(new Error('native source cancelled'))
  await assert.rejects(execute(t,source,()=>{},{signal:controller.signal}),/cancelled/)
 })
 test(`${source} future explicit native India role retains all original criteria and employer without promoting unresolved peers`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  const {jobs,evidence}=await execute(t,source,(r,u)=>{if(!u.includes('boards-api'))return;const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[]}r.body=JSON.stringify(p)})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.equal(jobs[0].sourceNativePayload.id,target)
  assert.equal(jobs[0].sourceNativeDetailPayload.company_name,jobs[0].company)
  assert.ok(jobs[0].sourceDescription.length>100)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
  assert.equal(evidence.indiaFacetCount,null)
 })
 test(`${source} unknown role criteria revoke affected detail completeness while retaining raw fields`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  const {jobs}=await execute(t,source,(r,u)=>{if(!u.includes('boards-api'))return;const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[];row.additionalQualificationRequirements='Mandatory professional license'}r.body=JSON.stringify(p)})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(jobs[0].sourceNativePayload.additionalQualificationRequirements,'Mandatory professional license')
 })
 for(const [label,mutate]of[
  ['unknown mandatory metadata',row=>{row.metadata=[...(row.metadata||[]),{id:999999,name:'Mandatory qualification',value:'Professional license required',value_type:'single_select'}]}],
  ['known metadata hiding nested mandatory criteria',row=>{row.metadata=[{...(row.metadata?.[0]||{id:999999,name:'Country',value:'India',value_type:'single_select'}),mandatoryQualifications:'Professional license required'}]}],
  ['nested native office mandatory criteria',row=>{row.offices=[{id:123,name:'Bengaluru, India',location:null,child_ids:[],parent_id:null,mandatoryQualifications:'Professional license required'}]}],
  ['nested native location mandatory criteria',row=>{row.location.mandatoryQualifications='Professional license required'}],
 ])test(`${source} ${label} revoke retained role detail completeness`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  const {jobs}=await execute(t,source,(r,u)=>{if(!u.includes('boards-api'))return;const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[];mutate(row)}r.body=JSON.stringify(p)})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.ok(jobs[0].sourceNativePayload)
  assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 })
 for(const style of['display:none','opacity:0'])test(`${source} ${style} copied criteria revoke detail completeness and remain only in raw evidence`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  const {jobs}=await execute(t,source,(r,u)=>{if(!u.includes('boards-api'))return;const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[];row.content+=`<div style="${style}">HIDDEN_MANDATORY_LICENSE copied inactive criteria</div><p>Visible current employer criteria: build reliable services and own delivery.</p>`}r.body=JSON.stringify(p)})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.match(jobs[0].sourceNativePayload.content,/HIDDEN_MANDATORY_LICENSE/)
  assert.doesNotMatch(jobs[0].jobDescription,/HIDDEN_MANDATORY_LICENSE/)
  assert.match(jobs[0].jobDescription,/Visible current employer criteria/)
 })
 test(`${source} unknown global envelope criteria revoke complete detail and retain the entire native envelope`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  const {jobs,audit}=await execute(t,source,(r,u)=>{if(!u.includes('boards-api'))return;const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[]}if(p.jobs)p.mandatoryRequirements='Every role requires a professional license';r.body=JSON.stringify(p)})
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDetailComplete,false)
  assert.equal(audit.openingPayload.mandatoryRequirements,'Every role requires a professional license')
  assert.equal(audit.closingPayload.mandatoryRequirements,'Every role requires a professional license')
 })
 test(`${source} hiding native employer handoff inside an existing style block cannot retain an India role`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  await assert.rejects(execute(t,source,(r,u)=>{
   if(!u.includes('boards-api')){
    assert.match(r.body,/<\/style\s*>/i)
    r.body=r.body.replace(/<\/style\s*>/i,'a[href*="greenhouse.io"]{display:none!important}</style>')
    return
   }
   const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[]}r.body=JSON.stringify(p)
  }),/visible.*(?:delegation|handoff)/i)
 })
 test(`${source} hidden closing employer handoff cannot certify earlier India extraction`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  const collect=()=>execute(t,source,(r,u,calls)=>{
   if(!u.includes('boards-api')&&calls.filter(value=>value===u).length===2)
    r.body=r.body.replace(/<\/style\s*>/i,'a[href*="greenhouse.io"]{opacity:0!important}</style>')
   if(u.includes('boards-api')){const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[]}r.body=JSON.stringify(p)}
  })
  if(source==='dataiku'){
   const {jobs,evidence,audit}=await collect()
   assert.equal(jobs.length,1)
   assert.equal(jobs[0].sourceNativePayload.id,target)
   assert.equal(jobs[0].sourceDetailComplete,true)
   assert.equal(jobs[0].sourceListingComplete,false)
   assert.equal(jobs[0].lifecycleCleanupAllowed,false)
   assert.equal(evidence.listingComplete,false)
   assert.equal(evidence.verifiedAt,null)
   assert.equal(audit.details.length,15)
  }else await assert.rejects(collect(),/visible.*(?:delegation|handoff)/i)
 })
 test(`${source} changed existing style content stays explicitly unknown even with visible native delegation`,async t=>{
  const target=JSON.parse(Object.entries(fixture(source).entries).find(([u])=>u.endsWith('/jobs?content=true'))[1].body).jobs[0].id
  const {jobs,audit,evidence}=await execute(t,source,(r,u)=>{
   if(!u.includes('boards-api'))r.body=r.body.replace(/<\/style\s*>/i,'.unreviewed-hiring-policy-note{color:navy}</style>')
   else{const p=JSON.parse(r.body);for(const row of p.jobs||[p])if(row.id===target){row.location={name:'Bengaluru, India'};row.offices=[]}r.body=JSON.stringify(p)}
  })
  assert.equal(jobs.length,1)
  assert.equal(jobs[0].sourceDetailComplete,true)
  assert.ok(audit.scopeReasons.includes('unreviewed-corporate-style-content'))
  assert.ok(audit.openingVisibleProof.boardLinks.length||audit.openingVisibleProof.roleIds.length)
  assert.equal(evidence.listingComplete,false)
  assert.equal(evidence.reportedTotal,null)
  assert.equal(evidence.indiaFacetCount,null)
  assert.match(audit.openingEmployerHtml,/unreviewed-hiring-policy-note/)
 })
}
