import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createBirlaNuScraper,CAREERS_URL,VERIFIED_HANDOFF_URL,extractJoinUsUrl} from '../../scraper/birlanu/script.js'
const html=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/birlanu/test-data/current-public-20261103.json.gz',import.meta.url)))).responses[CAREERS_URL].body

test('BirlaNu current official page still actively delegates to the historical HIL tenant',()=>{assert.equal(extractJoinUsUrl(html),VERIFIED_HANDOFF_URL);assert.match(html,/formerly HIL Limited/);assert.equal(typeof createBirlaNuScraper().collect,'function')})
test('BirlaNu requires observed HTTP metadata and rejects the obsolete landing-only sentinel transport',async()=>{await assert.rejects(createBirlaNuScraper().run({fetchText:async()=>html}),/status.*final URL fetchImpl/)})
test('BirlaNu fails unavailable before native requests when current corporate binding changes',async()=>{const calls=[];await assert.rejects(createBirlaNuScraper().run({fetchImpl:async url=>{calls.push(url);const r=new Response(html.replaceAll(VERIFIED_HANDOFF_URL,'https://another.darwinbox.in/'));Object.defineProperty(r,'url',{value:url});return r}}),/handoff binding/);assert.deepEqual(calls,[CAREERS_URL])})
