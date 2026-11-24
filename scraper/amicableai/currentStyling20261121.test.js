import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import test from 'node:test'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/corporate-styling-20261121.json.gz',import.meta.url)))).packets
const prior=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261113.json.gz',import.meta.url))))
for(const p of current){assert.equal(p.bodyOriginalUnmodified,true);assert.equal(createHash('sha256').update(p.html).digest('hex'),p.sha256)}
const HOME='https://amicable.io/',CAREERS=HOME+'careers',BOARD='https://app.screenloop.com/careers/amicable',SWIPER='https://cdn.jsdelivr.net/npm/swiper@8/swiper-bundle.min.css'
const replay=(change=()=>{},{stopAtBoard=false}={})=>{
 const calls=[],visits=new Map(),stop=Object.freeze({unacquired:'current native inventory'})
 const run=()=>createCatalogScraper(getScraperCatalog().find(p=>p.source==='amicableai')).run({fetchPage:async url=>{
  calls.push(url);const visit=(visits.get(url)??0)+1;visits.set(url,visit)
  if(stopAtBoard&&url===BOARD)throw stop
  const original=current.find(p=>p.requestedUrl===url)??prior.find(p=>p.requestedUrl===url);assert.ok(original,'Only original retained corporate/dependency or frozen native-cohort packets')
  const packet=structuredClone(original);change(packet,url,visit);return packet
 }})
 return{run,calls,visits,stop}
}
test('actual current corporate styling reaches the declared native board without claiming an unacquired inventory',async()=>{
 const r=replay(()=>{},{stopAtBoard:true});await assert.rejects(r.run(),error=>error===r.stop)
 assert.deepEqual(r.calls,[HOME,CAREERS,current.find(p=>p.requestedUrl.includes('5070af064')).requestedUrl,SWIPER,BOARD])
})
test('current styling with a frozen native cohort retains every full criterion and original unavailable date',async()=>{
 // Corporate/CSS originals are current; native role packets remain explicitly
 // the frozen November13 cohort. This composition is a regression, not live proof.
 const r=replay(),jobs=await r.run(),audit=jobs.nativeCollectionEvidence
 assert.equal(jobs.length,0);assert.equal(readInventoryEvidence(jobs).reportedTotal,8)
 assert.equal(readInventoryEvidence(jobs).listingComplete,true);assert.equal(readInventoryEvidence(jobs).lifecycleCleanupAllowed,false)
 assert.equal(audit.sourceCompanyWideScopeComplete,false);assert.equal(audit.observedDetails.length,8)
 for(const job of audit.observedDetails){const original=prior.find(p=>p.requestedUrl===job.sourceUrl),doc=readNativeDocument(original.html),props=JSON.parse(doc.nodes(n=>n.attrs['data-react-class']==='applicant_tracking/Jobs/JobPostPage')[0].attrs['data-react-props']);assert.equal(job.jobDescription,props.jobPostHtmlString);assert.equal(job.postingDate,null);assert.equal(job.country,'United Kingdom')}
 assert.equal(r.visits.get(SWIPER),2)
})
for(const [name,match]of [['main frame stylesheet','5070af064'],['preloaded Swiper stylesheet','swiper@8']])test('changed '+name+' bytes cannot conceal the native frame',async()=>{
 const r=replay((p,url)=>{if(url.includes(match))p.html+='\n.iframe-wrapper{display:none!important}'})
 await assert.rejects(r.run(),/CSS|visibility|styling/i)
 assert.ok(r.calls.some(url=>url.includes(match)),'The complete declared dependency was actually acquired')
})
test('an extra preload-as-style declaration is held before its URL can be fetched',async()=>{
 const r=replay((p,url)=>{if(url===CAREERS)p.html=p.html.replace('</head>','<link rel="preload" as="style" href="https://amicable.io/unreviewed.css" onload="this.rel=\'stylesheet\'"></head>')})
 await assert.rejects(r.run(),/CSS|visibility|styling/i);assert.equal(r.calls.includes('https://amicable.io/unreviewed.css'),false)
})
test('closing cannot combine a different independently reviewed corporate styling deployment',async()=>{
 const r=replay((p,url,visit)=>{if(url===CAREERS&&visit===2)p.html=prior.find(p=>p.requestedUrl===CAREERS).html})
 await assert.rejects(r.run(),/closing|deployment/i);assert.equal(r.visits.get(CAREERS),2)
})
test('default registration preserves the source stylesheet rejection without generic alternate reads',async t=>{
 const calls=[]
 t.mock.method(globalThis,'fetch',async input=>{
  const url=String(input);calls.push(url);const p=current.find(p=>p.requestedUrl===url)??prior.find(p=>p.requestedUrl===url)
  const body=p?.html??'Uncaptured alternate URL is a mocked404; no public HTTP',status=p?.status??404
  return Object.defineProperty(new Response(url.includes('5070af064')?body+'\n.iframe-wrapper{display:none}':body,{status,headers:p?.headers}),'url',{value:p?.url??url})
 })
 await assert.rejects(createCatalogScraper(getScraperCatalog().find(p=>p.source==='amicableai')).run({signal:AbortSignal.timeout(15000)}),/CSS visibility contract changed/)
 assert.equal(calls.length,3,'Authoritative corporate CSS rejection must be final in the default registered path')
})
