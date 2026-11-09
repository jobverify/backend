import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {run} from './script.js'
const E='https://ats.rippling.com/embed/mykaarma/jobs?s=https%3A%2F%2Fmykaarma.com%2Fcareers%2F',C='https://mykaarma.com/careers/'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/declared-research-20261107.json.gz',import.meta.url))))
const stop=Object.freeze({unobserved:'Closing native details were never captured; must not reuse opening originals'})
globalThis.fetch=()=>{throw Error('MYKAARMA SOURCE TEST NETWORK FORBIDDEN')}
async function attempt(change=()=>{},extra={}){const packets=fixture().packets.map(p=>({...p,body:Buffer.from(p.bodyBase64,'base64').toString('utf8')}));change(packets);const groups=new Map(),counts=new Map(),calls=[],audits=[];for(const p of packets){if(!groups.has(p.requestedURL))groups.set(p.requestedURL,[]);groups.get(p.requestedURL).push(p)}
 const fetchImpl=async(url,init={})=>{calls.push(url);const n=counts.get(url)||0;counts.set(url,n+1);const p=groups.get(url)?.[n];if(!p)throw stop;const response=new Response(p.body,{status:p.status,headers:{'content-type':p.contentType}});Object.defineProperty(response,'url',{value:p.finalURL});return response}
 try{return{jobs:await run({now:()=> '2026-11-07T04:54:10.593Z',fetchImpl,fetchText:async url=>(await fetchImpl(url)).text(),onAudit:a=>audits.push(a),...extra}),calls,audits}}catch(error){throw{error,calls,audits}}
}
function next(rows,url,fn){for(const p of rows.filter(p=>p.requestedURL===url))p.body=p.body.replace(/(<script[^>]*id="__NEXT_DATA__"[^>]*>)([\s\S]*?)(<\/script>)/,(_,a,b,c)=>{const n=JSON.parse(b);fn(n,n.props.pageProps.apiData);return a+JSON.stringify(n)+c})}
test('genuine current corporate/native seven full own application records advance to explicitly unobserved closing detail',async()=>{try{await attempt();assert.fail('Research packets cannot certify a completed workflow')}catch({error,calls}){assert.equal(error,stop);assert.equal(calls.length,25);assert.equal(calls.filter(u=>u.endsWith('/apply')).length,7);assert.equal(calls.at(-1),'https://ats.rippling.com/mykaarma/jobs/811e76a4-8ba4-4921-8ced-94a901dde48a')}})
test('original research packets are whole genuine bytes, not a full-output oracle or reused closing fixture',()=>{const f=fixture();assert.match(f.mode,/not a completed/);assert.equal(f.packets.length,27);for(const p of f.packets){const b=Buffer.from(p.bodyBase64,'base64');assert.equal(b.length,p.bodyBytes);assert.equal(createHash('sha256').update(b).digest('hex'),p.bodySHA256)}const p=f.packets.find(p=>p.requestedURL===E),n=JSON.parse(Buffer.from(p.bodyBase64,'base64').toString().match(/<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/)[1]),v=n.props.pageProps.dehydratedState.queries.find(q=>q.queryKey?.[2]==='job-posts').state.data;assert.equal(v.items.length,20);assert.equal(new Set(v.items.map(x=>x.id)).size,15);assert.equal(v.items.filter(x=>x.locations.every(l=>l.country==='India'&&l.countryCode==='IN')).length,7)})
const rejects=(name,change,pattern)=>test(name,async()=>{try{await attempt(change);assert.fail('Expected rejected current source')}catch({error}){assert.match(error.message,pattern)}})
rejects('current official wrong tenant rejects',p=>{p.find(p=>p.requestedURL===C).body=p.find(p=>p.requestedURL===C).body.replace('data-job-board-id="mykaarma"','data-job-board-id="other"')},/verified careers|tenant/i)
rejects('current native cross-tenant employer cannot borrow a generic client fingerprint',p=>next(p,E,(n,a)=>{a.jobBoard.companyName='Everstage Inc.'}),/employer|board identity/i)
rejects('unreviewed whole listing module bytes reject',p=>{p.find(x=>x.requestedURL.includes('/387-')).body+='/*changed*/'},/program|client/i)
rejects('new page cannot silently truncate native inventory',p=>next(p,E,n=>{n.props.pageProps.dehydratedState.queries.find(q=>q.queryKey?.[2]==='job-posts').state.data.totalPages=2}),/pagination|terminal/i)
rejects('native own role wrong employer rejects before any country hold',p=>next(p,'https://ats.rippling.com/mykaarma/jobs/811e76a4-8ba4-4921-8ced-94a901dde48a',(n,a)=>{a.jobPost.companyName='Another Company'}),/employer/i)
