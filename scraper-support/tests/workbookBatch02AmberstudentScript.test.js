import assert from 'node:assert/strict'
import test from 'node:test'
import {run} from '../../scraper/amberstudent/script.js'
test('Amber refuses the retired unlinked SmartRecruiters marketing contract', async () => {
 const old='<title>Careers at Amber - Join Our Team</title>Your Next Big Break Find Roles Amber'
 await assert.rejects(run({fetchText:async()=>old,fetchJson:async()=>assert.fail('unverified old board must not be fetched')}),/careers handoff/i)
})
