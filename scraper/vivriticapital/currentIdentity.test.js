import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { hasOfficialContactSignal } from './script.js'
const actual=await fs.readFile(new URL('./fixtures/current-identity.html',import.meta.url),'utf8')
test('vivriticapital accepts the current first-party identity',()=>assert.equal(hasOfficialContactSignal(actual),true))
test('vivriticapital retains employer identity and contact guards',()=>{
assert.equal(hasOfficialContactSignal(actual.replaceAll("Vivriti Capital","Another Lender")),false)
assert.equal(hasOfficialContactSignal(actual.replaceAll("sales@vivriticapital.com","sales@example.com")),false)
})
