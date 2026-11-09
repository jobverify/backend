import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Saama - #1 in AI Clinical Analytics</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Explore our openings.</p>
    <script>Jobvite = { careersite: 'saama' };</script>
    <div class="jv-careersite" data-careersite="saama" data-region=""></div>
    <script src="https://jobs.jobvite.com/__assets__/scripts/careersite/public/iframe.js"></script>
  </body>
</html>
`

const boardHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Current Openings</h2>
    <p>Powered by Jobvite</p>
    <h3 class="h2">Engineering</h3>
    <table class="jv-job-list">
      <tbody>
        <tr>
          <td class="jv-job-list-name">
            <a href="/saama/job/o0xXtfwH">Senior Site Reliability Engineer</a>
          </td>
          <td class="jv-job-list-location">
            Chennai,
            India
          </td>
        </tr>
        <tr>
          <td class="jv-job-list-name">
            <a href="/saama/job/oUS123">Solutions Consultant</a>
          </td>
          <td class="jv-job-list-location">
            Boston,
            United States
          </td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const indiaDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script type="application/ld+json">
      {
        "title": "Senior Site Reliability Engineer",
        "jobLocation": {
          "address": {
            "addressCountry": "India"
          }
        }
      }
    </script>
    <h2>Senior Site Reliability Engineer</h2>
    <p class="job-meta">Engineering Chennai, India</p>
    <h3>Description</h3>
    <ul>
      <li>Kubernetes</li>
      <li>AWS</li>
    </ul>
    <p>Requires 6+ years experience supporting cloud infrastructure.</p>
    <p>Powered by Jobvite</p>
  </body>
</html>
`

const usDetailHtml = `
<!doctype html>
<html lang="en">
  <body>
    <script type="application/ld+json">
      {
        "title": "Solutions Consultant",
        "jobLocation": {
          "address": {
            "addressLocality": "Boston",
            "addressRegion": "Massachusetts",
            "addressCountry": "United States"
          }
        }
      }
    </script>
    <h2>Solutions Consultant</h2>
    <p>Powered by Jobvite</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/saamatechnologies/script.js')
  } catch {
    assert.fail('Expected Saama Technologies scraper module at ../../scraper/saamatechnologies/script.js')
  }
}

test('Saama Technologies validates the verified Jobvite handoff and keeps only India roles', async () => {
  const saama = await loadModule()
  const requestedUrls = []

  assert.equal(saama.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(saama.extractJobBoardUrl(careersHtml), saama.JOB_BOARD_URL)
  assert.equal(saama.hasOfficialJobBoardSignal(boardHtml), true)

  const jobs = await saama.createSaamaTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === saama.CAREERS_URL) return careersHtml
      if (url === saama.JOB_BOARD_URL) return boardHtml
      if (url === 'https://jobs.jobvite.com/saama/job/o0xXtfwH') return indiaDetailHtml
      if (url === 'https://jobs.jobvite.com/saama/job/oUS123') return usDetailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.saama.com/about/company/careers/',
    'https://jobs.jobvite.com/saama/',
    'https://jobs.jobvite.com/saama/job/o0xXtfwH',
    'https://jobs.jobvite.com/saama/job/oUS123',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Site Reliability Engineer',
      company: 'Saama Technologies',
      department: 'Engineering',
      location: 'Chennai, India',
      city: 'Chennai',
      state: null,
      country: 'India',
      jobId: 'o0xXtfwH',
      requisitionId: 'o0xXtfwH',
      sourceUrl: 'https://jobs.jobvite.com/saama/job/o0xXtfwH',
      applyUrl: 'https://jobs.jobvite.com/saama/job/o0xXtfwH/apply',
      employmentType: null,
      experienceRequired: '6+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: ['Kubernetes', 'AWS'],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Kubernetes AWS Requires 6+ years experience supporting cloud infrastructure.',
      source: 'saamatechnologies',
      companyCareerPage: 'https://www.saama.com/about/company/careers/',
      companyDomain: 'saama.com',
      atsPlatform: 'jobvite',
      link: 'https://jobs.jobvite.com/saama/job/o0xXtfwH/apply',
      scrapedAt: FIXED_SCRAPED_AT,
    },
  ])
})

test('Saama Technologies fails closed when the trusted careers page changes', async () => {
  const saama = await loadModule()

  await assert.rejects(
    saama.createSaamaTechnologiesScraper().run({
      fetchText: async () => '<html><body>No trusted handoff</body></html>',
    }),
    /trusted first-party surface/i,
  )
})
