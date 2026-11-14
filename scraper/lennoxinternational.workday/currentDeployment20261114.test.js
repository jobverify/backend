import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {assessSoftFailureAcquisition} from '../../scripts/softFailureAssessment20261113.mjs'
import {profile,readShell,readListing} from './nativeContract20261111.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-20261114/native-responses.json.gz',import.meta.url))))
const provider=getScraperCatalog().find(row=>row.source==='lennoxinternational')
const saved=url=>fixture.responses.find(row=>row.url===url).body
const secondURL='https://globalcareers-lennox.icims.com/jobs/search?pr=1&in_iframe=1&searchLocation=13228--Chennai'
const hash=value=>createHash('sha256').update(value).digest('hex')
function replay(change=(_url,row)=>row){
 const requests=[],counts=new Map()
 const fetchImpl=async(url,init={})=>{
  url=String(url);init.signal?.throwIfAborted();assert.equal(init.method||'GET','GET')
  const count=(counts.get(url)||0)+1;counts.set(url,count);requests.push(url)
  const originals=fixture.responses.filter(row=>row.url===url),original=originals[Math.min(count-1,originals.length-1)]
  assert.ok(original,'Undeclared current read '+url)
  const row=await change(url,structuredClone(original),count),response=new Response(row.body,{status:row.status,headers:row.headers})
  Object.defineProperty(response,'url',{value:row.finalUrl??row.url});return response
 }
 return {fetchImpl,requests,counts}
}
test('actual current Lennox role and declared platform entities retain complete original bytes',()=>{
 assert.equal(fixture.responses.length,29)
 for(const row of fixture.responses)assert.equal(hash(row.body),row.sha256)
})
test('current exact shell deployment retains its own employer-bound native frame',()=>{
 const shell=readShell(saved(profile.shellURL));assert.equal(shell.declaredFrameURL,profile.frameURL)
})
test('current native two-page declarations retain the original India facet and terminal state',()=>{
 const first=readListing(saved(profile.frameURL),{requestedURL:profile.frameURL,pageNumber:1,maxPages:2})
 const second=readListing(saved(secondURL),{requestedURL:secondURL,pageNumber:2,maxPages:2})
 assert.equal(first.rows.length,20);assert.equal(second.rows.length,1)
 assert.equal(first.nextURL,secondURL);assert.equal(second.nextURL,null)
 assert.equal(first.declaredPageCount,2);assert.equal(second.declaredPageCount,2)
})
test('registered Lennox International current two-page cohort retains all21 original India role criteria and cleanup holds',async()=>{
 let audit;const io=replay(),jobs=await createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,21);assert.equal(new Set(jobs.map(job=>job.jobId)).size,21)
 assert.ok(jobs.every(job=>job.country==='India'&&job.company==='Lennox International'&&job.fullSourceDetailQualified===true&&job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.ok(jobs.every(job=>job.jobDescription===job.sourceNativeSchema.description&&job.sourceNativeSchema.jobLocation.every(place=>place.address.addressCountry==='IN')))
 assert.equal(jobs.find(job=>job.jobId==='57924').postingDate,'2026-11-12T05:00:00.000Z')
 assert.equal(jobs.find(job=>job.jobId==='52021').postingDate,'2026-03-18T04:00:00.000Z')
 assert.equal(audit.observedNativeCount,21);assert.equal(audit.listing.listingPageCount,2)
 assert.equal(audit.closingInventoryMatches,true);assert.equal(audit.closingOwnModelsMatch,true)
 assert.equal(io.requests.length,58);assert.equal(io.counts.get(secondURL),2)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
 assert.equal(assessSoftFailureAcquisition(provider,jobs).runnerOutcome.success,true)
})

const currentProfile=JSON.parse(readFileSync(new URL('./reviewedCurrentShell20261114.json',import.meta.url)))
const firstAsset=currentProfile.shellAssets[0].url,firstRole=fixture.responses.find(row=>row.url.includes('/jobs/57924/')).url
const cardPattern=/<li\b[^>]*class=["'][^"']*\biCIMS_JobCardItem\b[^"']*["'][^>]*>[\s\S]*?<\/li>/g
const card=html=>{const value=html.match(cardPattern)?.[0];assert.ok(value,'Expected actual native card');return value}
const edited=(before,after)=>{assert.notEqual(before,after,'Expected actual-response mutation');return after}
for(const asset of currentProfile.shellAssets)test('current shell requires original declared asset bytes '+asset.url.split('/').at(-1),async()=>{
 const io=replay((url,row)=>{if(url===asset.url)row.body+='\n/* changed native program */';return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/shell asset bytes changed/)
 assert.equal(io.requests.includes(profile.frameURL),false)
})
test('current shell exact asset hash binds original entity bytes including a UTF8 BOM',async()=>{
 const io=replay((url,row)=>{if(url===firstAsset)row.body='\uFEFF'+row.body;return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/shell asset bytes changed/)
 assert.equal(io.requests.includes(profile.frameURL),false)
})

test('current shell asset bytes are independently reconciled again at closing',async()=>{
 const io=replay((url,row,count)=>{if(url===firstAsset&&count===2)row.body+='\n/* changed closing program */';return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/shell asset bytes changed/)
 assert.equal(io.counts.get(firstRole),2)
})
for(const [name,edit,pattern]of [
 ['mixed old/current platform set',html=>html.replace('platform_189.2.1.261113-4ca730cca10-11-pg-0/script/lib/domreplacement/','platform_189.1.1.261106-f304818e678-11-pg-0/script/lib/domreplacement/'),/program set/],
 ['unknown platform version',html=>html.replaceAll('platform_189.2.1.261113-4ca730cca10-11-pg-0','platform_190.0.0.unreviewed'),/program set/],
 ['native frame endpoint drift',html=>html.replace('icimsFrame.src =','otherFrame.src ='),/program|AST/],
])test('current shell rejects '+name,()=>{const original=saved(profile.shellURL);assert.throws(()=>readShell(edited(original,edit(original))),pattern)})
for(const [name,edit,pattern]of [
 ['foreign facet',html=>html.replaceAll(secondURL.replaceAll('&','&amp;'),secondURL.replace('13228--Chennai','999--Foreign').replaceAll('&','&amp;')),/pagination.*(?:facet|declaration)/],
 ['next-page cycle',html=>html.replaceAll(secondURL.replaceAll('&','&amp;'),profile.frameURL.replaceAll('&','&amp;')),/pagination.*declaration/],
 ['unreviewed page count',html=>html.replaceAll('Page 1 of 2','Page 1 of 3'),/pagination/],
 ['missing nonterminal native row',html=>html.replace(card(html),''),/cohort count/],
])test('current native first page rejects '+name,()=>{const original=saved(profile.frameURL);assert.throws(()=>readListing(edited(original,edit(original)),{requestedURL:profile.frameURL,pageNumber:1,maxPages:2}),pattern)})
for(const [name,edit,pattern]of [
 ['wrong canonical endpoint',html=>html.replace('searchLocation=13228--Chennai&pr=1','searchLocation=13228--Chennai&pr=0'),/canonical|pagination/],
 ['wrong terminal page count',html=>html.replaceAll('Page 2 of 2','Page 2 of 3'),/pagination/],
 ['missing terminal native row',html=>html.replace(card(html),''),/cohort count/],
])test('current native terminal page rejects '+name,()=>{const original=saved(secondURL);assert.throws(()=>readListing(edited(original,edit(original)),{requestedURL:secondURL,pageNumber:2,maxPages:2}),pattern)})
test('current registered pagination rejects duplicate identities across its declared pages before detail reads',async()=>{
 const duplicate=card(saved(profile.frameURL)),io=replay((url,row)=>{if(url===secondURL)row.body=edited(row.body,row.body.replace(card(row.body),duplicate));return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/duplicate native listing identities across pages/)
 assert.equal(io.requests.some(url=>url.includes('/jobs/57924/')),false)
})
for(const [name,htmlEdit]of [
 ['additional query-only Next outside pagination',html=>html.replace('</body>','<a href="?pr=2&amp;in_iframe=1&amp;searchLocation=13228--Chennai">Next</a></body>')],
 ['additional foreign-facet query-only Next outside pagination',html=>html.replace('</body>','<a href="?pr=2&amp;in_iframe=1&amp;searchLocation=999--Foreign">Next</a></body>')],
 ['additional relative continuation inside pagination',html=>html.replace('<div class="iCIMS_PagingBatch ">','<a href="?pr=2">Continue</a><div class="iCIMS_PagingBatch ">')],
 ['unreviewed continuation endpoint and label outside pagination',html=>html.replace('</body>','<a href="/unreviewed-listing?cursor=2">Continue</a></body>')],
 ['additional query-only head continuation',html=>html.replace('</head>','<link rel="next" href="?pr=2&amp;in_iframe=1&amp;searchLocation=13228--Chennai"></head>')],
 ['changed actual pagination owner',html=>html.replace('class="iCIMS_Paginator_Bottom"','class="Unreviewed_Paginator_Bottom"')],
])test('current native page rejects '+name,()=>{
 const original=saved(profile.frameURL),changed=edited(original,htmlEdit(original))
 assert.throws(()=>readListing(changed,{requestedURL:profile.frameURL,pageNumber:1,maxPages:2}),/pagination|navigation/)
})

test('closing terminal page rejects an extra query-only continuation outside its native owner',async()=>{
 const io=replay((url,row,count)=>{if(url===secondURL&&count===2)row.body=edited(row.body,row.body.replace('</body>','<a href="?pr=2&amp;searchLocation=13228--Chennai">Next</a></body>'));return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/pagination|navigation/)
 assert.equal(io.counts.get(firstRole),2);assert.equal(io.counts.get(secondURL),2)
})

test('closing terminal page membership and metadata stay exact',async()=>{
 const io=replay((url,row,count)=>{if(url===secondURL&&count===2)row.body=edited(row.body,row.body.replaceAll('Lead Architect - Data Network','Lead Architect - New Data Network'));return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/closing native listing/)
})
test('closing full original criteria cannot change while retaining the same native ID and country',async()=>{
 const io=replay((url,row,count)=>{if(url===firstRole&&count===2){assert.ok(row.body.split('high school diploma').length>=3,'Both original criteria carriers required');row.body=edited(row.body,row.body.replaceAll('high school diploma','accredited high school diploma'))}return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/closing own role/)
})
test('complete current pagination is refused before details when original64read budget cannot cover closing',async()=>{
 const original=card(saved(secondURL)),extra=[90001,90002,90003,90004].map(id=>original.replaceAll('52021',String(id))).join('')
 const io=replay((url,row)=>{if(url===secondURL)row.body=row.body.replace(original,original+extra);return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/read budget cannot cover/)
 assert.equal(io.requests.length,8);assert.equal(io.requests.some(url=>url.includes('/jobs/57924/')),false)
})
test('current declared Javascript MIME remains authoritative',async()=>{
 const io=replay((url,row)=>{if(url===firstAsset)row.headers['content-type']='text/html';return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),/content type/)
 assert.equal(io.requests.includes(profile.frameURL),false)
})
test('current declared asset HTTP refusal preserves status and original bytes',async()=>{
 const io=replay((url,row)=>{if(url===firstAsset)row.status=403;return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl}),error=>error.status===403&&error.abortRetries===true&&error.nativeEvidence.transportPackets.at(-1).bodySHA256===hash(saved(firstAsset)))
 assert.equal(io.requests.length,4)
})
test('opaque cancellation while acquiring a current declared asset starts no native pages',async()=>{
 const controller=new AbortController(),reason={caller:'stop-before-current-assets'},io=replay((url,row)=>{if(url===firstAsset)controller.abort(reason);return row})
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,signal:controller.signal}),error=>error===reason)
 assert.equal(io.requests.length,4);assert.equal(io.requests.includes(profile.frameURL),false)
})
test('current declared asset request retains the existing bounded deadline',async()=>{
 const io=replay(),fetchImpl=(url,init)=>url===firstAsset?new Promise(()=>{}):io.fetchImpl(url,init)
 await assert.rejects(createCatalogScraper(provider).run({fetchImpl,requestTimeoutMs:25}),error=>error.name==='TimeoutError')
})
