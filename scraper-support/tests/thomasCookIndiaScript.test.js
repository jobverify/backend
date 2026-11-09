import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  createThomasCookIndiaScraper,
  hasVerifiedFormOnlySurface,
} from '../../scraper/thomascookindia/script.js'

const verifiedPage = {
  status: 200,
  url: CAREERS_URL,
  html: '<h2>Work with Us</h2><form id="contact-form"><h2>Submit Your CV</h2></form>',
}

test('Thomas Cook India sentinel accepts the verified first-party form-only surface', async () => {
  assert.equal(hasVerifiedFormOnlySurface(verifiedPage), true)
  assert.deepEqual(
    await createThomasCookIndiaScraper().run({ fetchPage: async () => verifiedPage }),
    [],
  )
})

test('Thomas Cook India sentinel rejects a newly enumerable public jobs surface', async () => {
  const changedPage = {
    ...verifiedPage,
    html: `${verifiedPage.html}<h3>Current Openings</h3><a href="/jobs/example">Apply now</a>`,
  }

  assert.equal(hasVerifiedFormOnlySurface(changedPage), false)
  await assert.rejects(
    () => createThomasCookIndiaScraper().run({ fetchPage: async () => changedPage }),
    /changed from the verified form-only state/,
  )
})
