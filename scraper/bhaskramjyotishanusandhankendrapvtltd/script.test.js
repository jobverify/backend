import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd scraper module at ./script.js')
  }
}

const dnsFailurePage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `getaddrinfo ENOTFOUND ${new URL(url).hostname}`,
})

const wrappedDnsFailure = () => {
  const cause = new Error('getaddrinfo ENOTFOUND bhaskram.com')
  cause.code = 'ENOTFOUND'
  cause.hostname = 'bhaskram.com'
  const error = new TypeError('fetch failed')
  error.cause = cause
  return error
}

test('Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd sentinel pins the verified absent first-party domains', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'bhaskramjyotishanusandhankendrapvtltd')
  assert.equal(scraper.COMPANY, 'Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.deepEqual(scraper.CANDIDATE_FIRST_PARTY_URLS, [
    'https://bhaskramjyotishanusandhankendrapvtltd.com/',
    'https://www.bhaskramjyotishanusandhankendrapvtltd.com/',
    'https://bhaskramjyotishanusandhankendrapvtltd.in/',
    'https://www.bhaskramjyotishanusandhankendrapvtltd.in/',
    'https://bhaskramjyotishanusandhankendra.com/',
    'https://www.bhaskramjyotishanusandhankendra.com/',
    'https://bhaskramjyotishanusandhankendra.in/',
    'https://www.bhaskramjyotishanusandhankendra.in/',
    'https://bhaskram.com/',
    'https://www.bhaskram.com/',
    'https://bhaskram.in/',
    'https://www.bhaskram.in/',
  ])

  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface(dnsFailurePage('https://bhaskram.com/')),
    true,
  )
  assert.equal(scraper.hasDnsResolutionFailure(wrappedDnsFailure()), true)
  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface({
      status: 'FETCH_ERROR',
      url: 'https://bhaskram.com/',
      html: '',
      errorMessage: 'fetch failed',
      error: wrappedDnsFailure(),
    }),
    true,
  )
  assert.equal(
    scraper.isVerifiedAbsentFirstPartySurface({
      status: 404,
      url: 'https://bhaskram.com/',
      html: '<html><body>Not found</body></html>',
      errorMessage: '',
    }),
    false,
  )
})

test('Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd sentinel returns [] only while every verified candidate first-party domain remains unresolved', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createBhaskramJyotishAnusandhanKendraPvtLtdScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return dnsFailurePage(url)
    },
  })

  assert.deepEqual(requestedUrls, scraper.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])
})

test('Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd sentinel fails closed when any candidate domain starts responding', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createBhaskramJyotishAnusandhanKendraPvtLtdScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CANDIDATE_FIRST_PARTY_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd</title></head>
                <body>
                  <h1>Bhaskram Jyotish Anusandhan Kendra Pvt. Ltd</h1>
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
