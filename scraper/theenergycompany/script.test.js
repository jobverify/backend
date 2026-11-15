import assert from 'node:assert/strict'
import test from 'node:test'
import {SOURCE,COMPANY,HOMEPAGE_URL,CAREERS_URL,createTheEnergyCompanyScraper} from './script.js'

test('The ENERGY COMPANY retains the original configured company and own public roots',()=>{
  assert.equal(SOURCE,'theenergycompany');assert.equal(COMPANY,'The ENERGY COMPANY')
  assert.equal(HOMEPAGE_URL,'https://www.energycompany.in/')
  assert.equal(CAREERS_URL,'https://www.energycompany.in/we-are-hiring')
})
test('The ENERGY COMPANY public factory cannot qualify legacy body-only role cards or invent India from city labels',async()=>{
  let calls=0
  await assert.rejects(createTheEnergyCompanyScraper().run({fetchPage:async()=>{calls++;return{status:200,url:CAREERS_URL,html:'<div class="role-card"><div class="role-title">Engineer</div><div class="role-loc">Bengaluru</div><p>Apply now</p></div>'}}}),/native HTTP metadata required/i)
  assert.equal(calls,0)
})
