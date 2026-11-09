import assert from 'node:assert/strict'
import test from 'node:test'

const loadBharatElectronicsModule = async () => {
  try {
    return await import('../../scraper/bharatelectronics/script.js')
  } catch {
    assert.fail('Expected Bharat Electronics scraper module at ../../scraper/bharatelectronics/script.js')
  }
}

const HOMEPAGE_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>BEL &#8211; GOVERNMENT OF INDIA, MINISTRY OF DEFENCE , A NAVRATNA COMPANY</title>
  </head>
  <body>
    <div>Bharat Electronics Limited</div>
    <div>Government of India, Ministry of Defence, A Navratna Company</div>
    <a href="https://bel-india.in/job-notifications/">Job Notifications</a>
    <div>This is the official website of Bharat Electronics Limited (BEL)</div>
  </body>
</html>
`

const JOB_NOTIFICATIONS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Job Notifications &#8211; BEL</title>
  </head>
  <body>
    <h1>Job Notifications</h1>
    <h2>Recruitment Advertising</h2>
    <p>All recruitments at Bharat Electronics Limited are advertised through this official website (www.bel-india.in) only.</p>

    <div class="career-result-box">
      <h2>Advertisement for the post of Havildar (Security) on Permanent Basis for BEL Pune </h2>
      <hr>
      <div class="advertisements">
        <h3>Advertisements</h3>
        <div class="row mb-20">
          <div class="col-md-4">
            <div class="attchment-pdf"><div class="pdf-file-info">
              <a href="https://bel-india.in/wp-content/uploads/2026/07/01-Final-Web-Ad-Havildar-Security-8-7.pdf" target="_blank" class="file-link">
                Web Advt - Recruitment of Havildar (Security) on Permanent Basis - [pdf, 1.01 MB]
              </a>
            </div></div>
          </div>
          <div class="col-md-4">
            <div class="attchment-pdf"><div class="pdf-file-info">
              <a href="https://jobapply.in/BEL2026PuneHavildarSecurity" target="_blank">
                Click Here for Online Application
              </a>
            </div></div>
          </div>
        </div>
      </div>
      <div class="bottom-text">
        <div class="loaction-job"><p><b>Location:</b> Pune</p></div>
        <div class="jon-lastdate"><p><b>Last Date to Apply:</b> 31-07-2026</p></div>
      </div>
    </div>

    <div class="career-result-box">
      <h2>Recruitment of Senior Engineer on Fixed Tenure Basis for Project Sites in Madhya Pradesh</h2>
      <hr>
      <div class="advertisements">
        <h3>Advertisements</h3>
        <div class="row mb-20">
          <div class="col-md-4">
            <div class="attchment-pdf"><div class="pdf-file-info">
              <a href="https://bel-india.in/wp-content/uploads/2026/06/Revised_PSD_SE_-English-PSD.pdf" target="_blank" class="file-link">
                Detailed Advertisement - [pdf, 1.48 MB]
              </a>
            </div></div>
          </div>
          <div class="col-md-4">
            <div class="attchment-pdf"><div class="pdf-file-info">
              <a href="https://bel-india.in/wp-content/uploads/2026/06/BIO-DATA-FORM.pdf" target="_blank" class="file-link">
                Click here to download Application Form - [pdf, 663.72 KB]
              </a>
            </div></div>
          </div>
        </div>
      </div>
      <div class="bottom-text">
        <div class="loaction-job"><p><b>Location:</b> Madhya Pradesh</p></div>
        <div class="jon-lastdate"><p><b>Last Date to Apply:</b> 16-07-2026</p></div>
      </div>
    </div>

    <div class="career-result-box">
      <h2>Recruitment to the post Engineering Assistant Trainee (EAT) and Technician C for Chennai Unit</h2>
      <hr>
      <div class="advertisements">
        <h3>Advertisements</h3>
        <div class="row mb-20">
          <div class="col-md-4">
            <div class="attchment-pdf"><div class="pdf-file-info">
              <a href="https://bel-india.in/wp-content/uploads/2026/06/Chennai-EAT-Tech-C-Advt.pdf" target="_blank" class="file-link">
                Click here to view the detailed Advertisement - [pdf, 387.99 KB]
              </a>
            </div></div>
          </div>
          <div class="col-md-4">
            <div class="attchment-pdf"><div class="pdf-file-info">
              <a href="https://jobapply.in/BEL2026ChennaiEATTechTE" target="_blank">
                Click here to apply Online
              </a>
            </div></div>
          </div>
        </div>
      </div>
      <div class="bottom-text">
        <div class="loaction-job"><p><b>Location:</b> Chennai Unit</p></div>
        <div class="jon-lastdate"><p><b>Last Date to Apply:</b> 08-07-2026</p></div>
      </div>
    </div>

    <div>CAUTION NOTICE: FRAUDULENT JOB OFFERS</div>
  </body>
</html>
`

const DUPLICATE_PAGE_HTML = JOB_NOTIFICATIONS_HTML.replace(
  '<title>Job Notifications &#8211; BEL</title>',
  '<title>Job Notifications &#8211; Page 2 &#8211; BEL</title>',
)

test('Bharat Electronics exports the verified first-party recruitment surface contract', async () => {
  const bel = await loadBharatElectronicsModule()

  assert.equal(bel.SOURCE, 'bharatelectronics')
  assert.equal(bel.COMPANY, 'Bharat Electronics')
  assert.equal(bel.HOMEPAGE_URL, 'https://bel-india.in/')
  assert.equal(bel.JOB_NOTIFICATIONS_URL, 'https://bel-india.in/job-notifications/')
  assert.equal(bel.buildJobNotificationsPageUrl(1), 'https://bel-india.in/job-notifications/')
  assert.equal(bel.buildJobNotificationsPageUrl(2), 'https://bel-india.in/job-notifications/page/2/')
  assert.equal(bel.hasOfficialHomepageSignal(HOMEPAGE_HTML), true)
  assert.equal(bel.hasOfficialJobNotificationsPageSignal(JOB_NOTIFICATIONS_HTML), true)
})

test('Bharat Electronics extracts only still-open official recruitment notices and preserves online-vs-form apply modes', async () => {
  const bel = await loadBharatElectronicsModule()

  const jobs = bel.extractActiveJobNotifications(JOB_NOTIFICATIONS_HTML, {
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Advertisement for the post of Havildar (Security) on Permanent Basis for BEL Pune',
    company: 'Bharat Electronics',
    location: 'Pune',
    city: null,
    country: 'India',
    jobId: 'bharatelectronics-advertisement-for-the-post-of-havildar-security-on-permanent-basis-for-bel-pune-2026-07-31',
    requisitionId: 'advertisement-for-the-post-of-havildar-security-on-permanent-basis-for-bel-pune',
    sourceUrl: 'https://bel-india.in/wp-content/uploads/2026/07/01-Final-Web-Ad-Havildar-Security-8-7.pdf',
    applyUrl: 'https://jobapply.in/BEL2026PuneHavildarSecurity/',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: '2026-07-31',
    jobDescription: 'Review the official BEL advertisement PDF and complete the official online application before the closing date.',
    remoteStatus: null,
  })
  assert.equal(jobs[1].title, 'Recruitment of Senior Engineer on Fixed Tenure Basis for Project Sites in Madhya Pradesh')
  assert.equal(jobs[1].applyUrl, 'https://bel-india.in/wp-content/uploads/2026/06/BIO-DATA-FORM.pdf')
  assert.equal(jobs[1].closingDate, '2026-07-16')
  assert.equal(jobs[1].employmentType, 'Contract')
  assert.match(jobs[1].jobDescription, /application form pdf/i)
})

test('Bharat Electronics runner verifies the official homepage, deduplicates repeated paginated pages, and returns shared fields', async () => {
  const bel = await loadBharatElectronicsModule()
  const requestedUrls = []

  const jobs = await bel.createBharatElectronicsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === bel.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === bel.JOB_NOTIFICATIONS_URL) return JOB_NOTIFICATIONS_HTML
      if (url === bel.buildJobNotificationsPageUrl(2)) return DUPLICATE_PAGE_HTML

      throw new Error(`Unexpected Bharat Electronics URL: ${url}`)
    },
    now: () => '2026-07-15T12:00:00.000Z',
    maxPages: 4,
  })

  assert.deepEqual(requestedUrls, [
    'https://bel-india.in/',
    'https://bel-india.in/job-notifications/',
    'https://bel-india.in/job-notifications/page/2/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'bharatelectronics')
  assert.equal(jobs[0].company, 'Bharat Electronics')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, '2026-07-15T12:00:00.000Z')
  assert.equal(jobs[1].link, 'https://bel-india.in/wp-content/uploads/2026/06/BIO-DATA-FORM.pdf')
})

test('Bharat Electronics fails closed when the official job notifications surface changes away from the verified layout', async () => {
  const bel = await loadBharatElectronicsModule()

  await assert.rejects(
    bel.createBharatElectronicsScraper().run({
      fetchText: async (url) => {
        if (url === bel.HOMEPAGE_URL) return HOMEPAGE_HTML
        if (url === bel.JOB_NOTIFICATIONS_URL) {
          return `
            <html>
              <head><title>Job Notifications &#8211; BEL</title></head>
              <body>
                <h1>Job Notifications</h1>
                <p>All recruitments at Bharat Electronics Limited are advertised through this official website (www.bel-india.in) only.</p>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected Bharat Electronics URL: ${url}`)
      },
    }),
    /job notifications page no longer matches the verified official surface/i,
  )
})

test('Bharat Electronics falls back to a browser fetch when certificate verification fails', async () => {
  const bel = await loadBharatElectronicsModule()
  const requestedUrls = []

  const jobs = await bel.createBharatElectronicsScraper().run({
    fetchText: async () => {
      throw new Error('fetch failed | unable to verify the first certificate')
    },
    fetchBrowserText: async (url) => {
      requestedUrls.push(url)

      if (url === bel.HOMEPAGE_URL) return HOMEPAGE_HTML
      if (url === bel.JOB_NOTIFICATIONS_URL) return JOB_NOTIFICATIONS_HTML
      if (url === bel.buildJobNotificationsPageUrl(2)) return DUPLICATE_PAGE_HTML

      throw new Error(`Unexpected Bharat Electronics browser URL: ${url}`)
    },
    now: () => '2026-07-15T12:00:00.000Z',
    maxPages: 4,
  })

  assert.deepEqual(requestedUrls, [
    'https://bel-india.in/',
    'https://bel-india.in/job-notifications/',
    'https://bel-india.in/job-notifications/page/2/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'bharatelectronics')
})
