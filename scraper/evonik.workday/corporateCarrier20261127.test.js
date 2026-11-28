import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {readEvonikCorporate,CAREERS} from './currentNativeData20261114.js'
import {createEvonikReplay,withEvonikReplayClock,assertEvonikCurrentJobs} from './test-data/replayNativeData20261114.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/corporate-carrier-20261127.json.gz',import.meta.url))))
const [carrier,seed]=fixture.packets,NOW='2026-11-27T18:52:02.953Z'
const currentIds=['R51758','R52964','R53156','R52822','R51795','R51693','R52930','R45266']
const original=packet=>Buffer.from(packet.bodyBase64,'base64').toString()
const page=(packet,change=text=>text)=>{const text=change(original(packet));return{text,bytes:Buffer.from(text)}}
const authority=error=>error.softFailure===true&&error.abortRetries===true&&error.lifecycleCleanupAllowed===false&&error.sourceScopeComplete===false
const response=packet=>{const result=new Response(Buffer.from(packet.bodyBase64,'base64'),{status:packet.status,headers:packet.headers});Object.defineProperty(result,'url',{value:packet.url});return result}
const schemaChange=(text,change)=>text.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/,(all,start,raw,end)=>{const value=JSON.parse(raw);change(value);return start+JSON.stringify(value)+end})
const provider=getScraperCatalog().find(row=>row.source==='evonik')

function currentReplay(change,corporateClosing){
 const io=createEvonikReplay(change),calls=[]
 return{io,calls,fetchImpl:async(url,init)=>{
  calls.push(url)
  if(url===CAREERS){if(corporateClosing&&calls.filter(value=>value===CAREERS).length===2)return corporateClosing();return response(carrier)}
  if(url===seed.requestedUrl)return response(seed)
  return io.fetchImpl(url,init)
 }}
}
const registered=io=>withEvonikReplayClock(()=>createCatalogScraper(provider).run({fetchImpl:io.fetchImpl,now:()=>NOW}))

test('current genuine corporate cards preserve all eight current identities and select their own R51758 seed',()=>{
 const result=readEvonikCorporate(page(carrier))
 assert.deepEqual(result.observation.orderedCardIds,currentIds)
 assert.equal(result.handshake.seedURL,'https://www.evonik.com/en/careers/jobs/job.html?jobId=R51758')
 assert.deepEqual(result.observation.roleDeclarations.map(row=>new URL(row.url).searchParams.get('jobId')),currentIds)
 assert.match(result.observation.roleDeclarations[0].text,/Singapore \| Singapore - Nucleos_ARC/)
 assert.match(result.observation.roleDeclarations[0].text,/11\/27\/2026/)
 assert.equal(result.observation.bytes,306177)
 assert.equal(result.observation.sha256,'94ed6ec247d23126c25401183ee16bc6c4b8c7569439d1c66c77fb098af1b5e7')
})

test('current genuine seed binds its exact requisition, employer and unchanged native account',()=>{
 const value=readEvonikCorporate(page(seed),true,seed.requestedUrl)
 assert.equal(value.identifier.value,'R51758')
 assert.equal(value.hiringOrganization.name,'Evonik')
 assert.equal(value.hiringOrganization.sameAs,'https://www.evonik.com')
 assert.equal(value.sameAs,'https://evonik.wd3.myworkdayjobs.com/External_Careers/job/Singapore---Nucleos_ARC/Data-Engineer--Advanced-Process-Innovation-_R51758/apply')
})

test('registered current carrier follows the current seed while preserving ten criteria pairs and all scope holds',async()=>{
 const io=currentReplay(),jobs=await registered(io)
 assertEvonikCurrentJobs(jobs,io.io.fixture)
 assert.equal(io.calls.length,48)
 assert.equal(io.calls.filter(url=>url===seed.requestedUrl).length,2)
 assert.equal(io.calls.some(url=>url.includes('jobId=R47504')),false)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeOpeningCorporate.observation.orderedCardIds,currentIds)
 assert.deepEqual(jobs.nativeCollectionEvidence.nativeClosingCorporate.observation.orderedCardIds,currentIds)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.companyGlobalTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.companyIndiaTotal,null)
 assert.equal(jobs.nativeCollectionEvidence.companyScopeComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.wholeObservedIndiaFacetClosingReconciled,true)
 assert.equal(jobs.nativeCollectionEvidence.sourceApplicationQualificationComplete,false)
 assert.equal(jobs.nativeCollectionEvidence.lifecycleCleanupAllowed,false)
 assert.equal(fixture.closingReuseIsReplayOnly,true)
})

test('a reviewed current card permutation preserves complete finite role identities',()=>{
 const current=original(carrier),matches=[...current.matchAll(/<a\b[^>]*\bclass="tile-job(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/a>/g)]
 let index=0
 const text=current.replace(/<a\b[^>]*\bclass="tile-job(?:\s[^"]*)?"[^>]*>[\s\S]*?<\/a>/g,()=>matches[7-index++][0])
 const result=readEvonikCorporate({text,bytes:Buffer.from(text)})
 assert.deepEqual(result.observation.orderedCardIds,[...currentIds].reverse())
 assert.equal(result.handshake.seedURL,seed.requestedUrl)
})

const corporateNegatives=[
 ['foreign role authority',text=>text.replace('/en/careers/jobs/job.html?jobId=R51758','https://other.example/job?jobId=R51758')],
 ['changed role identity',text=>text.replace('jobId=R51758','jobId=R99999')],
 ['changed complete role criteria title',text=>text.replace('Data Engineer (Advanced Process Innovation)','Different criteria')],
 ['foreign country rewrite',text=>text.replace('Singapore | Singapore - Nucleos_ARC','India | Singapore - Nucleos_ARC')],
 ['removed current seed card',text=>text.replace(/<a\b[^>]*class="tile-job[\s\S]*?<\/a>/,'')],
 ['unknown site program',text=>text.replace('clientlib-site.lc-2c0c1fea9b3e62a2ac7d9c6597418acd-lc.min.js','clientlib-site.lc-unreviewed-lc.min.js')],
 ['unknown search program',text=>text.replace('clientlib-search.lc-50a846a434cf35f0e8d79fe447e6ff09-lc.min.js','clientlib-search.lc-unreviewed-lc.min.js')],
 ['changed inline program',text=>text.replace('messageSource: "https://go.evonik.com"','messageSource: "https://other.example"')],
 ['additional executable',text=>text.replace('</head>','<script>window.foreignJobs=true</script></head>')],
 ['new criteria stylesheet',text=>text.replace('</head>','<style>.tile-job{display:none}</style></head>')],
 ['hidden current card owner',text=>text.replace('<section class="slider-jobs">','<section hidden class="slider-jobs">')],
 ['foreign document base',text=>text.replace('</head>','<base href="https://other.example/"></head>')],
 ['missing careers search handoff',text=>text.replaceAll('href="/en/careers/jobs.html"','href="/en/other.html"')],
]
for(const[label,change]of corporateNegatives)test('current complete corporate carrier rejects '+label,()=>{
 const changed=page(carrier,change)
 assert.notEqual(changed.text,original(carrier),'Mutation changes the genuine entity')
 assert.throws(()=>readEvonikCorporate(changed),authority)
})

const seedNegatives=[
 ['foreign employer',text=>schemaChange(text,value=>value.hiringOrganization.name='Other Employer')],
 ['foreign native account',text=>schemaChange(text,value=>value.sameAs=value.sameAs.replace('evonik.wd3','other.wd3'))],
 ['changed requisition',text=>schemaChange(text,value=>value.identifier.value='R99999')],
 ['added mandatory criteria',text=>schemaChange(text,value=>value.description+='Mandatory new qualification.')],
 ['unknown criteria field',text=>schemaChange(text,value=>value.qualifications='Mandatory new qualification.')],
 ['foreign canonical',text=>text.replace('rel="canonical" href="https://www.evonik.com/','rel="canonical" href="https://other.example/')],
 ['changed active program',text=>text.replace('clientlib-site.lc-2c0c1fea9b3e62a2ac7d9c6597418acd-lc.min.js','clientlib-site.lc-unreviewed-lc.min.js')],
 ['hidden identity owner',text=>text.replace('<script type="application/ld+json">','<script hidden type="application/ld+json">')],
]
for(const[label,change]of seedNegatives)test('current complete seed carrier rejects '+label,()=>{
 const changed=page(seed,change)
 assert.notEqual(changed.text,original(seed),'Mutation changes the genuine entity')
 assert.throws(()=>readEvonikCorporate(changed,true,seed.requestedUrl),authority)
})

const nativeNegatives=[
 ['selected count contradicts native inventory',(value,item)=>{if(item.requestBody&&!JSON.parse(item.requestBody).appliedFacets.Country)value.facets[1].values.find(row=>row.descriptor==='India').count=12}],
 ['partial India page',(value,item)=>{if(item.requestBody&&JSON.parse(item.requestBody).appliedFacets.Country)value.jobPostings.pop()}],
 ['unreviewed pagination field',(value,item)=>{if(item.requestBody&&JSON.parse(item.requestBody).appliedFacets.Country)value.nextPage='/unreviewed'}],
 ['foreign native employer',value=>{if(value.hiringOrganization)value.hiringOrganization.name='Other Employer'}],
 ['foreign explicit country',value=>{if(value.jobPostingInfo)value.jobPostingInfo.country.descriptor='Singapore'}],
 ['changed full native criteria',value=>{if(value.jobPostingInfo)value.jobPostingInfo.jobDescription+='Mandatory new qualification.'}],
]
for(const[label,change]of nativeNegatives)test('current registered carrier retains guards against '+label,async()=>{
 let changed=false
 const io=currentReplay((bytes,item)=>{
  if(!item.headers['content-type']?.includes('application/json'))return
  const value=JSON.parse(bytes),before=JSON.stringify(value);change(value,item)
  if(JSON.stringify(value)!==before){changed=true;return JSON.stringify(value)}
 })
 await assert.rejects(()=>registered(io),error=>authority(error)&&error.recruitmentObservations.sourceScopeComplete===false)
 assert.equal(changed,true)
})

test('switching current corporate to the historical revision during closing cannot release jobs',async()=>{
 const old=createEvonikReplay(),io=currentReplay(undefined,()=>old.fetchImpl(CAREERS))
 await assert.rejects(()=>registered(io),error=>authority(error)&&/handoff closing changed/.test(error.message))
 assert.equal(io.calls.length,48)
})

test('current entity fixture retains original receipts and never claims an observed closing pair',()=>{
 assert.equal(fixture.captureKind,'three-separate-genuine-opening-entities-not-a-live-closing-pair')
 assert.equal(fixture.companyScopeComplete,false)
 assert.equal(fixture.lifecycleCleanupAllowed,false)
 for(const packet of fixture.packets){
  const bytes=Buffer.from(packet.bodyBase64,'base64')
  assert.equal(packet.status,200)
  assert.equal(packet.url,packet.requestedUrl)
  assert.equal(bytes.length,packet.bytes)
  assert.equal(createHash('sha256').update(bytes).digest('hex'),packet.sha256)
 }
})
