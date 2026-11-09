import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected SKXEM Management LLP scraper module at ./script.js')
  }
}

const dnsFailurePage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `getaddrinfo ENOTFOUND ${new URL(url).hostname}`,
})

test('SKXEM Management LLP sentinel pins the verified absent first-party domains', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'skxemmanagementllp')
  assert.equal(scraper.COMPANY, 'SKXEM Management LLP')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.deepEqual(scraper.CANDIDATE_FIRST_PARTY_URLS, [
    'https://skxem.com/',
    'https://www.skxem.com/',
    'https://skxem.in/',
    'https://www.skxem.in/',
    'https://skxemmanagement.com/',
    'https://www.skxemmanagement.com/',
    'https://skxemmanagementllp.com/',
    'https://www.skxemmanagementllp.com/',
    'https://skxemmanagementllp.in/',
    'https://www.skxemmanagementllp.in/',
  ])

  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface(dnsFailurePage('https://skxem.com/')),
    true,
  )
  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface({
      status: 404,
      url: 'https://skxem.com/',
      html: '<html><body>Not found</body></html>',
      errorMessage: '',
    }),
    false,
  )
})

test('SKXEM Management LLP sentinel returns [] only while every verified candidate first-party domain remains unresolved', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createSkxemManagementLlpScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return dnsFailurePage(url)
    },
  })

  assert.deepEqual(requestedUrls, scraper.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])
})

test('SKXEM Management LLP sentinel fails closed when any candidate domain starts responding', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createSkxemManagementLlpScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CANDIDATE_FIRST_PARTY_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>SKXEM Management LLP</title></head>
                <body>
                  <h1>SKXEM Management LLP</h1>
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
