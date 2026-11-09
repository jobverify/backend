import assert from 'node:assert/strict'
import test from 'node:test'

const loadCromptonGreavesModule = async () => {
  try {
    return await import('../../scraper/cromptongreaves/script.js')
  } catch {
    return null
  }
}

const currentOpeningsHtml = `
  <html>
    <body>
      <h2>Current Openings</h2>
      <ul class="career_list" id="filter-sec">
        <li class="scale-anm all Sales ">
          <span>Territory Sales Manager – All India <div class="career_badge"><span class="badge">Sales</span></div></span>
          <a href="mailto:recruitment@crompton.co.in?subject=Applying for Territory Sales Manager – All India" class="btn_common">Apply Now</a>
        </li>
        <li class="scale-anm all Others ">
          <span>Service Manager – All India Customer <div class="career_badge"><span class="badge">Service</span></div></span>
          <a href="mailto:recruitment@crompton.co.in?subject=Applying for Service Manager – All India Customer" class="btn_common">Apply Now</a>
        </li>
        <li class="scale-anm all Innovation ">
          <span>Associate Manager - Electronics Design – Mumbai <div class="career_badge"><span class="badge">Innovation Centre</span></div></span>
          <a href="mailto:recruitment@crompton.co.in?subject=Applying for Associate Manager - Electronics Design – Mumbai" class="btn_common">Apply Now</a>
        </li>
        <li class="scale-anm all Innovation ">
          <span>Associate Manager - Mechanical Design – Mumbai <div class="career_badge"><span class="badge">Innovation Centre</span></div></span>
          <a href="mailto:recruitment@crompton.co.in?subject=Applying for Associate Manager - Mechanical Design – Mumbai" class="btn_common">Apply Now</a>
        </li>
        <li class="scale-anm all Finance ">
          <span>Associate Manager – Finance &amp; Accounts – All India <div class="career_badge"><span class="badge">Finance</span></div></span>
          <a href="mailto:recruitment@crompton.co.in?subject=Applying for Associate Manager – Finance &amp; Accounts – All India" class="btn_common">Apply Now</a>
        </li>
      </ul>
    </body>
  </html>
`

test('extractSearchResults maps Crompton Greaves official current openings into India job records', async () => {
  const cromptongreaves = await loadCromptonGreavesModule()

  assert.ok(
    cromptongreaves,
    'Expected Crompton Greaves scraper module at ../../scraper/cromptongreaves/script.js',
  )

  assert.equal(cromptongreaves.hasOfficialCareersSignal(currentOpeningsHtml), true)

  const jobs = cromptongreaves.extractSearchResults(currentOpeningsHtml)

  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      location: job.location,
      city: job.city,
      applyUrl: job.applyUrl,
      jobId: job.jobId,
    })),
    [
      {
        title: 'Associate Manager - Electronics Design',
        department: 'Innovation Centre',
        location: 'Mumbai, India',
        city: 'Mumbai',
        applyUrl: 'https://www.crompton.co.in/pages/careers',
        jobId: 'cromptongreaves-associate-manager-electronics-design-mumbai',
      },
      {
        title: 'Associate Manager - Finance & Accounts',
        department: 'Finance',
        location: 'All India',
        city: null,
        applyUrl: 'https://www.crompton.co.in/pages/careers',
        jobId: 'cromptongreaves-associate-manager-finance-accounts-all-india',
      },
      {
        title: 'Associate Manager - Mechanical Design',
        department: 'Innovation Centre',
        location: 'Mumbai, India',
        city: 'Mumbai',
        applyUrl: 'https://www.crompton.co.in/pages/careers',
        jobId: 'cromptongreaves-associate-manager-mechanical-design-mumbai',
      },
      {
        title: 'Service Manager',
        department: 'Service',
        location: 'All India Customer',
        city: null,
        applyUrl: 'https://www.crompton.co.in/pages/careers',
        jobId: 'cromptongreaves-service-manager-all-india-customer',
      },
      {
        title: 'Territory Sales Manager',
        department: 'Sales',
        location: 'All India',
        city: null,
        applyUrl: 'https://www.crompton.co.in/pages/careers',
        jobId: 'cromptongreaves-territory-sales-manager-all-india',
      },
    ],
  )
  assert.equal(
    jobs[1].jobDescription,
    'Apply via the Crompton Greaves careers page or email recruitment@crompton.co.in.',
  )
  assert.equal(jobs[1].company, 'Crompton Greaves Consumer Electricals Limited')
  assert.equal(jobs[1].country, 'India')
})

test('run fetches the verified first-party careers page and decorates India roles', async () => {
  const cromptongreaves = await loadCromptonGreavesModule()
  assert.ok(cromptongreaves)

  const requestedUrls = []
  const scraper = cromptongreaves.createCromptonGreavesScraper({ maxJobs: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return currentOpeningsHtml
    },
  })

  assert.deepEqual(requestedUrls, [cromptongreaves.CAREER_PAGE_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'cromptongreaves')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('run fails closed when the verified official current openings markup drifts', async () => {
  const cromptongreaves = await loadCromptonGreavesModule()
  assert.ok(cromptongreaves)

  await assert.rejects(
    cromptongreaves.createCromptonGreavesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified current openings/i,
  )
})
