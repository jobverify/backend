import assert from 'node:assert/strict'
import test from 'node:test'

const loadSecureLayer7Module = async () => {
  try {
    return await import('../../scraper/securelayer7technologies/script.js')
  } catch {
    assert.fail('Expected SecureLayer7 Technologies scraper module at ../../scraper/securelayer7technologies/script.js')
  }
}

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | SecureLayer7</title>
    <meta
      name="description"
      content="Open roles for pentesters, researchers, engagement leads, and engineers at SecureLayer7. Pune + Austin offices. Hybrid + remote. Apply directly through SecHire."
    />
  </head>
  <body>
    <section id="open-positions">
      <p>Open positions</p>
      <p>Live from our hiring portal. Apply opens the role on sechire.net, resume, scheduling, references handled there.</p>
    </section>
    <script>
      self.__next_f.push([1,"8b:[\\"$\\",\\"div\\",null,{\\"className\\":\\"mt-12\\",\\"children\\":[\\"$\\",\\"$L8c\\",null,{\\"positions\\":[{\\"slug\\":\\"senior-red-team-operator-pune\\",\\"title\\":\\"Senior Red Team Operator\\",\\"department\\":\\"Security Consultant\\",\\"location\\":\\"Pune, India\\",\\"workMode\\":\\"onsite\\",\\"employmentType\\":\\"full-time\\",\\"summary\\":\\"SecureLayer7 is looking for a battle-tested Senior Red Team Operator to plan and execute sophisticated engagements.\\",\\"applyUrl\\":\\"https://sechire.net/jobs/senior-red-team-operator-pune\\"},{\\"slug\\":\\"enterprise-cybersecurity-sales\\",\\"title\\":\\"Senior Cybersecurity Sales Specialist - BFSI\\",\\"department\\":\\"General\\",\\"location\\":\\"Mumbai\\",\\"workMode\\":\\"hybrid\\",\\"employmentType\\":\\"full-time\\",\\"summary\\":\\"SecureLayer7 is expanding its BFSI cybersecurity vertical in 2026.\\",\\"applyUrl\\":\\"https://sechire.net/jobs/enterprise-cybersecurity-sales\\"},{\\"slug\\":\\"senior-sap-security-consultant\\",\\"title\\":\\"Senior SAP Security Consultant\\",\\"department\\":\\"Testing\\",\\"location\\":\\"Confidential\\",\\"workMode\\":\\"onsite\\",\\"employmentType\\":\\"full-time\\",\\"summary\\":\\"Position: Senior SAP Security Consultant Experience: 8+ Years Location: Confidential Employment Type: Full-Time.\\",\\"applyUrl\\":\\"https://sechire.net/jobs/senior-sap-security-consultant\\"}],\\"emptyStateMessage\\":\\"No openings today.\\"}]}]")
    </script>
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior Red Team Operator",
            "description": "SecureLayer7 is looking for a battle-tested Senior Red Team Operator to plan and execute sophisticated engagements.",
            "identifier": {
              "@type": "PropertyValue",
              "name": "SecureLayer7",
              "value": "senior-red-team-operator-pune"
            },
            "datePosted": "2026-08-04",
            "validThrough": "2026-10-03",
            "employmentType": "FULL_TIME",
            "url": "https://sechire.net/jobs/senior-red-team-operator-pune",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Pune",
                "addressRegion": "MH",
                "addressCountry": "IN"
              }
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior Cybersecurity Sales Specialist - BFSI",
            "description": "SecureLayer7 is expanding its BFSI cybersecurity vertical in 2026.",
            "identifier": {
              "@type": "PropertyValue",
              "name": "SecureLayer7",
              "value": "enterprise-cybersecurity-sales"
            },
            "datePosted": "2026-08-04",
            "validThrough": "2026-10-03",
            "employmentType": "FULL_TIME",
            "url": "https://sechire.net/jobs/enterprise-cybersecurity-sales",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Pune",
                "addressRegion": "MH",
                "addressCountry": "IN"
              }
            }
          },
          {
            "@context": "https://schema.org",
            "@type": "JobPosting",
            "title": "Senior SAP Security Consultant",
            "description": "Position: Senior SAP Security Consultant Experience: 8+ Years Location: Confidential Employment Type: Full-Time.",
            "identifier": {
              "@type": "PropertyValue",
              "name": "SecureLayer7",
              "value": "senior-sap-security-consultant"
            },
            "datePosted": "2026-08-04",
            "validThrough": "2026-10-03",
            "employmentType": "FULL_TIME",
            "url": "https://sechire.net/jobs/senior-sap-security-consultant",
            "jobLocation": {
              "@type": "Place",
              "address": {
                "@type": "PostalAddress",
                "addressLocality": "Austin",
                "addressRegion": "TX",
                "addressCountry": "US"
              }
            }
          }
        ]
      }
    </script>
  </body>
</html>
`

test('SecureLayer7 Technologies validates the official careers surface and extracts India jobs from embedded positions metadata', async () => {
  const securelayer7 = await loadSecureLayer7Module()

  assert.equal(securelayer7.CAREERS_URL, 'https://securelayer7.net/careers')
  assert.equal(careersHtml.includes('Roles open right now.'), false)
  assert.equal(securelayer7.hasOfficialCareersSurface(careersHtml), true)

  const jobs = securelayer7.extractOpenPositions(careersHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Senior Red Team Operator',
    company: 'SecureLayer7 Technologies Pvt. Ltd',
    department: 'Security Consultant',
    location: 'Pune, India',
    city: 'Pune',
    state: 'MH',
    country: 'India',
    jobId: 'senior-red-team-operator-pune',
    requisitionId: 'senior-red-team-operator-pune',
    sourceUrl: 'https://securelayer7.net/careers',
    applyUrl: 'https://sechire.net/jobs/senior-red-team-operator-pune',
    employmentType: 'Full-time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-08-04',
    closingDate: '2026-10-03',
    jobDescription: 'SecureLayer7 is looking for a battle-tested Senior Red Team Operator to plan and execute sophisticated engagements.',
    remoteStatus: 'On-site',
  })
  assert.deepEqual(
    jobs.map((job) => job.title),
    [
      'Senior Red Team Operator',
      'Senior Cybersecurity Sales Specialist - BFSI',
    ],
  )
  assert.equal(jobs[1].location, 'Mumbai, India')
  assert.equal(jobs[1].city, 'Mumbai')
  assert.equal(jobs[1].state, 'MH')
})

test('run fetches the SecureLayer7 careers page, excludes non-India roles, and decorates runner metadata', async () => {
  const securelayer7 = await loadSecureLayer7Module()
  const requestedUrls = []

  const jobs = await securelayer7.createSecureLayer7TechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return careersHtml
    },
  })

  assert.deepEqual(requestedUrls, ['https://securelayer7.net/careers'])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'securelayer7technologies')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.match(jobs[0].scrapedAt, /^\d{4}-\d{2}-\d{2}T/)
})
