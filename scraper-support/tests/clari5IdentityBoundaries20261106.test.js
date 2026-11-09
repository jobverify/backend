import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as clari from '../../scraper/clari5/script.js'

// Original captured bytes remain untouched. Each local mutation below is a
// synthetic parser control, not a new public observation or inventory pass.
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/clari5Cbnits20261106/capture.json.gz',import.meta.url))))
const listings=clari.extractArchiveListings(fixture.documents[clari.CAREERS_URL].html)
const listing=listings[0],other=listings[1]
const original=fixture.documents[listing.sourceUrl].html
const canonical='<link rel="canonical" href="'+listing.sourceUrl+'"'
assert.ok(original.includes(canonical))

test('review: a preceding hidden conflicting canonical remains document identity authority',()=>{
 const changed=original.replace(canonical,'<link hidden rel="canonical" href="'+other.sourceUrl+'" />'+canonical)
 assert.notEqual(changed,original)
 assert.throws(()=>clari.extractJobDetail(changed,listing),/Clari5.*detail|Clari5.*identity/i)
})

test('review: a preceding retained hidden head cannot be bypassed by a later normal head',()=>{
 const changed=original.replace(/<head\b[^>]*>/i,opening=>'<head hidden><link rel="canonical" href="'+other.sourceUrl+'"/><title>Conflicting role Job | Clari5 Careers</title></head>'+opening)
 assert.notEqual(changed,original)
 assert.throws(()=>clari.extractJobDetail(changed,listing),/Clari5.*detail|Clari5.*identity/i)
})

test('review: hidden out-of-scope India location cannot override the visible foreign role location',()=>{
 const location=/<div class="job-location"><i[^>]*><\/i>([\s\S]*?)<\/div>/i
 assert.ok(location.test(original))
 const foreign=original.replace(location,full=>full.replace(location.exec(full)[1],'Singapore'))
 const changed=foreign.replace(/<body\b[^>]*>/i,opening=>opening+'<div hidden><div class="job-location"><i></i>Bangalore, India</div></div>')
 assert.notEqual(changed,original)
 let job
 try {job=clari.extractJobDetail(changed,listing)} catch {return} // Conflicting native geography may fail closed.
 assert.notEqual(job.country,'India','The returned India claim must not come from hidden text outside the qualified post')
})

test('review: metadata inside a true HTML template does not displace the genuine document head',()=>{
 const changed=original.replace(/<head\b[^>]*>/i,opening=>opening+'<template><link rel="canonical" href="'+other.sourceUrl+'"/><title>Template copy Job | Clari5 Careers</title></template>')
 assert.notEqual(changed,original)
 const job=clari.extractJobDetail(changed,listing)
 assert.equal(job.jobId,listing.jobId)
 assert.equal(job.sourceUrl,listing.sourceUrl)
 assert.equal(job.country,'India')
})
