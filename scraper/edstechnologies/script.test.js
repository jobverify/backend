import assert from 'node:assert/strict'
import test from 'node:test'

import {
  APPLICATION_EMAIL,
  CAREER_PAGE_URL,
  createEdsTechnologiesScraper,
  extractOpenings,
  pageIndicatesJobOpenings,
} from './script.js'

const careersHtml = `
  <main>
    <section>
      <h2>Job Openings</h2>
      <table>
        <thead>
          <tr>
            <th>Job Title</th>
            <th>Discipline</th>
            <th>Location</th>
            <th>Apply Now</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Business Manager - GIS</td>
            <td>Brand Sales</td>
            <td>Mumbai, Kolkata</td>
            <td>
              <a href="/wp-content/uploads/2025/06/GIS-Business-Manager.pdf">Know More</a>
            </td>
          </tr>
          <tr>
            <td>Application Engineer - SIMULIA</td>
            <td>Technical Support</td>
            <td>Pune</td>
            <td>
              <a href="https://edstechnologies.com/wp-content/uploads/2025/06/Application-Engineer-SIMULIA.pdf">Know More</a>
            </td>
          </tr>
          <tr>
            <td>Future Talent Pool</td>
            <td>General</td>
            <td>Pan India</td>
            <td>Apply Now</td>
          </tr>
        </tbody>
      </table>
    </section>
  </main>
`

test('extractOpenings parses the EDS Technologies openings table and normalizes first-party links', () => {
  assert.equal(CAREER_PAGE_URL, 'https://edstechnologies.com/careers/')
  assert.equal(APPLICATION_EMAIL, 'careers@edstechnologies.com')
  assert.equal(pageIndicatesJobOpenings(careersHtml), true)

  assert.deepEqual(extractOpenings(careersHtml), [
    {
      title: 'Business Manager - GIS',
      company: 'EDS Technologies Pvt. Ltd.',
      department: 'Brand Sales',
      location: 'Mumbai, Kolkata, India',
      city: null,
      country: 'India',
      jobId: 'edstechnologies-business-manager-gis-brand-sales-mumbai-kolkata',
      requisitionId: 'edstechnologies-business-manager-gis-brand-sales-mumbai-kolkata',
      sourceUrl: 'https://edstechnologies.com/wp-content/uploads/2025/06/GIS-Business-Manager.pdf',
      applyUrl: 'https://edstechnologies.com/wp-content/uploads/2025/06/GIS-Business-Manager.pdf',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official EDS Technologies Pvt. Ltd. opening for Business Manager - GIS in Brand Sales at Mumbai, Kolkata, India. Refer to the first-party job description PDF for role details and application instructions.',
    },
    {
      title: 'Application Engineer - SIMULIA',
      company: 'EDS Technologies Pvt. Ltd.',
      department: 'Technical Support',
      location: 'Pune, India',
      city: 'Pune',
      country: 'India',
      jobId: 'edstechnologies-application-engineer-simulia-technical-support-pune',
      requisitionId: 'edstechnologies-application-engineer-simulia-technical-support-pune',
      sourceUrl: 'https://edstechnologies.com/wp-content/uploads/2025/06/Application-Engineer-SIMULIA.pdf',
      applyUrl: 'https://edstechnologies.com/wp-content/uploads/2025/06/Application-Engineer-SIMULIA.pdf',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official EDS Technologies Pvt. Ltd. opening for Application Engineer - SIMULIA in Technical Support at Pune, India. Refer to the first-party job description PDF for role details and application instructions.',
    },
    {
      title: 'Future Talent Pool',
      company: 'EDS Technologies Pvt. Ltd.',
      department: 'General',
      location: 'Pan India',
      city: null,
      country: 'India',
      jobId: 'edstechnologies-future-talent-pool-general-pan-india',
      requisitionId: 'edstechnologies-future-talent-pool-general-pan-india',
      sourceUrl: CAREER_PAGE_URL,
      applyUrl: 'mailto:careers@edstechnologies.com',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Official EDS Technologies Pvt. Ltd. opening for Future Talent Pool in General at Pan India. Apply by emailing careers@edstechnologies.com.',
    },
  ])
})

test('run fetches the official EDS Technologies careers page and decorates jobs for persistence', async () => {
  const requestedUrls = []
  const jobs = await createEdsTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, [CAREER_PAGE_URL])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'edstechnologies')
  assert.equal(jobs[0].link, 'https://edstechnologies.com/wp-content/uploads/2025/06/GIS-Business-Manager.pdf')
  assert.equal(jobs[2].link, 'mailto:careers@edstechnologies.com')
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})

test('extractOpenings rejects an unexpected EDS Technologies careers page shape', () => {
  assert.equal(pageIndicatesJobOpenings('<main><h1>Careers</h1></main>'), false)
  assert.throws(
    () => extractOpenings('<main><h1>Careers</h1></main>'),
    /expected openings table/,
  )
})
