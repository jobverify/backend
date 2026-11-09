import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as scraper from '../../scraper/acmesolar/script.js'
const source="acmesolar",entry="https://www.acmesolar.in/career"
const captures=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/acmesolar/test-data/native-20261103.json.gz',import.meta.url))))
const page=async url=>{const row=captures.findLast(row=>row.requestedUrl===url);assert.ok(row,'unexpected public/private request '+url);return {status:row.status,url:row.finalUrl,html:row.html}}
const run=options=>scraper.createAcmeSolarScraper().run({fetchText:page,...options})

test('ACME Solar exports its original source and current first-party entry without a static inventory verification date',()=>{
 assert.equal(scraper.SOURCE,"acmesolar")
 assert.equal(scraper.COMPANY,"ACME Solar")
 assert.equal(scraper.COMPANY_DOMAIN,"acmesolar.in")
 assert.equal(scraper.CAREERS_URL,entry)
 assert.equal(scraper.VERIFIED_ON,null)
 assert.equal(scraper.VERIFIED_AT,null)
 if(source==='acmesolar')assert.equal(scraper.APPLY_EMAIL,'careers@acme.in')
})

test('ACME Solar identifies active role links while excluding commented and unrevealed role markup',()=>{
 const html=captures.find(row=>row.requestedUrl===entry).html
 const role='<article class="job-card"><h2>Public Native Engineer</h2><a href="/jobs/engineer">View role</a></article>'
 assert.equal(scraper.pageExposesPublicJobListings(html),false)
 assert.equal(scraper.pageExposesPublicJobListings(html+role),true)
 assert.equal(scraper.pageExposesPublicJobListings(html+'<!-- '+role+' --><template>'+role+'</template><div hidden>'+role+'</div>'),false)
})

test('ACME Solar rejects a changed native employer or handoff before claiming source observations',async()=>{
 await assert.rejects(run({fetchText:async url=>{
  const value=await page(url)
  if(source==='aadyahaerospace'&&url.endsWith('/options/header'))return {...value,html:value.html.replace(/AADYAH/gi,'DifferentEmployer')}
  if(source==='aarbeestructures'&&url===entry)return {...value,html:value.html.replace('https://docs.google.com/forms/','https://different-employer.invalid/forms/')}
  if(source==='acmesolar'&&url.includes('/assets/index-'))return {...value,html:value.html.replace('careers@acme.in','jobs@different-employer.invalid')}
  if(source==='aayushmantech'&&url===entry)return {...value,html:'<html><body><h1>Unrelated employer</h1></body></html>'}
  return value
 }}),/employer|identity|binding/i)
})

test('ACME Solar preserves clock error identity and does not convert it into upstream absence',async()=>{
 const reason={opaque:'observation clock failed'};let calls=0
 await assert.rejects(run({now:()=>{throw reason},onAudit:()=>{calls++}}),error=>error===reason)
 assert.equal(calls,0)
})
