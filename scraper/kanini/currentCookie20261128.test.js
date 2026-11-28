import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFileSync} from 'node:fs'
import test from 'node:test'
import {gunzipSync} from 'node:zlib'
import {corporate} from './currentModels20261117.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-cookie-20261128.json.gz',import.meta.url))))
const profile=JSON.parse(readFileSync(new URL('./currentProfile20261117.json',import.meta.url),'utf8'))
const home=fixture.corporate.body
const publicPath='https://kanini.com/wp-content/plugins/cookie-law-info/legacy/public/js/cookie-law-info-public.js'
const ccpaPath='https://kanini.com/wp-content/plugins/cookie-law-info/legacy/admin/modules/ccpa/assets/js/cookie-law-info-ccpa.js'
const read=body=>corporate(body,profile.corporate[0],profile.primaryTitle)
const change=(body,before,after)=>{
 assert.ok(body.includes(before),'mutation must change the genuine current declaration')
 assert.notEqual(before,after)
 return body.replace(before,after)
}

test('genuine KANINI cookie-query deployment retains the complete existing corporate program graph',()=>{
 assert.equal(createHash('sha256').update(home).digest('hex'),fixture.corporate.sha256)
 assert.equal(fixture.corporate.sha256,'e7abfb06d5a4a125a76e36ac857a909daab36ef4081ac300477748e7757771a6')
 const doc=read(home)
 assert.ok(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/open-positions/').length>0)
 assert.ok(doc.nodes(n=>n.tag==='a'&&n.attrs.href==='/careers/').length>0)
})

test('both exact script query variants serve identical complete current bodies',()=>{
 assert.equal(fixture.cookieScripts.length,4)
 for(const row of fixture.cookieScripts){
  assert.equal(row.status,200)
  assert.equal(row.requestedUrl,row.url)
  assert.equal(createHash('sha256').update(row.body).digest('hex'),row.sha256)
 }
 for(const index of [0,2]){
  assert.equal(fixture.cookieScripts[index].body,fixture.cookieScripts[index+1].body)
  assert.ok(fixture.cookieScripts[index].url.endsWith('?ver=3.5.9'))
  assert.ok(fixture.cookieScripts[index+1].url.endsWith('?ver=3.5.10'))
 }
})

test('the previously reviewed complete cookie declaration pair remains valid',()=>{
 read(home.replace(publicPath+'?ver=3.5.10',publicPath+'?ver=3.5.9').replace(ccpaPath+'?ver=3.5.10',ccpaPath+'?ver=3.5.9'))
})

for(const [name,edit] of [
 ['only one revised declaration',body=>change(body,publicPath+'?ver=3.5.10',publicPath+'?ver=3.5.9')],
 ['only the other revised declaration',body=>change(body,ccpaPath+'?ver=3.5.10',ccpaPath+'?ver=3.5.9')],
 ['an unknown paired revision',body=>body.replaceAll('?ver=3.5.10','?ver=3.5.11')],
 ['a foreign plugin origin',body=>change(body,publicPath,'https://other.invalid/cookie-law-info-public.js')],
 ['an unreviewed plugin path',body=>change(body,ccpaPath,ccpaPath.replace('cookie-law-info-ccpa.js','other.js'))],
 ['additional active declaration attributes',body=>change(body,publicPath+'?ver=3.5.10"',publicPath+'?ver=3.5.10" defer')],
 ['an additional active script',body=>change(body,'</body>','<script>window.unreviewedHiringRule=true</script></body>')],
 ['changed current inline program code',body=>change(body,'id="google_gtagjs-js-consent-mode-data-layer">','id="google_gtagjs-js-consent-mode-data-layer">window.unreviewedHiringRule=true;')],
 ['cookie declarations exchanged between their fixed positions',body=>body.replace(publicPath+'?ver=3.5.10','<COOKIE-SWAP>').replace(ccpaPath+'?ver=3.5.10',publicPath+'?ver=3.5.10').replace('<COOKIE-SWAP>',ccpaPath+'?ver=3.5.10')],
])test('current KANINI cookie tuple rejects '+name,()=>{
 const altered=edit(home)
 assert.notEqual(altered,home,'mutation must reach the genuine current page')
 assert.throws(()=>read(altered),error=>error.failureKind==='parser_or_contract_error')
})
