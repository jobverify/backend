import test from 'node:test'
import assert from 'node:assert/strict'
import {createBitwiseSolutionsScraper} from './script.js'
import {networkFences,originalPacket,replay} from './fixtures/currentReviewedReplay20261121.js'

async function current(t,mutate){
 const restore=networkFences();t.after(restore);let edits=0
 const transport=replay((value,context)=>{if(context.original.requestedUrl.endsWith('/18dzz-tmy.l2q.js')){const changed=mutate(value.body);assert.notEqual(changed,value.body);value.body=changed;edits++}return value})
 let jobs,error;try{jobs=await createBitwiseSolutionsScraper().run({fetchImpl:transport.fetchImpl,requestIntervalMs:0,now:()=>originalPacket.completedAt})}catch(caught){if(caught.code==='ERR_ASSERTION'||/unexpected live network|allowlist/i.test(caught.message))throw caught;error=caught}
 assert.ok(edits>0);return{jobs,error,transport}
}
test('late native rows state overwrite cannot certify returned public cards',async t=>{
 const result=await current(t,source=>{assert.ok(source.includes('c(l),x(!1)'));return source.replace('c(l),x(!1)','c(l),c([]),x(!1)')})
 assert.ok(result.error?.nativeContradiction,'State connected to the cards must not be emptied after consuming the native jobs')
})
test('actual global fetch replacement invalidates public programme authority',async t=>{
 const result=await current(t,source=>{assert.ok(source.includes('"use strict";'));return source.replace('"use strict";','"use strict";globalThis.fetch=()=>Promise.resolve({json:()=>({jobs:[]})});')})
 assert.ok(result.error?.nativeContradiction);assert.equal(result.transport.calls.length,4)
})
test('coherent programme identifier renaming and an unrelated comment preserve native partials',async t=>{
 const result=await current(t,source=>source.replace(/\bl\b/g,'nativeReact').replace('"use strict";','"use strict";/* current publisher comment */'))
 assert.equal(result.error,undefined);assert.deepEqual(result.jobs.map(job=>job.nativePublicJobId).sort(),['6061','6065','6085']);assert.equal(result.transport.calls.length,24)
})
test('inert native state consumer cannot qualify the returned role cards',async t=>{
 const result=await current(t,source=>{assert.ok(source.includes('c(l),x(!1)'));return source.replace('c(l),x(!1)','false&&c(l),x(!1)')})
 assert.ok(result.error?.nativeContradiction,'The native jobs must reach the rows state on the successful request branch')
})
test('inert returned map cannot qualify public role card handoffs',async t=>{
 const result=await current(t,source=>{assert.ok(source.includes('children:S.map(e=>'));return source.replace('children:S.map(e=>','children:false&&S.map(e=>')})
 assert.ok(result.error?.nativeContradiction,'The row map must be a live returned children consumer')
})
