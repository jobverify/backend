import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-18T00:00:00.000Z'

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

const facileCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <section class="career-opportunities">
      <h2 class="section-title wow FadeIn">Career Opportunities</h2>
      <table class="table careers-table">
        <tbody>
          <tr>
            <td class="post-title-col">Content Writer
              <a class="btn-open-jd" data-jtitle="Content Writer" data-jdesc="<p><strong><u>Roles and Responsibilities:</u></strong></p><ul><li>Write news pieces, fresh blogs, infographics, drip emails related to IT services.</li></ul>"></a>
            </td>
            <td class="location-col">Pune</td>
            <td class="exp-col">EXP: 2+ Years</td>
            <td class="btn-col">
              <a class="btn-open-model content" data-jtitle="Content Writer">Apply</a>
            </td>
          </tr>
          <tr>
            <td class="post-title-col">Database Administrator
              <a class="btn-open-jd" data-jtitle="Database Administrator" data-jdesc="<p><strong>Job Overview:</strong> We are seeking a skilled Database Administrator with a strong background in MySQL queries, Excel automation, and data analysis.</p>"></a>
            </td>
            <td class="location-col">Pune</td>
            <td class="exp-col">EXP: 2+ Years</td>
            <td class="btn-col">
              <a class="btn-open-model database" data-jtitle="Database Administrator">Apply</a>
            </td>
          </tr>
          <tr>
            <td class="post-title-col">Programmatic Ads Specialist
              <a class="btn-open-jd" data-jtitle="Programmatic Ads Specialist" data-jdesc="<p><strong>What You&apos;ll Do</strong></p><ul><li>Assist sales with creating new business proposals.</li></ul>"></a>
            </td>
            <td class="location-col">Pune</td>
            <td class="exp-col">EXP: 2 to 6+ Years</td>
            <td class="btn-col">
              <a class="btn-open-model marketing" data-jtitle="Programmatic Ads Specialist">Apply</a>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </body>
</html>
`

const helm360CareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Fast-Paced., High-Growth., International., Remote.</h1>
    <h2>Work with us!</h2>
    <a href="https://www.indeed.com/cmp/Helm360/jobs">Search Open Jobs</a>
    <p>Think you're a good fit? <a href="https://www.indeed.com/cmp/Helm360/jobs">Check out our current openings!</a></p>
  </body>
</html>
`

const bluCognitionPayload = {
  total_active_jobs: 2,
  filters: {
    category: ['Operations', 'Technology'],
    location: ['Pune', 'Jaipur', 'Remote'],
  },
  jobs: [
    {
      id: 'bc-100',
      status: 'active',
      title: 'Analyst - AML & KYC',
      department: 'Operations',
      requisition_id: 'bluC/2026/0110',
      openings: 5,
      type: 'Full-Time',
      shift: 'Rotational',
      location: 'Remote',
      locationCategory: 'Remote',
      posted: '17th June, 2026',
      description_mini: 'We are seeking a detail-oriented KYC/KYB & Fraud Analyst.',
      description_details: '<ul><li>Conduct KYC and fraud investigations.</li></ul>',
      naukri: 'https://www.naukri.com/job-listings-analyst-aml-kyc-123',
      linkedin: '',
    },
    {
      id: 'bc-101',
      status: 'active',
      title: 'Intern - Software Engineer',
      department: 'Technology',
      requisition_id: 'bluC/2026/0097',
      openings: 1,
      type: 'Internship',
      shift: 'Day/Fixed',
      location: 'Jaipur',
      locationCategory: 'On-site',
      posted: '14th April, 2026',
      description_mini: 'Join bluCognition’s growing technology team.',
      description_details: ['Gain hands-on experience.', 'Build real-world applications.'],
      naukri: '',
      linkedin: 'https://www.linkedin.com/jobs/view/1001',
    },
    {
      id: 'bc-099',
      status: 'draft',
      title: 'Inactive Job',
      department: 'Operations',
      requisition_id: 'bluC/2026/0001',
      openings: 1,
      type: 'Full-Time',
      shift: 'Day',
      location: 'Pune',
      locationCategory: 'On-site',
      posted: '1st January, 2026',
      description_mini: 'Should not be returned.',
      description_details: '',
      naukri: '',
      linkedin: '',
    },
  ],
}

const danskeTransitionHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>Danske Bank enters strategic partnership</h1>
    <p>As part of the partnership, Danske Bank will sell Danske IT, a fully-owned subsidiary of Danske Bank, headquartered in Bengaluru, India, to a strategic partner.</p>
    <p>As part of the sale, starting expectedly 1 September 2023 our 1,400 colleagues in Danske IT will transfer to the strategic partner.</p>
  </body>
</html>
`

const danskeCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <nav><a href="/careers/it-professionals">IT Professionals</a></nav>
    <section>
      <h2>Current openings</h2>
      <a href="https://ejqi.fa.ocs.oraclecloud.eu/hcmUI/CandidateExperience/en/sites/CX_1001/job/1001">17 jul 2026 | LT Operations Officer in Daily Services Agreements Team</a>
      <a href="https://ejqi.fa.ocs.oraclecloud.eu/hcmUI/CandidateExperience/en/sites/CX_1001/job/1002">See all openings</a>
    </section>
  </body>
</html>
`

const atidivCareersHtml = `
<!doctype html>
<html lang="en">
  <body>
    <div id="job-openings" class="py-10 lg:py-16 text-primary">
      <div class="site-width">
        <h2 class="text-4xl lg:text-7xl mb-0 lg:mb-4">Current Openings: <br>Find Your&nbsp;Next Job.</h2>
        <a class="flex flex-row py-7 lg:py-10 border-b border-b-primary/30 group" href="https://www.atidiv.com/job/senior-campaign-manager/">
          <div class="w-full flex flex-col lg:flex-row gap-1 lg:items-center justify-between text-left">
            <div class="lg:w-80">
              <h3 class="text-22 lg:text-28 font-medium group-hover:underline underline-offset-2">Senior Campaign Manager</h3>
            </div>
            <div class="lg:w-96 lg:text-2xl">
              <div class="flex flex-col md:flex-row lg:flex-col gap-1 leading-none">
                <span class="pr-2">Digital Marketing</span>
                <div class="flex mt-1 [&>span]:px-2 first:[&>span]:pl-0 [&>span]:border-l first:[&>span]:border-none">
                  <span>Full-Time</span>
                  <span>Growth</span>
                  <span>Remote</span>
                </div>
              </div>
            </div>
          </div>
        </a>
      </div>
    </div>
  </body>
</html>
`

test('Facile Services run returns normalized jobs from the verified first-party careers table', async () => {
  const facile = await loadModule('../../scraper/facileservices/script.js')

  assert.equal(facile.hasOfficialCareersSignal(facileCareersHtml), true)
  assert.equal(facile.extractCareerRows(facileCareersHtml).length, 3)

  const jobs = await facile.createFacileServicesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, facile.CAREERS_URL)
      return facileCareersHtml
    },
  })

  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].title, 'Content Writer')
  assert.equal(jobs[0].location, 'Pune')
  assert.equal(jobs[0].experienceRequired, '2+ Years')
  assert.match(jobs[1].jobDescription, /MySQL queries/i)
  assert.equal(jobs[2].title, 'Programmatic Ads Specialist')
})

test('Helm360 sentinel stays pinned to the verified Indeed handoff-only first-party surface', async () => {
  const helm360 = await loadModule('../../scraper/helm360/script.js')

  assert.equal(helm360.hasOfficialCareersSignal(helm360CareersHtml), true)
  assert.equal(helm360.hasVerifiedIndeedHandoffOnly(helm360CareersHtml), true)

  const jobs = await helm360.run({
    fetchText: async (url) => {
      assert.equal(url, helm360.CAREERS_URL)
      return helm360CareersHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    helm360.run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Fast-Paced., High-Growth., International., Remote.</h1>
            <h2>Work with us!</h2>
            <a href="https://helm360.com/careers/open-jobs">Search Open Jobs</a>
            <a href="https://helm360.com/careers/open-jobs">Check out our current openings!</a>
          </body>
        </html>
      `,
    }),
    /Indeed handoff-only/i,
  )
})

test('bluCognition run returns normalized active jobs from the verified first-party JSON feed', async () => {
  const bluCognition = await loadModule('../../scraper/blucognition/script.js')

  const extractedJobs = bluCognition.extractActiveJobsFromCareersPayload(bluCognitionPayload)
  assert.equal(extractedJobs.length, 2)
  assert.deepEqual(extractedJobs.map((job) => job.title), [
    'Analyst - AML & KYC',
    'Intern - Software Engineer',
  ])

  const jobs = await bluCognition.createBluCognitionScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchJson: async (url) => {
      assert.equal(url, bluCognition.JOBS_API_URL)
      return bluCognitionPayload
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Analyst - AML & KYC')
  assert.equal(jobs[0].postingDate, '2026-06-17')
  assert.equal(jobs[0].applyUrl, 'https://www.naukri.com/job-listings-analyst-aml-kyc-123')
  assert.equal(jobs[1].title, 'Intern - Software Engineer')
  assert.equal(jobs[1].applyUrl, 'https://www.linkedin.com/jobs/view/1001')
  assert.equal(jobs[1].workplaceType, 'On-site')
})

test('Danske IT sentinel stays pinned to the transition notice and generic parent-brand careers surface', async () => {
  const danskeIT = await loadModule('../../scraper/danskeit/script.js')

  assert.equal(danskeIT.hasTransitionPressReleaseSignal(danskeTransitionHtml), true)
  assert.equal(danskeIT.hasParentCareersSignal(danskeCareersHtml), true)
  assert.equal(danskeIT.hasExactBrandCareersSignal(danskeCareersHtml), false)

  const requestedUrls = []
  const jobs = await danskeIT.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === danskeIT.PRESS_RELEASE_URL) return danskeTransitionHtml
      if (url === danskeIT.CAREERS_URL) return danskeCareersHtml
      throw new Error(`Unexpected Danske IT URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    danskeIT.PRESS_RELEASE_URL,
    danskeIT.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])

  await assert.rejects(
    danskeIT.run({
      fetchText: async (url) => {
        if (url === danskeIT.PRESS_RELEASE_URL) return danskeTransitionHtml
        return '<html><body><h1>Danske IT Careers</h1><h2>Current openings</h2></body></html>'
      },
    }),
    /exact-name public careers surface/i,
  )
})

test('Atidiv run returns normalized jobs from the verified server-rendered current openings section', async () => {
  const atidiv = await loadModule('../../scraper/atidiv/script.js')

  assert.equal(atidiv.hasOfficialCareersSignal(atidivCareersHtml), true)
  assert.equal(atidiv.extractJobCards(atidivCareersHtml).length, 1)

  const jobs = await atidiv.createAtidivScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, atidiv.CAREERS_URL)
      return atidivCareersHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Campaign Manager')
  assert.equal(jobs[0].department, 'Digital Marketing')
  assert.equal(jobs[0].employmentType, 'Full-Time')
  assert.equal(jobs[0].workplaceType, 'Remote')
  assert.equal(jobs[0].applyUrl, 'https://www.atidiv.com/job/senior-campaign-manager/')
})

test('Atidiv run falls back to the certificate-tolerant page fetch when TLS verification fails on the primary fetch path', async () => {
  const atidiv = await loadModule('../../scraper/atidiv/script.js')

  const tlsError = new TypeError('fetch failed')
  tlsError.cause = {
    code: 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    message: 'unable to verify the first certificate',
  }

  const jobs = await atidiv.createAtidivScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async () => {
      throw tlsError
    },
    fetchFallbackText: async (url) => {
      assert.equal(url, atidiv.CAREERS_URL)
      return atidivCareersHtml
    },
  })

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Senior Campaign Manager')
  assert.equal(jobs[0].source, 'atidiv')
})
