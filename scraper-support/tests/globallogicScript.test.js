import assert from 'node:assert/strict'
import test from 'node:test'

const loadGlobalLogicModule = async () => {
  try {
    return await import('../../scraper/globallogic/script.js')
  } catch {
    assert.fail('Expected GlobalLogic scraper module at ../../scraper/globallogic/script.js')
  }
}

const searchPageOneHtml = `
  <html>
    <body>
      <section class="open-roles">
        <a class="job-card" href="https://www.globallogic.com/careers/aws-devops-lead-irc299563/">
          <span class="job-country">India</span>
          <span class="job-city">Noida</span>
          <span class="job-work-model">Hybrid</span>
          <h3 class="job-title">AWS DevOps Lead IRC299563</h3>
          <p class="job-function">IT, Telecom &amp; Internet Generalists</p>
          <p class="job-experience">5-10 years</p>
          <p class="job-date">Published on 7 July 2026</p>
        </a>
        <a class="job-card" href="https://www.globallogic.com/careers/platform-engineer-ai-systems-infrastructure-irc299414/">
          <span class="job-country">United States</span>
          <span class="job-city">Seattle WA</span>
          <span class="job-work-model">Remote</span>
          <h3 class="job-title">Platform Engineer - AI Systems / Infrastructure IRC299414</h3>
          <p class="job-function">Software Product Engineering</p>
          <p class="job-experience">5-10 years</p>
          <p class="job-date">Published on 8 July 2026</p>
        </a>
      </section>
      <nav class="pagination">
        <a href="/career-search-page/page/2/">Next &raquo;</a>
      </nav>
    </body>
  </html>
`

const searchPageTwoHtml = `
  <html>
    <body>
      <section class="open-roles">
        <a class="job-card" href="https://www.globallogic.com/careers/technical-manager-genai-agentic-ai-platforms-irc298526/">
          <span class="job-country">India</span>
          <span class="job-city">Hyderabad</span>
          <span class="job-work-model">Hybrid</span>
          <h3 class="job-title">Technical Manager - GenAI & Agentic AI Platforms IRC298526</h3>
          <p class="job-function">General Artificial Intelligence</p>
          <p class="job-experience">10-15 years</p>
          <p class="job-date">Published on 6 July 2026</p>
        </a>
      </section>
    </body>
  </html>
`

const currentSearchPageHtml = `
  <html>
    <body>
      <div class="career_filter_result bhavin123">
        <a href="https://www.globallogic.com/careers/aidlc-engineer-fde-irc296096-4/" class="job_box">
          <div class="top_area">
            <span class="job_location">Croatia</span>
            <span class="job_tag">Hybrid</span>
          </div>
          <h4>AIDLC Engineer/FDE IRC296096</h4>
        </a>
        <a href="https://www.globallogic.com/careers/technical-support-engineer-irc300798/" class="job_box">
          <div class="top_area">
            <span class="job_location">India</span>
            <span class="job_location">Nagpur</span>
            <span class="job_tag">On-site</span>
          </div>
          <h4>Technical Support Engineer IRC300798</h4>
        </a>
      </div>
      <div class="pagination_area">
        <div class="pagination">
          <span aria-current="page" class="page-numbers current">1</span>
          <a class="page-numbers" href="https://www.globallogic.com/career-search-page/page/2/">2</a>
          <a class="next page-numbers" href="https://www.globallogic.com/career-search-page/page/2/">Next »</a>
        </div>
      </div>
    </body>
  </html>
`

const awsDevopsLeadDetailHtml = `
  <html>
    <head>
      <link rel="canonical" href="https://www.globallogic.com/careers/aws-devops-lead-irc299563/" />
    </head>
    <body>
      <p>Published on 7 July 2026</p>
      <h1>AWS DevOps Lead IRC299563</h1>
      <div class="job-overview">
        <section>
          <h2>Function</h2>
          <p>IT, Telecom &amp; Internet Generalists</p>
        </section>
        <section>
          <h2>Experience</h2>
          <p>5-10 years</p>
        </section>
        <section>
          <h2>Location</h2>
          <p>India - Noida</p>
        </section>
        <section>
          <h2>Skills</h2>
          <p>Ansible, Architecture, AWS, Jenkins, Python, Terraform</p>
        </section>
        <section>
          <h2>Work Model</h2>
          <p>Hybrid</p>
        </section>
      </div>
      <section>
        <h2>Description</h2>
        <p>Job Summary</p>
        <p>We are looking for an experienced AWS DevOps Technical Architect to design, implement, and manage enterprise-scale cloud infrastructure on AWS.</p>
      </section>
      <section>
        <h2>Requirements</h2>
        <ul>
          <li>Bachelor's Degree in Computer Science, Information Technology, or a related field.</li>
          <li>Minimum 5+ years of hands-on experience in AWS DevOps.</li>
        </ul>
      </section>
      <section>
        <h2>Job responsibilities</h2>
        <ul>
          <li>Design and implement scalable AWS infrastructure.</li>
          <li>Develop and maintain Infrastructure as Code.</li>
        </ul>
      </section>
    </body>
  </html>
`

const technicalManagerDetailHtml = `
  <html>
    <head>
      <link rel="canonical" href="https://www.globallogic.com/careers/technical-manager-genai-agentic-ai-platforms-irc298526/" />
    </head>
    <body>
      <p>Published on 6 July 2026</p>
      <h1>Technical Manager - GenAI & Agentic AI Platforms IRC298526</h1>
      <div class="job-overview">
        <section>
          <h2>Function</h2>
          <p>General Artificial Intelligence</p>
        </section>
        <section>
          <h2>Experience</h2>
          <p>10-15 years</p>
        </section>
        <section>
          <h2>Location</h2>
          <p>India - Hyderabad</p>
        </section>
        <section>
          <h2>Skills</h2>
          <p>GenAI, LLMs, Platform Engineering</p>
        </section>
      </div>
      <section>
        <h2>Description</h2>
        <p>Lead platform strategy for enterprise GenAI programs.</p>
      </section>
      <section>
        <h2>Requirements</h2>
        <ul>
          <li>Bachelor's degree in Engineering or Computer Science.</li>
        </ul>
      </section>
    </body>
  </html>
`

const currentTechnicalSupportDetailHtml = `
  <html>
    <head>
      <link rel="canonical" href="https://www.globallogic.com/careers/technical-support-engineer-irc300798/" />
    </head>
    <body>
      <div class="career_detail_banner_right">
        <div class="career_banner_sub_head">Published on 31 July 2026</div>
        <h1>Technical Support Engineer IRC300798</h1>
        <div class="row">
          <div class="col-4 career_banner_details">
            <span>Experience</span>
            <p>3-5 years</p>
          </div>
          <div class="col-4 career_banner_details">
            <span>Location</span>
            <p>India - Nagpur</p>
          </div>
        </div>
      </div>
      <div class="career_detail_content">
        <h4>Description</h4>
        <p>Technical Support Engineer - AI/ML</p>
        <p>1+ years of experience in AI/ML technologies, LLM models, and any Cloud platform. Candidates should have experience in Technical Support and fair knowledge of SQL.</p>
        <h4>Requirements</h4>
        <p>Bachelor's degree in Computer Science or a related discipline and/or equivalent.<br />0-1 years of troubleshooting experience on cloud or hybrid cloud environments.<br />Excellent communication skills.</p>
        <h4>Job responsibilities</h4>
        <p>Engage with customers via email, chat, or phone to diagnose and resolve support queries.<br />Document issues and provide clear assessments for complex product bugs.</p>
      </div>
    </body>
  </html>
`

const incapsulaLoadingShellHtml = `
  <html>
    <head>
      <title>Loading</title>
    </head>
    <body bgcolor="#ffffff">
      <h3 style="color:#ffffff">Loading</h3>
    </body>
  </html>
`

const incapsulaIframeChallengeHtml = `
  <html style="height:100%">
    <head>
      <meta name="robots" content="NOINDEX, NOFOLLOW" />
      <meta http-equiv="X-UA-Compatible" content="IE=edge,chrome=1" />
      <script type="text/javascript" src="/_Incapsula_Resource?SWJIYLWA=719d34d31c8e3a6e6fffd425f7e032f3"></script>
    </head>
    <body style="margin:0px;height:100%">
      <iframe
        id="main-iframe"
        src="/_Incapsula_Resource?CWUDNSAI=23&incident_id=2702000450106232523-22502042510429024&edet=15"
        frameborder="0"
        width="100%"
        height="100%"
      >
        Request unsuccessful. Incapsula incident ID: 2702000450106232523-22502042510429024
      </iframe>
    </body>
  </html>
`

test('buildSearchPageUrl keeps GlobalLogic on the official paginated careers route', async () => {
  const {
    CAREERS_PAGE_URL,
    SEARCH_PAGE_URL,
    buildSearchPageUrl,
    hasNextSearchPage,
  } = await loadGlobalLogicModule()

  assert.equal(CAREERS_PAGE_URL, 'https://www.globallogic.com/careers/')
  assert.equal(SEARCH_PAGE_URL, 'https://www.globallogic.com/career-search-page/')
  assert.equal(buildSearchPageUrl(), 'https://www.globallogic.com/career-search-page/')
  assert.equal(buildSearchPageUrl(2), 'https://www.globallogic.com/career-search-page/page/2/')
  assert.equal(hasNextSearchPage(searchPageOneHtml), true)
  assert.equal(hasNextSearchPage(searchPageTwoHtml), false)
})

test('extractSearchResults maps GlobalLogic India cards into the shared scraper fields', async () => {
  const { extractSearchResults } = await loadGlobalLogicModule()
  const jobs = extractSearchResults(searchPageOneHtml)

  assert.equal(jobs.length, 1)
  assert.deepEqual(jobs[0], {
    title: 'AWS DevOps Lead',
    company: 'GlobalLogic',
    department: 'IT, Telecom & Internet Generalists',
    location: 'India - Noida',
    city: 'Noida',
    country: 'India',
    jobId: 'IRC299563',
    requisitionId: 'IRC299563',
    sourceUrl: 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/',
    applyUrl: 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/',
    employmentType: null,
    experienceRequired: '5-10 years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-07-07',
    closingDate: null,
    jobDescription: null,
  })
})

test('extractSearchResults also supports the current GlobalLogic job_box listing markup', async () => {
  const { extractSearchResults, hasNextSearchPage } = await loadGlobalLogicModule()
  const jobs = extractSearchResults(currentSearchPageHtml)

  assert.equal(hasNextSearchPage(currentSearchPageHtml), true)
  assert.deepEqual(jobs, [
    {
      title: 'Technical Support Engineer',
      company: 'GlobalLogic',
      department: null,
      location: 'India - Nagpur',
      city: 'Nagpur',
      country: 'India',
      jobId: 'IRC300798',
      requisitionId: 'IRC300798',
      sourceUrl: 'https://www.globallogic.com/careers/technical-support-engineer-irc300798/',
      applyUrl: 'https://www.globallogic.com/careers/technical-support-engineer-irc300798/',
      employmentType: null,
      experienceRequired: null,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: null,
    },
  ])
})

test('extractJobDetail enriches a GlobalLogic listing from the official detail page', async () => {
  const { extractJobDetail, extractSearchResults } = await loadGlobalLogicModule()
  const listing = extractSearchResults(searchPageOneHtml)[0]
  const job = extractJobDetail(awsDevopsLeadDetailHtml, listing)

  assert.equal(job.title, 'AWS DevOps Lead')
  assert.equal(job.company, 'GlobalLogic')
  assert.equal(job.department, 'IT, Telecom & Internet Generalists')
  assert.equal(job.location, 'India - Noida')
  assert.equal(job.city, 'Noida')
  assert.equal(job.country, 'India')
  assert.equal(job.jobId, 'IRC299563')
  assert.equal(job.requisitionId, 'IRC299563')
  assert.equal(job.sourceUrl, 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/')
  assert.equal(job.applyUrl, 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/')
  assert.equal(job.employmentType, null)
  assert.equal(job.experienceRequired, '5-10 years')
  assert.equal(
    job.minimumQualification,
    "Bachelor's Degree in Computer Science, Information Technology, or a related field.",
  )
  assert.equal(job.preferredQualification, null)
  assert.deepEqual(job.requiredSkills, [
    'Ansible',
    'Architecture',
    'AWS',
    'Jenkins',
    'Python',
    'Terraform',
  ])
  assert.equal(job.postingDate, '2026-07-07')
  assert.equal(job.closingDate, null)
  assert.match(job.jobDescription, /experienced AWS DevOps Technical Architect/i)
  assert.match(job.jobDescription, /Design and implement scalable AWS infrastructure/i)
})

test('extractJobDetail supports the current GlobalLogic detail markup with banner fields and h4 sections', async () => {
  const { extractJobDetail, extractSearchResults } = await loadGlobalLogicModule()
  const listing = extractSearchResults(currentSearchPageHtml)[0]
  const job = extractJobDetail(currentTechnicalSupportDetailHtml, listing)

  assert.equal(job.title, 'Technical Support Engineer')
  assert.equal(job.location, 'India - Nagpur')
  assert.equal(job.city, 'Nagpur')
  assert.equal(job.country, 'India')
  assert.equal(job.experienceRequired, '3-5 years')
  assert.equal(job.postingDate, '2026-07-31')
  assert.match(job.minimumQualification || '', /Bachelor's degree/i)
  assert.match(job.jobDescription || '', /AI\/ML/i)
  assert.match(job.jobDescription || '', /diagnose and resolve support queries/i)
})

test('run paginates the official GlobalLogic search pages and decorates shared runner fields', async () => {
  const { buildSearchPageUrl, createGlobalLogicScraper } = await loadGlobalLogicModule()
  const requestedUrls = []
  const scraper = createGlobalLogicScraper({ maxJobs: 2, maxPages: 2 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === buildSearchPageUrl(1)) return searchPageOneHtml
      if (url === buildSearchPageUrl(2)) return searchPageTwoHtml
      if (url === 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/') {
        return awsDevopsLeadDetailHtml
      }
      if (url === 'https://www.globallogic.com/careers/technical-manager-genai-agentic-ai-platforms-irc298526/') {
        return technicalManagerDetailHtml
      }

      throw new Error(`Unexpected GlobalLogic URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    buildSearchPageUrl(1),
    'https://www.globallogic.com/careers/aws-devops-lead-irc299563/',
    buildSearchPageUrl(2),
    'https://www.globallogic.com/careers/technical-manager-genai-agentic-ai-platforms-irc298526/',
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'globallogic')
  assert.equal(jobs[0].company, 'GlobalLogic')
  assert.equal(jobs[0].link, 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/')
  assert.equal(jobs[0].title, 'AWS DevOps Lead')
  assert.equal(jobs[1].title, 'Technical Manager - GenAI & Agentic AI Platforms')
  assert.equal(jobs[1].city, 'Hyderabad')
})

test('run bounds default GlobalLogic fetches with abort signals', async () => {
  const { CAREERS_PAGE_URL, buildSearchPageUrl, createGlobalLogicScraper } = await loadGlobalLogicModule()
  const originalFetch = globalThis.fetch
  const requests = []

  globalThis.fetch = async (url, init = {}) => {
    requests.push({ url: String(url), signal: init.signal })

    if (url === CAREERS_PAGE_URL) {
      return { ok: true, status: 200, text: async () => '<html><body>Careers at GlobalLogic</body></html>' }
    }
    if (url === buildSearchPageUrl(1)) {
      return { ok: true, status: 200, text: async () => searchPageOneHtml }
    }
    if (url === 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/') {
      return { ok: true, status: 200, text: async () => awsDevopsLeadDetailHtml }
    }

    assert.fail(`Unexpected GlobalLogic URL: ${url}`)
  }

  try {
    const jobs = await createGlobalLogicScraper({ maxJobs: 1, maxPages: 1 }).run()

    assert.equal(jobs.length, 1)
    assert.ok(requests.every((request) => request.signal), 'each fetch should include an abort signal')
    assert.ok(requests.every((request) => typeof request.signal.aborted === 'boolean'))
  } finally {
    globalThis.fetch = originalFetch
  }
})

test('run falls back to browser text when GlobalLogic blocks direct HTTP fetches', async () => {
  const { buildSearchPageUrl, createGlobalLogicScraper } = await loadGlobalLogicModule()
  const directRequests = []
  const browserRequests = []

  const jobs = await createGlobalLogicScraper({ maxJobs: 1, maxPages: 1 }).run({
    fetchText: async (url) => {
      directRequests.push(url)
      throw new Error(`HTTP 403 for ${url}`)
    },
    fetchBrowserText: async (url) => {
      browserRequests.push(url)

      if (url === buildSearchPageUrl(1)) return searchPageOneHtml
      if (url === 'https://www.globallogic.com/careers/aws-devops-lead-irc299563/') {
        return awsDevopsLeadDetailHtml
      }

      throw new Error(`Unexpected GlobalLogic browser URL: ${url}`)
    },
  })

  assert.deepEqual(directRequests, [
    buildSearchPageUrl(1),
    'https://www.globallogic.com/careers/aws-devops-lead-irc299563/',
  ])
  assert.deepEqual(browserRequests, directRequests)
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'AWS DevOps Lead')
  assert.equal(jobs[0].city, 'Noida')
})

test('run returns an honest empty result when the official GlobalLogic careers routes are gated by the verified Incapsula challenge', async () => {
  const {
    CAREERS_PAGE_URL,
    buildSearchPageUrl,
    createGlobalLogicScraper,
  } = await loadGlobalLogicModule()

  const requestedUrls = []
  const jobs = await createGlobalLogicScraper({ maxJobs: 1, maxPages: 1 }).run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === CAREERS_PAGE_URL) {
        return {
          status: 302,
          url,
          headers: {
            location: CAREERS_PAGE_URL,
            'set-cookie': [
              'visid_incap_1279438=abc; path=/; HttpOnly',
              'incap_ses_2702_1279438=def; path=/',
            ],
          },
          html: incapsulaLoadingShellHtml,
        }
      }

      if (url === buildSearchPageUrl(1)) {
        return {
          status: 403,
          url,
          headers: {},
          html: incapsulaIframeChallengeHtml,
        }
      }

      throw new Error(`Unexpected GlobalLogic page URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    CAREERS_PAGE_URL,
  ])
  assert.deepEqual(jobs, [])
})
