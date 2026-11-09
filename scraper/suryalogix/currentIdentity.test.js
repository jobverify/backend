import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { hasOfficialHomepageSignal } from './script.js'
const actual=await fs.readFile(new URL('./fixtures/current-identity.html',import.meta.url),'utf8')
test('suryalogix accepts the current first-party identity',()=>assert.equal(hasOfficialHomepageSignal(actual),true))
test('suryalogix retains employer identity and contact guards',()=>{
assert.equal(hasOfficialHomepageSignal(actual.replaceAll("Renewable Energy Monitoring","Generic Monitoring")),false)
assert.equal(hasOfficialHomepageSignal(actual.replaceAll("sales@suryalogix.com","sales@example.com")),false)
})
