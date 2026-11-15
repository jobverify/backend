import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'

export const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./current-native-20261114.json.gz',import.meta.url))))
export const ACCOUNT='https://apply.workable.com/api/v1/accounts/smartstream?full=true'
export const LISTING='https://apply.workable.com/api/v3/accounts/smartstream/jobs'
export const CLIENT='https://dcvxs6ggqztsa.cloudfront.net/candidate/releases/careers.6901cd820c44d775.js'
export const ROLES=fixture.roles.map(role=>role.original.shortcode)
export const detailURL=shortcode=>'https://apply.workable.com/api/v2/accounts/smartstream/jobs/'+shortcode
export const packet=kind=>fixture.packets.find(row=>row.kind===kind)
export const hash=value=>createHash('sha256').update(value).digest('hex')
export const changeJSON=(bytes,mutate)=>{
 const value=JSON.parse(bytes),copy=structuredClone(value),changed=mutate(copy)??copy
 assert.notDeepEqual(changed,value,'A regression must change actual original data')
 return Buffer.from(JSON.stringify(changed))
}
export function response(row,changes={}){
 const original=Buffer.from(row.bodyBase64,'base64');assert.equal(hash(original),row.sha256)
 const value=new Response(changes.bytes??original,{status:changes.status??row.status,headers:changes.headers??row.headers})
 Object.defineProperty(value,'url',{value:changes.url??row.finalUrl??row.url??row.requestedUrl})
 if(Object.hasOwn(changes,'redirected'))Object.defineProperty(value,'redirected',{value:changes.redirected})
 return value
}
// The17 physical original observations remain unchanged. Only one original
// metadata/client observation exists: reusing it at two logical phases is an
// explicit offline replay, never evidence of a second live acquisition.
export function replay(transform=()=>({})){
 const requests=[],counts=new Map()
 const select=url=>{
  const count=(counts.get(url)??0)+1;counts.set(url,count)
  let row
  if(url===ACCOUNT)row=packet('native-account-metadata')
  else if(url===CLIENT)row=packet('literal-role-client')
  else if(url===LISTING)row=packet(count===1?'native-public-jobs-search':'native-first-page-closing')
  else if(ROLES.some(code=>url===detailURL(code)))row=fixture.packets.find(value=>value.requestedUrl===url&&value.kind===(count===1?'native-detail-opening':'native-detail-closing'))
  assert.ok(row,'Undeclared native request '+url)
  return{row,count}
 }
 const acquire=async(url,init)=>{
  requests.push({url,init});const {row,count}=select(url),bytes=Buffer.from(row.bodyBase64,'base64')
  const changes=await transform({url,init,row,count,bytes})
  return{row,changes,bytes:changes.bytes??bytes}
 }
 return{requests,options:{now:()=> '2026-11-14T22:00:00.000Z',fetchImpl:async(url,init)=>{
  const {row,changes}=await acquire(url,init);return response(row,changes)
 },fetchPage:async(url,init)=>{
  const {row,changes,bytes}=await acquire(url,init),original=response(row,changes)
  return{status:original.status,finalUrl:original.url,redirected:original.redirected,headers:Object.fromEntries(original.headers),bodyBase64:bytes.toString('base64'),bytes:bytes.length,sha256:hash(bytes)}
 }}}
}
