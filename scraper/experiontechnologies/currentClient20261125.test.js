import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {verifyExperionInventory,HOME,CAREERS,CLIENT} from './nativeContract.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261125/current-declared.json.gz',import.meta.url))))
const body=url=>{const p=fixture.packets.find(p=>p.url===url);assert.ok(p);const bytes=Buffer.from(p.bodyBase64,'base64');assert.equal(createHash('sha256').update(bytes).digest('hex'),p.bodySHA256);return bytes.toString()}
const verify=(home=body(HOME),listing=body(CAREERS),client=body(CLIENT))=>verifyExperionInventory(home,listing,client)
test('Experion current declared FAQ addition preserves the reviewed complete pagination client',()=>{
 const jobs=verify();assert.ok(jobs.length>0);assert.equal(new Set(jobs.map(j=>j.jobId)).size,jobs.length)
 assert.ok(jobs.every(j=>j.company==='Experion Technologies'&&j.country==='India'))
})
test('Experion current client still rejects added executable inventory behavior',()=>assert.throws(()=>verify(undefined,undefined,body(CLIENT)+'\nfetch("/unreviewed-jobs")'),/client contract changed/))
test('Experion current client requires its own active official declaration',()=>assert.throws(()=>verify(undefined,body(CAREERS).replace(CLIENT,'https://foreign.invalid/main.js')),/pagination client unavailable/))
for(const [label,old,current]of [['country','Hybrid, Kochi, Trivandrum','Hybrid, London, United Kingdom'],['identity','https://experionglobal.com/jobs/test-lead/','https://foreign.invalid/jobs/test-lead/']])test('Experion current client does not relax native '+label,()=>{
 const original=body(CAREERS);assert.ok(original.includes(old));assert.throws(()=>verify(undefined,original.replaceAll(old,current)))
})
