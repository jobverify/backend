import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import test from 'node:test'
import {ORIGIN,nativeSurfaceContract,surfaceAssets,assetContract,corporateContract,sha256} from './nativeContract.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/deployment-20261121.json.gz',import.meta.url))))
const dashboard=fixture.responses.find(packet=>packet.kind==='dashboard').body
const runtime=fixture.responses.find(packet=>packet.requestedURL.includes('/runtime-main.'))
const roleChunk=fixture.responses.find(packet=>packet.kind==='declared-role-chunk40')
const current=[runtime.requestedURL,ORIGIN+'/18.ad1f07674b986c5052f1.chunk.js',
 ORIGIN+'/30.86c6a5b9e9f7200f24dd.chunk.js',ORIGIN+'/main.0fbeb7233f472c0db0a8.chunk.js']
for(const packet of fixture.responses){
 assert.equal(packet.bodyOriginalUnmodified,true)
 assert.equal(sha256(packet.body),packet.bodySHA256)
}

test('Ola admits the actual current unfiltered shell and its coherent four-script native client',()=>{
 assert.deepEqual(nativeSurfaceContract(dashboard).nativeClientURLs,current)
})

test('Ola selects the reviewed original current runtime and role chunk with every other selected dependency unchanged',()=>{
 const selected=surfaceAssets('ola',dashboard).filter(asset=>asset.kind==='js')
 const expected=fixture.previouslyReviewedProfile.assetURLs.map(url=>url.includes('/runtime-main.')?runtime.requestedURL:
  /\/40\./.test(url)?roleChunk.requestedURL:url)
 assert.equal(selected.length,10)
 assert.deepEqual(selected.map(asset=>asset.url).sort(),expected.sort())
 for(const packet of [runtime,roleChunk])assert.doesNotThrow(()=>assetContract(packet.requestedURL,packet.body))
})

test('Ola current corporate delegation leaves its shared-tenant brand and company-wide hiring scope held',()=>{
 const corporate=fixture.responses.find(packet=>packet.kind==='corporate')
 const result=corporateContract(corporate.body,'ola')
 assert.equal(result.delegationVisible,true)
 assert.ok(result.reasons.includes('shared-tenant-brand-and-legal-employer-scope-unresolved'))
 assert.ok(result.reasons.includes('corporate-dynamic-hiring-paths-not-exhaustively-bound'))
})

for(const[name,change]of[
 ['unknown runtime',html=>html.replace('runtime-main.ab093536bfff1b8a581e.js','runtime-main.ffffffffffffffffffff.js')],
 ['mixed old main and current runtime',html=>html.replace('main.0fbeb7233f472c0db0a8.chunk.js','main.5f065d4faaf108848aaa.chunk.js')],
 ['unreviewed executable',html=>html.replace('</body>','<script src="/unreviewed.js"></script></body>')],
 ['inert runtime declaration',html=>html.replace('src="/runtime-main.ab093536bfff1b8a581e.js"','type="text/plain" src="/runtime-main.ab093536bfff1b8a581e.js"')],
 ['changed native inline configuration',html=>html.replace('$GOOGLE_LD','{"jobLocation":"India"}')],
])test('Ola current deployment holds '+name,()=>{
 const changed=change(dashboard)
 assert.notEqual(changed,dashboard,'The negative control must change actual original bytes')
 assert.throws(()=>nativeSurfaceContract(changed),/native|executable|configuration/)
})

for(const packet of [runtime,roleChunk])test('Ola holds changed original asset bytes '+new URL(packet.requestedURL).pathname,()=>{
 assert.throws(()=>assetContract(packet.requestedURL,packet.body+'\nwindow.otherHiringSource="/unknown";'),/asset bytes changed/)
})
