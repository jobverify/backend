import assert from 'node:assert/strict'
import test from 'node:test'
import {createIprogrammerSolutionsScraper,hasVerifiedOpeningsSignal} from './script.js'
const homepage='<title>iProgrammer | AI, Digital Engineering &amp; Odoo Company</title><h1>AI and Digital Engineering</h1>'
test('iProgrammer refuses a redesigned homepage returned by the former openings route',async()=>{
 assert.equal(hasVerifiedOpeningsSignal(homepage),false)
 await assert.rejects(createIprogrammerSolutionsScraper().run({fetchText:async()=>homepage}),/trusted first-party page/i)
})
