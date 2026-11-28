import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readEvonikCorporate,CAREERS} from './currentNativeData20261114.js'
import {createEvonikReplay,withEvonikReplayClock,assertEvonikCurrentJobs} from './test-data/replayNativeData20261114.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/corporate-carrier-20261127.json.gz',import.meta.url))))
const [before,seed,after]=fixture.packets
const text=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
const page=(packet,change=value=>value)=>{const result=change(text(packet));return{text:result,bytes:Buffer.from(result)}}
const authority=error=>error.softFailure===true&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false&&error.sourceScopeComplete===false
const cards=value=>[...value.matchAll(/<a\b[^>]*\bclass="tile-job(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/a>/g)].map(match=>match[0])
const changeNewCard=(value,change)=>{const raw=cards(value).find(card=>card.includes('jobId=R51129'));assert.ok(raw);return value.replace(raw,change(raw))}
const response=packet=>{const result=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(result,'url',{value:packet.url});return result}
const provider=getScraperCatalog().find(row=>row.source==='evonik')

function replay(change){
 const io=createEvonikReplay(change),calls=[];let homes=0
 return{io,calls,fetchImpl:async(url,init)=>{
  calls.push(url)
  if(url===CAREERS)return response(homes++===0?before:after)
  if(url===seed.requestedUrl)return response(seed)
  return io.fetchImpl(url,init)
 }}
}
const run=io=>withEvonikReplayClock(()=>createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,now:()=> '2026-11-27T19:03:17.213Z'}))

test('genuine new R51129 featured record replaces R45266 without becoming company or India authority',()=>{
 const result=readEvonikCorporate(page(after))
 assert.deepEqual(result.observation.orderedCardIds,['R51758','R51129','R52964','R53156','R52822','R51795','R51693','R52930'])
 assert.equal(result.handshake.seedURL,seed.requestedUrl)
 assert.equal(result.observation.companyScopeComplete,false)
 assert.equal(result.observation.indiaScopeComplete,false)
 const record=result.observation.rawCardRecords.find(row=>row.id==='R51129')
 assert.equal(record.title,'Indirect Sourcing Specialist - Travel Management and Material Handling - Americas')
 assert.equal(record.locationText,'Brazil | São Paulo')
 assert.equal(record.dateText,'11/27/2026')
 assert.equal(record.postedDate,'2026-11-27')
 assert.equal(record.url,'https://www.evonik.com/en/careers/jobs/job.html?jobId=R51129')
 assert.equal(Object.hasOwn(record,'country'),false)
})

test('every original current featured card remains exact raw evidence across genuine membership changes',()=>{
 for(const packet of [before,after]){
  const result=readEvonikCorporate(page(packet)),raw=cards(text(packet))
  assert.equal(result.observation.rawCardRecords.length,8)
  result.observation.rawCardRecords.forEach((record,index)=>{
   const bytes=Buffer.from(raw[index])
   assert.equal(Buffer.from(record.bodyBase64,'base64').equals(bytes),true)
   assert.equal(record.bytes,bytes.length)
   assert.equal(record.sha256,createHash('sha256').update(bytes).digest('hex'))
  })
 }
})

test('registered replay accepts genuine featured membership drift while all CXS and role closures stay exact',async()=>{
 const io=replay(),jobs=await run(io)
 assertEvonikCurrentJobs(jobs,io.io.fixture)
 assert.equal(io.calls.length,48)
 const audit=jobs.nativeCollectionEvidence
 assert.equal(audit.nativeOpeningCorporate.observation.orderedCardIds.includes('R45266'),true)
 assert.equal(audit.nativeClosingCorporate.observation.orderedCardIds.includes('R51129'),true)
 assert.deepEqual(audit.nativeOpeningCorporate.handshake,audit.nativeClosingCorporate.handshake)
 assert.equal(audit.companyGlobalTotal,null)
 assert.equal(audit.companyIndiaTotal,null)
 assert.equal(audit.sourceScopeComplete,false)
 assert.equal(audit.lifecycleCleanupAllowed,false)
 assert.equal(fixture.featuredSwap.liveClosingPair,false)
})

test('nonseed literal featured title/location/date changes remain unqualified complete raw native observations',()=>{
 const result=readEvonikCorporate(page(after,value=>changeNewCard(value,raw=>raw.replaceAll('Indirect Sourcing Specialist - Travel Management and Material Handling - Americas','New native featured role').replace('Brazil | São Paulo','Unresolved native location').replace('11/27/2026','12/01/2026'))))
 const record=result.observation.rawCardRecords.find(row=>row.id==='R51129')
 assert.equal(record.title,'New native featured role')
 assert.equal(record.locationText,'Unresolved native location')
 assert.equal(record.postedDate,'2026-12-01')
 assert.equal(result.observation.indiaScopeComplete,false)
 assert.equal(result.observation.companyScopeComplete,false)
})

const negatives=[
 ['foreign host',value=>changeNewCard(value,raw=>raw.replace('/en/careers/jobs/job.html?jobId=R51129','https://other.example/en/careers/jobs/job.html?jobId=R51129'))],
 ['foreign same-origin path',value=>changeNewCard(value,raw=>raw.replace('/en/careers/jobs/job.html?jobId=R51129','/en/other/job.html?jobId=R51129'))],
 ['ambiguous extra query',value=>changeNewCard(value,raw=>raw.replace('jobId=R51129','jobId=R51129&amp;jobId=R99999'))],
 ['duplicate requisition',value=>changeNewCard(value,raw=>raw.replace('jobId=R51129','jobId=R51758'))],
 ['unknown active card event',value=>changeNewCard(value,raw=>raw.replace('<a class=','<a onclick="foreign()" class='))],
 ['unknown active card style',value=>changeNewCard(value,raw=>raw.replace('<a class=','<a style="display:none" class='))],
 ['hidden card',value=>changeNewCard(value,raw=>raw.replace('<a class=','<a hidden class='))],
 ['inert card',value=>changeNewCard(value,raw=>raw.replace('<a class=','<a inert class='))],
 ['changed full card DOM',value=>changeNewCard(value,raw=>raw.replace('<h3 class=','<h2 class=').replace('</h3>','</h2>'))],
 ['added child executable',value=>changeNewCard(value,raw=>raw.replace('</h3>','</h3><script>foreign()</script>'))],
 ['mismatched title carriers',value=>changeNewCard(value,raw=>raw.replace('title="Indirect Sourcing','title="Other Sourcing'))],
 ['invalid calendar',value=>changeNewCard(value,raw=>raw.replace('11/27/2026','02/30/2026'))],
 ['hidden card owner',value=>value.replace('<section class="slider-jobs">','<section hidden class="slider-jobs">')],
 ['new active stylesheet',value=>value.replace('</head>','<link rel="stylesheet" href="/unknown.css"></head>')],
 ['changed full active script',value=>value.replace('clientlib-site.lc-2c0c1fea9b3e62a2ac7d9c6597418acd-lc.min.js','clientlib-site.lc-unreviewed-lc.min.js')],
 ['new inline executable',value=>value.replace('</head>','<script>foreign()</script></head>')],
 ['foreign base authority',value=>value.replace('</head>','<base href="https://other.example/"></head>')],
 ['absent currently declared seed',value=>value.replace('jobId=R51758','jobId=R99999')],
 ['contradictory exact seed country',value=>value.replace('Singapore | Singapore - Nucleos_ARC','India | Singapore - Nucleos_ARC')],
 ['missing complete card',value=>value.replace(cards(value)[1],'')],
 ['ninth complete card',value=>value.replace(cards(value)[1],cards(value)[1]+cards(value)[1])],
]
for(const[label,change]of negatives)test('mutable featured records reject '+label,()=>{
 const changed=page(after,change)
 assert.notEqual(changed.text,text(after),'Mutation changes the genuine entity')
 assert.throws(()=>readEvonikCorporate(changed),authority)
})

for(const [label,change]of [
 ['native global count',(value,item,count)=>{if(count===2&&item.requestBody&&!JSON.parse(item.requestBody).appliedFacets.Country)value.total++}],
 ['native full role criteria',(value,item,count)=>{if(count===2&&value.jobPostingInfo)value.jobPostingInfo.jobDescription+='Additional mandatory requirement.'}],
])test('featured membership tolerance keeps exact closing guard for '+label,async()=>{
 let changed=false
 const io=replay((bytes,item,count)=>{
  if(!item.headers['content-type']?.includes('application/json'))return
  const value=JSON.parse(bytes),original=JSON.stringify(value);change(value,item,count)
  if(JSON.stringify(value)!==original){changed=true;return JSON.stringify(value)}
 })
 await assert.rejects(()=>run(io),authority)
 assert.equal(changed,true)
})
