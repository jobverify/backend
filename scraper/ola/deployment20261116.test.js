import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {ORIGIN,nativeSurfaceContract,surfaceAssets,assetContract,corporateContract,sha256} from './nativeContract.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/deployment-20261116.json.gz',import.meta.url))))
const responses=new Map(capture.responses.map(row=>[row.url,row]))
const dashboard=responses.get(ORIGIN+'/dashboardv2').body

test('Ola accepts the corporate-delegated November 16 public client and verifies every selected original asset',()=>{
 const expected=[
  ORIGIN+'/runtime-main.8204eede4e126b73a90b.js',
  ORIGIN+'/18.ad1f07674b986c5052f1.chunk.js',
  ORIGIN+'/30.86c6a5b9e9f7200f24dd.chunk.js',
  ORIGIN+'/main.5f065d4faaf108848aaa.chunk.js',
 ]
 assert.deepEqual(nativeSurfaceContract(dashboard).nativeClientURLs,expected)
 const selected=surfaceAssets('ola',dashboard).filter(row=>row.kind==='js')
 assert.equal(selected.length,10)
 for(const asset of selected){
  const original=responses.get(asset.url)
  assert.ok(original,'Every selected asset has a current original public response')
  assert.equal(original.status,200)
  assert.equal(sha256(original.body),original.sha256)
  assert.doesNotThrow(()=>assetContract(asset.url,original.body))
  assert.throws(()=>assetContract(asset.url,original.body+'\nwindow.otherHiringSource="/unreviewed";'),/asset bytes changed/)
 }
})

test('Ola current shell still rejects an undeclared executable and altered literal fingerprint',()=>{
 assert.throws(()=>nativeSurfaceContract(dashboard.replace('</body>','<script src="/unknown.js"></script></body>')),/executable client/)
 assert.throws(()=>nativeSurfaceContract(dashboard.replace('runtime-main.8204eede4e126b73a90b.js','runtime-main.ffffffffffffffffffff.js')),/executable client/)
})

test('reviewing the current Ola deployment does not qualify shared-tenant employer scope or corporate hiring completeness',()=>{
 const corporate=responses.get('https://www.olacabs.com/careers')
 const result=corporateContract(corporate.body,'ola')
 assert.equal(result.delegationVisible,true)
 assert.ok(result.reasons.includes('shared-tenant-brand-and-legal-employer-scope-unresolved'))
 assert.ok(result.reasons.includes('corporate-dynamic-hiring-paths-not-exhaustively-bound'))
})
