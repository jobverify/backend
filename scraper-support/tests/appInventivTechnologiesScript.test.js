import assert from 'node:assert/strict'
import test from 'node:test'

const FIXED_SCRAPED_AT = '2026-07-17T18:00:00.000Z'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers at Appinventiv | Build the Future of Digital</title>
  </head>
  <body>
    <section>
      <h2>Trending Opportunities</h2>
      <li class="mix ai_ml noida six">
        <a href="" class="job-desc-button" data-toggle="modal" data-target="#JobModal64021">
          <span class="pos-name">AL/ML Engineer</span>
          <span class="location">Noida</span>
        </a>
      </li>
      <div id="JobModal64021" class="modal fade job_modal" role="dialog">
        <div class="job-detail">
          <h3 class="heading4">About the role</h3>
          <p>The role of a Machine Learning (ML) Engineer is centered around the application of machine learning algorithms and statistical models.</p>
          <h3 class="heading4">What you'll need</h3>
          <ul>
            <li>3-4 years of hands-on experience in machine learning.</li>
            <li>Proficiency in Python and ML frameworks like TensorFlow.</li>
          </ul>
          <h5>Location : Noida</h5>
          <h5>Experience : 4-6 Years</h5>
          <button><span class="text">Apply Now</span></button>
        </div>
      </div>
      <li class="mix node_js noida six">
        <a href="" class="job-desc-button" data-toggle="modal" data-target="#JobModal38965">
          <span class="pos-name">Tech Lead Node.js</span>
          <span class="location">Noida</span>
        </a>
      </li>
      <div id="JobModal38965" class="modal fade job_modal" role="dialog">
        <div class="job-detail">
          <h3 class="heading4">About the role</h3>
          <p>Lead backend platform development for Node.js applications.</p>
          <h3 class="heading4">What you'll need</h3>
          <ul>
            <li>10+ years of backend engineering experience.</li>
            <li>Strong Node.js architecture experience.</li>
          </ul>
          <h5>Location : Noida</h5>
          <h5>Experience : 10+ years</h5>
          <button><span class="text">Apply Now</span></button>
        </div>
      </div>
      <p>If you are unable to submit your details, then please share your recently updated resume at career@appinventiv.com .</p>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/appinventivtechnologies/script.js')
  } catch {
    assert.fail('Expected AppInventiv Technologies scraper module at ../../scraper/appinventivtechnologies/script.js')
  }
}

test('AppInventiv Technologies helpers stay pinned to the verified first-party careers page and embedded job modals', async () => {
  const appinventiv = await loadModule()

  assert.equal(appinventiv.SOURCE, 'appinventivtechnologies')
  assert.equal(appinventiv.COMPANY, 'AppInventiv Technologies')
  assert.equal(appinventiv.CAREERS_URL, 'https://appinventiv.com/career/')
  assert.equal(appinventiv.VERIFIED_ON, '2026-07-17')
  assert.equal(appinventiv.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(appinventiv.extractListings(careersHtml), [
    {
      modalId: 'JobModal64021',
      title: 'AL/ML Engineer',
      locationLabel: 'Noida',
    },
    {
      modalId: 'JobModal38965',
      title: 'Tech Lead Node.js',
      locationLabel: 'Noida',
    },
  ])
})

test('AppInventiv Technologies run validates the first-party page and returns normalized jobs from embedded modals', async () => {
  const appinventiv = await loadModule()

  const jobs = await appinventiv.createAppInventivTechnologiesScraper({
    now: () => FIXED_SCRAPED_AT,
  }).run({
    fetchText: async (url) => {
      assert.equal(url, appinventiv.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'AL/ML Engineer',
    company: 'AppInventiv Technologies',
    department: null,
    location: 'Noida, India',
    city: 'Noida',
    country: 'India',
    jobId: '64021',
    requisitionId: '64021',
    sourceUrl: 'https://appinventiv.com/career/#JobModal64021',
    applyUrl: 'mailto:career@appinventiv.com',
    employmentType: 'Full-time',
    experienceRequired: '4-6 Years',
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [
      '3-4 years of hands-on experience in machine learning.',
      'Proficiency in Python and ML frameworks like TensorFlow.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: 'The role of a Machine Learning (ML) Engineer is centered around the application of machine learning algorithms and statistical models.',
    remoteStatus: 'On-site',
    source: 'appinventivtechnologies',
    link: 'mailto:career@appinventiv.com',
    scrapedAt: FIXED_SCRAPED_AT,
    companyCareerPage: 'https://appinventiv.com/career/',
    companyDomain: 'appinventiv.com',
    atsPlatform: 'official-company-careers',
  })
  assert.equal(jobs[1].title, 'Tech Lead Node.js')
})

test('AppInventiv Technologies fails closed when the verified first-party careers contract drifts', async () => {
  const appinventiv = await loadModule()

  await assert.rejects(
    appinventiv.createAppInventivTechnologiesScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified AppInventiv Technologies careers page/i,
  )
})
