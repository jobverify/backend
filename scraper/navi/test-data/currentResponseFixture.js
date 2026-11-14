import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./current-native-20261114.json.gz',import.meta.url))))
export const bodyOf=packet=>Buffer.from(packet.bodyBase64,'base64')
export const textOf=packet=>new TextDecoder('utf8',{fatal:true,ignoreBOM:true}).decode(bodyOf(packet))
export const listing=JSON.parse(textOf(fixture.responses.find(row=>row.method==='POST')))
export const details=Object.fromEntries(fixture.responses.filter(row=>row.url.includes('/api/publicjobs/')).map(row=>{const value=JSON.parse(textOf(row));return[value.JobId,value]}))
export const board=fixture.responses.find(row=>row.url.includes('/dashboardv2?'))
export const corporate=fixture.responses.find(row=>row.url==='https://navi.com/careers')
export const fixtureReplay=(change=(packet,body)=>body)=>{
 const reads=[],calls=new Map()
 const fetchImpl=async(input,init={})=>{
  const url=String(input),method=init.method??'GET',sequence=(calls.get(method+' '+url)??0)+1;calls.set(method+' '+url,sequence);reads.push({url,method,body:init.body??null,sequence})
  init.signal?.throwIfAborted()
  const token=url==='https://thapi-stage2.azurewebsites.net/api/token/noauth'
  // The only synthetic response is an unmistakable fixture-only anonymous token.
  const packet=token?{url,method,status:200,finalUrl:url,contentType:'application/json',syntheticAnonymousToken:true}:fixture.responses.find(row=>row.url===url&&row.method===method)
  assert.ok(packet,'Unexpected off-contract fixture read: '+method+' '+url)
  if(method==='POST')assert.equal(init.body,packet.requestBody)
  const original=token?Buffer.from(JSON.stringify({access_token:'synthetic-Navi-fixture-only-token'})):bodyOf(packet),body=await change(packet,original,sequence,init)
  const response=new Response(body,{status:packet.status,headers:{'content-type':packet.contentType}})
  Object.defineProperty(response,'url',{value:packet.finalUrl})
  return response
 }
 return{reads,options:{now:()=>fixture.now,requestIntervalMs:0,maxJobs:3,fetchImpl}}
}
