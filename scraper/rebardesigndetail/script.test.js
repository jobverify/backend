import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Rebar Design & Detail scraper module at ./script.js')
  }
}

const dnsFailurePage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `getaddrinfo ENOTFOUND ${new URL(url).hostname}`,
})

test('Rebar Design & Detail sentinel pins the verified absent first-party domains', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'rebardesigndetail')
  assert.equal(scraper.COMPANY, 'Rebar Design & Detail')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.deepEqual(scraper.CANDIDATE_FIRST_PARTY_URLS, [
    'https://rebardesigndetail.com/',
    'https://www.rebardesigndetail.com/',
    'https://rebardesigndetail.in/',
    'https://www.rebardesigndetail.in/',
    'https://rebardesignanddetail.com/',
    'https://www.rebardesignanddetail.com/',
    'https://rebardesignanddetail.in/',
    'https://www.rebardesignanddetail.in/',
    'https://rebar-dd.com/',
    'https://www.rebar-dd.com/',
  ])

  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface(dnsFailurePage('https://rebardesigndetail.com/')),
    true,
  )
  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface({
      status: 404,
      url: 'https://rebardesigndetail.com/',
      html: '<html><body>Not found</body></html>',
      errorMessage: '',
    }),
    false,
  )
})

test('Rebar Design & Detail sentinel returns [] only while every verified candidate domain remains unresolved', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createRebarDesignAndDetailScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return dnsFailurePage(url)
    },
  })

  assert.deepEqual(requestedUrls, scraper.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])
})

test('Rebar Design & Detail sentinel fails closed when any candidate domain starts responding', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createRebarDesignAndDetailScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CANDIDATE_FIRST_PARTY_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Rebar Design & Detail</title></head>
                <body>
                  <h1>Rebar Design & Detail</h1>
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
