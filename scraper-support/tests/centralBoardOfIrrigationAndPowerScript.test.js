import assert from 'node:assert/strict'
import test from 'node:test'

const loadCbipModule = async () => {
  try {
    return await import('../../scraper/centralboardofirrigationandpower/script.js')
  } catch {
    return null
  }
}

const homepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Central Board Of Irrigation And Power</title>
  </head>
  <body>
    <a href="https://hrms.cbip.org/login">Employee Login</a>
    <section>
      <h2>ABOUT CBIP</h2>
      <p>
        The Central Board of Irrigation and Power (CBIP) is a premier institution
        established by the Government of India in 1927.
      </p>
    </section>

    <div class="tab-content-text">
      <h3>Recruitment Notice</h3>
      <div class="col-lg-7"></div>
    </div>

    <div class="tab-content-text">
      <h3>CEA Certification</h3>
      <a href="ExternalFile/CEA-RE.pdf">Renewable Energy</a>
    </div>

    <div class="tab-content-text">
      <h3>Expert Registration</h3>
      <p>Invitation for Empanelment of Experts in Power including RE and Water Resources Sectors</p>
      <a href="Expert-HydroPower.aspx">For Hydro Power</a>
      <a href="ExpertFormWR.aspx">For Water Resources</a>
      <a href="ExpertForm.aspx">For Power Sector</a>
    </div>
  </body>
</html>
`

const currentHomepageHtml = `
<!doctype html>
<html>
  <head>
    <title>Central Board Of Irrigation And Power</title>
  </head>
  <body>
    <a href="https://hrms.cbip.org/login">Employee Login</a>
    <section>
      <h2>ABOUT CBIP</h2>
      <p>
        The Central Board of Irrigation and Power (CBIP) is a premier institution
        established by the Government of India in 1927.
      </p>
    </section>

    <div class="tab-tab-item w-p-active-tab-item tab-menu-item-active">
      <div class="tab-content-text">
        <h3 style="margin-bottom: 17px;background: #fff;padding: 12px;border-bottom: 3px solid #4ef2aa;">Recruitment Notice</h3>
        <div class="col-lg-7"></div>
      </div>
    </div>

    <div class="tab-tab-item">
      <div class="tab-content-text">
        <h3>Training Partners</h3>
        <p>Training partner content</p>
      </div>
    </div>

    <div class="tab-content-text">
      <h3>Expert Registration</h3>
      <p>Invitation for Empanelment of Experts in Power including RE and Water Resources Sectors</p>
    </div>
  </body>
</html>
`

const hrmsLoginHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Sharaj360 - Login</title>
  </head>
  <body>
    <div class="custom-login-form">
      <button type="button">HRMS</button>
      <button type="button">E-Office</button>
      <form method="POST" action="https://hrms.cbip.org/login">
        <input type="email" name="email" />
        <input id="password" type="password" name="password" placeholder="Password" />
        <a href="https://hrms.cbip.org/forgot-password/en">Forgot Your Password?</a>
      </form>
    </div>
  </body>
</html>
`

test('Central Board of Irrigation and Power validates the verified first-party empty recruitment surface before returning no jobs', async () => {
  const cbip = await loadCbipModule()

  assert.ok(
    cbip,
    'Expected Central Board of Irrigation and Power scraper module at ../../scraper/centralboardofirrigationandpower/script.js',
  )

  assert.equal(cbip.HOMEPAGE_URL, 'https://cbip.org/')
  assert.equal(cbip.HRMS_LOGIN_URL, 'https://hrms.cbip.org/login')
  assert.equal(cbip.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(cbip.hasOfficialHomepageSignal(currentHomepageHtml), true)
  assert.equal(cbip.extractEmployeeLoginUrl(homepageHtml), 'https://hrms.cbip.org/login')
  assert.equal(cbip.hasEmptyRecruitmentNoticeSignal(homepageHtml), true)
  assert.equal(cbip.hasEmptyRecruitmentNoticeSignal(currentHomepageHtml), true)
  assert.equal(cbip.pageExposesPublicJobListings(homepageHtml), false)
  assert.equal(cbip.hasHrmsLoginSignal(hrmsLoginHtml), true)
  assert.deepEqual(cbip.extractSearchResults(homepageHtml), [])

  const requestedUrls = []
  const jobs = await cbip.createCentralBoardOfIrrigationAndPowerScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === cbip.HOMEPAGE_URL) return homepageHtml
      if (url === cbip.HRMS_LOGIN_URL) return hrmsLoginHtml
      throw new Error(`Unexpected CBIP fixture URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cbip.HOMEPAGE_URL,
    cbip.HRMS_LOGIN_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Central Board of Irrigation and Power fails closed when the official homepage surface changes', async () => {
  const cbip = await loadCbipModule()
  assert.ok(cbip)

  await assert.rejects(
    cbip.createCentralBoardOfIrrigationAndPowerScraper().run({
      fetchText: async (url) => {
        if (url === cbip.HOMEPAGE_URL) {
          return '<html><body><h1>CBIP</h1></body></html>'
        }

        return hrmsLoginHtml
      },
    }),
    /official homepage surface changed/i,
  )
})

test('Central Board of Irrigation and Power fails closed when the recruitment notice starts exposing public listings', async () => {
  const cbip = await loadCbipModule()
  assert.ok(cbip)

  const homepageWithListing = homepageHtml.replace(
    '<div class="col-lg-7"></div>',
    `
      <div class="col-lg-7">
        <p>Assistant Engineer</p>
        <a href="ExternalFile/cbip-assistant-engineer.pdf">View Vacancy</a>
      </div>
    `,
  )

  await assert.rejects(
    cbip.createCentralBoardOfIrrigationAndPowerScraper().run({
      fetchText: async (url) => {
        if (url === cbip.HOMEPAGE_URL) return homepageWithListing
        return hrmsLoginHtml
      },
    }),
    /now exposes public job listings/i,
  )
})

test('Central Board of Irrigation and Power fails closed when the employee login surface stops looking like the verified HRMS login', async () => {
  const cbip = await loadCbipModule()
  assert.ok(cbip)

  await assert.rejects(
    cbip.createCentralBoardOfIrrigationAndPowerScraper().run({
      fetchText: async (url) => {
        if (url === cbip.HOMEPAGE_URL) return homepageHtml
        return `
          <html>
            <head><title>CBIP Careers</title></head>
            <body>
              <h1>Open Positions</h1>
            </body>
          </html>
        `
      },
    }),
    /employee login surface changed/i,
  )
})
