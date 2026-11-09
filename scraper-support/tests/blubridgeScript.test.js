import assert from 'node:assert/strict'
import test from 'node:test'

import {
  CAREER_PAGE_URL,
  extractJobCards,
  extractJobDetail,
} from '../../scraper/blubridge/script.js'

const loadModule = async () => {
  try {
    return await import('../../scraper/blubridge/script.js')
  } catch {
    assert.fail('Expected Blubridge scraper module at ../../scraper/blubridge/script.js')
  }
}

const listingHtml = `
  <html>
    <body>
      <a class="job-row job-row-grid" href="/careers/job/administration-executive-male">
        <span>Administration Executive (Male)</span>
        <span>Operations</span>
        <span>Chennai</span>
      </a>
      <a class="job-row job-row-grid" href="https://blubridge.com/careers/job/ai-ml-engineer-freshers">
        <span>AI ML Engineer (Freshers)</span>
        <span>Engineering</span>
        <span>Chennai</span>
      </a>
      <a href="/contact">Contact</a>
    </body>
  </html>
`

const detailHtml = `
  <html>
    <head>
      <title>Administration Executive (Male) | Careers | BluBridge</title>
    </head>
    <body>
      <div>OPERATIONS • ADMINISTRATION</div>
      <h1>Administration Executive (Male)</h1>
      <div>Besant Nagar, Chennai</div>
      <div>0-2 Years</div>
      <div>3.5-5.5 Lacs P.A.</div>
      <div>VACANCIES</div>
      <div>7</div>
      <div>BATCH</div>
      <div>2024, 2025, 2026</div>
      <div>EMPLOYMENT</div>
      <div>Full Time</div>
      <div>About the Role</div>
      <p>We are seeking Administration Officers to manage administrative operations.</p>
      <div>Education</div>
      <p>Bachelor's or Master's degree in any discipline</p>
      <div>Key Responsibilities</div>
      <ul>
        <li>Oversee and manage end-to-end administrative operations</li>
        <li>Manage vendor lifecycle and procurement coordination</li>
      </ul>
      <div>Requirements</div>
      <ul>
        <li>Strong organizational and coordination abilities</li>
        <li>Excellent communication and reporting skills</li>
      </ul>
      <div>Skills</div>
      <span>Administration</span>
      <span>Office Management</span>
      <span>Vendor Coordination</span>
      <div>Ready to Join Our Team?</div>
    </body>
  </html>
`

const currentCareersShellHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Blubridge</title>
    <meta name="description" content="Join us to build the next frontier of AI. Bring your rigor, ownership, and engineering depth to solve hard, real-world problems.">
    <script defer="defer" src="/static/js/main.10737ee8.js"></script>
  </head>
  <body>
    <noscript>You need to enable JavaScript to run this app.</noscript>
    <div id="root"></div>
  </body>
</html>
`

const currentBundleText = `
Pd=[
  {id:1,title:"Data Science / AI ML Engineer",department:"Research & Development",team:"Core ML",location:"Chennai",slug:"data-science-ai-ml-engineer"},
  {id:2,title:"Business Development - AI Strategy & Partnerships",department:"Business Development",team:"Strategy",location:"Chennai",slug:"business-development-ai-strategy"}
],Md=[],
fu=[
  {
    id:"data-science-ai-ml-engineer",
    slug:"data-science-ai-ml-engineer",
    title:"Data Science / AI ML Engineer",
    department:"Research & Development",
    team:"Core ML",
    location:"Chennai (Mandaveli) On-site",
    experience:"0-1 Years",
    salary:"6-10 Lacs P.A. + ESOPs Eligibility",
    vacancies:12,
    batch:"2025, 2026",
    education:"Any Graduate",
    employmentType:"Full Time",
    description:"We are hiring Data Science / AI & ML Engineers (Freshers) to work on compiler frameworks, transformer-based infrastructures, and end-to-end AI pipelines.",
    responsibilities:["Design and develop compiler frameworks","Architect scalable transformer-based infrastructures"],
    requirements:["Strong proficiency in C, C++ or Java","Solid foundation in Mathematics"],
    addedAdvantage:["Experience or strong interest in compiler construction"],
    whyJoin:["A research-driven engineering environment"],
    skills:["AI","Machine Learning","C++","CUDA"]
  },
  {
    id:"business-development-ai-strategy",
    slug:"business-development-ai-strategy",
    title:"Business Development - AI Strategy & Partnerships",
    department:"Business Development",
    team:"Strategy",
    location:"Chennai",
    experience:"0-1 Years",
    salary:"5-7 Lacs P.A.",
    vacancies:15,
    education:"Bachelor's or Master's in Business, Computer Science, AI/ML, Economics, Mass Communication, or related fields",
    employmentType:"Full Time, Permanent",
    description:"This role sits at the intersection of technology, strategy, and global market development.",
    responsibilities:["Build relationships with enterprises","Support strategic partnerships"],
    requirements:["Strong communication and relationship-building skills","Ownership mindset"],
    addedAdvantage:["Exposure to consulting frameworks"],
    whyJoin:["Gain exposure to AI strategy"],
    skills:["Business Development","Artificial Intelligence","Lead Generation"]
  }
],bu={}
`

const quotedPlatformBundleText = `
fu=[
  {
    id:"social-media-growth-manager-ai-deep-tech",
    slug:"social-media-growth-manager-ai-deep-tech",
    title:"Social Media Growth Manager (AI / Deep Tech)",
    department:"Marketing & Communication",
    team:"Brand & Digital Growth",
    location:"Chennai",
    experience:"1-6 Years / Proven Social Media Growth Experience",
    education:"Graduation Not Required",
    employmentType:"Full Time",
    description:"Mandatory requirement: the candidate must satisfy at least one platform benchmark - X/Twitter: 500+ followers, YouTube: 10,000+ subscribers, Instagram: 25,000+ followers, or LinkedIn: 5,000+ followers.",
    responsibilities:["Plan and execute social media campaigns"],
    requirements:["Strong understanding of platform algorithms"],
    skills:["Social Media Marketing","YouTube","Instagram"]
  }
],bu={}
`

test('CAREER_PAGE_URL keeps the Blubridge scraper on the official careers page', () => {
  assert.equal(CAREER_PAGE_URL, 'https://blubridge.com/careers')
})

test('extractJobCards reads unique job rows from the Blubridge careers listing', () => {
  assert.deepEqual(extractJobCards(listingHtml), [
    {
      title: 'Administration Executive (Male)',
      department: 'Operations',
      location: 'Chennai',
      url: 'https://blubridge.com/careers/job/administration-executive-male',
    },
    {
      title: 'AI ML Engineer (Freshers)',
      department: 'Engineering',
      location: 'Chennai',
      url: 'https://blubridge.com/careers/job/ai-ml-engineer-freshers',
    },
  ])
})

test('extractJobDetail reads Blubridge job detail pages into scraper jobs', () => {
  assert.deepEqual(
    extractJobDetail(
      detailHtml,
      'https://blubridge.com/careers/job/administration-executive-male',
    ),
    {
      title: 'Administration Executive (Male)',
      company: 'Blubridge Technologies Pvt Ltd',
      department: 'Operations / Administration',
      location: 'Besant Nagar, Chennai',
      city: 'Chennai',
      jobId: 'administration-executive-male',
      requisitionId: null,
      sourceUrl: 'https://blubridge.com/careers/job/administration-executive-male',
      applyUrl: 'https://blubridge.com/careers/job/administration-executive-male',
      employmentType: 'Full Time',
      experienceRequired: '0-2 Years',
      minimumQualification: "Bachelor's or Master's degree in any discipline",
      preferredQualification: null,
      requiredSkills: [
        'Administration',
        'Office Management',
        'Vendor Coordination',
      ],
      postingDate: null,
      closingDate: null,
      jobDescription: [
        'About the Role: We are seeking Administration Officers to manage administrative operations.',
        "Education: Bachelor's or Master's degree in any discipline",
        'Key Responsibilities: Oversee and manage end-to-end administrative operations; Manage vendor lifecycle and procurement coordination',
        'Requirements: Strong organizational and coordination abilities; Excellent communication and reporting skills',
      ].join('\n'),
    },
  )
})

test('Blubridge reads the current React careers bundle without launching a browser', async () => {
  const blubridge = await loadModule()
  const requestedUrls = []
  const bundleUrl = 'https://blubridge.com/static/js/main.10737ee8.js'

  assert.equal(blubridge.extractMainBundleUrl(currentCareersShellHtml), bundleUrl)

  const jobs = await blubridge.createBlubridgeScraper({
    now: () => '2026-08-07T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === blubridge.CAREER_PAGE_URL) {
        return currentCareersShellHtml
      }

      if (url === bundleUrl) {
        return currentBundleText
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    blubridge.CAREER_PAGE_URL,
    bundleUrl,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Data Science / AI ML Engineer',
    company: 'Blubridge Technologies Pvt Ltd',
    department: 'Research & Development / Core ML',
    location: 'Chennai (Mandaveli) On-site',
    city: 'Chennai',
    jobId: 'data-science-ai-ml-engineer',
    requisitionId: null,
    sourceUrl: 'https://blubridge.com/careers/job/data-science-ai-ml-engineer',
    applyUrl: 'https://blubridge.com/careers/job/data-science-ai-ml-engineer',
    employmentType: 'Full Time',
    experienceRequired: '0-1 Years',
    minimumQualification: 'Any Graduate',
    preferredQualification: null,
    requiredSkills: [
      'AI',
      'Machine Learning',
      'C++',
      'CUDA',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: [
      'About the Role: We are hiring Data Science / AI & ML Engineers (Freshers) to work on compiler frameworks, transformer-based infrastructures, and end-to-end AI pipelines.',
      'Education: Any Graduate',
      'Key Responsibilities: Design and develop compiler frameworks; Architect scalable transformer-based infrastructures',
      'Requirements: Strong proficiency in C, C++ or Java; Solid foundation in Mathematics',
    ].join('\n'),
    source: 'blubridge',
    link: 'https://blubridge.com/careers/job/data-science-ai-ml-engineer',
    scrapedAt: '2026-08-07T00:00:00.000Z',
  })
  assert.equal(jobs[1].title, 'Business Development - AI Strategy & Partnerships')
  assert.equal(jobs[1].department, 'Business Development / Strategy')
  assert.equal(jobs[1].location, 'Chennai')
  assert.equal(jobs[1].city, 'Chennai')
})

test('Blubridge bundle parsing preserves colon-delimited platform labels inside quoted descriptions', async () => {
  const blubridge = await loadModule()
  const jobs = blubridge.extractBundleJobDetails(quotedPlatformBundleText)

  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Social Media Growth Manager (AI / Deep Tech)')
  assert.match(jobs[0].jobDescription, /YouTube: 10,000\+ subscribers/)
  assert.match(jobs[0].jobDescription, /Instagram: 25,000\+ followers/)
})

test('Blubridge reads listing and detail arrays after minified variable names change', async () => {
  const blubridge = await loadModule()
  const renamedBundle = currentBundleText.replace('Pd=[', 'EC=[').replace('fu=[', 'YC=[')

  assert.equal(blubridge.extractBundleJobCards(renamedBundle).length, 2)
  assert.equal(blubridge.extractBundleJobDetails(renamedBundle).length, 2)

  const jobs = await blubridge.createBlubridgeScraper().run({
    fetchText: async (url) => url === blubridge.CAREER_PAGE_URL
      ? currentCareersShellHtml
      : renamedBundle,
  })
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].title, 'Data Science / AI ML Engineer')
})
