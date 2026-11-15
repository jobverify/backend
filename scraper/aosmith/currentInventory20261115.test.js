import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import {readCurrentAoSmithInitializer} from './currentInventory.js'
import {document as readDocument} from '../../scraper-support/shared/rmkNativePairHtml.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-native-20261115.json.gz',import.meta.url)))),search='https://jobs.aosmith.com/search/',html=Buffer.from(fixture.packets.find(packet=>packet.requestedURL===search).bodyBase64,'base64').toString('utf8'),datedHTML=Buffer.from(fixture.dated20261103.packets.find(packet=>packet.url===search).bodyBase64,'base64').toString('utf8')
const bootstrap='window.j2w = window.j2w || {}',doc=readDocument(html),bootstrapScripts=doc.nodes(node=>node.tag==='script'&&!node.attrs.src&&(node.raw||'').includes(bootstrap)),wholeBootstrap=bootstrapScripts.length===1?doc.outer(bootstrapScripts[0]):null,initializer=/<script\b[^>]*>[\s\S]*?j2w\.SearchResults\.init\([\s\S]*?<\/script>/g
assert.ok(wholeBootstrap);assert.equal(html.split(bootstrap).length,2)
test('current genuine own native same-window namespace bootstrap preserves sole published tile initializer',()=>{
 const result=readCurrentAoSmithInitializer(html)
 const assets=doc.nodes(node=>node.tag==='script'&&/\/platform\/js\/j2w\/min\/j2w\.searchResults\.min\.js(?:\?|$)/.test(node.attrs.src||''));assert.equal(assets.length,1)
 assert.equal(result.assetURL,new URL(assets[0].attrs.src,search).href);assert.equal(result.javascriptExecuted,false);assert.ok(result.initializer.source.includes('jobRecordsFound: parseInt("81")'))
})
test('dated actual own namespace var bootstrap remains qualified',()=>{assert.equal(readCurrentAoSmithInitializer(datedHTML).javascriptExecuted,false)})
test('current equivalent bootstrap whitespace is parsed without pinning incidental timestamps or bytes',()=>{assert.equal(readCurrentAoSmithInitializer(html.replace(bootstrap,'window . j2w = (window.j2w || { })')).javascriptExecuted,false)})
const mutations=[
 ['destructive namespace reset',html=>html.replace(bootstrap,'window.j2w = {}')],
 ['fallback to another namespace',html=>html.replace(bootstrap,'window.j2w = window.other || {}')],
 ['nonempty fallback containing SearchResults',html=>html.replace(bootstrap,'window.j2w = window.j2w || {SearchResults: {init(){}}}')],
 ['conditional same-window bootstrap',html=>html.replace(bootstrap,'if (false) '+bootstrap)],
 ['conditional-expression bootstrap',html=>html.replace(bootstrap,'false ? ('+bootstrap+') : 0')],
 ['dormant bootstrap function',html=>html.replace(bootstrap,'function dormant(){'+bootstrap+';}')],
 ['function-local bootstrap',html=>html.replace(bootstrap,'(function(){'+bootstrap+';})()')],
 ['computed fallback namespace property',html=>html.replace(bootstrap,'window["j2w"] = window["j2w"] || {}')],
 ['aliased global window root',html=>html.replace(wholeBootstrap,'<script>const window = {};'+wholeBootstrap.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,'')+'</script>')],
 ['separate global window shadow before native program',html=>'<script>let window = {};</script>'+html],
 ['separate global root reassignment',html=>'<script>window = {};</script>'+html],
 ['destructured namespace shadow',html=>'<script>const {j2w} = {};</script>'+html],
 ['namespace reassignment after fallback',html=>html+'<script>window.j2w = {};</script>'],
 ['actual SearchResults replacement',html=>html+'<script>j2w.SearchResults = {init(){}};</script>'],
 ['namespace aliased into another object',html=>html+'<script>const native = j2w; native.SearchResults = {};</script>'],
 ['SearchResults aliased into another variable',html=>html+'<script>const native = j2w.SearchResults;</script>'],
 ['SearchResults deleted after fallback',html=>html+'<script>delete j2w.SearchResults;</script>'],
 ['namespace passed into an unknown call',html=>html+'<script>unknown(j2w);</script>'],
 ['ready function globally replaced',html=>'<script>function $(callback){}</script>'+html],
 ['second native tile initializer',html=>html+'<script>$(function(){j2w.SearchResults.init({});});</script>']
]
for(const [name,change]of mutations)test('holds '+name+' in genuine current own page',()=>{const mutated=change(html);assert.notEqual(mutated,html);assert.throws(()=>readCurrentAoSmithInitializer(mutated),error=>error.code==='AOSMITH_NATIVE_CONTRACT_CHANGED')})
test('retained current raw bootstrap program and source body stay separate from dated fixture',()=>{assert.equal(fixture.packets.length,4);assert.equal(fixture.dated20261103.packets.length,86);assert.ok(!datedHTML.includes(bootstrap));assert.ok(html.includes(bootstrap));assert.ok(initializer.test(html))})
