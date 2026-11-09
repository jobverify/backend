import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers & Job Opportunities | Work Culture and Values | Calpion</title>
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <h2>Opportunities with us</h2>
      <div class="career-card-featured pulse-button-card">
        <div class="career-card-content featured">
          <div class="career-title-head">
            <div class="career-blog-title">Lead - Full Stack Software Developer</div>
          </div>
          <p class="career-card-des">
            We are seeking a technically proficient Full Stack Software Developer with a strong background in modern backend and frontend engineering.
          </p>
          <a href="/career/lead-software-developer-full-stack" class="featured-link">Know More</a>
        </div>
        <a href="/career/lead-software-developer-full-stack" class="button w-button">Apply Now</a>
      </div>
      <div class="career-card-featured pulse-button-card">
        <div class="career-card-content featured">
          <div class="career-title-head">
            <div class="career-blog-title">AI/ML Developer</div>
          </div>
          <p class="career-card-des">
            We are seeking a skilled Software Engineer to join our team and work on cutting-edge AI and ML projects.
          </p>
          <a href="/career/ai-ml-developer" class="featured-link">Know More</a>
        </div>
        <a href="/career/ai-ml-developer" class="button w-button">Apply Now</a>
      </div>
      <div class="career-card-featured pulse-button-card">
        <div class="career-card-content featured">
          <div class="career-title-head">
            <div class="career-blog-title">Quality Manager Medical Coding</div>
          </div>
          <p class="career-card-des">
            Lead medical coding quality programs and continuous process improvement initiatives.
          </p>
          <a href="/career/quality-manager-medical-coding" class="featured-link">Know More</a>
        </div>
        <a href="/career/quality-manager-medical-coding" class="button w-button">Apply Now</a>
      </div>
    </main>
  </body>
</html>
`

const detailHtmlByUrl = {
  'https://www.calpion.com/career/lead-software-developer-full-stack': `
    <html>
      <body>
        <p><strong>Job Title:</strong> Lead - Full Stack Software Developer</p>
        <p><strong>Location:</strong> Bangalore</p>
        <p><strong>Experience:</strong> 8 - 12 Years</p>
        <p><strong>Terms-Fulltime/Part time/Contractual:</strong> Full-time</p>
        <h3>Job Summary</h3>
        <p>Lead full stack engineering for healthcare products across backend services and frontend experiences.</p>
      </body>
    </html>
  `,
  'https://www.calpion.com/career/ai-ml-developer': `
    <html>
      <body>
        <p><strong>Job Title:</strong> AI/ML Developer</p>
        <p><strong>Location:</strong> Bengaluru, India</p>
        <p><strong>Experience:</strong> 4 - 8 Years</p>
        <p><strong>Terms-Fulltime/Part time/Contractual:</strong> Full-time</p>
        <h3>Job Summary</h3>
        <p>Build production AI and machine learning solutions with Python, cloud services, and modern LLM tooling.</p>
      </body>
    </html>
  `,
  'https://www.calpion.com/career/quality-manager-medical-coding': `
    <html>
      <body>
        <p><strong>Job Title:</strong> Quality Manager Medical Coding</p>
        <p><strong>Location:</strong> Coimbatore</p>
        <p><strong>Experience:</strong> 7 - 10 Years</p>
        <p><strong>Terms-Fulltime/Part time/Contractual:</strong> Full-time</p>
        <h3>Job Summary</h3>
        <p>Lead medical coding quality programs, audits, and continuous process improvement initiatives.</p>
      </body>
    </html>
  `,
}

const loadModule = async () => {
  try {
    return await import('../../scraper/calpionsoftwaretechnologies/script.js')
  } catch {
    assert.fail('Expected Calpion Software Technologies scraper module at ../../scraper/calpionsoftwaretechnologies/script.js')
  }
}

test('Calpion Software Technologies keeps the verified first-party career-card parser pinned', async () => {
  const calpion = await loadModule()

  assert.equal(calpion.CAREERS_URL, 'https://www.calpion.com/career')
  assert.equal(calpion.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    calpion.extractCareerCards(careersHtml).map((job) => [job.title, job.summary, job.applyUrl]),
    [
      [
        'Lead - Full Stack Software Developer',
        'We are seeking a technically proficient Full Stack Software Developer with a strong background in modern backend and frontend engineering.',
        'https://www.calpion.com/career/lead-software-developer-full-stack',
      ],
      [
        'AI/ML Developer',
        'We are seeking a skilled Software Engineer to join our team and work on cutting-edge AI and ML projects.',
        'https://www.calpion.com/career/ai-ml-developer',
      ],
      [
        'Quality Manager Medical Coding',
        'Lead medical coding quality programs and continuous process improvement initiatives.',
        'https://www.calpion.com/career/quality-manager-medical-coding',
      ],
    ],
  )
})

test('Calpion Software Technologies run returns the visible first-party role cards from the verified careers page', async () => {
  const calpion = await loadModule()
  const requestedUrls = []

  const jobs = await calpion.createCalpionSoftwareTechnologiesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === 'https://www.calpion.com/career') return careersHtml
      if (detailHtmlByUrl[url]) return detailHtmlByUrl[url]
      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-08-01T00:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    'https://www.calpion.com/career',
    'https://www.calpion.com/career/lead-software-developer-full-stack',
    'https://www.calpion.com/career/ai-ml-developer',
    'https://www.calpion.com/career/quality-manager-medical-coding',
  ])
  assert.deepEqual(
    jobs.map((job) => [job.title, job.location, job.city, job.employmentType, job.experienceRequired, job.jobDescription, job.applyUrl, job.source, job.scrapedAt]),
    [
      [
        'Lead - Full Stack Software Developer',
        'Bengaluru, India',
        'Bengaluru',
        'Full-time',
        '8 - 12 Years',
        'Lead full stack engineering for healthcare products across backend services and frontend experiences.',
        'https://www.calpion.com/career/lead-software-developer-full-stack',
        'calpionsoftwaretechnologies',
        '2026-08-01T00:00:00.000Z',
      ],
      [
        'AI/ML Developer',
        'Bengaluru, India',
        'Bengaluru',
        'Full-time',
        '4 - 8 Years',
        'Build production AI and machine learning solutions with Python, cloud services, and modern LLM tooling.',
        'https://www.calpion.com/career/ai-ml-developer',
        'calpionsoftwaretechnologies',
        '2026-08-01T00:00:00.000Z',
      ],
      [
        'Quality Manager Medical Coding',
        'Coimbatore, India',
        'Coimbatore',
        'Full-time',
        '7 - 10 Years',
        'Lead medical coding quality programs, audits, and continuous process improvement initiatives.',
        'https://www.calpion.com/career/quality-manager-medical-coding',
        'calpionsoftwaretechnologies',
        '2026-08-01T00:00:00.000Z',
      ],
    ],
  )
})

test('Calpion Software Technologies fails closed when the verified first-party careers surface drifts', async () => {
  const calpion = await loadModule()

  await assert.rejects(
    calpion.createCalpionSoftwareTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified calpion careers surface/i,
  )
})
