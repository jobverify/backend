import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {readNativePage} from './native.js'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(readFileSync(new URL('./fixtures/native-india-001.json',import.meta.url)))
const json=x=>JSON.stringify(x).replaceAll('<','\\u003c')
const app={...fixture.app,pageName:'search-results'}
const model={eagerLoadRefineSearch:{status:200,totalHits:1,hits:0,data:{jobs:[],aggregations:[{field:'country',value:{India:1}}]}},siteConfig:{data:{siteSettings:{refineSearch:{enabledFacets:['country']}}}}}
const bootstrap=attrs=>'<script '+attrs+'>var phApp=phApp||'+json(app)+';phApp.ddo='+json(model)+';</script>'
const detail=attrs=>'<link rel="canonical" href="'+fixture.canonical+'"><script '+attrs+'>phApp.ddo='+json({jobDetail:{status:200,data:{job:fixture.job}}})+';</script><script type="application/ld+json">'+json(fixture.posting)+'</script>'
const payload=()=>({refineSearch:{status:200,totalHits:1,hits:1,data:{jobs:[fixture.listing],aggregations:[{field:'country',value:{India:1}}]}}})
const options=({bootstrapAttrs='',detailAttrs='',changeInventory=x=>x}={})=>({fetchText:async url=>url.includes('/search-results')?bootstrap(bootstrapAttrs):detail(detailAttrs),fetchJson:async()=>changeInventory(payload())})

for(const attrs of ['language="json"','language="vbscript"','language="text/javascript"','language=" javascript "','type="application/json" language="javascript"','type=" " language="javascript"']){
 test('IR001-01 inert '+attrs+' cannot authenticate detail DDO',async()=>{
  assert.equal(readNativePage(detail(attrs)).ddo,null)
  const jobs=await run(options({detailAttrs:attrs}));assert.equal(jobs.length,1);assert.equal(jobs[0].sourceDetailComplete,false);assert.equal(jobs[0].jobDescription,null);assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 })
 test('IR001-01 inert '+attrs+' cannot authenticate bootstrap',async()=>{await assert.rejects(run(options({bootstrapAttrs:attrs})),/ECOLAB|PHENOM/)})
}
for(const attrs of ['','language=""','language="javascript"','language="JAVASCRIPT"','language="javascript1.5"','language="ecmascript"','language="jscript"','language="livescript"','type="" language="json"','type="" language="vbscript"','type="text/javascript" language="vbscript"','type="application/javascript" language="json"','type=" text/javascript " language="json"'])test('IR001-01 executable classic '+(attrs||'default')+' retains exact native identity',async()=>{
 assert.equal(readNativePage(bootstrap(attrs)).app.refNum,'EIYEIEUS');assert.equal(readNativePage(detail(attrs)).ddo.jobDetail.data.job.jobId,fixture.job.jobId)
 const jobs=await run(options({bootstrapAttrs:attrs,detailAttrs:attrs}));assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(jobs[0].jobDescription,fixture.job.description);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
// The shared adapter's current HTML parser intentionally supports fewer MIME
// labels. Verify legacy MIME semantics here without expanding that contract.
for(const attrs of ['type="text/javascript1.2" language="json"','type="application/x-javascript" language="json"'])test('IR001-01 owned parser recognizes classic legacy MIME '+attrs,()=>{
 assert.equal(readNativePage(bootstrap(attrs)).app.refNum,'EIYEIEUS');assert.equal(readNativePage(detail(attrs)).ddo.jobDetail.data.job.jobId,fixture.job.jobId)
})

for(const [name,change]of [
 ['success false',r=>{r.refineSearch.success=false}],
 ['nonempty string error',r=>{r.refineSearch.error='Upstream timeout; retained typed partial page'}],
 ['object error',r=>{r.refineSearch.error={code:'TIMEOUT',message:'Retained partial page'}}],
 ['array errors',r=>{r.refineSearch.error=[{code:'TIMEOUT'}]}],
])test('IR001-02 '+name+' with retained real rows cannot authorize inventory cleanup',async()=>{
 await assert.rejects(run(options({changeInventory:r=>{change(r);return r}})),/ECOLAB_INCOMPLETE_SNAPSHOT/)
})
for(const [name,error]of [['absent',undefined],['null',null],['empty string',''],['whitespace string',' \t\n'],['empty object',{}],['empty array',[]]])test('IR001-02 explicit success control and '+name+' error retain valid inventory',async()=>{
 const jobs=await run(options({changeInventory:r=>{r.refineSearch.success=true;if(error!==undefined)r.refineSearch.error=error;return r}}))
 assert.equal(jobs[0].sourceDetailComplete,true);assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
