import assert from 'node:assert/strict'
import test from 'node:test'

const loadDigiVersalModule = async () => {
  try {
    return await import('../../scraper/digiversal/script.js')
  } catch {
    assert.fail('Expected DigiVersal scraper module at ../../scraper/digiversal/script.js')
  }
}

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digiversal | Business Growth & Innovation Services for Enterprises</title>
    <meta
      name="description"
      content="Digiversal empowers enterprises with cutting-edge business growth strategies, innovation-driven solutions, and expert consulting. Scale operations, redefine brand identity, and achieve measurable success with our tailored approach."
    />
  </head>
  <body>
    <header>
      <a href="https://www.digiversal.co/about-us">About Us</a>
      <a href="https://www.digiversal.co/careers">Career</a>
      <a href="https://www.digiversal.co/contact-us">Contact Us</a>
    </header>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Digiversal - Join Our Team & Build Your Future</title>
    <meta
      name="description"
      content="Explore career opportunities at Digiversal. Join a fast-growing team where talent meets opportunity. Apply today and take your career to the next level!"
    />
  </head>
  <body>
    <main>
      <div class="subCareer">
        <a href="academic-research-mentor">Academic Research Mentor<br />
          <span><i class="far fa-calendar-alt"></i> July 2026</span>
          <span><i class="fas fa-map-marker-alt"></i> Sector 6, Noida</span>
        </a>
        <a href="academic-research-mentor" class="cta">View More</a>
      </div>
      <div class="subCareer">
        <a href="android-developer">Android Developer<br />
          <span><i class="far fa-calendar-alt"></i> July 2026</span>
          <span><i class="fas fa-map-marker-alt"></i> Sector 6, Noida</span>
        </a>
        <a href="android-developer" class="cta">View More</a>
      </div>
      <footer>
        <a href="mailto:career@digiversal.co">career@digiversal.co</a>
      </footer>
    </main>
  </body>
</html>
`

const academicResearchMentorDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Academic Research Mentor Digiversal</title>
    <meta name="description" content="DigiVersal is looking for Academic Research Mentor. Apply Now!" />
  </head>
  <body>
    <main>
      <h1>Academic Research Mentor</h1>
      <div>Careers Academic Research Mentor</div>
      <p>Digiversal combines education and business expertise to deliver holistic solutions that drive success.</p>
      <p>Key Responsibilities: Academic Mentoring Provide doubt-clearing sessions to address student queries related to their coursework.</p>
      <p>Required Candidate profile: Excellent oral and written communication skills in English.</p>
      <p>Qualifications: Management: MBA (Finance, HRM, Operations &amp; Project Management).</p>
      <div>Apply Now</div>
      <div>Department: Academic Research Mentor</div>
      <div>Project Location(s): Noida/NCR</div>
      <div>Education: Any Graduate</div>
      <div>Experience: 1-3 years</div>
    </main>
  </body>
</html>
`

const androidDeveloperDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Android Developer - Digiversal</title>
    <meta name="description" content="DigiVersal is looking for Android Developer. Apply Now!" />
  </head>
  <body>
    <main>
      <h1>Android Developer</h1>
      <div>Careers Android Developer</div>
      <p>We’re looking for an experienced Software Engineer to work on Native Android applications within our product development team.</p>
      <p>Responsibilities Designing, Coding, and Debugging native Android applications.</p>
      <p>3-5 years of experience in Android development using Android SDK, Android Studio, Java, and Web Services (REST/SOAP).</p>
      <p>Apply Now</p>
      <div>Department: Technology</div>
      <div>Project Location(s): Noida/NCR</div>
      <div>Education: BE/BTech/ME/MTech/MCA/MSc degree required</div>
    </main>
  </body>
</html>
`

const digitalMarketingExecutiveDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Digital Marketing Executive | SEO Executive - Digiversal</title>
    <meta
      name="description"
      content="Join DigiVersal as a Digital Marketing Executive in Noida! Elevate your SEO skills, drive lead generation, and grow with an innovative, dynamic team. Apply now!"
    />
  </head>
  <body>
    <main>
      <div>Careers Digital Marketing Executive (SEO Executive)</div>
      <p>Join DigiVersal as a Digital Marketing Executive in Noida and grow search visibility and leads.</p>
      <p>Responsibilities: Strong understanding about advanced link building. Execute effective off-page SEO strategies, including link-building, citations, and outreach.</p>
      <div>Project Location(s): Sector 6, Noida</div>
      <div>Education: Any Graduate</div>
      <div>Experience: 6 Months to 3 Years</div>
      <div>Apply Now</div>
    </main>
  </body>
</html>
`

test('DigiVersal helpers stay pinned to the verified root redirect, careers cards, and same-domain detail-page contract', async () => {
  const digiversal = await loadDigiVersalModule()

  assert.equal(digiversal.SOURCE, 'digiversal')
  assert.equal(digiversal.COMPANY, 'DigiVersal')
  assert.equal(digiversal.VERIFIED_AT, '2026-08-01')
  assert.equal(digiversal.ROOT_URL, 'https://digiversal.in/')
  assert.equal(digiversal.HOMEPAGE_URL, 'https://www.digiversal.co/')
  assert.equal(digiversal.CAREERS_URL, 'https://www.digiversal.co/careers/')
  assert.deepEqual(digiversal.MISSING_JOB_ROUTE_URLS, [
    'https://www.digiversal.co/career',
    'https://www.digiversal.co/jobs',
    'https://www.digiversal.co/join-us',
    'https://www.digiversal.co/openings',
    'https://www.digiversal.co/current-openings',
  ])

  assert.equal(digiversal.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(digiversal.hasOfficialCareersSurface(careersHtml), true)
  assert.deepEqual(digiversal.extractCareerCards(careersHtml), [
    {
      slug: 'academic-research-mentor',
      title: 'Academic Research Mentor',
      postingLabel: 'July 2026',
      locationLabel: 'Sector 6, Noida',
      detailUrl: 'https://www.digiversal.co/careers/academic-research-mentor',
    },
    {
      slug: 'android-developer',
      title: 'Android Developer',
      postingLabel: 'July 2026',
      locationLabel: 'Sector 6, Noida',
      detailUrl: 'https://www.digiversal.co/careers/android-developer',
    },
  ])
  assert.deepEqual(
    digiversal.extractJobDetail(academicResearchMentorDetailHtml, 'Academic Research Mentor'),
    {
      jobDescription:
        'Digiversal combines education and business expertise to deliver holistic solutions that drive success. Key Responsibilities: Academic Mentoring Provide doubt-clearing sessions to address student queries related to their coursework. Required Candidate profile: Excellent oral and written communication skills in English. Qualifications: Management: MBA (Finance, HRM, Operations & Project Management).',
      experienceRequired: '1-3 years',
      minimumQualification: 'Any Graduate',
      department: 'Academic Research Mentor',
    },
  )
  assert.deepEqual(
    digiversal.extractJobDetail(androidDeveloperDetailHtml, 'Android Developer'),
    {
      jobDescription:
        'We’re looking for an experienced Software Engineer to work on Native Android applications within our product development team. Responsibilities Designing, Coding, and Debugging native Android applications. 3-5 years of experience in Android development using Android SDK, Android Studio, Java, and Web Services (REST/SOAP).',
      experienceRequired: '3-5 years',
      minimumQualification: 'BE/BTech/ME/MTech/MCA/MSc degree required',
      department: 'Technology',
    },
  )
  assert.equal(
    digiversal.hasJobDetailSignal(
      digitalMarketingExecutiveDetailHtml,
      'Digital Marketing Executive (SEO Executive)',
    ),
    true,
  )
  assert.deepEqual(
    digiversal.extractJobDetail(
      digitalMarketingExecutiveDetailHtml,
      'Digital Marketing Executive (SEO Executive)',
    ),
    {
      jobDescription:
        'Join DigiVersal as a Digital Marketing Executive in Noida and grow search visibility and leads. Responsibilities: Strong understanding about advanced link building. Execute effective off-page SEO strategies, including link-building, citations, and outreach.',
      experienceRequired: '6 Months to 3 Years',
      minimumQualification: 'Any Graduate',
      department: null,
    },
  )
  assert.equal(digiversal.parsePostingDate('July 2026'), '2026-07-01')
  assert.equal(
    digiversal.isMissingJobRoute(
      { status: 404, url: digiversal.MISSING_JOB_ROUTE_URLS[0], html: '' },
      digiversal.MISSING_JOB_ROUTE_URLS[0],
    ),
    true,
  )
})

test('DigiVersal run extracts the verified same-domain career cards into normalized India jobs', async () => {
  const digiversal = await loadDigiVersalModule()
  const requestedUrls = []

  const jobs = await digiversal.createDigiVersalScraper({
    now: () => '2026-07-15T00:00:00.000Z',
  }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === digiversal.ROOT_URL) {
        return { status: 200, url: digiversal.HOMEPAGE_URL, html: homepageHtml }
      }

      if (url === digiversal.CAREERS_URL) {
        return { status: 200, url, html: careersHtml }
      }

      if (digiversal.MISSING_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: '' }
      }

      if (url === 'https://www.digiversal.co/careers/academic-research-mentor') {
        return { status: 200, url, html: academicResearchMentorDetailHtml }
      }

      if (url === 'https://www.digiversal.co/careers/android-developer') {
        return { status: 200, url, html: androidDeveloperDetailHtml }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    digiversal.ROOT_URL,
    digiversal.CAREERS_URL,
    ...digiversal.MISSING_JOB_ROUTE_URLS,
    'https://www.digiversal.co/careers/academic-research-mentor',
    'https://www.digiversal.co/careers/android-developer',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Academic Research Mentor',
    company: 'DigiVersal',
    location: 'Sector 6, Noida, India',
    city: 'Noida',
    country: 'India',
    link: 'https://www.digiversal.co/careers/academic-research-mentor',
    applyUrl: 'https://www.digiversal.co/careers/academic-research-mentor',
    sourceUrl: 'https://www.digiversal.co/careers/academic-research-mentor',
    source: 'digiversal',
    jobId: 'academic-research-mentor',
    requisitionId: 'academic-research-mentor',
    department: 'Academic Research Mentor',
    employmentType: null,
    experienceRequired: '1-3 years',
    jobDescription:
      'Digiversal combines education and business expertise to deliver holistic solutions that drive success. Key Responsibilities: Academic Mentoring Provide doubt-clearing sessions to address student queries related to their coursework. Required Candidate profile: Excellent oral and written communication skills in English. Qualifications: Management: MBA (Finance, HRM, Operations & Project Management).',
    minimumQualification: 'Any Graduate',
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-01',
    remoteStatus: 'On-site',
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })
  assert.equal(jobs[1].title, 'Android Developer')
  assert.equal(jobs[1].location, 'Sector 6, Noida, India')
  assert.equal(jobs[1].experienceRequired, '3-5 years')
  assert.equal(jobs[1].minimumQualification, 'BE/BTech/ME/MTech/MCA/MSc degree required')
  assert.match(jobs[1].jobDescription, /Native Android applications/i)
  assert.equal(jobs[1].postingDate, '2026-07-01')
})

test('DigiVersal fails closed when the verified root redirect, careers cards, alternate routes, or detail pages drift', async () => {
  const digiversal = await loadDigiVersalModule()

  await assert.rejects(
    digiversal.createDigiVersalScraper().run({
      fetchPage: async (url) => {
        if (url === digiversal.ROOT_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified root redirect/i,
  )

  await assert.rejects(
    digiversal.createDigiVersalScraper().run({
      fetchPage: async (url) => {
        if (url === digiversal.ROOT_URL) {
          return { status: 200, url: digiversal.HOMEPAGE_URL, html: '<html><title>Unexpected</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    digiversal.createDigiVersalScraper().run({
      fetchPage: async (url) => {
        if (url === digiversal.ROOT_URL) {
          return { status: 200, url: digiversal.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === digiversal.CAREERS_URL) {
          return { status: 200, url, html: '<html><title>Careers</title></html>' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    digiversal.createDigiVersalScraper().run({
      fetchPage: async (url) => {
        if (url === digiversal.ROOT_URL) {
          return { status: 200, url: digiversal.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === digiversal.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (url === digiversal.MISSING_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body>Current Openings</body></html>' }
        }

        if (digiversal.MISSING_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: '' }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified missing alternate jobs route/i,
  )

  await assert.rejects(
    digiversal.createDigiVersalScraper().run({
      fetchPage: async (url) => {
        if (url === digiversal.ROOT_URL) {
          return { status: 200, url: digiversal.HOMEPAGE_URL, html: homepageHtml }
        }

        if (url === digiversal.CAREERS_URL) {
          return { status: 200, url, html: careersHtml }
        }

        if (digiversal.MISSING_JOB_ROUTE_URLS.includes(url)) {
          return { status: 404, url, html: '' }
        }

        if (url === 'https://www.digiversal.co/careers/academic-research-mentor') {
          return { status: 200, url, html: '<html><title>Academic Research Mentor</title></html>' }
        }

        if (url === 'https://www.digiversal.co/careers/android-developer') {
          return { status: 200, url, html: androidDeveloperDetailHtml }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified first-party job detail page/i,
  )
})
