// Actual retained 2026-10-31 native packets replace older synthetic page shapes.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from './script.js'
import * as parser from './native.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'
const id='pragyarefrigerationandelectricalsprivatelimited',packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const body=url=>{const row=packet.requests.find(row=>row.url===url);assert.ok(row,'Uncaptured URL '+url);assert.equal(row.status,200,'Unavailable native capture cannot supply a body');return Buffer.from(row.body,row.bodyEncoding).toString()}
const options=(calls=[])=>({now:()=>packet.nativeCaptureStartedAt,fetchText:async url=>{calls.push(url);return body(url)},fetchJson:async url=>{calls.push(url);return JSON.parse(body(url))}})
const partial=jobs=>{const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.listingComplete,false)}

test('Pragya literal API and rendered cards preserve full fields without invented IDs or page posting dates',()=>{const payload=JSON.parse(body(parser.API)),jobs=source.extractJobs(payload,{html:body(parser.SURFACE)});assert.equal(source.SOURCE,id);assert.equal(source.CAREERS_API_URL,parser.API);assert.equal(jobs.length,2);assert.deepEqual(jobs.map(j=>j.title),['Product Engineer','Purchase Executive']);assert.ok(jobs.every(j=>j.jobId===null&&j.requisitionId===null&&j.postingDate===null&&j.location===null&&j.country===null));assert.ok(jobs.every(j=>j.jobDescription.includes('Roll:')&&j.minimumQualification&&j.experienceRequired))})
test('Pragya run corroborates API with advertised native careers page and preserves unknown employer counts',async()=>{const calls=[],jobs=await source.createPragyaRefrigerationAndElectricalsPrivateLimitedScraper().run(options(calls));assert.deepEqual(calls,[parser.API,parser.SURFACE]);assert.equal(jobs.length,2);assert.equal(jobs[0].scrapedAt,packet.nativeCaptureStartedAt);assert.equal(jobs[0].link,parser.SURFACE);partial(jobs)})
test('Pragya fails closed for unsupported empty API and unbound openings structure',async()=>{await assert.rejects(()=>source.run({...options(),fetchJson:async()=>[]}),/API page identity/);const payload=JSON.parse(body(parser.API));payload[0].content.rendered='<section><h3>Open positions</h3><p>No openings</p></section>';assert.throws(()=>source.extractJobs(payload),/carrier/);payload[0].status='draft';assert.equal(source.isVerifiedCareersPage(payload[0]),false)})
