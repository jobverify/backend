import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <html>
    <head>
      <title>Best Pregnancy/Maternity Hospital in India | Children's/Pediatric Hospital/Clinic Near Me | Cloudnine Hospitals</title>
    </head>
    <body>
      <footer>
        <a href="/career" class="ns-footer-link dark">Career</a>
      </footer>
    </body>
  </html>
`

const careersHtml = `
  <html>
    <head>
      <title>Career - Join our Team | Cloudnine Hospitals</title>
      <meta
        name="description"
        content="A tremendous job opportunity in India awaits you at Cloudnine Hospitals. Send your resume at hr@cloudninecare.com or Call us @ 99728 99728"
      />
    </head>
    <body>
      <h1>Join Our Team</h1>
      <p>Best Maternity hospital in India.</p>
      <p>Contact us at info@cloudninecare.com.</p>
      <a href="https://www.linkedin.com/company/cloudninehospitals/">Linkedin</a>
    </body>
  </html>
`

const loadCloudnineModule = async () => {
  try {
    return await import('../../scraper/cloudnine/script.js')
  } catch {
    assert.fail('Expected Cloudnine scraper module at ../../scraper/cloudnine/script.js')
  }
}

test('Cloudnine sentinels recognize the verified homepage handoff and resume-only careers page', async () => {
  const cloudnine = await loadCloudnineModule()

  assert.equal(cloudnine.SOURCE, 'cloudnine')
  assert.equal(cloudnine.COMPANY, 'Cloudnine')
  assert.equal(cloudnine.HOMEPAGE_URL, 'https://www.cloudninecare.com/')
  assert.equal(cloudnine.CAREERS_URL, 'https://www.cloudninecare.com/career')
  assert.equal(cloudnine.hasVerifiedHomepageCareerLink(homepageHtml), true)
  assert.equal(cloudnine.hasVerifiedCareersPageSignal(careersHtml), true)
  assert.equal(cloudnine.extractResumeEmail(careersHtml), 'hr@cloudninecare.com')
  assert.deepEqual(cloudnine.extractKnownEmails(careersHtml), [
    'hr@cloudninecare.com',
    'info@cloudninecare.com',
  ])
  assert.equal(cloudnine.hasUnexpectedPublicJobsSignal(careersHtml), false)
})

test('Cloudnine returns no jobs while the verified first-party resume handoff remains unchanged', async () => {
  const cloudnine = await loadCloudnineModule()
  const requestedUrls = []

  const jobs = await cloudnine.createCloudnineScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === cloudnine.HOMEPAGE_URL) return homepageHtml
      if (url === cloudnine.CAREERS_URL) return careersHtml

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    cloudnine.HOMEPAGE_URL,
    cloudnine.CAREERS_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Cloudnine fails closed when the homepage handoff, resume email, or public jobs surface changes', async () => {
  const cloudnine = await loadCloudnineModule()

  await assert.rejects(
    cloudnine.createCloudnineScraper().run({
      fetchText: async (url) => {
        if (url === cloudnine.HOMEPAGE_URL) {
          return homepageHtml.replace('href="/career"', 'href="/contact"')
        }

        return careersHtml
      },
    }),
    /official homepage no longer links to the known career route/i,
  )

  await assert.rejects(
    cloudnine.createCloudnineScraper().run({
      fetchText: async (url) => {
        if (url === cloudnine.HOMEPAGE_URL) return homepageHtml
        return '<html><body><h1>Unexpected</h1></body></html>'
      },
    }),
    /resume-only careers page no longer matches the known public surface/i,
  )

  await assert.rejects(
    cloudnine.createCloudnineScraper().run({
      fetchText: async (url) => {
        if (url === cloudnine.HOMEPAGE_URL) return homepageHtml
        return careersHtml.replace('hr@cloudninecare.com', 'jobs@cloudninecare.com')
      },
    }),
    /verified careers resume email changed/i,
  )

  await assert.rejects(
    cloudnine.createCloudnineScraper().run({
      fetchText: async (url) => {
        if (url === cloudnine.HOMEPAGE_URL) return homepageHtml
        return `${careersHtml}<a href="https://jobs.lever.co/cloudnine/software-engineer">Apply Now</a>`
      },
    }),
    /now exposes public jobs/i,
  )
})
