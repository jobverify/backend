import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ASSOCHAM | Knowledge Architect of India</title>
  </head>
  <body>
    <header>
      <nav>
        <a href="/">Home</a>
        <a href="career.php">Careers</a>
        <a href="career.php">Career</a>
        <a href="/contact-us">Contact</a>
      </nav>
    </header>
    <main>
      <h1>Knowledge Architect of India</h1>
      <p>ASSOCHAM works across diverse policy, industry, and global collaboration initiatives.</p>
    </main>
  </body>
</html>
`

const careersIntakeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ASSOCHAM | Knowledge Architect of India</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Submit Your Profile</h2>
      <p>
        Elevate your career with us, where opportunities await in Policy Advocacy, Industry
        Representation, Research, and Global collaborations.
      </p>
      <p><a href="mailto:hr@assocham.com">hr@assocham.com</a></p>
      <form action="search.php">
        <label>Job title <input name="job_title" /></label>
        <label>Email id <input name="email" /></label>
        <label>Upload your resume <input name="resume" type="file" /></label>
        <button type="submit" name="submit_career">Apply Now</button>
      </form>
      <section>
        <h2>Apply for internship</h2>
        <form>
          <label>Email id <input name="applicant_email" /></label>
          <label>Upload your resume <input name="applicant_resume" type="file" /></label>
        </form>
      </section>
    </main>
  </body>
</html>
`

const notFoundHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>404 Not Found</title>
  </head>
  <body>
    <h1>404 Not Found</h1>
    <p>The requested URL was not found on this server.</p>
  </body>
</html>
`

const publicJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ASSOCHAM Careers</title>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Policy Analyst"}
    </script>
  </head>
  <body>
    <main>
      <h1>Current Openings</h1>
      <a href="https://jobs.lever.co/assocham/policy-analyst">Apply now</a>
    </main>
  </body>
</html>
`

const currentHomepageHtml = '<!doctype html><html><head><meta name="description" content="The Associated Chambers of Commerce & Industry of India (ASSOCHAM) is the country\'s oldest apex chamber."/><title>ASSOCHAM | Knowledge Architect of India</title><script defer="defer" src="/static/js/main.0ba26ba7.js"></script></head><body><div id="root"></div></body></html>'
const currentBundleText = 'const rk="https://www.assocham.org/assocham_backend",sk="hr@assocham.com";const nav=[{label:"Careers",path:"/career"}];'
const currentBundleUrl = 'https://www.assocham.org/static/js/main.0ba26ba7.js'
const currentCareersUrl = 'https://www.assocham.org/assocham_backend/career.php'

test('Assocham Tech follows the current first-party frontend to its generic careers intake', async () => {
  const assochamTech = await loadModule()
  const requested = []
  const jobs = await assochamTech.createAssochamTechScraper().run({
    fetchPage: async (url) => {
      requested.push(url)
      if (url === assochamTech.HOMEPAGE_URL) return { status: 200, url, html: currentHomepageHtml }
      if (url === currentBundleUrl) return { status: 200, url, html: currentBundleText }
      if (url === currentCareersUrl) return { status: 200, url, html: careersIntakeHtml }
      if (assochamTech.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) return { status: 404, url, html: notFoundHtml }
      throw new Error(`Unexpected current ASSOCHAM URL: ${url}`)
    },
  })

  assert.deepEqual(jobs, [])
  assert.deepEqual(requested.slice(0, 3), [assochamTech.HOMEPAGE_URL, currentBundleUrl, currentCareersUrl])
})

test('Assocham Tech rejects a current frontend bundle without the verified careers navigation', async () => {
  const assochamTech = await loadModule()
  await assert.rejects(assochamTech.createAssochamTechScraper().run({
    fetchPage: async (url) => {
      if (url === assochamTech.HOMEPAGE_URL) return { status: 200, url, html: currentHomepageHtml }
      if (url === currentBundleUrl) return { status: 200, url, html: currentBundleText.replace('path:"/career"', 'path:"/jobs"') }
      throw new Error(`Unexpected current ASSOCHAM URL: ${url}`)
    },
  }), /frontend careers navigation/i)
})

const loadModule = async () => {
  try {
    return await import('../../scraper/assochamtech/script.js')
  } catch {
    assert.fail('Expected Assocham Tech scraper module at ../../scraper/assochamtech/script.js')
  }
}

test('Assocham Tech scraper constants stay pinned to the verified ASSOCHAM intake-only careers surface from July 15, 2026', async () => {
  const assochamTech = await loadModule()

  assert.equal(assochamTech.SOURCE, 'assochamtech')
  assert.equal(assochamTech.COMPANY, 'Assocham Tech')
  assert.equal(assochamTech.OFFICIAL_BRAND_NAME, 'ASSOCHAM')
  assert.equal(assochamTech.VERIFIED_AT, '2026-10-03')
  assert.equal(assochamTech.HOMEPAGE_URL, 'https://www.assocham.org/')
  assert.equal(assochamTech.CAREERS_URL, 'https://www.assocham.org/career.php')
  assert.equal(assochamTech.CURRENT_CAREERS_URL, 'https://www.assocham.org/assocham_backend/career.php')
  assert.equal(assochamTech.APPLICATION_EMAIL, 'hr@assocham.com')
  assert.equal(assochamTech.APPLICATION_URL, 'mailto:hr@assocham.com')
  assert.deepEqual(assochamTech.NO_PUBLIC_JOB_ROUTE_URLS, [
    'https://www.assocham.org/careers',
    'https://www.assocham.org/careers/',
    'https://www.assocham.org/career',
    'https://www.assocham.org/career/',
    'https://www.assocham.org/jobs',
    'https://www.assocham.org/jobs/',
    'https://www.assocham.org/join-us',
    'https://www.assocham.org/join-us/',
    'https://www.assocham.org/work-with-us',
    'https://www.assocham.org/work-with-us/',
    'https://www.assocham.org/recruitment',
    'https://www.assocham.org/recruitment/',
  ])
  assert.match(assochamTech.VERIFIED_SURFACE_SUMMARY, /no trustworthy public jobs surface/i)
  assert.equal(assochamTech.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(
    assochamTech.extractCareersUrl(homepageHtml),
    'https://www.assocham.org/career.php',
  )
  assert.equal(assochamTech.hasGenericCareersIntakeSignal(careersIntakeHtml), true)
  assert.equal(assochamTech.pageExposesPublicJobListings(careersIntakeHtml), false)
  assert.equal(assochamTech.pageExposesPublicJobListings(publicJobsHtml), true)
  assert.equal(
    assochamTech.isVerifiedNoPublicJobRoute(
      {
        status: 404,
        url: 'https://www.assocham.org/jobs',
        html: notFoundHtml,
      },
      'https://www.assocham.org/jobs',
    ),
    true,
  )
})

test('Assocham Tech returns no jobs only while the verified careers page remains a generic intake form and common job routes stay missing', async () => {
  const assochamTech = await loadModule()
  const requestedUrls = []

  const jobs = await assochamTech.createAssochamTechScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === assochamTech.HOMEPAGE_URL) {
        return { status: 200, url, html: homepageHtml }
      }

      if (url === assochamTech.CAREERS_URL) {
        return { status: 200, url, html: careersIntakeHtml }
      }

      if (assochamTech.NO_PUBLIC_JOB_ROUTE_URLS.includes(url)) {
        return { status: 404, url, html: notFoundHtml }
      }

      throw new Error(`Unexpected Assocham Tech URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    assochamTech.HOMEPAGE_URL,
    assochamTech.CAREERS_URL,
    ...assochamTech.NO_PUBLIC_JOB_ROUTE_URLS,
  ])
  assert.deepEqual(jobs, [])
})

test('Assocham Tech fails closed when the homepage, careers intake page, or missing job routes drift into a public jobs surface', async () => {
  const assochamTech = await loadModule()

  await assert.rejects(
    assochamTech.createAssochamTechScraper().run({
      fetchPage: async (url) => {
        if (url === assochamTech.HOMEPAGE_URL) {
          return {
            status: 200,
            url,
            html: '<html><head><title>Placeholder</title></head><body>Welcome</body></html>',
          }
        }

        throw new Error(`Unexpected Assocham Tech URL: ${url}`)
      },
    }),
    /verified official homepage/i,
  )

  await assert.rejects(
    assochamTech.createAssochamTechScraper().run({
      fetchPage: async (url) => {
        if (url === assochamTech.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === assochamTech.CAREERS_URL) {
          return { status: 200, url, html: publicJobsHtml }
        }

        throw new Error(`Unexpected Assocham Tech URL: ${url}`)
      },
    }),
    /public jobs surface|generic careers intake/i,
  )

  await assert.rejects(
    assochamTech.createAssochamTechScraper().run({
      fetchPage: async (url) => {
        if (url === assochamTech.HOMEPAGE_URL) {
          return { status: 200, url, html: homepageHtml }
        }

        if (url === assochamTech.CAREERS_URL) {
          return { status: 200, url, html: careersIntakeHtml }
        }

        if (url === assochamTech.NO_PUBLIC_JOB_ROUTE_URLS[0]) {
          return { status: 200, url, html: '<html><body><h1>Jobs</h1></body></html>' }
        }

        if (assochamTech.NO_PUBLIC_JOB_ROUTE_URLS.slice(1).includes(url)) {
          return { status: 404, url, html: notFoundHtml }
        }

        throw new Error(`Unexpected Assocham Tech URL: ${url}`)
      },
    }),
    /verified no-public-job route changed/i,
  )
})
