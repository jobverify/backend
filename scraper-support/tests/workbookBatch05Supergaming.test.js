import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  CONTACT_EMAIL,
  run,
} from '../../scraper/supergaming/script.js'

test('SuperGaming email recruiting does not establish a zero job inventory', async () => {
  assert.equal(CAREERS_URL, 'https://www.supergaming.com/careers')
  assert.equal(CONTACT_EMAIL, 'careers@supergaming.com')
  await assert.rejects(run({fetchImpl:async url=>({status:503,url,text:async()=>''})}),error=>
    error.code==='SUPERGAMING_COVERAGE_GAP'&&error.inventoryEvidence.reportedTotal===null)
})
