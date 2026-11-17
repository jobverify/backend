import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {nativeFlightRows} from './currentFlight20261117.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),first=fixture.responses.find(r=>r.requestedURL==='https://careers.kula.ai/sattva/59098-senior-consultant-foundations-advisory'),frame=wire=>'<script>self.__next_f.push('+JSON.stringify([1,wire])+')</script>'
test('Sattva actual current detail retains both empty X/C native stream controls while keeping every native literal data row',()=>{const rows=nativeFlightRows(Buffer.from(first.bodyBase64,'base64').toString());assert.equal(rows.length,50);assert.deepEqual(rows.filter(r=>r.id==='b').map(r=>r.raw),['X','C']);assert.ok(rows.some(r=>r.kind==='text'&&r.value.includes('BYOD')))})
test('Sattva typed control pairs reject duplicate data, double open/close, nonempty controls and mixed data-stream collisions',()=>{
 for(const wire of ['b:X\nb:X\nb:C\n','b:X\nb:C\nb:C\n','b:C\n','b:X\n','b:Xpayload\nb:C\n','b:X\nb:Cpayload\n','b:X\nb:T1,x\nb:C\n','b:{}\nb:X\nb:C\n','b:{}\nb:{}\n'])assert.throws(()=>nativeFlightRows(frame(wire)),e=>e.failureKind==='parser_or_contract_error',wire)
})
