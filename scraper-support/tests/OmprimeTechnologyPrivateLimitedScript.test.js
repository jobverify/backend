import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>We Are Looking For You!</h2>
    <div>Jobs List</div>
    <div>Choose Region:</div>
    <div>MD</div>
    <a href="https://omprime.com/careers/customer-support-chat/">Customer Support – Chat</a>
    <a href="https://omprime.com/careers/head-of-customer-care/">Head of Customer Care</a>
    <a href="https://omprime.com/careers/travel-consultant-exchange-specialist/">Travel Consultant – Exchange Specialist</a>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/omprimetechnologyprivatelimited/script.js')
  } catch {
    assert.fail('Expected Omprime Technology Private Limited scraper module at ../../scraper/omprimetechnologyprivatelimited/script.js')
  }
}

test('Omprime Technology Private Limited helpers stay pinned to the verified first-party careers page', async () => {
  const omprime = await loadModule()

  assert.equal(omprime.SOURCE, 'omprimetechnologyprivatelimited')
  assert.equal(omprime.COMPANY, 'Omprime Technology Private Limited')
  assert.equal(omprime.CAREERS_URL, 'https://omprime.com/careers/')
  assert.equal(omprime.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(omprime.extractJobCards(careersHtml), [
    {
      title: 'Customer Support – Chat',
      sourceUrl: 'https://omprime.com/careers/customer-support-chat/',
      region: 'MD',
    },
    {
      title: 'Head of Customer Care',
      sourceUrl: 'https://omprime.com/careers/head-of-customer-care/',
      region: 'MD',
    },
    {
      title: 'Travel Consultant – Exchange Specialist',
      sourceUrl: 'https://omprime.com/careers/travel-consultant-exchange-specialist/',
      region: 'MD',
    },
  ])
})

test('Omprime Technology Private Limited run validates the page and filters non-India listings', async () => {
  const omprime = await loadModule()
  const requestedUrls = []

  const jobs = await omprime.createOmprimeTechnologyPrivateLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === omprime.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected Omprime URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [omprime.CAREERS_URL])
  assert.deepEqual(jobs, [])
})

test('Omprime Technology Private Limited fails closed when the verified careers page drifts', async () => {
  const omprime = await loadModule()

  await assert.rejects(
    omprime.createOmprimeTechnologyPrivateLimitedScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified omprime careers page/i,
  )
})
