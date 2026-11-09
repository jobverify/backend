import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected RSM Cyber Solutions scraper module at ./script.js')
  }
}

const dnsFailurePage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `getaddrinfo ENOTFOUND ${new URL(url).hostname}`,
})

test('RSM Cyber Solutions sentinel pins the verified absent first-party domains', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'rsmcybersolutions')
  assert.equal(scraper.COMPANY, 'RSM Cyber Solutions')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.deepEqual(scraper.CANDIDATE_FIRST_PARTY_URLS, [
    'https://rsmcybersolutions.com/',
    'https://www.rsmcybersolutions.com/',
    'https://rsmcybersolutions.in/',
    'https://www.rsmcybersolutions.in/',
    'https://rsmcybersolutions.co.in/',
    'https://www.rsmcybersolutions.co.in/',
    'https://rsmcyber.com/',
    'https://www.rsmcyber.com/',
    'https://rsmcyber.in/',
    'https://www.rsmcyber.in/',
  ])

  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface(dnsFailurePage('https://rsmcybersolutions.com/')),
    true,
  )
  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface({
      status: 404,
      url: 'https://rsmcybersolutions.com/',
      html: '<html><body>Not found</body></html>',
      errorMessage: '',
    }),
    false,
  )
})

test('RSM Cyber Solutions sentinel returns [] only while every verified candidate first-party domain remains unresolved', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createRsmCyberSolutionsScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return dnsFailurePage(url)
    },
  })

  assert.deepEqual(requestedUrls, scraper.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])
})

test('RSM Cyber Solutions sentinel fails closed when any candidate domain starts responding', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createRsmCyberSolutionsScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CANDIDATE_FIRST_PARTY_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>RSM Cyber Solutions</title></head>
                <body>
                  <h1>RSM Cyber Solutions</h1>
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
