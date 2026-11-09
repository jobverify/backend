import test from 'node:test'
import assert from 'node:assert/strict'
import {createTransport} from './transport.js'
import {API,CAREERS} from './native.js'
test('native GET details negotiate JSON while corporate pages negotiate HTML',async()=>{
 const transport=createTransport({fetchImpl:async(url,init)=>{
  assert.equal(init.headers.Accept,url.includes('/wday/cxs/')?'application/json':'text/html')
  const response=new Response(url.includes('/wday/cxs/')?'{}':'<html>Samsung</html>',{headers:{'content-type':url.includes('/wday/cxs/')?'application/json':'text/html'}})
  Object.defineProperty(response,'url',{value:url});return response
 }})
 try{await transport.read(API+'/job/RTL-Design-Lead-Engineer_R109851');await transport.read(CAREERS)}finally{transport.close()}
})
