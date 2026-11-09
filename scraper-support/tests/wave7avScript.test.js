import assert from 'node:assert/strict'
import test from 'node:test'

const marquisHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Leader in Software Testing on different Platforms | Marquistech</title>
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/job-openings/">Careers</a>
    </nav>
    <h1>Leader in Software Testing on different Platforms</h1>
    <p>Telecom Testing, 5G &amp; IoT Services</p>
    <ul>
      <li>Mobile-Device Testing</li>
      <li>5G Testing</li>
      <li>GCF Certification</li>
    </ul>
  </body>
</html>
`

const marquisCompromisedJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>NABUNG77 Gerbang Situs Game Online Paling Gacor</title>
  </head>
  <body>
    <h1>BADAK178</h1>
    <a href="https://marquistech11.pages.dev">LOGIN</a>
    <p>SLOT ONLINE</p>
  </body>
</html>
`

const v2softListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Possibility in India</title>
  </head>
  <body>
    <h1>RESTART YOUR CAREER AT V2SOFT!</h1>
    <h2>JOB OPENINGS</h2>
    <article class="job-card">
      <h3>Digital Marketing Lead</h3>
      <p>Bangalore, KA</p>
      <a href="https://marketing.v2soft.com/india-careers/digital-marketing-jobs/">View Job</a>
    </article>
    <article class="job-card">
      <h3>Mobile Developer</h3>
      <p>Bangalore, KA</p>
      <a href="https://marketing.v2soft.com/india-careers/mobile-developer-jobs/">View Job</a>
    </article>
  </body>
</html>
`

const v2softDigitalMarketingDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Marketing Jobs in Bangalore, India</title>
  </head>
  <body>
    <h1>Digital Marketing - Lead</h1>
    <p>Job#: 21-00681</p>
    <p>Location: Bangalore, KA</p>
    <h3>Job Details</h3>
    <h4>Job Type</h4>
    <p>Full Time</p>
    <h4>Skills Required</h4>
    <p>SMO, SMM, SEO, SEM, PPC, Email Campaign</p>
    <h4>Experience Required</h4>
    <p>7+ Years</p>
    <h4>Qualification</h4>
    <p>MBA, PGDM, PGPM or equivalent</p>
    <h2>Job Description</h2>
    <ul>
      <li>Planning, development, and implementation of SEO strategies on projects.</li>
      <li>Manage Paid Campaigns on Google Adwords and social media platforms.</li>
    </ul>
    <p>Quick Apply</p>
  </body>
</html>
`

const v2softMobileDeveloperDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Mobile Developer Jobs in Bangalore, India</title>
  </head>
  <body>
    <h1>Mobile Developer</h1>
    <p>Job#: 21-00631</p>
    <p>Location: Bangalore, KA</p>
    <h3>Job Details</h3>
    <h4>Job Type</h4>
    <p>Full Time</p>
    <h4>Skills Required</h4>
    <p>Cardova, Phonegap, HTML5, CSS, AngularJS, JSON, Restful APIs, iOS SDK</p>
    <h4>Experience Required</h4>
    <p>6 - 8 Years</p>
    <h4>Qualification</h4>
    <p>Bachelor’s Degree in computer science or equivalent</p>
    <h2>Job Description</h2>
    <ul>
      <li>MEAP Platform, kony, worklight, Cardova, Phonegap.</li>
      <li>Ionic 1.0 and Ionic 4.x or higher.</li>
    </ul>
    <p>Quick Apply</p>
  </body>
</html>
`

const colanCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - Colan Infotech Private Limited</title>
  </head>
  <body>
    <h1>Build your future at Colan</h1>
    <h2>LATEST JOBS</h2>
    <div class="accordion table-responsive company-inner-table desktop" id="accordionExample">
      <table class="table">
        <thead>
          <tr>
            <th>Job Title</th>
            <th>Experience</th>
            <th>Job Location</th>
            <th>Job Code</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          <tr class="jobcard collapsed" id="JD005" data-bs-toggle="collapse" href="#collapseOne1">
            <td><span class="font-26 key_value" id="Android Developer">Android Developer</span></td>
            <td class="font-24">3 to 8 Years</td>
            <td class="font-24">Chennai</td>
            <td class="font-24">JD005</td>
            <td><button class="nowapplys1 btn apply-btn font-22 aply">Apply</button></td>
          </tr>
          <tr class="job_detail_description">
            <td colspan="5">
              <div id="collapseOne1" class="collapse" data-bs-parent="#accordionExample">
                <div class="card-body row">
                  <div class="col-6">
                    <div class="summarypara">
                      <h6>Job Summary</h6>
                      <div class="sector-files"><label>Job Code</label>:<span class="automobile">JD005</span></div>
                      <div class="sector-files"><label>Designation</label>:<span class="automobile">Android Developer</span></div>
                      <div class="sector-files"><label>Qualification</label>:<span class="automobile">Any graduate</span></div>
                      <div class="sector-files"><label>Experience</label>:<span class="automobile">3 to 8 Years</span></div>
                      <div class="sector-files"><label>Job type</label>:<span class="automobile">Full Time</span></div>
                      <div class="sector-files"><label>No. of Positions</label>:<span class="automobile">10</span></div>
                      <div class="sector-files"><label>Location</label>:<span class="automobile">Chennai</span></div>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="describepara">
                      <h6>Job Description</h6>
                      <ul>
                        <li>Solid understanding of the full mobile application development life cycle.</li>
                        <li>Proficient in Kotlin and MVVM architecture.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
          <tr class="jobcard collapsed" id="JD021" data-bs-toggle="collapse" href="#collapseOne2">
            <td><span class="font-26 key_value" id="Data Scientist">Data Scientist</span></td>
            <td class="font-24">5+ Years</td>
            <td class="font-24">Bangalore</td>
            <td class="font-24">JD021</td>
            <td><button class="nowapplys1 btn apply-btn font-22 aply">Apply</button></td>
          </tr>
          <tr class="job_detail_description">
            <td colspan="5">
              <div id="collapseOne2" class="collapse" data-bs-parent="#accordionExample">
                <div class="card-body row">
                  <div class="col-6">
                    <div class="summarypara">
                      <h6>Job Summary</h6>
                      <div class="sector-files"><label>Job Code</label>:<span class="automobile">JD021</span></div>
                      <div class="sector-files"><label>Designation</label>:<span class="automobile">Data Scientist</span></div>
                      <div class="sector-files"><label>Qualification</label>:<span class="automobile">Any graduate</span></div>
                      <div class="sector-files"><label>Experience</label>:<span class="automobile">5+ Years</span></div>
                      <div class="sector-files"><label>Job type</label>:<span class="automobile">Full Time</span></div>
                      <div class="sector-files"><label>No. of Positions</label>:<span class="automobile">3</span></div>
                      <div class="sector-files"><label>Location</label>:<span class="automobile">Bangalore</span></div>
                    </div>
                  </div>
                  <div class="col-6">
                    <div class="describepara">
                      <h6>Job Description</h6>
                      <ul>
                        <li>Practical knowledge and working experience on Statistics and Operation Research methods.</li>
                        <li>Hands-on experience in machine learning and data mining.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
    <div class="change-pop mobpop jobcard1">
      <ul class="popup-ul">
        <li class="font-28">Job Title</li>
        <li class="font-24">Android Developer</li>
      </ul>
      <ul class="popup-ul">
        <li class="font-28">Experience</li>
        <li class="font-24">3 to 8 Years</li>
      </ul>
      <ul class="popup-ul">
        <li class="font-28">Job Location</li>
        <li class="font-24">Chennai</li>
      </ul>
      <ul class="popup-ul">
        <li class="font-28">Job Code</li>
        <li class="font-24">JD005</li>
      </ul>
      <ul class="popup-ul">
        <li class="font-28">Job Title</li>
        <li class="font-24">Data Scientist</li>
      </ul>
      <ul class="popup-ul">
        <li class="font-28">Experience</li>
        <li class="font-24">5+ Years</li>
      </ul>
      <ul class="popup-ul">
        <li class="font-28">Job Location</li>
        <li class="font-24">Bangalore</li>
      </ul>
      <ul class="popup-ul">
        <li class="font-28">Job Code</li>
        <li class="font-24">JD021</li>
      </ul>
    </div>
  </body>
</html>
`

const customerAnalyticsCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Company | Careers</title>
  </head>
  <body>
    <h1>Craft Your Success Story with Us</h1>
    <p>At Customer Analytics, we're looking for talented professionals who are passionate about innovation and growth.</p>
    <p>IMPORTANT: Please note that job offers at Customer Analytics and related communications will only come from customeranalytics.com and not from any other domain.</p>
    <section class="Opportunities_sec right-mix overflow-hidden bg-backgroundGray">
      <h3>Current Opportunities</h3>
      <div class="mb-8 md:mb-16">
        <div class="relative p-3 pt-2 transition bg-white mb-4">
          <div class="group w-full items-center justify-between p-4 rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <h5>MS Dynamics 365 F&amp;O Functional Consultant</h5>
            </div>
            <p>The role offers a legion of chances to explore and use latest technologies in delivering quality assurance to our clients through best process and practices.</p>
          </div>
          <div class="text-sm transition-all duration-200 ease-in-out overflow-hidden h-0 opacity-0">
            <div class="px-4 pb-4">
              <h6>Key Responsibility</h6>
              <ul>
                <li>Should be able to analyze business needs and to convert those needs into requirements.</li>
                <li>Should be able to run Fit-Gap analysis.</li>
              </ul>
              <h6>Requirements</h6>
              <ul>
                <li>Candidate has a Bachelor’s degree in any engineering background or in a related field with strong relevant work experience.</li>
                <li>Hands-on experience in the implementation of Dynamics 365 F&amp;O.</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="relative p-3 pt-2 transition bg-white mb-4">
          <div class="group w-full items-center justify-between p-4 rounded-lg">
            <div class="flex items-center justify-between mb-3">
              <h5>MS Dynamics 365 F&amp;O Developer</h5>
            </div>
            <p>The role offers a legion of chances to explore and use latest technologies in delivering quality assurance to our clients through best process and practices.</p>
          </div>
          <div class="text-sm transition-all duration-200 ease-in-out overflow-hidden h-0 opacity-0">
            <div class="px-4 pb-4">
              <h6>Key Responsibility</h6>
              <ul>
                <li>Hands-on with Finance, Accounts receivable, Accounts payable and Retail modules.</li>
                <li>End-to-end implementation.</li>
              </ul>
              <h6>Requirements</h6>
              <ul>
                <li>Candidate has a Bachelor’s degree in any engineering background or in a related field with strong relevant work experience.</li>
                <li>Create unit test cases and perform unit testing.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
    <section class="office">
      <h6>India</h6>
      <p>A-23, Thiru-Vi-Ka Industrial Estate</p>
      <p>Guindy, Chennai - 600032</p>
    </section>
  </body>
</html>
`

const mawaiCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>IT Careers | Join Our Team | SAP Openings</title>
  </head>
  <body>
    <h1>Career at Mawai</h1>
    <p>Your Gateway to a Rewarding Career in SAP Solutions</p>
    <h2>Career Opportunities</h2>
    <p>SAP Consultants : Join our team of SAP consultants and play a key role in implementing SAP solutions.</p>
    <p>Project Managers : Oversee project timelines, budgets, and resources.</p>
    <p>Sales and Business Development Professionals : Drive business growth by identifying new opportunities.</p>
    <p>Technical Experts : Bring your technical expertise to the table as a developer, analyst, or system administrator.</p>
    <form>
      <input name="name" />
      <input name="email" />
      <button type="submit">Submit</button>
    </form>
  </body>
</html>
`

const loadModule = async (relativePath) => {
  try {
    return await import(relativePath)
  } catch {
    assert.fail(`Expected scraper module at ${relativePath}`)
  }
}

test('Marquis Technologies stays fail-closed while the first-party homepage is intact but the public jobs route is compromised', async () => {
  const marquis = await loadModule('../../scraper/marquistechnologies/script.js')

  assert.equal(marquis.hasOfficialHomepageSignal(marquisHomepageHtml), true)
  assert.equal(marquis.hasCompromisedCareersSignal(marquisCompromisedJobsHtml), true)

  const jobs = await marquis.createMarquisTechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === marquis.HOMEPAGE_URL) return marquisHomepageHtml
      if (url === marquis.CAREERS_URL) return marquisCompromisedJobsHtml
      throw new Error(`Unexpected Marquis URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    marquis.createMarquisTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === marquis.HOMEPAGE_URL) return marquisHomepageHtml
        if (url === marquis.CAREERS_URL) {
          return `
            <html><body>
              <h1>Open Positions</h1>
              <a href="/openings/device-test-engineer">More Details</a>
            </body></html>
          `
        }
        throw new Error(`Unexpected Marquis URL: ${url}`)
      },
    }),
    /compromised careers route/i,
  )
})

test('V2soft extracts the verified India listing page and first-party detail pages', async () => {
  const v2soft = await loadModule('../../scraper/v2soft/script.js')

  assert.equal(v2soft.hasOfficialCareersSignal(v2softListingHtml), true)
  assert.deepEqual(v2soft.extractJobCards(v2softListingHtml), [
    {
      title: 'Digital Marketing Lead',
      location: 'Bangalore, KA',
      detailUrl: 'https://marketing.v2soft.com/india-careers/digital-marketing-jobs/',
    },
    {
      title: 'Mobile Developer',
      location: 'Bangalore, KA',
      detailUrl: 'https://marketing.v2soft.com/india-careers/mobile-developer-jobs/',
    },
  ])

  const jobs = await v2soft.createV2softScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      if (url === v2soft.CAREERS_URL) return v2softListingHtml
      if (url === 'https://marketing.v2soft.com/india-careers/digital-marketing-jobs/') {
        return v2softDigitalMarketingDetailHtml
      }
      if (url === 'https://marketing.v2soft.com/india-careers/mobile-developer-jobs/') {
        return v2softMobileDeveloperDetailHtml
      }
      throw new Error(`Unexpected V2soft URL: ${url}`)
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
      employmentType: job.employmentType,
      experienceRequired: job.experienceRequired,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Digital Marketing - Lead',
        location: 'Bangalore, KA, India',
        jobId: '21-00681',
        employmentType: 'Full Time',
        experienceRequired: '7+ Years',
        applyUrl: 'https://marketing.v2soft.com/india-careers/digital-marketing-jobs/',
      },
      {
        title: 'Mobile Developer',
        location: 'Bangalore, KA, India',
        jobId: '21-00631',
        employmentType: 'Full Time',
        experienceRequired: '6 - 8 Years',
        applyUrl: 'https://marketing.v2soft.com/india-careers/mobile-developer-jobs/',
      },
    ],
  )
})

test('Colan Infotech extracts the verified job-card rows and detail panels', async () => {
  const colan = await loadModule('../../scraper/colaninfotech/script.js')

  assert.equal(colan.hasOfficialCareersSignal(colanCareersHtml), true)

  const jobs = await colan.createColanInfotechScraper({
    now: () => '2026-08-01T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, colan.CAREERS_URL)
      return colanCareersHtml
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
      experienceRequired: job.experienceRequired,
      employmentType: job.employmentType,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'Android Developer',
        location: 'Chennai, India',
        jobId: 'JD005',
        experienceRequired: '3 to 8 Years',
        employmentType: 'Full Time',
        applyUrl: 'https://colaninfotech.com/career/',
      },
      {
        title: 'Data Scientist',
        location: 'Bangalore, India',
        jobId: 'JD021',
        experienceRequired: '5+ Years',
        employmentType: 'Full Time',
        applyUrl: 'https://colaninfotech.com/career/',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Kotlin/i)
  assert.match(jobs[1].jobDescription, /machine learning/i)
})

test('Customer Analytics extracts the verified inline current opportunities', async () => {
  const customerAnalytics = await loadModule('../../scraper/customeranalytics/script.js')

  assert.equal(customerAnalytics.hasOfficialCareersSignal(customerAnalyticsCareersHtml), true)

  const jobs = await customerAnalytics.createCustomerAnalyticsScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, customerAnalytics.CAREERS_URL)
      return customerAnalyticsCareersHtml
    },
  })

  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      jobId: job.jobId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
    })),
    [
      {
        title: 'MS Dynamics 365 F&O Functional Consultant',
        location: 'Chennai, India',
        jobId: 'ms-dynamics-365-f-o-functional-consultant',
        sourceUrl: 'https://www.customeranalytics.com/company/careers',
        applyUrl: 'https://www.customeranalytics.com/company/careers',
      },
      {
        title: 'MS Dynamics 365 F&O Developer',
        location: 'Chennai, India',
        jobId: 'ms-dynamics-365-f-o-developer',
        sourceUrl: 'https://www.customeranalytics.com/company/careers',
        applyUrl: 'https://www.customeranalytics.com/company/careers',
      },
    ],
  )
  assert.match(jobs[0].jobDescription, /Fit-Gap analysis/i)
  assert.match(jobs[1].jobDescription, /unit testing/i)
})

test('Mawai Infotech stays fail-closed while the first-party careers page only exposes broad role categories and a contact form', async () => {
  const mawai = await loadModule('../../scraper/mawaiinfotech/script.js')

  assert.equal(mawai.hasOfficialCareersSignal(mawaiCareersHtml), true)
  assert.deepEqual(mawai.extractRoleCategories(mawaiCareersHtml), [
    'SAP Consultants',
    'Project Managers',
    'Sales and Business Development Professionals',
    'Technical Experts',
  ])

  const jobs = await mawai.createMawaiInfotechScraper().run({
    fetchText: async (url) => {
      assert.equal(url, mawai.CAREERS_URL)
      return mawaiCareersHtml
    },
  })

  assert.deepEqual(jobs, [])

  await assert.rejects(
    mawai.createMawaiInfotechScraper().run({
      fetchText: async () => `
        ${mawaiCareersHtml}
        <article>
          <h3>SAP Basis Consultant</h3>
          <p>Job Code: MAW-101</p>
          <a href="/jobs/sap-basis-consultant">Apply Now</a>
        </article>
      `,
    }),
    /generic role categories/i,
  )
})
