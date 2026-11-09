import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run} from './nativeRun.js'
const dir=import.meta.dirname,O='https://eptura.pinpointhq.com',L=O+'/postings.json',U=O+'/en/postings/7320d3fb-5e5d-40fb-9963-0df5f216581f'
const attempt=async fn=>{const p=JSON.parse(gunzipSync(fs.readFileSync(dir+'/fixtures/runtime-native-20261021.json.gz')).toString('utf8'));fn(p);return run({now:'2026-10-21T19:11:24.530Z',fetchImpl:async url=>({status:200,url,text:async()=>p[url]})})}
const listing=(p,fn)=>{const v=JSON.parse(p[L]);fn(v);p[L]=JSON.stringify(v)}
for(const[name,mutation,pattern]of[
 ['country conflicts',p=>listing(p,v=>{v.data[2].location.country_code='US'}),/country|geograph/i],
 ['duplicate native IDs',p=>listing(p,v=>{v.data[3].id=v.data[2].id}),/duplicate/i],
 ['off-tenant role URL',p=>listing(p,v=>{v.data[2].url=v.data[2].url.replace('eptura.','other.')}),/URL|identity/i],
 ['closed native status',p=>listing(p,v=>{v.data[2].status='closed'}),/status/i],
 ['future original publication',p=>{p[U]=p[U].replace('2026-09-21T01:41:59+01:00','2027-09-21T01:41:59+01:00')},/future|publication/i],
 ['invalid native date calendar',p=>{p[U]=p[U].replace('2026-09-21T01:41:59+01:00','2026-09-31T01:41:59+01:00')},/calendar/i],
 ['closed optional content',p=>listing(p,v=>{v.data[2].benefits+='<p>This role has expired.</p>'}),/closed|description/i],
 ['unknown tenant',p=>{p[O+'/']=p[O+'/'].replaceAll('external:jobs:index:16453','external:jobs:index:99999')},/tenant|identity/i],
 ['application wrong native identity',p=>{p[U+'/applications/new']=p[U+'/applications/new'].replace('/en/postings/7320d3fb-5e5d-40fb-9963-0df5f216581f/applications"','/en/postings/other/applications"')},/application|identity/i],
 ['native deadline elapsed',p=>listing(p,v=>{v.data[2].deadline_at='2026-10-01T00:00:00Z'}),/deadline|closed/i],
 ['missing native typed city',p=>listing(p,v=>{v.data[2].location.city=null}),/geograph|city/i],
])test(name+' cannot silently qualify',async()=>assert.rejects(attempt(mutation),pattern))
test('upstream transport errors propagate',async()=>{await assert.rejects(run({fetchImpl:async()=>{throw Error('native connection unavailable')}}),/connection unavailable/)})
