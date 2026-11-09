import fs from 'node:fs'
import assert from 'node:assert/strict'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../../scraper-support/providers/index.js'

export const currentNativeQuality=JSON.parse(gunzipSync(fs.readFileSync(new URL('../test-data/recruitmentGoal20261104/workday-bamboo-current-native-quality.json.gz',import.meta.url))))
const key=(url,init={})=>(init.method||'GET')+':'+url+':'+(init.body||'')
export const capturedSource=source=>currentNativeQuality.sources.find(row=>row.source===source)
export function currentNativeTransport(source,mutate=()=>{},packets){
  const capture=capturedSource(source),pending=new Map(),calls=[]
  assert.ok(capture)
  for(const packet of packets||capture.requests){const id=key(packet.requestedURL,{method:packet.method,body:packet.body});const rows=pending.get(id)||[];rows.push(structuredClone(packet));pending.set(id,rows)}
  return{calls,get consumed(){return calls.length},get remaining(){return[...pending.values()].reduce((sum,rows)=>sum+rows.length,0)},async fetch(url,init={}){
    const rows=pending.get(key(String(url),init));assert.ok(rows?.length,'Uncaptured public request: '+url)
    const packet=rows.shift();mutate(packet,calls.length+1)
    calls.push({url:String(url),method:init.method||'GET',body:init.body||null,accept:init.headers?.Accept,packet})
    if(packet.error)throw Object.assign(Error(packet.error),{abortRetries:true})
    const response=new Response([204,205,304].includes(packet.status)?null:packet.text,{status:packet.status,headers:packet.headers})
    Object.defineProperty(response,'url',{value:packet.finalURL})
    return response
  }}
}
export async function replayCurrentNative(source,mutate,options={}){
  const transport=currentNativeTransport(source,mutate),prior=globalThis.fetch,capture=capturedSource(source)
  globalThis.fetch=(...args)=>transport.fetch(...args)
  try{
    const provider=getScraperCatalog().find(p=>p.source===source)
    const jobs=await createCatalogScraper(provider).run({now:()=>capture.completedAt,
      fetchImpl:(...args)=>transport.fetch(...args),requestIntervalMs:0,...options})
    return{jobs,transport}
  }finally{globalThis.fetch=prior}
}
