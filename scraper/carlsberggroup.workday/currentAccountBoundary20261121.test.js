import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-physical-20261121.json.gz',import.meta.url))))
test('actual native account links remain unread extraction boundaries rather than login/register/password navigation',async()=>{
 const physical=[],queues=new Map();for(const row of fixture.rows){const k=row.receipt.requestedURL;if(!queues.has(k))queues.set(k,[]);queues.get(k).push(row)}
 let failure;try{await run({fetchImpl:async url=>{physical.push(url);const row=queues.get(url)?.shift();assert.ok(row,'Only captured native reads');return {status:row.receipt.status,url:row.receipt.finalURL,headers:new Headers(row.receipt.headers),body:new Response(row.body).body}}})}catch(error){failure=error}
 assert.equal(physical.filter(url=>{const u=new URL(url);return u.searchParams.has('login_ns')||u.searchParams.get('loginFlowRequired')==='true'}).length,0,'native extraction must not read account/login/register/password links')
 assert.equal(physical.length,5);assert.equal(failure?.recruitmentObservations?.observedVacancyCount,2,'retained native prefix observations must survive the account-boundary error')
})
