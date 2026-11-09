import assert from 'node:assert/strict'
import test from 'node:test'

const OFFICIAL_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Join the Rebel team | Rebel Foods</title>
  </head>
  <body>
    <main>
      <h2>Join the Rebel team</h2>
      <p>To apply for jobs at Rebel Foods, kindly email us at careers@rebelfoods.com</p>
    </main>
  </body>
</html>
`

const OFFICIAL_CAREERS_WITH_PUBLIC_JOBS_HTML = OFFICIAL_CAREERS_HTML.replace(
  '</main>',
  '<a href="https://jobs.lever.co/rebelfoods/senior-engineer">Apply Now</a></main>',
)

const loadRebelFoodsModule = async () => {
  try {
    return await import('../../scraper/rebelfoods/script.js')
  } catch {
    assert.fail('Expected Rebel Foods scraper module at ../../scraper/rebelfoods/script.js')
  }
}

test('Rebel Foods helpers pin the verified official careers page and email-apply contract', async () => {
  const rebelFoods = await loadRebelFoodsModule()

  assert.equal(rebelFoods.SOURCE, 'rebelfoods')
  assert.equal(rebelFoods.COMPANY, 'Rebel Foods')
  assert.equal(rebelFoods.HOMEPAGE_URL, 'https://www.rebelfoods.com/')
  assert.equal(rebelFoods.CAREERS_URL, 'https://www.rebelfoods.com/join-our-team')
  assert.equal(rebelFoods.CAREERS_EMAIL, 'careers@rebelfoods.com')
  assert.equal(rebelFoods.VERIFIED_ON, '2026-07-17')
  assert.equal(rebelFoods.hasOfficialCareersSignal(OFFICIAL_CAREERS_HTML), true)
  assert.equal(rebelFoods.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_HTML), false)
  assert.equal(rebelFoods.hasVisiblePublicJobsContract(OFFICIAL_CAREERS_WITH_PUBLIC_JOBS_HTML), true)
})

test('Rebel Foods returns [] only while the official careers page remains email-apply only', async () => {
  const rebelFoods = await loadRebelFoodsModule()
  const requests = []

  const jobs = await rebelFoods.createRebelFoodsScraper().run({
    fetchText: async (url) => {
      requests.push(url)
      if (url === rebelFoods.CAREERS_URL) return OFFICIAL_CAREERS_HTML
      throw new Error(`Unexpected Rebel Foods URL: ${url}`)
    },
  })

  assert.deepEqual(requests, [rebelFoods.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Rebel Foods fails closed when the official careers page changes materially or starts exposing a public jobs board', async () => {
  const rebelFoods = await loadRebelFoodsModule()

  await assert.rejects(
    rebelFoods.createRebelFoodsScraper().run({
      fetchText: async () => '<html><head><title>Unexpected</title></head><body></body></html>',
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    rebelFoods.createRebelFoodsScraper().run({
      fetchText: async () => OFFICIAL_CAREERS_WITH_PUBLIC_JOBS_HTML,
    }),
    /public jobs surface/i,
  )
})
