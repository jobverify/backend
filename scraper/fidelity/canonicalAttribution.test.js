import fs from'node:fs'
import{gunzipSync}from'node:zlib'
import assert from'node:assert/strict'
import test from'node:test'
import{createCatalogScraper,getScraperCatalog}from'../../scraper-support/providers/index.js'
const fixture=()=>JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime-native-20261021.json.gz',import.meta.url))))
const options=()=>{const f=fixture(),used=new Set();return{now:f.checkedAt,fetchPage:async url=>{const at=f.packets.findIndex((p,i)=>!used.has(i)&&p.url===url);assert.ok(at>=0,'Uncaptured request '+url);used.add(at);const p=f.packets[at];return{url:p.finalURL,status:p.status,body:p.body}},fetchText:async url=>url.includes('/xml/')?f.packets.find(p=>p.url===url).body:'<title>Just a moment...</title>jobs.fidelity.com Enable JavaScript and cookies to continue'}}
test('historical spelling wrapper executes canonical Fidelity source attribution without a second employer inventory',async()=>{const{createFedilityInvestmentsScraper}=await import('../fedilityinvestments/script.js'),jobs=await createFedilityInvestmentsScraper().run(options());assert.equal(jobs.length,14);assert.ok(jobs.every(j=>j.source==='fidelity'&&j.company==='Fidelity Investments'&&j.sourceListingComplete===false&&j.sourceDetailComplete===true));assert.equal(new Set(jobs.map(j=>j.source)).size,1)})
test('catalog wrappers preserve canonical source/company and the exact registered identities',async()=>{const catalog=getScraperCatalog();for(const source of ['fidelity','fedilityinvestments']){assert.equal(catalog.filter(row=>row.source===source).length,1);const p=catalog.find(p=>p.source===source),jobs=await createCatalogScraper(p).run(options());assert.equal(jobs.length,14);assert.ok(jobs.every(j=>j.source==='fidelity'&&j.company==='Fidelity Investments'))}})
