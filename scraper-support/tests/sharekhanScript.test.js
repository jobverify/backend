import assert from 'node:assert/strict'
import test from 'node:test'

const CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Explore Career Opportunities at Mirae Asset Sharekhan </title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Grow with us</h2>
      <table>
        <tbody>
          <tr>
            <td style="text-align:left">Senior Manager - Campaign Management</td>
            <td style="text-align:left">Digital Experience</td>
            <td style="text-align:left">Mumbai</td>
            <td>5 yrs</td>
            <td><a href="/careers/job-details/senior-manager-campaign-management-290029">View Details</a></td>
          </tr>
          <tr>
            <td style="text-align:left">Manager Digital Marketing</td>
            <td style="text-align:left">Digital Marketing</td>
            <td style="text-align:left">Mumbai</td>
            <td>8</td>
            <td><a href="/careers/job-details/manager-digital-marketing-290020">View Details</a></td>
          </tr>
          <tr>
            <td style="text-align:left">UI/UX Designer</td>
            <td style="text-align:left">Design</td>
            <td style="text-align:left">Mumbai</td>
            <td>5</td>
            <td><a href="/careers/job-details/ui-ux-designer-289891">View Details</a></td>
          </tr>
        </tbody>
      </table>
      <a href="mailto:careers@sharekhan.com">careers@sharekhan.com</a>
    </main>
  </body>
</html>
`

const buildDetailHtml = (title, responsibilities) => `
<!doctype html>
<html lang="en">
  <body>
    <section class="container">
      <h1 class="font-family">Job Details</h1>
      <h3 class="JobTitle">${title}</h3>
      <hr />
      <p><strong>Direct Responsibilities</strong></p>
      <ul>
        <li>${responsibilities}</li>
      </ul>
      <h2>Applying for the Job</h2>
    </section>
  </body>
</html>
`

const buildAreasOfResponsibilitiesDetailHtml = (title, responsibilities) => `
<!doctype html>
<html lang="en">
  <body>
    <section class="container">
      <h1 class="font-family">Job Details</h1>
      <h3 class="JobTitle">${title}</h3>
      <hr />
      <h3><span>Areas of Responsibilities</span></h3>
      <ul>
        <li><span>&#x2022; Direct Responsibilities</span></li>
        <li><span>&#x2022; Contributing Responsibilities</span></li>
        <li><span>&#x2022; Technical &amp; Behavioural Competencies</span></li>
      </ul>
      <div>
        <ul>
          <li><span>&#x2022; ${responsibilities}</span></li>
        </ul>
      </div>
      <h2>Applying for the Job</h2>
    </section>
  </body>
</html>
`

const buildListOnlyDetailHtml = (title, responsibilities) => `
<!doctype html>
<html lang="en">
  <body>
    <section class="container">
      <h1 class="font-family">Job Details</h1>
      <h3 class="JobTitle">${title}</h3>
      <hr />
      <ul>
        <li><span>&#x2022; ${responsibilities}</span></li>
      </ul>
      <h2>Applying for the Job</h2>
    </section>
  </body>
</html>
`

const DETAIL_PAGES = {
  'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029': buildDetailHtml(
    'Senior Manager - Campaign Management',
    'Drive digital programs and campaigns for products with limited or no online journey.',
  ),
  'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020': buildAreasOfResponsibilitiesDetailHtml(
    'Manager Digital Marketing',
    'Manage acquisition and performance marketing programs across digital channels.',
  ),
  'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891': buildListOnlyDetailHtml(
    'UI/UX Designer',
    'Design intuitive experiences for retail investing and trading journeys.',
  ),
}

const DRIFTED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main><p>No verified Sharekhan careers surface.</p></main>
  </body>
</html>
`

const INVALID_DETAIL_LINK_HTML = CAREERS_HTML.replace(
  '/careers/job-details/ui-ux-designer-289891',
  'https://example.com/jobs/ui-ux-designer-289891',
)

const DRIFTED_DETAIL_HTML = buildDetailHtml('Wrong title', 'Broken detail page.')

const loadSharekhanModule = async () => {
  try {
    return await import('../../scraper/sharekhan/script.js')
  } catch {
    assert.fail('Expected Sharekhan scraper module at ../../scraper/sharekhan/script.js')
  }
}

test('Sharekhan helpers pin the verified first-party careers table and detail-page contract', async () => {
  const sharekhan = await loadSharekhanModule()

  assert.equal(sharekhan.SOURCE, 'sharekhan')
  assert.equal(sharekhan.COMPANY, 'Sharekhan')
  assert.equal(sharekhan.HOMEPAGE_URL, 'https://www.sharekhan.com/')
  assert.equal(sharekhan.CAREERS_URL, 'https://www.sharekhan.com/careers')
  assert.equal(sharekhan.LISTING_TABLE_URL, 'https://www.sharekhan.com/careers')
  assert.equal(
    sharekhan.VERIFIED_SAMPLE_JOB_URL,
    'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
  )
  assert.equal(sharekhan.VERIFIED_ON, '2026-07-17')
  assert.equal(sharekhan.hasVerifiedCareersPageSignal(CAREERS_HTML), true)
  assert.deepEqual(
    sharekhan.extractListingRows(CAREERS_HTML).map((row) => row.title),
    [
      'Senior Manager - Campaign Management',
      'Manager Digital Marketing',
      'UI/UX Designer',
    ],
  )

  const jobs = sharekhan.extractJobsFromPages(CAREERS_HTML, DETAIL_PAGES, {
    scrapedAt: '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Senior Manager - Campaign Management',
      company: 'Sharekhan',
      department: 'Digital Experience',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      experienceRequired: '5 yrs',
      sourceUrl: 'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
      applyUrl: 'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
      link: 'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
      source: 'sharekhan',
      jobId: '290029',
      requisitionId: '290029',
      jobDescription: 'Drive digital programs and campaigns for products with limited or no online journey.',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'Manager Digital Marketing',
      company: 'Sharekhan',
      department: 'Digital Marketing',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      experienceRequired: '8 years',
      sourceUrl: 'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020',
      applyUrl: 'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020',
      link: 'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020',
      source: 'sharekhan',
      jobId: '290020',
      requisitionId: '290020',
      jobDescription: 'Manage acquisition and performance marketing programs across digital channels.',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
    {
      title: 'UI/UX Designer',
      company: 'Sharekhan',
      department: 'Design',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      experienceRequired: '5 years',
      sourceUrl: 'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891',
      applyUrl: 'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891',
      link: 'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891',
      source: 'sharekhan',
      jobId: '289891',
      requisitionId: '289891',
      jobDescription: 'Design intuitive experiences for retail investing and trading journeys.',
      scrapedAt: '2026-07-17T00:00:00.000Z',
    },
  ])
})

test('Sharekhan run validates the official careers page before returning first-party roles', async () => {
  const sharekhan = await loadSharekhanModule()
  const requestedUrls = []

  const jobs = await sharekhan.createSharekhanScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === sharekhan.CAREERS_URL) return CAREERS_HTML
      if (DETAIL_PAGES[url]) return DETAIL_PAGES[url]
      throw new Error(`Unexpected Sharekhan fixture URL: ${url}`)
    },
    now: () => '2026-07-17T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    sharekhan.CAREERS_URL,
    'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029',
    'https://www.sharekhan.com/careers/job-details/manager-digital-marketing-290020',
    'https://www.sharekhan.com/careers/job-details/ui-ux-designer-289891',
  ])
  assert.equal(jobs.length, 3)
  assert.equal(jobs[0].source, 'sharekhan')
})

test('Sharekhan fails closed when the first-party careers shell or detail-page contract drifts', async () => {
  const sharekhan = await loadSharekhanModule()

  await assert.rejects(
    sharekhan.createSharekhanScraper().run({
      fetchText: async (url) => {
        if (url === sharekhan.CAREERS_URL) return DRIFTED_CAREERS_HTML
        throw new Error(`Unexpected Sharekhan fixture URL: ${url}`)
      },
    }),
    /verified first-party careers page/i,
  )

  await assert.rejects(
    sharekhan.createSharekhanScraper().run({
      fetchText: async (url) => {
        if (url === sharekhan.CAREERS_URL) return INVALID_DETAIL_LINK_HTML
        throw new Error(`Unexpected Sharekhan fixture URL: ${url}`)
      },
    }),
    /detail links/i,
  )

  await assert.rejects(
    sharekhan.createSharekhanScraper().run({
      fetchText: async (url) => {
        if (url === sharekhan.CAREERS_URL) return CAREERS_HTML
        if (url === 'https://www.sharekhan.com/careers/job-details/senior-manager-campaign-management-290029') {
          return DRIFTED_DETAIL_HTML
        }
        if (DETAIL_PAGES[url]) return DETAIL_PAGES[url]
        throw new Error(`Unexpected Sharekhan fixture URL: ${url}`)
      },
    }),
    /detail page/i,
  )
})
