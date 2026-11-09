import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import {run as sourceRun} from './script.js'
import {document} from '../../scraper-support/shared/rmkNativePairHtml.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {analyzePublishableJobs} from '../../scraper-support/utils/publishableJobMetrics.js'
globalThis.fetch=async()=>{throw Object.assign(Error('Public network prohibited in native fixture tests'),{code:'FIXTURE_NETWORK_BLOCKED'})}
const run=options=>sourceRun({...options,fetchText:async()=>{throw Object.assign(Error('Legacy public network path prohibited in fixtures'),{code:'FIXTURE_NETWORK_BLOCKED'})}})
const HOME='https://www.okta.com/company/careers/',BOARD=HOME+'job-listing/'
const FRESH=HOME+'rd/senior-software-engineer-core-frontier-8305423/',OLD=HOME+'rd/senior-data-engineer-7572029/'
const now=()=> '2026-10-23T12:00:00.000Z'
const pack=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261023.json.gz',import.meta.url))))
function mock({mutate=p=>p}={}){
 const calls=[],stored=pack.requests.find(p=>p.url===BOARD),html=Buffer.from(stored.rawBodyBase64,'base64').toString(),d=document(html)
 const rows=d.nodes(n=>d.hasClass(n,'views-row')),wanted=new Set(pack.requests.filter(p=>p.url!==BOARD&&p.url!==HOME).map(p=>p.url))
 let nonIndia=null,listing=html
 for(const row of [...rows].reverse()){
  const links=d.nodes(n=>n.tag==='a'&&n.attrs.href,row),url=links.length===1?new URL(links[0].attrs.href,HOME).href:null
  if(wanted.has(url))continue
  if(!nonIndia&&!/\bIndia\b/.test(d.text(row))){nonIndia=url;continue}
  listing=listing.slice(0,row.start)+listing.slice(row.end)
 }
 return{calls,async transport(url,request){
  calls.push(url);assert.equal(request.method,'GET');assert.ok(!/myworkdayjobs|greenhouse|\/apply|docs\.google\.com/.test(url))
  const p=pack.requests.find(p=>p.url===url);assert.ok(p,url)
  return mutate({...p,body:url===BOARD?Buffer.from(listing):Buffer.from(p.rawBodyBase64,'base64'),bodyComplete:true},calls)
 }}
}
function editSchema(p,action){
 const html=p.body.toString(),d=document(html),script=d.nodes(n=>n.tag==='script'&&n.attrs.type==='application/ld+json'&&JSON.parse(n.raw)['@type']==='JobPosting')[0]
 const data=JSON.parse(script.raw);action(data)
 return{...p,body:Buffer.from(html.slice(0,script.openEnd)+JSON.stringify(data)+html.slice(script.closeStart))}
}
function editBody(p,body){
 const html=p.body.toString(),d=document(html),node=d.nodes(n=>d.hasClass(n,'Job__content'))[0]
 return{...p,body:Buffer.from(html.slice(0,node.openEnd)+body+html.slice(node.closeStart))}
}
test('Okta preserves full native role HTML and real dates instead of null dates and generic snippets',async()=>{
 const m=mock(),jobs=await run({transport:m.transport,now});assert.equal(jobs.length,4)
 const fresh=jobs.find(j=>j.jobId==='8305423'),old=jobs.find(j=>j.jobId==='7572029')
 assert.equal(fresh.postingDate,'2026-10-21T00:00:00.000Z');assert.equal(fresh.nativePublicationPrecision,'day')
 assert.equal(old.postingDate,'2026-07-30T00:00:00.000Z');assert.equal(fresh.nativeFacts.nativePostedDate.raw,'2026-10-21')
 assert.equal(fresh.company,'Okta');assert.equal(fresh.nativeHiringOrganization.name,'Okta, Inc.')
 assert.equal(fresh.country,'India');assert.equal(fresh.city,'Bengaluru');assert.equal(fresh.nativeInternalJobID,'3591002')
 const native=document(Buffer.from(pack.requests.find(p=>p.url===FRESH).rawBodyBase64,'base64').toString())
 assert.equal(fresh.sourceDescription,native.inner(native.nodes(n=>native.hasClass(n,'Job__content'))[0]))
 assert.notEqual(fresh.sourceDescription,fresh.nativeSchemaDescription);assert.match(fresh.sourceDescription,/What you will do/)
 assert.doesNotMatch(fresh.sourceDescription,/<form|First Name|Upload Resume/i)
 assert.equal(fresh.sourceUrl,FRESH);assert.equal(fresh.applyUrl,null);assert.equal(fresh.link,FRESH)
 assert.equal(fresh.applicationVisited,false);assert.equal(fresh.lifecycleCleanupAllowed,false);assert.equal(fresh.sourceScopeComplete,false)
 const analysis=analyzePublishableJobs(jobs,{now:new Date(now())});assert.equal(analysis.eligibleJobs.length,3);assert.equal(analysis.filterCounts.old,1)
 const c=jobs[0].nativeCollectionEvidence;assert.equal(c.observedListingCount,5);assert.equal(c.candidateDetails,4)
 assert.equal(c.nativeReportedTotal,null);assert.equal(c.failures.length,0);assert.equal(c.closingInventoryMatches,true)
 assert.equal(c.retainedResponses.length,7);assert.equal(c.nonIndiaListingCount,1)
 assert.equal(readInventoryEvidence(jobs).status,'coverage-gap');assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
test('missing detail content,dates or native identity evidence stays an explicit failure without snippet fallback',async()=>{
 for(const kind of ['body','teaser-only','date','future','title','employer','country','externalID','canonical','HTTP']){
  const m=mock({mutate:p=>p.url!==OLD?p:kind==='HTTP'?{...p,status:503}:kind==='body'?editBody(p,''):
   kind==='teaser-only'?editBody(p,'<p>Secure Every Identity, from AI to Human</p><h2>The Okta Experience</h2>'):
   ['externalID','canonical'].includes(kind)?{...p,body:Buffer.from(p.body.toString().replace(kind==='externalID'?'data-job-id="7572029"':OLD,kind==='externalID'?'data-job-id="0000001"':FRESH))}:
   editSchema(p,s=>{if(kind==='date')delete s.datePosted;if(kind==='future')s.datePosted='2099-01-01';if(kind==='title')s.title='Other role';if(kind==='employer')s.hiringOrganization.name='Other Employer';if(kind==='country')s.jobLocation[0].address='Singapore'})}),jobs=await run({transport:m.transport,now})
  assert.equal(jobs.length,3,kind);assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1,kind)
  assert.equal(jobs[0].nativeCollectionEvidence.unknownRawFailures.length,1,kind)
 }
})
test('slug-only public role URLs use the explicit native external job ID without inventing a requisition',async()=>{
 const slug=HOME+'rd/senior-software-engineer-core-frontier/',m=mock()
 const transport=async(url,request)=>{
  const p=await m.transport(url===slug?FRESH:url,request)
  return{...p,url,body:Buffer.from(p.body.toString().split('/rd/senior-software-engineer-core-frontier-8305423/').join('/rd/senior-software-engineer-core-frontier/'))}
 }
 const jobs=await run({transport,now}),job=jobs.find(j=>j.jobId==='8305423')
 assert.equal(job.sourceUrl,slug);assert.equal(job.nativeExternalJobID,'8305423');assert.equal(job.requisitionId,null)
})
test('listing country evidence and schema country must agree;location is not inferred from site locale',async()=>{
 const m=mock({mutate:p=>p.url!==OLD?p:editSchema(p,s=>{s.jobLocation=[{'@type':'Place',address:'Bengaluru, United States'}]})})
 const jobs=await run({transport:m.transport,now});assert.equal(jobs.length,3);assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1)
})
test('pagination controls and malformed listings retain coverage gaps rather than claiming all roles read',async()=>{
 const m=mock({mutate:p=>p.url!==BOARD?p:{...p,body:Buffer.from(p.body.toString().replace('</main>','<a rel="next" href="?page=1">Next</a></main>'))}})
 await assert.rejects(run({transport:m.transport,now}),error=>{assert.equal(error.nativeEvidence.verifiedZeroInventory,false);return true})
})
test('a board with no India matches is not a verified zero for the entire employer',async()=>{
 const m=mock({mutate:p=>p.url!==BOARD?p:{...p,body:Buffer.from(p.body.toString().split('Bengaluru, India').join('Boston, United States'))}})
 const jobs=await run({transport:m.transport,now});assert.equal(jobs.length,0)
 const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null)
 assert.equal(jobs[Symbol.for('jobverify.native-html-evidence')].observedListingCount,5)
})
test('missing official page,empty board and denied detail reads never establish verified empty inventory',async()=>{
 for(const url of [HOME,BOARD])await assert.rejects(run({transport:mock({mutate:p=>p.url===url?{...p,status:503}:p}).transport,now}))
 const m=mock({mutate:p=>p.url===BOARD?{...p,status:403}:p});await assert.rejects(run({transport:m.transport,now}))
 assert.equal(m.calls.filter(u=>u===BOARD).length,1);assert.equal(m.calls.length,2)
})
test('native source allows only official resources and public role URLs learned from the listing',async()=>{
 const {createSourceConfig}=await import('./parser.js'),config=createSourceConfig({now})
 for(const url of [FRESH,HOME+'login/',BOARD+'?page=1','https://user:password@www.okta.com/company/careers/',HOME+'apply/',HOME.replace('www.okta.com','other.example')])assert.throws(()=>config.validateURL(url))
})
test('normal fetch transport remains anonymous with redirects manual and no application interaction',async()=>{
 const m=mock();const jobs=await run({now,fetchImpl:async(url,request)=>{
  assert.equal(request.method,'GET');assert.equal(request.credentials,'omit');assert.equal(request.redirect,'manual')
  const p=await m.transport(url,request);return{url,status:p.status,headers:new Headers(p.headers),body:new ReadableStream({start(c){c.enqueue(p.body);c.close()}})}
 }})
 assert.equal(jobs.length,4);assert.equal(m.calls.length,7)
})
