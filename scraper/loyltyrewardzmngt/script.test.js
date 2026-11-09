import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREERS_URL,
  COMPANY,
  SOURCE,
  createLoyltyRewardzMngtScraper,
  hasOfficialCareersSignal,
  hasPublicJobsSignal,
} from './script.js'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Loylty Rewardz</title>
  </head>
  <body>
    <h1>Nurturing excellence in the workplace with integrity, focus and compassion</h1>
    <p>Bringing value to the workplace for a well-rounded worklife</p>
    <section>
      <h2>Health &amp; Wellness</h2>
      <p>Along with an official Mediclaim policy in place, we also arrange for regular health and wellness checkups.</p>
    </section>
    <footer>© 2024 Loylty Rewardz Mngt Pvt. Ltd. All rights reserved.</footer>
  </body>
</html>
`

test('Loylty Rewardz Mngt still recognizes the verified no-public-jobs careers surface with encoded ampersands', () => {
  assert.equal(SOURCE, 'loyltyrewardzmngt')
  assert.equal(COMPANY, 'Loylty Rewardz Mngt')
  assert.equal(CAREERS_URL, 'https://loylty.com/about/careers/')
  assert.equal(hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hasPublicJobsSignal(careersHtml), false)
})

test('run returns no jobs while the Loylty careers page remains culture-only', async () => {
  const jobs = await createLoyltyRewardzMngtScraper().run({
    fetchText: async (url) => {
      assert.equal(url, CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('run fails closed when the Loylty page starts exposing public job language', async () => {
  await assert.rejects(
    createLoyltyRewardzMngtScraper().run({
      fetchText: async () => `${careersHtml}<a href="/jobs">View all jobs</a>`,
    }),
    /now exposes a public jobs surface/i,
  )
})
