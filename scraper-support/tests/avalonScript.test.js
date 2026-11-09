import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Avalon Information Systems | Open-Source Development Tools for SDGs</title>
    <link rel="canonical" href="https://www.avaloninfosys.com/" />
  </head>
  <body>
    <nav>
      <a href="/">Home</a>
      <a href="/career">Career</a>
      <a href="/contact-us">Contact</a>
    </nav>
    <main>
      <p>An industry-certified, CMMI Maturity Level 3 and ISO 27001:2013 software development company.</p>
      <a href="mailto:info@avaloninfosys.com">info@avaloninfosys.com</a>
    </main>
  </body>
</html>
`

const careerListingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Avalon Information Systems</title>
  </head>
  <body>
    <main>
      <div class="main-career">
        <div class="career-page">
          <p>Avalon is a team of good people creating great things.</p>
          <p>Send examples of your work to <a href="mailto:jobs@avaloninfosys.com">jobs@avaloninfosys.com</a>.</p>
          <h2>Current Opening</h2>
          <table>
            <thead>
              <tr>
                <th>Job Title</th>
                <th>Experience Required</th>
                <th>Skills</th>
                <th>View Details</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Executive Assistant</td>
                <td>Fresher - 3 years</td>
                <td>MS Office, MS Excel, and Google Workspace, verbal and written communication skills in English</td>
                <td><a href="/vacancies/executive-assistant">View Job</a></td>
              </tr>
              <tr>
                <td>Software Engineer Internship Programme</td>
                <td>Fresher</td>
                <td>Understanding of programming languages such as Java, Python, C++, or similar.</td>
                <td><a href="/vacancies/software-engineer-internship-programme">View Job</a></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </main>
  </body>
</html>
`

const careerAliasHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career | Avalon Information Systems</title>
  </head>
  <body>
    <h1>Vacancies</h1>
    <h2>Current Opening</h2>
    <table>
      <tbody>
        <tr>
          <td>Executive Assistant</td>
          <td>Fresher - 3 years</td>
          <td>MS Office, MS Excel, and Google Workspace, verbal and written communication skills in English</td>
          <td><a href="/vacancies/executive-assistant">View Job</a></td>
        </tr>
      </tbody>
    </table>
  </body>
</html>
`

const legacyCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Avalon Information Systems | Careers</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>Avalon is a team of good people creating great things.</p>
    <p>Aside from the openings below, if you’re into something amazing you think we should know about, send examples of your work to jobs@avaloninfosys.com.</p>
    <h2>Current Openings</h2>
    <article>
      <h3>Test Developer</h3>
      <p>Exp</p>
      <p>3-5 years</p>
    </article>
    <a href="/index.php/career">See active vacancy table</a>
    <a href="#careerApplyPage">Apply</a>
  </body>
</html>
`

const missingJobRouteHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 | Avalon Information Systems</title>
  </head>
  <body>
    <h1>Page Not Found</h1>
    <p>Something went wrong, Looks like this page is not available any more</p>
    <a href="/career">Career</a>
    <a href="mailto:info@avaloninfosys.com">info@avaloninfosys.com</a>
  </body>
</html>
`

const executiveAssistantDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Executive Assistant | Avalon Information Systems</title>
  </head>
  <body>
    <div class="career-page-details">
      <div class="left-content-info-career">
        <h3 class="jobs-title mb-4">Executive Assistant</h3>
        <h5 class="job-summary">Experience: Fresher - 3 years | Location: On Site (Delhi, Vasant Kunj) | Required Skills: MS Office, MS Excel, and Google Workspace, verbal and written communication skills in English</h5>
        <h4 class="job-summary">About the Job:</h4>
        <div class="jobs-description mt-4">
          <p>Job Title: Executive Assistant (Client-Facing)<br>Location: Vasant Kunj<br>Employment Type: Full-time</p>
          <p><strong>Role Overview</strong></p>
          <p>We are seeking a smart, organized, and confident Executive Assistant to support senior leadership and assist in client coordination.</p>
          <p><strong>Key Responsibilities</strong></p>
          <ul>
            <li>Assist senior leaders with calendar management, meeting scheduling, and daily coordination.</li>
            <li>Prepare meeting agendas, notes, presentations, and follow-ups.</li>
            <li>Handle professional email communication on behalf of leadership when required.</li>
          </ul>
          <p><strong>Skills &amp; Requirements</strong></p>
          <ul>
            <li>Excellent verbal and written communication skills in English (mandatory).</li>
            <li>0-3 years of experience in administrative, coordination, or support roles.</li>
          </ul>
          <p>Educational Qualification</p>
          <p>Bachelor's degree in any discipline (fresh graduates with strong communication skills are welcome).</p>
          <ul class="job-summary-details">
            <li><strong>No. of positions:</strong> 1</li>
          </ul>
        </div>
      </div>
      <div class="right-content-form-career">
        <form action="/vacancies/executive-assistant" method="post" enctype="multipart/form-data">
          <input type="text" name="name" placeholder="Name" />
          <div>Upload your resume</div>
          <input type="file" name="files[resume]" />
          <button type="submit">Apply Now</button>
        </form>
      </div>
    </div>
  </body>
</html>
`

const softwareInternshipDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Software Engineer Internship Programme | Avalon Information Systems</title>
  </head>
  <body>
    <div class="career-page-details">
      <div class="left-content-info-career">
        <h3 class="jobs-title mb-4">Software Engineer Internship Programme</h3>
        <h5 class="job-summary">Experience: Fresher | Location: On Site (Delhi, Vasant Kunj) | Required Skills: Understanding of programming languages such as Java, Python, C++, or similar.</h5>
        <h4 class="job-summary">About the Job:</h4>
        <div class="jobs-description mt-4">
          <p>Location: Vasant Kunj, Delhi<br>Stipend: ₹15,000 per month<br>Duration: 3-6 months</p>
          <p><strong>About the Internship</strong></p>
          <p>Join our dynamic team and immerse yourself in a supportive, innovative environment where learning, creativity, and technology come together.</p>
          <p><strong>Eligibility Criteria</strong></p>
          <ul>
            <li>Currently enrolled in a Bachelor's or Master's program in Computer Science, Information Technology, or a related field.</li>
            <li>Solid understanding of programming languages such as Java, Python, C++, or similar.</li>
            <li>Basic knowledge of operating systems, databases, and networking fundamentals.</li>
          </ul>
          <p><strong>Why Join Avalon?</strong></p>
          <ul>
            <li>Work on real-world projects with direct mentorship from experienced IT professionals.</li>
            <li>Opportunity to convert the internship into a full-time offer based on performance.</li>
          </ul>
          <ul class="job-summary-details">
            <li><strong>No. of positions:</strong> 1</li>
          </ul>
        </div>
      </div>
      <div class="right-content-form-career">
        <form action="/index.php/vacancies/software-engineer-internship-programme" method="post" enctype="multipart/form-data">
          <div>Upload Resume</div>
          <input type="file" name="files[resume]" />
          <button type="submit">Apply Now</button>
        </form>
      </div>
    </div>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Avalon Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Principal Engineer"}
    </script>
  </head>
  <body>
    <h1>Current Openings</h1>
    <a href="https://www.avaloninfosys.com/jobs/principal-engineer">Apply now</a>
  </body>
</html>
`

const loadAvalonModule = async () => {
  try {
    return await import('../../scraper/avalon/script.js')
  } catch {
    assert.fail('Expected Avalon scraper module at ../../scraper/avalon/script.js')
  }
}

test('Avalon scraper constants and helpers stay pinned to the verified first-party careers surface', async () => {
  const avalon = await loadAvalonModule()

  assert.equal(avalon.SOURCE, 'avalon')
  assert.equal(avalon.COMPANY, 'Avalon')
  assert.equal(avalon.OFFICIAL_BRAND_NAME, 'Avalon Information Systems')
  assert.equal(avalon.VERIFIED_ON, '2026-07-28')
  assert.equal(avalon.HOMEPAGE_URL, 'https://www.avaloninfosys.com/')
  assert.equal(avalon.CAREERS_URL, 'https://www.avaloninfosys.com/career')
  assert.equal(avalon.CAREER_ALIAS_URL, 'https://www.avaloninfosys.com/index.php/career')
  assert.equal(avalon.LEGACY_CAREERS_URL, 'https://www.avaloninfosys.com/careers')
  assert.equal(avalon.APPLICATION_EMAIL, 'jobs@avaloninfosys.com')
  assert.deepEqual(avalon.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.avaloninfosys.com/jobs',
    'https://www.avaloninfosys.com/join-us',
    'https://www.avaloninfosys.com/work-with-us',
  ])
  assert.match(avalon.VERIFIED_SURFACE_SUMMARY, /https:\/\/www\.avaloninfosys\.com\/career/i)
  assert.equal(avalon.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(avalon.hasOfficialCareerPageSignal(careerListingHtml), true)
  assert.equal(avalon.hasOfficialCareerPageSignal(careerAliasHtml), true)
  assert.equal(avalon.hasLegacyCareersPageSignal(legacyCareersHtml), true)
  assert.equal(avalon.hasOfficialDetailPageSignal(executiveAssistantDetailHtml), true)
  assert.equal(avalon.pageExposesPublicJobListings(careerListingHtml), true)
  assert.equal(avalon.pageExposesPublicJobListings(legacyCareersHtml), false)
  assert.equal(avalon.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.deepEqual(
    avalon.extractListingRows(careerListingHtml),
    [
      {
        title: 'Executive Assistant',
        experienceRequired: 'Fresher - 3 years',
        skillsSummary: 'MS Office, MS Excel, and Google Workspace, verbal and written communication skills in English',
        sourceUrl: 'https://www.avaloninfosys.com/vacancies/executive-assistant',
      },
      {
        title: 'Software Engineer Internship Programme',
        experienceRequired: 'Fresher',
        skillsSummary: 'Understanding of programming languages such as Java, Python, C++, or similar.',
        sourceUrl: 'https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme',
      },
    ],
  )
  assert.equal(
    avalon.isMissingNoPublicJobRoute({
      status: 404,
      url: 'https://www.avaloninfosys.com/jobs',
      html: missingJobRouteHtml,
    }),
    true,
  )
})

test('Avalon run validates the verified first-party listing surface and returns normalized jobs from vacancy detail pages', async () => {
  const avalon = await loadAvalonModule()
  const requestedUrls = []

  const jobs = await avalon.createAvalonScraper({
    now: () => '2026-07-15T09:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === avalon.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === avalon.CAREERS_URL) {
        return { status: 200, url, html: careerListingHtml }
      }

      if (url === avalon.CAREER_ALIAS_URL) {
        return { status: 200, url, html: careerAliasHtml }
      }

      if (url === avalon.LEGACY_CAREERS_URL) {
        return { status: 200, url, html: legacyCareersHtml }
      }

      if (avalon.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: missingJobRouteHtml }
      }

      if (url === 'https://www.avaloninfosys.com/vacancies/executive-assistant') {
        return { status: 200, url, html: executiveAssistantDetailHtml }
      }

      if (url === 'https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme') {
        return { status: 200, url, html: softwareInternshipDetailHtml }
      }

      throw new Error(`Unexpected Avalon URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    avalon.HOMEPAGE_URL,
    avalon.CAREERS_URL,
    avalon.CAREER_ALIAS_URL,
    avalon.LEGACY_CAREERS_URL,
    ...avalon.NO_PUBLIC_JOB_ROUTE_URLS,
    'https://www.avaloninfosys.com/vacancies/executive-assistant',
    'https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme',
  ])

  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Executive Assistant',
      'Software Engineer Internship Programme',
    ],
  )

  const executiveAssistant = jobs.find((job) => job.jobId === 'avalon-executive-assistant')
  const softwareIntern = jobs.find((job) => job.jobId === 'avalon-software-engineer-internship-programme')

  assert.equal(executiveAssistant.company, 'Avalon')
  assert.equal(executiveAssistant.location, 'Delhi, Vasant Kunj')
  assert.equal(executiveAssistant.city, 'Delhi')
  assert.equal(executiveAssistant.country, 'India')
  assert.equal(executiveAssistant.employmentType, 'Full-time')
  assert.equal(executiveAssistant.workplaceType, 'On Site')
  assert.equal(executiveAssistant.experienceRequired, 'Fresher - 3 years')
  assert.equal(
    executiveAssistant.minimumQualification,
    "Bachelor's degree in any discipline (fresh graduates with strong communication skills are welcome).",
  )
  assert.deepEqual(executiveAssistant.requiredSkills, [
    'MS Office, MS Excel, and Google Workspace, verbal and written communication skills in English',
  ])
  assert.equal(executiveAssistant.applyUrl, 'https://www.avaloninfosys.com/vacancies/executive-assistant')
  assert.match(executiveAssistant.jobDescription, /Role Overview/i)
  assert.match(executiveAssistant.jobDescription, /Key Responsibilities/i)
  assert.match(executiveAssistant.jobDescription, /Educational Qualification/i)
  assert.equal(executiveAssistant.scrapedAt, '2026-07-15T09:00:00.000Z')

  assert.equal(softwareIntern.company, 'Avalon')
  assert.equal(softwareIntern.location, 'Delhi, Vasant Kunj')
  assert.equal(softwareIntern.city, 'Delhi')
  assert.equal(softwareIntern.country, 'India')
  assert.equal(softwareIntern.employmentType, 'Internship')
  assert.equal(softwareIntern.workplaceType, 'On Site')
  assert.equal(softwareIntern.experienceRequired, 'Fresher')
  assert.equal(softwareIntern.compensation, '₹15,000 per month')
  assert.deepEqual(softwareIntern.requiredSkills, [
    'Understanding of programming languages such as Java, Python, C++, or similar.',
  ])
  assert.equal(
    softwareIntern.applyUrl,
    'https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme',
  )
  assert.match(softwareIntern.jobDescription, /About the Internship/i)
  assert.match(softwareIntern.jobDescription, /Eligibility Criteria/i)
  assert.match(softwareIntern.jobDescription, /Why Join Avalon\?/i)
  assert.equal(softwareIntern.scrapedAt, '2026-07-15T09:00:00.000Z')
})

test('Avalon fails closed when the verified homepage, careers pages, detail pages, or adjacent routes drift', async () => {
  const avalon = await loadAvalonModule()

  await assert.rejects(
    avalon.createAvalonScraper().run({
      fetchPage: async (url) => {
        if (url === avalon.HOMEPAGE_URL) {
          return { status: 200, url, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected Avalon URL: ${url}`)
      },
    }),
    /homepage/i,
  )

  await assert.rejects(
    avalon.createAvalonScraper().run({
      fetchPage: async (url) => {
        if (url === avalon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === avalon.CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        throw new Error(`Unexpected Avalon URL: ${url}`)
      },
    }),
    /career page/i,
  )

  await assert.rejects(
    avalon.createAvalonScraper().run({
      fetchPage: async (url) => {
        if (url === avalon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === avalon.CAREERS_URL) {
          return { status: 200, url, html: careerListingHtml }
        }

        if (url === avalon.CAREER_ALIAS_URL) {
          return { status: 200, url, html: careerAliasHtml }
        }

        if (url === avalon.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Avalon URL: ${url}`)
      },
    }),
    /legacy careers/i,
  )

  await assert.rejects(
    avalon.createAvalonScraper().run({
      fetchPage: async (url) => {
        if (url === avalon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === avalon.CAREERS_URL) {
          return { status: 200, url, html: careerListingHtml }
        }

        if (url === avalon.CAREER_ALIAS_URL) {
          return { status: 200, url, html: careerAliasHtml }
        }

        if (url === avalon.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        if (avalon.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: missingJobRouteHtml }
        }

        if (url === 'https://www.avaloninfosys.com/vacancies/executive-assistant') {
          return { status: 200, url, html: '<html><body><h1>Broken</h1></body></html>' }
        }

        if (url === 'https://www.avaloninfosys.com/vacancies/software-engineer-internship-programme') {
          return { status: 200, url, html: softwareInternshipDetailHtml }
        }

        throw new Error(`Unexpected Avalon URL: ${url}`)
      },
    }),
    /vacancy detail page/i,
  )

  await assert.rejects(
    avalon.createAvalonScraper().run({
      fetchPage: async (url) => {
        if (url === avalon.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === avalon.CAREERS_URL) {
          return { status: 200, url, html: careerListingHtml }
        }

        if (url === avalon.CAREER_ALIAS_URL) {
          return { status: 200, url, html: careerAliasHtml }
        }

        if (url === avalon.LEGACY_CAREERS_URL) {
          return { status: 200, url, html: legacyCareersHtml }
        }

        if (url === avalon.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: publicJobsHtml }
        }

        if (avalon.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: missingJobRouteHtml }
        }

        throw new Error(`Unexpected Avalon URL: ${url}`)
      },
    }),
    /no-public job route/i,
  )
})
