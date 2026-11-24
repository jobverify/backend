import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as native from './native.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-inputs/current-india-20261120.json.gz',import.meta.url))))
const html=Buffer.from(fixture.packet.bodyBase64,'base64').toString()
const parse=(body=html,row=fixture.row)=>native.qualifyCurrentIndiaDetail(native.activeDocument(body),row)
test('Dassault current native India template retains its full authored criteria and own application',()=>{
 const job=parse()
 assert.equal(job.jobId,'16009');assert.equal(job.requisitionId,'2026-16009')
 assert.equal(job.country,'India');assert.equal(job.city,'Nagpur')
 assert.equal(job.postingDate,'2026-11-19')
 assert.ok(job.jobDescription.includes('lettre de motivation'),'full candidate criteria retained')
 assert.ok(job.jobDescription.includes('moins de deux ans'),'native visa graduation condition retained')
 assert.equal(job.nativeApplication.action,fixture.row.sourceUrl)
 assert.equal(job.nativeApplication.method,'post')
 assert.equal(job.applicationVisited,false)
 assert.equal(job.sourceScopeComplete,false);assert.equal(job.lifecycleCleanupAllowed,false)
})
for(const [name,change] of [
 ['country contradiction',s=>s.replace('International, Inde, Nagpur','International, France, Nagpur')],
 ['hidden country',s=>s.replace('>International, Inde, Nagpur<',' hidden>International, Inde, Nagpur<')],
 ['wrong requisition',s=>s.replaceAll('2026-16009','2026-99999')],
 ['missing full candidate criteria',s=>s.replace('Profil requis','Other field')],
 ['employer contradiction',s=>s.replaceAll('Dassault Aviation','Another employer')],
 ['unrelated application',s=>s.replace('action="./emploi-vie-ingenieur-de-production-nagpur-inde-f-h_16009.aspx"','action="https://unrelated.example/apply"')],
])test('Dassault current India role holds '+name,()=>{
 const changed=change(html);assert.ok(changed!==html,'current original was mutated')
 assert.throws(()=>parse(changed),/Native current India/)
})
