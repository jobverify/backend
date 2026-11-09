import assert from 'node:assert/strict'
import test from 'node:test'
import {runApiPortalScraper} from '../apiPortal/engine.js'
import {expandApiPortalProviderTemplate} from '../providers/apiPortalTemplates.js'
import {createCatalogScraper, getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {createCbtstechnologysolutionsindiallpScraper} from '../../scraper/cbtstechnologysolutionsindiallp/script.js'

const SOURCE='cbtstechnologysolutionsindiallp',NOW='2026-10-03T00:00:00.000Z'
// Controlled native-format inputs, not a current HTTP capture or company census.
const official='<title>Careers at CBTS</title><p>Explore opportunities across CBTS</p><a href="https://jobs.cbts.com/careers?&location=India">CBTS India</a>'
const board='<title>Careers at CBTS</title><script>window._EF_GROUP_ID = "cbts.com";</script>'
const description='<p>Build reliable services.</p>'
const rows=[
 {id:1,name:'Controlled India Engineer',standardizedLocations:['Chennai, TN, IN'],locations:['Chennai'],positionUrl:'/careers/job/1'},
 {id:2,name:'Controlled India Missing Description',standardizedLocations:['Chennai, TN, IN'],locations:['Chennai'],positionUrl:'/careers/job/2'},
]
const upstreamProvider=()=>expandApiPortalProviderTemplate({
 source:SOURCE,companyName:'CBTS TECHNOLOGY SOLUTIONS INDIA LLP',companyCareerPage:'https://www.cbts.com/careers',countryFilter:'India',atsPlatform:'eightfold',template:'eightfold',
 templateOptions:{host:'jobs.cbts.com',domain:'cbts.com',pageSize:10,locationPattern:'India|(?:^|,)\\s*IN\\b'},
 config:{mapping:{location:['standardizedLocations.0','locations.0']}},
})
const transport=()=>{
 const requests=[],payloads=[]
 const snapshot=value=>{payloads.push([value,structuredClone(value)]);return value}
 return {requests,assertUnchanged:()=>{for(const [value,copy] of payloads)assert.deepEqual(value,copy)},now:()=>NOW,fetchText:async url=>{
  requests.push(url)
  if(url==='https://www.cbts.com/careers')return official
  assert.equal(url,'https://jobs.cbts.com/careers?&location=India');return board
 },fetchJson:async value=>{
  const url=new URL(value);requests.push(url.href);assert.equal(url.origin,'https://jobs.cbts.com');assert.equal(url.searchParams.get('domain'),'cbts.com')
  if(url.pathname==='/api/pcsx/search'){
   assert.equal(url.searchParams.get('start'),'0');assert.equal(url.searchParams.get('limit'),'10');assert.equal(url.searchParams.get('location'),'India')
   return snapshot({data:{count:2,positions:structuredClone(rows)}})
  }
  assert.equal(url.pathname,'/api/pcsx/position_details');const id=Number(url.searchParams.get('position_id'));assert.ok([1,2].includes(id))
  return snapshot({data:{publicUrl:'https://jobs.cbts.com/careers/job/'+id,jobDescription:id===1?description:''}})
 }}
}
const assertRole=jobs=>{
 assert.equal(jobs.length,2)
 const [job]=jobs
 assert.equal(job.jobId,rows[0].id);assert.equal(job.title,rows[0].name);assert.equal(job.country,'India')
 assert.equal(job.sourceUrl,'https://jobs.cbts.com/careers/job/1');assert.equal(job.applyUrl,job.sourceUrl)
 assert.match(job.jobDescription,/Build reliable services/);assert.ok(job.postingDate==null,'missing upstream date must stay unknown')
 assert.equal(job.sourceListingComplete,false)
 assert.notEqual(job.sourceScopeComplete,true);assert.notEqual(job.sourceCompanyCoverageComplete,true)
 assert.equal(jobs[1].jobId,2);assert.equal(jobs[1].country,'India')
 assert.equal(jobs[1].sourceUrl,'https://jobs.cbts.com/careers/job/2');assert.equal(jobs[1].applyUrl,jobs[1].sourceUrl)
 assert.ok(jobs[1].jobDescription==null||jobs[1].jobDescription==='','missing JD must not be fabricated')
 assert.ok(jobs[1].postingDate==null);assert.equal(jobs[1].sourceListingComplete,false)
}
const assertPartialEvidence=jobs=>{
 assertRole(jobs)
 const evidence=readInventoryEvidence(jobs)
 assert.ok(evidence,'native inventory evidence must survive the source wrapper')
 assert.equal(evidence.status,'discovery-only');assert.equal(evidence.listingComplete,false)
 assert.equal(evidence.reportedTotal,2);assert.equal(evidence.pagesFetched,1);assert.equal(evidence.indiaFacetCount,2)
 assert.match(evidence.reason,/(?:description|details)-unavailable/)
 assert.equal(evidence.surface,'https://jobs.cbts.com/api/pcsx/search')
 assert.ok(Number.isFinite(Date.parse(evidence.verifiedAt)))
 return evidence
}
const assertOriginalFields=(beforeJobs,afterJobs)=>{
 assert.equal(afterJobs.length,beforeJobs.length)
 for(let index=0;index<beforeJobs.length;index++)for(const key of Reflect.ownKeys(beforeJobs[index])){
  if(key==='scrapedAt')continue // Existing source decoration intentionally supplies the injected observation clock.
  assert.deepEqual(afterJobs[index][key],beforeJobs[index][key],'original row field '+String(key))
 }
}
test('CBTS controlled upstream engine retains partial native counts before company decoration',async()=>{
 const input=transport(),jobs=await runApiPortalScraper({provider:upstreamProvider(),fetchJson:input.fetchJson})
 assertPartialEvidence(jobs)
 assert.equal(input.requests.length,3);input.assertUnchanged()
})
test('CBTS source wrapper preserves partial upstream inventory evidence and role fields',async()=>{
 const reference=transport(),upstream=await runApiPortalScraper({provider:upstreamProvider(),fetchJson:reference.fetchJson})
 const input=transport(),jobs=await createCbtstechnologysolutionsindiallpScraper().run(input)
 assertPartialEvidence(jobs);assert.equal(jobs[0].scrapedAt,NOW)
 assert.equal(input.requests.length,5);input.assertUnchanged();reference.assertUnchanged();assertOriginalFields(upstream,jobs)
})
test('CBTS registered current route preserves partial upstream counts through decoration',async()=>{
 const provider=getScraperCatalog().find(p=>p.source===SOURCE)
 assert.equal(provider.adapter,'script');assert.match(provider.modulePath,/cbtstechnologysolutionsindiallp[\\/]script\.js$/)
 const reference=transport(),upstream=await runApiPortalScraper({provider:upstreamProvider(),fetchJson:reference.fetchJson})
 const input=transport(),jobs=await createCatalogScraper(provider).run(input)
 assertPartialEvidence(jobs);assert.equal(jobs[0].scrapedAt,NOW)
 assert.equal(input.requests.length,5);input.assertUnchanged();reference.assertUnchanged();assertOriginalFields(upstream,jobs)
})
