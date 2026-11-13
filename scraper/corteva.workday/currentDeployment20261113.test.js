import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {board,client,CAREERS,PORTAL,BOARD} from './nativeDeclarations.js'
import {runNativeCorteva} from './nativeCurrent.js'

const html=gunzipSync(readFileSync(new URL('./fixtures/board-20261113.html.gz',import.meta.url))).toString()
const bytes=gunzipSync(readFileSync(new URL('./fixtures/pcsx-client-20261113.js.gz',import.meta.url)))
const current='https://apply.corteva.com/gen/js/pcsxPwa.52b647b4fc3ce8f6.js'

test('Corteva admits the reviewed current client advertised by its own tenant',()=>{
 const declaration=board(html)
 assert.equal(declaration.clientURL,current)
 assert.equal(declaration.clientSHA256,'d08d828d8794b424383232b00c35df5733ed99b7fcd4154ac91bdd311515d78c')
 client(bytes,declaration)
 assert.equal(declaration.efJdOverridesAtsPosting,false)
})

test('Corteva client renewal retains exact byte and active declaration checks',()=>{
 assert.throws(()=>board(html.replaceAll('pcsxPwa.52b647b4fc3ce8f6.js','pcsxPwa.0000000000000000.js')),/reviewed PCSX client/)
 assert.throws(()=>client(Buffer.concat([bytes,Buffer.from('changed')]),{clientURL:current}),/published client contract/)
 assert.throws(()=>board(html+'<script src="/gen/js/pcsxPwa.52b647b4fc3ce8f6.js"></script>'),/reviewed PCSX client/)
})

test('Corteva native transport admits only the reviewed client advertised by its current board',async()=>{
 const calls=[]
 const reachedSearch=new Error('native search reached after verified current client')
 await assert.rejects(runNativeCorteva({fetchResponse:async url=>{
  calls.push(url)
  if(url.includes('/api/pcsx/search?'))throw reachedSearch
  const body=url===CAREERS?Buffer.from('<a href="https://apply.corteva.com/">Search all jobs</a>')
   :url===PORTAL?Buffer.from('Redirect to careers'):url===BOARD?Buffer.from(html):url===current?bytes:null
  assert.ok(body,'Unexpected public route '+url)
  const contentType=url===current?'text/javascript':'text/html'
  return {status:url===PORTAL?302:200,finalURL:url,headers:{'content-type':contentType,...(url===PORTAL?{location:'/careers'}:{})},contentType,bytes:body}
 }}),error=>error===reachedSearch)
 assert.deepEqual(calls,[CAREERS,PORTAL,BOARD,current,'https://apply.corteva.com/api/pcsx/search?domain=corteva.com&query=&location=&start=0&'])
})
