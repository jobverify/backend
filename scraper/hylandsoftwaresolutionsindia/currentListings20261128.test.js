import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import * as source from './script.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-listings-20261128.json.gz',import.meta.url))))
const first='https://careers-hyland.icims.com/jobs/search?pr=0&in_iframe=1'
const last=source.JOBS_SEARCH_URL
const packets=new Map(fixture.packets.map(row=>[row.requestedUrl,row]))
const provider=getScraperCatalog().find(row=>row.source===source.SOURCE)
const indiaIds=['2026-14517','2026-14726','2026-14727','2026-14729']
const io=(changes={})=>{
 const calls=[]
 const bodies=new Map([...packets].map(([url,row])=>[url,typeof changes[url]==='function'?changes[url](row.body):changes[url]??row.body]))
 return {calls,fetchText:async(url)=>{calls.push(url);assert.ok(packets.has(url),'Only an actual reviewed public route may be requested: '+url);const body=bodies.get(url);if(body instanceof Error)throw body;return body}}
}
const run=options=>source.createHylandSoftwareSolutionsIndiaScraper({now:()=> '2026-11-28T00:05:55.000Z'}).run(options)
const replace=(text,before,after)=>{assert.ok(before instanceof RegExp?text.match(before):text.includes(before),'Mutation witness must exist: '+before);return text.replaceAll(before,after)}
const partial=jobs=>{
 const inventory=readInventoryEvidence(jobs)
 assert.equal(inventory.status,'coverage-gap');assert.equal(inventory.listingComplete,false);assert.equal(inventory.reportedTotal,null);assert.equal(inventory.indiaFacetCount,null)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(jobs.nativeCollectionEvidence.sourceScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null);assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.sourceDetailComplete,false)
 for(const job of jobs){assert.equal(job.sourceDetailComplete,false);assert.equal(job.sourceListingComplete,false);assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceEmployerQualificationComplete,false);assert.equal(job.sourceApplicationQualificationComplete,false);assert.equal(job.activeApplyVerified,false)}
}

test('the genuine fixture preserves all three exact public bodies and both current native page declarations',()=>{
 assert.equal(fixture.packets.length,3)
 for(const row of fixture.packets){assert.equal(row.status,200);assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)}
 assert.equal(packets.get(first).sha256,'bd4ca5a85dc5f2f45d47812dfc5c121333e4d6b259b783573fc5c12b5315190b')
 assert.equal(packets.get(last).sha256,'b6b26c36015137902807a6865eeaa9f3e98892200945787e193e0eba6ff7a260')
 assert.match(packets.get(first).body,/Search Results\s+Page 1 of 2/);assert.match(packets.get(last).body,/Search Results\s+Page 2 of 2/)
 assert.doesNotMatch(packets.get(first).body,/Here are our current job openings\./)
})

test('current native listing copy is accepted only with the bound Hyland search structure',()=>{
 assert.equal(source.hasOfficialCareersSignal(packets.get(source.CAREERS_URL).body),true)
 assert.equal(source.hasListingsSignal(packets.get(first).body),true)
 assert.equal(source.hasListingsSignal(packets.get(last).body),true)
})

test('run recovers the declared first page and retains all four observed India IDs with explicit holds',async()=>{
 const input=io(),jobs=await run(input)
 assert.deepEqual(input.calls,[source.CAREERS_URL,last,first])
 assert.deepEqual(jobs.map(job=>job.jobId).sort(),indiaIds)
 assert.equal(new Set(jobs.map(job=>job.jobId)).size,4)
 assert.ok(jobs.every(job=>job.country==='India'&&job.jobDescription.length>100&&job.publicExperienceChecked===false))
 assert.equal(jobs.nativeCollectionEvidence.observations.length,40)
 assert.equal(jobs.nativeCollectionEvidence.pages.length,2)
 assert.equal(readSourceObservationEvidence(jobs,source.SOURCE).observedVacancyCount,40)
 assert.deepEqual(jobs.nativeCollectionEvidence.pages.map(page=>page.url),[first,last])
 for(const page of jobs.nativeCollectionEvidence.pages)assert.equal(page.html,packets.get(page.url).body)
 partial(jobs)
})

test('the registered assessment keeps listing excerpts partial with cleanup disabled',async()=>{
 const input=io(),jobs=await createCatalogScraper(provider).run(input),assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(jobs.length,4);assert.equal(assessment.indiaJobs,4)
 assert.equal(jobs.filter(job=>job.sourceDetailComplete===true).length,0)
 assert.equal(assessment.runnerOutcome.partial,true);assert.equal(assessment.cleanupOptions.replaceExisting,false)
 assert.notEqual(assessment.zeroJobEvidence,'verified-empty');partial(jobs)
})

for(const [name,before,after] of [
 ['foreign next origin','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1','https://foreign.example/jobs/search?pr=1&amp;in_iframe=1'],
 ['another native employer','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1','https://careers-other.icims.com/jobs/search?pr=1&amp;in_iframe=1'],
 ['filtered next query','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1&amp;country=India'],
 ['duplicate page query','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1','https://careers-hyland.icims.com/jobs/search?pr=1&amp;pr=1&amp;in_iframe=1'],
 ['credentialed next URL','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1','https://reader@careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1'],
 ['fragmented next URL','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1#tail'],
 ['next page cycle','https://careers-hyland.icims.com/jobs/search?pr=1&amp;in_iframe=1','https://careers-hyland.icims.com/jobs/search?pr=0&amp;in_iframe=1'],
 ['missing next declaration','rel="next"','rel="unreviewed"'],
 ['mismatched page count',/Search Results\s+Page 1 of 2/g,'Search Results Page 1 of 3'],
 ['unbounded page count',/Search Results\s+Page 1 of 2/g,'Search Results Page 1 of 1000000'],
 ['wrong current page number',/Search Results\s+Page 1 of 2/g,'Search Results Page 2 of 2'],
 ['foreign form employer','/jobs/search?in_iframe=1&amp;hashed=-435679902','/jobs/search?in_iframe=1&amp;hashed=999'],
])test('current enumeration rejects '+name+' before following an unreviewed route',async()=>{
 const input=io({[first]:html=>replace(html,before,after)})
 await assert.rejects(()=>run(input),/Hyland|native|page|search|listings/i)
 assert.ok(input.calls.every(url=>packets.has(url)))
})

test('a foreign native job link cannot acquire the Hyland employer label',async()=>{
 const input=io({[first]:html=>replace(html,'https://careers-hyland.icims.com/jobs/14729/','https://careers-other.icims.com/jobs/14729/')})
 await assert.rejects(()=>run(input),/Hyland|native|role|employer/i)
})

test('duplicate native role identity across pages is rejected',async()=>{
 const input=io({[last]:html=>replace(replace(html,'/jobs/14517/','/jobs/14729/'),'2026-14517','2026-14729')})
 await assert.rejects(()=>run(input),/duplicate|identity|Hyland/i)
})

test('current cards with no native country remain raw observations instead of deriving India from excerpt or employer',async()=>{
 const input=io({[first]:html=>replace(replace(html,'Remote - India','Remote'),'Hyderabad India Office','Hyderabad Office'),[last]:html=>replace(html,'Hyderabad India Office','Hyderabad Office')})
 const jobs=await run(input);assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,40);partial(jobs)
 const assessment=assessSoftFailureAcquisition(provider,jobs)
 assert.equal(assessment.indiaJobs,0);assert.equal(assessment.eligibleJobs,0);assert.equal(assessment.runnerOutcome.success,false);assert.equal(assessment.cleanupOptions.replaceExisting,false)
})

test('mixed country labels cannot acquire India qualification from the occurrence of India',async()=>{
 const input=io({[first]:html=>replace(replace(html,'Remote - India','Remote - India | Portugal'),'Hyderabad India Office','Hyderabad Portugal India Office'),[last]:html=>replace(html,'Hyderabad India Office','Hyderabad Portugal India Office')})
 const jobs=await run(input)
 assert.equal(jobs.length,0);assert.equal(jobs.nativeCollectionEvidence.observations.length,40);partial(jobs)
})

test('the catalog navigation fallback does not qualify a role application or legal employer',async()=>{
 const native=await run(io()),decorated=await createCatalogScraper(provider).run(io())
 assert.ok(native.every(job=>job.applyUrl===null&&job.sourceEmployerQualificationComplete===false))
 assert.ok(decorated.every(job=>job.applyUrl===job.sourceUrl&&job.activeApplyVerified===false&&job.sourceApplicationQualificationComplete===false&&job.sourceEmployerQualificationComplete===false))
})

test('an inert inner card identity cannot replace the validated active native role',async()=>{
 const inert='<template><a href="https://careers-other.icims.com/jobs/99999/phantom/job?in_iframe=1"><h3>Phantom Native Analyst</h3></a><div class="col-xs-12 description">This inert text is not the visible listing excerpt.</div><div class="iCIMS_JobHeaderTag"><dt class="iCIMS_JobHeaderField">Job ID</dt><dd class="iCIMS_JobHeaderData"><span>2026-99999</span></dd></div><div class="iCIMS_JobHeaderTag"><dt class="iCIMS_JobHeaderField"><span class="sr-only field-label">Job Locations</span></dt><dd class="iCIMS_JobHeaderData"><span>Remote - India</span></dd></div></template>'
 const input=io({[first]:html=>replace(html,/<a\b[^>]*href="https:\/\/careers-hyland\.icims\.com\/jobs\/14729\/[^>]*>/g,match=>inert+match)})
 const jobs=await run(input)
 assert.deepEqual(jobs.map(job=>job.jobId).sort(),indiaIds)
 assert.ok(jobs.every(job=>new URL(job.sourceUrl).hostname==='careers-hyland.icims.com'&&!job.jobDescription.includes('inert text')))
 assert.equal(jobs.nativeCollectionEvidence.observations.length,40);partial(jobs)
})

test('a failed declared first-page read cannot return the positive seed page as a successful inventory',async()=>{
 const input=io({[first]:new Error('Native public first page HTTP403')})
 await assert.rejects(()=>run(input),/HTTP403/)
 assert.deepEqual(input.calls,[source.CAREERS_URL,last,first])
})

test('the original corporate identity guard still rejects a changed first-party handoff',async()=>{
 const input=io({[source.CAREERS_URL]:html=>replace(html,'hashed=-435679902','hashed=999')})
 await assert.rejects(()=>run(input),/first-party handoff/);assert.deepEqual(input.calls,[source.CAREERS_URL])
})

test('current pagination and cards embedded only in a template do not become an active native listing',()=>{
 const html=packets.get(first).body
 assert.equal(source.hasListingsSignal('<template>'+html+'</template>'),false)
})
