import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import test from 'node:test'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const current=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/ats-followup-20261107/groupon-current-graph.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/groupon-current-native.json.gz',import.meta.url)))).currentPackets
const mainURL='https://careers.groupon.com/assets/index-kQ8lO2tS.js',api='https://api-core.livingsocial.com/careers/jobs'
const hash=body=>createHash('sha256').update(body).digest('hex')
function replay({mutate=(body)=>body,unknownMain=false,closingChange=false,countryConflict=false}={}){
 const calls=[],counts=new Map(),map=new Map(current.modules.map(row=>[row.url,row]));map.set('https://careers.groupon.com/',current.corporate)
 return{calls,options:{fetchResponse:async url=>{
  calls.push(url);counts.set(url,(counts.get(url)||0)+1)
  const packet=map.get(url),old=historical.find(row=>row.requestedURL===url)
  assert.ok(packet||old,'Unexpected unreviewed native GET '+url)
  let body=packet?.body??old.bodyText
  if(unknownMain&&url==='https://careers.groupon.com/')body=body.replace('index-kQ8lO2tS.js','index-unreviewed.js')
  if(closingChange&&url===api&&counts.get(url)>1){const payload=JSON.parse(body);payload.jobs.pop();body=JSON.stringify(payload)}
  if(countryConflict&&url===api+'/'+JSON.parse(historical.find(row=>row.requestedURL===api).bodyText).jobs[0].id){const payload=JSON.parse(body);payload.job.contentHtml+='<p>Work Country: India</p>';body=JSON.stringify(payload)}
  body=mutate(body,url)
  const bytes=Buffer.from(body),headers=packet?.headers??old.headers
  return{bytes,html:body,requestedURL:url,finalURL:url,method:'GET',body:null,status:packet?.status??old.status,headers,contentType:headers?.['content-type']??old?.contentType??null,bodySHA256:hash(body)}
 }}}
}
const registered=()=>createCatalogScraper(getScraperCatalog().find(row=>row.source==='groupon'))

test('registered Groupon accepts the exact current declared graph and preserves a full historical-shape native cohort control',async()=>{
 // Current client modules are genuine current public bytes. Historical native
 // records are explicit protocol controls, never claimed as live vacancies.
 const{options,calls}=replay(),jobs=await registered().run(options)
 assert.equal(jobs.length,27)
 assert.equal(calls.filter(url=>url===api).length,2)
 assert.equal(calls.filter(url=>url===mainURL).length,2)
 assert.ok(jobs.every(job=>job.nativeRoleClosingReconciled===true&&job.sourceDescription===job.nativeSourceRecord.detail.contentHtml&&job.lifecycleCleanupAllowed===false))
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].country,null)
})

test('an unreviewed Groupon main filename cannot fall back to a marker-based native API binding',async()=>{
 const{options,calls}=replay({unknownMain:true})
 await assert.rejects(registered().run(options),/declared main|program/)
 assert.equal(calls.some(url=>url.startsWith(api)),false)
})
for(const filename of ['index-kQ8lO2tS.js','page-Dp0bProt.js','useJob-vB8fc8As.js','src-w5C0Sia3.js','locations-C3ZnT-yL.js']){
 test('current Groupon rejects changed '+filename+' bytes before native API reads',async()=>{
  const{options,calls}=replay({mutate:(body,url)=>url.endsWith('/'+filename)?body+'\nfetch("https://foreign.example/new-jobs");':body})
  await assert.rejects(registered().run(options),/program changed/)
  assert.equal(calls.some(url=>url.startsWith(api)),false)
 })
}

test('current Groupon graph still requires a matching closing inventory',async()=>{
 const{options}=replay({closingChange:true})
 await assert.rejects(registered().run(options),/closing native/)
})

test('current Groupon never turns a conflicting full native work-country declaration into India',async()=>{
 const{options}=replay({countryConflict:true}),jobs=await registered().run(options)
 assert.equal(jobs[0].country,null)
 assert.equal(jobs[0].sourceCountryScopeUnresolved,true)
 assert.equal(jobs[0].nativeRoleCriteriaReconciled,false)
 assert.equal(jobs[0].lifecycleCleanupAllowed,false)
 assert.match(jobs[0].sourceDescription,/Work Country: India/)
})
