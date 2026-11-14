import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {board,client,CAREERS,PORTAL,BOARD} from './nativeDeclarations.js'
import {runNativeCorteva} from './nativeCurrent.js'

const html=gunzipSync(readFileSync(new URL('./fixtures/board-20261114.html.gz',import.meta.url))).toString()
const bytes=gunzipSync(readFileSync(new URL('./fixtures/pcsx-client-20261114.js.gz',import.meta.url)))
const current='https://apply.corteva.com/gen/js/pcsxPwa.ceaedf5d9f9dac50.js'

test('Corteva admits the current reviewed PCSX client declared by its own tenant',()=>{
 const declaration=board(html)
 assert.equal(declaration.clientURL,current)
 assert.equal(declaration.clientSHA256,'41537b81e94ebeeab73848de621505039707a7aee66a81b14719a91d4409ca9a')
 client(bytes,declaration)
 assert.equal(declaration.efJdOverridesAtsPosting,false)
})

test('Corteva current-client renewal retains declared identity, original-byte and ambiguity guards',()=>{
 assert.throws(()=>board(html.replaceAll('pcsxPwa.ceaedf5d9f9dac50.js','pcsxPwa.0000000000000000.js')),/reviewed PCSX client/)
 assert.throws(()=>client(Buffer.concat([bytes,Buffer.from('changed')]),{clientURL:current}),/published client contract/)
 assert.throws(()=>board(html+'<script src="/gen/js/pcsxPwa.ceaedf5d9f9dac50.js"></script>'),/reviewed PCSX client/)
})

test('Corteva native collector reaches search only after reviewing the current declared client',async()=>{
 const calls=[],reachedSearch=new Error('verified current client reached native search')
 await assert.rejects(runNativeCorteva({fetchResponse:async url=>{
  calls.push(url)
  if(url.includes('/api/pcsx/search?'))throw reachedSearch
  const body=url===CAREERS?Buffer.from('<a href="https://apply.corteva.com/">Search all jobs</a>'):url===PORTAL?Buffer.from('Redirect to careers'):url===BOARD?Buffer.from(html):url===current?bytes:null
  assert.ok(body,'Unexpected public route '+url)
  const contentType=url===current?'text/javascript':'text/html'
  return {status:url===PORTAL?302:200,finalURL:url,headers:{'content-type':contentType,...(url===PORTAL?{location:'/careers'}:{})},contentType,bytes:body}
 }}),error=>error===reachedSearch)
 assert.deepEqual(calls,[CAREERS,PORTAL,BOARD,current,'https://apply.corteva.com/api/pcsx/search?domain=corteva.com&query=&location=&start=0&'])
})
