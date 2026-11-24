import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js'
import {declaredJibeSearch,readJibeRecruitment} from '../scraper-support/utils/recruitmentJibe.js'

const directory=new URL('./test-data/recruitmentJibeCurrentClient20261120/',import.meta.url)
const manifest=JSON.parse(fs.readFileSync(new URL('manifest.json',directory)))
function original(name){
 const bytes=gunzipSync(fs.readFileSync(new URL(name+'.gz',directory)))
 assert.equal(bytes.length,manifest[name].bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),manifest[name].sha256)
 return bytes.toString()
}
const currentClient=original('client.js'),currentBoard=original('board.html')
const boardURL='https://www.bookingholdings-coe.com/bookingholdings-coe/jobs'
const search=declaredJibeSearch(readNativeDocument(currentBoard),boardURL)
const oldProtocol=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/recruitmentJibeScope20261107/current-declared-scope.json.gz',import.meta.url))))
const historicalBodies=new Map(oldProtocol.records.map(row=>{
 const bytes=Buffer.from(row.bodyBase64,'base64')
 assert.equal(bytes.length,row.bytes)
 assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256)
 return [row.artifact,bytes.toString()]
}))
// The real current board/client is paired with an explicitly older full native
// protocol fixture here. This is a parser regression, not a new live job claim.
const payload=JSON.parse(historicalBodies.get('scoped-native-detail/response-1.bin'))
const detail=JSON.parse(historicalBodies.get('scoped-native-detail/response-2.bin'))
const row=payload.jobs.find(value=>value.data.req_id===detail.req_id)
async function read(script){
 const jobs=[],calls=[]
 await readJibeRecruitment(search,{
  permit:()=>{},readRenderer:async()=>({html:script}),maxPages:1,maxDetails:1,canRead:()=>true,
  inventoryRead:()=>{},recordRead:()=>{},unresolved:()=>{},problem:(_stage,error)=>{throw error},addJob:value=>jobs.push(value),
  readJson:async url=>{calls.push(url);return new URL(url).pathname==='/api/jobs'?{jobs:[row],count:1,totalCount:1}:detail},
 })
 return {jobs,calls}
}
function replace(original,replacement){
 assert.equal(currentClient.split(original).length,2,'mutation must target one actual current statement')
 return currentClient.replace(original,replacement)
}
test('the actual Nov20 board and deployed client preserve their anonymous native COE scope',async()=>{
 assert.equal(search.cid,'workingatbooking')
 assert.equal(search.clientURL,'https://app.jibecdn.com/prod/search/4.11.228/main.js')
 assert.deepEqual(search.mandatoryParams,{internal:'false',tags1:'Booking Holdings COE Company Hierarchy'})
 const result=await read(currentClient)
 assert.equal(result.jobs.length,1)
 const query=new URL(result.calls[0])
 assert.equal(query.searchParams.get('internal'),'false')
 assert.equal(query.searchParams.get('tags1'),search.mandatoryParams.tags1)
 assert.equal(query.searchParams.get('country'),'India')
 assert.deepEqual(result.jobs[0].record.detail,detail)
})
test('unrelated deployment comments and interface wording do not invalidate native query semantics',async()=>{
 assert.equal((await read(currentClient+'\n/* deployment-only comment */\n')).jobs.length,1)
 const changed=currentClient.replaceAll('JOBS.SEARCH_API_ERROR','JOBS.SEARCH_TEMPORARY_ERROR')
 assert.notEqual(changed,currentClient)
 assert.equal((await read(changed)).jobs.length,1)
})
test('an anonymous query formal can be renamed without changing its bindings',async()=>{
 const start=currentClient.indexOf('searchJob(e){let r=!1;')
 assert.ok(start>0)
 const end=currentClient.indexOf('return g}',start)+'return g}'.length
 assert.ok(end>start)
 const method=currentClient.slice(start,end).replace(/\be\b/g,'publicQuery')
 assert.equal((await read(currentClient.slice(0,start)+method+currentClient.slice(end))).jobs.length,1)
})
for(const [label,from,to]of [
 ['private default','internal:this.config.searchOverride?.internal||"false"','internal:this.config.searchOverride?.internal||"true"'],
 ['foreign hierarchy writer','c[f]=this.config.searchOverride[f].toString()','c[f]="Other company"'],
 ['other override source','for(const f in this.config.searchOverride)','for(const f in this.config.otherOverride)'],
 ['changed parameter precedence','params:{...e,...c,...s}','params:{...c,...e,...s}'],
 ['an appended foreign hierarchy','params:{...e,...c,...s}','params:{...e,...c,...s,tags1:"Other company"}'],
 ['changed GET method','const g=this.http.get("/api/jobs"','const g=this.http.post("/api/jobs"'],
 ['changed scoped endpoint','const g=this.http.get("/api/jobs"','const g=this.http.get("/api/private-jobs"'],
 ['a later scope rewrite','const g=this.http.get("/api/jobs"','c.tags1="Other company";const g=this.http.get("/api/jobs"'],
 ['a later extra scope writer','const g=this.http.get("/api/jobs"','s.tags1="Other company";const g=this.http.get("/api/jobs"'],
 ['a later query rewrite','const g=this.http.get("/api/jobs"','e={internal:true};const g=this.http.get("/api/jobs"'],
 ['an unknown request body','params:{...e,...c,...s},headers:l','params:{...e,...c,...s},headers:l,body:"private"'],
])test('current scoped client holds before API acquisition on '+label,async()=>{
 const script=replace(from,to)
 let calls=0
 await assert.rejects(readJibeRecruitment(search,{
  permit:()=>{},readRenderer:async()=>({html:script}),maxPages:1,maxDetails:1,canRead:()=>true,
  readJson:async()=>{calls++;throw Error('a changed client cannot authorize acquisition')},
 }),/client|scope|program|route/i)
 assert.equal(calls,0)
})

for(const [label,from,to]of [
 ['foreign final returned request','return g}searchJobBySlug','return this.http.get("/api/jobs",{params:{internal:"false",tags1:"Other company"}})}searchJobBySlug'],
 ['private final returned request','return g}searchJobBySlug','return this.http.get("/api/private-jobs",{params:{internal:"false"}})}searchJobBySlug'],
 ['foreign retry returned request','return g.pipe(','return this.http.get("/api/jobs",{params:{internal:"false",tags1:"Other company"}}).pipe('],
])test('a correct declaration cannot donate scope to a '+label,async()=>{
 let script
 if(currentClient.includes(from))script=replace(from,to)
 else{
  // The actual minified deployment places another class method after this one.
  // Change the last return only within the unique bound searchJob body.
  assert.ok(label.includes('final'))
  const start=currentClient.indexOf('searchJob(e){let r=!1;'),last=currentClient.indexOf('return g}',start)
  assert.ok(last>start)
  const replacement=to.slice(0,to.indexOf('}searchJobBySlug')+1)
  script=currentClient.slice(0,last)+replacement+currentClient.slice(last+'return g}'.length)
 }
 let calls=0
 await assert.rejects(readJibeRecruitment(search,{
  permit:()=>{},readRenderer:async()=>({html:script}),maxPages:1,maxDetails:1,canRead:()=>true,
  readJson:async()=>{calls++;throw Error('changed returned request cannot authorize acquisition')},
 }),/client|scope|program|route|query|request/i)
 assert.equal(calls,0)
})

for(const [label,replacement]of [
 ['computed HTTP','return this["http"].get("/api/private-jobs",{params:{internal:"true"}})'],
 ['sequenced HTTP','return(0,this.http.get)("/api/private-jobs",{params:{internal:"true"}})'],
 ['aliased HTTP','const otherHTTP=this.http;return otherHTTP.get("/api/private-jobs",{params:{internal:"true"}})'],
 ['computed unknown member','return this["ht"+"tp"].get("/api/private-jobs",{params:{internal:"true"}})'],
])test('a returned retry transport cannot bypass the native query: '+label,async()=>{
 const script=replace('return(0,v.of)({})',replacement)
 let calls=0
 await assert.rejects(readJibeRecruitment(search,{
  permit:()=>{},readRenderer:async()=>({html:script}),maxPages:1,maxDetails:1,canRead:()=>true,
  readJson:async()=>{calls++;throw Error('changed retry request cannot authorize acquisition')},
 }),/client|scope|program|route|query|request|transport|retry/i)
 assert.equal(calls,0)
})
