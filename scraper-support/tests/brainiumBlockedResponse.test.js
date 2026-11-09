import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.fetch=()=>{throw Error('OFFLINE Brainium guard network tripwire')}
const {getScraperCatalog,createCatalogScraper}=await import('../providers/index.js')
const provider=getScraperCatalog().find(p=>p.source==='brainiuminformationtechnologies')
const legacyBlockedShell='<title>Attention Required! | Cloudflare</title><p>Please enable cookies.</p><p>Sorry, you have been blocked</p><p>You are unable to access brainiuminfotech.com</p><p>Cloudflare Ray ID: synthetic</p>'

for(const status of [401,403,429])test(`Brainium HTTP${status} cannot return empty inventory or request another route`,async()=>{
 const calls=[]
 await assert.rejects(createCatalogScraper(provider).run({fetchPage:async url=>{
  calls.push(url)
  return{url,status,headers:{server:'cloudflare','cf-ray':'synthetic'},html:legacyBlockedShell}
 }}),error=>error.status===status&&/access denied/i.test(error.message))
 assert.deepEqual(calls,[provider.companyCareerPage])
})

test('Brainium explicit bot gate in HTTP200 stops before a second request',async()=>{
 let calls=0
 await assert.rejects(createCatalogScraper(provider).run({fetchPage:async url=>{
  calls++;return{url,status:200,html:legacyBlockedShell}
 }}),/access denied/i)
 assert.equal(calls,1)
})
