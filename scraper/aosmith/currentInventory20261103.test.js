import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readCurrentAoSmithInitializer} from './currentInventory.js'
import {readNativeListing,readNativePosting} from './native.js'
import {document as readRmkDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
const directory=new URL('./test-data/current-20261103/',import.meta.url)
const manifest=JSON.parse(await fs.readFile(new URL('manifest.json',directory),'utf8'))
const packets=await Promise.all(manifest.files.map(async row=>({...row,body:gunzipSync(await fs.readFile(new URL(row.file,directory))).toString('utf8')})))
const search='https://jobs.aosmith.com/search/',home='https://www.aosmith.com/'
const own=packets.find(row=>new URL(row.url).pathname.startsWith('/job/')).url
const replay=(change=()=>{})=>{
 const reads=[],counts=new Map()
 return{reads,counts,fetchPage:async(url,options={})=>{
  const index=counts.get(url)??0;counts.set(url,index+1);reads.push(url)
  const candidates=packets.filter(row=>row.url===url);assert.ok(candidates.length,'Unretained native public GET '+url)
  const original=candidates[Math.min(index,candidates.length-1)],page={url,status:original.status,headers:{'content-type':original.contentType,...(original.location?{location:original.location}:{})},bodyBase64:Buffer.from(original.body).toString('base64')}
  await change({url,index,page,options,reads});return page
 }}
}
const edit=(page,change)=>{const before=Buffer.from(page.bodyBase64,'base64').toString('utf8'),after=change(before);assert.notEqual(after,before,'Mutation must affect actual native evidence');page.bodyBase64=Buffer.from(after).toString('base64')}

test('A. O. Smith verifies all73 full native roles over2detail passes and a final inventory traversal',async()=>{
 const mock=replay();let audit
 const jobs=await run({...mock,maxJobs:0,onAudit:value=>{audit=value}})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,73)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,0)
 assert.equal(mock.reads.filter(url=>new URL(url).pathname.startsWith('/job/')).length,146)
 assert.equal(mock.counts.get(search),3)
 assert.ok(mock.reads.lastIndexOf(search)>Math.max(...mock.reads.map((url,index)=>new URL(url).pathname.startsWith('/job/')?index:-1)))
 assert.equal(audit.observations.length,73)
 assert.ok(audit.observations.every(row=>row.sourceDetailComplete&&row.sourceOwnModelStabilityQualified&&row.sourceScopeComplete===false&&row.lifecycleCleanupAllowed===false))
})

test('A. O. Smith changed closing own full criteria cannot become a qualified zero',async()=>{
 const mock=replay(({url,index,page})=>{if(url===own&&index===1)edit(page,html=>html.replace(/(itemprop="description"[^>]*>)/i,'$1<p>Additional current requirements changed during collection.</p>'))})
 const jobs=await run(mock)
 assert.equal(mock.counts.get(own),2)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('A. O. Smith final inventory change after all closing details remains partial',async()=>{
 const mock=replay(({url,index,page})=>{if(url===search&&index===2)edit(page,html=>html.replaceAll('Operator-Direct','Updated Operator-Direct'))})
 const jobs=await run(mock)
 assert.equal(mock.counts.get(search),3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('A. O. Smith source-local HTTP denial retains blocked status without pipeline fatal flags',async()=>{
 const mock=replay(({url,page})=>{if(url===home)page.status=403})
 await assert.rejects(run(mock),error=>error.status===403&&error.failureKind==='blocked'&&error.abortRetries===true&&!error.abortPipeline&&!error.isPipelineFatal)
 assert.equal(mock.reads.length,1)
})

test('A. O. Smith public collection deadline bounds an ignoring reader and preserves caller reason',{timeout:800},async()=>{
 const reason=Object.freeze({caller:'stopped'}),controller=new AbortController(),pending=run({fetchPage:()=>new Promise(()=>{}),signal:controller.signal,collectionBudgetMs:300})
 controller.abort(reason);await assert.rejects(pending,error=>error===reason)
 await assert.rejects(run({fetchPage:()=>new Promise(()=>{}),collectionBudgetMs:15}),error=>error.code==='AOSMITH_COLLECTION_TIMEOUT')
})

const initializerBlock=html=>[...html.matchAll(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi)].find(match=>match[0].includes('j2w.SearchResults.init'))[0]

test('A. O. Smith ordinary CSS-hidden executable initializer still supplies the native public model',async()=>{
 const mock=replay(({url,page})=>{if(url===search)edit(page,html=>{const block=initializerBlock(html);return html.replace(block,'<div style="display:none">'+block+'</div>')})})
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})

test('A. O. Smith comments, dormant branches, nomodule and extra namespace writes cannot activate an initializer',()=>{
 const html=packets.find(row=>row.url===search).body,block=initializerBlock(html)
 for(const replacement of[
  '<!--'+block+'-->',
  block.replace(/\$\s*\(/,'if(false) $('),
  block.replace('<script','<script nomodule'),
  '<template>'+block+'</template>',
  block+'<script>window.j2w={};</script>',
  block+'<script>class j2w {}</script>',
 ])assert.throws(()=>readCurrentAoSmithInitializer(html.replace(block,replacement)))
})

test('A. O. Smith public client comments do not veto an unchanged executable inventory program',async()=>{
 const mock=replay(({url,page})=>{if(url.includes('/j2w.searchResults.min.js'))edit(page,html=>'/* Current public inventory deployment comment. */\n'+html)})
 assert.equal(readInventoryEvidence(await run(mock)).listingComplete,true)
})

test('A. O. Smith bounds an ignoring audit observer after completed native reads',async()=>{
 let observed=false
 await assert.rejects(run({...replay(),collectionBudgetMs:5000,onAudit:()=>{observed=true;return new Promise(()=>{})}}),error=>error.code==='AOSMITH_COLLECTION_TIMEOUT')
 assert.equal(observed,true)
})

test('A. O. Smith original posting date changes between own detail passes stay unresolved',async()=>{
 const mock=replay(({url,index,page})=>{if(url===own&&index===1)edit(page,html=>html.replace(/(itemprop="datePosted"\s+content=")[^"]+/, '$1Mon Nov 02 08:00:00 UTC 2026'))})
 const jobs=await run(mock)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
})

test('A. O. Smith future native India positives remain candidates, zero is unlimited and a positive cap is partial',async()=>{
 const listing=readNativeListing(packets.find(row=>row.url===search).body).rows.slice(0,2)
 const models=new Map(listing.map(row=>[row.sourceUrl,readNativePosting(packets.find(page=>page.url===row.sourceUrl).body,row)]))
 const change=({url,page})=>{
  if(url===search)edit(page,html=>listing.reduce((body,row)=>body.replaceAll(row.nativeLocations[0],'Bengaluru, Karnataka, IN, 560001'),html))
  if(models.has(url))edit(page,html=>{
   const row=listing.find(row=>row.sourceUrl===url),original=models.get(url)
   const scope='<div itemscope itemtype="http://schema.org/JobPosting"><h1 itemprop="title">'+row.title+'</h1>'
    +'<meta itemprop="hiringOrganization" content="A. O. Smith Corporation"><meta itemprop="datePosted" content="Sun Nov 01 08:00:00 UTC 2026">'
    +'<span itemprop="jobLocation" itemscope itemtype="http://schema.org/Place"><span itemprop="address" itemscope itemtype="http://schema.org/PostalAddress">'
    +'<meta itemprop="addressLocality" content="Bengaluru"><meta itemprop="addressRegion" content="Karnataka"><meta itemprop="addressCountry" content="IN"><meta itemprop="postalCode" content="560001"></span></span>'
    +'<span class="jobGeoLocation">Bengaluru, Karnataka, IN, 560001</span><div itemprop="description">'+original.sourceNativeDescriptionHTML+'</div><a href="'+original.applyUrl+'">Apply now</a></div>'
   return html.replace(original.sourceNativePostingHTML,scope)
  })
 }
 const unlimited=await run({...replay(change),maxJobs:0})
 assert.equal(unlimited.length,2)
 assert.ok(unlimited.every(row=>row.country==='India'&&row.sourceDetailComplete&&row.jobDescription.length>1000))
 assert.equal(readInventoryEvidence(unlimited).listingComplete,true)
 const capped=await run({...replay(change),maxJobs:1})
 assert.equal(capped.length,1)
 assert.equal(readInventoryEvidence(capped).listingComplete,false)
 assert.equal(readInventoryEvidence(capped).indiaFacetCount,2)
})

test('A. O. Smith current initializer cannot use a replaced ready function or escaped native namespace',()=>{
 const html=packets.find(row=>row.url===search).body,block=initializerBlock(html)
 for(const source of['function $(callback){return;}','const alias=j2w;alias.SearchResults.init=function(){};'])
  assert.throws(()=>readCurrentAoSmithInitializer(html.replace(block,'<script>'+source+'</script>'+block)))
})

const insertPostingField=(html,markup)=>{
 const doc=readRmkDocument(html),scope=doc.nodes(node=>Object.hasOwn(node.attrs,'itemscope')&&/schema\.org\/JobPosting/.test(node.attrs.itemtype??''))[0]
 return html.slice(0,scope.closeStart)+markup+html.slice(scope.closeStart)
}

test('A. O. Smith every native workplace is retained even when one has no typed address',async()=>{
 const mock=replay(({url,page})=>{if(url===own)edit(page,html=>insertPostingField(html,'<div itemprop="jobLocation" itemscope itemtype="https://schema.org/Place"><span itemprop="name">Bengaluru, India</span></div>'))})
 const jobs=await run(mock),row=jobs.sourceAudit.observations.find(row=>row.sourceUrl===own)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(row.sourceCountryScopeUnresolved,true)
 assert.equal(row.sourceNativeJobLocations.length,2)
 assert.ok(row.jobDescription.length>1000)
})

test('A. O. Smith public qualifications outside the main description remain in full criteria',async()=>{
 const text='Must hold the independently published native review qualification certificate.'
 const mock=replay(({url,page})=>{if(url===own)edit(page,html=>insertPostingField(html,'<section itemprop="qualifications"><h2>Additional mandatory public qualifications</h2><p>'+text+'</p></section>'))})
 const jobs=await run(mock),row=jobs.sourceAudit.observations.find(row=>row.sourceUrl===own)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
 assert.ok(row.jobDescription.includes(text))
 assert.ok(row.sourceNativeStructuredFields.some(field=>field.property==='qualifications'&&field.text.includes(text)))
})

test('A. O. Smith structured additional qualifications cannot silently lose mandatory metadata',async()=>{
 const mock=replay(({url,page})=>{if(url===own)edit(page,html=>insertPostingField(html,'<section itemprop="qualifications" itemscope itemtype="https://schema.org/EducationalOccupationalCredential"><meta itemprop="credentialCategory" content="Mandatory native credential"></section>'))})
 const jobs=await run(mock),row=jobs.sourceAudit.observations.find(row=>row.sourceUrl===own)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.ok(row.sourceNativeFieldIssues.some(value=>value.startsWith('qualifications:')))
 assert.ok(row.sourceNativeStructuredFields.some(field=>field.property==='qualifications'&&field.html.includes('Mandatory native credential')))
})
