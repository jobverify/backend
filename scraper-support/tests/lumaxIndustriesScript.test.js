import assert from 'node:assert/strict'
import test from 'node:test'

const officialCompanyHtml = `
<!doctype html>
<html>
  <head>
    <title>Auto Lights Supplier | Light Manufacturers In India | Lumax Industries</title>
  </head>
  <body>
    <h1>Lumax Industries Limited</h1>
    <p>India's most trusted and experienced name in automotive lighting.</p>
    <p>Listed on both BSE and NSE.</p>
  </body>
</html>
`

const currentOpeningsHtml = `
<!doctype html>
<html>
  <head>
    <title>Lumax World | lumax career &amp;  Job Openings</title>
  </head>
  <body>
    <h1>Current openings</h1>
    <div class="accordion_container1">
      <div class="quarterly-results-col"></div>
    </div>
    <!--
    <a href="pdf/Lumax-JD-IT.pdf" target="_blank">
      <div class="quarter-text">2 Vacancies <br> Executive/Sr Executive - IT</div>
    </a>
    -->
    <footer>Copyright © Lumax Industries. All Rights Reserved</footer>
  </body>
</html>
`

const workWithUsHtml = `
<!doctype html>
<html>
  <head>
    <title>Lumax World | Work-with-us</title>
  </head>
  <body>
    <h1>Work With Us</h1>
    <p>Re-start your career - Write to us at springboard@lumaxmail.com</p>
    <p>If you're ready to embark on a rewarding career journey with us, explore our current openings and find the perfect role for you.</p>
    <form action="formvalidate_workwithus_lumax.php" method="post">
      <label>Upload Resume</label>
      <input type="file" name="resume" />
    </form>
  </body>
</html>
`

const activeOpeningsHtml = `
<!doctype html>
<html>
  <head>
    <title>Lumax World | lumax career &amp;  Job Openings</title>
  </head>
  <body>
    <h1>Current openings</h1>
    <a href="pdf/Lumax-JD-IT.pdf" target="_blank">
      <div class="quarter-text">2 Vacancies <br> Executive/Sr Executive - IT</div>
    </a>
    <div class="apply-now"><a href="work-with-us.html">Apply Now</a></div>
  </body>
</html>
`

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/lumaxindustries/script.js')
  } catch {
    assert.fail('Expected Lumax Industries scraper module at ../../scraper/lumaxindustries/script.js')
  }
}

test('Lumax Industries sentinel stays pinned to the verified listed-company, current-openings, and work-with-us surfaces', async () => {
  const lumaxIndustries = await loadScriptModule()

  assert.equal(lumaxIndustries.SOURCE, 'lumaxindustries')
  assert.equal(lumaxIndustries.COMPANY, 'Lumax Industries')
  assert.equal(lumaxIndustries.OFFICIAL_BRAND_NAME, 'Lumax Industries Limited')
  assert.equal(lumaxIndustries.VERIFIED_ON, '2026-08-03')
  assert.equal(
    lumaxIndustries.OFFICIAL_COMPANY_PAGE_URL,
    'https://www.lumaxworld.in/lumaxindustries/index.html',
  )
  assert.equal(
    lumaxIndustries.CURRENT_OPENINGS_URL,
    'https://www.lumaxworld.in/current-openings.html',
  )
  assert.equal(
    lumaxIndustries.WORK_WITH_US_URL,
    'https://www.lumaxworld.in/work-with-us.html',
  )
  assert.equal(lumaxIndustries.hasOfficialCompanySignal(officialCompanyHtml), true)
  assert.equal(lumaxIndustries.hasOfficialCurrentOpeningsSignal(currentOpeningsHtml), true)
  assert.equal(lumaxIndustries.hasOfficialWorkWithUsSignal(workWithUsHtml), true)
  assert.equal(lumaxIndustries.hasLivePublicOpeningSignal(currentOpeningsHtml), false)
  assert.equal(lumaxIndustries.hasLivePublicOpeningSignal(workWithUsHtml), false)
  assert.equal(lumaxIndustries.hasLivePublicOpeningSignal(activeOpeningsHtml), true)
})

test('Lumax Industries sentinel returns no jobs while the verified official surfaces stay unchanged and no live public openings appear', async () => {
  const lumaxIndustries = await loadScriptModule()
  const requestedUrls = []

  const jobs = await lumaxIndustries.createLumaxIndustriesScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === lumaxIndustries.OFFICIAL_COMPANY_PAGE_URL) {
        return { status: 200, url, html: officialCompanyHtml }
      }

      if (url === lumaxIndustries.CURRENT_OPENINGS_URL) {
        return { status: 200, url, html: currentOpeningsHtml }
      }

      if (url === lumaxIndustries.WORK_WITH_US_URL) {
        return { status: 200, url, html: workWithUsHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    lumaxIndustries.OFFICIAL_COMPANY_PAGE_URL,
    lumaxIndustries.CURRENT_OPENINGS_URL,
    lumaxIndustries.WORK_WITH_US_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Lumax Industries sentinel fails closed when the official surfaces drift or live public openings appear', async () => {
  const lumaxIndustries = await loadScriptModule()

  await assert.rejects(
    lumaxIndustries.createLumaxIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === lumaxIndustries.OFFICIAL_COMPANY_PAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Unexpected</title></head><body>Placeholder</body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified listed-company page/i,
  )

  await assert.rejects(
    lumaxIndustries.createLumaxIndustriesScraper().run({
      fetchPage: async (url) => {
        if (url === lumaxIndustries.OFFICIAL_COMPANY_PAGE_URL) {
          return { status: 200, url, html: officialCompanyHtml }
        }

        if (url === lumaxIndustries.CURRENT_OPENINGS_URL) {
          return { status: 200, url, html: activeOpeningsHtml }
        }

        if (url === lumaxIndustries.WORK_WITH_US_URL) {
          return { status: 200, url, html: workWithUsHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /live public openings/i,
  )
})
