import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {selectReviewedCandidateClient} from '../darwinbox/reviewedCandidateClient.js'
import {run} from './script.js'
import {createCatalogScraper,getScraperCatalog} from '../../scraper-support/providers/index.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-client-20261128.json.gz',import.meta.url))))
const review=JSON.parse(readFileSync(new URL('./reviewedNativeScope.json',import.meta.url)))
const origin='https://perfios.darwinbox.in',current=origin+'/ms/candidatev2/main.f5e76c3f4b395062.js'
const text=row=>Buffer.from(row.bodyBase64,'base64').toString('utf8')
const sha=value=>createHash('sha256').update(value).digest('hex')
const boundary=Object.assign(new Error('Offline boundary after complete reviewed current client'),{code:'PERFIOS_OFFLINE_CLIENT_BOUNDARY'})
async function replay(change=()=>{}){
  const reads=[]
  return {reads,promise:run({fetchImpl:async(url,init)=>{
    const index=reads.length;reads.push(url)
    assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
    if(index===fixture.packets.length){assert.equal(url,origin+'/ms/candidatev2/main');throw boundary}
    const original=fixture.packets[index]
    assert.ok(original,'No unacquired public route is available')
    assert.equal(url,original.url);assert.equal(sha(Buffer.from(original.bodyBase64,'base64')),original.sha256)
    const packet={...structuredClone(original),body:text(original)}
    change(packet,index)
    const headers=new Headers(packet.headers)
    for(const name of packet.setCookieNames)headers.append('set-cookie',name+'=controlled-anonymous-fixture; Path=/')
    return Object.defineProperty(new Response(packet.body,{status:packet.status,headers}),'url',{value:packet.finalURL})
  }})}
}

test('seven genuine whole public prefix/client bodies retain exact hashes without credential values or inventory claims',()=>{
  assert.equal(fixture.validCurrentCheck,false);assert.equal(fixture.packets.length,7)
  for(const row of fixture.packets){assert.equal(sha(Buffer.from(row.bodyBase64,'base64')),row.sha256);assert.equal(row.headers['set-cookie'],undefined)}
  assert.match(text(fixture.packets[5]),/main\.f5e76c3f4b395062\.js/)
})

test('the literal Perfios current declaration selects the exact whole client and existing read-only POST contract',()=>{
  const release=selectReviewedCandidateClient({source:'perfios',origin,review},[current])
  assert.ok(release);assert.equal(release.clientUrl,current)
  assert.equal(release.clientSha256,fixture.packets[6].sha256)
  assert.equal(release.apiContract,'candidate-v2-post-alljobs-v1')
  assert.equal(release.rendererSha256,review.rendererSha256)
})

test('the real current prefix reaches the unacquired API boundary only after complete current client verification',async()=>{
  const result=await replay()
  await assert.rejects(result.promise,error=>error===boundary)
  assert.equal(result.reads.length,8);assert.equal(result.reads[6],current)
})

test('a changed whole current client remains terminal before the next anonymous session or API read',async()=>{
  const result=await replay((packet,index)=>{if(index===6)packet.body+='\nvoid 0;'})
  await assert.rejects(result.promise,/reviewed public API client changed/)
  assert.equal(result.reads.length,7)
})

test('the genuine current client cannot be supplied with another response authority',async()=>{
  const result=await replay((packet,index)=>{if(index===6)packet.finalURL='https://foreign.invalid/current.js'})
  await assert.rejects(result.promise,/HTTP response URL changed/)
  assert.equal(result.reads.length,7)
})

test('an unreviewed current client filename remains held before reading its program',async()=>{
  const result=await replay((packet,index)=>{if(index===5)packet.body=packet.body.replaceAll('main.f5e76c3f4b395062.js','main.ffffffffffffffff.js')})
  await assert.rejects(result.promise,/active candidate client changed/)
  assert.equal(result.reads.length,6)
})

test('the original complete Perfios release remains unchanged and accepted',()=>{
  const release=selectReviewedCandidateClient({source:'perfios',origin,review},[review.clientUrl])
  assert.equal(release,review)
  assert.equal(release.clientSha256,'6f5467fb999e4b8e32b93895fd9719614f682d32c414ae96676889ccbbbf3e8a')
})

test('another employer cannot select the Perfios source-local current client',()=>{
  assert.equal(selectReviewedCandidateClient({source:'another-employer',origin:'https://foreign.invalid',review:{...review,previousReleases:[]}},['https://foreign.invalid/ms/candidatev2/main.f5e76c3f4b395062.js']),undefined)
})

test('the complete genuine registered eleven-response replay reaches the native denial after the repaired client and cannot authorize cleanup',async t=>{
  const captured=fixture.registeredCurrent,reads=[]
  assert.equal(captured.packets.length,11)
  assert.equal(captured.outcome.captureFinalization.drained,true)
  assert.equal(captured.outcome.captureFinalization.pendingAtFreeze,0)
  t.mock.method(globalThis,'fetch',async(url,init)=>{
    const row=captured.packets[reads.length]
    assert.ok(row,'Only the eleven acquired current responses may be replayed')
    reads.push(String(url));assert.equal(String(url),row.url)
    assert.equal(init.method,'GET');assert.equal(init.redirect,'manual')
    const bytes=Buffer.from(row.bodyBase64,'base64');assert.equal(sha(bytes),row.sha256)
    const headers=new Headers(row.headers)
    for(const name of row.setCookieNames)headers.append('set-cookie',name+'=controlled-current-fixture; Path=/')
    return Object.defineProperty(new Response(bytes,{status:row.status,headers}),'url',{value:row.finalURL})
  })
  const provider=getScraperCatalog().find(row=>row.source==='perfios')
  await assert.rejects(createCatalogScraper(provider).run(),error=>error.httpStatus===403&&error.failureKind==='blocked_or_access_denied'&&error.abortRetries===true&&error.sourceScopeComplete===false&&error.lifecycleCleanupAllowed===false)
  assert.equal(reads.length,11)
  assert.equal(reads.filter(url=>url===current).length,1)
  assert.equal(reads.filter(url=>url===origin+'/ms/candidateapi/getCompanyConfig?is_preview=false&companyId=main').length,2)
})
