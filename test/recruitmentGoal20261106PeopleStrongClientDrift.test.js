import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

globalThis.fetch=()=>{throw Error('OFFLINE_NETWORK_TRIPWIRE')}
const {scenario,registered}=await import('../scraper-support/tests/peopleStrongNativePair20261027.fixtures.js')
const clients=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/recruitmentGoal20261106/peoplestrong-current-clients.json.gz',import.meta.url))))

function currentScenario(source,mutate=(name,body)=>body){
 const s=scenario(source),original=s.fetchPage
 s.fetchPage=async(url,init)=>{
  const suffix=new URL(url).pathname
  const name=suffix==='/main-PUBLIC123.js'?'main':suffix==='/chunk-MP77JDEN.js'?'job':suffix==='/chunk-ZKMRUQJB.js'?'filter':suffix==='/chunk-IFMVPRQ7.js'?'import-1':null
  if(name){s.calls.push({url,method:init?.method??'GET',body:init?.body});return{url,status:200,body:mutate(name,clients[name])}}
  return original(url,init)
 }
 return s
}

for(const source of ['anthem','amararajaenergymobility'])test(source+' current declared filter fields and page-size alias retain full native extraction',async()=>{
 const s=currentScenario(source),{jobs,report}=await registered(s)
 assert.equal(jobs.length,1)
 assert.match(jobs[0].jobDescription,/Full native responsibilities & safety/)
 assert.equal(jobs[0].country,'India')
 assert.equal(report.closingMatches,true)
 assert.equal(report.fullNativeDetails,1)
 const reads=s.calls.filter(c=>c.url.includes('jobs/v1?'))
 assert.equal(reads.length,4)
 assert.ok(reads.every(c=>c.method==='POST'&&c.body==='{}'))
 assert.equal(s.calls.filter(c=>c.url.includes('/v2?part=')).length,1)
})

for(const [name,replace]of [
 ['job',body=>body.replace('functionalAreaIDList:this.filterTO.functionalAreaIDList};this.jobService.getjoblist','functionalAreaIDList:[99]};this.jobService.getjoblist')],
 ['filter',body=>body.replace('class{isFiltered()', 'class{constructor(){this.orgUnitList=[99]}isFiltered()')],
 ['import-1',body=>body.replace(',ay=45,',',ay=15,')],
 ['import-1',body=>body.replace(',ay=45,',',ay=15,')+'/*this.offset=0,this.limit=45*/'],
 ['import-1',body=>body+'/*unreviewed current deployment suffix*/'],
 ['import-1',body=>body.replace('this.makePostReq("jobs/v1?offset="','this.makePostReq("unknown/v1?offset="')],
])test('unreviewed current '+name+' mutation stops before native search',async()=>{
 const s=currentScenario('anthem',(n,body)=>n===name?replace(body):body)
 await assert.rejects(registered(s),/Unverified initial|protocol changed/)
 assert.equal(s.calls.some(c=>c.url.includes('jobs/v1?')),false)
})

const legacyBody='let o={bandList:this.filterTO.bandList,gradeList:this.filterTO.gradeList,bandIDList:this.filterTO.bandIDList,gradeIDList:this.filterTO.gradeIDList,employeeCategoryLabelList:this.filterTO.employeeCategoryLabelList};this.jobService.getjoblist(this.paginationTO.offset,this.paginationTO.limit,this.queryParams,o)'
for(const extra of ['/*'+legacyBody+'*/',';'+JSON.stringify(legacyBody)+';',';function neverCalled(){'+legacyBody+'}'])test('current active eight-field protocol cannot downgrade through appended legacy '+(extra.startsWith('/*')?'comment':extra.includes('neverCalled')?'dead function':'string'),async()=>{
 const s=currentScenario('anthem',(name,body)=>name==='job'?body+extra:name==='import-1'?body.replace(',ay=45,',',ay=15,')+'/*this.offset=0,this.limit=45*/':body)
 await assert.rejects(registered(s),/Unverified initial|protocol changed/)
 assert.equal(s.calls.some(c=>c.url.includes('jobs/v1?')),false)
})

test('service active default15 cannot pass through a dead literal45 comment',async()=>{
 const s=scenario('anthem'),original=s.fetchPage
 s.fetchPage=async(url,init)=>{const r=await original(url,init);return url.endsWith('/chunk-IFMVPRQ7.js')?{...r,body:r.body.replace(',ay=45,',',ay=15,')+'/*this.offset=0,this.limit=45*/'}:r}
 await assert.rejects(registered(s),/protocol changed/)
 assert.equal(s.calls.some(c=>c.url.includes('jobs/v1?')),false)
})

test('unreviewed extra service program cannot inherit unchanged pagination verification',async()=>{
 const s=scenario('anthem'),original=s.fetchPage
 s.fetchPage=async(url,init)=>{const r=await original(url,init);return url.endsWith('/chunk-IFMVPRQ7.js')?{...r,body:r.body+';class BinaryReader{constructor(){this.offset=0}}'}:r}
 await assert.rejects(registered(s),/protocol changed/)
 assert.equal(s.calls.some(c=>c.url.includes('jobs/v1?')),false)
})

for(const [label,jobChange,serviceChange]of [
 ['job page size override',body=>body.replace('let o={bandList:', 'this.paginationTO.limit=15;let o={bandList:'),body=>body],
 ['service prototype override',body=>body,body=>body+';Service.prototype.getjoblist=function(){return this.makePostReq("unknown/v1?offset=0",{})};'],
])test('unreviewed executable '+label+' cannot inherit legacy verification',async()=>{
 const s=scenario('anthem'),original=s.fetchPage
 s.fetchPage=async(url,init)=>{const r=await original(url,init);return{...r,body:url.endsWith('/chunk-MP77JDEN.js')?jobChange(r.body):url.endsWith('/chunk-IFMVPRQ7.js')?serviceChange(r.body):r.body}}
 await assert.rejects(registered(s),/Unverified initial|protocol changed/)
 assert.equal(s.calls.some(c=>c.url.includes('jobs/v1?')),false)
})
