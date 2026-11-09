import assert from 'node:assert/strict'
import test from 'node:test'

import { getScraperCatalog } from '../providers/index.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/housr/script.js')
  } catch {
    assert.fail('Expected Housr scraper module at ../../scraper/housr/script.js')
  }
}

const VERIFIED_LISTINGS = [
  {
    jobId: 16,
    title: 'Sales Executive / Senior Sales Executive',
    location: 'Gurgaon',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000016',
    jobDescription:
      'Drive sales conversions and maintain strong resident relationships across the Gurgaon portfolio.',
    expertiseRequired:
      'Minimum 1-3 years of sales experience with strong communication and customer-handling skills.',
    whatToExpect:
      'Candidate should be comfortable working from the property and coordinating across sales shifts.',
  },
  {
    jobId: 15,
    title: 'Inside Sales (Executive, Senior Executive)',
    location: 'Gurgaon',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000015',
    jobDescription:
      'Manage inbound and outbound inside-sales conversations and maintain the booking pipeline.',
    expertiseRequired:
      'Minimum 1-4 years of inside-sales experience with excellent verbal communication and follow-through.',
    whatToExpect:
      'Candidate should be comfortable with sales targets, lead tracking, and working from the Gurgaon property.',
  },
  {
    jobId: 14,
    title: 'Trainee Resident Manager',
    location: 'Pune',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000014',
    jobDescription:
      'Support resident operations, hospitality standards, and day-to-day property coordination.',
    expertiseRequired:
      'Minimum 0-2 years of hospitality or operations experience with strong ownership and communication.',
    whatToExpect:
      'Candidate has to be ready to stay at the property. Accommodation and food will be provided by Housr.',
  },
  {
    jobId: 13,
    title: 'Social Media Executive',
    location: 'Gurgaon',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000013',
    jobDescription:
      'Own social media publishing, campaign coordination, and brand storytelling for Housr.',
    expertiseRequired:
      'Minimum 1-3 years of social media or content experience with strong writing and coordination skills.',
    whatToExpect:
      'Candidate will work closely with the Gurgaon marketing team on fast-turn brand campaigns.',
  },
  {
    jobId: 12,
    title: 'Cluster Manager',
    location: 'Pune',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000012',
    jobDescription:
      'Lead multi-property operations, vendor coordination, and resident-experience standards across Pune.',
    expertiseRequired:
      'Minimum 3-6 years of operations experience with team leadership and strong problem-solving.',
    whatToExpect:
      'Candidate should be comfortable managing multiple properties and resolving on-ground issues quickly.',
  },
  {
    jobId: 11,
    title: 'Content Writer - Executive',
    location: 'Gurgaon',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000011',
    jobDescription:
      'Create brand, web, and campaign copy aligned to Housr luxury-living positioning.',
    expertiseRequired:
      'Minimum 1-3 years of content-writing experience with portfolio-backed long-form and campaign copy.',
    whatToExpect:
      'Candidate will partner with the Gurgaon marketing team and should be comfortable with rapid iteration.',
  },
  {
    jobId: 9,
    title: 'B2B Sales',
    location: 'Gurgaon',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000009',
    jobDescription:
      'Build and grow Housr B2B partnerships across enterprise and channel accounts.',
    expertiseRequired:
      'Minimum 2-5 years of B2B sales experience with negotiation, pipeline, and relationship-management skills.',
    whatToExpect:
      'Candidate should be comfortable with field meetings and regular coordination with Gurgaon leadership.',
  },
  {
    jobId: 7,
    title: 'Assistant Resident Manager/Resident Manager (Gurgaon)',
    location: 'Gurgaon',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4080000007',
    jobDescription:
      'Oversee resident experience, team coordination, and day-to-day property operations in Gurgaon.',
    expertiseRequired:
      'Minimum 1-4 years of experience in a five-star hotel or co-living setup with strong customer handling.',
    whatToExpect:
      'Candidate has to be ready to stay at the property. Accommodation and food will be provided by Housr.',
  },
  {
    jobId: 4,
    title: 'Assistant Resident Manager/Resident Manager (Bangalore & Pune)',
    location: 'Bangalore',
    employmentType: 'Full-time',
    linkedinUrl: 'https://www.linkedin.com/jobs/view/4071386192',
    jobDescription:
      'Oversee customer service and support processes, manage shift supervisors, and drive property P&L and sales.',
    expertiseRequired:
      'Minimum 1-4 years of experience in a five-star hotel or Co-living setup. Graduate with a bachelor degree.',
    whatToExpect:
      'Candidate has to be ready to stay at the property. Accommodation and food will be provided by Housr.',
  },
]

const buildListingCardHtml = ({ jobId, title, location, employmentType }) => `
  <a href="/career/${jobId}">
    <div class="hire_jobMain__fMIfH">
      <div class="hire_left__8DhVO">
        <h3>${title}</h3>
        <div class="hire_viewPhone__cwjtf">
          <p><span><img alt="locationpin" src="/_next/static/media/pin_drop.svg"/></span>${location}</p>
          <p><span><img alt="clockpin" src="/_next/static/media/clock.svg"/></span>${employmentType}</p>
        </div>
      </div>
      <div class="hire_right__a5hGZ">
        <p class="hire_view__6Gnjb"><span><img alt="locationpin" src="/_next/static/media/pin_drop.svg"/></span>${location}</p>
        <p class="hire_view__6Gnjb"><span><img alt="clockpin" src="/_next/static/media/clock.svg"/></span>${employmentType}</p>
        <button><p>View Job</p></button>
      </div>
    </div>
  </a>
`

const buildDetailHtml = ({
  jobId,
  title,
  location,
  linkedinUrl,
  jobDescription,
  expertiseRequired,
  whatToExpect,
}) => `
<!doctype html>
<html lang="en">
  <head>
    <title>${title} - Housr</title>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <button><p>Application <span>fileSvg</span></p></button>
      <button><p>Role Overview <span>AlignLeft</span></p></button>
      <h2>Fill this Form</h2>
      <a href="${linkedinUrl}" target="_blank" rel="noreferrer"><p>Apply with LinkedIn</p></a>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          response: {
            data: {
              linkedin_url: linkedinUrl,
              job_description: jobDescription,
              about_housr: '',
              expertise_required: expertiseRequired,
              what_to_expect: whatToExpect,
              job_name: title,
              job_id: jobId,
              job_location: location,
            },
          },
        },
      },
      page: '/career/[slug]',
      query: { slug: String(jobId) },
    })}</script>
  </body>
</html>
`

const VERIFIED_CAREERS_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <title>Shape the Future of Luxury CoLiving At Housr</title>
    <link rel="canonical" href="https://housr.in/career" />
  </head>
  <body>
    <main>
      <p>9 role in 5 locations</p>
      <h1>Shape the Future of Luxury Living</h1>
      <button><a href="#hire"><p>Open Jobs</p></a></button>
      <div class="hire_container__h_wnk" id="hire">
        <div class="hire_title__Xeoi7"><h4>Explore Roles at Housr</h4></div>
        <div class="hire_jobsListing__D2NqA">
          ${VERIFIED_LISTINGS.map(buildListingCardHtml).join('')}
        </div>
      </div>
      <h4>Directly reach out to us</h4>
      <p>Join us &amp; be part of a company that&#x27;s redefining luxury living every step of the way.</p>
    </main>
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          response: {
            data: VERIFIED_LISTINGS.map(({ jobId, title, location }) => ({
              job_name: title,
              job_id: jobId,
              job_location: location,
            })),
          },
        },
      },
      page: '/career',
      query: {},
    })}</script>
  </body>
</html>
`

const DETAIL_PAGES = Object.fromEntries(
  VERIFIED_LISTINGS.map((listing) => [
    `https://housr.in/career/${listing.jobId}`,
    buildDetailHtml(listing),
  ]),
)

test('Housr catalog entry points to the verified first-party careers scraper', async () => {
  const housr = await loadModule()
  const provider = getScraperCatalog().find((entry) => entry.source === housr.SOURCE)

  assert.equal(housr.SOURCE, 'housr')
  assert.equal(housr.COMPANY, 'Housr')
  assert.equal(housr.VERIFIED_ON, '2026-07-30')
  assert.equal(housr.CAREERS_URL, 'https://housr.in/career')
  assert.equal(
    housr.DISPOSITION,
    'verified-first-party-careers-page-plus-same-origin-detail-pages',
  )
  assert.match(provider?.modulePath || '', /[\\/]housr[\\/]script\.js$/i)
  assert.equal(provider?.companyCareerPage, housr.CAREERS_URL)
  assert.equal(provider?.companyDomain, 'housr.in')
  assert.equal(
    provider?.atsPlatform,
    'verified-first-party-careers-page-plus-same-origin-detail-pages',
  )
  assert.equal(provider?.verifiedPublicJobCount, 9)
  assert.equal(provider?.verifiedIndiaJobCount, 9)
  assert.match(provider?.verifiedSurfaceSummary || '', /Thursday, July 30, 2026/i)
  assert.match(provider?.verifiedSurfaceSummary || '', /https:\/\/housr\.in\/career/i)
  assert.match(
    provider?.verifiedSurfaceSummary || '',
    /Assistant Resident Manager\/Resident Manager \(Bangalore & Pune\)/i,
  )
})

test('Housr validates the verified careers shell and extracts the visible same-origin job cards', async () => {
  const housr = await loadModule()
  const cards = housr.extractListingCards(VERIFIED_CAREERS_HTML)

  assert.equal(housr.hasOfficialCareersPageSignal(VERIFIED_CAREERS_HTML), true)
  assert.equal(cards.length, 9)
  assert.deepEqual(cards[0], {
    title: 'Sales Executive / Senior Sales Executive',
    detailUrl: 'https://housr.in/career/16',
    location: 'Gurgaon',
    employmentType: 'Full-time',
  })
  assert.deepEqual(cards.at(-1), {
    title: 'Assistant Resident Manager/Resident Manager (Bangalore & Pune)',
    detailUrl: 'https://housr.in/career/4',
    location: 'Bangalore',
    employmentType: 'Full-time',
  })
})

test('Housr run returns normalized India jobs from the verified first-party careers and detail pages', async () => {
  const housr = await loadModule()
  const requestedUrls = []

  const jobs = await housr.createHousrScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === housr.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (DETAIL_PAGES[url]) return DETAIL_PAGES[url]

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-30T00:00:00.000Z',
  })

  assert.equal(requestedUrls[0], housr.CAREERS_URL)
  assert.equal(requestedUrls.length, 10)
  assert.equal(jobs.length, 9)
  assert.deepEqual(jobs[0], {
    title: 'Sales Executive / Senior Sales Executive',
    company: 'Housr',
    department: null,
    location: 'Gurgaon',
    city: 'Gurgaon',
    country: 'India',
    jobId: '16',
    requisitionId: '16',
    sourceUrl: 'https://housr.in/career/16',
    applyUrl: 'https://www.linkedin.com/jobs/view/4080000016',
    employmentType: 'Full-time',
    experienceRequired: '1-3 years',
    minimumQualification:
      'Minimum 1-3 years of sales experience with strong communication and customer-handling skills.',
    preferredQualification:
      'Candidate should be comfortable working from the property and coordinating across sales shifts.',
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      'Drive sales conversions and maintain strong resident relationships across the Gurgaon portfolio.',
    remoteStatus: null,
    source: 'housr',
    link: 'https://www.linkedin.com/jobs/view/4080000016',
    scrapedAt: '2026-07-30T00:00:00.000Z',
  })
  assert.equal(
    jobs.find((job) => job.jobId === '4')?.applyUrl,
    'https://www.linkedin.com/jobs/view/4071386192',
  )
})

test('Housr skips a listing whose detail payload no longer matches the verified job contract', async () => {
  const housr = await loadModule()

  const jobs = await housr.createHousrScraper({ maxJobs: 3 }).run({
    fetchText: async (url) => {
      if (url === housr.CAREERS_URL) return VERIFIED_CAREERS_HTML
      if (url === 'https://housr.in/career/15') {
        return buildDetailHtml({
          ...VERIFIED_LISTINGS[1],
          title: 'Revenue Operations Manager',
        })
      }
      if (DETAIL_PAGES[url]) return DETAIL_PAGES[url]

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-30T00:00:00.000Z',
  })

  assert.deepEqual(
    jobs.map((job) => job.jobId),
    ['16', '14', '13'],
  )
})

test('Housr fails closed when the verified careers or detail-page contract drifts materially', async () => {
  const housr = await loadModule()

  await assert.rejects(
    housr.run({
      fetchText: async () => `
        <html>
          <body>
            <h1>Careers</h1>
            <p>Join us.</p>
          </body>
        </html>
      `,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    housr.run({
      fetchText: async (url) => {
        if (url === housr.CAREERS_URL) return VERIFIED_CAREERS_HTML
        return `
          <html>
            <body>
              <h1>Broken detail</h1>
              <p>No verified contract here.</p>
            </body>
          </html>
        `
      },
    }),
    /verified detail page/i,
  )
})
