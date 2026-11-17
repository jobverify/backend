import assert from 'node:assert/strict'
import test,{mock} from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence,sourceLifecycleCleanupForbidden} from '../../scraper-support/utils/inventoryEvidence.js'
import {readSourceObservationEvidence} from '../../scraper-support/utils/sourceObservationEvidence.js'
let wire=async()=>{throw Error('Uncaptured network disabled')};mock.method(globalThis,'fetch',(...args)=>wire(...args))
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),source=await import('./script.js')
const replay=change=>{let i=0;return{reads:()=>i,fetchImpl:async(url,init)=>{const p=structuredClone(fixture.originals[i++%fixture.originals.length]);assert.equal(url,p.requestedURL);if(init.redirect!==undefined)assert.equal(init.redirect,'manual');change?.(p,i);const r=new Response(Buffer.from(p.bodyBase64,'base64'),{status:p.status,headers:p.headers});Object.defineProperty(r,'url',{value:p.finalURL});return r}}}
test('PropTiger current full native openings model and general intake close without company-zero or preference-to-job promotion',async()=>{
 const io=replay();wire=io.fetchImpl;const jobs=await source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),e=readInventoryEvidence(jobs),a=jobs.nativeCollectionEvidence,o=readSourceObservationEvidence(jobs,'proptiger')
 assert.deepEqual(jobs,[]);assert.equal(io.reads(),28);assert.equal(e.status,'discovery-only');assert.equal(e.reportedTotal,null);assert.equal(e.indiaFacetCount,null);assert.equal(sourceLifecycleCleanupForbidden(jobs),true);assert.equal(o.observedRecordCount,1);assert.equal(o.observedVacancyCount,0);assert.equal(o.recordKind,'hiring-signals');assert.equal(a.fullNativeClosingEqual,true);assert.deepEqual(a.nativeOpenRoles.props.openings,[]);assert.equal(a.records[0].country,null);assert.equal(a.records[0].recordKind,'general-intake');assert.equal(a.nativeOpenRoles.props.departments.length,9);assert.equal(a.nativeOpenRoles.props.locations.length,10)
})
test('nonempty native openings, form preference conflicts and changed submission contracts remain unqualified',async()=>{
 for(const [from,to]of [['\\"openings\\":[]','\\"openings\\":[{\\"id\\":\\"unreviewed-new-native-row\\"}]'],['value="Administration"','value="Other Department"'],['action="/api/careers?type=right-opportunity"','action="/api/careers?type=application"']]){const io=replay((p,i)=>{if(i===1){const before=Buffer.from(p.bodyBase64,'base64').toString(),after=before.replace(from,to);assert.notEqual(before,after,'mutation must bind actual native source');p.bodyBase64=Buffer.from(after).toString('base64')}});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}));assert.equal(io.reads(),1)}
})
test('full raw closing page and full native programme changes are retained as holds',async()=>{
 for(const at of [15,28]){const io=replay((p,i)=>{if(i===at)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+(at===15?'<!-- actual full entity mutation -->':'// reviewed programme mutation')).toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/closing|programme/);assert.equal(io.reads(),28)}
})
test('new or missing native executable declarations cannot be silently omitted from the cohort',async()=>{
 const io=replay((p,i)=>{if(i===1)p.bodyBase64=Buffer.from(Buffer.from(p.bodyBase64,'base64').toString()+'<script src="/new-native.js"></script>').toString('base64')});await assert.rejects(source.run({fetchImpl:io.fetchImpl,requestIntervalMs:0}),/programme cohort/);assert.equal(io.reads(),1)
})
test('final synchronous metadata attachment retains caller and local deadline ownership',async()=>{
 for(const cancel of [false,true]){const caller=new AbortController(),reason=Object.freeze({owner:'proptiger-final'}),io=replay(),define=Object.defineProperty,clock=performance.now.bind(performance);let offset=0;const clockMock=mock.method(performance,'now',()=>clock()+offset),defineMock=mock.method(Object,'defineProperty',(object,key,descriptor)=>{const result=define(object,key,descriptor);if(Array.isArray(object)&&key==='nativeCollectionEvidence'&&descriptor.value?.acquisition){if(cancel)caller.abort(reason);else offset=5000}return result});try{await assert.rejects(source.run({signal:caller.signal,sourceTimeoutMs:2000,fetchImpl:io.fetchImpl,requestIntervalMs:0}),error=>cancel?error===reason:error.name==='TimeoutError');assert.equal(io.reads(),28)}finally{defineMock.mock.restore();clockMock.mock.restore()}}
})
