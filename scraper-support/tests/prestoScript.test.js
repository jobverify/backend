// Actual retained 2026-10-31 native packets replace older synthetic page shapes.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from '../../scraper/presto/script.js'
import * as parser from '../../scraper/presto/native.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const id='presto',packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/presto/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const body=url=>{const row=packet.requests.find(row=>row.url===url);assert.ok(row,'Uncaptured URL '+url);assert.equal(row.status,200,'Unavailable native capture cannot supply a body');return Buffer.from(row.body,row.bodyEncoding).toString()}
const options=(calls=[])=>({now:()=>packet.nativeCaptureStartedAt,fetchText:async url=>{calls.push(url);return body(url)},fetchJson:async url=>{calls.push(url);return JSON.parse(body(url))}})
const partial=jobs=>{const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.listingComplete,false)}

test('Presto helpers bind the active employer page, literal native array and exact LinkedIn application IDs',()=>{assert.equal(source.SOURCE,id);assert.equal(source.VERIFIED_ON,'2026-07-17');assert.equal(source.OFFICIAL_CAREERS_URL,parser.SURFACE);assert.equal(source.hasOfficialCareersPageSignal(body(parser.SURFACE)),true);assert.equal(source.hasOfficialCareersPageSignal('<title>Careers</title>'),false);const rows=source.extractInlineJobPostings(body(parser.SCRIPT));assert.equal(rows.length,2);assert.equal(source.extractLinkedInJobId(rows[0].link),'3561451074');assert.equal(source.extractLinkedInJobId(rows[0].link.replace('pathWildcard=3561451074','pathWildcard=1')),null)})
test('Presto run preserves actual role summaries as unqualified raw evidence rather than generating full JDs',async()=>{const calls=[],jobs=await source.createPrestoScraper().run(options(calls));assert.deepEqual(calls,[parser.SURFACE,parser.SCRIPT]);assert.equal(jobs.length,2);assert.ok(jobs.every(j=>j.location===null&&j.country===null&&j.jobDescription===null&&j.postingDate===null));assert.ok(jobs.every(j=>j.rawNativeRoleEvidence.unqualifiedNativeDescription.length>50&&j.applyUrl.includes(j.jobId)));assert.equal(jobs[0].scrapedAt,packet.nativeCaptureStartedAt);partial(jobs)})
test('Presto fails closed when native careers handoff or supported literal array drifts',async()=>{await assert.rejects(()=>source.run({...options(),fetchText:async()=>'<html><title>Unexpected</title></html>'}),/careers identity/);assert.throws(()=>source.extractInlineJobPostings(body(parser.SCRIPT).replace('var jobPostings = [','var jobPostings = notLiteral([')),/syntax/);assert.throws(()=>source.extractInlineJobPostings('var jobPostings=[];'),/empty native/);assert.equal(source.extractLinkedInJobId('https://foreign.example/jobs/view/123'),null)})
