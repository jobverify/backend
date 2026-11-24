import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'

const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-data-20261121.json.gz',import.meta.url))))
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const HOME='https://jkfenner.com/',LEGACY='https://jkfenner.com/career-list/'
const home=fixture.packets.find(packet=>packet.url===HOME),homeBytes=Buffer.from(home.bodyBase64,'base64')
const legacyHome=fs.readFileSync(new URL('../../scraper-support/tests/fixtures/jkfennerindialtd/homepage.html',import.meta.url),'utf8')
const legacyCareers=fs.readFileSync(new URL('../../scraper-support/tests/fixtures/jkfennerindialtd/career-list.html',import.meta.url))
assert.equal(sha(homeBytes),'f25820d0f0d055e1af08ae9e2cf2b0ebee6fcb0f82c8617980ea44e4c2a218b5')
assert.equal(sha(legacyCareers),'7f80b9900a982b4f3c8ec4b88bf2df265dbfda3c61f519395d6e1ef4bf52b573')
const tokens='<title>JK Fenner</title> <a href="https://jkfenner.com/career-list/">Careers</a> Redefining Motion Over 70 years... Leading manufacturer of POWER TRANSMISSION BELTS CUSTOMER FIRST'
const comment='\n<!-- '+tokens+' -->'
const RealDate=Date,originalFetch=globalThis.fetch,inactive=()=>{throw Error('Only retained JK original packets are allowed')}
// The original public read signatures are replayed at acquisition time only.
globalThis.Date=class extends RealDate{constructor(...args){super(...(args.length?args:[fixture.observedAt]))}static now(){return RealDate.parse(fixture.observedAt)}}
let transport=inactive
globalThis.fetch=(...args)=>transport(...args)
// Stock registered tests intentionally pass only signal: fetchImpl/onAudit would
// disable the recovery path whose authority boundary this regression covers.
const {getScraperCatalog,createCatalogScraper}=await import('../../scraper-support/providers/index.js')
const {createJkFennerIndiaLtdScraper,hasOfficialHomepageSignal}=await import('./script.js')
const provider=getScraperCatalog().find(row=>row.source==='jkfennerindialtd')
assert.ok(provider);assert.equal(provider.authoritativeCurrentPublication,true)
const metadata='scraper-support/providers/customProviders.json',metadataSHA256=sha(fs.readFileSync(metadata)),observations=[]
const activeIdentity=html=>{const document=readNativeDocument(html);return{title:document.nodes(node=>node.tag==='title').map(node=>node.raw),anchors:document.nodes(node=>node.tag==='a').map(node=>node.attrs.href)}}

async function stock(mode,mutate,{closing=false,direct=false,callbacks=false}={}){
 const calls=[];let homeReads=0,legacyFetchTextCalls=0,legacyOverrideCalls=0
 const fetchOriginal=async(value,init={})=>{
  const url=String(value),method=init.method??'GET',packet=fixture.packets.find(row=>row.url===url&&row.method===method)
  const sourceOwned=init.redirect==='manual'&&init.credentials==='omit'&&Boolean(packet||url===LEGACY)
  calls.push({url,method,sourceOwned,redirect:init.redirect??null,credentials:init.credentials??null})
  if(!sourceOwned)throw Object.assign(Error('Unbound/generic requests prohibited after current authority hold'),{abortRetries:true,softFailure:true,failureKind:'coverage_gap'})
  let bytes,headers,finalURL
  if(url===LEGACY){bytes=legacyCareers;headers={'content-type':'text/html'};finalURL=url}
  else{bytes=Buffer.from(packet.bodyBase64,'base64');headers=packet.headers;finalURL=packet.finalURL;assert.equal(sha(bytes),packet.sha256)}
  if(url===HOME&&++homeReads===(closing?2:1))bytes=Buffer.from(mutate(bytes.toString('utf8')))
  const response=new Response(bytes,{status:200,headers});Object.defineProperty(response,'url',{value:finalURL});return response
 }
 transport=fetchOriginal
 let jobs,error
 try{
  const signal=AbortSignal.timeout(25000)
  const stockOptions=callbacks?{signal,isLegacyHomepage:()=>{legacyOverrideCalls++;return true},runLegacy:()=>{legacyOverrideCalls++;throw Error('Caller legacy callbacks must never control the current native authority')}}:{signal}
  jobs=direct?await createJkFennerIndiaLtdScraper().run({signal,fetchImpl:fetchOriginal,fetchText:async()=>{legacyFetchTextCalls++;return legacyHome}}):await createCatalogScraper(provider).run(stockOptions)
 }catch(caught){error=caught}finally{transport=inactive}
 const row={mode,callerOptionKeys:direct?['signal','fetchImpl','fetchText']:callbacks?['signal','isLegacyHomepage','runLegacy']:['signal'],physicalHTTPRequests:0,calls,legacyFetchTextCalls,legacyOverrideCalls,returnedJobs:jobs?.length??null,error:error?{name:error.name,message:error.message}:null}
 observations.push(row);return{...row,jobs,error}
}

test('the exact reviewer comment preserves parsed current title and active anchors while matching the broad historical helper',()=>{
 const original=homeBytes.toString('utf8'),changed=original+comment
 assert.deepEqual(activeIdentity(changed),activeIdentity(original))
 assert.equal(hasOfficialHomepageSignal(original),false);assert.equal(hasOfficialHomepageSignal(changed),true)
})

for(const[mode,mutate]of[
 ['inert historical comment',html=>html+comment],
 ['inert historical template',html=>html+'<template>'+tokens+'</template>'],
 ['new authored closure and historical signals',html=>html+'<section><p>Applications for all positions are closed.</p>'+tokens+'</section>'],
 ['different historical whole homepage',()=>legacyHome],
])test('stock current authority rejects '+mode+' before historical extraction',async()=>{
 const result=await stock(mode,mutate)
 assert.ok(result.error,'A changed current homepage must not return historical India jobs')
 assert.match(result.error.message,/whole current corporate homepage authority changed/)
 assert.equal(result.calls.length,1,'No historical/generic request may follow an unqualified current publisher')
 assert.equal(result.jobs,undefined);assert.equal(result.legacyFetchTextCalls,0)
})

test('closing current authority also rejects the inert historical comment after the full opening originals',async()=>{
 const result=await stock('closing inert comment',html=>html+comment,{closing:true})
 assert.ok(result.error);assert.match(result.error.message,/whole current corporate homepage authority changed/)
 assert.equal(result.calls.length,16);assert.equal(result.calls.filter(row=>row.url===LEGACY).length,0)
 assert.equal(result.jobs,undefined)
})

test('an explicit fetchImpl cannot be redirected through a simultaneous historical fetchText option',async()=>{
 const result=await stock('fetchImpl takes current route',html=>html+comment,{direct:true})
 assert.ok(result.error);assert.match(result.error.message,/whole current corporate homepage authority changed/)
 assert.equal(result.calls.length,1);assert.equal(result.legacyFetchTextCalls,0)
})

test('caller legacy callback overrides cannot select a different authority or extraction contract',async()=>{
 const result=await stock('caller legacy callbacks ignored',html=>html,{callbacks:true})
 assert.ifError(result.error);assert.equal(result.legacyOverrideCalls,0);assert.equal(result.calls.length,30)
 assert.equal(result.jobs.length,2)
 for(const job of result.jobs){assert.equal(job.country,null);assert.equal(job.sourceCountryScopeUnresolved,true);assert.equal(job.lifecycleCleanupAllowed,false);assert.equal(job.sourceNativeDataOnly,true)}
})

test('explicit historical fetchText compatibility retains the existing complete eight-row fixture',async()=>{
 const calls=[]
 const jobs=await createJkFennerIndiaLtdScraper().run({fetchText:async url=>{calls.push(url);assert.ok(url===HOME||url===LEGACY);return url===HOME?legacyHome:legacyCareers.toString('utf8')}})
 assert.deepEqual(calls,[HOME,LEGACY]);assert.equal(jobs.length,8)
 assert.equal(jobs[0].jobDescription,'Customer segments handled: Power, Steel, Cement, Sugar, Paper, Food & Beverage Product Experience: Industrial Gear Box / Geared Motors')
 assert.equal(jobs[7].title,'Deputy Manager / ManagerOE')
})

test.after(()=>{
 globalThis.fetch=originalFetch;globalThis.Date=RealDate
 assert.equal(sha(fs.readFileSync(metadata)),metadataSHA256)
 const output=process.env.JKFENNER_ROUTING_R2_RESULT
 if(output){fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify({source:'jkfennerindialtd',assessedAt:new RealDate().toISOString(),metadataSHA256,physicalHTTPRequests:0,homeSHA256:sha(homeBytes),legacyCareersSHA256:sha(legacyCareers),originalsUnchanged:true,observations},null,2)+'\n')}
})
