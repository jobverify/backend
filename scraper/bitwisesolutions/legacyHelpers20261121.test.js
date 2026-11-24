import test from 'node:test'
import assert from 'node:assert/strict'
import {hasOfficialCareersSignal,hasNoOpeningsSignal} from './script.js'
import {originalPacket,originalText} from './fixtures/currentReplay20261121.js'

test('retained-body compatibility keeps the original pure careers predicate export',()=>{
 const careers=originalPacket.records.find(record=>record.requestedUrl==='https://www.bitwiseglobal.com/company/careers')
 assert.equal(hasOfficialCareersSignal(originalText(careers)),true)
 assert.equal(hasOfficialCareersSignal('<h1>Unrelated Careers</h1>'),false)
})
test('historical pure zero predicate stays isolated from current inventory proof',()=>{
 const openings=originalPacket.records.find(record=>record.requestedUrl==='https://www.bitwiseglobal.com/company/careers/openings'),role=originalPacket.records.find(record=>record.requestedUrl.endsWith('/6085-project-manager'))
 assert.equal(hasNoOpeningsSignal(originalText(openings)),true)
 assert.equal(hasNoOpeningsSignal(originalText(role)),false)
 // The retained predicate intentionally remains compatible. Current factory
 // collection and explicit body-only evidence tests prove it supplies no zero.
 assert.equal(originalPacket.closingOriginals,0)
})
