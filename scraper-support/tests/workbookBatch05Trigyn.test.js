import assert from 'node:assert/strict'
import test from 'node:test'

import {
  BLOCKED_LISTING_CONTRACT,
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createTrigynScraper,
  run,
} from '../../scraper/trigyn/script.js'

test('batch 05 Trigyn reports unavailable inventory instead of silently returning no jobs', async () => {
  assert.equal(SOURCE, 'trigyn')
  assert.equal(COMPANY, 'Trigyn')
  assert.equal(CAREERS_URL, 'https://www.trigyn.com/careers')
  assert.match(BLOCKED_LISTING_CONTRACT, /no enumerable first-party jobs response/i)
  assert.match(BLOCKED_LISTING_CONTRACT, /unlinked \/job\/ detail pages/i)

  const fetch = async () => ({status: 200, url: CAREERS_URL,
    text: async () => '<html><title>Career Opportunity | Trigyn</title><body><div id="ajax-wrapper"></div></body></html>'})
  await assert.rejects(createTrigynScraper().run({fetch}), /listing inventory|listing|contract/i)
  await assert.rejects(run({fetch}), /listing inventory|listing|contract/i)
})
