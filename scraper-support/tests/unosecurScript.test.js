import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import * as source from '../../scraper/unosecur/script.js'
import {getScraperCatalog} from '../providers/index.js'
const f=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../test/test-data/recruitmentGoal20261104/unosecur-native-quality.json.gz',import.meta.url))))
const transport=calls=>async url=>{calls.push(url);const q=f.packets.find(q=>q.requestedURL===url);assert.ok(q,'Undeclared public read: '+url);const r=new Response(q.bodyText,{headers:q.headers});Object.defineProperty(r,'url',{value:q.finalURL});return r}
test('Unosecur script and current registered metadata preserve publisher/tenant identity and incomplete scope',()=>{
 assert.equal(source.SOURCE,'unosecur');assert.equal(source.COMPANY,'Unosecur');assert.equal(source.CAREERS_URL,'https://www.unosecur.com/careers')
 assert.equal(source.DISPOSITION,'runtime-verified-recruitment');assert.equal(source.hasOfficialCareersSignal(f.packets[0].bodyText),true)
 assert.equal(source.hasOfficialCareersSignal('<h1>Unrelated careers</h1>'),false)
 const p=getScraperCatalog().find(p=>p.source==='unosecur');assert.equal(p.companyDomain,'unosecur.com');assert.equal(p.countryFilter,'India');assert.equal(p.adapter,'script')
 assert.match(p.extractionStrategy,/current-declared-client/);assert.equal(p.verifiedPublicJobCount,null);assert.equal(p.verifiedIndiaJobCount,null)
})
test('Unosecur factory/run overrides select the actual caller transport and timestamp',async()=>{
 const defaults=[],overrides=[],first='2026-11-05T20:00:00.000Z',second='2026-11-05T21:00:00.000Z'
 const scraper=source.createUnosecurScraper({fetchImpl:transport(defaults),minIntervalMs:0,now:()=>first})
 const a=await scraper.run();assert.equal(a.length,3);assert.equal(a[0].scrapedAt,first);assert.equal(defaults.length,16)
 const b=await scraper.run({fetchImpl:transport(overrides),now:()=>second});assert.equal(b.length,3);assert.equal(b[0].scrapedAt,second);assert.equal(overrides.length,16);assert.equal(defaults.length,16)
})
