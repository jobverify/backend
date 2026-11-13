import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
import {publisher,profileForPublisher,program,loadingContract,profileModuleURL,API,PRIMARY} from './nativeModels.js'

const graph=JSON.parse(gunzipSync(readFileSync(new URL('./test-data-20261110/current-graph.json.gz',import.meta.url))))
const historical=JSON.parse(gunzipSync(readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/groupon-current-native.json.gz',import.meta.url)))).currentPackets
const sha=value=>createHash('sha256').update(value).digest('hex')
const current=new Map(graph.responses.map(packet=>[packet.url,packet]))
const nativeListing=historical.find(packet=>packet.requestedURL===API)
const nativeRows=JSON.parse(nativeListing.bodyText).jobs,firstID=nativeRows[0].id,firstDetail=API+'/'+firstID
const registered=()=>createCatalogScraper(getScraperCatalog().find(provider=>provider.source==='groupon'))

function replay(change=(body)=>body){
 const calls=[],counts=new Map()
 return{calls,options:{fetchResponse:async(url,init)=>{
  assert.equal(init.method,'GET');assert.equal(init.body,null)
  const packet=current.get(url),old=historical.find(row=>row.requestedURL===url)
  assert.ok(packet||old,'No uncaptured native route: '+url)
  const visit=(counts.get(url)||0)+1;counts.set(url,visit);calls.push(url)
  const body=change(packet?.body??old.bodyText,url,visit),headers=packet?.headers??old.headers
  // Module/corporate bytes are current originals. API role bodies and their
  // historical clocks are explicit protocol controls, never current vacancies.
  return{bytes:Buffer.from(body),html:body,requestedURL:url,finalURL:url,method:'GET',body:null,
   status:packet?.status??old.status,headers,contentType:headers['content-type']??old?.contentType,
   startedAt:packet?.startedAt??old.startedAt,completedAt:packet?.completedAt??old.completedAt,bodySHA256:sha(body)}
 }}}
}
test.beforeEach(t=>t.mock.method(globalThis,'fetch',async()=>{throw Error('No live network in Groupon deployment tests')}))

test('the genuine paired current Groupon graph retains the reviewed production, full-criteria and office-country contracts',()=>{
 assert.equal(graph.kind,'original-public-deployment-graph')
 assert.equal(graph.nativeAPIVacanciesCaptured,false)
 for(const packet of graph.responses)assert.equal(sha(packet.body),packet.sha256)
 const selected=profileForPublisher(publisher(current.get(PRIMARY).body)),programs={}
 assert.deepEqual(selected,graph.profile)
 for(const key of Object.keys(selected)){
  const url=profileModuleURL(key,selected),originals=graph.responses.filter(packet=>packet.url===url)
  assert.equal(originals.length,2)
  assert.equal(originals[0].body,originals[1].body)
  programs[key]=program(originals[0].body,key,selected)
 }
 const contract=loadingContract(programs)
 assert.equal(contract.inventoryURL,API);assert.equal(contract.method,'GET')
 assert.equal(contract.detailPath,'/careers/jobs/{literal-published-id}')
 assert.equal(contract.publishedApplicationTemplate,PRIMARY+'apply/?job={literal-published-id}')
 assert.equal(contract.officeCountryModels.length,11)
 assert.equal(contract.publisherProgramsExecuted,false)
})

test('the current genuine graph reconciles every full historical-protocol role and closing screening model without a current-vacancy claim',async()=>{
 const{options,calls}=replay(),jobs=await registered().run(options)
 assert.equal(jobs.length,nativeRows.length);assert.equal(jobs.length,27)
 assert.equal(calls.filter(url=>url===API).length,2)
 assert.equal(calls.filter(url=>url===graph.mainDeclaration).length,2)
 for(const job of jobs){
  const original=JSON.parse(historical.find(packet=>packet.requestedURL===API+'/'+job.jobId).bodyText).job
  assert.equal(job.sourceDescription,original.contentHtml)
  assert.deepEqual(job.nativeScreeningQuestions,original.questions)
  assert.deepEqual(job.nativeSourceRecord.detail,original)
  assert.deepEqual(job.nativeClosingRecord,job.nativeSourceRecord)
  assert.equal(job.nativeRoleClosingReconciled,true)
  assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
 }
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(jobs[0].country,null)
})

for(const[key,change]of[
 ['an unknown main',body=>body.replace('index-Doyq3TRB.js','index-unreviewed.js')],
 ['a foreign main authority',body=>body.replace('/assets/index-Doyq3TRB.js','https://foreign.invalid/assets/index-Doyq3TRB.js')],
 ['a foreign corporate employer',body=>body.replace('<title>Groupon Careers</title>','<title>Foreign Careers</title>')],
])test('current Groupon rejects '+key+' before native API reads',async()=>{
 const{options,calls}=replay((body,url)=>url===PRIMARY?change(body):body)
 await assert.rejects(registered().run(options),/declared main|first-party careers identity/)
 assert.equal(calls.some(url=>url.startsWith(API)),false)
})

for(const[key,profile]of Object.entries(graph.profile))test('current Groupon rejects altered '+key+' program bytes before native API reads',async()=>{
 const{options,calls}=replay((body,url)=>url.endsWith('/'+profile.path)?body+'\nfetch("https://foreign.invalid/jobs");':body)
 await assert.rejects(registered().run(options),/program changed/)
 assert.equal(calls.some(url=>url.startsWith(API)),false)
})

test('a current module URL cannot borrow another reviewed graph body',async()=>{
 const old=historical.find(packet=>packet.requestedURL.endsWith('/src-D1ipTgb0.js'))
 assert.ok(old)
 const{options,calls}=replay((body,url)=>url.endsWith('/'+graph.profile.origins.path)?old.bodyText:body)
 await assert.rejects(registered().run(options),/program changed/)
 assert.equal(calls.some(url=>url.startsWith(API)),false)
})

test('the current graph still rejects a changed complete closing native inventory',async()=>{
 const{options}=replay((body,url,visit)=>{if(url!==API||visit!==2)return body;const data=JSON.parse(body);data.jobs.pop();return JSON.stringify(data)})
 await assert.rejects(registered().run(options),/closing native/)
})
for(const[key,mutate]of[
 ['criteria',job=>{job.contentHtml+='<p>A new mandatory professional licence is required.</p>'}],
 ['screening requirements',job=>{job.questions[0].required=!job.questions[0].required}],
])test('the current graph still rejects changed closing '+key,async()=>{
 const{options}=replay((body,url,visit)=>{if(url!==firstDetail||visit!==2)return body;const data=JSON.parse(body);mutate(data.job);return JSON.stringify(data)})
 await assert.rejects(registered().run(options),/closing whole role/)
})

test('a complete native foreign-country role cannot become India through a conflicting authored country declaration',async()=>{
 const{options}=replay((body,url)=>{if(url!==firstDetail)return body;const data=JSON.parse(body);data.job.contentHtml+='<p>Work Country: India</p>';return JSON.stringify(data)})
 const jobs=await registered().run(options),job=jobs.find(row=>row.jobId===firstID)
 assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true)
 assert.equal(job.nativeRoleCriteriaReconciled,false);assert.equal(job.sourceDetailComplete,false)
 assert.match(job.sourceDescription,/Work Country: India/)
 assert.equal(job.lifecycleCleanupAllowed,false)
})
