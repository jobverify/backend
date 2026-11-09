import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { hasOfficialContactSignal } from './script.js'
const actual=await fs.readFile(new URL('./fixtures/current-identity.html',import.meta.url),'utf8')
test('pletratechnologiesindiapvtltd accepts the current first-party identity',()=>assert.equal(hasOfficialContactSignal(actual),true))
test('pletratechnologiesindiapvtltd retains employer identity and contact guards',()=>{
assert.equal(hasOfficialContactSignal(actual.replace(/PletraTech/gi,"OtherCompany")),false)
assert.equal(hasOfficialContactSignal(actual.replaceAll("info@pletratech.com","info@example.com")),false)
})
