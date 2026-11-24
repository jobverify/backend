import test from 'node:test'
import assert from 'node:assert/strict'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'
const provider=getScraperCatalog().find(row=>row.source==='taxbuddy')
// Deliberately minimal SYNTHETIC negative publisher document: brand present,
// no recruiting/LinkedIn delegation. It is not the credential-bearing current
// whole homepage. The current one-GET typed link audit independently observes
// the same branch; the whole homepage is omitted under capture policy.
const rejectionFixture='<html><title>TaxBuddy</title><main>TaxBuddy publisher with no active recruiting handoff.</main></html>'
async function exercise({body=rejectionFixture,signal=AbortSignal.timeout(20000)}={}){
 const saved=globalThis.fetch,reads=[];let jobs=null,error=null
 globalThis.fetch=async(url,init={})=>{
  const target=String(url);reads.push({url:target,method:init.method??'GET'});const status=target==='https://www.taxbuddy.com/'?200:404;return Object.defineProperty(new Response(status===200?body:'not found',{status,headers:{'content-type':'text/html'}}),'url',{value:target})
 }
 try{jobs=await createCatalogScraper(provider).run({signal})}catch(cause){error=cause}finally{globalThis.fetch=saved}
 return{jobs,error,reads}
}
test('TaxBuddy default unavailable native-delegation branch stops before generic recovery',async()=>{
 const r=await exercise();assert.equal(r.error?.code,'TAXBUDDY_COVERAGE_GAP');assert.equal(r.jobs,null);assert.equal(r.reads.length,1,'Unqualified native delegation must not escape to generic extraction: '+JSON.stringify(r.reads));assert.match(r.error.message,/no reviewed active recruiting delegation/)
})
test('TaxBuddy native-only routing retains all unknown counts and explicit cleanup holds',()=>{
 assert.equal(provider.authoritativeCurrentPublication,true);assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.verifiedIndiaJobCount,null);assert.equal(provider.sourceScopeComplete,false);assert.equal(provider.lifecycleCleanupAllowed,false)
})
test('TaxBuddy source unavailable error retains unqualified inventory without a zero',async()=>{
 const r=await exercise();assert.equal(r.error?.code,'TAXBUDDY_COVERAGE_GAP');assert.equal(r.error.inventoryEvidence.status,'coverage-gap');assert.equal(r.error.inventoryEvidence.reportedTotal,null);assert.equal(r.error.inventoryEvidence.indiaFacetCount,null);assert.equal(r.error.inventoryEvidence.listingComplete,false);assert.equal(r.error.lifecycleCleanupAllowed,false);assert.equal(r.reads.length,1)
})
test('unreviewed TaxBuddy employer identity stays held before generic reads',async()=>{
 const r=await exercise({body:'<html><title>Other publisher</title><main>Unreviewed identity.</main></html>'});assert.equal(r.error?.code,'TAXBUDDY_COVERAGE_GAP');assert.equal(r.jobs,null);assert.equal(r.reads.length,1)
})
test('TaxBuddy preaborted null caller preserves exact reason with no HTTP',async()=>{
 const c=new AbortController();c.abort(null);const r=await exercise({signal:c.signal});assert.strictEqual(r.error,null);assert.equal(r.jobs,null);assert.equal(r.reads.length,0)
})
