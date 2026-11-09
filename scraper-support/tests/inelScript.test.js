import assert from 'node:assert/strict'
import test from 'node:test'

const loadINELModule = async () => {
  try {
    return await import('../../scraper/inel/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
  <html>
    <head>
      <title>India Nippon Electricals Ltd</title>
    </head>
    <body>
      <a href="https://career.indianippon.com/auth/">INEL-TALENT</a>
      <section id="career-opportunities">
        <h2>Career Opportunities</h2>
      </section>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"Organization","name":"India Nippon Electricals Limited"}
      </script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Hardware Design Engineer","description":"Join INEL as a Hardware Design Engineer at our Tech Centre, Hosur. We are looking for experienced professionals to join our dynamic team.","identifier":{"@type":"PropertyValue","name":"INEL Job ID","value":"INEL-1"},"datePosted":"2026-06-29","hiringOrganization":{"@type":"Organization","name":"India Nippon Electricals Limited","sameAs":"https://indianippon.com","logo":"https://indianippon.com/logo.svg"},"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Hosur","addressRegion":"Tamil Nadu","addressCountry":"IN"}},"employmentType":"FULL_TIME","experienceRequirements":"5+ years","qualifications":"B.E./B.Tech in Electronics","responsibilities":"Design automotive electronic components.","skills":"Hardware Design, Automotive Electronics, Problem Solving"}
      </script>
      <script type="application/ld+json">
        {"@context":"https://schema.org","@type":"JobPosting","title":"Product Development Engineer","description":"Join INEL as a Product Development Engineer at our Tech Centre, Hosur. We are looking for fresh graduates to join our dynamic team.","identifier":{"@type":"PropertyValue","name":"INEL Job ID","value":"INEL-3"},"datePosted":"2026-06-29","hiringOrganization":{"@type":"Organization","name":"India Nippon Electricals Limited","sameAs":"https://indianippon.com","logo":"https://indianippon.com/logo.svg"},"jobLocation":{"@type":"Place","address":{"@type":"PostalAddress","addressLocality":"Hosur","addressRegion":"Tamil Nadu","addressCountry":"IN"}},"employmentType":"FULL_TIME","experienceRequirements":"Freshers","qualifications":"Engineering degree in relevant field","responsibilities":"Support product development projects.","skills":"Engineering, Product Development, Problem Solving"}
      </script>
    </body>
  </html>
`

test('extractSearchResults builds jobs from INEL JobPosting structured data', async () => {
  const inel = await loadINELModule()
  assert.ok(inel)

  const jobs = inel.extractSearchResults(careerPageHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      jobId: job.jobId,
      location: job.location,
      applyUrl: job.applyUrl,
      postingDate: job.postingDate,
      experienceRequired: job.experienceRequired,
      minimumQualification: job.minimumQualification,
      requiredSkills: job.requiredSkills,
    })),
    [
      {
        title: 'Hardware Design Engineer',
        jobId: 'INEL-1',
        location: 'Hosur, Tamil Nadu, India',
        applyUrl: 'https://indianippon.com/career#career-opportunities',
        postingDate: '2026-06-29T00:00:00.000Z',
        experienceRequired: '5+ years',
        minimumQualification: 'B.E./B.Tech in Electronics',
        requiredSkills: ['Hardware Design', 'Automotive Electronics', 'Problem Solving'],
      },
      {
        title: 'Product Development Engineer',
        jobId: 'INEL-3',
        location: 'Hosur, Tamil Nadu, India',
        applyUrl: 'https://indianippon.com/career#career-opportunities',
        postingDate: '2026-06-29T00:00:00.000Z',
        experienceRequired: 'Freshers',
        minimumQualification: 'Engineering degree in relevant field',
        requiredSkills: ['Engineering', 'Product Development', 'Problem Solving'],
      },
    ],
  )
})

test('run returns INEL jobs from the public careers page', async () => {
  const inel = await loadINELModule()
  assert.ok(inel)

  const jobs = await inel.createINELScraper().run({
    fetchText: async (url) => {
      assert.equal(url, inel.CAREER_PAGE_URL)
      return careerPageHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'inel')
  assert.equal(jobs[0].link, 'https://indianippon.com/career#career-opportunities')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
