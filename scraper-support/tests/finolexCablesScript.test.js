import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Welcome to Finolex Cables | Finolex Cables.</title>
  </head>
  <body>
    <main>
      <a href="/View/Page/Career">Careers</a>
      <section>
        <h2>About Finolex</h2>
      </section>
    </main>
  </body>
</html>
`

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Finolex Cables | Finolex Cables.</title>
  </head>
  <body>
    <main>
      <h3>TRANSFORM YOUR FUTURE</h3>
      <p>Join our diverse and talented team and enjoy a rewarding work environment that fosters creativity, collaboration, and growth.</p>
      <h3>Careers at Finolex Cables</h3>
      <table class="career-table">
        <thead>
          <tr>
            <th>JobTitle</th>
            <th>Function</th>
            <th>Education</th>
            <th>Experience</th>
            <th>Location</th>
            <th>Operations</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Polymer Compounding Engineer (Production)</td>
            <td>Production</td>
            <td>BE Or Diploma</td>
            <td>3 to 5 years</td>
            <td>Pune (urse)</td>
            <td><a href="#job-description">Details</a> <button type="button">Apply Now</button></td>
          </tr>
        </tbody>
      </table>
      <p>Drop your CV at hr@finolex.com, We will consider your Profile for future Jobs</p>
      <p>Beware of individuals representing or claiming association with Finolex Cables.</p>
      <h4>Application Form</h4>
      <form>
        <label>Full Name</label>
        <label>Mobile Number</label>
        <label>Email</label>
        <label>Current Location</label>
        <label>Upload Resume</label>
      </form>
      <h4>Job Description</h4>
      <p>System.Linq.Enumerable+WhereSelectListIterator\`2[CMSLibrary.Career,System.String]</p>
    </main>
  </body>
</html>
`

const careersWithoutJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Finolex Cables | Finolex Cables.</title>
  </head>
  <body>
    <main>
      <h3>TRANSFORM YOUR FUTURE</h3>
      <h3>Careers at Finolex Cables</h3>
      <p>Drop your CV at hr@finolex.com, We will consider your Profile for future Jobs</p>
      <h4>Application Form</h4>
      <form></form>
    </main>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/finolexcables/script.js')
  } catch {
    assert.fail('Expected Finolex Cables scraper module at ../../scraper/finolexcables/script.js')
  }
}

test('Finolex Cables helpers stay pinned to the verified first-party careers table contract', async () => {
  const finolex = await loadModule()

  assert.equal(finolex.COMPANY, 'Finolex Cables')
  assert.equal(finolex.SOURCE, 'finolexcables')
  assert.equal(finolex.HOMEPAGE_URL, 'https://www.finolex.com/')
  assert.equal(finolex.HOMEPAGE_CAREERS_URL, 'https://www.finolex.com/View/Page/Career')
  assert.equal(finolex.CAREERS_URL, 'https://www.finolex.com/Team/Career')
  assert.equal(finolex.VERIFIED_ON, '2026-07-15')
  assert.match(finolex.VERIFIED_SURFACE_SUMMARY, /Polymer Compounding Engineer/i)
  assert.equal(
    finolex.extractHomepageCareersUrl(homepageHtml),
    'https://www.finolex.com/View/Page/Career',
  )
  assert.equal(finolex.hasOfficialHomepageSignal(homepageHtml), true)
  assert.equal(finolex.hasOfficialCareersPageSignal(careersHtml), true)
  assert.equal(finolex.pageExposesPublicJobListings(careersHtml), true)
  assert.deepEqual(finolex.extractSearchResults(careersHtml), [
    {
      title: 'Polymer Compounding Engineer (Production)',
      company: 'Finolex Cables',
      department: 'Production',
      location: 'Pune (Urse), India',
      city: 'Pune',
      country: 'India',
      jobId: 'finolexcables-polymer-compounding-engineer-production',
      requisitionId: 'polymer-compounding-engineer-production',
      sourceUrl: 'https://www.finolex.com/Team/Career',
      applyUrl: 'https://www.finolex.com/Team/Career',
      employmentType: null,
      experienceRequired: '3 to 5 years',
      minimumQualification: 'BE Or Diploma',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply via the official Finolex Cables application form on the careers page.',
    },
  ])
  assert.equal(finolex.pageExposesPublicJobListings(careersWithoutJobsHtml), false)
})

test('Finolex Cables run returns the verified public opening from the first-party careers page', async () => {
  const finolex = await loadModule()
  const requestedUrls = []

  const jobs = await finolex.run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === finolex.HOMEPAGE_URL) {
        return {
          status: 200,
          url: finolex.HOMEPAGE_URL,
          html: homepageHtml,
        }
      }

      if (url === finolex.HOMEPAGE_CAREERS_URL) {
        return {
          status: 200,
          url: finolex.CAREERS_URL,
          html: careersHtml,
        }
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    finolex.HOMEPAGE_URL,
    finolex.HOMEPAGE_CAREERS_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Polymer Compounding Engineer (Production)')
  assert.equal(jobs[0].source, 'finolexcables')
  assert.equal(jobs[0].link, 'https://www.finolex.com/Team/Career')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})

test('Finolex Cables fails closed when the verified homepage handoff or careers table drifts', async () => {
  const finolex = await loadModule()

  await assert.rejects(
    finolex.run({
      fetchPage: async (url) => {
        if (url === finolex.HOMEPAGE_URL) {
          return {
            status: 200,
            url: finolex.HOMEPAGE_URL,
            html: '<html><body><a href="/contact">Contact</a></body></html>',
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /homepage changed materially|verified official homepage/i,
  )

  await assert.rejects(
    finolex.run({
      fetchPage: async (url) => {
        if (url === finolex.HOMEPAGE_URL) {
          return {
            status: 200,
            url: finolex.HOMEPAGE_URL,
            html: homepageHtml,
          }
        }

        if (url === finolex.HOMEPAGE_CAREERS_URL) {
          return {
            status: 200,
            url: finolex.CAREERS_URL,
            html: careersWithoutJobsHtml,
          }
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page changed materially|public openings/i,
  )
})
