import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'

// Only the public transport is replaced; registration, source and evidence are real.
globalThis.fetch = () => { throw new Error('OFFLINE GLOBAL FETCH TRIPWIRE') }
const { getScraperCatalog, createCatalogScraper } = await import('../../scraper-support/providers/index.js')
const { readInventoryEvidence } = await import('../../scraper-support/utils/inventoryEvidence.js')
const manifest = JSON.parse(readFileSync(new URL('./fixtures/raw-manifest.json', import.meta.url)))
const retained = new Map(manifest.map(r => [r.url, readFileSync(new URL(`./fixtures/${r.bodyPath}`, import.meta.url), 'utf8')]))
const careers='https://airbyte.com/company/careers', board='https://jobs.ashbyhq.com/airbyte', api='https://api.ashbyhq.com/posting-api/job-board/airbyte'
const entry='https://airbyte.com/assets/index-eeZtTw76.js', client='https://airbyte.com/assets/app~careers-BvToOyCj.js', embed=board+'/embed?version=2'
const app = body => JSON.parse(body.match(/window\.__appData\s*=\s*(\{[^\n]*\});/)[1])
const replaceApp = (body, data) => body.replace(/(window\.__appData\s*=\s*)\{[^\n]*\};/, (_, p) => p + JSON.stringify(data) + ';')
const schemaOf = body => JSON.parse(body.match(/<script\b[^>]*type="application\/ld\+json"[^>]*>([^]*?)<\/script>/)[1])
const replaceSchema = (body, data) => body.replace(/(<script\b[^>]*type="application\/ld\+json"[^>]*>)[^]*?(<\/script>)/, (_, a, b) => a + JSON.stringify(data) + b)

// Explicitly synthetic future role data, derived from retained native shapes.
export function synthetic({secondaryIndia=false, ambiguous=false, expired=false, twoIndia=false}={}) {
  const map=new Map(retained), original=JSON.parse(map.get(api)).jobs[0], feed=[], briefs=[]
  for(let i=0;i<2;i++) {
    const row=structuredClone(original), id=i===0?'11111111-1111-4111-8111-111111111111':'22222222-2222-4222-8222-222222222222'
    row.id=id;row.title=`Synthetic future India engineer ${i}`;row.jobUrl=board+'/'+id;row.applyUrl=row.jobUrl+'/application'
    row.location=i===0||twoIndia?'Bengaluru, India':ambiguous?'Remote - Worldwide':'San Francisco'
    row.address={postalAddress:i===0||twoIndia?{addressCountry:'IN',addressLocality:'Bengaluru',addressRegion:'Karnataka'}:ambiguous?{}:{addressCountry:'US',addressLocality:'San Francisco',addressRegion:'California'}}
    row.secondaryLocations=[]
    if(secondaryIndia&&i===0){row.secondaryLocations=[{location:row.location,address:row.address}];row.location='San Francisco';row.address={postalAddress:{addressCountry:'US',addressLocality:'San Francisco',addressRegion:'California'}}}
    row.descriptionHtml='<p>Build <strong>safe</strong> data &amp; AI.</p><div hidden>Hidden criterion</div><h2>Requirements</h2><p>5 years of distributed systems experience.</p><h2>Preferred qualifications</h2><p>Computer science degree.</p><h2>Required skills</h2><p>TypeScript &amp; SQL.</p>'
    row.descriptionPlain='Build safe data & AI. Hidden criterion 5 years of distributed systems experience.'
    const body=map.get(original.jobUrl), data=app(body), schema=schemaOf(body)
    Object.assign(data.posting,{id,title:row.title,locationName:row.location,secondaryLocationNames:row.secondaryLocations.map(x=>x.location),descriptionHtml:row.descriptionHtml,compensationPhilosophyHtml:null,applicationLimitCalloutHtml:null,applicationDeadline:expired&&i===0?'2020-01-01T00:00:00.000Z':null})
    Object.assign(schema,{title:row.title,description:row.descriptionHtml,identifier:{'@type':'PropertyValue',name:'Airbyte',value:id},jobLocation:[row,...row.secondaryLocations].map(r=>({'@type':'Place',address:{'@type':'PostalAddress',...r.address.postalAddress}}))})
    delete schema.applicantLocationRequirements
    if(expired&&i===0)schema.validThrough='2020-01-01'
    map.set(row.jobUrl,replaceSchema(replaceApp(body,data),schema));feed.push(row)
    briefs.push({id,title:row.title,locationName:row.location,secondaryLocations:row.secondaryLocations.map(r=>({locationName:r.location})),employmentType:row.employmentType,workplaceType:row.workplaceType})
  }
  const data=app(map.get(board));data.jobBoard.jobPostings=briefs;map.set(board,replaceApp(map.get(board),data));map.set(api,JSON.stringify({apiVersion:'1',jobs:feed}))
  return {map,feed,briefs}
}
async function run(map=retained,{transform, ...options}={}) {
  const counts=new Map(),calls=[];let audit
  const get=async url=>{calls.push(url);const n=(counts.get(url)||0)+1;counts.set(url,n);if(!map.has(url))throw new Error('Unexpected offline URL '+url);return transform?await transform(url,map.get(url),n):map.get(url)}
  const provider=getScraperCatalog().find(p=>p.source==='airbyte')
  const jobs=await createCatalogScraper(provider).run({fetchText:get,fetchJson:async url=>JSON.parse(await get(url)),now:()=> '2026-10-27T10:00:00.000Z',onNativeAudit:value=>{audit=value},...options})
  return {jobs,audit,calls,evidence:readInventoryEvidence(jobs)}
}
test('Airbyte retained actual native inventory verifies all 13 details and current corporate client before zero India',async()=>{
  const {jobs,audit,evidence,calls}=await run()
  assert.equal(evidence?.status,'complete-inventory');assert.equal(evidence.reportedTotal,13);assert.equal(evidence.indiaFacetCount,0)
  assert.equal(audit.fullDetailCount,13);assert.equal(audit.fullyHealthyCount,13);assert.equal(audit.complete,true);assert.deepEqual(jobs,[])
  assert.equal(calls.filter(x=>x===entry).length,2);assert.equal(calls.filter(x=>x===client).length,2);assert.equal(calls.filter(x=>x===embed).length,2)
})
test('Airbyte synthetic future India preserves full visible criteria, original dates and native identity',async()=>{
  const {map}=synthetic(),{jobs,evidence}=await run(map)
  assert.equal(evidence.status,'complete-inventory');assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India')
  assert.equal(jobs[0].jobDescription,'Build safe data & AI. Requirements 5 years of distributed systems experience. Preferred qualifications Computer science degree. Required skills TypeScript & SQL.')
  assert.equal(jobs[0].minimumQualification,'5 years of distributed systems experience.');assert.equal(jobs[0].preferredQualification,'Computer science degree.');assert.deepEqual(jobs[0].requiredSkills,['TypeScript & SQL.'])
  assert.equal(jobs[0].requisitionId,null);assert.equal(jobs[0].postingDate,'2026-10-12T20:53:19.718+00:00');assert.equal(jobs[0].closingDate,null)
  assert.equal(jobs[0].nativeEmployer.name,'Airbyte');assert.equal(jobs[0].nativeApplicationId,null);assert.deepEqual(jobs[0].applicationIdentity,{postingId:'11111111-1111-4111-8111-111111111111',url:board+'/11111111-1111-4111-8111-111111111111/application'});assert.equal(jobs[0].lifecycleCleanupAllowed,true)
})
test('Airbyte synthetic secondary India worksite remains eligible without primary country substitution',async()=>{
  const {jobs}=await run(synthetic({secondaryIndia:true}).map)
  assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].nativeLocations.length,2);assert.equal(jobs[0].nativeLocations[0].country,'United States');assert.equal(jobs[0].nativeLocations[1].country,'India')
})
test('Airbyte synthetic ambiguous global remote lowers completeness while closing-verified healthy India survives',async()=>{
  const {jobs,evidence,audit}=await run(synthetic({ambiguous:true}).map)
  assert.equal(jobs.length,1);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.listingComplete,false);assert.equal(jobs[0].lifecycleCleanupAllowed,false);assert.equal(audit.fullyHealthyCount,1)
})
test('Airbyte synthetic closing role drift makes changed India ineligible',async()=>{
  const {map,feed}=synthetic();const {jobs,evidence}=await run(map,{transform:(url,body,n)=>url===api&&n===2?JSON.stringify({apiVersion:'1',jobs:JSON.parse(body).jobs.map(r=>r.id===feed[0].id?{...r,title:'Changed native criteria'}:r)}):body})
  assert.deepEqual(jobs,[]);assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null)
})
test('Airbyte synthetic failed closing cannot retain an unverified India role',async()=>{
  const {jobs,evidence}=await run(synthetic().map,{transform:(url,body,n)=>{if(url===board&&n===2)throw new Error('synthetic closing unavailable');return body}})
  assert.deepEqual(jobs,[]);assert.equal(evidence.reportedTotal,null)
})
test('Airbyte synthetic expired role is ineligible even when still listed',async()=>{
  const {jobs,evidence}=await run(synthetic({expired:true}).map)
  assert.deepEqual(jobs,[]);assert.equal(evidence.listingComplete,true)
})
test('Airbyte synthetic output cap follows all native details and closes cleanup',async()=>{
  const {jobs,evidence,audit}=await run(synthetic({twoIndia:true}).map,{maxJobs:1})
  assert.equal(jobs.length,1);assert.equal(audit.fullDetailCount,2);assert.equal(audit.indiaCount,2);assert.equal(evidence.reportedTotal,null);assert.equal(jobs[0].lifecycleCleanupAllowed,false)
})
test('Airbyte synthetic current client binding mismatch blocks catalog token fallback',async()=>{
  await assert.rejects(run(retained,{transform:(url,body)=>url===client?body.replaceAll('jobs.ashbyhq.com/airbyte','jobs.ashbyhq.com/other-employer'):body}),/binding|handoff|employer/)
})
test('Airbyte synthetic native continuation marker cannot certify an incomplete feed',async()=>{
  await assert.rejects(run(retained,{transform:(url,body)=>url===api?JSON.stringify({...JSON.parse(body),hasMore:true,nextCursor:'synthetic-next'}):body}),/truncated|pagination|continuation/)
})
for(const status of [401,403,429])test(`Airbyte synthetic careers HTTP ${status} stops before any other request`,async()=>{
  let calls=0;await assert.rejects(run(retained,{transform:()=>{calls++;throw Object.assign(new Error('HTTP '+status),{status})}}),new RegExp(String(status)));assert.equal(calls,1)
})
test('Airbyte synthetic explicit bot gate stops before any other request',async()=>{
  let calls=0;await assert.rejects(run(retained,{transform:()=>{calls++;return '<html>Verify you are human</html>'}}),/denied|bot|challenge/i);assert.equal(calls,1)
})
