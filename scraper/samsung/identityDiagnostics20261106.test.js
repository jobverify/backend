import assert from 'node:assert/strict'
import test from 'node:test'
import { run } from './script.js'
import { freshFetch } from './freshReplay.js'

const BOARD = 'https://sec.wd3.myworkdayjobs.com/Samsung_Careers'

for (const [label, change, reason] of [
  ['blank title', row => { row.title = '' }, 'missing-title'],
  ['query and fragment', row => { row.externalPath += '?token=query-must-stay-private#fragment-must-stay-private' }, 'invalid-external-path'],
  ['requisition conflict', row => { row.bulletFields = ['R999999999'] }, 'listing-requisition-mismatch'],
]) test('Samsung identifies a rejected ' + label + ' without logging response payload or secrets', async () => {
  let originalPath
  await assert.rejects(run({ fetchImpl: freshFetch(record => {
    if (record.requestBody?.offset === 20 && Object.keys(record.requestBody.appliedFacets).length === 0) {
      const page = JSON.parse(record.body)
      const row = page.jobPostings[3]
      originalPath = row.externalPath
      row.privatePayloadControl = 'payload-must-stay-private'
      change(row)
      record.body = JSON.stringify(page)
    }
    return record
  }) }), error => {
    assert.match(error.message, /Samsung native incomplete: (?:invalid listing identity|listing requisition mismatch)/)
    assert.notEqual(error.softFailure, true)
    assert.deepEqual(error.listingIdentity, { reason, board: BOARD, rowIndex: 23, externalPath: originalPath })
    assert.ok(error.message.includes(JSON.stringify(error.listingIdentity)))
    assert.doesNotMatch(error.message, /(?:payload|query|fragment)-must-stay-private/)
    return true
  })
})
