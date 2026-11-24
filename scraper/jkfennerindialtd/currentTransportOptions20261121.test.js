import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-data-20261121.json.gz',import.meta.url))))
const sha=value=>createHash('sha256').update(value).digest('hex'),HOME='https://jkfenner.com/',LEGACY='https://jkfenner.com/career-list/'
const legacyHome=fs.readFileSync(new URL('../../scraper-support/tests/fixtures/jkfennerindialtd/homepage.html',import.meta.url),'utf8'),legacyCareers=fs.readFileSync(new URL('../../scraper-support/tests/fixtures/jkfennerindialtd/career-list.html',import.meta.url),'utf8')
assert.equal(sha(legacyCareers),'7f80b9900a982b4f3c8ec4b88bf2df265dbfda3c61f519395d6e1ef4bf52b573')
const comment='\n<!-- <title>JK Fenner</title> <a href="https://jkfenner.com/career-list/">Careers</a> Redefining Motion Over 70 years... Leading manufacturer of POWER TRANSMISSION BELTS CUSTOMER FIRST -->'
const RealDate=Date,originalFetch=globalThis.fetch,inactive=()=>{throw Error('Only retained JK transport-option originals are permitted')}
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixture.observedAt]))}static now(){return RealDate.parse(fixture.observedAt)}}
let transport=inactive
globalThis.fetch=(...args)=>transport(...args)
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {createJkFennerIndiaLtdScraper}=await import('./script.js')
const {sourceLifecycleCleanupForbidden}=await import('../../scraper-support/utils/inventoryEvidence.js')
const provider=getScraperCatalog().find(row=>row.source==='jkfennerindialtd');assert.equal(provider.authoritativeCurrentPublication,true)
const metadata='scraper-support/providers/customProviders.json',metadataSHA256=sha(fs.readFileSync(metadata)),observations=[]

async function exercise(mode,makeOptions,{mutateHome=false,direct=false,reason,aborted=false}={}){
 const calls=[],legacyCalls=[],caller=new AbortController()
 if(aborted)caller.abort(reason)
 const fetchOriginal=async(value,init={})=>{
  const url=String(value),method=init.method??'GET',packet=fixture.packets.find(row=>row.url===url&&row.method===method)
  const parsed=new URL(url);calls.push({origin:parsed.origin,path:parsed.pathname,querySHA256:sha(parsed.search),method,redirect:init.redirect??null,credentials:init.credentials??null})
  if(!packet&&url!==LEGACY)throw Object.assign(Error('Unbound native or generic transport is prohibited'),{abortRetries:true,softFailure:true,failureKind:'coverage_gap'})
  let bytes=packet?Buffer.from(packet.bodyBase64,'base64'):Buffer.from(legacyCareers)
  if(packet)assert.equal(sha(bytes),packet.sha256)
  if(url===HOME&&mutateHome)bytes=Buffer.concat([bytes,Buffer.from(comment)])
  if(method==='POST')assert.deepEqual(JSON.parse(init.body),JSON.parse(packet.requestBody))
  const response=new Response(bytes,{status:200,headers:packet?.headers??{'content-type':'text/html'}});Object.defineProperty(response,'url',{value:packet?.finalURL??url});return response
 }
 const legacyFetchText=async url=>{legacyCalls.push(url);assert.ok(url===HOME||url===LEGACY);return url===HOME?legacyHome:legacyCareers}
 transport=fetchOriginal
 let jobs,error,rejected=false
 try{const options=makeOptions({signal:caller.signal,fetchOriginal,legacyFetchText});jobs=await(direct?createJkFennerIndiaLtdScraper().run(options):createCatalogScraper(provider).run(options))}catch(caught){rejected=true;error=caught}finally{transport=inactive}
 const row={mode,physicalHTTPRequests:0,calls,explicitLegacyCalls:legacyCalls.length,rejected,returnedJobs:jobs?.length??null,errorType:typeof error,callerReasonIdentityPreserved:aborted?error===reason:null}
 observations.push(row);return{...row,jobs,error,legacyCalls}
}
function nativeModels(result){
 assert.equal(result.rejected,false,'Blank/noncallable optional transport should use the complete current native DATA path')
 assert.equal(result.jobs.length,2);assert.equal(result.calls.length,30);assert.equal(result.legacyCalls.length,0);assert.equal(sourceLifecycleCleanupForbidden(result.jobs),true)
 for(const job of result.jobs){assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.sourceNativeDataOnly,true);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.criteriaComplete,true)}
}

for(const[label,value]of[['undefined',undefined],['null',null],['false',false],['empty string',''],['zero',0],['plain object',{}],['empty array',[]],['noncallable thenable',{then(){throw Error('A transport option must never be awaited')}}]])test('own '+label+' fetchText selects current native criteria without historical default transport',async()=>{
 nativeModels(await exercise(label,({signal})=>({signal,fetchText:value})))
})

test('actual own undefined option cannot publish historical India rows from an inert current-page comment',async()=>{
 const result=await exercise('undefined plus exact inactive reviewer comment',({signal})=>({signal,fetchText:undefined}),{mutateHome:true})
 assert.equal(result.rejected,true);assert.match(result.error.message,/whole current corporate homepage authority changed/)
 assert.equal(result.calls.length,1);assert.equal(result.jobs,undefined);assert.equal(result.legacyCalls.length,0)
})

for(const throwsSecond of[false,true])test('callable transport getter is read once when its second read '+(throwsSecond?'throws':'returns undefined'),async()=>{
 let reads=0
 const result=await exercise('callable accessor '+throwsSecond,({signal,legacyFetchText})=>Object.defineProperty({signal},'fetchText',{enumerable:true,get(){if(++reads===1)return legacyFetchText;if(throwsSecond)throw Error('Transport selector was read twice');return undefined}}))
 assert.equal(result.rejected,false);assert.equal(reads,1);assert.equal(result.jobs.length,8);assert.equal(result.legacyCalls.length,2);assert.equal(result.calls.length,0)
})

for(const throwsSecond of[false,true])test('empty transport getter is read once when its second read '+(throwsSecond?'throws':'returns a function'),async()=>{
 let reads=0
 const result=await exercise('empty accessor '+throwsSecond,({signal,legacyFetchText})=>Object.defineProperty({signal},'fetchText',{enumerable:true,get(){if(++reads===1)return undefined;if(throwsSecond)throw Error('Empty transport selector was read twice');return legacyFetchText}}))
 nativeModels(result);assert.equal(reads,1)
})

test('an inherited transport function cannot select historical compatibility',async()=>{
 nativeModels(await exercise('inherited callable',({signal,legacyFetchText})=>Object.assign(Object.create({fetchText:legacyFetchText}),{signal})))
})

test('native fetchImpl precedence does not reread or invoke a legacy accessor transport',async()=>{
 let reads=0
 const result=await exercise('native precedence with accessor',({signal,fetchOriginal,legacyFetchText})=>Object.defineProperty({signal,fetchImpl:fetchOriginal},'fetchText',{enumerable:true,get(){if(++reads>1)throw Error('Native forwarding reread the legacy selector');return legacyFetchText}}))
 nativeModels(result);assert.equal(reads,1)
})

test('an explicit callable legacy transport preserves the exact existing eight-role fixture',async()=>{
 const result=await exercise('explicit callable',({signal,legacyFetchText})=>({signal,fetchText:legacyFetchText}))
 assert.equal(result.rejected,false);assert.equal(result.jobs.length,8);assert.equal(result.legacyCalls.length,2);assert.equal(result.calls.length,0)
 assert.equal(result.jobs[0].jobDescription,'Customer segments handled: Power, Steel, Cement, Sugar, Paper, Food & Beverage Product Experience: Industrial Gear Box / Geared Motors')
})

test('a zero cap with an empty transport option still reconciles all current criteria before returning the cap',async()=>{
 const result=await exercise('zero cap empty option',({signal})=>({signal,fetchText:undefined,maxJobs:0}))
 assert.equal(result.rejected,false);assert.equal(result.calls.length,30);assert.equal(result.jobs.length,0)
 assert.equal(result.jobs.nativeCollectionEvidence.nativePayload.length,2);assert.equal(sourceLifecycleCleanupForbidden(result.jobs),true)
})

const opaque=Object.freeze(Object.defineProperty({marker:'opaque caller reason'},'code',{get(){throw Error('Opaque caller reason code must never be inspected')}}))
for(const reason of[null,opaque])test('an empty transport option retains exact pre-aborted caller reason '+(reason===null?'null':'frozen opaque object'),async()=>{
 const result=await exercise('pre-aborted empty option '+(reason===null?'null':'object'),({signal})=>({signal,fetchText:undefined}),{direct:true,aborted:true,reason})
 assert.equal(result.rejected,true);assert.equal(result.error,reason);assert.equal(result.calls.length,0);assert.equal(result.legacyCalls.length,0)
})

test.after(()=>{
 globalThis.fetch=originalFetch;globalThis.Date=RealDate
 assert.equal(sha(fs.readFileSync(metadata)),metadataSHA256)
 const output=process.env.JKFENNER_TRANSPORT_R3_RESULT
 if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({source:'jkfennerindialtd',assessedAt:new RealDate().toISOString(),physicalHTTPRequests:0,metadataSHA256,observations},null,2)+'\n')}
})
