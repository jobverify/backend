import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-16T12:00:00.000Z'

const officialCareersHtml = `
  <html lang="en">
    <head>
      <meta name="title" content="Careers at Khatabook | Khatabook Jobs | Latest Khatabook Openings">
      <meta property="og:title" content="Careers at Khatabook | Khatabook Jobs | Latest Khatabook Openings">
      <link rel="canonical" href="https://khatabook.com/hiring/" />
    </head>
    <body>
      <main>
        <h1>Search for a Job</h1>
        <input class="input-margin" type="radio" id="all" name="locations" value="all" checked>
        <span class="nav-link category-item-bar noselect" id="Finance">Finance (3)</span>
        <span class="nav-link category-item-bar noselect" id="Technology">Technology (2)</span>
        <span class="nav-link category-item-bar noselect" id="Product &amp; Design">Product &amp; Design (3)</span>
        <a class="btn" id="view-openings-btn" href="#openings">View Openings</a>
      </main>
      <script src="https://khatabook-assets.s3.amazonaws.com/static/js/hiring.js"></script>
    </body>
  </html>
`

const careersScriptJs = `
  methods.fetchJobs = function(url, cat, index) {
    $.ajax({
      type: "GET",
      url: url,
      headers: {
        'X-CSRFToken': getCookie('csrftoken')
      },
      success: function (response) {
        methods.distributeJobs(response.data.Jobs ?? []);
      },
      dataType: 'json'
    });
  }

  methods.onPageLoad = function() {
    let category = $(".category-item-bar")
    for (var i = 0; i < category.length; i++) {
      let url = '/hiring/recruiter/list?';
      cat = $(".category-item-bar")[i].id
      url += 'category=' + encodeURIComponent(cat)
      methods.fetchJobs(url, cat, i, false)
    }
  }
`

const financePayload = {
  data: {
    Jobs: [
      {
        JobId: 'bc4ea500-e008-4b32-87dd-ed04fc9d50e5',
        JobTitle: 'Senior Executive - Corporate Finance',
        JobDescriptionV2: '<p>Lead finance operations for lending programs.</p>',
        JobCode: 'K-82606',
        Department: 'Finance',
        Location: '[{"Address":"Bengaluru, Karnataka, India","PlaceId":null}]',
        Experience: {
          MinExp: 3,
          MaxExp: 4,
        },
        JobType: 'Full Time',
        CompanyName: 'Khatabook',
        ApplyUrl: 'https://khatabook.turbohire.co/job/publicjobs/bc4ea500-e008-4b32-87dd-ed04fc9d50e5?utm_source=CareerPage',
        Skills: ['Ind AS', 'Audit'],
        PublishedDate: '2026-07-09T08:22:32.712994Z',
        PromotionExpiryDate: '2026-08-31T18:29:00.555Z',
      },
    ],
  },
}

const technologyPayload = {
  data: {
    Jobs: [
      {
        JobId: '6d4f830d-41b7-4ba4-9c00-32cb95156040',
        JobTitle: 'SDET - II',
        JobDescriptionV2: '<p>Build test automation for merchant products.</p>',
        JobCode: 'K-10001',
        Department: 'Technology',
        Location: '[{"Address":"Bangalore, Karnataka, India","PlaceId":null}]',
        Experience: {
          MinExp: 2,
          MaxExp: 5,
        },
        JobType: 'Full Time',
        CompanyName: 'Khatabook',
        ApplyUrl: 'https://khatabook.turbohire.co/job/publicjobs/6d4f830d-41b7-4ba4-9c00-32cb95156040?utm_source=CareerPage',
        Skills: ['Testing', 'Automation'],
        PublishedDate: '2026-07-02T09:41:11.8490871Z',
        PromotionExpiryDate: null,
      },
      {
        JobId: '002254b9-de96-4a4a-8d5b-2250cf360f34',
        JobTitle: 'Full Stack developer - SDE II ',
        JobDescriptionV2: '<p>Ship full-stack features for internal platforms.</p>',
        JobCode: 'K-10002',
        Department: 'Technology',
        Location: '[{"Address":"Bangalore, Karnataka, India","PlaceId":null}]',
        Experience: {
          MinExp: 3,
          MaxExp: 6,
        },
        JobType: 'Full Time',
        CompanyName: 'Khatabook',
        ApplyUrl: 'https://khatabook.turbohire.co/job/publicjobs/002254b9-de96-4a4a-8d5b-2250cf360f34?utm_source=CareerPage',
        Skills: ['Java', 'React'],
        PublishedDate: '2026-07-11T05:50:16.2899365Z',
        PromotionExpiryDate: null,
      },
    ],
  },
}

const productPayload = {
  data: {
    Jobs: [
      {
        JobId: '4a34c640-c6bd-4671-8fb4-f5c9d600f999',
        JobTitle: 'Senior Product Designer',
        JobDescriptionV2: '<p>Lead design systems and customer journeys.</p>',
        JobCode: 'K-20001',
        Department: 'Product & Design',
        Location: '[{"Address":"Bangalore, Karnataka, India","PlaceId":null}]',
        Experience: {
          MinExp: 4,
          MaxExp: 7,
        },
        JobType: 'Full Time',
        CompanyName: 'Khatabook',
        ApplyUrl: 'https://khatabook.turbohire.co/job/publicjobs/4a34c640-c6bd-4671-8fb4-f5c9d600f999?utm_source=CareerPage',
        Skills: ['Figma', 'Systems Thinking'],
        PublishedDate: '2026-06-11T07:20:25.053583Z',
        PromotionExpiryDate: null,
      },
    ],
  },
}

const loadKhatabookModule = async () => {
  try {
    return await import('../../scraper/khatabook/script.js')
  } catch {
    assert.fail('Expected Khatabook scraper module at ../../scraper/khatabook/script.js')
  }
}

test('Khatabook pins the verified first-party careers page, jobs script, and helper contracts', async () => {
  const khatabook = await loadKhatabookModule()

  assert.equal(khatabook.SOURCE, 'khatabook')
  assert.equal(khatabook.COMPANY_NAME, 'Khatabook')
  assert.equal(khatabook.OFFICIAL_BRAND_NAME, 'Khatabook')
  assert.equal(khatabook.HOMEPAGE_URL, 'https://khatabook.com/')
  assert.equal(khatabook.OFFICIAL_CAREERS_URL, 'https://khatabook.com/en/hiring/')
  assert.equal(khatabook.CAREERS_SCRIPT_URL, 'https://khatabook-assets.s3.amazonaws.com/static/js/hiring.js')
  assert.equal(khatabook.CATEGORY_JOBS_API_BASE_URL, 'https://khatabook.com/hiring/recruiter/list')
  assert.equal(khatabook.TURBOHIRE_HOST, 'https://khatabook.turbohire.co')
  assert.equal(khatabook.VERIFIED_ON, '2026-07-16')
  assert.equal(khatabook.hasOfficialCareersSignal(officialCareersHtml), true)
  assert.equal(khatabook.hasOfficialCareersSignal('<html><head><title>Jobs</title></head><body>Careers</body></html>'), false)
  assert.deepEqual(khatabook.extractCategoryIds(officialCareersHtml), [
    'Finance',
    'Technology',
    'Product & Design',
  ])
  assert.equal(khatabook.hasOfficialJobsScriptSignal(careersScriptJs), true)
  assert.equal(
    khatabook.hasOfficialJobsScriptSignal('console.log("no verified careers endpoint here")'),
    false,
  )
  assert.equal(
    khatabook.buildCategoryJobsUrl('Product & Design'),
    'https://khatabook.com/hiring/recruiter/list?category=Product%20%26%20Design',
  )
  assert.deepEqual(khatabook.extractJobsFromCategoryPayload(financePayload), financePayload.data.Jobs)
})

test('extractSearchResults normalizes Khatabook jobs from the first-party category payloads', async () => {
  const khatabook = await loadKhatabookModule()

  assert.deepEqual(
    khatabook.extractSearchResults([
      ...financePayload.data.Jobs,
      ...technologyPayload.data.Jobs,
      ...productPayload.data.Jobs,
    ]),
    [
      {
        title: 'Senior Executive - Corporate Finance',
        company: 'Khatabook',
        department: 'Finance',
        location: 'Bengaluru, Karnataka, India',
        city: 'Bengaluru',
        country: 'India',
        jobId: 'bc4ea500-e008-4b32-87dd-ed04fc9d50e5',
        requisitionId: 'K-82606',
        sourceUrl: 'https://khatabook.turbohire.co/job/publicjobs/bc4ea500-e008-4b32-87dd-ed04fc9d50e5?utm_source=CareerPage',
        applyUrl: 'https://khatabook.turbohire.co/job/publicjobs/bc4ea500-e008-4b32-87dd-ed04fc9d50e5?utm_source=CareerPage',
        employmentType: 'Full Time',
        experienceRequired: '3-4 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Ind AS', 'Audit'],
        postingDate: '2026-07-09T08:22:32.712994Z',
        closingDate: '2026-08-31T18:29:00.555Z',
        jobDescription: 'Lead finance operations for lending programs.',
      },
      {
        title: 'SDET - II',
        company: 'Khatabook',
        department: 'Technology',
        location: 'Bangalore, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '6d4f830d-41b7-4ba4-9c00-32cb95156040',
        requisitionId: 'K-10001',
        sourceUrl: 'https://khatabook.turbohire.co/job/publicjobs/6d4f830d-41b7-4ba4-9c00-32cb95156040?utm_source=CareerPage',
        applyUrl: 'https://khatabook.turbohire.co/job/publicjobs/6d4f830d-41b7-4ba4-9c00-32cb95156040?utm_source=CareerPage',
        employmentType: 'Full Time',
        experienceRequired: '2-5 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Testing', 'Automation'],
        postingDate: '2026-07-02T09:41:11.8490871Z',
        closingDate: null,
        jobDescription: 'Build test automation for merchant products.',
      },
      {
        title: 'Full Stack developer - SDE II',
        company: 'Khatabook',
        department: 'Technology',
        location: 'Bangalore, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '002254b9-de96-4a4a-8d5b-2250cf360f34',
        requisitionId: 'K-10002',
        sourceUrl: 'https://khatabook.turbohire.co/job/publicjobs/002254b9-de96-4a4a-8d5b-2250cf360f34?utm_source=CareerPage',
        applyUrl: 'https://khatabook.turbohire.co/job/publicjobs/002254b9-de96-4a4a-8d5b-2250cf360f34?utm_source=CareerPage',
        employmentType: 'Full Time',
        experienceRequired: '3-6 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Java', 'React'],
        postingDate: '2026-07-11T05:50:16.2899365Z',
        closingDate: null,
        jobDescription: 'Ship full-stack features for internal platforms.',
      },
      {
        title: 'Senior Product Designer',
        company: 'Khatabook',
        department: 'Product & Design',
        location: 'Bangalore, Karnataka, India',
        city: 'Bangalore',
        country: 'India',
        jobId: '4a34c640-c6bd-4671-8fb4-f5c9d600f999',
        requisitionId: 'K-20001',
        sourceUrl: 'https://khatabook.turbohire.co/job/publicjobs/4a34c640-c6bd-4671-8fb4-f5c9d600f999?utm_source=CareerPage',
        applyUrl: 'https://khatabook.turbohire.co/job/publicjobs/4a34c640-c6bd-4671-8fb4-f5c9d600f999?utm_source=CareerPage',
        employmentType: 'Full Time',
        experienceRequired: '4-7 years',
        minimumQualification: null,
        preferredQualification: null,
        requiredSkills: ['Figma', 'Systems Thinking'],
        postingDate: '2026-06-11T07:20:25.053583Z',
        closingDate: null,
        jobDescription: 'Lead design systems and customer journeys.',
      },
    ],
  )
})

test('run validates the official Khatabook surface and returns normalized jobs from category feeds', async () => {
  const khatabook = await loadKhatabookModule()
  const requestedUrls = []

  const jobs = await khatabook.createKhatabookScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      requestedUrls.push({ type: 'text', url })
      if (url === khatabook.OFFICIAL_CAREERS_URL) return officialCareersHtml
      if (url === khatabook.CAREERS_SCRIPT_URL) return careersScriptJs
      throw new Error(`Unexpected Khatabook text URL: ${url}`)
    },
    fetchJson: async (url) => {
      requestedUrls.push({ type: 'json', url })
      if (url === khatabook.buildCategoryJobsUrl('Finance')) return financePayload
      if (url === khatabook.buildCategoryJobsUrl('Technology')) return technologyPayload
      if (url === khatabook.buildCategoryJobsUrl('Product & Design')) return productPayload
      throw new Error(`Unexpected Khatabook json URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    { type: 'text', url: khatabook.OFFICIAL_CAREERS_URL },
    { type: 'text', url: khatabook.CAREERS_SCRIPT_URL },
    { type: 'json', url: khatabook.buildCategoryJobsUrl('Finance') },
    { type: 'json', url: khatabook.buildCategoryJobsUrl('Technology') },
    { type: 'json', url: khatabook.buildCategoryJobsUrl('Product & Design') },
  ])
  assert.equal(jobs.length, 4)
  assert.equal(jobs[0].source, 'khatabook')
  assert.equal(jobs[0].company, 'Khatabook')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
  assert.equal(jobs[0].scrapedAt, FIXED_SCRAPED_AT)
  assert.equal(jobs[3].title, 'Senior Product Designer')
})

test('Khatabook fails closed when the official page or hiring script drifts', async () => {
  const khatabook = await loadKhatabookModule()

  await assert.rejects(
    khatabook.createKhatabookScraper().run({
      fetchText: async (url) => {
        if (url === khatabook.OFFICIAL_CAREERS_URL) {
          return '<html><head><title>Jobs</title></head><body><h1>Apply now</h1></body></html>'
        }
        return careersScriptJs
      },
      fetchJson: async () => financePayload,
    }),
    /verified official careers page/i,
  )

  await assert.rejects(
    khatabook.createKhatabookScraper().run({
      fetchText: async (url) => {
        if (url === khatabook.OFFICIAL_CAREERS_URL) return officialCareersHtml
        return 'console.log("no first-party jobs endpoint")'
      },
      fetchJson: async () => financePayload,
    }),
    /verified hiring script/i,
  )
})
