import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import assert from 'node:assert/strict'
import { before, after, test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
const repo=fileURLToPath(new URL('../../',import.meta.url)),load=file=>import(pathToFileURL(path.join(repo,file)).href)
const root=os.tmpdir()
const output=await fs.mkdtemp(path.join(root,'jobverify-publication-provenance-'))
await fs.mkdir(output,{recursive:true})
process.env.MONGOMS_RUNTIME_DOWNLOAD='false'
process.env.MONGO_URI='mongodb://127.0.0.1:1/unused_guard';process.env.POST_SCRAPE_CLASSIFICATION_MODE='shadow'
const {default:mongoose}=await load('node_modules/mongoose/index.js')
const {MongoMemoryServer}=await load('node_modules/mongodb-memory-server/index.js')
const {default:Job}=await load('src/models/Job.js')
const {normalizeScrapedJob}=await load('scraper-support/utils/normalizeScrapedJob.js')
const {saveToDB,saveDryRunSnapshot}=await load('scraper-support/utils/saveToDB.js')
const {buildPublicJobLifecycleDateScope}=await load('src/utils/publicJobLocationScope.js')
const {applyPublicJobVisibility}=await load('src/utils/publicJobVisibility.js')
const source='generic-provenance-review',first='2026-10-24T08:00:00.000Z',second='2026-10-25T09:00:00.000Z',third='2026-10-26T10:00:00.000Z'
const report={output,productionWrites:false,externalNetworkForbidden:true,implementationEdited:false,cases:[]}
const originalFetch=globalThis.fetch
let mongo
before(async()=>{
 assert.equal(mongoose.connection.readyState,0);report.initialMongooseReadyState=0
 globalThis.fetch=async()=>{throw Error('External network forbidden in generic publication provenance red probe')}
 mongo=await MongoMemoryServer.create({instance:{ip:'127.0.0.1'},binary:{version:'8.2.6'}})
 const uri=mongo.getUri('codex_generic_publication_red');assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:\d+\/codex_generic_publication_red/)
 process.env.MONGO_URI=uri;await mongoose.connect(uri,{autoIndex:false,autoCreate:false});assert.equal(mongoose.connection.host,'127.0.0.1')
 await Job.collection.createIndex({fingerprint:1},{unique:true});report.localMongoOnly=true
})
after(async()=>{
 await mongoose.disconnect();await mongo?.stop();globalThis.fetch=originalFetch
 report.finalMongooseReadyState=mongoose.connection.readyState
 report.passed=report.cases.filter(item=>item.passed).length;report.failed=report.cases.filter(item=>!item.passed).length
 await fs.writeFile(path.join(output,'verification.json'),JSON.stringify(report,null,2))
 console.log('PUBLICATION_PROVENANCE_PROOF '+JSON.stringify({output,passed:report.passed,failed:report.failed,initialMongooseReadyState:report.initialMongooseReadyState,finalMongooseReadyState:report.finalMongooseReadyState}))
})
const raw=(id,clock=first,overrides={})=>({source,jobId:id,requisitionId:id,title:'Software Engineer',company:'Generic provenance fixture',location:'Bengaluru, India',country:'India',sourceDescription:'Original employer text with two years of software engineering experience.',sourceUrl:`https://example.invalid/roles/${id}`,applyUrl:`https://example.invalid/roles/${id}`,postingDate:null,scrapedAt:clock,sourceListingComplete:false,sourceDetailComplete:true,...overrides})
const save=(jobs,clock)=>saveToDB(jobs,source,{now:new Date(clock),enrichPublicExperience:false,descriptionRewriteMode:'off',enqueueAlerts:false,refreshDatasetSummary:false})
const row=id=>Job.findOne({source,requisitionId:id}).lean()
const at=date=>new Date(date).toISOString()
const publicCount=clock=>Job.countDocuments({...applyPublicJobVisibility({source,status:'active'},{experiencedJobsEnabled:true}),...buildPublicJobLifecycleDateScope(new Date(clock))})
const snapshot=async(job,name)=>{
 const file=path.join(output,name+'.json')
 await saveDryRunSnapshot([normalizeScrapedJob(job,{source})],file,{source,enrichPublicExperience:false})
 const [roundTrip]=JSON.parse(await fs.readFile(file,'utf8'))
 return normalizeScrapedJob(roundTrip,{source})
}
const check=(name,fn)=>test(name,async t=>{
 const record={name};report.cases.push(record)
 try{await fn(record,t);record.passed=true}catch(error){record.passed=false;record.error={name:error.name,message:error.message,actual:error.actual,expected:error.expected};throw error}
})
check('a new undated identity receives its own first observation date',async record=>{
 const job=raw('R-first-observation'),copy=structuredClone(job)
 const result=await save([job],first),stored=await row(job.jobId)
 assert.equal(result.inserted,1);assert.equal(stored.postedAtProvenance,'observation');assert.equal(stored.postedAtProvenanceValue,first);assert.equal(at(stored.postedAt),first);assert.equal(at(stored.sortDate),first)
 assert.equal(at(stored.lastSeenAt),first);assert.deepEqual(job,copy)
 record.storedPostedAt=stored.postedAt
})
check('a later undated observation survives repeated normalization and a dry-run JSON round trip without refreshing publication dates',async record=>{
 const job=raw('R-undated-rerun');await save([job],first)
 const later=await snapshot(raw(job.jobId,second),'later-undated'),input=structuredClone(later)
 const result=await save([later],second),stored=await row(job.jobId)
 record.actual={postedAt:stored.postedAt,sortDate:stored.sortDate,scrapedAt:stored.scrapedAt,lastSeenAt:stored.lastSeenAt,result}
 assert.equal(result.inserted,0);assert.equal(result.updated,1);assert.equal(at(stored.scrapedAt),second);assert.equal(at(stored.lastSeenAt),second)
 assert.equal(at(stored.postedAt),first,'A repeated observation is not a new source publication');assert.equal(at(stored.sortDate),first);assert.deepEqual(later,input)
})
check('a missing date cannot erase a known source publication after a JSON round trip',async record=>{
 const published='2026-10-19T02:00:00.000Z',job=raw('R-known-then-missing',first,{postingDate:published})
 await save([job],first);const later=await snapshot(raw(job.jobId,second),'known-then-missing');await save([later],second)
 const stored=await row(job.jobId);record.actual={postedAt:stored.postedAt,sortDate:stored.sortDate,lastSeenAt:stored.lastSeenAt}
 assert.equal(at(stored.lastSeenAt),second);assert.equal(at(stored.postedAt),published);assert.equal(at(stored.sortDate),published)
})
for(const alias of ['postingDate','postedAt'])check(`a genuine ${alias} supplied after normalized-object spread supersedes observation fallback`,async record=>{
 const job=raw('R-later-native-'+alias),published='2026-10-20T03:00:00.000Z';await save([job],first)
 const normalized=await snapshot(raw(job.jobId,second),'later-native-'+alias)
 const enriched={...normalized,[alias]:published};await save([enriched],second)
 const stored=await row(job.jobId);record.actual={alias,postedAt:stored.postedAt,sortDate:stored.sortDate,incomingPostingDate:enriched.postingDate,incomingPostedAt:enriched.postedAt}
 assert.equal(at(stored.postedAt),published,'A synthesized date alias must not hide later source evidence');assert.equal(at(stored.sortDate),published);assert.equal(stored.postedAtProvenance,'source');assert.equal(stored.postedAtProvenanceValue,published)
})
check('two generic application-form roles preserve separate first observations',async record=>{
 const applyUrl='https://example.invalid/shared-application',a=raw('R-shared-a',first,{applyUrl,applicationUrlIsGeneric:true}),b=raw('R-shared-b',second,{applyUrl,applicationUrlIsGeneric:true})
 await save([a],first);await save([b],second)
 const later=await snapshot(raw(a.jobId,third,{applyUrl,applicationUrlIsGeneric:true}),'shared-a-rerun');await save([later],third)
 const [afterA,afterB]=await Promise.all([row(a.jobId),row(b.jobId)])
 record.actual={aPostedAt:afterA.postedAt,bPostedAt:afterB.postedAt,aLastSeenAt:afterA.lastSeenAt,bLastSeenAt:afterB.lastSeenAt}
 assert.notEqual(afterA.fingerprint,afterB.fingerprint);assert.equal(at(afterB.postedAt),second);assert.equal(at(afterB.lastSeenAt),second)
 assert.equal(at(afterA.lastSeenAt),third);assert.equal(at(afterA.postedAt),first)
})
check('a historical refreshed row keeps its existing date without blanket backdating to createdAt',async record=>{
 const job=raw('R-legacy-refreshed');await save([job],first)
 await Job.collection.updateOne({source,requisitionId:job.jobId},{$set:{postedAt:new Date(second),sortDate:new Date(second),createdAt:new Date('2026-09-01T00:00:00Z')},$unset:{postedAtProvenance:'',postedAtProvenanceValue:''}})
 const later=await snapshot(raw(job.jobId,third),'legacy-refreshed');await save([later],third)
 const stored=await row(job.jobId);record.actual={postedAt:stored.postedAt,sortDate:stored.sortDate,createdAt:stored.createdAt,lastSeenAt:stored.lastSeenAt}
 assert.equal(at(stored.lastSeenAt),third);assert.equal(at(stored.postedAt),second,'Retain only the date actually stored, without inventing a past first observation');assert.equal(at(stored.sortDate),second);assert.equal(stored.postedAtProvenance,undefined);assert.equal(stored.postedAtProvenanceValue,undefined)
})
check('an aged normalized unknown date still refreshes last-seen without renewing public freshness',async record=>{
 const initial='2026-10-01T08:00:00.000Z',later='2026-11-30T09:00:00.000Z',job=raw('R-aged-unknown',initial)
 await save([job],initial)
 const normalized=await snapshot(job,'aged-unknown-first-packet')
 const observed=normalizeScrapedJob({...normalized,scrapedAt:later,scrapedTimestamp:later},{source})
 const result=await save([observed],later),stored=await row(job.jobId)
 record.actual={result,postedAt:stored.postedAt,sortDate:stored.sortDate,lastSeenAt:stored.lastSeenAt,visible:await publicCount(later)}
 assert.equal(result.inserted,0);assert.equal(result.updated,1,'Unknown source publication dates cannot be rejected as known-old publication dates')
 assert.equal(at(stored.lastSeenAt),later);assert.equal(at(stored.scrapedAt),later);assert.equal(at(stored.postedAt),initial);assert.equal(at(stored.sortDate),initial)
 const onlyThis={...applyPublicJobVisibility({source,requisitionId:job.jobId,status:'active'},{experiencedJobsEnabled:true}),...buildPublicJobLifecycleDateScope(new Date(later))}
 assert.equal(await Job.countDocuments(onlyThis),0)
})

check('an unknown-date upsert cannot overwrite a concurrently inserted first observation',async(record,t)=>{
 const id='R-concurrent-first-observation',input=raw(id,second)
 const {generateFingerprint}=await load('scraper-support/utils/applicationIdentity.js')
 const storedInput=normalizeScrapedJob(raw(id,first),{source})
 const concurrent={...storedInput,source,fingerprint:generateFingerprint(storedInput),postedAt:new Date(first),sortDate:new Date(first),scrapedAt:new Date(first),lastSeenAt:new Date(first),status:'active'}
 let inserted=false
 const find=Job.find
 t.mock.method(Job,'find',function(...args){
  const query=find.apply(this,args),exec=query.exec.bind(query)
  query.exec=async()=>{const rows=await exec();if(!inserted){inserted=true;await Job.collection.insertOne(concurrent)}return rows}
  return query
 })
 const result=await save([input],second),stored=await row(id)
 record.actual={result,postedAt:stored.postedAt,sortDate:stored.sortDate,lastSeenAt:stored.lastSeenAt}
 assert.equal(result.inserted,0);assert.equal(at(stored.lastSeenAt),second)
 assert.equal(at(stored.postedAt),first);assert.equal(at(stored.sortDate),first)
})
check('a concurrent real source date wins against an unknown observation after lookup',async(record,t)=>{
 const id='R-concurrent-source-date',published='2026-10-20T03:00:00.000Z';await save([raw(id)],first)
 let changed=false
 const find=Job.find
 t.mock.method(Job,'find',function(...args){
  const query=find.apply(this,args),exec=query.exec.bind(query)
  query.exec=async()=>{const rows=await exec();if(!changed){changed=true;await Job.collection.updateOne({source,requisitionId:id},{$set:{postedAt:new Date(published),sortDate:new Date(published),postedAtProvenance:'source',postedAtProvenanceValue:published}})}return rows}
  return query
 })
 await save([raw(id,second)],second);const stored=await row(id)
 record.actual={postedAt:stored.postedAt,sortDate:stored.sortDate,postedAtProvenance:stored.postedAtProvenance}
 assert.equal(at(stored.postedAt),published);assert.equal(at(stored.sortDate),published);assert.equal(stored.postedAtProvenance,'source')
})
check('a genuine source publication date supersedes a stale sortDate on normalized input',async record=>{
 const id='R-stale-sort-date',published='2026-10-20T03:00:00.000Z';await save([raw(id)],first)
 const normalized=await snapshot(raw(id,second),'stale-sort-date')
 await save([{...normalized,postingDate:published,sortDate:first}],second)
 const stored=await row(id);record.actual={postedAt:stored.postedAt,sortDate:stored.sortDate}
 assert.equal(at(stored.postedAt),published);assert.equal(at(stored.sortDate),published)
})
check('an otherwise unchanged undated snapshot ignores only changed observation clocks',async record=>{
 const id='R-snapshot-unknown-clock',file=path.join(output,'unknown-stable-snapshot.json')
 await saveDryRunSnapshot([raw(id,first)],file,{source,enrichPublicExperience:false})
 const before=await fs.readFile(file,'utf8')
 await saveDryRunSnapshot([raw(id,second)],file,{source,enrichPublicExperience:false})
 const after=await fs.readFile(file,'utf8');record.actual={sameBytes:before===after}
 assert.equal(after,before)
})
check('a changed genuine source publication date rewrites the dry-run snapshot',async record=>{
 const id='R-snapshot-source-date',file=path.join(output,'known-changed-snapshot.json')
 await saveDryRunSnapshot([raw(id,first,{postingDate:'2026-10-20T03:00:00.000Z'})],file,{source,enrichPublicExperience:false})
 const before=await fs.readFile(file,'utf8')
 await saveDryRunSnapshot([raw(id,second,{postingDate:'2026-10-21T03:00:00.000Z'})],file,{source,enrichPublicExperience:false})
 const after=await fs.readFile(file,'utf8');record.actual={sameBytes:before===after}
 assert.notEqual(after,before)
})
check('Aavas native profiles keep their first observation and do not resurface after an aging gap',async record=>{
 const {gunzipSync}=await import('node:zlib')
 const fixture=JSON.parse(gunzipSync(await fs.readFile(path.join(repo,'scraper/aavasfinanciers.workday/fixtures/current-native-20261024.json.gz'))))
 const {run}=await load('scraper/aavasfinanciers.workday/script.js')
 const {getScraperCatalog,decorateJobsWithProviderMetadata}=await load('scraper-support/providers/index.js')
 const provider=getScraperCatalog().find(item=>item.source==='aavasfinanciers')
 const extract=async clock=>{
  let listingReads=0
  return decorateJobsWithProviderMetadata(await run({now:()=>clock,fetchPage:async url=>{
   if(url==='https://www.aavas.in/career')return fixture.career
   if(url==='https://www.aavas.in/join-our-team')return ++listingReads===1?fixture.first:fixture.last
   if(url===fixture.client.finalUrl)return fixture.client
   assert.ok(Object.hasOwn(fixture.roles,url));return fixture.roles[url]
  }}),provider)
 }
 const stages=[]
 const clocks=[fixture.capturedAt,second,'2026-11-30T09:00:00.000Z']
 for(const [index,clock] of clocks.entries()){
  const jobs=await extract(clock);assert.equal(jobs.length,8);assert.ok(jobs.every(job=>job.postingDate===null))
  const file=path.join(output,`aavas-observation-${index}.json`)
  await saveDryRunSnapshot(jobs,file,{source:provider.source,enrichPublicExperience:false})
  const normalized=JSON.parse(await fs.readFile(file,'utf8')).map(job=>normalizeScrapedJob(job,{source:provider.source}))
  const filter={...applyPublicJobVisibility({source:provider.source,status:'active'},{experiencedJobsEnabled:true}),...buildPublicJobLifecycleDateScope(new Date(clock))}
  const publicBefore=await Job.countDocuments(filter)
  const result=await saveToDB(normalized,provider.source,{now:new Date(clock),enrichPublicExperience:false,descriptionRewriteMode:'off',enqueueAlerts:false,refreshDatasetSummary:false})
  const stored=await Job.find({source:provider.source}).sort({jobId:1}).lean()
  const originalById=new Map(jobs.map(job=>[job.jobId,job]))
  assert.equal(stored.length,8);assert.ok(stored.every(job=>job.sourceDescription===originalById.get(job.jobId).sourceDescription))
  stages.push({clock,result,publicBefore,publicAfter:await Job.countDocuments(filter),stored:stored.map(job=>({jobId:job.jobId,postedAt:job.postedAt,sortDate:job.sortDate,scrapedAt:job.scrapedAt,lastSeenAt:job.lastSeenAt,postedAtProvenance:job.postedAtProvenance}))})
 }
 record.actual={stages}
 const final=stages.at(-1)
 assert.equal(final.result.inserted,0);assert.equal(final.result.updated,8)
 assert.equal(final.publicBefore,0);assert.equal(final.publicAfter,0,'Another observation must not renew public freshness for the same undated roles')
 for(const stage of stages)for(const job of stage.stored){
  assert.equal(at(job.postedAt),at(fixture.capturedAt));assert.equal(at(job.sortDate),at(fixture.capturedAt));assert.equal(at(job.lastSeenAt),stage.clock)
 }
})

check('verified Oracle enrichment explicitly replaces observation origin even at the same instant',async record=>{
 const {enrichJobWithPublicExperience}=await load('scraper-support/utils/publicExperienceEnrichment.js')
 const id='1001',url='https://example.fa.em2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1/job/1001'
 const job=raw(id,first,{sourceUrl:url,applyUrl:url,siteNumber:'CX_1',sourceDescription:null,jobDescription:null})
 await save([job],first)
 const normalized=normalizeScrapedJob(job,{source}),requests=[]
 const description='<h2>Responsibilities</h2><p>Build reliable distributed software services and support engineering teams. Work with product teams, document the systems, and maintain production reliability.</p><h2>Qualifications</h2><p>Five years of software engineering experience required.</p>'
 const enriched=await enrichJobWithPublicExperience(normalized,{
  fetchText:async requested=>({status:200,url:requested,html:'<html><title>Careers</title><body>Search jobs</body></html>'}),
  fetchJson:async requested=>{
   requests.push(requested)
   return {status:200,url:requested,payload:{items:[{Id:id,Title:job.title,PrimaryLocationCountry:'IN',ExternalPostedStartDate:first,ExternalPostedEndDate:null,ExternalDescriptionStr:description}]}}
  },
 })
 record.actual={requests,postedAtProvenance:enriched.postedAtProvenance,postedAtProvenanceValue:enriched.postedAtProvenanceValue,postingDate:enriched.postingDate}
 assert.equal(requests.length,1);assert.equal(enriched.postedAtProvenance,'source');assert.equal(enriched.postedAtProvenanceValue,first)
 await save([normalizeScrapedJob(JSON.parse(JSON.stringify(enriched)),{source})],second)
 const stored=await row(id);assert.equal(at(stored.postedAt),first);assert.equal(stored.postedAtProvenance,'source')
 await save([raw(id,third,{sourceUrl:url,applyUrl:url,sourceDescription:description})],third)
 const repeated=await row(id);assert.equal(at(repeated.postedAt),first);assert.equal(repeated.postedAtProvenance,'source');assert.equal(at(repeated.lastSeenAt),third)
})

for (const [name,postedAt,sortDate] of [
 ['null dates',null,null],['missing dates',undefined,undefined],
 ['known posting and missing sort','2026-10-19T02:00:00.000Z',null],
 ['missing posting and known sort',null,'2026-10-05T01:00:00.000Z'],
]) check(`a current observation initializes only absent legacy fields: ${name}`,async record=>{
 const id='R-legacy-'+name.replaceAll(' ','-');await save([raw(id)],first)
 const set={},unset={postedAtProvenance:'',postedAtProvenanceValue:''}
 for(const [field,value] of [['postedAt',postedAt],['sortDate',sortDate]]){
  if(value===undefined)unset[field]=''
  else set[field]=value===null?null:new Date(value)
 }
 await Job.collection.updateOne({source,requisitionId:id},{$set:set,$unset:unset})
 const observed=await snapshot(raw(id,second),'legacy-init-'+id),result=await save([observed],second),stored=await row(id)
 const expectedPosting=postedAt||second,expectedSort=sortDate||postedAt||second
 record.actual={result,postedAt:stored.postedAt,sortDate:stored.sortDate,postedAtProvenance:stored.postedAtProvenance,postedAtProvenanceValue:stored.postedAtProvenanceValue}
 assert.equal(result.inserted,0);assert.equal(result.initializedObservationDates,1)
 assert.equal(at(stored.postedAt),expectedPosting);assert.equal(at(stored.sortDate),expectedSort)
 if(!postedAt){assert.equal(stored.postedAtProvenance,'observation');assert.equal(stored.postedAtProvenanceValue,second)}
 else{assert.equal(stored.postedAtProvenance,undefined);assert.equal(stored.postedAtProvenanceValue,undefined)}
 const repeated=await save([await snapshot(raw(id,third),'legacy-init-repeat-'+id)],third),after=await row(id)
 assert.equal(repeated.initializedObservationDates||0,0);assert.equal(at(after.postedAt),expectedPosting);assert.equal(at(after.sortDate),expectedSort);assert.equal(at(after.lastSeenAt),third)
 const future='2026-12-31T09:00:00.000Z',aged=await snapshot(raw(id,future),'legacy-init-aged-'+id)
 await save([aged],future)
 const visible={...applyPublicJobVisibility({source,requisitionId:id,status:'active'},{experiencedJobsEnabled:true}),...buildPublicJobLifecycleDateScope(new Date(future))}
 assert.equal(await Job.countDocuments(visible),0,'A once-initialized legacy role must age out despite later observations')
})

check('legacy initialization derives a missing sort date from a concurrent recovered source date',async(record,t)=>{
 const id='R-legacy-concurrent-source',published='2026-10-20T03:00:00.000Z';await save([raw(id)],first)
 await Job.collection.updateOne({source,requisitionId:id},{$set:{postedAt:null,sortDate:null},$unset:{postedAtProvenance:'',postedAtProvenanceValue:''}})
 let changed=false;const find=Job.find
 t.mock.method(Job,'find',function(...args){const query=find.apply(this,args),exec=query.exec.bind(query);query.exec=async()=>{
  const rows=await exec();if(!changed){changed=true;await Job.collection.updateOne({source,requisitionId:id},{$set:{postedAt:new Date(published),postedAtProvenance:'source',postedAtProvenanceValue:published}})}return rows
 };return query})
 const result=await save([raw(id,second)],second),stored=await row(id)
 record.actual={result,postedAt:stored.postedAt,sortDate:stored.sortDate,provenance:stored.postedAtProvenance}
 assert.equal(at(stored.postedAt),published);assert.equal(at(stored.sortDate),published);assert.equal(stored.postedAtProvenance,'source');assert.equal(stored.postedAtProvenanceValue,published)
 assert.equal(result.initializedObservationDates,1)
})

check('a concurrent earlier observer wins legacy initialization without refreshing its date',async(record,t)=>{
 const id='R-legacy-concurrent-observer';await save([raw(id)],first)
 await Job.collection.updateOne({source,requisitionId:id},{$set:{postedAt:null,sortDate:null},$unset:{postedAtProvenance:'',postedAtProvenanceValue:''}})
 let changed=false;const find=Job.find
 t.mock.method(Job,'find',function(...args){const query=find.apply(this,args),exec=query.exec.bind(query);query.exec=async()=>{
  const rows=await exec();if(!changed){changed=true;await Job.collection.updateOne({source,requisitionId:id},{$set:{postedAt:new Date(first),sortDate:new Date(first),postedAtProvenance:'observation',postedAtProvenanceValue:first}})}return rows
 };return query})
 const result=await save([raw(id,second)],second),stored=await row(id)
 record.actual={result,postedAt:stored.postedAt,sortDate:stored.sortDate}
 assert.equal(at(stored.postedAt),first);assert.equal(at(stored.sortDate),first);assert.equal(stored.postedAtProvenanceValue,first);assert.equal(result.initializedObservationDates||0,0)
})

check('legacy initialization remains confined to the observed source and native shared-form identity',async record=>{
 const applyUrl='https://example.invalid/legacy-shared-form',a=raw('R-legacy-form-a',first,{applyUrl,applicationUrlIsGeneric:true}),b=raw('R-legacy-form-b',first,{applyUrl,applicationUrlIsGeneric:true})
 await save([a,b],first)
 const other={...raw('R-legacy-other-source'),source:'generic-provenance-other'}
 await saveToDB([other],other.source,{now:new Date(first),enrichPublicExperience:false,descriptionRewriteMode:'off',enqueueAlerts:false,refreshDatasetSummary:false})
 await Job.collection.updateMany({requisitionId:{$in:[a.jobId,b.jobId,other.jobId]}},{$set:{postedAt:null,sortDate:null},$unset:{postedAtProvenance:'',postedAtProvenanceValue:''}})
 const result=await save([raw(a.jobId,second,{applyUrl,applicationUrlIsGeneric:true})],second)
 const [afterA,afterB,afterOther]=await Promise.all([row(a.jobId),row(b.jobId),Job.findOne({source:other.source,requisitionId:other.jobId}).lean()])
 record.actual={result,aPostedAt:afterA.postedAt,bPostedAt:afterB.postedAt,otherPostedAt:afterOther.postedAt}
 assert.equal(at(afterA.postedAt),second);assert.equal(afterB.postedAt,null);assert.equal(afterB.sortDate,null);assert.equal(afterOther.postedAt,null);assert.equal(afterOther.sortDate,null)
 assert.equal(at(afterB.lastSeenAt),first);assert.equal(at(afterOther.lastSeenAt),first);assert.equal(result.initializedObservationDates,1)
})

check('cancellation after ordinary persistence prevents a legacy date initialization write',async(record,t)=>{
 const id='R-legacy-cancel';await save([raw(id)],first)
 await Job.collection.updateOne({source,requisitionId:id},{$set:{postedAt:null,sortDate:null},$unset:{postedAtProvenance:'',postedAtProvenanceValue:''}})
 const controller=new AbortController(),reason=new Error('Cancel after ordinary source write'),bulkWrite=Job.bulkWrite;let calls=0
 t.mock.method(Job,'bulkWrite',async function(...args){calls++;const result=await bulkWrite.apply(this,args);controller.abort(reason);return result})
 await assert.rejects(saveToDB([raw(id,second)],source,{now:new Date(second),signal:controller.signal,enrichPublicExperience:false,descriptionRewriteMode:'off',enqueueAlerts:false,refreshDatasetSummary:false}),error=>error===reason)
 const stored=await row(id);record.actual={calls,postedAt:stored.postedAt,sortDate:stored.sortDate};assert.equal(calls,1);assert.equal(stored.postedAt,null);assert.equal(stored.sortDate,null)
})
