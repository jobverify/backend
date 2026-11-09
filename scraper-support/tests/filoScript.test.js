import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-08-02T04:00:00.000Z'
const CAREERS_URL = 'https://askfilo.com/careers'
const ANALYSTS_DOC_URL = 'https://docs.google.com/document/u/3/d/e/2PACX-analysts/pub'
const PRODUCT_DOC_URL = 'https://docs.google.com/document/d/e/2PACX-product/pub'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Opportunities At Filo. Check For Recent Career Options</title>
  </head>
  <body>
    <main>
      <h1>Career at Filo</h1>
      <p>JOIN OUR TEAM</p>
      <h2>Departments</h2>
    </main>
    <script id="__NEXT_DATA__" type="application/json">
      {
        "props": {
          "pageProps": {
            "data": {
              "Analytics": [
                {
                  "position": "Business Analyst",
                  "department": "Analytics",
                  "documentUrl": "${ANALYSTS_DOC_URL}"
                }
              ],
              "Product": [
                {
                  "position": "Product Manager",
                  "department": "Product",
                  "documentUrl": "${PRODUCT_DOC_URL}"
                }
              ]
            }
          }
        }
      }
    </script>
    <footer>Filo EdTech INC. 2025</footer>
  </body>
</html>
`

const analystsDocHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Analysts</title>
  </head>
  <body>
    <div id="contents">
      <p>Analysts</p>
      <p>Experience: minimum 2 years of experience in solving problems with data</p>
      <p>About Filo</p>
      <h2>Roles and Responsibilities</h2>
      <ul>
        <li>Work with product and growth teams</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>Strong SQL and Excel skills</li>
      </ul>
      <p>Published using Google Docs</p>
    </div>
  </body>
</html>
`

const productDocHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Product Manager</title>
  </head>
  <body>
    <div id="contents">
      <p>Product Manager</p>
      <p>Experience: Minimum 4 years in product management</p>
      <p>About Filo</p>
      <h2>Roles and Responsibilities</h2>
      <ul>
        <li>Own roadmap execution</li>
      </ul>
      <h2>Requirements</h2>
      <ul>
        <li>Strong communication skills</li>
      </ul>
      <p>Published using Google Docs</p>
    </div>
  </body>
</html>
`

const loadFiloModule = async () => {
  try {
    return await import('../../scraper/filo/script.js')
  } catch {
    assert.fail('Expected Filo scraper module at ../../scraper/filo/script.js')
  }
}

test('Filo helpers accept the live /u/3 Google Docs URL variant and broader doc titles', async () => {
  const filo = await loadFiloModule()

  assert.equal(filo.SOURCE, 'filo')
  assert.equal(filo.COMPANY, 'Filo')
  assert.equal(filo.VERIFIED_ON, '2026-10-09')
  assert.equal(filo.CAREERS_URL, CAREERS_URL)
  assert.equal(filo.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(filo.hasMatchingRoleTitle('Analysts', 'Business Analyst'), true)

  const roles = filo.extractPublicRoles(careersHtml)
  assert.deepEqual(roles, [
    {
      title: 'Business Analyst',
      department: 'Analytics',
      documentUrl: ANALYSTS_DOC_URL,
    },
    {
      title: 'Product Manager',
      department: 'Product',
      documentUrl: PRODUCT_DOC_URL,
    },
  ])

  assert.deepEqual(
    filo.extractPublishedRoleDetails(analystsDocHtml, { title: 'Business Analyst' }),
    {
      title: 'Analysts',
      experienceRequired: 'minimum 2 years',
      jobDescription: 'Work with product and growth teams',
      minimumQualification: 'Strong SQL and Excel skills Published using Google Docs',
    },
  )
})

test('Filo run returns listing-backed jobs from the current published Google Docs contract', async () => {
  const filo = await loadFiloModule()
  const requestedUrls = []

  const jobs = await filo.createFiloScraper({ maxJobs: 2 }).run({
    now: () => FIXED_SCRAPED_AT,
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === CAREERS_URL) return careersHtml
      if (url === ANALYSTS_DOC_URL) return analystsDocHtml
      if (url === PRODUCT_DOC_URL) return productDocHtml
      throw new Error(`Unexpected Filo URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [CAREERS_URL, ANALYSTS_DOC_URL, PRODUCT_DOC_URL])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      country: job.country,
      sourceUrl: job.sourceUrl,
      link: job.link,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Business Analyst',
        department: 'Analytics',
        country: null,
        sourceUrl: ANALYSTS_DOC_URL,
        link: ANALYSTS_DOC_URL,
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        title: 'Product Manager',
        department: 'Product',
        country: null,
        sourceUrl: PRODUCT_DOC_URL,
        link: PRODUCT_DOC_URL,
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})
