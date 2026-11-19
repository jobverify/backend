import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const packets=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-20261113.json.gz',import.meta.url))))
async function replay(query){return run({fetchPage:async url=>{
 const original=new URL(url);original.searchParams.delete('isComingFromApp');original.searchParams.delete('redirect');
 const key=url.includes('coralogix.com/careers/co/')?original.href:url
 const packet=structuredClone(packets.find(p=>p.requestedUrl===key));assert.ok(packet,url)
 if(url.includes('/positions')){const value=JSON.parse(packet.html);for(const row of Array.isArray(value)?value:[value])if(row.url_active_page?.includes('coralogix.com/careers/co/'))row.url_active_page+=query;packet.html=JSON.stringify(value)}
 return{...packet,url}
}})}
test('current Coralogix first-party coming-from-app flag retains full India criteria',async()=>{const jobs=await replay('?isComingFromApp=true');assert.equal(jobs.length,7);assert.ok(jobs.every(j=>j.country==='India'&&j.sourceDetailComplete))})
test('Coralogix unreviewed query remains rejected',()=>assert.rejects(replay('?redirect=https://foreign.example'),/first-party role identity/))
