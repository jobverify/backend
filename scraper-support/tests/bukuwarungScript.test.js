import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {getScraperCatalog,createCatalogScraper} from '../providers/index.js'
import {createBukuwarungScraper,OFFICIAL_CAREERS_URL,OFFICIAL_DARWINBOX_HANDOFF_URL,extractOfficialDarwinboxUrl} from '../../scraper/bukuwarung/script.js'
const html=JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/bukuwarung/test-data/current-public-20261103.json.gz',import.meta.url)))).responses[OFFICIAL_CAREERS_URL].body

test('BukuWarung current corporate career page advertises the exact declared native employer tenant',()=>{assert.equal(extractOfficialDarwinboxUrl(html),OFFICIAL_DARWINBOX_HANDOFF_URL);assert.equal(typeof createBukuwarungScraper().collect,'function')})
test('BukuWarung refuses the old blank-shell plus403-empty sentinel collaborators',async()=>{await assert.rejects(createBukuwarungScraper().run({fetchPage:async()=>({html}),probeListingApi:async()=>({status:403})}),/status.*final URL fetchImpl/)})
test('BukuWarung catalog runtime preserves unknown native totals and never returns[] for a blocked current board',async()=>{const calls=[];const provider=getScraperCatalog().find(p=>p.source==='bukuwarung');assert.equal(provider.atsPlatform,'darwinbox-public-native');assert.equal(provider.verifiedPublicJobCount,null);assert.equal(provider.lifecycleCleanupAllowed,false);await assert.rejects(createCatalogScraper(provider).run({fetchImpl:async url=>{calls.push(url);const corporate=url===OFFICIAL_CAREERS_URL;const r=new Response(corporate?html:'blocked',{status:corporate?200:403});Object.defineProperty(r,'url',{value:url});return r}}),e=>e.status===403&&e.abortRetries===true);assert.equal(calls.filter(url=>url.includes('darwinbox')).length,1)})
