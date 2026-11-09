import assert from 'node:assert/strict'
import test from 'node:test'
import {createMonoceptScraper,SOURCE,COMPANY,CAREERS_URL,HANDOFF_URL} from '../../scraper/monocept/script.js'
import {nativeOptions} from '../../scraper/monocept/fixtures/options.js'
test('Monocept rejects an untrusted careers surface before public reader bootstrap',async()=>{
 const options=nativeOptions((p,u)=>{if(u===CAREERS_URL)p.body='<title>Unexpected</title>'})
 await assert.rejects(createMonoceptScraper().run(options))
 assert.equal(options.calls.some(c=>c.url.includes('/api/token/noauth')),false)
})
test('Monocept source factory carries the expected source and first-party handoff',()=>{
 assert.equal(SOURCE,'monocept');assert.equal(COMPANY,'Monocept');assert.equal(CAREERS_URL,'https://www.monocept.com/careers');assert.equal(HANDOFF_URL,'https://monocept.turbohire.co/careerpage/0e8227c1-c352-4202-8e40-c0aa16b6ca69')
})
