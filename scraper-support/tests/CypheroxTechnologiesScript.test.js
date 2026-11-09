import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Tech Careers at Cypherox | Software Job Openings & Hiring</title>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "JobPosting",
            "@id": "https://www.cypherox.com/career#job-wordpress-developer-rajkot",
            "title": "WordPress Developer",
            "description": "Develop, customize, and maintain WordPress websites for various clients.",
            "employmentType": "FULL_TIME",
            "hiringOrganization": { "@type": "Organization", "name": "Cypherox Technologies Pvt. Ltd." },
            "jobLocationType": "ONSITE",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Rajkot",
                "addressCountry": "IN"
              }
            }
          },
          {
            "@type": "JobPosting",
            "@id": "https://www.cypherox.com/career#job-bde-ahmedabad",
            "title": "Business Development Executive",
            "description": "Generate new leads through various channels and cold outreach.",
            "employmentType": "FULL_TIME",
            "hiringOrganization": { "@type": "Organization", "name": "Cypherox Technologies Pvt. Ltd." },
            "jobLocationType": "ONSITE",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Ahmedabad",
                "addressCountry": "IN"
              }
            }
          }
        ]
      }
    </script>
  </head>
  <body>
    <h1>Build a Rewarding Career with Us</h1>
    <section id="CurrentOpportunities">
      <h2>Current Opportunities</h2>
      <p>Apply Now</p>
    </section>
  </body>
</html>
`

const currentCareersPageHtml = careersPageHtml.replace(
  'Tech Careers at Cypherox | Software Job Openings & Hiring',
  'Engineering Careers | Join a Growing AI Development Team',
)

const loadModule = async () => {
  try {
    return await import('../../scraper/cypherox/script.js')
  } catch {
    assert.fail('Expected Cypherox scraper module at ../../scraper/cypherox/script.js')
  }
}

test('Cypherox helpers stay pinned to the verified first-party careers page and embedded JobPosting graph', async () => {
  const cypherox = await loadModule()

  assert.equal(cypherox.SOURCE, 'cypherox')
  assert.equal(cypherox.COMPANY, 'Cypherox Technologies')
  assert.equal(cypherox.CAREERS_URL, 'https://www.cypherox.com/career')
  assert.equal(cypherox.VERIFIED_ON, '2026-07-17')
  assert.equal(cypherox.hasOfficialCareersSignal(careersPageHtml), true)
  assert.equal(cypherox.hasOfficialCareersSignal(currentCareersPageHtml), true)
  assert.deepEqual(
    cypherox.extractJobsFromStructuredData(careersPageHtml, { scrapedAt: FIXED_SCRAPED_AT }),
    [
      {
        jobId: 'job-wordpress-developer-rajkot',
        title: 'WordPress Developer',
        company: 'Cypherox Technologies',
        department: null,
        location: 'Rajkot, India',
        city: 'Rajkot',
        country: 'India',
        sourceUrl: 'https://www.cypherox.com/career#job-wordpress-developer-rajkot',
        applyUrl: 'https://www.cypherox.com/career#job-wordpress-developer-rajkot',
        employmentType: 'FULL_TIME',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Develop, customize, and maintain WordPress websites for various clients.',
        requisitionId: 'job-wordpress-developer-rajkot',
        source: 'cypherox',
        link: 'https://www.cypherox.com/career#job-wordpress-developer-rajkot',
        scrapedAt: FIXED_SCRAPED_AT,
      },
      {
        jobId: 'job-bde-ahmedabad',
        title: 'Business Development Executive',
        company: 'Cypherox Technologies',
        department: null,
        location: 'Ahmedabad, India',
        city: 'Ahmedabad',
        country: 'India',
        sourceUrl: 'https://www.cypherox.com/career#job-bde-ahmedabad',
        applyUrl: 'https://www.cypherox.com/career#job-bde-ahmedabad',
        employmentType: 'FULL_TIME',
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: null,
        closingDate: null,
        jobDescription: 'Generate new leads through various channels and cold outreach.',
        requisitionId: 'job-bde-ahmedabad',
        source: 'cypherox',
        link: 'https://www.cypherox.com/career#job-bde-ahmedabad',
        scrapedAt: FIXED_SCRAPED_AT,
      },
    ],
  )
})

test('Cypherox run validates the verified careers page and returns structured jobs from the embedded graph', async () => {
  const cypherox = await loadModule()
  const requestedUrls = []

  const jobs = await cypherox.createCypheroxScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, cypherox.CAREERS_URL)
      return careersPageHtml
    },
  })

  assert.deepEqual(requestedUrls, [cypherox.CAREERS_URL])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].companyCareerPage, 'https://www.cypherox.com/career')
  assert.equal(jobs[0].companyDomain, 'cypherox.com')
  assert.equal(jobs[0].atsPlatform, 'official-company-careers')
  assert.equal(jobs[1].title, 'Business Development Executive')
})

test('Cypherox fails closed when the verified careers page or embedded job graph drifts materially', async () => {
  const cypherox = await loadModule()

  await assert.rejects(
    cypherox.createCypheroxScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified Cypherox careers page/i,
  )

  await assert.rejects(
    cypherox.createCypheroxScraper().run({
      fetchText: async () => careersPageHtml.replace('JobPosting', 'NotAJobPosting'),
    }),
    /verified Cypherox embedded jobs graph/i,
  )
})
