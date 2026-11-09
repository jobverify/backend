import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Technologics Global Research & Project scraper module at ./script.js')
  }
}

const dnsFailurePage = (url) => ({
  status: 'DNS_ERROR',
  url,
  html: '',
  errorMessage: `getaddrinfo ENOTFOUND ${new URL(url).hostname}`,
})

test('Technologics Global Research & Project sentinel pins the verified no-signal first-party surface', async () => {
  const scraper = await loadModule()

  assert.equal(scraper.SOURCE, 'technologicsglobalresearchproject')
  assert.equal(scraper.COMPANY, 'Technologics Global Research & Project')
  assert.equal(scraper.VERIFIED_AT, '2026-07-13')
  assert.equal(
    scraper.VERIFIED_SURFACE_SUMMARY,
    'No trustworthy first-party public website or careers surface was discoverable on July 13, 2026, and the canonical company-name domains were unresolved.',
  )
  assert.deepEqual(scraper.CANDIDATE_FIRST_PARTY_URLS, [
    'https://technologicsglobalresearchproject.com/',
    'https://www.technologicsglobalresearchproject.com/',
    'https://technologicsglobalresearchproject.in/',
    'https://www.technologicsglobalresearchproject.in/',
    'https://technologicsglobalresearchandproject.com/',
    'https://www.technologicsglobalresearchandproject.com/',
    'https://technologicsglobalresearchandproject.in/',
    'https://www.technologicsglobalresearchandproject.in/',
  ])

  assert.equal(
    scraper.hasDnsResolutionFailure('getaddrinfo ENOTFOUND technologicsglobalresearchproject.com'),
    true,
  )
  assert.equal(
    scraper.hasDnsResolutionFailure('connect ETIMEDOUT technologicsglobalresearchproject.com'),
    false,
  )
  assert.equal(
    scraper.isVerifiedNoSignalFirstPartySurface(dnsFailurePage('https://technologicsglobalresearchproject.com/')),
    true,
  )
  assert.equal(
    scraper.isVerifiedNoSignalFirstPartySurface({
      status: 'DNS_ERROR',
      url: 'https://technologicsglobalresearchproject.com/',
      html: '<html><body>Unexpected shell</body></html>',
      errorMessage: 'getaddrinfo ENOTFOUND technologicsglobalresearchproject.com',
    }),
    false,
  )
  assert.equal(
    scraper.isVerifiedNoSignalFirstPartySurface({
      status: 200,
      url: 'https://technologicsglobalresearchproject.com/',
      html: '<html><body>Technologics Global Research & Project</body></html>',
      errorMessage: '',
    }),
    false,
  )
  assert.equal(
    scraper.isVerifiedNoSignalFirstPartySurface({
      status: 'FETCH_ERROR',
      url: 'https://technologicsglobalresearchproject.com/',
      html: '',
      errorMessage:
        '[technologicsglobalresearchproject] All 3 attempts failed. Last error: fetch failed | getaddrinfo ENOTFOUND technologicsglobalresearchproject.com',
    }),
    true,
  )
})

test('Technologics Global Research & Project sentinel returns [] only while every verified candidate domain stays unresolved', async () => {
  const scraper = await loadModule()
  const requestedUrls = []

  const jobs = await scraper.createTechnologicsGlobalResearchProjectScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      return dnsFailurePage(url)
    },
  })

  assert.deepEqual(requestedUrls, scraper.CANDIDATE_FIRST_PARTY_URLS)
  assert.deepEqual(jobs, [])
})

test('Technologics Global Research & Project sentinel fails closed when any candidate first-party domain starts responding', async () => {
  const scraper = await loadModule()

  await assert.rejects(
    scraper.createTechnologicsGlobalResearchProjectScraper().run({
      fetchPage: async (url) => {
        if (url === scraper.CANDIDATE_FIRST_PARTY_URLS[0]) {
          return {
            status: 200,
            url,
            html: `
              <html>
                <head><title>Technologics Global Research & Project</title></head>
                <body>
                  <h1>Technologics Global Research & Project</h1>
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
    /verified no-signal first-party surface changed/i,
  )
})
