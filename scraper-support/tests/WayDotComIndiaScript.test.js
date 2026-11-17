import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {run,createWayDotComIndiaScraper} from '../../scraper/waydotcomindia/script.js'
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/waydotcomindia/test-data/current-native-20261117.json.gz',import.meta.url)))).originals[0]
test('actual current first denial remains403 without old jobs JSON followup or verified-zero result',async()=>{let reads=0;await assert.rejects(run({requestIntervalMs:0,fetchImpl:async(url)=>{reads++;assert.equal(url,fixture.requestedURL);const r=new Response(Buffer.from(fixture.bodyBase64,'base64'),{status:fixture.status,headers:fixture.headers});Object.defineProperty(r,'url',{value:fixture.finalURL});return r}}),e=>e.status===403&&e.lifecycleCleanupAllowed===false);assert.equal(reads,1)})
test('body-only city/Cloudflare callbacks cannot publish inferred India roles or return verified zero',async()=>{let reads=0;await assert.rejects(createWayDotComIndiaScraper().run({fetchText:async()=>{reads++;return 'Cloudflare'},fetchJson:async()=>{reads++;return [{id:4,title:'Developer',location:'Trivandrum, Kerala',description:'Brief only'}]}}),/metadata-free legacy callback/);assert.equal(reads,0)})
