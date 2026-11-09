import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  HANDOFF_CTA,
  LINKEDIN_HOST,
  run,
} from '../../scraper/synup/script.js'

test('Synup reports inaccessible employer recruiting as a coverage gap', async () => {
  await assert.rejects(run({fetchImpl:async()=>{throw Error('offline')}}),{code:'SYNUP_COVERAGE_GAP'})
})

test('Synup documents its first-party-to-LinkedIn handoff contract', () => {
  assert.equal(CAREERS_URL, 'https://synup.com/careers')
  assert.equal(HANDOFF_CTA, 'SEE OPEN POSITIONS')
  assert.equal(LINKEDIN_HOST, 'www.linkedin.com')
})
