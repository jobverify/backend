import assert from 'node:assert/strict'
import test from 'node:test'
import { createValtechindiasystemsScraper } from '../../scraper/valtechindiasystems/script.js'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'
import { getScraperCatalog, createCatalogScraper } from '../providers/index.js'
import { visibleText } from '../../scraper/valtechindiasystems/nativeVisibility.js'
// No test may fall through to the legacy live transport before the repair.
globalThis.fetch = async () => { throw Error('Uninjected live transport is forbidden in this offline test') }

const C='https://www.valtech.com/en-in/career/', J=C+'jobs/', B='https://job-boards.eu.greenhouse.io/valtech'
const API='https://www.valtech.com/joblist/getjsonresult?id=1571&language=en-IN&limit=100'
const now=()=> '2026-10-27T12:00:00.000Z'
const text='<h3>Requirements</h3><p>Build accessible systems with Java.</p><ul><li>Seven years of engineering experience.</li><li>Work authorization in India is required.</li></ul><h3>Benefits</h3><p>Learning allowance and inclusive teams.</p>'
const nativeRow=(i=1)=>({id:i,internal_job_id:100+i,title:'Engineer '+i,location:'Bengaluru',absolute_url:B+'/jobs/'+i,requisition_id:'REQ-'+i,published_at:'2026-10-20T10:00:00-04:00',updated_at:'2026-10-26T12:00:00-04:00',department:{id:10,name:'Engineering'}})
const root=isJobPost=>({urlToken:'valtech',internal:false,preview:false,isJobPost,boardConfiguration:{job_board_id:4003061101,job_board_public_url:B,header_text:'Current openings at Valtech'}})
const offices=[{id:1,name:'APMENA',children:[{id:2,name:'India',children:[{id:3,name:'Bengaluru',children:[]}]}]}]
const model=(r,route,data)=>`<script>window.__remixContext = ${JSON.stringify({state:{errors:null,loaderData:{root:r,[route]:data}}}).replaceAll('<','\\u003c')};</script>`
const board=(rows,page=1)=>{
 const data=rows.slice((page-1)*50,page*50)
 return `<h1>Current openings at Valtech</h1><h2>${rows.length} jobs</h2>${data.map(r=>`<a href="${r.absolute_url}">${r.title} ${r.location}</a>`).join('')}`+model(root(false),'routes/$url_token',{urlToken:'valtech',board:{name:'Valtech',public_url:B,redirect_to:null},departmentIds:[],officeIds:[],customFieldFilters:{},offices,jobPosts:{page,count:data.length,total:rows.length,total_pages:Math.max(1,Math.ceil(rows.length/50)),data}})
}
const detail=(row,options={})=>{
 const job={post_type:'job_post',company_name:'Valtech',title:row.title,job_post_location:row.location,public_url:row.absolute_url,hiring_plan_id:row.internal_job_id,published_at:row.published_at,redirect_to:null,application_deadline:null,introduction:'<p>Why Valtech? Work with us.</p>',content:text,conclusion:'<p>Equal opportunity employer.</p>',employment:'hidden',pay_ranges:[],questions:[{required:true,label:'Are you authorized to work in India?',fields:[{type:'multi_value_single_select',name:'question_1',values:[{value:1,label:'Yes'},{value:0,label:'No'}]}]}],...options.job}
 return `<h1>${job.title}</h1><div class="job__location">${job.job_post_location}</div><div class="job__description">${job.introduction}${job.content}${job.conclusion}</div><form id="application-form" action="${row.absolute_url}"></form>`+model(root(true),'routes/$url_token_.jobs_.$job_post_id',{urlToken:'valtech',jobPostId:String(row.id),submitPath:'https://boards.eu.greenhouse.io/valtech/jobs/'+row.id,confirmationPath:'/valtech/jobs/'+row.id+'/confirmation',jobPost:job})
}
const fixture=(options={})=>{
 const rows=options.rows || [nativeRow()], calls=[], counts=new Map(), corporate=rows.map(r=>({id:r.id+1000,title:r.title,url:'/en-in/career/jobs/'+r.id+'/',offices:[r.location],tags:['india','engineering']}))
 if(options.extra)corporate.push({id:900,title:'Other native scope',url:'/en-in/career/jobs/other-scope/',offices:['Bengaluru'],tags:['india']})
 const landing=`<head><title>Career | Valtech</title><link rel="canonical" href="${C}"></head><h1>Wanted: Innovators, Thinkers, Doers</h1><a href="${J}">Joblist</a>`
 const jobs=`<head><title>Jobs | Valtech</title><link rel="canonical" href="${J}"></head><react data-react-component-name="JobsPage" data-url="${API.replaceAll('&','&amp;')}"></react>`
 const fetchPage=async(url,init)=>{
  assert.equal(init.method,'GET');calls.push(url);const n=(counts.get(url)||0)+1;counts.set(url,n)
  let body, status=200,contentType='text/html'
  if(options.response){const custom=options.response(url,n);if(custom)return{url,contentType,...custom}}
  if(url===C)body=landing
  else if(url===J)body=jobs
  else if(url.startsWith(API)){contentType='application/json';const offset=Number(new URL(url).searchParams.get('offset'));body=JSON.stringify(JSON.stringify({filters:[{value:'country',tags:[{value:'india',text:'India',stringValue:'india'},{value:'france',text:'France',stringValue:'france'}]}],list:corporate.slice(offset,offset+100).map(r=>({...r,tags:options.corporateTags||r.tags})),page:{itemTotal:corporate.length,pageOffset:offset,pageLimit:100,pageQuery:{offset,limit:100,language:'en-IN',country:new URL(url).searchParams.has('country')?['india']:[],department:[],expertise:[]}}}))}
  else if(url===B||url.startsWith(B+'?page='))body=board(options.closingRows&&n>1?options.closingRows:rows,Number(new URL(url).searchParams.get('page')||1))
  else if(url.startsWith(B+'/jobs/'))body=detail(rows.find(r=>r.absolute_url===url),options)
  else{const r=corporate.find(r=>new URL(r.url,C).href===url);if(!r)throw Error('Unexpected fixture URL '+url);body=`<h1>${r.title}</h1><h2>${r.offices[0]}</h2><a href="${r.id===900?'https://other.example/careers':B+'/jobs/'+(r.id-1000)}">Apply</a>`}
  return {url,status,body,contentType}
 }
 return {calls,fetchPage}
}
const run=async(options={})=>{const f=fixture(options);const jobs=await createValtechindiasystemsScraper({now}).run({fetchPage:f.fetchPage,...options.run});return{...f,jobs,evidence:readInventoryEvidence(jobs)}}

test('retains all native criteria and real identity, dates, requisition and public application context',async()=>{
 const {jobs,evidence}=await run();assert.equal(jobs.length,1);const j=jobs[0]
 assert.equal(j.company,'Valtech');assert.equal(j.legalEmployer,null);assert.equal(j.requisitionId,'REQ-1');assert.equal(j.postingDate,'2026-10-20T14:00:00.000Z');assert.equal(j.postedAt,j.postingDate)
 assert.equal(j.country,'India');assert.equal(j.city,'Bengaluru');assert.equal(j.applyUrl,B+'/jobs/1');assert.equal(j.sourceDescription,j.jobDescription)
 assert.match(j.sourceDescription,/Seven years/);assert.match(j.sourceDescription,/Learning allowance/);assert.match(j.sourceDescription,/Equal opportunity/)
 assert.equal(j.sourceNativeCriteria.questions[0].label,'Are you authorized to work in India?');assert.equal(evidence.listingComplete,true);assert.equal(j.lifecycleCleanupAllowed,true)
})
test('preserves null native dates/requisitions and never substitutes updated_at',async()=>{
 const row={...nativeRow(),requisition_id:null,published_at:null};const {jobs}=await run({rows:[row]});assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].postingDate,null);assert.equal(jobs[0].postedAt,null);assert.equal(jobs[0].sourcePublicationDateUnavailable,true)
})
test('corporate additional India scope remains partial even when native role is complete',async()=>{
 const {jobs,evidence}=await run({extra:true});assert.equal(jobs.length,1);assert.equal(evidence.listingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.match(evidence.reason,/inventories-differ|additional/)
})
test('enumerates every page and details before applying output cap',async()=>{
 const rows=Array.from({length:51},(_,i)=>nativeRow(i+1));const {jobs,calls,evidence}=await run({rows,run:{maxJobs:1}})
 assert.equal(jobs.length,1);assert.equal(calls.filter(u=>u.startsWith(B+'/jobs/')).length,51);assert.equal(calls.filter(u=>u===B+'?page=2').length,2);assert.equal(evidence.listingComplete,false)
})
test('unknown native geography cannot be inferred from a city alone',async()=>{
 const {jobs,evidence}=await run({rows:[{...nativeRow(),location:'Unmapped City'}]});assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
})
test('closing changes exclude the changed role and prevent cleanup',async()=>{
 const {jobs,evidence}=await run({closingRows:[{...nativeRow(),updated_at:'2026-10-27T10:00:00Z'}]});assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)
})
for(const status of [401,403,429])test('stops immediately at public HTTP '+status,async()=>{
 const f=fixture({response:url=>url===C?{status,body:'denied'}:null});await assert.rejects(createValtechindiasystemsScraper({now}).run({fetchPage:f.fetchPage}),new RegExp(String(status)));assert.equal(f.calls.length,1)
})
test('stops at explicit denial and honors cancellation before any request',async()=>{
 const f=fixture({response:url=>url===C?{status:200,body:'<h1>Access denied</h1>'}:null});await assert.rejects(createValtechindiasystemsScraper({now}).run({fetchPage:f.fetchPage}),/deni/i);assert.equal(f.calls.length,1)
 const a=fixture(),controller=new AbortController();controller.abort();await assert.rejects(createValtechindiasystemsScraper({now}).run({fetchPage:a.fetchPage,signal:controller.signal}),/abort/i);assert.equal(a.calls.length,0)
})
for(const style of ['opacity:0','opacity:00','opacity:+0','opacity:0e0','opac&#x69;ty:0','opacity:/*comment*/0','display:none','visibility:hidden','opacity&colon;0','opacity:&Tab;0','opacity:&#48','opacity:&#x30'])test('excludes nonrendering criteria '+style,async()=>{
 const {jobs}=await run({job:{content:text+`<p style=${style.includes('comment')?'"'+style+'"':style}>HIDDEN_CRITERION</p>`}});assert.equal(jobs.length,1);assert.doesNotMatch(jobs[0].sourceDescription||'',/HIDDEN_CRITERION/)
})
test('hiding stylesheet and unsupported CSS cannot expose invisible criteria',async()=>{
 const {jobs}=await run({job:{content:text+'<style>.invisible{opacity:00}</style><p class="invisible">HIDDEN_CRITERION</p>'}});assert.doesNotMatch(jobs[0]?.sourceDescription||'',/HIDDEN_CRITERION/)
 const unknown=await run({job:{content:text+'<style>[data-hidden]{opacity:0}</style><p data-hidden>HIDDEN_CRITERION</p>'}});assert.equal(unknown.evidence.listingComplete,false);assert.equal(unknown.jobs[0]?.sourceDetailComplete,false)
})
test('native employer conflicts reject and extra structured criteria retain partial evidence',async()=>{
 await assert.rejects(run({job:{company_name:'Other Company'}}),/employer|identity/i)
 const {jobs,evidence}=await run({job:{minimum_qualification:'Certification is required'}});assert.equal(evidence.listingComplete,false);assert.equal(jobs[0].sourceDetailComplete,false)
})
test('expired roles are excluded with partial lifecycle evidence',async()=>{const{jobs,evidence}=await run({job:{application_deadline:'2026-10-26T00:00:00Z'}});assert.equal(jobs.length,0);assert.equal(evidence.listingComplete,false)})
test('native country and role-owned corporate country contradictions fail closed',async()=>{await assert.rejects(run({corporateTags:['france']}),/country conflicts/);await assert.rejects(run({job:{country:'France'}}),/country conflicts/)})
test('native closed notice and unreviewed structured pay ranges stay unresolved',async()=>{
 const closed=await run({job:{content:'<p>This job is closed and no longer accepting applications.</p>'}});assert.equal(closed.jobs.length,0)
 const pay=await run({job:{pay_ranges:[{minimum:'<span style="opacity:0">SECRET</span>',currency:'INR'}]}});assert.equal(pay.evidence.listingComplete,false);assert.equal(pay.jobs[0]?.sourceDetailComplete,false);assert.equal(pay.jobs[0]?.sourceNativeCriteria.payRanges,null)
})
test('inert, commented and entity-encoded hidden requirements never reach public descriptions',async()=>{
 const{jobs}=await run({job:{content:text+'<template>HIDDEN_TEMPLATE</template><!-- HIDDEN_COMMENT --><p style="display:&#110;one">HIDDEN_ENTITY</p><script>HIDDEN_SCRIPT</script>'}});assert.doesNotMatch(jobs[0].sourceDescription,/HIDDEN_/)
})
test('later denial ends the run before another role or closing request',async()=>{
 const f=fixture({rows:[nativeRow(1),nativeRow(2)],response:url=>url===B+'/jobs/1'?{status:403,body:'<h1>Access denied</h1>'}:null});await assert.rejects(createValtechindiasystemsScraper({now}).run({fetchPage:f.fetchPage}),/403/);assert.equal(f.calls.at(-1),B+'/jobs/1');assert.equal(f.calls.includes(B+'/jobs/2'),false)
})
test('pagination, filtered native data and duplicate identities fail closed',async()=>{
 await assert.rejects(run({rows:Array.from({length:51},(_,i)=>nativeRow(i+1)),run:{maxPages:1}}),/budget exhausted/)
 const f=fixture({response:url=>url===B?{status:200,body:board([nativeRow()]).replace('"officeIds":[]','"officeIds":[2]')}:null});await assert.rejects(createValtechindiasystemsScraper({now}).run({fetchPage:f.fetchPage}),/filtered/)
})
test('native New badge and additional description headings preserve role identity',async()=>{
 const f=fixture({response:url=>url===B?{status:200,body:board([nativeRow()]).replace('Engineer 1 Bengaluru</a>','Engineer 1 <span class="tag-container"><span class="tag-text">New</span></span>Bengaluru</a>')}:null});const jobs=await createValtechindiasystemsScraper({now}).run({fetchPage:f.fetchPage});assert.equal(jobs.length,1)
})
test('explicit India Remote scopes use native country text and preserve a null city',async()=>{const{jobs}=await run({rows:[{...nativeRow(),location:'India - Remote'}]});assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].city,null);assert.equal(jobs[0].remoteStatus,'Remote')})
for(const style of ['filter:opacity(0)','font-size:0','color:transparent','transform:scale(0)'])test('unreviewed nonrendering CSS stays partial '+style,async()=>{const{jobs,evidence}=await run({job:{content:text+`<p style="${style}">HIDDEN_CRITERION</p>`}});assert.doesNotMatch(jobs[0].sourceDescription||'',/HIDDEN_CRITERION/);assert.equal(evidence.listingComplete,false)})
for(const entity of ['&#38;#48;','&amp;#48;']){
 const content=`<p>Required degree.</p><p style="opacity:${entity}">Required SQL certification.</p>`
 test('direct CSS parsing retains or flags once-decoded visible criterion '+entity,()=>{
  const direct=visibleText(content)
  assert.ok(direct.unresolved||direct.text?.includes('Required SQL certification.'),'visible criteria must be retained or explicitly unresolved')
 })
 test('runtime cannot claim complete criteria after dropping once-decoded visible requirement '+entity,async()=>{
  const runtime=await run({job:{content}})
  assert.ok(!runtime.jobs[0].sourceDetailComplete||runtime.jobs[0].sourceDescription?.includes('Required SQL certification.'))
 })
 test('registered factory cannot claim complete criteria after dropping once-decoded visible requirement '+entity,async()=>{
  const f=fixture({job:{content}}),provider=getScraperCatalog().find(p=>p.source==='valtechindiasystems')
  const jobs=await createCatalogScraper(provider).run({fetchPage:f.fetchPage,now})
  assert.ok(!jobs[0].sourceDetailComplete||jobs[0].sourceDescription?.includes('Required SQL certification.'))
  if(visibleText(content).unresolved){assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].sourceDescription,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false)}
 })
}
test('invalid literal opacity keeps visible criteria while one-pass encoded numeric zero hides it',()=>{
 const visible=visibleText('<p>Required degree.</p><p style="opacity:invalid">Required SQL certification.</p>')
 assert.equal(visible.unresolved,false);assert.match(visible.text,/Required SQL certification/)
 for(const value of ['&#48;','&#x30;']){
  const hidden=visibleText(`<p>Required degree.</p><p style="opacity:${value}">Hidden SQL requirement.</p>`)
  assert.equal(hidden.unresolved,false);assert.match(hidden.text,/Required degree/);assert.doesNotMatch(hidden.text,/Hidden SQL/)
 }
})
const rawStyleCriterion='<style>.sql{opacity:&#48;}</style><p>Required degree.</p><p class="sql">Required SQL certification.</p>'
test('style raw text retains a visible criterion when literal HTML entities make CSS invalid',()=>{
 const direct=visibleText(rawStyleCriterion)
 assert.ok(direct.unresolved||direct.text?.includes('Required SQL certification.'))
})
test('runtime never silently hides a criterion through entity decoding in raw stylesheet text',async()=>{
 const{jobs}=await run({job:{content:rawStyleCriterion}})
 assert.ok(!jobs[0].sourceDetailComplete||jobs[0].sourceDescription?.includes('Required SQL certification.'))
})
test('registered factory preserves or flags a visible criterion behind invalid raw stylesheet CSS',async()=>{
 const f=fixture({job:{content:rawStyleCriterion}}),provider=getScraperCatalog().find(p=>p.source==='valtechindiasystems')
 const jobs=await createCatalogScraper(provider).run({fetchPage:f.fetchPage,now})
 assert.ok(!jobs[0].sourceDetailComplete||jobs[0].sourceDescription?.includes('Required SQL certification.'))
})
