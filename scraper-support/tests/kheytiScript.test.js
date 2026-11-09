import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const joinPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>We bring innovation in Indian agriculture | Join Kheyti</title>
    <link rel="canonical" href="https://www.kheyti.com/join-us" />
    <meta
      name="description"
      content="Build a career that powers smallholder farming and climate-smart agriculture innovation in India. Help us scale impact from 7,000+ to 1 million farmers. Apply now."
    />
  </head>
  <body>
    <main>
      <h2>Employee testimonials</h2>
      <a href="/join-us">Join Us</a>
    </main>
  </body>
</html>
`

const jobsPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Kheyti Job Openings</title>
  </head>
  <body>
    <h1>Check out the latest job openings at Kheyti!</h1>
    <div>Current Job Openings</div>
    <table>
      <tr id="zr-joblist-detail_484579000019591131" class="jobDetailRow" data-rowid="484579000019591131">
        <td>
          <a
            class="jobdetail"
            href="/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000019591131&widgetid=484579000000072311&embedsource=CareerSite"
          >
            Green House- Product Manager
          </a>
        </td>
        <td>Hyderabad</td>
        <td>Upto 18 LPA</td>
        <td
          title="Looking for passionate, innovative minds to ideate, design, test and launch end-to-end products. Job Type: Full time Location: Hyderabad Reporting to: R &amp; D Lead Must-Haves 5+ Years of experience product design."
        >
          Looking for passionate, innovative minds to ideate, design, test and launch end-to-end products.
        </td>
        <td><input type="button" value="Apply Now" /></td>
      </tr>
      <tr id="zr-joblist-detail_484579000021728330" class="jobDetailRow" data-rowid="484579000021728330">
        <td>
          <a
            class="jobdetail"
            href="/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000021728330&widgetid=484579000000072311&embedsource=CareerSite"
          >
            Farmer Success Associate
          </a>
        </td>
        <td>Keonjhar</td>
        <td>3 LPA</td>
        <td
          title="Deliver day-to-day advisory and support services to farmers. Job Type: Full Time Location: Keonjhar, Odisha Reporting to: Team Lead."
        >
          Deliver day-to-day advisory and support services to farmers.
        </td>
        <td><input type="button" value="Apply Now" /></td>
      </tr>
    </table>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/kheyti/script.js')
  } catch {
    assert.fail('Expected Kheyti scraper module at ../../scraper/kheyti/script.js')
  }
}

test('Kheyti helpers stay pinned to the verified join page and public jobs table surface', async () => {
  const kheyti = await loadModule()

  assert.equal(kheyti.SOURCE, 'kheyti')
  assert.equal(kheyti.COMPANY, 'Kheyti')
  assert.equal(kheyti.OFFICIAL_BRAND_NAME, 'Kheyti')
  assert.equal(kheyti.VERIFIED_ON, '2026-07-16')
  assert.equal(kheyti.HOMEPAGE_URL, 'https://www.kheyti.com/')
  assert.equal(kheyti.JOIN_PAGE_URL, 'https://www.kheyti.com/join-us')
  assert.equal(kheyti.JOBS_PAGE_URL, 'https://jobs.kheyti.com/careers')
  assert.equal(kheyti.hasOfficialJoinPageSignal(joinPageHtml), true)
  assert.equal(kheyti.hasOfficialJobsPageSignal(jobsPageHtml), true)

  assert.deepEqual(kheyti.extractJobsFromCareersPage(jobsPageHtml), [
    {
      title: 'Green House- Product Manager',
      company: 'Kheyti',
      department: null,
      location: 'Hyderabad, India',
      city: 'Hyderabad',
      state: null,
      country: 'India',
      jobId: '484579000019591131',
      requisitionId: '484579000019591131',
      sourceUrl:
        'https://jobs.kheyti.com/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000019591131&widgetid=484579000000072311&embedsource=CareerSite',
      applyUrl:
        'https://jobs.kheyti.com/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000019591131&widgetid=484579000000072311&embedsource=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: '5+ years',
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Looking for passionate, innovative minds to ideate, design, test and launch end-to-end products. Job Type: Full time Location: Hyderabad Reporting to: R & D Lead Must-Haves 5+ Years of experience product design.',
    },
    {
      title: 'Farmer Success Associate',
      company: 'Kheyti',
      department: null,
      location: 'Keonjhar, Odisha, India',
      city: 'Keonjhar',
      state: 'Odisha',
      country: 'India',
      jobId: '484579000021728330',
      requisitionId: '484579000021728330',
      sourceUrl:
        'https://jobs.kheyti.com/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000021728330&widgetid=484579000000072311&embedsource=CareerSite',
      applyUrl:
        'https://jobs.kheyti.com/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000021728330&widgetid=484579000000072311&embedsource=CareerSite',
      employmentType: 'Full-time',
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'Deliver day-to-day advisory and support services to farmers. Job Type: Full Time Location: Keonjhar, Odisha Reporting to: Team Lead.',
    },
  ])
})

test('Kheyti run validates the verified surfaces and decorates jobs from the public careers table', async () => {
  const kheyti = await loadModule()
  const requestedUrls = []

  const jobs = await kheyti.createKheytiScraper({
    maxJobs: 1,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === kheyti.JOIN_PAGE_URL) return joinPageHtml
      if (url === kheyti.JOBS_PAGE_URL) return jobsPageHtml

      assert.fail(`Unexpected Kheyti HTML request: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    kheyti.JOIN_PAGE_URL,
    kheyti.JOBS_PAGE_URL,
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'kheyti')
  assert.equal(
    jobs[0].link,
    'https://jobs.kheyti.com/recruit/PortalDetail.na?iframe=true&digest=OAklCDTw9J9pswkzjtfSB3GAUnkE7bVo.a85bxdBEmQ-&jobid=484579000019591131&widgetid=484579000000072311&embedsource=CareerSite',
  )
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
})

test('Kheyti fails closed when the verified join page or public jobs page drifts', async () => {
  const kheyti = await loadModule()

  await assert.rejects(
    kheyti.createKheytiScraper().run({
      fetchText: async (url) => {
        if (url === kheyti.JOIN_PAGE_URL) {
          return '<html><body><h1>Kheyti</h1></body></html>'
        }

        return jobsPageHtml
      },
    }),
    /verified official Kheyti join page/i,
  )

  await assert.rejects(
    kheyti.createKheytiScraper().run({
      fetchText: async (url) => {
        if (url === kheyti.JOIN_PAGE_URL) return joinPageHtml
        return '<html><body><h1>Jobs</h1></body></html>'
      },
    }),
    /verified public Kheyti jobs page/i,
  )
})
