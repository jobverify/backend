import {readFileSync,readdirSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'

const root=new URL('./fixtures/',import.meta.url)
const load=name=>{const bytes=readFileSync(new URL(name,root));return JSON.parse((name.endsWith('.gz')?gunzipSync(bytes):bytes).toString('utf8'))}
export const freshResponses=[...load('fresh-official-careers.json.gz'),...load('fresh-research-careers.json.gz'),...load('fresh-board-pages.json.gz'),...readdirSync(root).filter(name=>/^fresh-global-details-\d+\.json\.gz$/.test(name)).sort().flatMap(load)]
export const freshFetch=(change=record=>record)=>async(url,init={})=>{
 const body=init.body?JSON.parse(init.body):null
 const captured=freshResponses.find(record=>record.url===url&&JSON.stringify(record.requestBody??null)===JSON.stringify(body))
 if(!captured)throw Error('Uncaptured Samsung request '+url+' '+JSON.stringify(body))
 const record=change(structuredClone(captured))
 const response=new Response(record.body,{status:record.status,headers:{'content-type':url.includes('/wday/cxs/')?'application/json':'text/html'}})
 Object.defineProperty(response,'url',{value:record.finalUrl})
 return response
}
