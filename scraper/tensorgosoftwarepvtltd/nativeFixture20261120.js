import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
export const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261120/current-native.json.gz',import.meta.url))))
export const API='https://api.humains.one/api/jobs',MAIN=fixture.responses.find(r=>/\/main\.[^/]+\.js$/.test(r.requestedURL)).requestedURL
export const responseFor=(row,body=Buffer.from(row.bodyBase64,'base64'),status=row.status,headers=row.headers,url=row.finalURL)=>Object.defineProperty(new Response(body,{status,headers}),'url',{value:url})
let advance=()=>{}
export function replay(mutate){const calls=[],seen=new Map();return{calls,fetchImpl:async(url,init={})=>{const requested=String(url),row=fixture.responses.find(r=>r.requestedURL===requested);assert.ok(row,'Uncaptured current public URL');assert.equal(init.method??'GET',row.method);assert.equal(init.body??null,row.requestBody);const occurrence=(seen.get(requested)??0)+1;seen.set(requested,occurrence);calls.push(requested);advance();return await mutate?.({row,occurrence,init,calls})??responseFor(row)}}}
export async function fast(action){const original=Object.getOwnPropertyDescriptor(performance,'now'),prior=advance;let tick=0;advance=()=>{tick+=600};Object.defineProperty(performance,'now',{configurable:true,value:()=>tick});try{return await action()}finally{advance=prior;if(original)Object.defineProperty(performance,'now',original);else delete performance.now}}
