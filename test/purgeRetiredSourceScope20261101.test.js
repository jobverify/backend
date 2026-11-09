import assert from 'node:assert/strict'
import path from 'node:path'
import test, {before,after} from 'node:test'
import {execFile} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {MongoMemoryServer} from 'mongodb-memory-server'
import mongoose from 'mongoose'
import {getScraperCatalog} from '../scraper-support/providers/index.js'

// All records below are synthetic purge fixtures, not native vacancy evidence.
const backend=path.resolve(import.meta.dirname,'..')
const selected='purge-scope.wellfoundDirectory',peer='purge-scope.himalayas.app'
const shared='Shared literal employer',blankCompany='Unrelated blank employer'
let server,client,sequence=0
before(async()=>{
  process.env.MONGOMS_RUNTIME_DOWNLOAD='false'
  server=await MongoMemoryServer.create({binary:{version:'8.2.6',downloadDir:process.env.MONGOMS_DOWNLOAD_DIR || path.join(backend,'.cache/mongodb-binaries')},instance:{ip:'127.0.0.1'}})
  client=await mongoose.mongo.MongoClient.connect(server.getUri('purge_scope_control'))
})
after(async()=>{await client?.close();await server?.stop()})
const database=async action=>{
  const name='purge_scope_20261101_'+process.pid+'_'+(++sequence),db=client.db(name),uri=server.getUri(name)
  assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:\d+\/purge_scope_20261101_/)
  try{return await action(db,uri)}finally{await db.dropDatabase()}
}
const cli=(uri,args,observe=false,extra={})=>new Promise(resolve=>{
  assert.match(uri,/^mongodb:\/\/127\.0\.0\.1:\d+\/purge_scope_20261101_/)
  assert.equal(Object.hasOwn(extra,'MONGO_URI'),false)
  const preload=pathToFileURL(path.join(backend,'test/helpers/purgeRetiredScopeInterleaving20261101.mjs')).href
  execFile(process.execPath,['--import',preload,'scripts/purgeRetiredCompanyJobs.js',...args],{cwd:backend,windowsHide:true,timeout:60000,maxBuffer:1024*1024,env:{...process.env,...extra,MONGO_URI:uri,PURGE_OBSERVE_DB_IMPORT:observe?'1':'0'}},(error,stdout,stderr)=>resolve({code:error?error.code:0,stdout,stderr}))
})
const objectId=()=>new mongoose.Types.ObjectId()
const job=(marker,company,source)=>({_id:objectId(),marker,title:'Synthetic purge fixture '+marker,description:'Synthetic engineering record for local purge scope assertions.',company,source,fingerprint:'purge-scope-'+marker,status:'active',isPublicIndia:true,jobType:'Full-time Experienced'})
const status=(marker,companyName,source)=>({_id:objectId(),marker,companyName,source})
const encode=value=>value.replaceAll('.','\uFF0E')
const seed=async(db,jobs,statuses,companies)=>{
  await db.collection('jobs').insertMany(jobs)
  await db.collection('scraperstatuses').insertMany(statuses)
  await db.collection('users').insertOne({savedJobs:jobs.map(row=>row._id),profile:{profilePreferenceFilters:{company:companies},telegramAlertFilters:{company:companies}}})
  await db.collection('clicks').insertMany(jobs.map(row=>({marker:row.marker,job:row._id})))
  await db.collection('jobalertdeliveries').insertMany([...jobs.map(row=>({marker:row.marker,job:row._id,jobSnapshot:{company:row.company}})),{marker:'orphan-shared',job:objectId(),jobSnapshot:{company:companies[0]}}])
  await db.collection('adminaudits').insertMany([...jobs.map(row=>({marker:row.marker,targetType:'Job',targetId:row._id})),...statuses.map(row=>({marker:row.marker,targetType:'ScraperStatus',targetId:row._id}))])
  await db.collection('jobdatasetsummaries').insertOne({key:'public-active',totalJobs:jobs.length,totalCompanies:companies.length,companies})
  const sources=Object.fromEntries(statuses.map(row=>[encode(row.source),{success:true,jobsFound:1,marker:row.marker}]))
  await db.collection('scraperruns').insertOne({sources,overall:{totalJobs:statuses.length,sourcesSucceeded:statuses.length,sourcesFailed:0}})
}
const markers=async(db,name)=>(await db.collection(name).find({}).toArray()).map(row=>row.marker).sort()

test('only-source preserves same-company peer, blank-source records and every unselected linked record',async()=>database(async(db,uri)=>{
  const jobs=[job('selected-job',shared,selected),job('peer-job',shared,peer),job('blank-job',blankCompany,'')]
  const statuses=[status('selected-status',shared,selected),status('peer-status',shared,peer),status('blank-status',blankCompany,'')]
  await seed(db,jobs,statuses,[shared,blankCompany])
  const result=await cli(uri,['--only-source='+selected,'--confirm']);assert.equal(result.code,0,result.stderr)
  const [user,run,summary]=await Promise.all([db.collection('users').findOne({}),db.collection('scraperruns').findOne({}),db.collection('jobdatasetsummaries').findOne({key:'public-active'})])
  const actual={jobs:await markers(db,'jobs'),statuses:await markers(db,'scraperstatuses'),saved:user.savedJobs.map(id=>jobs.find(row=>row._id.equals(id)).marker),preferences:user.profile.profilePreferenceFilters.company,alerts:user.profile.telegramAlertFilters.company,deliveries:await markers(db,'jobalertdeliveries'),clicks:await markers(db,'clicks'),audits:await markers(db,'adminaudits'),historyKeys:Object.keys(run.sources).sort(),historyPeer:run.sources[encode(peer)],historyBlank:run.sources[''],overall:run.overall,summary:{jobs:summary.totalJobs,companies:summary.companies}}
  assert.deepEqual(actual,{jobs:['blank-job','peer-job'],statuses:['blank-status','peer-status'],saved:['peer-job','blank-job'],preferences:[shared,blankCompany],alerts:[shared,blankCompany],deliveries:['blank-job','orphan-shared','peer-job'],clicks:['blank-job','peer-job'],audits:['blank-job','blank-status','peer-job','peer-status'],historyKeys:['',encode(peer)].sort(),historyPeer:{success:true,jobsFound:1,marker:'peer-status'},historyBlank:{success:true,jobsFound:1,marker:'blank-status'},overall:{totalJobs:2,sourcesSucceeded:2,sourcesFailed:0},summary:{jobs:2,companies:[shared,blankCompany]}})
  const preview=JSON.parse(result.stdout.split('\n').find(line=>line.startsWith('Retired-company purge preview:')).slice('Retired-company purge preview:'.length))
  assert.deepEqual(preview,{jobs:1,scraperStatuses:1,users:1,clicks:1,jobAlertDeliveries:1,jobDatasetSummaries:1,scraperRuns:1,adminAudits:2})
}))

test('default purge preserves active Stryker and unattributed rows while retiring both directory families',async()=>database(async(db,uri)=>{
  const current=getScraperCatalog().find(row=>row.source==='stryker');assert.ok(current);assert.equal(current.companyName,'Stryker')
  const jobs=[job('active-stryker','Stryker','stryker'),job('unattributed-stryker','Stryker',''),job('retired-wellfound','Retired Wellfound',selected),job('retired-himalayas','Retired Himalayas',peer)]
  const statuses=[status('active-status','Stryker','stryker'),status('unattributed-status','Stryker',''),status('wellfound-status','Retired Wellfound',selected),status('himalayas-status','Retired Himalayas',peer)]
  await seed(db,jobs,statuses,['Stryker','Retired Wellfound','Retired Himalayas'])
  const result=await cli(uri,['--confirm']);assert.equal(result.code,0,result.stderr)
  const user=await db.collection('users').findOne({}),run=await db.collection('scraperruns').findOne({})
  assert.deepEqual({jobs:await markers(db,'jobs'),statuses:await markers(db,'scraperstatuses'),saved:user.savedJobs.map(id=>jobs.find(row=>row._id.equals(id)).marker),preferences:user.profile.profilePreferenceFilters.company,deliveries:await markers(db,'jobalertdeliveries'),audits:await markers(db,'adminaudits'),history:Object.keys(run.sources).sort()}, {jobs:['active-stryker','unattributed-stryker'],statuses:['active-status','unattributed-status'],saved:['active-stryker','unattributed-stryker'],preferences:['Stryker'],deliveries:['active-stryker','orphan-shared','unattributed-stryker'],audits:['active-status','active-stryker','unattributed-status','unattributed-stryker'],history:['','stryker']})
}))

test('registered active company label remains protected even without existing jobs or status',async()=>database(async(db,uri)=>{
  assert.ok(getScraperCatalog().some(row=>row.source==='stryker'&&row.companyName==='Stryker'))
  await db.collection('users').insertOne({savedJobs:[],profile:{profilePreferenceFilters:{company:['Stryker']},telegramAlertFilters:{company:['Stryker']}}})
  await db.collection('jobalertdeliveries').insertOne({marker:'active-label-delivery',job:objectId(),jobSnapshot:{company:'Stryker'}})
  const result=await cli(uri,['--confirm']);assert.equal(result.code,0,result.stderr)
  const user=await db.collection('users').findOne({})
  assert.deepEqual({preferences:user.profile.profilePreferenceFilters.company,alerts:user.profile.telegramAlertFilters.company,deliveries:await markers(db,'jobalertdeliveries')},{preferences:['Stryker'],alerts:['Stryker'],deliveries:['active-label-delivery']})
}))

test('unselected status alone protects a shared company label and orphan delivery',async()=>database(async(db,uri)=>{
  const selectedJob=job('selected-job',shared,selected),statuses=[status('selected-status',shared,selected),status('peer-status',shared,peer)]
  await seed(db,[selectedJob],statuses,[shared])
  const result=await cli(uri,['--only-source='+selected,'--confirm']);assert.equal(result.code,0,result.stderr)
  const user=await db.collection('users').findOne({})
  assert.deepEqual({statuses:await markers(db,'scraperstatuses'),saved:user.savedJobs,preferences:user.profile.profilePreferenceFilters.company,alerts:user.profile.telegramAlertFilters.company,deliveries:await markers(db,'jobalertdeliveries')},{statuses:['peer-status'],saved:[],preferences:[shared],alerts:[shared],deliveries:['orphan-shared']})
}))

for(const [label,args]of[
  ['empty',['--only-source=']],['whitespace',['--only-source=   ']],['bare',['--only-source']],
  ['duplicate different',['--only-source='+selected,'--only-source='+peer]],
  ['duplicate same',['--only-source='+selected,'--only-source='+selected]],
])test('malformed explicit selector fails before any DB module load: '+label,async()=>database(async(db,uri)=>{
  await db.collection('jobs').insertOne(job('must-survive',shared,selected))
  const result=await cli(uri,[...args,'--confirm'],true)
  assert.deepEqual({failed:result.code===1,dbModuleLoaded:result.stderr.includes('PURGE_DB_IMPORT_OBSERVED'),connected:result.stdout.includes('MongoDB connected:'),jobsRemaining:await db.collection('jobs').countDocuments({})},{failed:true,dbModuleLoaded:false,connected:false,jobsRemaining:1})
  assert.match(result.stderr,/only-source/)
}))

test('a job reassigned at the first write keeps its saved references, clicks, deliveries and audit',async()=>database(async(db,uri)=>{
  const item=job('reassigned-job','Race-only label',selected),statusRow=status('retired-status','Race-only label',selected)
  await seed(db,[item],[statusRow],['Race-only label'])
  const result=await cli(uri,['--only-source='+selected,'--confirm'],false,{PURGE_RACE_KIND:'job-source',PURGE_RACE_TARGET:String(item._id),PURGE_RACE_PEER:peer})
  assert.equal(result.code,0,result.stderr);assert.match(result.stderr,/PURGE_RACE_EXECUTED/)
  const kept=await db.collection('jobs').findOne({_id:item._id}),user=await db.collection('users').findOne({})
  assert.deepEqual({source:kept?.source,saved:user.savedJobs.map(String),preferences:user.profile.profilePreferenceFilters.company,clicks:await markers(db,'clicks'),deliveries:await markers(db,'jobalertdeliveries'),audits:await markers(db,'adminaudits')},{source:peer,saved:[String(item._id)],preferences:['Race-only label'],clicks:['reassigned-job'],deliveries:['orphan-shared','reassigned-job'],audits:['reassigned-job']})
}))
test('a status reassigned at the first write retains its own audit and company preferences',async()=>database(async(db,uri)=>{
  const item=job('retired-job','Race-status label',selected),statusRow=status('reassigned-status','Race-status label',selected)
  await seed(db,[item],[statusRow],['Race-status label'])
  const result=await cli(uri,['--only-source='+selected,'--confirm'],false,{PURGE_RACE_KIND:'status-source',PURGE_RACE_TARGET:String(statusRow._id),PURGE_RACE_PEER:peer})
  assert.equal(result.code,0,result.stderr);assert.match(result.stderr,/PURGE_RACE_EXECUTED/)
  const kept=await db.collection('scraperstatuses').findOne({_id:statusRow._id}),user=await db.collection('users').findOne({})
  assert.deepEqual({source:kept?.source,saved:user.savedJobs,preferences:user.profile.profilePreferenceFilters.company,audits:await markers(db,'adminaudits'),deliveries:await markers(db,'jobalertdeliveries')},{source:peer,saved:[],preferences:['Race-status label'],audits:['reassigned-status'],deliveries:['orphan-shared']})
}))
test('a stale company snapshot cannot delete a delivery pointing to an unselected peer job',async()=>database(async(db,uri)=>{
  const jobs=[job('selected-job','Retired snapshot label',selected),job('peer-job','Current peer label',peer)],statuses=[status('selected-status','Retired snapshot label',selected),status('peer-status','Current peer label',peer)]
  await seed(db,jobs,statuses,['Retired snapshot label','Current peer label'])
  await db.collection('jobalertdeliveries').updateOne({marker:'peer-job'},{$set:{'jobSnapshot.company':'Retired snapshot label'}})
  const result=await cli(uri,['--only-source='+selected,'--confirm']);assert.equal(result.code,0,result.stderr)
  assert.deepEqual(await markers(db,'jobalertdeliveries'),['orphan-shared','peer-job'])
  assert.deepEqual(await markers(db,'jobs'),['peer-job'])
}))
test('concurrent peer history addition and update are preserved by the source-map CAS',async()=>database(async(db,uri)=>{
  await seed(db,[job('selected-job','Retired history label',selected),job('peer-job','Current history peer',peer)],[status('selected-status','Retired history label',selected),status('peer-status','Current history peer',peer)],['Retired history label','Current history peer'])
  const run=await db.collection('scraperruns').findOne({})
  const result=await cli(uri,['--only-source='+selected,'--confirm'],false,{PURGE_RACE_KIND:'history-peer',PURGE_RACE_TARGET:String(run._id),PURGE_RACE_PEER_KEY:encode(peer)})
  assert.equal(result.code,0,result.stderr);assert.match(result.stderr,/PURGE_RACE_EXECUTED/)
  const kept=await db.collection('scraperruns').findOne({_id:run._id})
  assert.deepEqual(kept.sources,{[encode(selected)]:{success:true,jobsFound:1,marker:'selected-status'},[encode(peer)]:{success:true,jobsFound:37,marker:'peer-status'},'new-peer':{success:true,jobsFound:2}})
  assert.deepEqual(kept.overall,{totalJobs:40,sourcesSucceeded:3,sourcesFailed:0})
  const applied=JSON.parse(result.stdout.split('\n').find(line=>line.startsWith('Retired-company purge applied:')).slice('Retired-company purge applied:'.length))
  assert.equal(applied.scraperRuns,0);assert.equal(applied.scraperRunConflicts,1)
}))
test('ambiguous source arrays cannot be selected as an exact scalar provider identity',async()=>database(async(db,uri)=>{
  const jobs=[job('selected-job',shared,selected),job('ambiguous-job',shared,peer)],statuses=[status('selected-status',shared,selected),status('ambiguous-status',shared,peer)]
  await seed(db,jobs,statuses,[shared])
  await db.collection('jobs').updateOne({_id:jobs[1]._id},{$set:{source:[selected,peer]}})
  await db.collection('scraperstatuses').updateOne({_id:statuses[1]._id},{$set:{source:[selected,peer]}})
  const result=await cli(uri,['--only-source='+selected,'--confirm']);assert.equal(result.code,0,result.stderr)
  const keptJob=await db.collection('jobs').findOne({_id:jobs[1]._id}),keptStatus=await db.collection('scraperstatuses').findOne({_id:statuses[1]._id}),user=await db.collection('users').findOne({})
  assert.deepEqual({jobSource:keptJob?.source,statusSource:keptStatus?.source,saved:user.savedJobs.map(String),preferences:user.profile.profilePreferenceFilters.company,deliveries:await markers(db,'jobalertdeliveries')},{jobSource:[selected,peer],statusSource:[selected,peer],saved:[String(jobs[1]._id)],preferences:[shared],deliveries:['ambiguous-job','orphan-shared']})
}))
test('registered Stryker label survives cleanup of a retired-source row bearing that same label',async()=>database(async(db,uri)=>{
  assert.ok(getScraperCatalog().some(row=>row.source==='stryker'&&row.companyName==='Stryker'))
  await seed(db,[job('retired-label-job','Stryker',selected)],[status('retired-label-status','Stryker',selected)],['Stryker'])
  const result=await cli(uri,['--confirm']);assert.equal(result.code,0,result.stderr)
  const user=await db.collection('users').findOne({})
  assert.deepEqual({jobs:await markers(db,'jobs'),statuses:await markers(db,'scraperstatuses'),preferences:user.profile.profilePreferenceFilters.company,alerts:user.profile.telegramAlertFilters.company,deliveries:await markers(db,'jobalertdeliveries')},{jobs:[],statuses:[],preferences:['Stryker'],alerts:['Stryker'],deliveries:['orphan-shared']})
}))
