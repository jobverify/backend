import assert from 'node:assert/strict'
import fs from 'node:fs'
import crypto from 'node:crypto'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {run,extractIndiaListings,extractJobDetail,CAREERS_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {extractionDetailHealth} from '../../scraper-support/utils/extractionDetailHealth.js'
const {packets}=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-page-contract-20261031.json.gz',import.meta.url))))
for(const packet of packets)assert.equal(crypto.createHash('sha256').update(packet.body).digest('hex'),packet.sha256)
const listings=extractIndiaListings(packets[0].body),detail=packets[2]
const parse=(body=detail.body,listing=listings[0])=>extractJobDetail({listing,html:body})
test('captured literal JD uses native canonical role identity and complete visible description without invented requisition',()=>{
 const job=parse()
 assert.equal(job.requisitionId,null)
 assert.equal(job.jobId,'amicorp-market-intelligence-lead-mumbai-jd')
 assert.equal(job.location,'Mumbai, India');assert.equal(job.country,'India')
 assert.equal(job.postingDate,'2026-10-23')
 assert.ok(job.jobDescription.includes('Always-On Monitoring'))
 assert.ok(job.jobDescription.includes('How This Role Fits the Team'))
 assert.ok(job.jobDescription.includes('Skills & Tools'))
 assert.ok(job.jobDescription.length>7000)
 assert.equal(job.rawNativeRoleEvidence.listingTitle,'Market Intelligence Lead')
 assert.equal(job.rawNativeRoleEvidence.detailHeading,'Marketing Intelligence Lead')
 assert.equal(job.sourceListingComplete,false)
 assert.equal(job.sourceDetailComplete,false)
 assert.equal(job.sourceDetailStatus,'identity-mismatch')
 assert.equal(job.sourceDetailFailureKind,'identity-mismatch')
 assert.equal(extractionDetailHealth([job]).failureKinds['identity-mismatch'],1)
})
test('two captured unnumbered role URLs retain distinct native identities and numbered roles retain their IDs',()=>{
 const second=extractJobDetail({listing:listings[1],html:packets[3].body})
 const legacyListing=listings.find(row=>row.sourceUrl===packets[4].url)
 const numbered=extractJobDetail({listing:legacyListing,html:packets[4].body})
 assert.notEqual(second.jobId,parse().jobId);assert.equal(second.requisitionId,null)
 assert.equal(numbered.requisitionId,'JD1608');assert.equal(numbered.jobId,'amicorp-jd1608')
 assert.equal(numbered.country,'India')
 assert.equal(second.sourceDetailComplete,true);assert.equal(numbered.sourceDetailComplete,true)
 assert.equal(second.sourceDetailStatus,'complete');assert.equal(numbered.sourceDetailStatus,'complete')
 assert.notEqual(second.sourceDetailFailureKind,'identity-mismatch');assert.notEqual(numbered.sourceDetailFailureKind,'identity-mismatch')
})
test('extra seniority or duties after the native head-title prefix cannot masquerade as the advertised role',()=>{
 const original='<title>Market Intelligence Lead Mumbai - JD - Amicorp</title>'
 for(const title of ['Market Intelligence Lead Senior Executive Mumbai - JD - Amicorp','Market Intelligence Lead Other Duties Mumbai - JD - Amicorp','Market Intelligence Lead Mumbai - JD2 - Amicorp']){
  const changed=detail.body.replace(original,'<title>'+title+'</title>')
  assert.notEqual(changed,detail.body)
  assert.throws(()=>parse(changed),/title contradiction/i)
 }
})
test('registered default transport keeps the bound role from a two-candidate cap and retains its identity-mismatch failure',async t=>{
 const calls=[],controller=new AbortController()
 t.mock.method(globalThis,'fetch',async(url,init)=>{
  calls.push(String(url));const packet=packets.find(row=>row.url===String(url));assert.ok(packet,'Only captured first-party URLs')
  assert.ok(init.signal instanceof AbortSignal)
  const response=new Response(packet.body,{status:packet.status});Object.defineProperty(response,'url',{value:packet.finalUrl});return response
 })
 const provider=getScraperCatalog().find(row=>row.source==='amicorp')
 const jobs=await createCatalogScraper(provider).run({maxJobs:2,signal:controller.signal})
 assert.equal(jobs.length,1);assert.equal(calls.length,4)
 assert.equal(jobs[0].title,'Client Messaging & WhatsApp Lead')
 assert.equal(jobs[0].nativeCollectionEvidence.failures.length,1)
 assert.equal(jobs[0].nativeCollectionEvidence.failures[0].failureKind,'identity-mismatch')
 const evidence=readInventoryEvidence(jobs)
 assert.equal(evidence.listingComplete,false);assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null)
 assert.ok(jobs.every(job=>job.source==='amicorp'&&job.company==='Amicorp'&&job.sourceListingComplete===false))
})
for(const [label,change] of [
 ['foreign canonical',html=>html.replace('rel="canonical" href="'+detail.url,'rel="canonical" href="https://foreign.invalid/role')],
 ['foreign employer',html=>html.replace('content="Amicorp"','content="Other employer"')],
 ['hidden role body',html=>html.replace(/<body\b/,'<body hidden')],
 ['hidden native metadata',html=>html.replace('title-h5"','title-h5" hidden')],
 ['foreign active application',html=>html.replaceAll('https://forms.zohopublic.eu/zohopeople40/form/CareerPageForm/','https://foreign.invalid/CareerPageForm/')],
 ['foreign workplace',html=>html.replace('Mumbai, India</span>','Mumbai, United States</span>')],
])test('captured role fails closed on '+label,()=>assert.throws(()=>parse(change(detail.body))))
test('hidden and script-only description additions are excluded from native role text',()=>{
 const body=detail.body.replace(/(<a[^>]+href="#form"[\s\S]*?<\/a>)/,'$1<p hidden>FALSE HIDDEN ROLE DUTY</p><script>FALSE SCRIPT ROLE DUTY</script>')
 assert.notEqual(body,detail.body)
 const job=parse(body)
 assert.ok(!job.jobDescription.includes('FALSE HIDDEN ROLE DUTY'));assert.ok(!job.jobDescription.includes('FALSE SCRIPT ROLE DUTY'))
})
test('captured advertised cards cannot become active roles from hidden or script-only listing markup',()=>{
 assert.ok(extractIndiaListings(packets[0].body).length>0)
 assert.deepEqual(extractIndiaListings(packets[0].body.replace(/<body\b/,'<body hidden')),[])
 const card=packets[0].body.match(/<a\b[^>]*class="[^"]*gem-infotext-wrap[^"]*"[\s\S]*?<\/a>/i)?.[0]
 assert.ok(card&&!/<\/script/i.test(card))
 assert.deepEqual(extractIndiaListings('<html><body><script type="application/json">'+card+'</script></body></html>'),[])
 assert.deepEqual(extractIndiaListings('<html><body><template>'+card+'</template></body></html>'),[])
})
test('caller cancellation before or during the default transport preserves the exact reason and starts no further native reads',async t=>{
 const controller=new AbortController(),reason=Object.freeze({kind:'Amicorp controlled caller cancellation'}),calls=[]
 t.mock.method(globalThis,'fetch',async url=>{calls.push(String(url));controller.abort(reason);throw Error('Native transport replacement abort')})
 await assert.rejects(run({maxJobs:1,signal:controller.signal}),error=>error===reason)
 assert.equal(calls.length,1)
 await assert.rejects(run({maxJobs:1,signal:controller.signal}),error=>error===reason)
 assert.equal(calls.length,1)
})
