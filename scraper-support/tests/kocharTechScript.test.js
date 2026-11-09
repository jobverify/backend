import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T00:00:00.000Z'

const CAREERS_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers - Technology Solutions | AI backed Knowledge Management, IoT, Device Care</title>
    <link rel="canonical" href="https://www.kochartech.com/careers/" />
  </head>
  <body>
    <h2 class="h2">Open Positions</h2>
    <table>
      <tr><td><a class="apply_js" href="https://www.kochartech.com/career/senior-manager-sales-2/">Apply Now</a></td></tr>
      <tr><td><a class="apply_js" href="https://www.kochartech.com/career/inside-sales-executive-sales/">Apply Now</a></td></tr>
      <tr><td><a class="apply_js" href="https://www.kochartech.com/career/assistant-manager-operations/">Apply Now</a></td></tr>
    </table>
    <div class="navigation">
      <span aria-current="page" class="page-numbers current">1</span>
      <a class="page-numbers" href="https://www.kochartech.com/careers/page/2/">2</a>
      <a class="page-numbers" href="https://www.kochartech.com/careers/page/3/">3</a>
    </div>
  </body>
</html>
`

const REST_PAYLOAD = [
  {
    id: 3551,
    date: '2023-05-02T07:07:21',
    slug: 'senior-manager-sales-2',
    status: 'publish',
    type: 'career',
    link: 'https://www.kochartech.com/career/senior-manager-sales-2/',
    title: { rendered: 'Senior Manager-Sales' },
    ACF: {
      job_profile: 'Senior Manager-Sales',
      job_department: 'Sales and BD',
      job_location: 'Gurgaon',
      job_description: `
        <h4><b>Job Role:</b></h4>
        <p>Responsible for driving the growth of our business by identifying new market opportunities.</p>
        <h4><b>Job Description:</b></h4>
        <ul>
          <li>Identify new market opportunities and develop strategies to drive business growth.</li>
          <li>Create and deliver presentations to senior management and key stakeholders.</li>
        </ul>
      `,
      desired_candidate_profile: '',
      experience: '',
    },
  },
  {
    id: 3549,
    date: '2023-05-02T07:04:23',
    slug: 'inside-sales-executive-sales',
    status: 'publish',
    type: 'career',
    link: 'https://www.kochartech.com/career/inside-sales-executive-sales/',
    title: { rendered: 'Inside Sales Executive &#8211; Sales' },
    ACF: {
      job_profile: 'Inside Sales Executive - Sales',
      job_department: 'Sales and BD',
      job_location: 'Amritsar',
      job_description: `
        <h4><b>Job Role:</b></h4>
        <p>The role will focus on making outbound calls, sending emails, and leveraging LinkedIn.</p>
        <h4><b>Job Responsibilities:</b></h4>
        <ul>
          <li>Business to business(B2B) calling &amp; setting appointments.</li>
          <li>Responsible for making cold calls and handling outbound processes.</li>
        </ul>
      `,
      desired_candidate_profile: '',
      experience: '',
    },
  },
]

const SENIOR_MANAGER_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Senior Manager-Sales - KocharTech</title>
    <link rel="canonical" href="https://www.kochartech.com/career/senior-manager-sales-2/" />
  </head>
  <body>
    <div class="kt-apply-btn">
      <a
        href="https://dh.maxicus.com/validatemobile/633190214529e62d9edc2fff?formname=Lateral-Hiring-New&source=Maxicus%20Website&utm_medium=Career+Page"
        class="btn-block botao kt-jobs-btn-apply-now"
      >
        Apply Now
      </a>
    </div>
    <section class="section-d">
      <div id="job-des">
        <h4><b>Job Role:</b></h4>
        <p>Responsible for driving the growth of our business by identifying new market opportunities.</p>
        <h4><b>Job Description:</b></h4>
        <ul>
          <li>Identify new market opportunities and develop strategies to drive business growth.</li>
          <li>Create and deliver presentations to senior management and key stakeholders.</li>
        </ul>
      </div>
    </section>
  </body>
</html>
`

const INSIDE_SALES_DETAIL_HTML = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Inside Sales Executive - Sales - KocharTech</title>
    <link rel="canonical" href="https://www.kochartech.com/career/inside-sales-executive-sales/" />
  </head>
  <body>
    <div class="kt-apply-btn">
      <a
        href="https://dh.maxicus.com/validatemobile/633190214529e62d9edc2fff?formname=Lateral-Hiring-New&source=Maxicus%20Website&utm_medium=Career+Page&utm_campaign=inside-sales"
        class="btn-block botao kt-jobs-btn-apply-now"
      >
        Apply Now
      </a>
    </div>
    <section class="section-d">
      <div id="job-des">
        <h4><b>Job Role:</b></h4>
        <p>The role will focus on making outbound calls, sending emails, and leveraging LinkedIn.</p>
        <h4><b>Job Responsibilities:</b></h4>
        <ul>
          <li>Business to business(B2B) calling &amp; setting appointments.</li>
          <li>Responsible for making cold calls and handling outbound processes.</li>
        </ul>
      </div>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/kochartech/script.js')
  } catch {
    assert.fail('Expected KocharTech scraper module at ../../scraper/kochartech/script.js')
  }
}

test('KocharTech helpers stay pinned to the verified careers page, REST feed, and Maxicus apply handoff', async () => {
  const kocharTech = await loadModule()

  assert.equal(kocharTech.SOURCE, 'kochartech')
  assert.equal(kocharTech.COMPANY, 'KocharTech')
  assert.equal(kocharTech.VERIFIED_ON, '2026-07-16')
  assert.equal(kocharTech.HOMEPAGE_URL, 'https://www.kochartech.com/')
  assert.equal(kocharTech.CAREERS_URL, 'https://www.kochartech.com/careers/')
  assert.equal(
    kocharTech.CAREER_API_URL,
    'https://www.kochartech.com/wp-json/wp/v2/career?per_page=100',
  )
  assert.deepEqual(kocharTech.VERIFIED_JOB_DETAIL_URLS, [
    'https://www.kochartech.com/career/senior-manager-sales-2/',
    'https://www.kochartech.com/career/inside-sales-executive-sales/',
    'https://www.kochartech.com/career/assistant-manager-operations/',
  ])
  assert.equal(kocharTech.hasOfficialCareersPageSignal(CAREERS_HTML), true)
  assert.equal(
    kocharTech.extractDetailApplyUrl(SENIOR_MANAGER_DETAIL_HTML),
    'https://dh.maxicus.com/validatemobile/633190214529e62d9edc2fff?formname=Lateral-Hiring-New&source=Maxicus%20Website&utm_medium=Career+Page',
  )
  assert.match(
    kocharTech.extractDetailDescription(SENIOR_MANAGER_DETAIL_HTML) || '',
    /identify new market opportunities/i,
  )
  assert.deepEqual(
    kocharTech.extractJobsFromRestPayload(REST_PAYLOAD),
    [
      {
        title: 'Senior Manager-Sales',
        company: 'KocharTech',
        department: 'Sales and BD',
        location: 'Gurgaon, India',
        city: 'Gurgaon',
        country: 'India',
        jobId: '3551',
        requisitionId: '3551',
        sourceUrl: 'https://www.kochartech.com/career/senior-manager-sales-2/',
        applyUrl: null,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2023-05-02',
        closingDate: null,
        jobDescription:
          'Job Role: Responsible for driving the growth of our business by identifying new market opportunities. Job Description: Identify new market opportunities and develop strategies to drive business growth. Create and deliver presentations to senior management and key stakeholders.',
        remoteStatus: null,
      },
      {
        title: 'Inside Sales Executive - Sales',
        company: 'KocharTech',
        department: 'Sales and BD',
        location: 'Amritsar, India',
        city: 'Amritsar',
        country: 'India',
        jobId: '3549',
        requisitionId: '3549',
        sourceUrl: 'https://www.kochartech.com/career/inside-sales-executive-sales/',
        applyUrl: null,
        employmentType: null,
        experienceRequired: null,
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: [],
        postingDate: '2023-05-02',
        closingDate: null,
        jobDescription:
          'Job Role: The role will focus on making outbound calls, sending emails, and leveraging LinkedIn. Job Responsibilities: Business to business(B2B) calling & setting appointments. Responsible for making cold calls and handling outbound processes.',
        remoteStatus: null,
      },
    ],
  )
})

test('KocharTech run validates the verified careers shell, consumes the public REST feed, and decorates jobs with real apply handoffs', async () => {
  const kocharTech = await loadModule()
  const requested = []

  const jobs = await kocharTech.createKocharTechScraper({
    maxJobs: 2,
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requested.push(url)

      if (url === kocharTech.CAREERS_URL) return CAREERS_HTML
      if (url === 'https://www.kochartech.com/career/senior-manager-sales-2/') return SENIOR_MANAGER_DETAIL_HTML
      if (url === 'https://www.kochartech.com/career/inside-sales-executive-sales/') return INSIDE_SALES_DETAIL_HTML

      throw new Error(`Unexpected KocharTech text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requested.push(url)

      if (url === kocharTech.CAREER_API_URL) return REST_PAYLOAD

      throw new Error(`Unexpected KocharTech JSON URL: ${url}`)
    },
  })

  assert.deepEqual(requested, [
    kocharTech.CAREERS_URL,
    kocharTech.CAREER_API_URL,
    'https://www.kochartech.com/career/senior-manager-sales-2/',
    'https://www.kochartech.com/career/inside-sales-executive-sales/',
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.applyUrl, job.source, job.scrapedAt]),
    [
      [
        'Senior Manager-Sales',
        'Gurgaon, India',
        'https://dh.maxicus.com/validatemobile/633190214529e62d9edc2fff?formname=Lateral-Hiring-New&source=Maxicus%20Website&utm_medium=Career+Page',
        'kochartech',
        FIXED_SCRAPED_AT,
      ],
      [
        'Inside Sales Executive - Sales',
        'Amritsar, India',
        'https://dh.maxicus.com/validatemobile/633190214529e62d9edc2fff?formname=Lateral-Hiring-New&source=Maxicus%20Website&utm_medium=Career+Page&utm_campaign=inside-sales',
        'kochartech',
        FIXED_SCRAPED_AT,
      ],
    ],
  )
  assert.match(jobs[0].jobDescription, /identify new market opportunities/i)
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})
