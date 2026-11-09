// Actual retained 2026-10-31 native packets replace older synthetic page shapes.
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from '../../scraper/tetrasoft/script.js'
import * as parser from '../../scraper/tetrasoft/native.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const id='tetrasoft',packet=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/tetrasoft/test-data/2026-10-31-native-packets.json.gz',import.meta.url))))
const body=url=>{const row=packet.requests.find(row=>row.url===url);assert.ok(row,'Uncaptured URL '+url);assert.equal(row.status,200,'Unavailable native capture cannot supply a body');return Buffer.from(row.body,row.bodyEncoding).toString()}
const options=(calls=[])=>({now:()=>packet.nativeCaptureStartedAt,fetchText:async url=>{calls.push(url);return body(url)},fetchJson:async url=>{calls.push(url);return JSON.parse(body(url))}})
const partial=jobs=>{const evidence=readInventoryEvidence(jobs);assert.equal(evidence.status,'coverage-gap');assert.equal(evidence.reportedTotal,null);assert.equal(evidence.indiaFacetCount,null);assert.equal(evidence.listingComplete,false)}

const inputs=()=>({css:body('https://www.tetrasoft.us/assets/css/main.css'),javascript:body('https://www.tetrasoft.us/assets/js/main.js')})
test('Tetrasoft binds current first-party careers accordion and literal mailto contract while legal employer remains unqualified',()=>{assert.equal(source.SOURCE,id);assert.equal(source.COMPANY,'TetraSoft');assert.equal(source.CAREERS_URL,parser.SURFACE);assert.equal(source.APPLICATION_EMAIL,'ts_tag_offshore@tetrasoft.us');assert.ok(source.hasOfficialCareersSignal(body(parser.SURFACE)));assert.equal(source.extractCareerCards(body(parser.SURFACE),inputs()).length,3)})
test('Tetrasoft opened native cards preserve full text and literal metadata without title-slug IDs or Hyderabad country inference',()=>{const jobs=source.extractCareerCards(body(parser.SURFACE),inputs());assert.equal(jobs.length,3);assert.ok(jobs.every(j=>j.location==='HYDERABAD'&&j.country===null&&j.city===null&&j.jobId===null&&j.requisitionId===null));assert.ok(jobs.every(j=>j.jobDescription.length>1000&&j.applyUrl==='mailto:ts_tag_offshore@tetrasoft.us'));assert.ok(jobs.find(j=>j.title.includes('ReactJS')).jobDescription.includes('Angular 11'));assert.ok(jobs.every(j=>j.requiredSkills.length===1&&j.experienceRequired==='7 - 10 Years'))})
test('Tetrasoft run fetches only its exact advertised native CSS/client and decorates truthful partial source rows',async()=>{const calls=[],jobs=await source.createTetrasoftScraper().run(options(calls));assert.equal(calls.length,3);assert.equal(jobs.length,3);assert.equal(jobs[0].source,id);assert.equal(jobs[0].companyDomain,'tetrasoft.us');assert.equal(jobs[0].scrapedAt,packet.nativeCaptureStartedAt);partial(jobs)})
test('Tetrasoft fails closed for page scope drift and keeps unknown fields when renderer proof is absent',async()=>{await assert.rejects(()=>source.run({...options(),fetchText:async()=>'<html><head><title>Unexpected</title></head></html>'}),/careers FAQ|careers identity/);const jobs=source.extractCareerCards(body(parser.SURFACE));assert.equal(jobs.length,3);assert.ok(jobs.every(j=>j.jobDescription===null&&j.location===null&&j.applyUrl===null))})
