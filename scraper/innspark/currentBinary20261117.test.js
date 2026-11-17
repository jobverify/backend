import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readNativeCmsChunk} from './currentBinary20261117.js'
const originals=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))).originals,bytes=Buffer.from(originals.find(p=>p.requestedURL.includes('-chunk-')).bodyBase64,'base64')
test('complete original Framer chunk decodes all4typed records and every original field/byte',()=>{
 const rows=readNativeCmsChunk(bytes);assert.equal(rows.length,4);assert.equal(rows[0].offset,4);assert.equal(rows.at(-1).offset+rows.at(-1).length,bytes.length)
 assert.deepEqual(rows.map(r=>r.fields.id.value),['kPJSJ5vUt','DBlr6RmSj','LkWireW2_','iqBzqWOV0']);assert.equal(rows[0].fields.PXYVfHs7p.value,'Mumbai, India');assert.equal(rows[0].fields.jJ2myMsNq.value,'Bussiness Analyst');assert.equal(rows[2].fields.jJ2myMsNq.value,'iOS Developer');assert.equal(rows[2].fields.tSjhve7ND.value,'2025-05-01T00:00:00.000Z');assert.ok(rows.every(r=>r.fields.T7avTTsmp.type===11&&r.fields.ZVE2y6Xas.type===11))
})
test('truncated and trailing original chunks cannot become zero or short inventories',()=>{
 for(const length of [0,1,3,4,5,6,24,55,bytes.length-1])assert.throws(()=>readNativeCmsChunk(bytes.subarray(0,length)))
 assert.throws(()=>readNativeCmsChunk(Buffer.concat([bytes,Buffer.from([0])])),/trailing/)
})
test('duplicate native IDs, unknown typed values and count overflow stay held',()=>{
 const rows=readNativeCmsChunk(bytes),duplicate=Buffer.from(bytes);duplicate.write(rows[0].fields.id.value,rows[1].offset+13,'utf8');assert.throws(()=>readNativeCmsChunk(duplicate),/duplicate/)
 const unknown=Buffer.from(bytes);unknown[rows[0].offset+8]=255;assert.throws(()=>readNativeCmsChunk(unknown),/unknown native CMS/)
 const excessive=Buffer.from(bytes);excessive.writeUInt32BE(41);assert.throws(()=>readNativeCmsChunk(excessive),/ceiling/)
})
