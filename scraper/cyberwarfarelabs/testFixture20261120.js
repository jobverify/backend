import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import {CAREERS_API_URL} from './nativeContract20261120.js'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/native-20261120.json.gz',import.meta.url))))
export const payload=JSON.parse(Buffer.from(fixture.responses.find(r=>r.requestedURL===CAREERS_API_URL).bodyBase64,'base64').toString())
export const responseFor=(row,body=Buffer.from(row.bodyBase64,'base64'),status=row.status,headers=row.headers,url=row.finalURL)=>Object.defineProperty(new Response(body,{status,headers}),'url',{value:url})
let advance=()=>{}
export function replay(mutate){const calls=[],counts=new Map();return{calls,fetchImpl:async(url,init={})=>{const requested=String(url),row=fixture.responses.find(r=>r.requestedURL===requested);assert.ok(row,'Uncaptured public URL');assert.equal(init.method??'GET',row.method);const occurrence=(counts.get(requested)??0)+1;counts.set(requested,occurrence);calls.push(requested);advance();return await mutate?.({row,occurrence,init,calls})??responseFor(row)}}}
export async function fast(action){const original=Object.getOwnPropertyDescriptor(performance,'now'),previousAdvance=advance;let tick=0;advance=()=>{tick+=600};Object.defineProperty(performance,'now',{configurable:true,value:()=>tick});try{return await action()}finally{advance=previousAdvance;if(original)Object.defineProperty(performance,'now',original);else delete performance.now}}
