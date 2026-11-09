import test from 'node:test'
import assert from 'node:assert/strict'
import{createAngelOneScraper}from'../../scraper/angelone/script.js'

test('angelone current source exposes bounded collection and rejects obsolete metadata-free sentinel transports',async()=>{const scraper=createAngelOneScraper();assert.equal(typeof scraper.collect,'function');await assert.rejects(scraper.run({fetchPage:async()=>({status:200,html:'old shell'})}),/status|source/i)})
test('angelone registered source preserves actual public denial instead of returning unexplained empty',async()=>{let calls=0;await assert.rejects(createAngelOneScraper().run({fetchImpl:async target=>{calls++;assert.equal(target,'https://www.angelone.in/careers');return new Response('unavailable',{status:403})}}),e=>e.status===403&&e.abortRetries===true);assert.equal(calls,1)})
