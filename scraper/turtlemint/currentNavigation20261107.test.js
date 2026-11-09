import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,validateEmptyPage,FIRST_PARTY_ROOT_URL} from './script.js'
import {readInventoryEvidence} from '../../scraper-support/utils/inventoryEvidence.js'

const capture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./test-data-20261107/current-native.json.gz',import.meta.url))))
const page=capture.packets.find(row=>row.url===FIRST_PARTY_ROOT_URL)
test('Turtlemint accepts its reviewed current WordPress navigation resource beside an explicit empty careers module',async()=>{
 const jobs=await run({fetchPage:async url=>{assert.equal(url,FIRST_PARTY_ROOT_URL);return {status:page.status,url:page.url,html:page.body}}})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
 assert.equal(readInventoryEvidence(jobs).listingComplete,true)
})
test('Turtlemint rejects a new job-loading resource and changed empty-module copy',()=>{
 assert.throws(()=>validateEmptyPage(page.body.replaceAll(capture.reviewedNavigation.url,'https://www.turtlemint.com/load-jobs.js')),/client resource/)
 assert.throws(()=>validateEmptyPage(page.body.replace('There are no active openings at the moment','View active openings')),/empty message/i)
})
