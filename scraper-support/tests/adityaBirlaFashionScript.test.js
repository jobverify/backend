import assert from 'node:assert/strict'
import test from 'node:test'

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <p>The Biggest Brands and Best People' is the ideology that steers ABFRL.</p>
      <p>Our unique employee value proposition, 'A World of Opportunities,' reflects this attitude.</p>
      <h2>Current Openings</h2>
      <a href="https://careers.adityabirla.com/apparel-retail">View More Openings</a>
      <a href="https://abfrlcareers.peoplestrong.com/home">Store Manager Openings in ABFRL</a>
    </main>
  </body>
</html>
`

const fashionRetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Fashion & Retail</h1>
    <p>Aditya Birla Fashion and Retail stands as India's first billion-dollar pure-play fashion powerhouse.</p>
    <h2>Current <span>vacancies</span> in Fashion &amp; Retail</h2>
    <h3>No Jobs Available</h3>
    <p>Currently, we have no vacancies in this sector. Please upload your resume for future opportunities, or discover jobs in other businesses.</p>
  </body>
</html>
`

const groupJobSearchHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Search Jobs at Aditya Birla Group</h1>
    <p>Showing 1<span>-</span>0 jobs out of 0</p>
    <h3>No Jobs Available</h3>
    <p>Currently, we have no vacancies in this sector. Please upload your resume for future opportunities, or discover jobs in other businesses.</p>
  </body>
</html>
`

const brokenStoreManagerPage = {
  status: 404,
  url: 'https://abfrlcareers.peoplestrong.com/home',
  html: '<html><body><h1>404</h1><p>Not Found</p></body></html>',
}

const loadAdityaBirlaFashionModule = async () => {
  try {
    return await import('../../scraper/adityabirlafashion/script.js')
  } catch {
    assert.fail('Expected Aditya Birla Fashion scraper module at ../../scraper/adityabirlafashion/script.js')
  }
}

test('Aditya Birla Fashion scraper pins the verified ABFRL careers page and both public handoffs', async () => {
  const adityaBirlaFashion = await loadAdityaBirlaFashionModule()

  assert.equal(adityaBirlaFashion.SOURCE, 'adityabirlafashion')
  assert.equal(adityaBirlaFashion.COMPANY, 'Aditya Birla Fashion')
  assert.equal(adityaBirlaFashion.CAREERS_URL, 'https://www.abfrl.com/careers/')
  assert.equal(
    adityaBirlaFashion.FASHION_RETAIL_OPENINGS_URL,
    'https://careers.adityabirla.com/fashion-retail',
  )
  assert.equal(
    adityaBirlaFashion.GROUP_JOB_SEARCH_URL,
    'https://careers.adityabirla.com/job-search',
  )
  assert.equal(
    adityaBirlaFashion.STORE_MANAGER_OPENINGS_URL,
    'https://abfrlcareers.peoplestrong.com/home',
  )
  assert.equal(adityaBirlaFashion.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.deepEqual(adityaBirlaFashion.extractVerifiedHandoffUrls(officialCareersHtml), {
    fashionRetailOpeningsUrl: 'https://careers.adityabirla.com/fashion-retail',
    storeManagerOpeningsUrl: 'https://abfrlcareers.peoplestrong.com/home',
  })
  assert.equal(
    adityaBirlaFashion.hasZeroVacancyFashionRetailSignal({
      status: 200,
      url: adityaBirlaFashion.FASHION_RETAIL_OPENINGS_URL,
      html: fashionRetailHtml,
    }),
    true,
  )
  assert.equal(
    adityaBirlaFashion.hasZeroVacancyGroupJobSearchSignal({
      status: 200,
      url: adityaBirlaFashion.GROUP_JOB_SEARCH_URL,
      html: groupJobSearchHtml,
    }),
    true,
  )
  assert.equal(adityaBirlaFashion.hasBrokenStoreManagerSignal(brokenStoreManagerPage), true)
})

test('Aditya Birla Fashion SSR empty labels and a broken handoff cannot prove zero jobs', async () => {
  const adityaBirlaFashion = await loadAdityaBirlaFashionModule()
  const requestedUrls = []

  await assert.rejects(adityaBirlaFashion.createAdityaBirlaFashionScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === adityaBirlaFashion.CAREERS_URL) {
        return { status: 200, url, html: officialCareersHtml }
      }

      if (url === adityaBirlaFashion.FASHION_RETAIL_OPENINGS_URL) {
        return { status: 200, url, html: fashionRetailHtml }
      }

      if (url === adityaBirlaFashion.GROUP_JOB_SEARCH_URL) {
        return { status: 200, url, html: groupJobSearchHtml }
      }

      if (url === adityaBirlaFashion.STORE_MANAGER_OPENINGS_URL) {
        return brokenStoreManagerPage
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  }), /current anonymous public recruiting protocol unavailable/i)

  assert.deepEqual(requestedUrls, [
    adityaBirlaFashion.CAREERS_URL,
    adityaBirlaFashion.FASHION_RETAIL_OPENINGS_URL,
    adityaBirlaFashion.GROUP_JOB_SEARCH_URL,
    adityaBirlaFashion.STORE_MANAGER_OPENINGS_URL,
  ])
})

test('Aditya Birla Fashion fails closed when the verified ABFRL handoffs change or become usable', async () => {
  const adityaBirlaFashion = await loadAdityaBirlaFashionModule()

  await assert.rejects(
    adityaBirlaFashion.createAdityaBirlaFashionScraper().run({
      fetchPage: async (url) => {
        if (url === adityaBirlaFashion.CAREERS_URL) {
          return {
            status: 200,
            url,
            html: officialCareersHtml.replace(
              'https://abfrlcareers.peoplestrong.com/home',
              'https://abfrlcareers.peoplestrong.com/job/joblist',
            ),
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    adityaBirlaFashion.createAdityaBirlaFashionScraper().run({
      fetchPage: async (url) => {
        if (url === adityaBirlaFashion.CAREERS_URL) {
          return { status: 200, url, html: officialCareersHtml }
        }

        if (url === adityaBirlaFashion.FASHION_RETAIL_OPENINGS_URL) {
          return {
            status: 200,
            url,
            html: fashionRetailHtml.replace(
              '<h3>No Jobs Available</h3>',
              '<h3>Senior Buyer</h3><a href="/jobs/senior-buyer">Apply</a>',
            ),
          }
        }

        if (url === adityaBirlaFashion.GROUP_JOB_SEARCH_URL) {
          return { status: 200, url, html: groupJobSearchHtml }
        }

        if (url === adityaBirlaFashion.STORE_MANAGER_OPENINGS_URL) {
          return brokenStoreManagerPage
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /current anonymous public recruiting protocol unavailable/i,
  )

  await assert.rejects(
    adityaBirlaFashion.createAdityaBirlaFashionScraper().run({
      fetchPage: async (url) => {
        if (url === adityaBirlaFashion.CAREERS_URL) {
          return { status: 200, url, html: officialCareersHtml }
        }

        if (url === adityaBirlaFashion.FASHION_RETAIL_OPENINGS_URL) {
          return { status: 200, url, html: fashionRetailHtml }
        }

        if (url === adityaBirlaFashion.GROUP_JOB_SEARCH_URL) {
          return { status: 200, url, html: groupJobSearchHtml }
        }

        if (url === adityaBirlaFashion.STORE_MANAGER_OPENINGS_URL) {
          return {
            status: 200,
            url,
            html: '<html><body><h1>Store Manager Openings</h1><a href="/job/detail/ABFRL-1">Apply now</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /store manager openings surface/i,
  )
})
