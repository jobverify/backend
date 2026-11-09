import assert from 'node:assert/strict'
import test from 'node:test'
import { readInventoryEvidence } from '../utils/inventoryEvidence.js'

const loadTsworksModule = async () => {
  try {
    return await import('../../scraper/tsworks/script.js')
  } catch {
    assert.fail('Expected TSWorks scraper module at ../../scraper/tsworks/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Join Our Team</h1>
      <p>Be a part of the team that will drive India's hardware innovation.</p>
      <h2>Current Openings</h2>
      <a href="https://tworks.telangana.gov.in/openings">APPLICATIONS OPEN</a>
      <a href="https://tworks.telangana.gov.in/talent-pool">Join Talent Pool</a>
    </main>
  </body>
</html>
`

const openingsPageHtml = `
<!doctype html>
<html lang="en">
  <body>
    <main>
      <h1>Job openings</h1>
      <p>T-Works is a Government of Telangana initiative to foster product innovation.</p>
      <h2>Electronics Engineer</h2>
      <a href="https://tworks.telangana.gov.in/s/JD-Electronics-Engineer-1.pdf">
        Electronics Engineer - Job Description
      </a>
      <h2>R&amp;D Project Engineer</h2>
      <a href="/s/JD+-+R%26D+Project+Engineer+%281%29.pdf">
        R&amp;D Project Engineer - Job Description
      </a>
      <h2>Branding &amp; Communications Manager</h2>
      <a href="https://tworks.telangana.gov.in/s/Branding-Communications-Manager-3.pdf">
        Branding &amp; Communications Manager - Job Description
      </a>
      <section>
        <h2>Application Form</h2>
        <p>Fill in the form below to apply for your preferred opportunity at T-Works.</p>
      </section>
    </main>
  </body>
</html>
`

const closedCareersHtml = `<html><head><title>Careers | T-Works</title></head><body><h1>Join Our Team</h1><p>And drive India's hardware innovation!</p><h2>Current Openings</h2><div data-current-context="&quot;title&quot;: &quot;Current Openings&quot;, &quot;buttonText&quot;: &quot;APPLICATIONS CLOSED&quot;, &quot;buttonLink&quot;: &quot;&quot;"></div><div data-current-context="&quot;title&quot;: &quot;Internships&quot;, &quot;buttonText&quot;: &quot;APPLICATIONS CLOSED&quot;, &quot;buttonLink&quot;: &quot;&quot;"></div></body></html>`

test('T-Works records verified empty inventory when openings and internships are both closed', async () => {
  const tsworks = await loadTsworksModule()
  assert.equal(tsworks.hasVerifiedClosedCareersSignal(closedCareersHtml), true)
  const jobs = await tsworks.createTsworksScraper().run({
    fetchText: async url => { assert.equal(url, tsworks.CAREERS_URL); return closedCareersHtml },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs)?.status, 'verified-empty')
  assert.equal(tsworks.hasVerifiedClosedCareersSignal(closedCareersHtml.replace('APPLICATIONS CLOSED', 'APPLICATIONS OPEN')), false)
})

test('TSWorks scraper validates the official careers handoff and extracts public job-description PDFs from the openings page', async () => {
  const tsworks = await loadTsworksModule()

  assert.equal(tsworks.SOURCE, 'tsworks')
  assert.equal(tsworks.COMPANY, 'T-Works')
  assert.equal(tsworks.CAREERS_URL, 'https://tworks.telangana.gov.in/careers')
  assert.equal(tsworks.OPENINGS_URL, 'https://tworks.telangana.gov.in/openings')
  assert.equal(tsworks.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(
    tsworks.extractOpeningsUrl(careersPageHtml),
    'https://tworks.telangana.gov.in/openings',
  )
  assert.equal(tsworks.hasOfficialOpeningsSignal(openingsPageHtml), true)
  assert.deepEqual(tsworks.extractPublicOpenings(openingsPageHtml), [
    {
      title: 'Electronics Engineer',
      company: 'T-Works',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'tsworks-electronics-engineer',
      requisitionId: 'tsworks-electronics-engineer',
      sourceUrl: 'https://tworks.telangana.gov.in/s/JD-Electronics-Engineer-1.pdf',
      applyUrl: 'https://tworks.telangana.gov.in/openings',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official T-Works job description PDF for Electronics Engineer. Review the first-party PDF and apply through the official T-Works openings form.',
    },
    {
      title: 'R&D Project Engineer',
      company: 'T-Works',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'tsworks-r-d-project-engineer',
      requisitionId: 'tsworks-r-d-project-engineer',
      sourceUrl: 'https://tworks.telangana.gov.in/s/JD+-+R%26D+Project+Engineer+%281%29.pdf',
      applyUrl: 'https://tworks.telangana.gov.in/openings',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official T-Works job description PDF for R&D Project Engineer. Review the first-party PDF and apply through the official T-Works openings form.',
    },
    {
      title: 'Branding & Communications Manager',
      company: 'T-Works',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'tsworks-branding-communications-manager',
      requisitionId: 'tsworks-branding-communications-manager',
      sourceUrl: 'https://tworks.telangana.gov.in/s/Branding-Communications-Manager-3.pdf',
      applyUrl: 'https://tworks.telangana.gov.in/openings',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official T-Works job description PDF for Branding & Communications Manager. Review the first-party PDF and apply through the official T-Works openings form.',
    },
  ])
})

test('TSWorks run fetches the official careers and openings pages and decorates extracted jobs', async () => {
  const tsworks = await loadTsworksModule()
  const requestedUrls = []

  const jobs = await tsworks.createTsworksScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === tsworks.CAREERS_URL) return careersPageHtml
      if (url === tsworks.OPENINGS_URL) return openingsPageHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-10T08:30:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    tsworks.CAREERS_URL,
    tsworks.OPENINGS_URL,
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'tsworks')
  assert.equal(jobs[0].link, tsworks.OPENINGS_URL)
  assert.equal(jobs[0].scrapedAt, '2026-07-10T08:30:00.000Z')
})

test('TSWorks fails closed when the verified careers handoff or the public PDF openings surface changes', async () => {
  const tsworks = await loadTsworksModule()

  await assert.rejects(
    tsworks.createTsworksScraper().run({
      fetchText: async (url) => {
        if (url === tsworks.CAREERS_URL) {
          return careersPageHtml.replace(
            'https://tworks.telangana.gov.in/openings',
            'https://tworks.telangana.gov.in/jobs',
          )
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /verified official careers surface/i,
  )

  await assert.rejects(
    tsworks.createTsworksScraper().run({
      fetchText: async (url) => {
        if (url === tsworks.CAREERS_URL) return careersPageHtml
        if (url === tsworks.OPENINGS_URL) {
          return `
            <html>
              <body>
                <main>
                  <h1>Job openings</h1>
                  <p>T-Works is a Government of Telangana initiative.</p>
                  <p>Job Description</p>
                  <section>
                    <h2>Application Form</h2>
                  </section>
                </main>
              </body>
            </html>
          `
        }

        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /public pdf job links/i,
  )
})
