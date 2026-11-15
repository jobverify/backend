import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

export const genuineVerintFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261114.json.gz',import.meta.url))))
export const laterVerintFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261114-later.json.gz',import.meta.url))))
export const correctedVerintFixture=JSON.parse(gunzipSync(readFileSync(new URL('./fixtures/current-native-20261114-corrected.json.gz',import.meta.url))))
export function fullVerintResponse(index,mutate,fixture=genuineVerintFixture){
 const original=fixture.responses[index]
 assert(original,'Unexpected response outside original eight-read fixture')
 const entity={body:Buffer.from(original.bodyBase64,'base64'),status:original.status,url:original.url,headers:{...original.headers}}
 const changed=mutate?.(entity,index)??entity
 const response=new Response([204,205,304].includes(changed.status)?null:changed.body,{status:changed.status,headers:changed.headers})
 Object.defineProperty(response,'url',{value:changed.url})
 return response
}
export async function replayVerint(run,{mutate,runOptions={},fetchOverride,fixture=genuineVerintFixture}={}){
 const requests=[]
 const fetchImpl=async(url,options)=>{
  const index=requests.length,expected=fixture.responses[index]
  assert(expected,'Unexpected request outside current original fixture')
  requests.push({url,options})
  assert.equal(String(url),expected.requestedUrl)
  return fetchOverride?fetchOverride(url,options,index):fullVerintResponse(index,mutate,fixture)
 }
 const prior=globalThis.fetch
 globalThis.fetch=fetchImpl
 try{return {jobs:await run({fetchImpl,...runOptions}),requests}}
 finally{globalThis.fetch=prior}
}
