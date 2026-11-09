import assert from 'node:assert/strict'
import test from 'node:test'

const homepageHtml = `
  <!doctype html>
  <html lang="en">
    <head>
      <title>Rinex Education</title>
      <script defer="defer" src="/static/js/main.01193449.js"></script>
    </head>
    <body>
      <a href="https://wa.me/+917892745201?text=Hello">WhatsApp</a>
      <div id="root"></div>
    </body>
  </html>
`

const bundleText = `
  const Oe=JSON.parse('[{"id":1,"role":"ROLE 1","jobTitle":"Inside sales Strategist","jobLocation":"Bengaluru \\\\xb7 Mangaluru","immediateChip":"../public/images/immediate_chip.svg"},{"id":2,"role":"ROLE 2","jobTitle":"Talent Acquisition","jobLocation":"Bengaluru \\\\xb7 Mangaluru","immediateChip":"../public/images/immediate_chip.svg"},{"id":3,"role":"ROLE 3","jobTitle":"Corporate Relations","jobLocation":"Bengaluru \\\\xb7 Mangaluru","immediateChip":"../public/images/immediate_chip.svg"},{"id":4,"role":"ROLE 4","jobTitle":"Operation Specialist","jobLocation":"Bengaluru \\\\xb7 Mangaluru","immediateChip":"../public/images/immediate_chip.svg"}]');
  <footer>Rinex Technologies Private Limited. help@rinex.ai</footer>
  <a href="/job/Talent Acquisition">Role</a>
  <a href="/job/Corporate Relations">Role</a>
  <a href="/job/Operation Specialist">Role</a>
  /job/:jobrole
`

const buildDetailHtml = ({
  title,
  location = 'Bengaluru / Mangaluru',
  applyUrl,
  overview,
  opportunity,
  responsibilities,
  requirements,
  related = [],
}) => `
  <html>
    <head>
      <title>Rinex Education</title>
    </head>
    <body>
      <div class="job-banner">
        <p>ROLE</p>
        <h4>${title}</h4>
        <p>LOCATION</p>
        <p>${location}</p>
        <a href="${applyUrl}">Apply for this Role</a>
      </div>
      <p>${overview}</p>
      <section>
        <h5>Your opportunity</h5>
        <p>${opportunity}</p>
      </section>
      <section>
        <h5>What you'll be doing</h5>
        <p>${responsibilities}</p>
      </section>
      <section>
        <h5>What you'll bring</h5>
        <p>${requirements}</p>
      </section>
      <section>
        <h5>More job openings</h5>
        ${related.map((relatedTitle) => `<a href="/job/${relatedTitle}">${relatedTitle}</a>`).join('')}
      </section>
      <footer>
        Rinex Technologies Private Limited. (Office address) Door. No. 2-95, Hariprasad Complex, Yeyyadi Padavu, Konchady Post, Mangalore, Karnataka 575008, Rinex.ai will be managed under Indian jurisdiction
      </footer>
    </body>
  </html>
`

const detailPages = {
  'Inside sales Strategist': buildDetailHtml({
    title: 'Inside sales Strategist',
    applyUrl: 'https://forms.gle/cux2RgfbTmroNJSx7',
    overview:
      'As much as we care about our students we do care for our staff as well.',
    opportunity:
      'One of the crucial points for our growth is the Inside Sales Strategist role we provide to our merchants.',
    responsibilities:
      'Advise customers on how to best implement Rinex and support escalations coming from the internet.',
    requirements:
      'You will bring your skills, experience, and enthusiasm to our team and help us achieve our goals.',
    related: ['Talent Acquisition', 'Corporate Relations', 'Operation Specialist'],
  }),
  'Talent Acquisition': buildDetailHtml({
    title: 'Talent Acquisition',
    applyUrl: 'https://forms.gle/talent-acquisition',
    overview: 'We care for our staff as well as our students.',
    opportunity: 'You will help us attract and support talented people.',
    responsibilities: 'Coordinate outreach, screening, and stakeholder communication.',
    requirements: 'You value growth, innovation, and excellent communication.',
    related: ['Inside sales Strategist', 'Corporate Relations', 'Operation Specialist'],
  }),
  'Corporate Relations': buildDetailHtml({
    title: 'Corporate Relations',
    applyUrl: 'https://forms.gle/corporate-relations',
    overview: 'A Job is not just a way to earn a living but a lifestyle.',
    opportunity: 'Strengthen employer relationships and strategic partnerships.',
    responsibilities: 'Build corporate outreach programs and maintain partner trust.',
    requirements: 'You will bring relationship-building and organizational skills.',
    related: ['Inside sales Strategist', 'Talent Acquisition', 'Operation Specialist'],
  }),
  'Operation Specialist': buildDetailHtml({
    title: 'Operation Specialist',
    applyUrl: 'https://forms.gle/operation-specialist',
    overview: 'We focus to appreciate brilliant ideas and the people behind them.',
    opportunity: 'Own operational workflows that keep Rinex moving smoothly.',
    responsibilities: 'Support process execution, documentation, and team coordination.',
    requirements: 'You will be part of a company that rewards excellence and initiative.',
    related: ['Inside sales Strategist', 'Talent Acquisition', 'Corporate Relations'],
  }),
}

const loadModule = async () => {
  try {
    return await import('./script.js')
  } catch {
    assert.fail('Expected Rinex Technologies scraper module at ./script.js')
  }
}

test('Rinex Technologies recognizes the verified homepage shell, jobs bundle, and same-domain detail pages', async () => {
  const rinex = await loadModule()

  assert.equal(rinex.SOURCE, 'rinextechnologies')
  assert.equal(rinex.COMPANY, 'Rinex Technologies')
  assert.equal(rinex.HOMEPAGE_URL, 'https://rinex.ai/')
  assert.equal(rinex.CAREER_URL, 'https://rinex.ai/career')
  assert.equal(rinex.hasOfficialHomepageShellSignal(homepageHtml), true)
  assert.equal(rinex.extractMainBundleUrl(homepageHtml), 'https://rinex.ai/static/js/main.01193449.js')
  assert.equal(rinex.hasOfficialJobsBundleSignal(bundleText), true)
  assert.equal(
    rinex.hasOfficialJobDetailSignal(detailPages['Inside sales Strategist'], {
      title: 'Inside sales Strategist',
    }),
    true,
  )
})

test('Rinex Technologies extracts current first-party bundle roles from the official main bundle', async () => {
  const rinex = await loadModule()

  assert.deepEqual(rinex.extractBundleRoles(bundleText), [
    {
      title: 'Inside sales Strategist',
      locationText: 'Bengaluru / Mangaluru',
      jobId: 'inside-sales-strategist',
      requisitionId: 'inside-sales-strategist',
      sourceUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
    },
    {
      title: 'Talent Acquisition',
      locationText: 'Bengaluru / Mangaluru',
      jobId: 'talent-acquisition',
      requisitionId: 'talent-acquisition',
      sourceUrl: 'https://rinex.ai/job/Talent%20Acquisition',
    },
    {
      title: 'Corporate Relations',
      locationText: 'Bengaluru / Mangaluru',
      jobId: 'corporate-relations',
      requisitionId: 'corporate-relations',
      sourceUrl: 'https://rinex.ai/job/Corporate%20Relations',
    },
    {
      title: 'Operation Specialist',
      locationText: 'Bengaluru / Mangaluru',
      jobId: 'operation-specialist',
      requisitionId: 'operation-specialist',
      sourceUrl: 'https://rinex.ai/job/Operation%20Specialist',
    },
  ])
})

test('Rinex Technologies extracts same-domain job details and preserves the external apply link', async () => {
  const rinex = await loadModule()

  const detail = rinex.extractJobDetail(detailPages['Inside sales Strategist'], {
    title: 'Inside sales Strategist',
    locationText: 'Bengaluru / Mangaluru',
    sourceUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
    jobId: 'inside-sales-strategist',
    requisitionId: 'inside-sales-strategist',
  })

  assert.deepEqual(
    {
      title: detail.title,
      company: detail.company,
      location: detail.location,
      city: detail.city,
      state: detail.state,
      country: detail.country,
      jobId: detail.jobId,
      requisitionId: detail.requisitionId,
      sourceUrl: detail.sourceUrl,
      applyUrl: detail.applyUrl,
      employmentType: detail.employmentType,
      experienceRequired: detail.experienceRequired,
      remoteStatus: detail.remoteStatus,
    },
    {
      title: 'Inside sales Strategist',
      company: 'Rinex Technologies',
      location: 'Bengaluru / Mangaluru, Karnataka, India',
      city: null,
      state: 'Karnataka',
      country: 'India',
      jobId: 'inside-sales-strategist',
      requisitionId: 'inside-sales-strategist',
      sourceUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
      applyUrl: 'https://forms.gle/cux2RgfbTmroNJSx7',
      employmentType: null,
      experienceRequired: null,
      remoteStatus: 'On-site',
    },
  )
  assert.match(detail.jobDescription, /Overview:/i)
  assert.match(detail.jobDescription, /Opportunity:/i)
  assert.match(detail.jobDescription, /Responsibilities:/i)
  assert.match(detail.jobDescription, /Requirements:/i)
  assert.deepEqual(detail.requiredSkills, [])
})

test('Rinex Technologies API-only scraper falls back to listing metadata when a detail page is JavaScript-only', async () => {
  const rinex = await loadModule()

  const jobs = await rinex.createRinexTechnologiesScraper().run({
    fetchText: async (url) => {
      if (url === rinex.HOMEPAGE_URL) return homepageHtml
      if (url === 'https://rinex.ai/static/js/main.01193449.js') return bundleText
      if (url.startsWith('https://rinex.ai/job/')) {
        return '<html><body>You need to enable JavaScript to run this app.</body></html>'
      }

      throw new Error(`Unexpected Rinex Technologies URL: ${url}`)
    },
    maxJobs: 1,
    now: () => '2026-07-11T11:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Inside sales Strategist',
      company: 'Rinex Technologies',
      department: null,
      location: 'Bengaluru / Mangaluru, Karnataka, India',
      city: null,
      state: 'Karnataka',
      country: 'India',
      jobId: 'inside-sales-strategist',
      requisitionId: 'inside-sales-strategist',
      sourceUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
      applyUrl: 'https://rinex.ai/job/Inside%20sales%20Strategist',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply via the Rinex Technologies job page.',
      remoteStatus: 'On-site',
      source: 'rinextechnologies',
      link: 'https://rinex.ai/job/Inside%20sales%20Strategist',
      companyCareerPage: 'https://rinex.ai/career',
      companyDomain: 'rinex.ai',
      atsPlatform: 'official-company-careers',
      scrapedAt: '2026-07-11T11:00:00.000Z',
    },
  ])
})

test('Rinex Technologies run verifies the official shell and bundle, then decorates all current openings', async () => {
  const rinex = await loadModule()
  const requestedUrls = []

  const jobs = await rinex.createRinexTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === rinex.HOMEPAGE_URL) return homepageHtml
      if (url === 'https://rinex.ai/static/js/main.01193449.js') return bundleText

      const page = Object.entries(detailPages).find(
        ([title]) => url === rinex.buildJobUrl(title),
      )?.[1]

      if (page) return page

      throw new Error(`Unexpected Rinex Technologies URL: ${url}`)
    },
    now: () => '2026-07-11T11:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    rinex.HOMEPAGE_URL,
    'https://rinex.ai/static/js/main.01193449.js',
    'https://rinex.ai/job/Inside%20sales%20Strategist',
    'https://rinex.ai/job/Talent%20Acquisition',
    'https://rinex.ai/job/Corporate%20Relations',
    'https://rinex.ai/job/Operation%20Specialist',
  ])

  assert.equal(jobs.length, 4)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      source: job.source,
      company: job.company,
      link: job.link,
      companyCareerPage: job.companyCareerPage,
      companyDomain: job.companyDomain,
      atsPlatform: job.atsPlatform,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Inside sales Strategist',
        source: 'rinextechnologies',
        company: 'Rinex Technologies',
        link: 'https://forms.gle/cux2RgfbTmroNJSx7',
        companyCareerPage: 'https://rinex.ai/career',
        companyDomain: 'rinex.ai',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T11:00:00.000Z',
      },
      {
        title: 'Talent Acquisition',
        source: 'rinextechnologies',
        company: 'Rinex Technologies',
        link: 'https://forms.gle/talent-acquisition',
        companyCareerPage: 'https://rinex.ai/career',
        companyDomain: 'rinex.ai',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T11:00:00.000Z',
      },
      {
        title: 'Corporate Relations',
        source: 'rinextechnologies',
        company: 'Rinex Technologies',
        link: 'https://forms.gle/corporate-relations',
        companyCareerPage: 'https://rinex.ai/career',
        companyDomain: 'rinex.ai',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T11:00:00.000Z',
      },
      {
        title: 'Operation Specialist',
        source: 'rinextechnologies',
        company: 'Rinex Technologies',
        link: 'https://forms.gle/operation-specialist',
        companyCareerPage: 'https://rinex.ai/career',
        companyDomain: 'rinex.ai',
        atsPlatform: 'official-company-careers',
        scrapedAt: '2026-07-11T11:00:00.000Z',
      },
    ],
  )
})

test('Rinex Technologies fails closed when the verified bundle or detail page drifts', async () => {
  const rinex = await loadModule()

  await assert.rejects(
    rinex.createRinexTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === rinex.HOMEPAGE_URL) return homepageHtml
        if (url === 'https://rinex.ai/static/js/main.01193449.js') {
          return bundleText.replace('Rinex Technologies Private Limited', 'Rinex Careers')
        }

        throw new Error(`Unexpected Rinex Technologies URL: ${url}`)
      },
    }),
    /verified Rinex Technologies jobs bundle/i,
  )

  await assert.rejects(
    rinex.createRinexTechnologiesScraper().run({
      fetchText: async (url) => {
        if (url === rinex.HOMEPAGE_URL) return homepageHtml
        if (url === 'https://rinex.ai/static/js/main.01193449.js') return bundleText
        if (url === 'https://rinex.ai/job/Inside%20sales%20Strategist') {
          return detailPages['Inside sales Strategist'].replace('Apply for this Role', 'Request Information')
        }

        const page = Object.entries(detailPages).find(
          ([title]) => url === rinex.buildJobUrl(title),
        )?.[1]

        if (page) return page

        throw new Error(`Unexpected Rinex Technologies URL: ${url}`)
      },
    }),
    /verified Rinex Technologies job detail/i,
  )
})
