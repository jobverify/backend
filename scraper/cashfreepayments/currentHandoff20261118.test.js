import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/handoff-20261118.json.gz',import.meta.url))))
const replay=change=>({fetchPage:async url=>{let html=url.includes('cashfree.com/careers')?fixture.careers:fixture.packets.find(p=>p.url===url)?.body;assert.equal(typeof html,'string',url);html=change?.(url,html)??html;return{status:200,url,html}}})
test('current Cashfree authored shadow-root Kula delegation retains 31 full native India roles and holds stale corporate scope',async()=>{
 const jobs=await run(replay());assert.equal(jobs.length,31);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceNativeAccountId===1291&&j.sourceDetailComplete));assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 const audit=jobs[0].nativeCollectionEvidence;assert.equal(audit.corporateDeclaredRoleIds.length,34);assert.equal(audit.corporateNativeMembershipMatches,false)
})
for(const [label,mutate] of [
 ['missing visible host',s=>s.replace('id="cfj"','hidden id="cfj"')],
 ['foreign tenant',s=>s.replace("https://careers.kula.ai/cashfree/","https://careers.kula.ai/other/")],
 ['unreviewed executable',s=>s.replace('host.attachShadow({ mode:', 'host.attachShadow({ unreviewed: true, mode:')],
 ['wrong canonical',s=>s.replace('href="https://www.cashfree.com/careers" rel="canonical"','href="https://foreign.example/careers" rel="canonical"')],
])test('current Cashfree delegation rejects '+label,()=>assert.rejects(run(replay((url,html)=>url.includes('cashfree.com/careers')?mutate(html):html)),/identity|handoff|delegation|contract/))
