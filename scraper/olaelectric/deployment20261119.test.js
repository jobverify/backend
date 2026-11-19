import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {ORIGIN,nativeSurfaceContract,surfaceAssets,assetContract,corporateContract,sha256} from '../ola/nativeContract.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261119.json.gz',import.meta.url))))
const responses=new Map(fixture.responses.map(row=>[row.url,row]))
const dashboard=responses.get(ORIGIN+'/dashboardv2').text

test('Ola Electric current coherent TurboHire tuple pins all ten current public client bodies',()=>{
 assert.deepEqual(nativeSurfaceContract(dashboard).nativeClientURLs,[
  ORIGIN+'/runtime-main.05e45417c9cf8a8068a9.js',
  ORIGIN+'/18.ad1f07674b986c5052f1.chunk.js',
  ORIGIN+'/30.86c6a5b9e9f7200f24dd.chunk.js',
  ORIGIN+'/main.0fbeb7233f472c0db0a8.chunk.js',
 ])
 const selected=surfaceAssets('olaelectric',dashboard).filter(row=>row.kind==='js')
 assert.equal(selected.length,10)
 for(const asset of selected){
  const original=responses.get(asset.url)
  assert.ok(original,'every declared and lazy selected client was captured')
  assert.equal(original.status,200)
  assert.equal(sha256(original.text),original.sha256)
  assert.doesNotThrow(()=>assetContract(asset.url,original.text))
  assert.throws(()=>assetContract(asset.url,original.text+';unreviewedEmployerOverride()'),/asset bytes changed/)
 }
})

test('Ola Electric current native declaration rejects inert, extra and mixed-deployment clients',()=>{
 for(const html of [
  dashboard.replace('src="/main.0fbeb7233f472c0db0a8.chunk.js"','type="application/json" src="/main.0fbeb7233f472c0db0a8.chunk.js"'),
  dashboard.replace('src="/main.0fbeb7233f472c0db0a8.chunk.js"','nomodule src="/main.0fbeb7233f472c0db0a8.chunk.js"'),
  dashboard.replace('</body>','<script src="/foreign-company.js"></script></body>'),
  dashboard.replace('runtime-main.05e45417c9cf8a8068a9.js','runtime-main.8204eede4e126b73a90b.js'),
 ])assert.throws(()=>nativeSurfaceContract(html),/executable client/)
})

test('Ola Electric current corporate handoff still holds shared-tenant employer and company scope',()=>{
 const corporate=responses.get('https://www.olaelectric.com/careers')
 const result=corporateContract(corporate.text,'olaelectric')
 assert.equal(result.delegationVisible,true)
 assert.ok(result.reasons.includes('shared-tenant-brand-and-legal-employer-scope-unresolved'))
 assert.ok(result.reasons.includes('corporate-dynamic-hiring-paths-not-exhaustively-bound'))
})
