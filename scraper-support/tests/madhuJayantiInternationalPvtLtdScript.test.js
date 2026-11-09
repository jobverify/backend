import assert from 'node:assert/strict'
import test from 'node:test'

const loadMadhuJayantiModule = async () => {
  try {
    return await import('../../scraper/madhujayantiinternationalpvtltd/script.js')
  } catch {
    return null
  }
}

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="logo">
      <a href="https://jaytea.com/" title="Madhu Jayanti International Pvt Ltd">
        <img alt="Madhu Jayanti International Pvt Ltd" />
      </a>
    </div>
    <ul>
      <li><a href="careers.php" class="noactive"><sup>08</sup> Career</a></li>
      <li><a href="contact.php" class="noactive"><sup>10</sup> Contact Us</a></li>
    </ul>
    <h2>Nobody knows tea better<span>!</span></h2>
    <p>Selling tea since since 1942, 1000+ varieties, 4 factories, 15 million cups a day</p>
    <p>Madhu Jayanti International Ltd.</p>
    <p>Phone: <a href="tellus:+91 33 6657 4100">+91 33 6657 4100</a></p>
    <p>E-mail: <a href="mailto:info@jaytea.com">info@jaytea.com</a></p>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div class="logo">
      <a href="https://jaytea.com/" title="Madhu Jayanti International Pvt Ltd">
        <img alt="Madhu Jayanti International Pvt Ltd" />
      </a>
    </div>
    <h1>Career</h1>
    <h2>Join the World of Tea Innovation</h2>
    <p>
      We're not your average tea company; we're the ones who break barriers and rewrite the rules.
    </p>
    <p>
      We're NOT seeking the uninitiated or those who prefer conventional roles. Madhu Jayanti is where
      innovation meets ambition, and we're inviting you to be a part of our legacy. Stay tuned for exciting
      career opportunities that could lead you to brew your success with us.
    </p>
    <h2>Join the Tea Revolution</h2>
    <p>
      If you're ready to be part of a company that never plays it safe and encourages audacious ideas, apply now.
    </p>

    <div class="display_hide_table" style="display:none;">
      <h2>Currently Hiring for:</h2>

      <div class="applyfrom" id="applyform_1">
        <form id="job_vacancies_1" name="job_vacancies_1" method="post" enctype="multipart/form-data">
          <label>Title</label>
          <div class="career_job_title" id="career_job_title_1">
            <p>Marketing Manager</p>
          </div>
          <label>Location</label>
          <div class="career_job_location" id="career_job_location_1">
            <p>New York, NY</p>
          </div>
          <label>Brief Description</label>
          <div class="career_job_description" id="career_job_description_1">
            <p>Placeholder hidden role.</p>
          </div>
          <input type="button" name="submit" value="Apply Now" id="vacanciesid_1" />
        </form>
      </div>

      <div class="applyfrom" id="applyform_2">
        <form id="job_vacancies_2" name="job_vacancies_2" method="post" enctype="multipart/form-data">
          <label>Title</label>
          <div class="career_job_title" id="career_job_title_2">
            <p>Software Engineer</p>
          </div>
          <label>Location</label>
          <div class="career_job_location" id="career_job_location_2">
            <p>San Francisco, CA</p>
          </div>
          <label>Brief Description</label>
          <div class="career_job_description" id="career_job_description_2">
            <p>Placeholder hidden role.</p>
          </div>
          <input type="button" name="submit" value="Apply Now" id="vacanciesid_2" />
        </form>
      </div>

      <div class="applyfrom" id="applyform_3">
        <form id="job_vacancies_3" name="job_vacancies_3" method="post" enctype="multipart/form-data">
          <label>Title</label>
          <div class="career_job_title" id="career_job_title_3">
            <p>Human Resources Specialist</p>
          </div>
          <label>Location</label>
          <div class="career_job_location" id="career_job_location_3">
            <p>Chicago, IL</p>
          </div>
          <label>Brief Description</label>
          <div class="career_job_description" id="career_job_description_3">
            <p>Placeholder hidden role.</p>
          </div>
          <input type="button" name="submit" value="Apply Now" id="vacanciesid_3" />
        </form>
      </div>
    </div>

    <h2>Cannot find your domain? Drop your resume here:</h2>
    <div class="applyfrom" id="notchooseanydomain">
      <form id="secondary_job_vacancies" name="secondary_job_vacancies" method="post" enctype="multipart/form-data">
        <label>Name<span>*</span></label>
        <input type="name" name="user_name" id="user_name" autocomplete="off" />
        <label>Email<span>*</span></label>
        <input type="email" name="user_email" id="user_email" autocomplete="off" />
        <label>Phone<span>*</span></label>
        <input type="tel" name="user_phone" id="user_phone" autocomplete="off" />
        <label>Designation<span>*</span></label>
        <input type="text" name="user_designation" id="user_designation" autocomplete="off" />
        <label>Upload CV<span>*</span></label>
        <input type="file" name="file_job_vacancies" id="cvupload" accept="application/msword,application/pdf" />
        <input type="button" id="secondary_submit_btn" name="submit" value="submit" />
      </form>
    </div>
  </body>
</html>
`

test('Madhu Jayanti sentinel validates the verified first-party homepage and careers shell', async () => {
  const madhuJayanti = await loadMadhuJayantiModule()
  assert.ok(madhuJayanti, 'Expected scraper module at ../../scraper/madhujayantiinternationalpvtltd/script.js')

  assert.equal(madhuJayanti.SOURCE, 'madhujayantiinternationalpvtltd')
  assert.equal(madhuJayanti.COMPANY, 'Madhu Jayanti International Pvt Ltd')
  assert.equal(madhuJayanti.HOME_URL, 'https://jaytea.com/')
  assert.equal(madhuJayanti.CAREERS_URL, 'https://jaytea.com/careers.php')
  assert.equal(madhuJayanti.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(madhuJayanti.hasOfficialCareersShellSignal(officialCareersHtml), true)
  assert.equal(madhuJayanti.hasNoPublicJobListingsSignal(officialCareersHtml), true)
})

test('Madhu Jayanti sentinel returns no jobs while the verified first-party careers page stays apply-only', async () => {
  const madhuJayanti = await loadMadhuJayantiModule()
  assert.ok(madhuJayanti, 'Expected scraper module at ../../scraper/madhujayantiinternationalpvtltd/script.js')

  const requestedUrls = []
  const jobs = await madhuJayanti.createMadhuJayantiInternationalScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === madhuJayanti.HOME_URL) return officialHomepageHtml
      if (url === madhuJayanti.CAREERS_URL) return officialCareersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    madhuJayanti.HOME_URL,
    madhuJayanti.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Madhu Jayanti sentinel fails closed when the verified homepage or public careers shell drifts', async () => {
  const madhuJayanti = await loadMadhuJayantiModule()
  assert.ok(madhuJayanti, 'Expected scraper module at ../../scraper/madhujayantiinternationalpvtltd/script.js')

  await assert.rejects(
    madhuJayanti.createMadhuJayantiInternationalScraper().run({
      fetchText: async (url) => {
        if (url === madhuJayanti.HOME_URL) return '<html><body><h1>JayTea</h1></body></html>'
        if (url === madhuJayanti.CAREERS_URL) return officialCareersHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /official homepage no longer matches the verified first-party company surface/i,
  )

  await assert.rejects(
    madhuJayanti.createMadhuJayantiInternationalScraper().run({
      fetchText: async (url) => {
        if (url === madhuJayanti.HOME_URL) return officialHomepageHtml
        if (url === madhuJayanti.CAREERS_URL) {
          return officialCareersHtml.replace('style="display:none;"', 'style="display:block;"')
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public careers surface now exposes job listings or changed shape/i,
  )
})
