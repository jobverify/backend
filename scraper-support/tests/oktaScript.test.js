import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import assert from 'node:assert/strict'
import test from 'node:test'
import {run,createOktaScraper,SOURCE,COMPANY,CAREERS_URL,PUBLIC_BOARD_URL} from '../../scraper/okta/script.js'
import {createSourceConfig} from '../../scraper/okta/parser.js'
const pack=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/okta/fixtures/native-20261023.json.gz',import.meta.url))))
const native=()=>createSourceConfig({now:()=> '2026-10-23T14:00:00.000Z'})
test('Okta factory and native runtime preserve registered source/company and official public routes',()=>{
 assert.equal(SOURCE,'okta');assert.equal(COMPANY,'Okta');assert.equal(CAREERS_URL,'https://www.okta.com/company/careers/')
 assert.equal(PUBLIC_BOARD_URL,'https://www.okta.com/company/careers/job-listing/');assert.equal(typeof createOktaScraper().run,'function');assert.equal(typeof run,'function')
})
test('native board extraction retains all394observed rows and97explicit India candidates without inventing a reported total',()=>{
 const config=native(),packet=pack.requests.find(p=>p.url===PUBLIC_BOARD_URL),page=config.parseListing(Buffer.from(packet.rawBodyBase64,'base64').toString(),PUBLIC_BOARD_URL)
 assert.equal(page.observedRows,394);assert.equal(page.records.length,394);assert.equal(page.errors.length,0)
 assert.equal(page.records.filter(config.candidateForIndia).length,97);assert.equal(page.reportedTotal,null)
 assert.equal(page.nextURL,null);assert.equal(page.terminationKnown,true)
})
test('native date/content proof is required and legacy listing/metadata snippets cannot serve as role details',()=>{
 const config=native(),packet=pack.requests.find(p=>p.url===PUBLIC_BOARD_URL),page=config.parseListing(Buffer.from(packet.rawBodyBase64,'base64').toString(),PUBLIC_BOARD_URL)
 const row=page.records.find(r=>r.url.includes('senior-data-engineer-7572029'))
 assert.throws(()=>config.parseDetail('<html><head><meta name="description" content="Company marketing teaser" /></head><body><h1>Senior Data Engineer</h1><p>Bengaluru, India</p></body></html>',row))
 const detail=config.parseDetail(Buffer.from(pack.requests.find(p=>p.url===row.url).rawBodyBase64,'base64').toString(),row)
 assert.equal(detail.nativePostedDate.raw,'2026-07-30');assert.equal(detail.nativeExternalJobID,'7572029')
 assert.ok(detail.nativeDescriptionHTML.length>detail.nativeSchemaDescription.length)
})
test('a partial maxJobs request fails explicitly before any public request',async()=>{
 let reads=0
 assert.throws(()=>createOktaScraper({maxJobs:2}).run({transport:async()=>{reads++;throw Error('must not read')}}),/Partial maxJobs/)
 assert.equal(reads,0)
})
test('missing native board markup cannot become an empty successful scrape',()=>{
 const config=native();assert.throws(()=>config.parseListing('<html><body>No data</body></html>',PUBLIC_BOARD_URL))
})
