import assert from 'node:assert/strict'
import test from 'node:test'

const LEGACY_HOMEPAGE_URL = 'https://www.fincarebank.com/'
const LEGACY_HOMEPAGE_NO_WWW_URL = 'https://fincarebank.com/'
const MERGED_PARENT_HOMEPAGE_URL = 'https://www.au.bank.in/'

const auHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Personal, Business, Corporate, and NRI Banking | AU Small Finance Bank</title>
    <link rel="canonical" href="https://www.au.bank.in/" />
  </head>
  <body>
    <nav>
      <a href="/about-us">About us</a>
      <a href="https://ib.au.bank.in">Fincare NetBanking</a>
      <a href="https://corporate.au.bank.in">Fincare Corporate NetBanking</a>
    </nav>
    <main>
      <h1>AU Small Finance Bank</h1>
      <p>Personal, Business, Corporate, and NRI Banking</p>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/fincaresmallfinancebank/script.js')
  } catch {
    assert.fail('Expected Fincare Small Finance Bank scraper module at ../../scraper/fincaresmallfinancebank/script.js')
  }
}

test('Fincare Small Finance Bank helpers stay pinned to the verified legacy redirect contract', async () => {
  const fincare = await loadModule()

  assert.equal(fincare.SOURCE, 'fincaresmallfinancebank')
  assert.equal(fincare.COMPANY, 'Fincare Small Finance Bank')
  assert.equal(fincare.OFFICIAL_BRAND_NAME, 'Fincare Small Finance Bank')
  assert.equal(fincare.VERIFIED_ON, '2026-07-15')
  assert.equal(fincare.LEGACY_HOMEPAGE_URL, LEGACY_HOMEPAGE_URL)
  assert.equal(fincare.LEGACY_HOMEPAGE_NO_WWW_URL, LEGACY_HOMEPAGE_NO_WWW_URL)
  assert.equal(fincare.MERGED_PARENT_HOMEPAGE_URL, MERGED_PARENT_HOMEPAGE_URL)
  assert.equal(fincare.hasMergedParentHomepageSignal(auHomepageHtml), true)
  assert.equal(
    fincare.isVerifiedMergedHomepageRedirect({
      status: 200,
      url: MERGED_PARENT_HOMEPAGE_URL,
      html: auHomepageHtml,
    }),
    true,
  )
})

test('run returns an empty array after validating that the legacy Fincare domains now resolve to AU homepage content', async () => {
  const fincare = await loadModule()
  const requestedUrls = []

  const jobs = await fincare.createFincareSmallFinanceBankScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)
      if (url === MERGED_PARENT_HOMEPAGE_URL) {
        return {
          status: 200,
          url: MERGED_PARENT_HOMEPAGE_URL,
          html: auHomepageHtml,
        }
      }
      if (url === LEGACY_HOMEPAGE_URL) {
        return {
          status: 200,
          url: MERGED_PARENT_HOMEPAGE_URL,
          html: auHomepageHtml,
        }
      }
      if (url === LEGACY_HOMEPAGE_NO_WWW_URL) {
        return {
          status: 200,
          url: MERGED_PARENT_HOMEPAGE_URL,
          html: auHomepageHtml,
        }
      }
      throw new Error(`Unexpected Fincare Small Finance Bank URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    MERGED_PARENT_HOMEPAGE_URL,
    LEGACY_HOMEPAGE_URL,
    LEGACY_HOMEPAGE_NO_WWW_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('run fails closed when the legacy redirect target or the merged AU homepage contract drifts', async () => {
  const fincare = await loadModule()

  await assert.rejects(
    fincare.createFincareSmallFinanceBankScraper().run({
      fetchPage: async (url) => {
        if (url === MERGED_PARENT_HOMEPAGE_URL) {
          return {
            status: 200,
            url: MERGED_PARENT_HOMEPAGE_URL,
            html: auHomepageHtml,
          }
        }
        if (url === LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: 'https://www.example.com/',
            html: auHomepageHtml,
          }
        }
        throw new Error(`Unexpected Fincare Small Finance Bank URL: ${url}`)
      },
    }),
    /verified legacy Fincare homepage redirect/i,
  )

  await assert.rejects(
    fincare.createFincareSmallFinanceBankScraper().run({
      fetchPage: async (url) => {
        if (url === MERGED_PARENT_HOMEPAGE_URL) {
          return {
            status: 200,
            url: MERGED_PARENT_HOMEPAGE_URL,
            html: auHomepageHtml,
          }
        }
        if (url === LEGACY_HOMEPAGE_URL) {
          return {
            status: 200,
            url: MERGED_PARENT_HOMEPAGE_URL,
            html: auHomepageHtml.replace('Fincare NetBanking', 'Retail NetBanking'),
          }
        }
        throw new Error(`Unexpected Fincare Small Finance Bank URL: ${url}`)
      },
    }),
    /verified merged AU homepage/i,
  )
})
