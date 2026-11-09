import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './script.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/current-client-boundary-20261107.json.gz',import.meta.url))))
const R='https://ats.rippling.com/en-US/everstage/jobs/b27b64c9-467c-4fbc-8581-55d76888ae0d',A=R+'/apply'
const currentApp='https://ats.us1.rippling.com/_next/static/chunks/pages/_app-e4ddd0e6f708a095.js'
const oldApp='https://ats.us1.rippling.com/_next/static/chunks/pages/_app-cde13e9c5bff95e7.js'
const unobserved=Object.freeze({unobserved:'next genuine role not in original seven response boundary'})
globalThis.fetch=()=>{throw Error('CURRENT CLIENT TEST NETWORK FORBIDDEN')}
async function attempt(change=()=>{}){const rows=fixture().responses,map=new Map(rows.map(r=>[r.requestedURL,r.body]));change(map);const calls=[]
 try{return {jobs:await run({now:'2026-11-07T03:33:04.977Z',fetchImpl:async(url,init)=>{assert.equal(init.method,'GET');assert.equal(init.redirect,'error');assert.deepEqual(init.headers,{Accept:'text/html,application/javascript;q=0.9'});calls.push(url);if(!map.has(url))throw unobserved;return{status:200,url,text:async()=>map.get(url)}}}),calls}}catch(error){throw {error,calls}}
}
function next(map,url,fn){map.set(url,map.get(url).replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const n=JSON.parse(b);fn(n,n.props.pageProps.apiData);return a+JSON.stringify(n)+c}))}
test('genuine current seven responses validate complete first native role+application and reach next unobserved role',async()=>{
 try{await attempt();assert.fail('Seven packets cannot certify all five roles')}catch({error,calls}){assert.equal(error,unobserved);assert.equal(calls.length,8);assert.equal(calls[5],A);assert.match(calls[6],/apply-530b431e9be29ff9\.js$/);assert.match(calls[7],/81087ce5-8949-4a11-8db7-795cf78b84f4$/)}
})
const rejects=(name,change,pattern)=>test(name,async()=>{try{await attempt(change);assert.fail('Expected rejected current contract')}catch({error}){assert.match(error.message,pattern)}})
rejects('current role rejects app declaration drift rather than treating identical leaf hash as full context',m=>m.set(R,m.get(R).replace(currentApp,oldApp)),/client.*(?:context|declaration)/i)
rejects('current application rejects a mismatched app declaration',m=>m.set(A,m.get(A).replace(currentApp,oldApp)),/client.*(?:context|declaration)/i)
rejects('current role rejects an additional own script declaration',m=>m.set(R,m.get(R).replace('</head>','<script src="https://ats.us1.rippling.com/_next/static/chunks/unknown-1234.js"></script></head>')),/client.*(?:context|declaration)/i)
rejects('current role rejects duplicate own app declaration',m=>m.set(R,m.get(R).replace('</head>','<script src="'+currentApp+'"></script></head>')),/client.*(?:context|declaration)/i)
rejects('current application rejects missing declared dependency',m=>m.set(A,m.get(A).replace(/<script[^>]*src="https:\/\/ats\.us1\.rippling\.com\/_next\/static\/chunks\/780-[a-f0-9]+\.js"[^>]*><\/script>/,'')),/client.*(?:context|declaration)/i)
rejects('current role byte mutation still rejects',m=>{const u=[...m.keys()].find(u=>/jobId%5D-f5/.test(u));m.set(u,m.get(u)+'/* unreviewed */')},/executable client contract changed/i)
rejects('current application byte mutation still rejects',m=>{const u=[...m.keys()].find(u=>/apply-530b/.test(u));m.set(u,m.get(u)+'/* unreviewed */')},/executable client contract changed/i)
rejects('genuine current model still rejects foreign country contradiction',m=>next(m,'https://ats.rippling.com/embed/everstage/jobs?s=https%3A%2F%2Fwww.everstage.com%2Fcareers',n=>{n.props.pageProps.dehydratedState.queries[0].state.data.items[0].locations[0].countryCode='US'}),/geography contradiction/i)
rejects('genuine current model still rejects another employer',m=>next(m,R,(n,a)=>{a.jobPost.companyName='Another Inc.'}),/employer.*identity mismatch/i)
rejects('genuine current application still rejects missing own criteria',m=>next(m,A,(n,a)=>{a.jobPost.description.role=''}),/substantive core role description/i)
rejects('genuine current application still rejects mismatched full criteria',m=>next(m,A,(n,a)=>{a.jobPost.description.role+='<p>Another required criterion.</p>'}),/application job identity\/full JD/i)
rejects('genuine current role still rejects invented publication date',m=>next(m,R,(n,a)=>{a.jobPost.publishedAt='2026-11-07T00:00:00Z'}),/publication contract changed/i)

rejects('hidden extra current own program cannot disappear from declaration context',m=>m.set(R,m.get(R).replace('</head>','<script hidden src="https://ats.us1.rippling.com/_next/static/chunks/unknown-1234.js"></script></head>')),/client.*(?:context|declaration)/i)
rejects('inert subtree extra current own program remains unreviewed declaration drift',m=>m.set(R,m.get(R).replace('</head>','<div inert><script src="https://ats.us1.rippling.com/_next/static/chunks/unknown-1234.js"></script></div></head>')),/client.*(?:context|declaration)/i)
rejects('mixed current role and historical application whole programs reject',m=>{const historical=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime-native-20261021.json.gz',import.meta.url))));const old=Object.keys(historical).find(u=>/\/apply-[a-f0-9]+\.js$/.test(u)),u=[...m.keys()].find(u=>/apply-530b/.test(u));m.set(u,historical[old])},/version context changed/i)
rejects('exact current program at an unreviewed advertised path rejects',m=>{const u=[...m.keys()].find(u=>/jobId%5D-f5/.test(u)),v=u.replace('f5a3381aaec0ea0b','abcdef1234567890');m.set(v,m.get(u));m.delete(u);m.set(R,m.get(R).replace(u,v))},/client.*(?:context|declaration)/i)
