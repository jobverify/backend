import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run,CAREERS_PAGE_URL,ASHBY_JOB_BOARD_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {readAppData} from '../../scraper-support/shared/ashbyPairNative20261027.js'
import {parse} from 'acorn'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-http-20261030.json.gz',import.meta.url))))
const hash=value=>createHash('sha256').update(value).digest('hex')
const payload=()=>JSON.parse(fixture.responses.find(row=>row.url===ASHBY_JOB_BOARD_URL).body)
const replay=async({mutateJson,mutatePage}={})=>{
 const calls=[],audits=[]
 const page=async url=>{
  const original=fixture.responses.find(row=>row.url===url)
  assert.ok(original,'Unexpected real-fixture URL '+url);calls.push(url)
  const result={status:original.status,url:original.finalUrl,html:original.body}
  return mutatePage?mutatePage(result,url,calls.filter(value=>value===url).length):result
 }
 const jobs=await run({fetchPage:page,fetchText:async url=>(await page(url)).html,
  fetchJson:async url=>{assert.equal(url,ASHBY_JOB_BOARD_URL);calls.push(url);const value=payload();return mutateJson?mutateJson(value,calls.filter(item=>item===url).length):value},
  onAudit:value=>audits.push(value)})
 return{jobs,calls,audit:audits.at(-1),evidence:readInventoryEvidence(jobs)}
}

test('fixtures retain all five original HTTP bodies with exact hashes',()=>{
 for(const row of fixture.responses){assert.equal(hash(row.body),row.sha256);assert.equal(Buffer.byteLength(row.body),row.bytes)}
})
test('registered GitBook output preserves both global roles and unknown Remote country',async()=>{
 const {jobs,evidence,audit}=await replay()
 assert.equal(jobs.length,2)
 assert.deepEqual(jobs.map(job=>job.jobId),payload().jobs.map(job=>job.id))
 for(const job of jobs){
  assert.equal(job.country,null);assert.equal(job.city,null);assert.equal(job.nativeAddressCountry,'Remote')
  assert.equal(job.location,'Europe (+/- 3 hours)');assert.equal(job.sourceDetailComplete,true)
  assert.equal(job.sourceListingComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
  const original=payload().jobs.find(row=>row.id===job.jobId)
  assert.deepEqual(job.sourceNativeRecord,original);assert.equal(job.sourceDescription,original.descriptionHtml)
  assert.equal(job.sourceNativeDescriptionPlain,original.descriptionPlain)
 }
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.reportedTotal,null)
 assert.equal(audit.nativeCount,2);assert.equal(audit.closingInventoryMatches,true)
 assert.equal(audit.unavailableAdvertisedRoleProofs.length,1)
 assert.equal(audit.unavailableAdvertisedRoleProofs[0].jobId,'c48ae730-ff3f-4fed-b679-94ccc39686b5')
 assert.equal(audit.unknownCountryRoleIds.length,2)
})
for(const [name,mutate] of [
 ['duplicate native identity',value=>{value.jobs.push(value.jobs[0]);return value}],
 ['failed envelope',value=>({...value,success:false})],
 ['truncated envelope',value=>({...value,hasMore:true})],
 ['foreign native board',value=>{value.jobs[0].jobUrl=value.jobs[0].jobUrl.replace('/GitBook/','/Other/');return value}],
 ['nested native criteria object',value=>{value.jobs[0].descriptionHtml={mustHave:'mandatory license'};return value}],
])test('GitBook rejects '+name,async()=>{await assert.rejects(replay({mutateJson:mutate}),/inventory|envelope|identity|content/i)})
test('GitBook rejects a changed closing native inventory',async()=>{
 await assert.rejects(replay({mutateJson:(value,n)=>{if(n===2)value.jobs.pop();return value}}),/closing.inventory.changed/i)
})
for(const [name,mutate]of[
 ['foreign employer redirect',page=>({...page,url:'https://other.example/careers'})],
 ['non-200 employer response',page=>({...page,status:503})],
 ['Ashby URLs present only in inert text',page=>({...page,html:page.html.replaceAll('https://jobs.ashbyhq.com/GitBook/','https://example.com/closed/')+'<script>"https://jobs.ashbyhq.com/GitBook"</script>'})],
])test('GitBook rejects '+name,async()=>{
 await assert.rejects(replay({mutatePage:(page,url)=>url===CAREERS_PAGE_URL?mutate(page):page}),/employer|handoff|binding/i)
})
test('an additional corporate recruiting channel revokes the reviewed declaration binding',async()=>{
 await assert.rejects(replay({mutatePage:(page,url)=>url===CAREERS_PAGE_URL?{...page,html:page.html.replace('</body>','<a href="https://jobs.example/careers">Open roles</a></body>')}:page}),/employer.*scope|handoff|binding/i)
})
test('an unknown native criteria field revokes detail completeness while retaining the full raw record',async()=>{
 const {jobs}=await replay({mutateJson:value=>{value.jobs[0].mandatoryLicense='special certification';return value}})
 assert.equal(jobs.length,2);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(jobs[0].sourceNativeRecord.mandatoryLicense,'special certification')
})
test('a changed native role description cannot certify the feed description as complete',async()=>{
 const {jobs,audit}=await replay({mutatePage:(page,url)=>url.includes('/531ab2e2-')?{...page,html:page.html.replaceAll('Global Field Marketing Manager','Foreign role')}:page})
 assert.equal(jobs.length,2);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(audit.detailProofs[0].complete,false)
})
test('an unavailable-looking 200 error page cannot qualify the stale corporate role',async()=>{
 const {audit,evidence}=await replay({mutatePage:(page,url)=>url.includes('/c48ae730-')?{...page,status:200}:page})
 assert.equal(audit.unavailableAdvertisedRoleProofs.length,0)
 assert.equal(audit.unresolvedAdvertisedRoleIds.length,1);assert.equal(evidence.listingComplete,false)
})
for(const [name,mutate]of[
 ['unknown criteria inside the native postal address',row=>{row.address.postalAddress.mandatoryLicense={required:'registered specialist'}}],
 ['unknown criteria inside native location metadata',row=>{row.address.extraEligibility='citizenship required'}],
])test(name+' revokes detail completeness without losing raw data',async()=>{
 const {jobs}=await replay({mutateJson:value=>{mutate(value.jobs[0]);return value}})
 assert.equal(jobs.length,2);assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(jobs[1].sourceDetailComplete,true)
})
for(const [name,mutate]of[
 ['absent mandatory native field',posting=>{delete posting.departmentName}],
 ['object-shaped native team names',posting=>{posting.teamNames={mandatory:'qualification'}}],
 ['unreconciled native salary criteria',posting=>{posting.scrapeableCompensationSalarySummary='Requires active license'}],
])test(name+' cannot retain a complete detail flag',async()=>{
 const {jobs}=await replay({mutatePage:(page,url)=>{
  if(!url.includes('/531ab2e2-'))return page
  return replaceApp(page,app=>mutate(app.posting))
 }})
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[1].sourceDetailComplete,true)
})
test('default inventory HTTP transport rejects a foreign final URL',async()=>{
 const originalFetch=globalThis.fetch
 try{
  globalThis.fetch=async url=>{
   assert.equal(String(url),ASHBY_JOB_BOARD_URL)
   const response=new Response(JSON.stringify(payload()),{status:200,headers:{'content-type':'application/json'}})
   Object.defineProperty(response,'url',{value:'https://other.example/inventory'});return response
  }
  await assert.rejects(run({fetchPage:async url=>{
   const row=fixture.responses.find(row=>row.url===url);assert.ok(row)
   return{status:row.status,url:row.finalUrl,html:row.body}
  }}),/native.inventory.response|final.URL|foreign/i)
 }finally{globalThis.fetch=originalFetch}
})
const replaceApp=(page,change)=>{
 const script=readNativeDocument(page.html).nodes(node=>node.tag==='script'&&/window\.__appData\s*=/.test(node.raw||''))[0]
 const app=readAppData(script.raw);change(app)
 const assignment=parse(script.raw,{ecmaVersion:'latest'}).body[0].expression
 const replacement=script.raw.slice(0,assignment.right.start)+JSON.stringify(app)+script.raw.slice(assignment.right.end)
 return{...page,html:page.html.replace(script.raw,replacement)}
}
const replaceSchema=(page,change)=>({...page,html:page.html.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)([\s\S]*?)(<\/script>)/g,(_,a,body,b)=>{
 const value=JSON.parse(body);if(value['@type']==='JobPosting')change(value);return a+JSON.stringify(value)+b
})})
for(const [name,mutate]of[
 ['foreign schema employer',schema=>{schema.hiringOrganization.name='Other Employer'}],
 ['additional mandatory schema criterion',schema=>{schema.qualifications='Requires professional certification'}],
])test(name+' revokes complete native criteria',async()=>{
 const {jobs}=await replay({mutatePage:(page,url)=>url.includes('/531ab2e2-')?replaceSchema(page,mutate):page})
 assert.equal(jobs[0].sourceDetailComplete,false)
})
test('an invalid native publication timestamp is retained only as raw evidence',async()=>{
 const {jobs}=await replay({mutateJson:value=>{value.jobs[0].publishedAt='not-a-date';return value}})
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].postingDate,null)
 assert.equal(jobs[0].sourceNativeRecord.publishedAt,'not-a-date')
})
test('a conditional app-data assignment does not establish active native role criteria',async()=>{
 const {jobs}=await replay({mutatePage:(page,url)=>url.includes('/531ab2e2-')?{...page,html:page.html.replace(/window\.__appData\s*=/,'if(false) window.__appData =')}:page})
 assert.equal(jobs[0].sourceDetailComplete,false)
})
test('copied opacity-hidden criteria never appear as visible job text or complete criteria',async()=>{
 const extra='<p style="opacity:0">Copied hidden mandatory criterion</p>'
 const {jobs}=await replay({mutateJson:value=>{value.jobs[0].descriptionHtml+=extra;return value},
  mutatePage:(page,url)=>url.includes('/531ab2e2-')?replaceSchema(replaceApp(page,app=>{app.posting.descriptionHtml+=extra}),schema=>{schema.description+=extra}):page})
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription.includes('Copied hidden mandatory criterion'),false)
})
test('a new stylesheet hiding all source declarations revokes employer binding',async()=>{
 await assert.rejects(replay({mutatePage:(page,url)=>url===CAREERS_PAGE_URL?{...page,html:page.html.replace(/<\/style\s*>/i,'a[href*="ashbyhq.com"]{display:none!important}</style>')}:page}),/employer.*scope|handoff|binding/i)
})
test('conflicting remote contracts cannot manufacture an India worksite',async()=>{
 const {jobs}=await replay({mutateJson:value=>{Object.assign(value.jobs[0],{location:'Bengaluru, India',isRemote:false});Object.assign(value.jobs[0].address.postalAddress,{addressCountry:'IN',addressLocality:'Bengaluru'});return value},
  mutatePage:(page,url)=>url.includes('/531ab2e2-')?replaceSchema(replaceApp(page,app=>{app.posting.locationName='Bengaluru, India';app.posting.locationAddress={postalAddress:{addressCountry:'IN',addressLocality:'Bengaluru'}}}),schema=>{schema.jobLocation.address.addressCountry='IN';schema.jobLocation.address.addressLocality='Bengaluru'}):page})
 assert.equal(jobs[0].country,null);assert.equal(jobs[0].sourceDetailComplete,false)
})
test('caller cancellation during the final corporate response cannot return successful jobs',async()=>{
 const controller=new AbortController();let corporateRequests=0
 await assert.rejects(run({signal:controller.signal,
  fetchJson:async()=>payload(),fetchPage:async url=>{
   const row=fixture.responses.find(value=>value.url===url);assert.ok(row)
   if(url===CAREERS_PAGE_URL&&++corporateRequests===2)controller.abort(new Error('caller cancelled'))
   return{status:row.status,url:row.finalUrl,html:row.body}
  }}),/caller cancelled/)
})
for(const [name,change]of[
 ['nested address criterion',schema=>{schema.jobLocation.address.mandatoryLicense='A license is required'}],
 ['object direct-application metadata',schema=>{schema.directApply={mandatoryLicense:'Required'}}],
 ['object employer logo metadata',schema=>{schema.hiringOrganization.logo={mandatoryLicense:'Required'}}],
 ['object applicant requirement',schema=>{schema.applicantLocationRequirements.name={mandatoryLicense:'Required'}}],
])test(name+' cannot hide a requirement in a complete schema',async()=>{
 const {jobs}=await replay({mutatePage:(page,url)=>url.includes('/531ab2e2-')?replaceSchema(page,change):page})
 assert.equal(jobs[0].sourceDetailComplete,false)
})
for(const [name,change]of[
 ['nested posting location criterion',posting=>{posting.locationAddress={postalAddress:{mandatoryLicense:'Required'}}}],
 ['object legal-entity metadata',posting=>{posting.legalEntityNameForTextingConsent={mandatoryLicense:'Required'}}],
])test(name+' cannot hide a requirement in complete native data',async()=>{
 const {jobs}=await replay({mutatePage:(page,url)=>url.includes('/531ab2e2-')?replaceApp(page,app=>change(app.posting)):page})
 assert.equal(jobs[0].sourceDetailComplete,false)
})
test('a comment decoy cannot replace the actual app-data assignment',async()=>{
 const {jobs}=await replay({mutatePage:(page,url)=>{
  if(!url.includes('/531ab2e2-'))return page
  const script=readNativeDocument(page.html).nodes(node=>node.tag==='script'&&/window\.__appData\s*=/.test(node.raw||''))[0]
  const decoy=readAppData(script.raw),changed=replaceApp(page,app=>{app.environment='not-production'})
  return{...changed,html:changed.html.replace('window.__appData =','/* window.__appData = '+JSON.stringify(decoy)+'; */ window.__appData =')}
 }})
 assert.equal(jobs[0].sourceDetailComplete,false)
})
test('calendar rollover does not turn September 31 into a valid publication date',async()=>{
 const {jobs}=await replay({mutateJson:value=>{value.jobs[0].publishedAt='2026-09-31T00:00:00.000Z';return value},
  mutatePage:(page,url)=>url.includes('/531ab2e2-')?replaceSchema(page,schema=>{schema.datePosted='2026-10-01'}):page})
 assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].postingDate,null)
})
test('an unreviewed JSON-LD context cannot redefine a complete native posting',async()=>{
 const {jobs}=await replay({mutatePage:(page,url)=>url.includes('/531ab2e2-')?replaceSchema(page,schema=>{schema['@context']={mandatoryLicense:'Required'}}):page})
 assert.equal(jobs[0].sourceDetailComplete,false)
})
test('an extra address-wrapper type cannot conceal a native eligibility object',async()=>{
 const {jobs}=await replay({mutateJson:value=>{value.jobs[0].address['@type']={mandatoryLicense:'Required'};return value}})
 assert.equal(jobs[0].sourceDetailComplete,false)
 assert.equal(jobs[0].sourceNativeRecord.address['@type'].mandatoryLicense,'Required')
})
test('the default HTTP stack retains native 404 metadata for the advertised unavailable role',async()=>{
 const originalFetch=globalThis.fetch;let audit
 try{
  globalThis.fetch=async url=>{
   const row=fixture.responses.find(value=>value.url===String(url));assert.ok(row,'Unexpected real fixture URL '+url)
   const response=new Response(row.body,{status:row.status,headers:{'content-type':row.contentType}})
   Object.defineProperty(response,'url',{value:row.finalUrl});return response
  }
  const jobs=await run({onAudit:value=>{audit=value}})
  assert.equal(jobs.length,2);assert.equal(audit.unavailableAdvertisedRoleProofs.length,1)
  assert.equal(audit.unresolvedAdvertisedRoleIds.length,0)
  assert.equal(readInventoryEvidence(jobs).pagesFetched,9)
 }finally{globalThis.fetch=originalFetch}
})
