import assert from 'node:assert/strict'
import test from 'node:test'

const parkedPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Literact.com is for sale</title>
  </head>
  <body>
    <div class="brand">Sparkname</div>
    <h1>Literact.com is for sale!</h1>
    <script>
      window.pricing = {"careers":{"price":27.3},"care":{"price":16.4}};
    </script>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Join our team</h1>
    <p>Open positions available now</p>
    <a href="https://jobs.lever.co/example/software-engineer">Apply now</a>
  </body>
</html>
`

const unresolvedHostError = Object.assign(new TypeError('fetch failed'), {
  cause: { code: 'ENOTFOUND' },
})

const loadModule = async () => {
  try {
    return await import('../../scraper/literactfintech/script.js')
  } catch {
    assert.fail('Expected Literact Fintech scraper module at ../../scraper/literactfintech/script.js')
  }
}

test('Literact Fintech parked-domain sentinel ignores Sparkname pricing metadata and stays pinned to the verified for-sale page', async () => {
  const literactFintech = await loadModule()

  assert.equal(literactFintech.SOURCE, 'literactfintech')
  assert.equal(literactFintech.COMPANY, 'Literact Fintech')
  assert.equal(literactFintech.VERIFIED_ON, '2026-08-03')
  assert.deepEqual(literactFintech.CANONICAL_URLS, [
    'https://literactfintech.com/',
    'https://www.literactfintech.com/',
    'https://literactfintech.in/',
    'https://www.literactfintech.in/',
  ])
  assert.equal(
    literactFintech.isVerifiedParkedPage({
      finalUrl: 'https://www.sparkname.com/name/Literact.com',
      html: parkedPageHtml,
    }),
    true,
  )
  assert.equal(literactFintech.hasPublicJobSignal(parkedPageHtml), false)
  assert.equal(literactFintech.hasPublicJobSignal(publicJobsHtml), true)
  assert.equal(literactFintech.isExpectedUnresolvedHostError(unresolvedHostError), true)
})

test('Literact Fintech returns [] while every canonical URL is unresolved and the parked Sparkname page is intact', async () => {
  const literactFintech = await loadModule()
  const requestedUrls = []

  const jobs = await literactFintech.createLiteractFintechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === literactFintech.PARKED_DOMAIN_URL) {
        return {
          finalUrl: 'https://www.sparkname.com/name/Literact.com',
          html: parkedPageHtml,
        }
      }

      throw unresolvedHostError
    },
  })

  assert.deepEqual(requestedUrls, [
    ...literactFintech.CANONICAL_URLS,
    literactFintech.PARKED_DOMAIN_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Literact Fintech fails closed when a canonical URL resolves or the parked page really exposes public jobs', async () => {
  const literactFintech = await loadModule()

  await assert.rejects(
    literactFintech.createLiteractFintechScraper().run({
      fetchPage: async (url) => {
        if (url === literactFintech.CANONICAL_URLS[0]) {
          return {
            finalUrl: literactFintech.CANONICAL_URLS[0],
            html: '<html><body>Resolved</body></html>',
          }
        }

        throw unresolvedHostError
      },
    }),
    /canonical URL responded/i,
  )

  await assert.rejects(
    literactFintech.createLiteractFintechScraper().run({
      fetchPage: async (url) => {
        if (url === literactFintech.PARKED_DOMAIN_URL) {
          return {
            finalUrl: 'https://www.sparkname.com/name/Literact.com',
            html: publicJobsHtml,
          }
        }

        throw unresolvedHostError
      },
    }),
    /parked domain now appears to expose public jobs/i,
  )
})
