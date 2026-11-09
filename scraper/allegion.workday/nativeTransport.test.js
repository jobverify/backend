import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import http from 'node:http'
import test from 'node:test'
import assert from 'node:assert/strict'
import {run} from './script.js'
import {BOARD} from './nativeBinding.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

// Offline transport fixture only. The bridge routes public URLs to loopback,
// preserving source-supplied options and restoring fixture URL metadata. Real
// Node fetch sends the actual Accept header; the server negotiates the shell.
async function transportReplay(control){
 const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-browser-20261021.json.gz',import.meta.url))))
 const original=globalThis.fetch,requests=[],failures=[]
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://fixture.invalid').searchParams.get('url')
   const packet=fixture.packets.find(p=>p.url===url)
   assert.ok(packet,'Uncaptured request '+url)
   const chunks=[];for await(const chunk of req)chunks.push(chunk)
   const body=Buffer.concat(chunks).toString()
   assert.equal(req.method,packet.method)
   if(packet.method==='POST'){
    assert.equal(req.headers.accept,'application/json')
    assert.equal(req.headers['content-type'],'application/json')
    assert.deepEqual(JSON.parse(body),JSON.parse(packet.requestBody))
   }
   if(url.includes('/wday/cxs/')&&packet.method==='GET')assert.equal(req.headers.accept,'text/html,application/json')
   requests.push({url,method:req.method,accept:req.headers.accept})
   const jsonShell=url===BOARD&&req.headers.accept.includes('application/json')
   res.statusCode=url===BOARD&&control==='status'?202:packet.status
   res.setHeader('x-fixture-final-url',url===BOARD&&control==='url'?BOARD+'/unexpected':packet.finalURL)
   res.setHeader('content-type',jsonShell?'application/json':url===BOARD?'text/html':'application/json')
   res.end(jsonShell?JSON.stringify({widget:'redirect',url:'/careers',externalSpa:true}):packet.body)
  }catch(error){failures.push(error);res.statusCode=500;res.end('Fixture assertion failed')}
 })
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve))
 const origin='http://127.0.0.1:'+server.address().port
 globalThis.fetch=async(url,init)=>{
  const response=await original(origin+'/?url='+encodeURIComponent(String(url)),init)
  Object.defineProperty(response,'url',{value:response.headers.get('x-fixture-final-url')})
  return response
 }
 try{
  const jobs=await run({now:fixture.observedAt})
  if(failures.length)throw failures[0]
  return{jobs,requests,observedAt:fixture.observedAt}
 }finally{
  globalThis.fetch=original
  server.closeAllConnections()
  await new Promise(resolve=>server.close(resolve))
  if(failures.length)throw failures[0]
 }
}

test('default fetch negotiates an HTML board shell and retains the full pinned regional replay',async()=>{
 const{jobs,requests,observedAt}=await transportReplay()
 assert.equal(requests.length,32)
 assert.equal(requests.find(r=>r.url===BOARD).accept,'text/html')
 assert.equal(jobs.length,14)
 assert.ok(jobs.every(j=>j.sourceScopeComplete===false&&j.sourceListingComplete===false&&j.sourceCompanyCoverageComplete===false))
 assert.ok(jobs.every(j=>j.sourceClosingDateIsExact===false&&j.scrapedAt===observedAt))
 assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
for(const control of ['status','url'])test('HTML negotiation retains native '+control+' rejection',async()=>{
 await assert.rejects(()=>transportReplay(control),/Native HTTP status or final URL failure/)
})
