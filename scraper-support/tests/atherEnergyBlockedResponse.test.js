import assert from 'node:assert/strict'
import test from 'node:test'
globalThis.fetch=()=>{throw Error('OFFLINE Ather network tripwire')}
const {createAtherEnergyScraper,CAREERS_HOME_URL}=await import('../../scraper/atherenergy/script.js')
const {getScraperCatalog,createCatalogScraper}=await import('../providers/index.js')
const blocked='<title>Attention Required! | Cloudflare</title><p>Please enable cookies.</p><p>Sorry, you have been blocked</p><p>You are unable to access atherenergy.com</p>'
test('Ather cannot treat denied pages as an empty inventory or fetch another route',async()=>{
 const urls=[]
 await assert.rejects(createAtherEnergyScraper().run({fetchPage:async url=>{
  urls.push(url);return{url,status:403,html:blocked}
 }}),/HTTP 403/)
 assert.deepEqual(urls,[CAREERS_HOME_URL])
})
test('Ather thrown403 stops at the original route',async()=>{
 const urls=[]
 await assert.rejects(createAtherEnergyScraper().run({fetchPage:async url=>{
  urls.push(url);throw Error('HTTP 403 for '+url)
 }}),/HTTP 403/)
 assert.deepEqual(urls,[CAREERS_HOME_URL])
})
test('Ather registered wrapper forwards the injected transport before any implicit network',async()=>{
 const urls=[]
 const provider=getScraperCatalog().find(p=>p.source==='atherenergy')
 await assert.rejects(createCatalogScraper(provider).run({fetchPage:async url=>{
  urls.push(url);return{url,status:429,html:'Rate limit'}
 }}),/HTTP 429/)
 assert.deepEqual(urls,[CAREERS_HOME_URL])
})

for(const html of [blocked,'<title>Verify you are human</title>'])test('Ather HTTP200 explicit bot gate stops at the first route: '+html.slice(7,35),async()=>{
 const urls=[]
 const provider=getScraperCatalog().find(p=>p.source==='atherenergy')
 await assert.rejects(createCatalogScraper(provider).run({fetchPage:async url=>{
  urls.push(url);return{url,status:200,html}
 }}),/access denied/i)
 assert.deepEqual(urls,[CAREERS_HOME_URL])
})
