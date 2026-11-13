import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {corporateContract,FRAME_URL,nativePageContract} from './nativeContract.js'
const html=gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/corporate.gz',import.meta.url))).toString('utf8')
test('November 13 Byteridge stylesheet deployment preserves the visible official careers delegation',()=>{
 const value=corporateContract(html)
 assert.deepEqual(value.frames,[FRAME_URL]);assert.deepEqual(value.reasons,[])
})
test('November 13 Byteridge native public role keeps its coherent reviewed deployment and own employer/country schema',()=>{
 const page=gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/native-role.gz',import.meta.url))).toString('utf8')
 const proxy=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261113/native-proxy.gz',import.meta.url))))
 const result=nativePageContract(page,proxy.Result[0])
 assert.equal(result.posting.hiringOrganization.name,'Byteridge Software Private Limited')
 assert.deepEqual(result.countries,['India']);assert.equal(result.publicClientURLs.length,6)
 assert.equal(result.companyScopeUnqualified,true)
})
test('November 13 Byteridge delegation still refuses hidden careers and unknown stylesheet revisions',()=>{
 for(const changed of [html.replace('<iframe id="dynamic-iframe"','<iframe hidden id="dynamic-iframe"'),html.replace('ver=1794491878','ver=unknown')]){
  assert.notEqual(changed,html);assert.throws(()=>corporateContract(changed),/missing visible official careers iframe|unreviewed corporate stylesheet/)
 }
})
