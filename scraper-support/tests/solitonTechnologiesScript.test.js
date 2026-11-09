// Actual retained 2026-10-31 native packets replace older synthetic page shapes.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from '../../scraper/solitontechnologies/script.js'
import * as parser from '../../scraper/solitontechnologies/native.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const id='solitontechnologies',packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/solitontechnologies/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const body=url=>{const row=packet.requests.find(row=>row.url===url);assert.ok(row,'Uncaptured URL '+url);assert.equal(row.status,200,'Unavailable native capture cannot supply a body');return Buffer.from(row.body,row.bodyEncoding).toString()}
const options=(calls=[])=>({now:()=>packet.nativeCaptureStartedAt,fetchText:async url=>{calls.push(url);return body(url)},fetchJson:async url=>{calls.push(url);return JSON.parse(body(url))}})
const partial=jobs=>{const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.listingComplete,false)}

test('Soliton literal archive URLs remain discovery and eleven independently readable native detail routes are retained',()=>{assert.ok(source.hasOfficialCareersSignal(body(parser.SURFACE)));const rows=source.extractListings(body(parser.SURFACE));assert.equal(rows.length,11);assert.ok(rows.every(j=>/^\d+$/.test(j.jobId)&&j.rawNativeRoleEvidence.discoveryOnly));assert.ok(rows.every(j=>j.applyUrl===null&&j.rawNativeRoleEvidence.applicationAvailabilityQualified===false))})
test('Soliton visible role details retain literal workplaces including the explicit US role and full JD',()=>{const rows=source.extractListings(body(parser.SURFACE)),jobs=rows.map(row=>source.extractJobDetail(body(row.sourceUrl),row));assert.equal(jobs.length,11);assert.equal(jobs.find(j=>j.jobId==='157').location,'Chennai');const us=jobs.find(j=>j.jobId==='163');assert.equal(us.location,'US - San Jose and Dallas');assert.equal(us.country,'US');assert.ok(jobs.filter(j=>j.jobId!=='163').every(j=>j.country===null));assert.ok(jobs.every(j=>j.jobDescription.length>100&&j.postingDate===null&&j.applyUrl===null))})
test('Soliton run reads only advertised routes, decorates raw records and preserves unqualified company scope',async()=>{const calls=[],jobs=await source.createSolitonTechnologiesScraper().run(options(calls));assert.equal(jobs.length,11);assert.equal(calls.length,12);assert.equal(jobs[0].source,id);assert.equal(jobs[0].companyCareerPage,parser.SURFACE);assert.equal(jobs[0].scrapedAt,packet.nativeCaptureStartedAt);partial(jobs)})
test('Soliton fails closed when page identity, role heading or foreign role route changes',async()=>{await assert.rejects(()=>source.run({...options(),fetchText:async()=>'<html><head><title>Wrong</title></head></html>'}),/careers identity/);const row=source.extractListings(body(parser.SURFACE))[0];assert.throws(()=>source.extractJobDetail(body(row.sourceUrl),{...row,title:'Different role'}),/identity/);assert.throws(()=>source.extractJobDetail(body(row.sourceUrl),{...row,sourceUrl:'https://foreign.example/careers/1'}),/URL/)})
