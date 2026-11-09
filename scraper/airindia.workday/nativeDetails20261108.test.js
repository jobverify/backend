import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createAirIndiaScraper,CAREERS_URL,SEARCH_URL} from './script.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,isCompleteScraperAttempt} from '../../scraper-support/utils/inventoryEvidence.js'
import {buildScraperAttemptDiagnostics} from '../../scraper-support/runner.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-details-20261108.json.gz',import.meta.url)))),pages=new Map(fixture.packets.map(p=>[p.requestedURL,p])),first=fixture.packets[2].requestedURL,second=fixture.packets[3].requestedURL
const content=url=>Buffer.from(pages.get(url).bodyBase64,'base64').toString('utf8')
const transport=(change=()=>{})=>{const calls=[];return{calls,fetchHtml:async(url,init={})=>{
 assert.ok(pages.has(url),'Only advertised original URLs are read: '+url);calls.push(url)
 const p=pages.get(url),r={status:p.status,url:p.finalURL,html:content(url),headers:{...p.headers}}
 change(r,url,init)
 return init.includeResponseMetadata?r:r.html
}}}
const replay=async(change,options={})=>{const io=transport(change);const jobs=await createAirIndiaScraper({fetchHtml:io.fetchHtml,now:()=> '2026-11-08T06:00:00.000Z'}).run(options);return{jobs,calls:io.calls,evidence:readInventoryEvidence(jobs)}}
test('captured Air India roles yield thirteen whole native descriptions and retain the one actual placeholder',async()=>{
 const {jobs,calls,evidence}=await replay()
 assert.equal(jobs.length,14);assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,13)
 const pilots=jobs.find(j=>j.jobId==='52901044'),technician=jobs.find(j=>j.jobId==='55084344')
 assert.match(pilots.sourceDescription,/Minimum 500 hours on Airbus 320 Family Aircraft post line Release/)
 assert.match(pilots.sourceDescription,/Place of Posting/)
 assert.doesNotMatch(pilots.sourceDescription,/Copyright|Create Alert|By continuing to use/)
 assert.equal(technician.sourceDescription,null);assert.equal(technician.sourceDetailComplete,false);assert.equal(technician.sourceDetailFailureKind,'missing-content')
 assert.equal(calls.length,16);assert.ok(calls.every(url=>calls.filter(u=>u===url).length===1));assert.ok(calls.every(url=>!url.includes('/talentcommunity/')))
 assert.equal(evidence.reportedTotal,14)
})
test('native country and employer gaps do not erase full content or fabricate fourteen India roles',async()=>{
 const {jobs,evidence}=await replay(),pilot=jobs.find(j=>j.jobId==='52901044'),licensed=jobs.find(j=>j.jobId==='54998844')
 assert.equal(pilot.nativeLocation,'Gurugram');assert.equal(pilot.country,null);assert.equal(pilot.sourceCountryComplete,false);assert.equal(pilot.nativeCountryRaw,'No')
 assert.equal(pilot.nativeEmployer,'Air India Express');assert.equal(pilot.company,'Air India Express');assert.equal(pilot.sourceEmployerComplete,false);assert.equal(pilot.sourceDetailComplete,true)
 assert.equal(licensed.country,'India');assert.equal(licensed.sourceCountryComplete,true);assert.equal(licensed.sourceWorksiteCountryProof.method,'explicit-native-role-location')
 assert.equal(jobs.filter(j=>j.country==='India').length,2)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.indiaFacetCount,null)
})
test('registered Air India path forwards the native reader and fetches each detail once',async t=>{
 const io=transport();t.mock.method(globalThis,'fetch',async()=>{throw Error('Uninjected network read')})
 const source=createCatalogScraper(getScraperCatalog().find(p=>p.source==='airindia')),jobs=await source.run({fetchHtml:io.fetchHtml})
 assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,13);assert.equal(io.calls.length,16);assert.equal(readInventoryEvidence(jobs).reportedTotal,14)
})
for(const [label,mutate]of[
 ['foreign response URL',r=>{r.url='https://foreign.example/job/52901044/'}],
 ['different native posting body',r=>{r.html=content(second)}],
 ['missing canonical',r=>{r.html=r.html.replace(/<link[^>]+rel="canonical"[^>]*>/i,'')}],
 ['foreign canonical',r=>{r.html=r.html.replace(first,'https://foreign.example/job/52901044/')}],
 ['different visible title',r=>{r.html=r.html.replace('data-careersite-propertyid="title" class="rtltextaligneligible">A320','data-careersite-propertyid="title" class="rtltextaligneligible">Other A320')}],
 ['different native application id',r=>{r.html=r.html.replaceAll('/apply/52901044/','/apply/52871144/')}],
 ['reordered native requisition id',r=>{r.html=r.html.replace('"internalId":"18451-en_US"','"internalId":"18085-en_US"')}],
 ['hidden role requirements',r=>{r.html=r.html.replace('Minimum 500 hours','<span hidden>Minimum 500 hours</span>')}],
 ['unreviewed anti-framing program',r=>{r.html=r.html.replace('self === top','self == top')}],
 ['boilerplate body only',r=>{r.html=r.html.replace(/<span class="jobdescription">[\s\S]*?<\/span>/,'<span class="jobdescription">Job Description</span>')}],
])test('native detail guard retains the valid listing and other descriptions: '+label,async()=>{
 const {jobs,calls,evidence}=await replay((r,url)=>{if(url===first)mutate(r)})
 const held=jobs.find(j=>j.jobId==='52901044');assert.equal(held.sourceDetailComplete,false);assert.equal(held.sourceDescription,null)
 assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,12);assert.equal(evidence.reportedTotal,14);assert.equal(calls.length,16)
})
test('conflicting JSON-LD role identity cannot replace or silently qualify native visible criteria',async()=>{
 const ld={'@context':'https://schema.org','@type':'JobPosting',url:first,title:'Other role',identifier:{value:'52901044'},hiringOrganization:{name:'Air India Careers'},description:'A long unrelated description for a different native posting that must not be attached to this listed Air India role.'}
 const {jobs,evidence}=await replay((r,url)=>{if(url===first)r.html=r.html.replace('</head>','<script type="application/ld+json">'+JSON.stringify(ld)+'</script></head>')})
 assert.equal(jobs.find(j=>j.jobId==='52901044').sourceDetailComplete,false);assert.equal(evidence.reportedTotal,14)
})
test('foreign explicit native country remains separate from complete literal role content',async()=>{
 const {jobs}=await replay((r,url)=>{if(url===first)r.html=r.html.replace('itemprop="addressCountry" content="No"','itemprop="addressCountry" content="Germany"')})
 const role=jobs.find(j=>j.jobId==='52901044');assert.equal(role.sourceDetailComplete,true);assert.equal(role.country,'Germany');assert.equal(role.sourceScopeComplete,false)
})
test('a detail HTTP denial remains partial without changing the complete observed listing count',async()=>{
 const {jobs,evidence}=await replay((r,url)=>{if(url===first)r.status=403})
 assert.equal(jobs.find(j=>j.jobId==='52901044').sourceDetailComplete,false);assert.equal(jobs.filter(j=>j.sourceDetailComplete).length,12);assert.equal(evidence.reportedTotal,14)
})
for(const reason of [{opaque:'caller'},0,null])test('opaque caller abort is preserved during a native detail: '+String(reason),async()=>{
 const controller=new AbortController(),io=transport((_r,url)=>{if(url===first)controller.abort(reason)})
 await assert.rejects(createAirIndiaScraper({fetchHtml:io.fetchHtml}).run({signal:controller.signal}),e=>e===reason)
})
test('uncooperative detail reads are bounded and remain independent from listing coverage',async()=>{
 const io=transport(),jobs=await createAirIndiaScraper({fetchHtml:(url,init)=>url===first?new Promise(()=>{}):io.fetchHtml(url,init)}).run({readTimeoutMs:150,sourceTimeoutMs:30000})
 assert.equal(jobs.length,14);assert.equal(jobs.find(j=>j.jobId==='52901044').sourceDetailComplete,false);assert.equal(jobs.find(j=>j.jobId==='52901044').sourceDetailFailureKind,'timeout');assert.equal(readInventoryEvidence(jobs).reportedTotal,14)
})

test('two identically titled Maintenance Engineer details remain bound to their own posting and requisition IDs',async()=>{
 const original='https://careers.airindia.com/job/Amravati-Maintenance-Engineer/56836744/',other='https://careers.airindia.com/job/Amravati-Maintenance-Engineer/59851844/'
 for(const rewritePublicId of [false,true]){
  const {jobs,evidence}=await replay((r,url)=>{if(url===original)r.html=rewritePublicId?content(other).replaceAll('/59851844/','/56836744/'):content(other)})
  assert.equal(jobs.find(j=>j.jobId==='56836744').sourceDetailComplete,false)
  assert.equal(jobs.find(j=>j.jobId==='59851844').sourceDetailComplete,true)
  assert.match(jobs.find(j=>j.jobId==='59851844').sourceDescription,/The AME will report to Maintenance Manager/)
  assert.equal(evidence.reportedTotal,14)
 }
})

test('synchronous public reader work cannot bypass the source deadline',async()=>{
 const io=transport((_r,url)=>{if(url===CAREERS_URL){const end=Date.now()+30;while(Date.now()<end){}}})
 await assert.rejects(createAirIndiaScraper({fetchHtml:io.fetchHtml}).run({sourceTimeoutMs:5,readTimeoutMs:100}),e=>e?.code==='AIRINDIA_SOURCE_TIMEOUT')
})
test('synchronous public reader work cannot bypass an individual detail deadline',async()=>{
 const io=transport((_r,url)=>{if(url===first){const end=Date.now()+50;while(Date.now()<end){}}})
 const jobs=await createAirIndiaScraper({fetchHtml:io.fetchHtml}).run({sourceTimeoutMs:5000,readTimeoutMs:10})
 const held=jobs.find(j=>j.jobId==='52901044');assert.equal(held.sourceDetailComplete,false);assert.equal(held.sourceDetailFailureKind,'timeout')
})


// These controlled native-format listing cohorts reuse observed public packets.
// The captured landing still advertises unenumerated company hiring channels.
for (const cohort of ['explicit-empty', 'fully-qualified-India-role']) test('registered Air India '+cohort+' listing retains the unresolved company scope lifecycle hold', async t=>{
 const provider=getScraperCatalog().find(p=>p.source==='airindia')
 const id='54998844',tile=[...content(SEARCH_URL).matchAll(/<li\b[^>]*class="[^"]*\bjob-tile\b[^"]*"[^>]*>[\s\S]*?<\/li>/gi)].find(m=>m[0].includes('job-id-'+id))?.[0]
 assert.ok(tile)
 assert.match(content(CAREERS_URL),/https:\/\/cabincrewcareers\.airindia\.com\//)
 assert.match(content(CAREERS_URL),/https:\/\/pilotcareers\.airindia\.com\//)
 const empty=cohort==='explicit-empty',declaredCount=empty?0:1
 const listing=empty?'<h1>Air India Careers Jobs</h1><p>There are currently no open positions</p>':'<h1>Air India Careers Jobs</h1><span id="tile-search-results-label">Showing 1 to 1 of 1 Jobs</span><ul id="job-tile-list" data-record-returned="1">'+tile+'</ul>'
 const io=transport((r,url)=>{if(url===SEARCH_URL)r.html=listing})
 t.mock.method(globalThis,'fetch',async()=>{throw Error('Uninjected network read')})
 const jobs=await createCatalogScraper(provider).run({fetchHtml:io.fetchHtml}),audit=jobs.nativeCollectionEvidence,evidence=readInventoryEvidence(jobs)
 assert.equal(jobs.length,declaredCount)
 assert.equal(audit.observedListingCount,declaredCount);assert.equal(audit.reportedTotal,declaredCount);assert.equal(audit.declaredListingComplete,true)
 assert.equal(audit.configuredCountryMembershipComplete,true)
 assert.equal(audit.companyInventoryComplete,false);assert.equal(audit.companyGlobalTotal,null);assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.sourceScopeComplete,false);assert.equal(audit.lifecycleCleanupAllowed,false)
 if(!empty){assert.equal(jobs[0].jobId,id);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].sourceCountryComplete,true);assert.equal(jobs[0].sourceEmployerComplete,true);assert.equal(jobs[0].sourceDetailComplete,true)}
 assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,declaredCount);assert.equal(evidence.indiaFacetCount,null)
 assert.match(evidence.reason,/company.*scope.*unresolved/)
 assert.ok(jobs.every(j=>j.sourceListingComplete===false&&j.sourceScopeComplete===false&&j.lifecycleCleanupAllowed===false))
 const diagnostics=buildScraperAttemptDiagnostics(jobs,undefined,provider)
 assert.equal(audit.detailHealth.complete,true);assert.equal(diagnostics.detailHealth.missingDescriptions,0)
 assert.equal(isCompleteScraperAttempt({success:true,...diagnostics}),false)
 assert.deepEqual(inventoryCleanupOptions(diagnostics),{replaceExisting:false})
 assert.equal(io.calls.length,declaredCount+2)
})


test('explicit conflicting Air India employer carriers retain the native employer and hold exact-company scope',async()=>{
 const {jobs,evidence}=await replay((r,url)=>{if(url===first){
  assert.match(r.html,/itemprop="hiringOrganization" content="Air India Careers"/)
  assert.match(r.html,/This opportunity is with Air India Express\./)
  r.html=r.html.replace('itemprop="hiringOrganization" content="Air India Careers"','itemprop="hiringOrganization" content="Air India Express"').replace('This opportunity is with Air India Express.','This opportunity is with Air India.')
 }})
 const pilot=jobs.find(j=>j.jobId==='52901044')
 assert.equal(pilot.sourceDetailComplete,true);assert.match(pilot.sourceDescription,/This opportunity is with Air India\./)
 assert.equal(pilot.sourceNativeDetail.nativeEmployer,'Air India Express')
 assert.equal(pilot.nativeEmployer,'Air India Express');assert.equal(pilot.company,'Air India Express');assert.equal(pilot.sourceEmployerComplete,false)
 assert.equal(pilot.nativeDescriptionEmployer,'Air India');assert.equal(pilot.sourceEmployerConflict,true)
 assert.ok(pilot.sourceScopeGaps.includes('native-employer-conflict'))
 assert.equal(pilot.sourceScopeComplete,false);assert.equal(pilot.lifecycleCleanupAllowed,false)
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,14)
})
