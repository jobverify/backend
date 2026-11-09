import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Crownit</title>
  </head>
  <body>
    <h1>Looking for career opportunities with us?</h1>
    <p>Ours is a team honed by hard work, dedication and sheer will to become a champion.</p>
    <p>We do not shy away from work tirelessly to inch closer to the future that we have envisioned for ourselves.</p>
    <p>We are always on the lookout for like-minded individuals with strong work ethics and a passion to create something.</p>
    <p>If our vision moves you too, come and join our awe-inspiring team.</p>
    <button class="contact-btn">Apply for job</button>
    <app-contactus career="2" source="career"></app-contactus>
    <a href="https://www.linkedin.com/company/goldvip/"></a>
    <p>Ipsos Research Private Limited</p>
  </body>
</html>
`

test('Crownit accepts the current first-party non-enumerable careers surface without a public jobs board', async () => {
  const crownit = await loadModule()

  assert.doesNotThrow(() => crownit.assertVerifiedPublicCareersSurface(careersHtml))
  assert.doesNotThrow(() => crownit.assertVerifiedNonEnumerableApplyFlow(careersHtml))
  assert.doesNotThrow(() => crownit.assertNoPublicJobsSurface(careersHtml, crownit.CAREERS_URL))
})

test('Crownit still returns an empty result on the verified internal apply flow', async () => {
  const crownit = await loadModule()

  const jobs = await crownit.createCrownitScraper().run({
    fetchHtml: async (url) => {
      assert.equal(url, crownit.CAREERS_URL)
      return careersHtml
    },
  })

  assert.deepEqual(jobs, [])
})
