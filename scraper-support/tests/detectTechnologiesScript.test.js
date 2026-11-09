import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as detect from '../../scraper/detecttechnologies/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/currentNative20261106C25/capture.json.gz',import.meta.url))))
const html=fixture.documents[detect.CURRENT_URL].body
const fetchPage=async url=>{const page=fixture.documents[url];assert.ok(page);return {status:page.status,url:page.finalUrl,headers:page.headers,body:page.body,bodyUnavailable:page.bodyUnavailable}}
test('Detect current native cards retain written countries and source labels without old India defaults',()=>{
 const jobs=detect.extractSearchResults(html);assert.equal(jobs.length,9)
 assert.equal(jobs.filter(job=>job.country===null).length,8)
 assert.equal(jobs.find(job=>job.title==='IOT Intern - US').country,'United States')
 assert.ok(jobs.every(job=>job.requisitionId===null&&job.jobDescription===null))
})
test('Detect public run forwards the injected original transport and returns full qualified observations',async()=>{
 const jobs=await detect.run({fetchPage});assert.equal(jobs.length,8)
 assert.ok(jobs.every(job=>job.jobDescription.length>300&&job.sourceDetailComplete===true&&job.sourceCountryScopeUnresolved===true))
 assert.equal(jobs.nativeCollectionEvidence.observedRecordCount,9)
 assert.equal(jobs.nativeCollectionEvidence.explicitNonIndiaCount,1)
})
test('Detect recognizes current title and native collection without relying on its duplicated anchor ID',()=>{
 assert.equal(detect.pageIndicatesJobCards(html),true)
 assert.equal(detect.buildSearchUrl(),detect.CAREER_PAGE_URL)
 assert.equal(detect.pageIndicatesJobCards(html.replace('Current Job Openings - Detect Technologies','Unrelated Company')),false)
})
test('Detect refuses unrelated pages instead of converting a changed source to complete empty inventory',async()=>{
 await assert.rejects(detect.run({fetchPage:async url=>({status:200,url,headers:{'content-type':'text/html'},body:'<html><head><title>Different</title></head><body></body></html>'})}),/native careers/)
})
