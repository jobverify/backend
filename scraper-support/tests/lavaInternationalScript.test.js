import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {createCatalogScraper,getScraperCatalog} from '../providers/index.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
import {URLS} from '../../scraper/lavainternational/native.js'
import {createLavaInternationalScraper,VERIFIED_ON,COMPANY,OFFICIAL_BRAND_NAME} from '../../scraper/lavainternational/script.js'
const files={about:'about.html',careers:'careers.html',listing:'listing.html',client:'joblist-client.js',detailClient:'details-client.js',applicationClient:'application-client.js',positions:'positions.json'}
const load=async(url,init)=>{assert.equal(init.method,'GET');const key=Object.keys(URLS).find(k=>URLS[k]===url);assert.ok(key);const bytes=readFileSync(new URL('../../scraper/lavainternational/fixtures/'+files[key],import.meta.url));return{status:200,url,headers:new Headers(),arrayBuffer:async()=>bytes}}
test('Lava registered factory establishes current native zero from both complete snapshots',async()=>{
 const provider=getScraperCatalog().find(p=>p.source==='lavainternational');let native
 const jobs=await createCatalogScraper(provider).run({fetchPage:load,requestIntervalMs:0,onNativeEvidence:value=>{native=value}})
 assert.equal(jobs.length,0);assert.equal(native.receipts.length,14);assert.equal(native.nativeGlobalCount,0)
 assert.equal(native.sourceScopeComplete,true);assert.equal(readInventoryEvidence(jobs).status,'verified-empty')
})
test('Lava no longer treats historical metadata or a first-party500 as empty inventory',async()=>{
 assert.equal(VERIFIED_ON,null);assert.equal(COMPANY,'Lava International');assert.equal(OFFICIAL_BRAND_NAME,'Lava International Limited')
 await assert.rejects(createLavaInternationalScraper({fetchPage:async(u,o)=>u===URLS.positions?{status:500}:load(u,o),requestIntervalMs:0}).run(),e=>e.status===500&&e.abortRetries===true)
})
test('retired mocked shell cannot bypass the current executable client contract',async()=>{
 await assert.rejects(createLavaInternationalScraper().run({fetchPage:async u=>({status:200,url:u,arrayBuffer:async()=>Buffer.from('<title>About Lava</title>')})}),/native route/)
})
