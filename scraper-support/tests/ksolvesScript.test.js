import assert from 'node:assert/strict'
import test from 'node:test'

const loadKsolvesModule = async () => {
  try {
    return await import('../../scraper/ksolves/script.js')
  } catch {
    assert.fail('Expected Ksolves scraper module at ../../scraper/ksolves/script.js')
  }
}

const careersPageHtml = `
<!doctype html>
<html lang="en-US">
  <head>
    <title>Careers | Ksolves</title>
    <link rel="canonical" href="https://www.ksolves.com/careers" />
  </head>
  <body>
    <main>
      <h1>View Current Openings</h1>
      <label class="jobfilter-label">Location</label>
      <div class="row g-md-4 g-3 justify-content-center mx-auto">
        <div class="col-lg-6 job-card-col" data-title=" full stack developer (react native, reactjs, python)" data-location="noida/indore/pune" data-jobtype="hybrid">
          <div class="jobcard">
            <h3 class="jobcard-title"> Full Stack Developer (React Native, ReactJS, Python) </h3>
            <span class="jobcard-exp">3+ years</span>
            <a href="https://www.ksolves.com/careers-form?jobid=1&#038;jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29" class="jobcard-link">View and Apply Job</a>
          </div>
        </div>
        <div class="col-lg-6 job-card-col" data-title="senior software engineer (data)" data-location="indore/noida/pune" data-jobtype="wfo">
          <div class="jobcard">
            <h3 class="jobcard-title">Senior Software Engineer (Data)</h3>
            <span class="jobcard-exp">3+ years</span>
            <a href="https://www.ksolves.com/careers-form?jobid=6&#038;jobtitle=Senior+Software+Engineer+%28Data%29" class="jobcard-link">View and Apply Job</a>
          </div>
        </div>
      </div>
    </main>
  </body>
</html>
`

const fullStackDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Make Your Career with Us | Ksolves</title>
  </head>
  <body>
    <main>
      <span class="ks-career-breadcrumb__current"> Full Stack Developer (React Native, ReactJS, Python)</span>
      <h1 class="ks-career-job-title"> Full Stack Developer (React Native, ReactJS, Python)</h1>
      <div class="ks-career-meta">
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Location</p>
          <p class="ks-career-meta__value">Noida/Indore/Pune</p>
        </div>
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Experience</p>
          <p class="ks-career-meta__value">3+ years</p>
        </div>
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Work Mode</p>
          <p class="ks-career-meta__value">Hybrid</p>
        </div>
      </div>
      <h2 class="ks-career-section-heading">Roles and Responsibilities</h2>
      <ul class="ks-career-bullet-list">
        <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Build cross-platform web and mobile product experiences.</p></li>
        <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Collaborate with product, design, and backend teams to ship new features.</p></li>
      </ul>
      <div class="ks-career-skills-card">
        <h2 class="ks-career-section-heading">Required Skills</h2>
        <ul class="ks-career-bullet-list">
          <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">React Native and ReactJS expertise</p></li>
          <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">HTML5, CSS3, and JavaScript fundamentals</p></li>
        </ul>
      </div>
      <div class="ks-career-form-card">
        <h3 class="ks-career-form-card__title">Apply for This Job</h3>
      </div>
    </main>
  </body>
</html>
`

const dataEngineerDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Make Your Career with Us | Ksolves</title>
  </head>
  <body>
    <main>
      <span class="ks-career-breadcrumb__current">Senior Software Engineer (Data)</span>
      <h1 class="ks-career-job-title">Senior Software Engineer (Data)</h1>
      <div class="ks-career-meta">
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Location</p>
          <p class="ks-career-meta__value">Indore/Noida/Pune</p>
        </div>
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Experience</p>
          <p class="ks-career-meta__value">3+ years</p>
        </div>
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Work Mode</p>
          <p class="ks-career-meta__value">WFO</p>
        </div>
      </div>
      <h2 class="ks-career-section-heading">Job Overview</h2>
      <ul class="ks-career-bullet-list">
        <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Design and deploy new data platform features.</p></li>
      </ul>
      <h2 class="ks-career-section-heading">Key Responsibilities</h2>
      <ul class="ks-career-bullet-list">
        <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Own persistence and analytics components across the platform.</p></li>
      </ul>
      <div class="ks-career-skills-card">
        <h2 class="ks-career-section-heading">Required Skills</h2>
        <ul class="ks-career-bullet-list">
          <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Enterprise-grade software engineering experience</p></li>
          <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Relational and NoSQL database experience</p></li>
        </ul>
      </div>
      <div class="ks-career-form-card">
        <h3 class="ks-career-form-card__title">Apply for This Job</h3>
      </div>
    </main>
  </body>
</html>
`

const reactNativeDetailWithoutWorkModeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Make Your Career with Us | Ksolves</title>
    <link rel="canonical" href="https://www.ksolves.com/careers-form" />
  </head>
  <body>
    <main>
      <h1 class="ks-career-job-title">React Native Developer</h1>
      <div class="ks-career-meta">
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Location</p>
          <p class="ks-career-meta__value">Noida/Indore/Pune</p>
        </div>
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Experience</p>
          <p class="ks-career-meta__value">3+ years</p>
        </div>
      </div>
      <h2 class="ks-career-section-heading">Roles and Responsibilities</h2>
      <ul class="ks-career-bullet-list">
        <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Lead React Native implementation across the mobile product stack.</p></li>
        <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Write maintainable TypeScript code and guide architecture decisions.</p></li>
      </ul>
      <div class="ks-career-skills-card">
        <h2 class="ks-career-section-heading">Required Skills</h2>
        <ul class="ks-career-bullet-list">
          <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">React Native expertise</p></li>
          <li><span class="ks-career-bullet-list__dot"></span><p class="ks-career-bullet-list__text">Strong communication and collaboration</p></li>
        </ul>
      </div>
      <div class="ks-career-form-card">
        <h3 class="ks-career-form-card__title">Apply for This Job</h3>
      </div>
    </main>
  </body>
</html>
`

const sparseDetailWithoutDescriptionOrSkillsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Make Your Career with Us | Ksolves</title>
    <link rel="canonical" href="https://www.ksolves.com/careers-form" />
  </head>
  <body>
    <main>
      <h1 class="ks-career-job-title">Senior DevOps Engineer</h1>
      <div class="ks-career-meta">
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Location</p>
          <p class="ks-career-meta__value">Noida/Indore/Pune</p>
        </div>
        <div class="ks-career-meta__item">
          <p class="ks-career-meta__label">Experience</p>
          <p class="ks-career-meta__value">3+ years</p>
        </div>
      </div>
      <div class="ks-career-form-card">
        <h3 class="ks-career-form-card__title">Apply for This Job</h3>
      </div>
    </main>
  </body>
</html>
`

const driftedCareersPageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Ksolves</title>
  </head>
  <body>
    <main><p>No jobs are listed here.</p></main>
  </body>
</html>
`

const driftedDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Unexpected</title>
  </head>
  <body>
    <main><p>Missing Ksolves detail contract.</p></main>
  </body>
</html>
`

test('Ksolves pins the verified careers index, listing cards, and first-party detail page fields', async () => {
  const ksolves = await loadKsolvesModule()

  assert.equal(ksolves.SOURCE, 'ksolves')
  assert.equal(ksolves.COMPANY, 'Ksolves')
  assert.equal(ksolves.VERIFIED_ON, '2026-07-16')
  assert.equal(ksolves.HOMEPAGE_URL, 'https://www.ksolves.com/')
  assert.equal(ksolves.CAREERS_URL, 'https://www.ksolves.com/careers')
  assert.deepEqual(ksolves.VERIFIED_ROLE_URLS, [
    'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29',
    'https://www.ksolves.com/careers-form?jobid=6&jobtitle=Senior+Software+Engineer+%28Data%29',
  ])

  assert.equal(ksolves.hasVerifiedCareersPageSignal(careersPageHtml), true)
  assert.deepEqual(ksolves.extractListingCards(careersPageHtml), [
    {
      title: 'Full Stack Developer (React Native, ReactJS, Python)',
      sourceUrl:
        'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29',
      rawLocation: 'noida/indore/pune',
      experienceRequired: '3+ years',
      workMode: 'hybrid',
    },
    {
      title: 'Senior Software Engineer (Data)',
      sourceUrl:
        'https://www.ksolves.com/careers-form?jobid=6&jobtitle=Senior+Software+Engineer+%28Data%29',
      rawLocation: 'indore/noida/pune',
      experienceRequired: '3+ years',
      workMode: 'wfo',
    },
  ])

  assert.deepEqual(
    ksolves.extractJobDetail(fullStackDetailHtml, {
      title: 'Full Stack Developer (React Native, ReactJS, Python)',
      sourceUrl:
        'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29',
      rawLocation: 'noida/indore/pune',
      experienceRequired: '3+ years',
      workMode: 'hybrid',
    }),
    {
      title: 'Full Stack Developer (React Native, ReactJS, Python)',
      location: 'Noida, Indore, Pune, India',
      city: 'Noida',
      country: 'India',
      experienceRequired: '3+ years',
      remoteStatus: 'Hybrid',
      jobDescription:
        'Build cross-platform web and mobile product experiences.\nCollaborate with product, design, and backend teams to ship new features.',
      requiredSkills: [
        'React Native and ReactJS expertise',
        'HTML5, CSS3, and JavaScript fundamentals',
      ],
    },
  )

  assert.deepEqual(
    ksolves.extractJobDetail(reactNativeDetailWithoutWorkModeHtml, {
      title: 'React Native Developer',
      sourceUrl: 'https://www.ksolves.com/careers-form?jobid=2&jobtitle=React+Native+Developer',
      rawLocation: 'noida/indore/pune',
      experienceRequired: '3+ years',
      workMode: null,
    }),
    {
      title: 'React Native Developer',
      location: 'Noida, Indore, Pune, India',
      city: 'Noida',
      country: 'India',
      experienceRequired: '3+ years',
      remoteStatus: null,
      jobDescription:
        'Lead React Native implementation across the mobile product stack.\nWrite maintainable TypeScript code and guide architecture decisions.',
      requiredSkills: [
        'React Native expertise',
        'Strong communication and collaboration',
      ],
    },
  )

  assert.deepEqual(
    ksolves.extractJobDetail(sparseDetailWithoutDescriptionOrSkillsHtml, {
      title: 'Senior DevOps Engineer',
      sourceUrl: 'https://www.ksolves.com/careers-form?jobid=7&jobtitle=Senior+DevOps+Engineer',
      rawLocation: 'noida/indore/pune',
      experienceRequired: '3+ years',
      workMode: null,
    }),
    {
      title: 'Senior DevOps Engineer',
      location: 'Noida, Indore, Pune, India',
      city: 'Noida',
      country: 'India',
      experienceRequired: '3+ years',
      remoteStatus: null,
      jobDescription: null,
      requiredSkills: [],
    },
  )
})

test('Ksolves scraper returns the verified first-party India jobs from the careers index and detail pages', async () => {
  const ksolves = await loadKsolvesModule()
  const requestedUrls = []

  const jobs = await ksolves.createKsolvesScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === ksolves.CAREERS_URL) return careersPageHtml
      if (url === 'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29') {
        return fullStackDetailHtml
      }
      if (url === 'https://www.ksolves.com/careers-form?jobid=6&jobtitle=Senior+Software+Engineer+%28Data%29') {
        return dataEngineerDetailHtml
      }

      throw new Error(`Unexpected URL: ${url}`)
    },
    now: () => '2026-07-16T12:00:00.000Z',
  })

  assert.deepEqual(requestedUrls, [
    ksolves.CAREERS_URL,
    ...ksolves.VERIFIED_ROLE_URLS,
  ])
  assert.equal(jobs.length, 2)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      location: job.location,
      city: job.city,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      experienceRequired: job.experienceRequired,
      remoteStatus: job.remoteStatus,
      source: job.source,
      scrapedAt: job.scrapedAt,
    })),
    [
      {
        title: 'Full Stack Developer (React Native, ReactJS, Python)',
        location: 'Noida, Indore, Pune, India',
        city: 'Noida',
        sourceUrl:
          'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29',
        applyUrl:
          'https://www.ksolves.com/careers-form?jobid=1&jobtitle=+Full+Stack+Developer+%28React+Native%2C+ReactJS%2C+Python%29',
        experienceRequired: '3+ years',
        remoteStatus: 'Hybrid',
        source: 'ksolves',
        scrapedAt: '2026-07-16T12:00:00.000Z',
      },
      {
        title: 'Senior Software Engineer (Data)',
        location: 'Indore, Noida, Pune, India',
        city: 'Indore',
        sourceUrl:
          'https://www.ksolves.com/careers-form?jobid=6&jobtitle=Senior+Software+Engineer+%28Data%29',
        applyUrl:
          'https://www.ksolves.com/careers-form?jobid=6&jobtitle=Senior+Software+Engineer+%28Data%29',
        experienceRequired: '3+ years',
        remoteStatus: 'On-site',
        source: 'ksolves',
        scrapedAt: '2026-07-16T12:00:00.000Z',
      },
    ],
  )
})

test('Ksolves scraper fails closed when the careers index or detail pages drift from the verified first-party contract', async () => {
  const ksolves = await loadKsolvesModule()

  await assert.rejects(
    ksolves.createKsolvesScraper().run({
      fetchText: async (url) => {
        if (url === ksolves.CAREERS_URL) return driftedCareersPageHtml
        throw new Error(`Unexpected URL: ${url}`)
      },
    }),
    /careers page/i,
  )

  await assert.rejects(
    ksolves.createKsolvesScraper().run({
      fetchText: async (url) => {
        if (url === ksolves.CAREERS_URL) return careersPageHtml
        return driftedDetailHtml
      },
    }),
    /detail page/i,
  )
})


test('Ksolves verifies the current board without requiring closed vacancy titles', async () => {
  const ksolves = await loadKsolvesModule()
  const current = careersPageHtml
    .replaceAll('Full Stack Developer (React Native, ReactJS, Python)', 'Salesforce Financial Services Cloud Developer')
    .replaceAll('Senior Software Engineer (Data)', 'Developer Confluent Kafka')
  assert.equal(ksolves.hasVerifiedCareersPageSignal(current), true)
  const jobs = await ksolves.createKsolvesScraper({ maxJobs: 1 }).run({
    fetchText: async (url) => url === ksolves.CAREERS_URL ? current : fullStackDetailHtml
      .replaceAll('Full Stack Developer (React Native, ReactJS, Python)', 'Salesforce Financial Services Cloud Developer'),
  })
  assert.equal(jobs[0].title, 'Salesforce Financial Services Cloud Developer')
})

test('Ksolves reads current Position Overview, Primary Responsibilities and Must-Have Skills headings', async () => {
  const ksolves = await loadKsolvesModule()
  const listing = ksolves.extractListingCards(careersPageHtml)[0]
  const changed = fullStackDetailHtml
    .replace('Roles and Responsibilities', 'Primary Responsibilities')
    .replace('Required Skills', 'Must-Have Skills')
    .replace('</main>', '<h2 class="ks-career-section-heading">Position Overview</h2><ul><li>Implement Financial Services Cloud.</li></ul></main>')
  const job = ksolves.extractJobDetail(changed, listing)
  assert.match(job.jobDescription, /Build cross-platform/)
  assert.match(job.jobDescription, /Implement Financial Services Cloud/)
  assert.ok(job.requiredSkills.length > 0)
})

test('Ksolves rejects incomplete cards and untrusted detail links before fetching a partial listing', async () => {
  const ksolves = await loadKsolvesModule()
  assert.throws(() => ksolves.extractListingCards(careersPageHtml.replace('data-location="noida/indore/pune"', 'data-location=""')), /incomplete/i)
  assert.throws(() => ksolves.extractListingCards(careersPageHtml.replace('https://www.ksolves.com/careers-form?', 'https://other.example/careers-form?')), /first-party/i)
})

test('Ksolves does not label an unverified overseas detail location as India', async () => {
  const ksolves = await loadKsolvesModule()
  const listing = ksolves.extractListingCards(careersPageHtml)[0]
  assert.throws(() => ksolves.extractJobDetail(fullStackDetailHtml.replace('Noida/Indore/Pune', 'Dubai'), listing), /India|location/i)
})
