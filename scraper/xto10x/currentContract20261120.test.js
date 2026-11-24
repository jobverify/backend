import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {verifyCorporate} from './native.js'
const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-contract-20261119.json.gz',import.meta.url))))
const html=Buffer.from(fixture.packets[0].bodyBase64,'base64').toString()
test('xto10x current generic Careers email and aboutwall component do not block independently qualified native roles',()=>{
 const proof=verifyCorporate(html,{about:true})
 assert.equal(proof.careersDestination,'mailto:growth-team@xto10x.com')
 assert.equal(proof.kind,'generic-email-invitation')
 assert.equal(proof.specificJob,false)
})
test('xto10x changed generic corporate evidence cannot establish unrelated employer or recruiting destination',()=>{
 for(const changed of [html.replaceAll('xto10x Technologies','Unrelated Technologies'),html.replaceAll('mailto:growth-team@xto10x.com','mailto:unknown@example.com'),html.replaceAll('"email":"growth-team@xto10x.com"','"email":"unrelated@example.com"')]){
  assert.ok(changed!==html,'current original was mutated')
  assert.throws(()=>verifyCorporate(changed,{about:true}))
 }
})
