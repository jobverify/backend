import assert from 'node:assert/strict'
import test from 'node:test'

const careersLandingHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title> Career - dSPACE</title>
  </head>
  <body>
    <h1>Career</h1>
    <p>Shape the future of mobility with us.</p>
    <a href="/en/pub/home/career/jobfinder.cfm">Job Finder</a>
    <a href="/en/pub/home/career/professionals.cfm">Professionals</a>
  </body>
</html>
`

const filterSections = {
  default: {
    groups: [
      {
        id: 'country',
        label: 'Country',
        filters: [
          { id: 'land-3', name: 'Germany', value: 'term-land-3' },
          { id: 'land-9', name: 'India', value: 'term-land-9' },
        ],
      },
      {
        id: 'location',
        label: 'Location',
        filters: [
          { id: 'ort-1', name: 'Paderborn', value: 'term-ort-1' },
          { id: 'ort-1031', name: 'Trivandrum', value: 'term-ort-1031' },
        ],
      },
      {
        id: 'employment_type',
        label: 'Type of employment',
        filters: [
          { id: 'art-1', name: 'Permanent employment', value: 'term-art-1' },
        ],
      },
      {
        id: 'trade',
        label: 'Professional field',
        filters: [
          {
            id: 'feld-1',
            name: 'Software development; Customer Support',
            value: 'term-feld-1',
          },
          {
            id: 'feld-1026',
            name: 'Corporate IT',
            value: 'term-feld-1026',
          },
        ],
      },
    ],
    title: '',
  },
}

const resultsData = [
  {
    filterterms: ['term-art-1', 'term-feld-1', 'term-land-9', 'term-ort-1031'],
    href: '/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
    popularity: 0,
    timestamp: '0',
    location: 'Trivandrum',
    code: 'INST-SD-MOC',
    title: 'Software Developer (f/m/d)',
    description: 'INST-SD-MOC, Trivandrum',
  },
  {
    filterterms: ['term-art-1', 'term-feld-1026', 'term-land-9', 'term-ort-1031'],
    href: '/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38139&t=IT%20Administrator%20%28f%2Fm%2Fd%29',
    popularity: 0,
    timestamp: '0',
    location: 'Trivandrum',
    code: 'INST-ITA-ITM',
    title: 'IT Administrator (f/m/d)',
    description: 'INST-ITA-ITM, Trivandrum',
  },
  {
    filterterms: ['term-art-1', 'term-feld-1026', 'term-land-3', 'term-ort-1'],
    href: '/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38150&t=Inhouse%20Consultant%20%28m%2Fw%2Fd%29',
    popularity: 0,
    timestamp: '0',
    location: 'Paderborn',
    code: 'IT-EBS-ICFO',
    title: 'Inhouse Consultant (m/w/d)',
    description: 'IT-EBS-ICFO, Paderborn',
  },
]

const currentPositionsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title> Current Positions - dSPACE</title>
    <link rel="canonical" href="https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm" />
  </head>
  <body>
    <ul class="breadcrumb__links">
      <li><a href="../../home/career.cfm">Career</a></li>
      <li><a href="../../home/career/jobfinder.cfm">Job Finder</a></li>
      <li><a href="stellen.cfm">Current Positions</a></li>
    </ul>
    <default-filter
      :filter-sections='${JSON.stringify(filterSections)}'
      :results-data='${JSON.stringify(resultsData)}'
    ></default-filter>
  </body>
</html>
`

const buildDetailHtml = ({
  title,
  code,
  location = 'Trivandrum',
  datePosted = '2026-07-13T07:48',
  email = 'career.tvm@dspace.in',
  description = `
    <p>For our office in Trivandrum, dSPACE is looking for creative and motivated professionals.</p>
    <p>You develop and enhance software components within an experienced Agile team.</p>
    <p>You have a B.Tech/M.Tech university degree in Computer Science or Electronics and Communication, with a minimum of 3 years of professional experience.</p>
    <p>You are familiar with MATLAB, Simulink, Stateflow, and AUTOSAR.</p>
  `,
}) => {
  const jobPosting = {
    '@context': 'https://schema.org/',
    '@type': 'JobPosting',
    title,
    description: `${description}
      <p>If you are ready to join our highly successful international team and take on the challenge of creating yet another success story in India &ndash; send us your application at <a href="mailto:${email}">${email}</a> indicating your earliest possible entry date.</p>`,
    datePosted,
    employmentType: 'FULL_TIME',
    identifier: {
      '@type': 'PropertyValue',
      name: 'dSPACE',
      value: code,
    },
    jobLocation: {
      '@type': 'Place',
      address: {
        '@type': 'PostalAddress',
        addressLocality: location,
        addressCountry: 'India',
      },
    },
  }

  return `
<!doctype html>
<html lang="en">
  <head>
    <title>${title} - dSPACE</title>
    <script type="application/ld+json">${JSON.stringify(jobPosting)}</script>
  </head>
  <body>
    <a href="../../home/career/jobfinder.cfm">Job Finder</a>
    <h2 id="titel">${title}</h2>
    <table>
      <tr>
        <td>
          <nobr>Code: ${code}</nobr><br>
          <nobr>Location: ${location}</nobr>
        </td>
      </tr>
    </table>
    <div class="rte">
      ${description}
      <p>If you are ready to join our highly successful international team and take on the challenge of creating yet another success story in India &ndash; send us your application at <a href="mailto:${email}">${email}</a> indicating your earliest possible entry date.</p>
    </div>
  </body>
</html>
`
}

const softwareDeveloperDetailHtml = buildDetailHtml({
  title: 'Software Developer (f/m/d)',
  code: 'INST-SD-MOC',
})

const itAdministratorDetailHtml = buildDetailHtml({
  title: 'IT Administrator (f/m/d)',
  code: 'INST-ITA-ITM',
  description: `
    <p>For our office in Trivandrum, dSPACE is looking for creative and motivated professionals.</p>
    <p>You administer Linux infrastructure and support internal development teams.</p>
    <p>You have at least 5 years of professional experience in IT administration.</p>
  `,
})

const loadDSpaceIndiaModule = async () => {
  try {
    return await import('../../scraper/dspaceindia/script.js')
  } catch {
    assert.fail('Expected dSpace India scraper module at ../../scraper/dspaceindia/script.js')
  }
}

test('dSpace India scraper helpers stay pinned to the verified first-party careers, India filter, and first-party JobPosting detail contract', async () => {
  const dspaceIndia = await loadDSpaceIndiaModule()

  assert.equal(dspaceIndia.SOURCE, 'dspaceindia')
  assert.equal(dspaceIndia.COMPANY, 'dSpace India')
  assert.equal(dspaceIndia.CAREERS_LANDING_URL, 'https://www.dspace.com/en/pub/home/career.cfm')
  assert.equal(dspaceIndia.CURRENT_POSITIONS_URL, 'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm')
  assert.equal(dspaceIndia.JOB_FINDER_ENTRY_URL, 'https://www.dspace.com/en/pub/home/career/jobfinder.cfm')
  assert.equal(dspaceIndia.INDIA_COUNTRY_FILTER_TERM, 'term-land-9')
  assert.equal(dspaceIndia.INDIA_LOCATION_FILTER_TERM, 'term-ort-1031')
  assert.equal(dspaceIndia.APPLICATION_EMAIL, 'career.tvm@dspace.in')
  assert.equal(
    dspaceIndia.buildAbsoluteUrl('/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29'),
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
  )
  assert.equal(dspaceIndia.hasOfficialCareersLandingSignal(careersLandingHtml), true)
  assert.equal(dspaceIndia.hasVerifiedCurrentPositionsSignal(currentPositionsHtml), true)

  const jobs = dspaceIndia.extractIndiaJobsFromListingHtml(currentPositionsHtml, {
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      country: job.country,
      sourceUrl: job.sourceUrl,
      jobId: job.jobId,
      requisitionId: job.requisitionId,
      department: job.department,
    })),
    [
      {
        title: 'Software Developer (f/m/d)',
        location: 'Trivandrum, India',
        city: 'Trivandrum',
        country: 'India',
        sourceUrl:
          'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
        jobId: '38151',
        requisitionId: 'INST-SD-MOC',
        department: 'Software development; Customer Support',
      },
      {
        title: 'IT Administrator (f/m/d)',
        location: 'Trivandrum, India',
        city: 'Trivandrum',
        country: 'India',
        sourceUrl:
          'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38139&t=IT%20Administrator%20%28f%2Fm%2Fd%29',
        jobId: '38139',
        requisitionId: 'INST-ITA-ITM',
        department: 'Corporate IT',
      },
    ],
  )

  const enriched = dspaceIndia.extractJobDetail(softwareDeveloperDetailHtml, jobs[0], {
    scrapedAt: '2026-07-15T00:00:00.000Z',
  })

  assert.equal(
    enriched.link,
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
  )
  assert.equal(
    enriched.applyUrl,
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
  )
  assert.equal(enriched.sourceUrl, jobs[0].sourceUrl)
  assert.equal(enriched.applicationEmail, 'career.tvm@dspace.in')
  assert.equal(enriched.employmentType, 'FULL_TIME')
  assert.equal(enriched.postingDate, '2026-07-13T07:48')
  assert.equal(enriched.experienceRequired, '3 years')
  assert.match(enriched.jobDescription, /MATLAB, Simulink, Stateflow, and AUTOSAR/i)
})

test('dSpace India run verifies the official careers pages, filters to India, and enriches first-party detail pages', async () => {
  const dspaceIndia = await loadDSpaceIndiaModule()
  const requested = []

  const jobs = await dspaceIndia.createDSpaceIndiaScraper().run({
    fetchText: async (url) => {
      requested.push(url)

      if (url === dspaceIndia.CAREERS_LANDING_URL) return careersLandingHtml
      if (url === dspaceIndia.CURRENT_POSITIONS_URL) return currentPositionsHtml
      if (url.includes('jid=38151')) return softwareDeveloperDetailHtml
      if (url.includes('jid=38139')) return itAdministratorDetailHtml

      throw new Error(`Unexpected dSpace India fixture URL: ${url}`)
    },
    now: () => '2026-07-15T00:00:00.000Z',
  })

  assert.deepEqual(requested, [
    'https://www.dspace.com/en/pub/home/career.cfm',
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm',
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38139&t=IT%20Administrator%20%28f%2Fm%2Fd%29',
  ])

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'dspaceindia')
  assert.equal(jobs[0].company, 'dSpace India')
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].sourceUrl.includes('jid=38151'), true)
  assert.equal(
    jobs[0].applyUrl,
    'https://www.dspace.com/en/pub/home/career/jobfinder/stellen.cfm?fuseaction=einzel&jid=38151&t=Software%20Developer%20%28f%2Fm%2Fd%29',
  )
  assert.equal(jobs[0].applicationEmail, 'career.tvm@dspace.in')
  assert.equal(jobs[0].scrapedAt, '2026-07-15T00:00:00.000Z')
})

test('dSpace India fails closed when the verified careers landing page, India filter, or JobPosting detail contract drifts', async () => {
  const dspaceIndia = await loadDSpaceIndiaModule()

  await assert.rejects(
    dspaceIndia.createDSpaceIndiaScraper().run({
      fetchText: async (url) => {
        if (url === dspaceIndia.CAREERS_LANDING_URL) {
          return careersLandingHtml.replace('Job Finder', 'Open Positions')
        }

        throw new Error(`Unexpected dSpace India fixture URL: ${url}`)
      },
    }),
    /verified dSPACE careers landing page/i,
  )

  await assert.rejects(
    dspaceIndia.createDSpaceIndiaScraper().run({
      fetchText: async (url) => {
        if (url === dspaceIndia.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === dspaceIndia.CURRENT_POSITIONS_URL) {
          return currentPositionsHtml.replace('term-land-9', 'term-land-99')
        }

        throw new Error(`Unexpected dSpace India fixture URL: ${url}`)
      },
    }),
    /India filter/i,
  )

  await assert.rejects(
    dspaceIndia.createDSpaceIndiaScraper().run({
      fetchText: async (url) => {
        if (url === dspaceIndia.CAREERS_LANDING_URL) return careersLandingHtml
        if (url === dspaceIndia.CURRENT_POSITIONS_URL) return currentPositionsHtml
        if (url.includes('jid=38151')) return softwareDeveloperDetailHtml.replace('"@type":"JobPosting"', '"@type":"Thing"')
        if (url.includes('jid=38139')) return itAdministratorDetailHtml

        throw new Error(`Unexpected dSpace India fixture URL: ${url}`)
      },
    }),
    /JobPosting/i,
  )
})
