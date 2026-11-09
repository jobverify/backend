import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {qualifyDocument} from './nativeClientProfile20261107.js'
const source=gunzipSync(fs.readFileSync(new URL('./fixtures/fresh-context-document-20261107.html.gz',import.meta.url))).toString()
const context=source.match(/<script>window\.__CF\$cv\$params=[\s\S]*?<\/script>/)[0]
test('actual fresh context volatility does not become native-client equivalence',()=>assert.doesNotThrow(()=>qualifyDocument(readNativeDocument(source),'embed')))
for(const [name,change]of [
 ['changed effect',s=>s.replace('document.head.appendChild(s);','document.body.appendChild(s);')],
 ['changed path',s=>s.replace('/precursor/main.js','/other/main.js')],
 ['additional executable statement',s=>s.replace('</script>',';window.extra=true;</script>')],
 ['hidden context',s=>s.replace('<script>','<script hidden>')],
 ['unreviewed type',s=>s.replace('<script>','<script type="module">')],
 ['invalid object field',s=>s.replace('i:60','i:61')],
 ['malformed field',s=>s.replace("u:'01", "u:'GG")],
 ['duplicate context',s=>s+s],
 ])test('passive context rejects '+name,()=>assert.throws(()=>qualifyDocument(readNativeDocument(source.replace(context,change(context))),'embed'),/context|declaration/))

for(const [name,change]of [
 ['ray mismatch',s=>s.replace('main.js?ray=a','main.js?ray=b')],
 ['extra parameter',s=>s.replace('i:60','extra:1,i:60')],
 ['short ray',s=>s.replace(/r:'[a-f0-9]{16}'/,"r:'a'")],
 ['bad base64',s=>s.replace(/t:'[^']*'/,"t:'AAAAAAAAAAAAAAAA'")],
 ['short opaque context',s=>s.replace(/ut:'[^']*'/,"ut:'a'")],
 ])test('passive context rejects '+name,()=>assert.throws(()=>qualifyDocument(readNativeDocument(source.replace(context,change(context))),'embed'),/context|declaration/))
 test('passive context rejects moved head declaration',()=>assert.throws(()=>qualifyDocument(readNativeDocument(source.replace(context,'').replace('</head>',context+'</head>')),'embed'),/context|declaration/))
 test('hidden additional declaration still rejects',()=>assert.throws(()=>qualifyDocument(readNativeDocument(source.replace('</body>','<script hidden>window.extra=1</script></body>')),'embed'),/context|declaration/))

for(const [name,body]of [
 ['CF before NEXT_DATA',source.replace(context,'').replace('<script id="__NEXT_DATA__"',context+'<script id="__NEXT_DATA__"')],
 ['non-direct CF',source.replace(context,'<div>'+context+'</div>')],
 ['hidden NEXT_DATA',source.replace('id="__NEXT_DATA__"','hidden id="__NEXT_DATA__"')],
 ['changed native script attrs',source.replace('id="rippling-client-config"','data-country="India" id="rippling-client-config"')],
 ['changed beacon attrs',source.replace('crossorigin="anonymous"','crossorigin="use-credentials"')],
 ])test('exact native declarations reject '+name,()=>assert.throws(()=>qualifyDocument(readNativeDocument(body),'embed'),/context|declaration/))
