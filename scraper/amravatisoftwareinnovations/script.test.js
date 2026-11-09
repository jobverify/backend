import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Amravati Software Innovations scraper module at ./script.js')
  }
}

const dnsFailurePage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `getaddrinfo ENOTFOUND ${new URL(url).hostname}`,
})

test('Amravati Software Innovations sentinel pins the verified absent first-party domains', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'amravatisoftwareinnovations')
  assert.equal(scraper.COMPANY, 'Amravati Software Innovations')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.deepEqual(scraper.CANDIDATE_FIRST_PARTY_URLS, [
    'https://amravatisoftwareinnovations.com/',
    'https://www.amravatisoftwareinnovations.com/',
    'https://amravatisoftwareinnovations.in/',
    'https://www.amravatisoftwareinnovations.in/',
    'https://amravatisoftware.com/',
    'https://www.amravatisoftware.com/',
  ])

  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface(dnsFailurePage('https://amravatisoftwareinnovations.com/')),
    true,
  )
  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface({
      status: 404,
      url: 'https://amravatisoftwareinnovations.com/',
      html: '<html><body>Not found</body></html>',
      errorMessage: '',
    }),
    false,
  )
  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface({
      status: 'FETCH_ERROR',
      url: 'https://amravatisoftwareinnovations.com/',
      html: '',
      errorMessage: '[amravatisoftwareinnovations] All 1 attempts failed. Last error: fetch failed',
      error: {
        cause: {
          message: 'fetch failed',
          cause: {
            code: 'ENOTFOUND',
            message: 'getaddrinfo ENOTFOUND amravatisoftwareinnovations.com',
          },
        },
      },
    }),
    true,
  )
})

test('Amravati Software Innovations sentinel returns [] only while every verified candidate first-party domain remains unresolved', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createAmravatiSoftwareInnovationsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return dnsFailurePage(url)
    },
  })

  assert.deepEqual(requestedUrls, scraper.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])
})

test('Amravati Software Innovations sentinel fails closed when any candidate domain starts responding', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createAmravatiSoftwareInnovationsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CANDIDATE_FIRST_PARTY_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Amravati Software Innovations</title></head>
                <body>
                  <h1>Amravati Software Innovations</h1>
                  <a href="/careers">Careers</a>
                </body>
              </html>
            `,
            errorMessage: '',
          }
        }

        return dnsFailurePage(url)
      },
    }),
    /verified absent first-party surface changed/i,
  )
})
