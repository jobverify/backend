import assert from 'node:assert/strict'
import test from 'node:test'

const loadAutoRABITModule = async () => {
  try {
    return await import('../../scraper/autorabit/script.js')
  } catch {
    return null
  }
}

const buildCareersHtml = () => `
<!doctype html>
<html>
  <body>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Cloud Architect",
        "description": "Lead design, security, and deployment of scalable cloud architectures.",
        "datePosted": "2026-02-02",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "AutoRABIT"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Hyderabad",
            "addressRegion": "Telangana",
            "addressCountry": "India"
          }
        },
        "url": "https://autorabit.applytojob.com/apply/ByksQiOipi/Cloud-Architect"
      }
    </script>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "JobPosting",
        "title": "Associate Customer Success Manager",
        "description": "Remote US role.",
        "datePosted": "2026-02-02",
        "hiringOrganization": {
          "@type": "Organization",
          "name": "AutoRABIT"
        },
        "jobLocation": {
          "@type": "Place",
          "address": {
            "@type": "PostalAddress",
            "addressLocality": "Atlanta",
            "addressRegion": "GA",
            "addressCountry": "United States of America"
          }
        },
        "url": "https://autorabit.applytojob.com/apply/8YmXeSxyXb/Associate-Customer-Success-Manager"
      }
    </script>
  </body>
</html>
`

const buildDetailHtml = () => `
<!doctype html>
<html>
  <body>
    <h1>Cloud Architect</h1>
    <p>Location: Hyderabad, Hybrid - 3 Days from Office</p>
    <p>Experience: 8-10 Years</p>
    <div>
      <h2>Desired Skills and Knowledge</h2>
      <ul>
        <li>8+ years of experience in cloud infrastructure and architecture.</li>
        <li>Deep understanding of AWS services and networking.</li>
      </ul>
    </div>
    <h3>Apply for this position</h3>
  </body>
</html>
`

test('extractSearchResults maps AutoRABIT JSON-LD postings and keeps only India roles', async () => {
  const autorabit = await loadAutoRABITModule()
  assert.ok(autorabit)

  const jobs = autorabit.extractSearchResults(buildCareersHtml())

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'Cloud Architect',
    company: 'AutoRABIT',
    department: null,
    location: 'Hyderabad, India',
    city: 'Hyderabad',
    country: 'India',
    jobId: 'ByksQiOipi',
    requisitionId: 'ByksQiOipi',
    sourceUrl: 'https://autorabit.applytojob.com/apply/ByksQiOipi/Cloud-Architect',
    applyUrl: 'https://autorabit.applytojob.com/apply/ByksQiOipi/Cloud-Architect',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-02-02T00:00:00.000Z',
    closingDate: null,
    jobDescription: 'Lead design, security, and deployment of scalable cloud architectures.',
    publicExperienceChecked: true,
    remoteStatus: 'On-site',
  })
})

test('run fetches the AutoRABIT careers page and decorates jobs', async () => {
  const autorabit = await loadAutoRABITModule()
  assert.ok(autorabit)

  const requestedUrls = []
  const scraper = autorabit.createAutoRABITScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === autorabit.CAREER_PAGE_URL) return buildCareersHtml()
      if (url === 'https://autorabit.applytojob.com/apply/ByksQiOipi/Cloud-Architect') return buildDetailHtml()
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(autorabit.buildSearchUrl(), autorabit.CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, [
    autorabit.CAREER_PAGE_URL,
    'https://autorabit.applytojob.com/apply/ByksQiOipi/Cloud-Architect',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'autorabit')
  assert.equal(jobs[0].link, 'https://autorabit.applytojob.com/apply/ByksQiOipi/Cloud-Architect')
  assert.equal(jobs[0].experienceRequired, '8-10 Years')
  assert.equal(jobs[0].publicExperienceChecked, true)
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
