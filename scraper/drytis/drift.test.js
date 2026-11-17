import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as scraper from './script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data/current-native-20261117.json.gz',import.meta.url))))
test('current actual Drytis publisher and newsletter retain literal identity without a complete inventory claim',()=>{
 const home=Buffer.from(fixture.originals[0].bodyBase64,'base64').toString(),careers=Buffer.from(fixture.originals[1].bodyBase64,'base64').toString()
 assert.equal(scraper.hasOfficialHomepageSignal(home),true)
 assert.equal(scraper.hasVerifiedEmptyCareersLanding(careers),true)
 assert.equal(scraper.hasOfficialHomepageSignal(home.replaceAll('hello@drytis.com','hello@example.org')),false)
})
test('body-only empty-state callbacks fail before any source publication',async()=>{
 await assert.rejects(scraper.run({fetchPage:async()=>({status:200,html:'No open roles right now'})}),/unsupported metadata-free/)
})
