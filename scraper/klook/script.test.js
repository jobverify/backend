import assert from 'node:assert/strict'
import test from 'node:test'

import { createKlookScraper, hasMokaLoginSignal } from './script.js'

const loginPage = {
  status: 200,
  url: 'https://www.klookcareers.com/login?redirectUrl=%2Fjobs%2Fsearch%3Fpage%3D1',
  html: '<title>Moka: Login</title><p>Please do not disable JavaScript</p>',
}

test('Klook sentinel accepts the verified Moka login-gated jobs surface and returns no jobs', async () => {
  assert.equal(hasMokaLoginSignal(loginPage), true)
  assert.deepEqual(await createKlookScraper().run({ fetchPage: async () => loginPage }), [])
})

test('Klook sentinel fails open when the official jobs surface changes', async () => {
  await assert.rejects(
    () => createKlookScraper().run({
      fetchPage: async () => ({
        status: 200,
        url: 'https://www.klookcareers.com/jobs/search?page=1',
        html: '<title>See All Jobs</title><a href="/jobs/example">Example</a>',
      }),
    }),
    /changed from the verified Moka login-gated state/,
  )
})
