import assert from 'node:assert/strict'
import test from 'node:test'

const officialHomepageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Home - NextLabs</title>
  </head>
  <body>
    <nav>
      <a href="/company/about-nextlabs/">About NextLabs</a>
      <a href="/team/career/">Career</a>
      <a href="/team/career/">Join Us</a>
    </nav>
    <footer>Copyright © 2026 NextLabs, Inc. All rights reserved.</footer>
  </body>
</html>
`

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career - NextLabs</title>
  </head>
  <body>
    <main>
      <h1>Career Openings</h1>
      <p>Let’s build something great together</p>
      <h2>United States</h2>
      <ul>
        <li><a href="https://www.nextlabs.com/job-description/jd-india-platform-engineer/">Platform Engineer</a></li>
        <li><a href="https://www.nextlabs.com/job-description/jd-apac-software-engineer-java-2/">Software Engineer (Java)</a></li>
        <li><a href="https://www.nextlabs.com/job-description/jd-apac-software-engineer-java-2/">Software Engineer (Java)</a></li>
        <li><a href="https://external.example/jobs/123">External jobs</a></li>
      </ul>
      <h2>Malaysia</h2>
      <ul>
        <li><a href="/job-description/jd-malaysia-consulting-architect/">Consulting Architect</a></li>
      </ul>
      <section>
        <h2>Join the NextLabs team</h2>
        <form>
          <input type="file" name="resume-upload" />
        </form>
      </section>
    </main>
  </body>
</html>
`

const indiaJobDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>JD: INDIA - Platform Engineer - NextLabs</title>
  </head>
  <body>
    <main>
      <h1>Platform Engineer</h1>
      <p>India Career Openings</p>
      <a href="/company/about-nextlabs/">About NextLabs</a>
      <p>Engineering</p>
      <p>Location: Bengaluru, India</p>
      <p>Build internal platform services for customers in India.</p>
      <p>Improve platform reliability and deployment safety.</p>
      <p>Interested candidates may send resume to jobs@nextlabs.com or use our online form below.</p>
      <h2>Join the NextLabs team</h2>
    </main>
  </body>
</html>
`

const nonIndiaJobDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>JD: APAC - Software Engineer (Java) - NextLabs</title>
  </head>
  <body>
    <main>
      <h1>Software Engineer (Java)</h1>
      <p>APAC Career Openings</p>
      <a href="/company/about-nextlabs/">About NextLabs</a>
      <p>Professional Services</p>
      <p>Location: Malaysia, Singapore</p>
      <p>Build and maintain NextLabs enterprise products.</p>
      <p>Interested candidates may send resume to jobs.my@nextlabs.com or use our online form below.</p>
      <h2>Join the NextLabs team</h2>
    </main>
  </body>
</html>
`

const malaysiaJobDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>JD: APAC - Consulting Architect - NextLabs</title>
  </head>
  <body>
    <main>
      <h1>Consulting Architect</h1>
      <p>APAC Career Openings</p>
      <a href="/company/about-nextlabs/">About NextLabs</a>
      <p>Professional Services</p>
      <p>Location: Kuala Lumpur, Malaysia</p>
      <p>Lead customer-facing architecture programs.</p>
      <p>Interested candidates may send resume to jobs.my@nextlabs.com or use our online form below.</p>
      <h2>Join the NextLabs team</h2>
    </main>
  </body>
</html>
`

test('NextLabs helpers validate the official homepage, careers shell, detail pages, and unique same-domain job links', async () => {
  const nextLabs = await import('./script.js')

  assert.equal(nextLabs.SOURCE, 'nextlabs')
  assert.equal(nextLabs.COMPANY, 'NextLabs')
  assert.equal(nextLabs.HOMEPAGE_URL, 'https://www.nextlabs.com/')
  assert.equal(nextLabs.CAREERS_URL, 'https://www.nextlabs.com/team/career/')
  assert.equal(nextLabs.hasOfficialHomepageSignal(officialHomepageHtml), true)
  assert.equal(nextLabs.hasOfficialHomepageSignal('<html><title>Placeholder</title></html>'), false)
  assert.equal(nextLabs.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(nextLabs.hasOfficialCareersSignal('<html><body><h1>Careers</h1></body></html>'), false)
  assert.equal(nextLabs.hasOfficialJobDetailSignal(indiaJobDetailHtml), true)
  assert.equal(nextLabs.hasOfficialJobDetailSignal('<html><body><h1>Placeholder</h1></body></html>'), false)

  assert.deepEqual(nextLabs.extractJobDetailUrls(officialCareersHtml), [
    'https://www.nextlabs.com/job-description/jd-india-platform-engineer/',
    'https://www.nextlabs.com/job-description/jd-apac-software-engineer-java-2/',
    'https://www.nextlabs.com/job-description/jd-malaysia-consulting-architect/',
  ])

  assert.deepEqual(
    nextLabs.extractJobDetail(indiaJobDetailHtml, 'https://www.nextlabs.com/job-description/jd-india-platform-engineer/'),
    {
      title: 'Platform Engineer',
      department: 'Engineering',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      sourceUrl: 'https://www.nextlabs.com/job-description/jd-india-platform-engineer/',
      applyUrl: 'https://www.nextlabs.com/job-description/jd-india-platform-engineer/',
      jobDescription: 'Build internal platform services for customers in India. Improve platform reliability and deployment safety.',
    },
  )
})

test('NextLabs run validates the official surfaces, fetches unique detail pages, and keeps only India jobs', async () => {
  const nextLabs = await import('./script.js')
  const requestedUrls = []

  const jobs = await nextLabs.createNextLabsScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === nextLabs.HOMEPAGE_URL) return officialHomepageHtml
      if (url === nextLabs.CAREERS_URL) return officialCareersHtml
      if (url === 'https://www.nextlabs.com/job-description/jd-india-platform-engineer/') {
        return indiaJobDetailHtml
      }
      if (url === 'https://www.nextlabs.com/job-description/jd-apac-software-engineer-java-2/') {
        return nonIndiaJobDetailHtml
      }
      if (url === 'https://www.nextlabs.com/job-description/jd-malaysia-consulting-architect/') {
        return malaysiaJobDetailHtml
      }

      throw new Error(`Unexpected NextLabs URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    'https://www.nextlabs.com/',
    'https://www.nextlabs.com/team/career/',
    'https://www.nextlabs.com/job-description/jd-india-platform-engineer/',
    'https://www.nextlabs.com/job-description/jd-apac-software-engineer-java-2/',
    'https://www.nextlabs.com/job-description/jd-malaysia-consulting-architect/',
  ])

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Platform Engineer')
  assert.equal(jobs[0].company, 'NextLabs')
  assert.equal(jobs[0].source, 'nextlabs')
  assert.equal(jobs[0].location, 'Bengaluru, India')
  assert.equal(jobs[0].city, 'Bengaluru')
  assert.equal(jobs[0].jobId, 'nextlabs-jd-india-platform-engineer')
  assert.equal(jobs[0].requisitionId, 'nextlabs-jd-india-platform-engineer')
  assert.equal(
    jobs[0].sourceUrl,
    'https://www.nextlabs.com/job-description/jd-india-platform-engineer/',
  )
  assert.equal(jobs[0].applyUrl, jobs[0].sourceUrl)
  assert.equal(jobs[0].link, jobs[0].sourceUrl)
  assert.equal(jobs[0].department, 'Engineering')
  assert.equal(jobs[0].employmentType, null)
  assert.equal(jobs[0].postingDate, null)
  assert.equal(jobs[0].closingDate, null)
  assert.deepEqual(jobs[0].requiredSkills, [])
  assert.match(jobs[0].jobDescription, /customers in India/i)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('NextLabs returns an honest zero-job result when the verified public careers surface has no India roles', async () => {
  const nextLabs = await import('./script.js')

  const jobs = await nextLabs.createNextLabsScraper().run({
    fetchText: async (url) => {
      if (url === nextLabs.HOMEPAGE_URL) return officialHomepageHtml
      if (url === nextLabs.CAREERS_URL) return officialCareersHtml
      return nonIndiaJobDetailHtml
    },
  })

  assert.deepEqual(jobs, [])
})

test('NextLabs fails closed when the official homepage, careers page, or detail surface changes', async () => {
  const nextLabs = await import('./script.js')

  await assert.rejects(
    nextLabs.createNextLabsScraper().run({
      fetchText: async (url) =>
        url === nextLabs.HOMEPAGE_URL
          ? '<html><title>Unexpected</title></html>'
          : officialCareersHtml,
    }),
    /NextLabs official homepage changed/i,
  )

  await assert.rejects(
    nextLabs.createNextLabsScraper().run({
      fetchText: async (url) => {
        if (url === nextLabs.HOMEPAGE_URL) return officialHomepageHtml
        return '<html><body><h1>Careers</h1></body></html>'
      },
    }),
    /NextLabs official careers surface changed/i,
  )

  await assert.rejects(
    nextLabs.createNextLabsScraper().run({
      fetchText: async (url) => {
        if (url === nextLabs.HOMEPAGE_URL) return officialHomepageHtml
        if (url === nextLabs.CAREERS_URL) {
          return `
            <html>
              <head><title>Career - NextLabs</title></head>
              <body>
                <h1>Career Openings</h1>
                <p>Let’s build something great together</p>
                <h2>Join the NextLabs team</h2>
              </body>
            </html>
          `
        }
        return indiaJobDetailHtml
      },
    }),
    /NextLabs official careers surface changed/i,
  )

  await assert.rejects(
    nextLabs.createNextLabsScraper().run({
      fetchText: async (url) => {
        if (url === nextLabs.HOMEPAGE_URL) return officialHomepageHtml
        if (url === nextLabs.CAREERS_URL) return officialCareersHtml
        return '<html><body><h1>Platform Engineer</h1></body></html>'
      },
    }),
    /NextLabs official job detail surface changed/i,
  )
})
