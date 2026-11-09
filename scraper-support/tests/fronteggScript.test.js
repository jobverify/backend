import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Frontegg</title>
  </head>
  <body>
    <main>
      <h1>Careers at Frontegg</h1>
      <a href="#openings">See current openings</a>
      <section id="openings">
        <h2>Current openings</h2>
        <p>Israel</p>
        <ul>
          <li>
            <a href="https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all">
              Senior Backend Developer
              <span>R&amp;D</span>
              <span>Full-time</span>
              <span>Apply now</span>
            </a>
          </li>
          <li>
            <a href="/careers/co/israel/TS.22A/technical-support-tier-2-support/all">
              Technical Support - Tier 2 Support
              <span>Apply now</span>
            </a>
          </li>
        </ul>
      </section>
    </main>
  </body>
</html>
`

test('Frontegg recognizes its current SEO title while retaining the verified careers body checks', async () => {
  const { hasOfficialCareersPageSignal } = await import('../../scraper/frontegg/script.js')
  const current = careersHtml.replace('<title>Careers at Frontegg</title>',
    '<title>Careers at Frontegg | Open Roles in Identity &amp; AI Security</title>')
  assert.equal(hasOfficialCareersPageSignal(current), true)
  assert.equal(hasOfficialCareersPageSignal(current.replace(/Current openings/gi, 'Unrelated content')), false)
  assert.equal(hasOfficialCareersPageSignal(current.replaceAll('Frontegg', 'Other company')), false)
})

const seniorBackendDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job opportunity: Senior Backend Developer</title>
  </head>
  <body>
    <main>
      <a href="https://frontegg.com/careers">← All Jobs</a>
      <h2>Senior Backend Developer</h2>
      <p>Israel</p>
      <h4>About The Position</h4>
      <p>Are you a hands-on developer who loves writing code and solving complex technical challenges?</p>
      <p>At Frontegg, you’re not just joining a company; you’re becoming part of a team that values innovation and collaboration.</p>
      <h4>What You'll Do:</h4>
      <ul>
        <li>Take full ownership of end-to-end development of key features in identity and access management.</li>
        <li>Build and optimize services using NestJS (Node.js), TypeScript, and AWS.</li>
      </ul>
      <h4>Who You Are:</h4>
      <ul>
        <li>A highly skilled Backend Developer with 6+ years of experience.</li>
        <li>Hands-on with authentication, security, and identity management.</li>
      </ul>
      <h4>Apply for this position</h4>
    </main>
  </body>
</html>
`

const supportDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job opportunity: Technical Support - Tier 2 Support</title>
  </head>
  <body>
    <main>
      <a href="https://frontegg.com/careers">← All Jobs</a>
      <h2>Technical Support - Tier 2 Support</h2>
      <p>Israel</p>
      <h4>About The Position</h4>
      <p>Support Frontegg customers and internal teams by resolving product and integration issues.</p>
      <h4>Apply for this position</h4>
    </main>
  </body>
</html>
`

const brokenCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Frontegg</title>
  </head>
  <body>
    <main>
      <h1>Frontegg</h1>
    </main>
  </body>
</html>
`

const loadFronteggModule = async () => {
  try {
    return await import('../../scraper/frontegg/script.js')
  } catch {
    assert.fail('Expected Frontegg scraper module at ../../scraper/frontegg/script.js')
  }
}

test('Frontegg helpers stay pinned to the verified first-party careers page and job detail structure', async () => {
  const frontegg = await loadFronteggModule()

  assert.equal(frontegg.SOURCE, 'frontegg')
  assert.equal(frontegg.COMPANY, 'Frontegg')
  assert.equal(frontegg.OFFICIAL_BRAND_NAME, 'Frontegg')
  assert.equal(frontegg.VERIFIED_ON, '2026-07-15')
  assert.equal(frontegg.HOMEPAGE_URL, 'https://frontegg.com/')
  assert.equal(frontegg.CAREERS_URL, 'https://frontegg.com/careers')
  assert.equal(
    frontegg.VERIFIED_JOB_DETAIL_URL,
    'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all',
  )
  assert.match(frontegg.VERIFIED_SURFACE_SUMMARY, /Current openings/i)
  assert.equal(frontegg.hasOfficialCareersPageSignal(careersHtml), true)
  assert.deepEqual(frontegg.extractListingLinks(careersHtml), [
    'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all',
    'https://frontegg.com/careers/co/israel/TS.22A/technical-support-tier-2-support/all',
  ])
  assert.equal(frontegg.hasOfficialJobDetailSignal(seniorBackendDetailHtml), true)
  assert.deepEqual(
    frontegg.parseJobDetail(seniorBackendDetailHtml, frontegg.VERIFIED_JOB_DETAIL_URL),
    {
      title: 'Senior Backend Developer',
      location: 'Israel',
      jobDescription: [
        'About The Position',
        'Are you a hands-on developer who loves writing code and solving complex technical challenges?',
        'At Frontegg, you’re not just joining a company; you’re becoming part of a team that values innovation and collaboration.',
        "What You'll Do:",
        '- Take full ownership of end-to-end development of key features in identity and access management.',
        '- Build and optimize services using NestJS (Node.js), TypeScript, and AWS.',
        'Who You Are:',
        '- A highly skilled Backend Developer with 6+ years of experience.',
        '- Hands-on with authentication, security, and identity management.',
      ].join('\n'),
    },
  )
})

test('Frontegg returns live first-party jobs from the verified careers page and detail pages', async () => {
  const frontegg = await loadFronteggModule()
  const requestedUrls = []

  const jobs = await frontegg.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === frontegg.CAREERS_URL) {
        return careersHtml
      }

      if (url === 'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all') {
        return seniorBackendDetailHtml
      }

      if (url === 'https://frontegg.com/careers/co/israel/TS.22A/technical-support-tier-2-support/all') {
        return supportDetailHtml
      }

      throw new Error(`Unexpected Frontegg URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    frontegg.CAREERS_URL,
    'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all',
    'https://frontegg.com/careers/co/israel/TS.22A/technical-support-tier-2-support/all',
  ])
  assert.deepEqual(jobs, [
    {
      title: 'Senior Backend Developer',
      location: 'Israel',
      country: 'Israel',
      company: 'Frontegg',
      source: 'frontegg',
      sourceUrl: 'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all',
      applyUrl: 'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all',
      companyCareerPage: 'https://frontegg.com/careers',
      companyDomain: 'frontegg.com',
      atsPlatform: 'official-company-site',
      jobId: 'DE.45E',
      department: 'R&D',
      employmentType: 'Full-time',
      jobDescription: [
        'About The Position',
        'Are you a hands-on developer who loves writing code and solving complex technical challenges?',
        'At Frontegg, you’re not just joining a company; you’re becoming part of a team that values innovation and collaboration.',
        "What You'll Do:",
        '- Take full ownership of end-to-end development of key features in identity and access management.',
        '- Build and optimize services using NestJS (Node.js), TypeScript, and AWS.',
        'Who You Are:',
        '- A highly skilled Backend Developer with 6+ years of experience.',
        '- Hands-on with authentication, security, and identity management.',
      ].join('\n'),
    },
    {
      title: 'Technical Support - Tier 2 Support',
      location: 'Israel',
      country: 'Israel',
      company: 'Frontegg',
      source: 'frontegg',
      sourceUrl: 'https://frontegg.com/careers/co/israel/TS.22A/technical-support-tier-2-support/all',
      applyUrl: 'https://frontegg.com/careers/co/israel/TS.22A/technical-support-tier-2-support/all',
      companyCareerPage: 'https://frontegg.com/careers',
      companyDomain: 'frontegg.com',
      atsPlatform: 'official-company-site',
      jobId: 'TS.22A',
      department: null,
      employmentType: null,
      jobDescription: [
        'About The Position',
        'Support Frontegg customers and internal teams by resolving product and integration issues.',
      ].join('\n'),
    },
  ])
})

test('Frontegg fails closed when the careers page or job detail surface drifts materially', async () => {
  const frontegg = await loadFronteggModule()

  await assert.rejects(
    frontegg.run({
      fetchText: async (url) => {
        if (url === frontegg.CAREERS_URL) {
          return brokenCareersHtml
        }

        throw new Error(`Unexpected Frontegg URL: ${url}`)
      },
    }),
    /careers page no longer matches/i,
  )

  await assert.rejects(
    frontegg.run({
      fetchText: async (url) => {
        if (url === frontegg.CAREERS_URL) {
          return careersHtml
        }

        if (url === 'https://frontegg.com/careers/co/israel/DE.45E/senior-backend-developer/all') {
          return '<html><body><h1>Placeholder</h1></body></html>'
        }

        if (url === 'https://frontegg.com/careers/co/israel/TS.22A/technical-support-tier-2-support/all') {
          return supportDetailHtml
        }

        throw new Error(`Unexpected Frontegg URL: ${url}`)
      },
    }),
    /job detail page no longer matches/i,
  )
})
