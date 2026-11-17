import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url)))),html=i=>Buffer.from(fixture.originals[i].bodyBase64,'base64').toString()
import {parseCurrentPletraRows} from './currentNative20261117.js'
test('Pletra current source retains all authored criteria without inventing requisitions or India',()=>{const rows=parseCurrentPletraRows(html(1));assert.equal(rows.length,3);assert.ok(rows.every(r=>r.jobId===null&&r.requisitionId===null&&r.originalModel));assert.equal(rows[1].country,null);assert.equal(rows[1].city,null);assert.ok(rows[1].sourceDescription.includes('LWC, Apex'))})
test('Pletra metadata-free historical callbacks cannot enter publication',async()=>{let calls=0;await assert.rejects(source.run({fetchPage:async()=>{calls++;return{status:200,html:html(0)}}}),/metadata|unsupported/);assert.equal(calls,0)})
test('Pletra current observed503 is retained as HTTP and never company zero',async()=>{let calls=0;await assert.rejects(source.run({requestIntervalMs:0,fetchImpl:async url=>{calls++;const r=new Response('Service unavailable',{status:503,headers:{'content-type':'text/html'}});Object.defineProperty(r,'url',{value:url});return r}}),error=>error.status===503);assert.equal(calls,1)})
test('Pletra historical pure helper keeps distinct criteria while IDs and bare-city country remain unqualified',()=>{const legacyTitle=html(1).replace('Careers at PletraTech | Salesforce Jobs in Pune &amp; Belgium','Careers - Salesforce Implementation, Consulting &amp; Software Solutions'),rows=source.extractPublicJobs(legacyTitle);assert.equal(rows.length,3);assert.ok(rows.every(r=>r.jobId===null&&r.requisitionId===null));assert.equal(rows[1].country,null);assert.equal(rows[1].city,null)})
