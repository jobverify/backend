import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_NOTICE_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | SpiceJet Airlines</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p><strong>Cabin Crew Interview February 2026 Calendar</strong></p>
    <p>SpiceJet Ltd Building 39, Sector 18, Gurugram, Haryana -122001</p>
    <p>
      To register please click on the link
      <a class="url" href="https://application.spicestaracademy.edu.in/" target="_blank">
        https://application.spicestaracademy.edu.in/
      </a>
    </p>
    <p><strong>Public Notice</strong></p>
    <p>
      General Public is advised to approach Spice Jet Ltd directly for any information on employment / recruitment
      vide email <a class="url" href="mailto:careers@spicejet.com">careers@spicejet.com</a>
    </p>
    <p><strong>SpiceJet Limited</strong><br>Corp. Office, 319, Udyog Vihar, Phase-IV, Gurgaon-122016 (Haryana) India</p>
    <p>For any further queries please write to us at <a class="url" href="mailto:careers@spicejet.com">careers@spicejet.com</a></p>
  </body>
</html>
`

const AME_REGISTRATION_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>SpiceJet</title>
  </head>
  <body>
    <form action="./AME.aspx" method="post" enctype="multipart/form-data">
      <div id="staticmainContentWithoutBanner" class="contact-corp-page">
        <h2>AME/TECHNICIAN Registration</h2>
        <input name="ctl00$mainContent$txtEmailId" type="text" id="ctl00_mainContent_txtEmailId" />
        <fieldset>
          <legend>B1/Airframes and Engine</legend>
        </fieldset>
        <input type="file" name="ctl00$mainContent$fulResume" id="ctl00_mainContent_fulResume" />
      </div>
    </form>
    <script>
      var result = CheckEmail(document.getElementById("ctl00_mainContent_txtEmailId").value, selectedValue)
      // url:'/Services/GetScheduleInfo.asmx/CheckEmailAddressExists'
      // mesg.innerHTML = "You have already registered for Spicejet Pilots recruitment Process";
    </script>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/spicejet/script.js')
  } catch {
    assert.fail('Expected SpiceJet scraper module at ../../scraper/spicejet/script.js')
  }
}

test('SpiceJet sentinel helpers stay pinned to the verified careers notice and AME registration form', async () => {
  const spiceJet = await loadModule()

  assert.equal(spiceJet.SOURCE, 'spicejet')
  assert.equal(spiceJet.COMPANY_NAME, 'SpiceJet')
  assert.equal(spiceJet.OFFICIAL_BRAND_NAME, 'SpiceJet')
  assert.equal(spiceJet.VERIFIED_ON, '2026-07-17')
  assert.equal(spiceJet.CAREERS_URL, 'https://corporate.spicejet.com/Careers.aspx?source=aero.jobs')
  assert.equal(spiceJet.AME_REGISTRATION_URL, 'https://corporate.spicejet.com/careers/AME.aspx')
  assert.equal(spiceJet.SPICESTAR_REGISTRATION_URL, 'https://application.spicestaracademy.edu.in/')
  assert.equal(spiceJet.CAREERS_EMAIL, 'careers@spicejet.com')
  assert.equal(spiceJet.hasOfficialCareersSignal(CAREERS_NOTICE_HTML), true)
  assert.equal(
    spiceJet.hasOfficialCareersSignal(
      CAREERS_NOTICE_HTML.replace('February 2026', 'September'),
    ),
    true,
  )
  assert.equal(spiceJet.hasOfficialCareersSignal('<html><body>Careers</body></html>'), false)
  assert.equal(spiceJet.hasOfficialAmeRegistrationSignal(AME_REGISTRATION_HTML), true)
  assert.equal(spiceJet.hasOfficialAmeRegistrationSignal('<html><body>AME Registration</body></html>'), false)
  assert.equal(spiceJet.hasEnumerablePublicJobsSignal(CAREERS_NOTICE_HTML), false)
  assert.equal(
    spiceJet.hasEnumerablePublicJobsSignal(
      '<html><body><h2>Current Openings</h2><a href="/jobs/pilot">Apply Now</a></body></html>',
    ),
    true,
  )
})

test('SpiceJet sentinel returns [] only while the verified public careers notice and AME registration form remain unchanged', async () => {
  const spiceJet = await loadModule()
  const requestedUrls = []

  const jobs = await spiceJet.createSpiceJetScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === spiceJet.CAREERS_URL) return CAREERS_NOTICE_HTML
      if (url === spiceJet.AME_REGISTRATION_URL) return AME_REGISTRATION_HTML
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    spiceJet.CAREERS_URL,
    spiceJet.AME_REGISTRATION_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('SpiceJet sentinel fails closed when the careers notice or AME registration contract drifts into a public jobs surface', async () => {
  const spiceJet = await loadModule()

  await assert.rejects(
    spiceJet.createSpiceJetScraper().run({
      fetchText: async (url) => {
        if (url === spiceJet.CAREERS_URL) return '<html><body><h1>Careers</h1></body></html>'
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified careers notice/i,
  )

  await assert.rejects(
    spiceJet.createSpiceJetScraper().run({
      fetchText: async (url) => {
        if (url === spiceJet.CAREERS_URL) return CAREERS_NOTICE_HTML
        if (url === spiceJet.AME_REGISTRATION_URL) {
          return AME_REGISTRATION_HTML.replace('ctl00_mainContent_fulResume', 'resume-upload')
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified ame registration form/i,
  )

  await assert.rejects(
    spiceJet.createSpiceJetScraper().run({
      fetchText: async (url) => {
        if (url === spiceJet.CAREERS_URL) {
          return `${CAREERS_NOTICE_HTML}<section><h2>Current Openings</h2><a href="/jobs/pilot">Apply Now</a></section>`
        }
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /enumerable public jobs/i,
  )
})
