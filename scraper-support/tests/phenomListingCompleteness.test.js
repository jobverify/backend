import assert from 'node:assert/strict'
import test from 'node:test'
import { fileURLToPath } from 'node:url'
import { createPhenomScraper } from '../phenom/engine.js'
const scraper = createPhenomScraper({ companyName:'Example', source:'example-phenom', baseUrl:'https://careers.example.com', scraperDir:fileURLToPath(new URL('.',import.meta.url)) })
const job = (id, country='India') => ({reqId:String(id),jobId:String(id),title:'Role '+id,country,cityStateCountry:country==='India'?'Pune, India':country})
const page = (jobs,total,hits=jobs.length,countries={India:total}) => '<script>phApp.ddo = '+JSON.stringify({eagerLoadRefineSearch:{totalHits:total,hits,data:{jobs,aggregations:[{field:'country',value:countries}]}}})+'</script>'
const detail = row => '<script>phApp.ddo = '+JSON.stringify({jobDetail:{data:{job:{...row,ml_Description:'Verified description'}}}})+'</script>'
const isListing = url => url.includes('/search-results')
test('Phenom collects beyond the inherited ten-page DOM limit before optional details',async()=>{
 const requests=[]
 const jobs=await scraper.run({fetchText:async url=>{requests.push(url);if(isListing(url)){const offset=Number(new URL(url).searchParams.get('from')||0);return page([job(offset)],12,1)}return detail(job(url.split('/job/')[1].split('/')[0]))}})
 assert.equal(jobs.length,12);assert.ok(jobs.every(x=>x.sourceListingComplete!==false));assert.ok(requests.slice(0,12).every(isListing))
})
test('Phenom counts repeated target-country aliases and retains their roles',async()=>{
 const rows=[job(1),job(2,'India / India'),job(3,'United States')]
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async url=>{assert.ok(isListing(url));const offset=Number(new URL(url).searchParams.get('from')||0);return page([rows[offset]],3,1,{India:1,'India / India':1,'United States':1})}})
 assert.equal(jobs.length,2);assert.ok(jobs.every(x=>x.country==='India'&&x.sourceListingComplete!==false))
})
test('Phenom advances by returned records rather than advertised page size',async()=>{
 const offsets=[]
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async url=>{assert.ok(isListing(url));const offset=Number(new URL(url).searchParams.get('from')||0);offsets.push(offset);return offset===0?page([job(1)],3,10):page([job(2),job(3)],3,10)}})
 assert.equal(jobs.length,3);assert.deepEqual(offsets,[0,1])
})
for(const [label,response] of [['empty first page',page([],2,10)],['unrecognized payload','<html>Maintenance</html>']]){
 test('Phenom rejects '+label+' as a successful empty listing',async()=>{
  await assert.rejects(scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>response}),/incomplete|payload/i)
 })
}
test('Phenom rejects an empty/reset later page before the earlier total',async()=>{
 await assert.rejects(scraper.run({detailEnrichmentBudgetMs:0,fetchText:async url=>new URL(url).searchParams.has('from')?page([],0,0):page([job(1)],2,1)}),/incomplete/i)
})
test('Phenom rejects duplicate pages before total coverage',async()=>{
 await assert.rejects(scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>page([job(1)],2,1)}),/incomplete/i)
})
test('Phenom preserves distinct roles as incomplete when the final page overlaps an earlier page',async()=>{
 const rows=[[job(1),job(2)],[job(2),job(3)]]
 const requests=[]
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async url=>{
  const offset=Number(new URL(url).searchParams.get('from')||0)
  requests.push(offset)
  if(offset>=4) throw new Error('Requested beyond the advertised listing total')
  return page(rows[offset/2],4,2)
 }})
 assert.deepEqual(requests,[0,2])
 assert.deepEqual(jobs.map(row=>row.jobId),['1','2','3'])
 assert.ok(jobs.every(row=>row.sourceListingComplete===false))
})
test('Phenom rejects malformed listing identities instead of silently dropping records',async()=>{
 await assert.rejects(scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>page([job(1),{country:'India',title:'Missing ID'}],2)}),/incomplete|identity/i)
})
test('Phenom marks an explicit page cap incomplete on every positive job',async()=>{
 const jobs=await scraper.run({maxPages:1,detailEnrichmentBudgetMs:0,fetchText:async()=>page([job(1)],2,1)})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
})
test('Phenom marks an explicit job cap incomplete without visiting optional details',async()=>{
 const jobs=await scraper.run({maxJobs:1,detailEnrichmentBudgetMs:0,fetchText:async()=>page([job(1),job(2)],2)})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
})
test('Phenom retains complete listing jobs when optional detail budget expires',async()=>{
 let detailCalls=0,detailAborted=false
 const jobs=await scraper.run({detailEnrichmentBudgetMs:15,fetchText:async(url,{signal})=>{
  if(isListing(url))return page([job(1),job(2)],2)
  detailCalls++;signal.addEventListener('abort',()=>{detailAborted=true},{once:true});return new Promise(()=>{})
 }})
 assert.equal(jobs.length,2);assert.equal(detailCalls,1);assert.equal(detailAborted,true);assert.ok(jobs.every(x=>x.sourceListingComplete!==false))
})
test('Phenom does not enrich an unrelated detail into a listing',async()=>{
 const jobs=await scraper.run({fetchText:async url=>isListing(url)?page([job(1)],1):detail(job('other'))})
 assert.equal(jobs[0].jobId,'1');assert.equal(jobs[0].title,'Role 1')
})
test('Phenom preserves prior jobs when a complete raw listing has unknown country',async()=>{
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>page([job(1),job(2,'')],2,2,{India:1})})
 assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
})
test('Phenom honors cancellation before a request and after an injected response',async()=>{
 let calls=0;const reason=new Error('Caller stopped')
 await assert.rejects(scraper.run({signal:AbortSignal.abort(reason),fetchText:async()=>{calls++;return page([],0)}}),e=>e===reason);assert.equal(calls,0)
 const controller=new AbortController()
 await assert.rejects(scraper.run({signal:controller.signal,fetchText:async()=>{controller.abort(reason);return page([job(1)],1)}}),e=>e===reason)
})
test('Phenom honors cancellation during optional detail work',async()=>{
 const controller=new AbortController();const reason=new Error('Caller stopped details')
 await assert.rejects(scraper.run({signal:controller.signal,fetchText:async url=>{if(isListing(url))return page([job(1)],1);controller.abort(reason);return detail(job(1))}}),e=>e===reason)
})

const widgetBootstrap = page([],0).replace('phApp.ddo =', 'var phApp = phApp || {"widgetApiEndpoint":"https://careers.example.com/widgets","locale":"en_global","deviceType":"desktop","country":"global","pageName":"search-results"}; phApp.ddo =')
test('Phenom neutral s=1 search flag still uses the complete country widget inventory', async()=>{
 const flagged=createPhenomScraper({companyName:'Example',source:'flagged',baseUrl:'https://careers.example.com',searchPath:'/global/en/search-results?s=1',scraperDir:fileURLToPath(new URL('.',import.meta.url))})
 const jobs=await flagged.run({detailEnrichmentBudgetMs:0,fetchText:async()=>widgetBootstrap,fetchJson:async()=>({refineSearch:{status:200,totalHits:1,hits:1,data:{jobs:[job(1)],aggregations:[{field:'country',value:{India:1}}]}}})})
 assert.equal(jobs.length,1);assert.equal(jobs[0].jobId,'1');assert.notEqual(jobs[0].sourceListingComplete,false)
})
for(const query of ['s=2','s=1&s=1','s=1&category=Division'])test('Phenom preserves unsupported search scope '+query,async()=>{
 const scoped=createPhenomScraper({companyName:'Example',source:'scoped-flag',baseUrl:'https://careers.example.com',searchPath:'/global/en/search-results?'+query,scraperDir:fileURLToPath(new URL('.',import.meta.url))})
 const jobs=await scoped.run({detailEnrichmentBudgetMs:0,fetchText:async()=>widgetBootstrap,fetchJson:async()=>{throw new Error('Unsupported search scope was lost')}})
 assert.equal(jobs.length,0)
})
test('Phenom uses the verified same-origin widget for complete larger listing pages', async()=>{
 const requests=[]
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async url=>{requests.push(['html',url]);return widgetBootstrap},fetchJson:async(url,options)=>{
  const body=JSON.parse(options.body);requests.push(['widget',body.from]);assert.equal(url,'https://careers.example.com/widgets');assert.equal(options.method,'POST');assert.equal(body.jobs,true);assert.equal(body.size,100);assert.equal(body.ddoKey,'refineSearch');assert.ok(options.signal)
  const count=body.from===0?100:5;return {refineSearch:{status:200,totalHits:105,hits:count,data:{jobs:Array.from({length:count},(_,i)=>job(body.from+i)),aggregations:[{field:'country',value:{India:105}}]}}}
 }})
 assert.equal(jobs.length,105);assert.deepEqual(requests.map(x=>x[0]),['html','widget','widget']);assert.deepEqual(requests.slice(1).map(x=>x[1]),[0,100]);assert.ok(jobs.every(x=>x.sourceListingComplete!==false))
})
test('Phenom never sends listing POSTs to an unrelated widget host',async()=>{
 let widgetCalls=0
 const html=widgetBootstrap.replace('https://careers.example.com/widgets','https://unrelated.example/widgets').replace('"totalHits":0','"totalHits":0')
 const jobs=await scraper.run({fetchText:async()=>html,fetchJson:async()=>{widgetCalls++;throw new Error('Unexpected external POST')}})
 assert.equal(jobs.length,0);assert.equal(widgetCalls,0)
})
test('Phenom does not accept a malformed zero-count jobs contract',async()=>{
 await assert.rejects(scraper.run({fetchText:async()=>'<script>phApp.ddo = {"eagerLoadRefineSearch":{"totalHits":0,"data":{}}}</script>'}),/payload/i)
 await assert.rejects(scraper.run({fetchText:async()=>widgetBootstrap,fetchJson:async()=>({refineSearch:{status:200,totalHits:0,data:{}}})}),/payload/i)
})
test('Phenom listing budget keeps collected positives explicitly incomplete and aborts a hung page',async()=>{
 let aborted=false,calls=0
 const jobs=await scraper.run({listingBudgetMs:15,detailEnrichmentBudgetMs:0,fetchText:async(url,{signal})=>{
  calls++;if(calls===1)return page([job(1)],3,1)
  signal.addEventListener('abort',()=>{aborted=true},{once:true});return new Promise(()=>{})
 }})
 assert.equal(calls,2);assert.equal(aborted,true);assert.equal(jobs.length,1);assert.equal(jobs[0].sourceListingComplete,false)
})

test('Phenom counts distinct upstream sequence IDs even when requisition IDs repeat',async()=>{
 const rows=[{...job(1),jobSeqNo:'IN-1-EN'},{...job(1),jobSeqNo:'IN-1-HI'}]
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async url=>{const offset=Number(new URL(url).searchParams.get('from')||0);return page(offset<2?[rows[offset]]:[],2,1)}})
 assert.equal(jobs.length,2);assert.ok(jobs.every(x=>x.sourceListingComplete!==false))
})
test('Phenom does not remove an existing scoped search URL when switching to a widget',async()=>{
 const scoped=createPhenomScraper({companyName:'Example division',source:'scoped',baseUrl:'https://careers.example.com',searchPath:'/global/en/search-results?category=Division',scraperDir:fileURLToPath(new URL('.',import.meta.url))})
 let calls=0
 const jobs=await scoped.run({fetchText:async()=>widgetBootstrap,fetchJson:async()=>{calls++;throw new Error('Wrong global query')}})
 assert.equal(jobs.length,0);assert.equal(calls,0)
})

test('Phenom retains explicit India secondary locations behind a foreign primary country',async()=>{
 const mixed={...job(1,'South Africa'),city:'Johannesburg',cityStateCountry:'Johannesburg, South Africa',multi_location:['Johannesburg, South Africa','Bangalore, Karnataka, India']}
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>page([mixed],1,1,{India:1,'South Africa':1})})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].location,'Bangalore, Karnataka, India');assert.equal(jobs[0].city,'Bangalore');assert.equal(jobs[0].sourceListingComplete,undefined);assert.deepEqual(jobs[0].locations,mixed.multi_location)
})
test('Phenom widget matches official selected_fields aliases and deterministic date ordering',async()=>{
 const html=widgetBootstrap.replace('"India":0','"India":1,"India / India":1')
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>html,fetchJson:async(url,options)=>{
  const body=JSON.parse(options.body);assert.deepEqual(body.selected_fields,{country:['India','India / India']});assert.deepEqual(body.sort,{field:'postedDate',order:'desc'});assert.equal(body.global,true)
  return {refineSearch:{status:200,totalHits:2,hits:2,data:{jobs:[job(1),job(2,'India / India')],aggregations:[{field:'country',value:{India:1,'India / India':1}}]}}}
 }})
 assert.equal(jobs.length,2);assert.ok(jobs.every(x=>x.sourceListingComplete!==false))
})

for(const [key,value] of [['maxPages',0],['maxPages',-1],['maxJobs',0],['maxJobs',-1]]){
 test('Phenom rejects '+key+'='+value+' before an empty snapshot or request',async()=>{
  let requests=0
  await assert.rejects(scraper.run({[key]:value,fetchText:async()=>{requests++;return page([],0)}}),/PHENOM_INCOMPLETE_SNAPSHOT/)
  assert.equal(requests,0)
 })
}
test('Phenom optional details preserve the verified India secondary location and city',async()=>{
 const mixed={...job(1,'South Africa'),city:'Johannesburg',cityStateCountry:'Johannesburg, South Africa',multi_location:['Johannesburg, South Africa','Bangalore, Karnataka, India']}
 const jobs=await scraper.run({fetchText:async url=>isListing(url)?page([mixed],1,1,{India:1,'South Africa':1}):detail({...mixed,location:'Johannesburg, South Africa',ml_country:'South Africa'})})
 assert.equal(jobs.length,1);assert.equal(jobs[0].country,'India');assert.equal(jobs[0].location,'Bangalore, Karnataka, India');assert.equal(jobs[0].city,'Bangalore');assert.deepEqual(jobs[0].locations,mixed.multi_location);assert.equal(jobs[0].publicExperienceChecked,true)
})


test('Phenom preserves an existing keyword constraint when using the complete widget inventory', async () => {
 const scoped = createPhenomScraper({companyName:'Example division',source:'keyword-scope',baseUrl:'https://careers.example.com',searchPath:'/global/en/search-results?keywords=Division+Name',scraperDir:fileURLToPath(new URL('.',import.meta.url))})
 let calls=0
 const jobs=await scoped.run({detailEnrichmentBudgetMs:0,fetchText:async()=>widgetBootstrap,fetchJson:async(url,options)=>{
  calls++; const body=JSON.parse(options.body); assert.equal(body.keywords,'Division Name')
  return {refineSearch:{status:200,totalHits:1,hits:1,data:{jobs:[job(1)],aggregations:[{field:'country',value:{India:1}}]}}}
 }})
 assert.equal(calls,1); assert.equal(jobs.length,1); assert.equal(jobs[0].sourceListingComplete,undefined)
})


test('Phenom uses the verified country count to avoid a duplicate boundary in 225 tied listings', async () => {
 const html=widgetBootstrap.replace('"totalHits":0','"totalHits":9000').replace('"India":0','"India":225')
 const requests=[]
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>html,fetchJson:async(_url,options)=>{
  const body=JSON.parse(options.body);requests.push({size:body.size,from:body.from})
  const count=Math.max(0,Math.min(body.size,225-body.from))
  // The date-sorted 100-record pages can overlap at an equal-date boundary.
  const start=body.size===100&&body.from===100?99:body.from
  return {refineSearch:{status:200,totalHits:225,hits:count,data:{jobs:Array.from({length:count},(_,i)=>job(start+i)),aggregations:[{field:'country',value:{India:225}}]}}}
 }})
 assert.deepEqual(requests,[{size:225,from:0}])
 assert.equal(jobs.length,225);assert.equal(new Set(jobs.map(job=>job.jobId)).size,225)
 assert.ok(jobs.every(job=>job.sourceListingComplete!==false))
})

test('Phenom caps country-sized widget requests at 500 and still verifies every later page', async () => {
 const html=widgetBootstrap.replace('"totalHits":0','"totalHits":9000').replace('"India":0','"India":2000')
 const requests=[]
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>html,fetchJson:async(_url,options)=>{
  const body=JSON.parse(options.body);requests.push({size:body.size,from:body.from})
  const count=Math.max(0,Math.min(body.size,600-body.from))
  return {refineSearch:{status:200,totalHits:600,hits:count,data:{jobs:Array.from({length:count},(_,i)=>job(body.from+i)),aggregations:[{field:'country',value:{India:600}}]}}}
 }})
 assert.deepEqual(requests,[{size:500,from:0},{size:500,from:500}])
 assert.equal(jobs.length,600);assert.ok(jobs.every(job=>job.sourceListingComplete!==false))
})

test('Phenom keeps 100-record requests when the bootstrap has no verified target-country count', async () => {
 const html=widgetBootstrap.replace('"totalHits":0','"totalHits":9000').replace('"India":0','"Canada":9000')
 let request
 const jobs=await scraper.run({detailEnrichmentBudgetMs:0,fetchText:async()=>html,fetchJson:async(_url,options)=>{
  request=JSON.parse(options.body)
  return {refineSearch:{status:200,totalHits:1,hits:1,data:{jobs:[job(1)],aggregations:[{field:'country',value:{India:1}}]}}}
 }})
 assert.equal(request.size,100);assert.equal(request.selected_fields,undefined)
 assert.equal(jobs.length,1)
})
