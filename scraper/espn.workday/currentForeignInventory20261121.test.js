import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {runESPN} from './nativeTalentBrew.js'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
import {inventoryCleanupOptions} from '../../scraper-support/utils/scraperOutcome.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-foreign-20261121.json.gz',import.meta.url))))
const sha=b=>createHash('sha256').update(b).digest('hex'),provider=getScraperCatalog().find(row=>row.source==='espn')
const packet=(step)=>structuredClone(fixture.responses[(step-1)%2])
async function exercise({change=()=>{},registered=false,options={},abortAt=null,reason=null}={}){
 const original=globalThis.fetch,reads=[],controller=new AbortController();let jobs=null,error=null
 const signal=options.signal??controller.signal
 globalThis.fetch=async(url,init={})=>{
  const step=reads.length+1;reads.push({url:String(url),method:init.method??'GET',body:init.body??null})
  const row=packet(step);change(row,step)
  if(step===abortAt){controller.abort(reason);throw reason}
  if(step>4||String(url)!==row.url||reads.at(-1).method!==row.method)return Object.defineProperty(new Response('not found',{status:404,headers:{'content-type':'text/html'}}),'url',{value:String(url)})
  if(row.requestBody)assert.deepEqual(JSON.parse(init.body),JSON.parse(row.requestBody))
  const response=new Response(row.body,{status:row.status,headers:row.headers});Object.defineProperty(response,'url',{value:row.finalURL});return response
 }
 try{jobs=await(registered?createCatalogScraper(provider).run({signal}):runESPN({...options,signal}))}catch(cause){error=cause}finally{globalThis.fetch=original}
 return {jobs,error,reads}
}
const changeText=(row,from,to)=>{
 if(row.method==='POST'){
  const p=JSON.parse(row.body);assert(p.results.includes(from)||p.filters.includes(from),'mutation must match actual retained JSON fields');p.results=p.results.replaceAll(from,to);p.filters=p.filters.replaceAll(from,to);row.body=JSON.stringify(p)
 }else{assert(row.body.includes(from),'mutation must match actual retained HTML');row.body=row.body.replaceAll(from,to)}
}
const facet=(country,count)=>`data-count="${count}" data-display="${country}"`
const hold=async(change,expectedReads=1,options={})=>{const r=await exercise({change,options});assert(r.error,'Unknown or incomplete scope cannot become a verified zero');assert.equal(r.jobs,null);for(let cause=r.error;cause;cause=cause.cause)assert.notEqual(cause.code,'ERR_ASSERTION','Offline mutation/transport assertion cannot masquerade as a native scope hold');assert.equal(r.reads.length,expectedReads)}

test('retained current fixture distinguishes two diagnostic reads from simulated closing and opening URL redaction',()=>{
 assert.equal(fixture.closingReadsSimulated,true);assert.equal(fixture.responses.length,2);assert.equal(fixture.responses[0].originalBodyUnmodified,false);assert.equal(fixture.responses[1].originalBodyUnmodified,true)
 for(const row of fixture.responses)assert.equal(sha(Buffer.from(row.body)),row.sha256)
 const match=fixture.responses[0].body.match(/<section\b[^>]*id="country-filters-section"[^>]*>[\s\S]*?<\/section>/g);assert.equal(match.length,1);assert.equal(match[0],fixture.originalOpeningNativeModel.nativeCountrySectionHTML);assert.equal(sha(match[0]),fixture.originalOpeningNativeModel.nativeCountrySectionSHA256)
})

test('current16role exact brand inventory reconciles fifteenUS and oneMexico before scoped India zero',async()=>{
 const r=await exercise();assert.ifError(r.error);assert.equal(r.reads.length,4);assert.equal(r.jobs.length,0)
 const e=readInventoryEvidence(r.jobs);assert.equal(e.status,'verified-empty');assert.equal(e.indiaFacetCount,0);assert.equal(e.reportedTotal,null);assert.equal(e.lifecycleCleanupAllowed,false)
 const a=r.jobs[Symbol.for('jobverify.verified-recruitment-observations')];assert.equal(a.nativeRecords,16);assert.equal(a.nativeRows.length,16);assert.deepEqual(a.nativeCountryCounts,{'3996063':1,'6252001':15});assert.equal(a.nativeRows.find(row=>row.id==='103447902704').countryFacetID,'3996063')
 const o=readSourceObservationEvidence(r.jobs,'espn');assert.equal(o.observedVacancyCount,16);assert.equal(o.companyIndiaTotal,null);assert.equal(o.companyGlobalTotal,null);assert.equal(o.sourceScopeComplete,false)
})

test('true registered signal-only default closes4native reads and carries saver lifecycle hold',async()=>{
 const r=await exercise({registered:true});assert.ifError(r.error);assert.equal(r.reads.length,4);assert.equal(r.jobs.length,0);assert.equal(sourceLifecycleCleanupForbidden(r.jobs),true)
 const e=readInventoryEvidence(r.jobs);assert.deepEqual(inventoryCleanupOptions({rawRecords:0,jobs:0,eligibleJobs:0,inventoryEvidence:e,detailHealth:{complete:true}}),{replaceExisting:false})
})

for(const [name,change]of[
 ['country count gap',row=>changeText(row,facet('United States',15),facet('United States',14))],
 ['unreviewed country',row=>changeText(row,'data-display="Mexico"','data-display="Unknown"')],
 ['India facet',row=>{changeText(row,'data-id="3996063"','data-id="1269750"');changeText(row,'data-display="Mexico"','data-display="India"')}],
 ['disabled foreign country',row=>changeText(row,'data-id="3996063"','disabled data-id="3996063"')],
 ['hidden foreign country',row=>changeText(row,'<input type="checkbox" id="country-filter-0"','<input hidden type="checkbox" id="country-filter-0"')],
 ['hidden country region',row=>changeText(row,'id="country-filters-section"','hidden id="country-filters-section"')],
 ['ambiguous duplicated country',row=>{const tag=row.body.match(/<input\b[^>]*data-id="3996063"[^>]*>/)?.[0];assert(tag);changeText(row,tag,tag+tag)}],
 ['contradictory Mexico worksite',row=>changeText(row,'Mexico City,  Mexico','Mexico City,  Canada')],
 ['unknown US worksite',row=>changeText(row,'Southington,  Connecticut','Southington')],
 ['country facet and worksite count conflict',row=>{changeText(row,facet('Mexico',1),facet('Mexico',2));changeText(row,facet('United States',15),facet('United States',14))}],
])test(`current foreign inventory holds ${name}`,async()=>{
 const reads=name==='country facet and worksite count conflict'?2:1
 await hold((row,step)=>{if(name==='country facet and worksite count conflict'||step===1)change(row)},reads)
})

test('current secondpage omitted row cannot establish a zero',async()=>{
 await hold((row,step)=>{if(step===2){const p=JSON.parse(row.body),before=p.results;p.results=p.results.replace(/(<ul id="search-results-jobs"[^>]*>\s*)<li\b[^>]*>[\s\S]*?<\/li>/,'$1');assert.notEqual(p.results,before);row.body=JSON.stringify(p)}},2)
})

test('current duplicate identity across pages cannot establish a zero',async()=>{
 await hold((row,step)=>{if(step===2)changeText(row,'102295070672','103447902704')},2)
})

test('closing country counts cannot drift even with the same aggregate total',async()=>{
 await hold((row,step)=>{if(step===3){changeText(row,facet('Mexico',1),facet('Mexico',2));changeText(row,facet('United States',15),facet('United States',14))}},3)
})

test('closing foreign role country cannot drift',async()=>{
 await hold((row,step)=>{if(step===3)changeText(row,'Mexico City,  Mexico','Mexico City,  India')},3)
})

test('closing page2 criteria identity cannot drift',async()=>{
 await hold((row,step)=>{if(step===4)changeText(row,'Video Editor','Changed Current Role')},4)
})

test('request budget cannot return a partially enumerated zero',async()=>{await hold(()=>{},1,{maxRequests:3})})

test('caller opaque abort identity survives at final closing read',async()=>{
 const reason=Object.freeze({caller:'espn-current-final-close'}),r=await exercise({abortAt:4,reason});assert.strictEqual(r.error,reason);assert.equal(r.jobs,null);assert.equal(r.reads.length,4)
})

test('preaborted null caller preserves exact reason with0reads',async()=>{
 const c=new AbortController();c.abort(null);const r=await exercise({registered:true,options:{signal:c.signal}});assert.strictEqual(r.error,null);assert.equal(r.jobs,null);assert.equal(r.reads.length,0)
})
