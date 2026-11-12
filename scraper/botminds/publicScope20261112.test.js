import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'
import {createBotmindsScraper} from './script.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'

const origin='https://www.botminds.ai',hub=origin+'/careers',api=origin+'/api/jobs',sitemap=origin+'/api/jobs-sitemap'
const packets=['public-scope-originals-20261112.json.gz','public-scope-declarations-20261112.json.gz'].flatMap(name=>
 JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/'+name,import.meta.url)))).packets)
async function collect(t,change=packet=>packet,{maxJobs}={}){
 const seen=new Map()
 t.mock.method(globalThis,'fetch',async(url,options={})=>{
  assert.equal(options.method||'GET','GET')
  const count=(seen.get(String(url))||0)+1;seen.set(String(url),count)
  const matches=packets.filter(packet=>packet.url===String(url))
  assert.ok(matches.length,'Only captured public publisher URLs may be read: '+url)
  const original=matches[Math.min(count-1,matches.length-1)],bytes=Buffer.from(original.bodyBase64,'base64')
  assert.equal(createHash('sha256').update(bytes).digest('hex'),original.bodySHA256)
  const packet=change({...original,body:bytes.toString('utf8'),count})
  const response=new Response(packet.body,{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.responseUrl||packet.finalUrl||String(url)})
  return response
 })
 const scraper=maxJobs===undefined?createCatalogScraper(getScraperCatalog().find(provider=>provider.source==='botminds')):createBotmindsScraper({maxJobs})
 return scraper.run()
}

test('current Botminds controller and independently declared sitemap authorize only the reconciled full native scope',async t=>{
 const jobs=await collect(t),inventory=readInventoryEvidence(jobs)
 assert.deepEqual(jobs.map(job=>job.jobId).sort(),['agentic-solutions-associate','forward-deployed-engineer'])
 assert.equal(inventory.reportedTotal,3)
 assert.equal(inventory.indiaFacetCount,2)
 assert.equal(inventory.status,'complete-inventory')
 assert.equal(sourceLifecycleCleanupForbidden(jobs),false)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===true&&job.lifecycleCleanupAllowed===true))
 assert.ok(jobs.every(job=>job.country==='India'&&job.city==='Chennai'))
 assert.match(jobs.find(job=>job.jobId==='agentic-solutions-associate').sourceDescription,/Exceptional ability/)
 const proof=jobs[0].nativeCollectionEvidence.sourceScopeProof
 assert.equal(proof.method,'official-careers-controller-and-declared-jobs-sitemap')
 assert.equal(proof.opening.jobsSitemapUrl,sitemap)
 assert.deepEqual(proof.opening.nativeRoleIds,['agentic-solutions-associate','forward-deployed-engineer','sales-engineer'])
 assert.deepEqual(proof.opening.nativeRoleIds,proof.closing.nativeRoleIds)
 assert.ok(jobs[0].nativeCollectionEvidence.receipts.some(receipt=>receipt.url===origin+'/robots.txt'))
})

for(const [label,change] of [
 ['company no longer declares the careers hub',packet=>packet.url===origin+'/'?{...packet,body:packet.body.replace('href="/careers"','href="/about"')}:packet],
 ['an additional public recruiting channel is declared',packet=>packet.url===hub?{...packet,body:packet.body.replace('</body>','<a href="https://careers.example.test/botminds">All jobs</a></body>')}:packet],
 ['an unfamiliar ATS domain uses an unrecognized label',packet=>packet.url===hub?{...packet,body:packet.body.replace('</body>','<a href="https://staffportal.example.test">Explore positions</a></body>')}:packet],
 ['the company homepage adds an unreviewed navigation declaration',packet=>packet.url===origin+'/'?{...packet,body:packet.body.replace('</body>','<a href="https://staffportal.example.test">Explore positions</a></body>')}:packet],
 ['the company homepage adds an unreviewed inline recruiting program',packet=>packet.url===origin+'/'?{...packet,body:packet.body.replace('</body>','<script>fetch("https://staffportal.example.test/inventory")</script></body>')}:packet],
 ['the company homepage adds an unreviewed module program',packet=>packet.url===origin+'/'?{...packet,body:packet.body.replace('</body>','<script type="module" src="/additional-recruiting-client.js"></script></body>')}:packet],
 ['the careers page adds an unreviewed alternate link',packet=>packet.url===hub?{...packet,body:packet.body.replace('</head>','<link rel="alternate" href="https://staffportal.example.test"></head>')}:packet],
 ['the careers page contains an active blank iframe',packet=>packet.url===hub?{...packet,body:packet.body.replace('</body>','<iframe></iframe></body>')}:packet],
 ['the careers page contains an active srcdoc iframe',packet=>packet.url===hub?{...packet,body:packet.body.replace('</body>','<iframe srcdoc="&lt;p&gt;Additional positions&lt;/p&gt;"></iframe></body>')}:packet],
 ['the careers page contains an active remote iframe',packet=>packet.url===hub?{...packet,body:packet.body.replace('</body>','<iframe src="https://staffportal.example.test"></iframe></body>')}:packet],
 ['an unreviewed careers module is declared',packet=>packet.url===hub?{...packet,body:packet.body.replace('</body>','<script type="module" src="/additional-recruiting-client.js"></script></body>')}:packet],
 ['the public jobs sitemap declaration is removed',packet=>packet.url===origin+'/robots.txt'?{...packet,body:packet.body.replace('Sitemap: '+sitemap,'# withdrawn jobs sitemap')}:packet],
 ['an unreviewed additional jobs sitemap is declared',packet=>packet.url===origin+'/robots.txt'?{...packet,body:packet.body+'\nSitemap: '+origin+'/api/additional-jobs-sitemap\n'}:packet],
 ['the native sitemap omits a live role',packet=>packet.url===sitemap?{...packet,body:packet.body.replace(/\s*<url><loc>https:\/\/www\.botminds\.ai\/careers\/sales-engineer<\/loc><lastmod>2026-11-06<\/lastmod><\/url>/,'')}:packet],
 ['the closing sitemap changes its live identities',packet=>packet.url===sitemap&&packet.count===2?{...packet,body:packet.body.replace('/careers/sales-engineer','/careers/unlisted-role')}:packet],
 ['the jobs sitemap carries an unreviewed continuation attribute',packet=>packet.url===sitemap?{...packet,body:packet.body.replace('<urlset ','<urlset next_page="/api/jobs-sitemap?page=2" ')}:packet],
]) test('Botminds keeps the lifecycle hold when '+label,async t=>{
 const jobs=await collect(t,change)
 assert.equal(jobs.length,2)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.ok(jobs.every(job=>job.sourceScopeComplete===false&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.match(readInventoryEvidence(jobs).reason,/scope|sitemap|declaration|controller|channel/i)
})

test('Botminds preserves the lifecycle hold on an empty caller projection of a nonempty native inventory',async t=>{
 const jobs=await collect(t,packet=>packet,{maxJobs:0})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).reportedTotal,3)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
})

test('unrecognized role workplace metadata cannot authorize complete native scope',async t=>{
 const jobs=await collect(t,packet=>packet.url===api||packet.url.includes('/api/jobs?slug=')
  ?{...packet,body:packet.body.replaceAll('"workplace":"hybrid"','"workplace":"worldwide"')}:packet)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('an empty native feed cannot authorize cleanup while the independent jobs sitemap remains nonempty',async t=>{
 const jobs=await collect(t,packet=>packet.url===api?{...packet,body:JSON.stringify({items:[]})}:packet)
 assert.equal(jobs.length,0)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),true)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
})

test('publisher withdrawal of every native row is verified empty only when the independent sitemap also clears',async t=>{
 // Simulate withdrawal of captured rows; no country, criteria, count, or
 // completeness value is added to the publisher responses.
 const jobs=await collect(t,packet=>packet.url===api?{...packet,body:JSON.stringify({items:[]})}
  :packet.url===sitemap?{...packet,body:packet.body.replace(/\s*<url>[\s\S]*?<\/url>/g,'')}:packet)
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
 assert.equal(readInventoryEvidence(jobs).reportedTotal,0)
 assert.equal(sourceLifecycleCleanupForbidden(jobs),false)
})
