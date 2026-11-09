import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Five Star Group</title>
  </head>
  <body>
    <header>
      <a href="https://fivestargroup.in/">Home</a>
      <a href="https://fivestargroup.in/about-us/">About Us</a>
      <a href="https://fivestargroup.in/contact-us/">Contact Us</a>
      <a href="https://fivestargroup.in/careers/">Careers</a>
    </header>
    <main>
      <h1>Financial Solutions For Your Business Needs</h1>
      <section>
        <h2>Five Star at a Glance</h2>
        <p>Branches</p>
        <p>Employees</p>
        <p>Five-Star Business Finance Limited</p>
      </section>
      <footer>
        <p>customercare@fivestargroup.in</p>
        <p>info@fivestargroup.in</p>
        <p>CIN: L65991TN1984PLC010844</p>
      </footer>
    </main>
  </body>
</html>
`

const careersShellHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers - Five Star Group</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Company Culture</h2>
      <p>Are you a person:</p>
      <p>Interested in partnering with market leader for Small Business Loans?</p>
      <a href="https://fivestargroup.in/contact-us/">Contact us</a>
      <p>Five-Star Business Finance Limited New No 27, Old No 4, Taylor's Road, Kilpauk, Chennai 600010</p>
      <p>info@fivestargroup.in</p>
      <a href="https://www.linkedin.com/company/five-star-business-finance-limited/">Linkedin</a>
    </main>
  </body>
</html>
`

const publicJobsHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Careers - Five Star Group</title>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/fivestargroup/software-engineer">Apply now</a>
    </main>
  </body>
</html>
`

const loadFiveStarBusinessFinanceModule = async () => {
  try {
    return await import('../../scraper/fivestarbusinessfinance/script.js')
  } catch {
    assert.fail(
      'Expected Five Star Business Finance scraper module at ../../scraper/fivestarbusinessfinance/script.js',
    )
  }
}

test('Five Star Business Finance helpers stay pinned to the verified homepage and contact-style careers shell', async () => {
  const fiveStarBusinessFinance = await loadFiveStarBusinessFinanceModule()

  assert.equal(fiveStarBusinessFinance.SOURCE, 'fivestarbusinessfinance')
  assert.equal(fiveStarBusinessFinance.COMPANY, 'Five Star Business Finance')
  assert.equal(
    fiveStarBusinessFinance.OFFICIAL_BRAND_NAME,
    'Five-Star Business Finance Limited',
  )
  assert.equal(fiveStarBusinessFinance.VERIFIED_ON, '2026-07-15')
  assert.equal(fiveStarBusinessFinance.HOMEPAGE_URL, 'https://fivestargroup.in/')
  assert.equal(fiveStarBusinessFinance.CAREER_PAGE_URL, 'https://fivestargroup.in/careers/')
  assert.equal(
    fiveStarBusinessFinance.extractHomepageCareersUrl(homepageHtml),
    'https://fivestargroup.in/careers/',
  )
  assert.equal(fiveStarBusinessFinance.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(fiveStarBusinessFinance.hasPublicJobsSignal(homepageHtml), false)
  assert.equal(fiveStarBusinessFinance.hasOfficialCareersShellSignal(careersShellHtml), true)
  assert.equal(fiveStarBusinessFinance.hasPublicJobsSignal(careersShellHtml), false)
  assert.equal(fiveStarBusinessFinance.hasPublicJobsSignal(publicJobsHtml), true)
})

test('Five Star Business Finance returns [] only while the verified first-party careers page remains a contact shell', async () => {
  const fiveStarBusinessFinance = await loadFiveStarBusinessFinanceModule()
  const requestedUrls = []

  const jobs = await fiveStarBusinessFinance.createFiveStarBusinessFinanceScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === fiveStarBusinessFinance.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === fiveStarBusinessFinance.CAREER_PAGE_URL) {
        return { status: 200, url, html: careersShellHtml }
      }

      throw new Error(`Unexpected Five Star Business Finance URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    fiveStarBusinessFinance.HOMEPAGE_URL,
    fiveStarBusinessFinance.CAREER_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Five Star Business Finance fails closed when the homepage or careers shell drifts', async () => {
  const fiveStarBusinessFinance = await loadFiveStarBusinessFinanceModule()

  await assert.rejects(
    fiveStarBusinessFinance.createFiveStarBusinessFinanceScraper().run({
      fetchPage: async (url) => {
        if (url === fiveStarBusinessFinance.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><head><title>Unexpected</title></head><body></body></html>' }
        }

        throw new Error(`Unexpected Five Star Business Finance URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    fiveStarBusinessFinance.createFiveStarBusinessFinanceScraper().run({
      fetchPage: async (url) => {
        if (url === fiveStarBusinessFinance.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: homepageHtml.replace(
              'https://fivestargroup.in/careers/',
              'https://fivestargroup.in/current-openings/',
            ),
          }
        }

        throw new Error(`Unexpected Five Star Business Finance URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    fiveStarBusinessFinance.createFiveStarBusinessFinanceScraper().run({
      fetchPage: async (url) => {
        if (url === fiveStarBusinessFinance.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === fiveStarBusinessFinance.CAREER_PAGE_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Five Star Business Finance URL: ${url}`)
      },
    }),
    /verified careers page|public jobs surface/i,
  )
})
