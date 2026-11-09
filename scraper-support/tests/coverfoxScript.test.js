import assert from 'node:assert/strict'
import test from 'node:test'

const loadCoverfoxModule = async () => {
  try {
    return await import('../../scraper/coverfox/script.js')
  } catch {
    assert.fail('Expected Coverfox scraper module at ../../scraper/coverfox/script.js')
  }
}

const officialCareersHtml = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Career Opportunities, Job Vacancies - Coverfox.com</title>
    <link rel="canonical" href="https://www.coverfox.com/careers/" />
  </head>
  <body>
    <section class="banner">
      <h1>Welcome to the <br />Coverfox careers page</h1>
    </section>

    <section class="new-cycle">
      <p class="lead">Coverfox is on a hiring spree; we are looking at people just like how we are: <strong>passionately crazy for what we do!</strong></p>

      <div data-cms-include="cms/components/faq-item" data-cms-namespace="opening39">
        <div class="faq dynamic-accordian">
          <div class="faq__icon"></div>
          <div class="faq__question"><h3><strong>Software Developer (Backend Engineer)</strong></h3></div>
          <div accordian-body class="faq__answer">
            <p><strong>Location: Mumbai / Bangalore</strong></p>
            <p><strong>No of vacancy: 4</strong></p>
            <p><strong>Job Profile:</strong></p>
            <ul>
              <li>Build insurance platform services using Python, Django, and Java.</li>
              <li>Collaborate with engineers, product managers, and the quality team.</li>
            </ul>
            <p><strong>Candidate Profile:</strong></p>
            <ul>
              <li>Bachelor's degree in Computer Science or a related field.</li>
              <li>At least 2+ years of experience in product based organizations as a software developer.</li>
              <li>Experience with AWS Lambda, Elastic Search, Kafka, and Celery adds an advantage.</li>
            </ul>
            <p><strong>Application process: Email your resumes to <a href="mailto:careers@coverstack.in">careers@coverstack.in</a></strong></p>
          </div>
        </div>
      </div>

      <div data-cms-include="cms/components/faq-item" data-cms-namespace="opening44">
        <div class="faq dynamic-accordian">
          <div class="faq__icon"></div>
          <div class="faq__question"><h2><strong>Product Manager</strong></h2></div>
          <div accordian-body class="faq__answer">
            <p><strong>No of vacancy: 2</strong></p>
            <p><strong>Location: Mumbai</strong></p>
            <p><strong>Job Profile:</strong></p>
            <p>Own the roadmap, prioritize experiments, and partner with engineering to ship consumer insurance experiences.</p>
            <ul>
              <li>Drive product and integration roadmap.</li>
              <li>Work with analytics, technology, and business stakeholders.</li>
            </ul>
            <p><strong>Candidate Profile:</strong></p>
            <ul>
              <li>Graduate / Post Graduate in business, engineering, or a related discipline.</li>
              <li>1 to 3 years of experience working with teams in rapid delivery environments.</li>
              <li>Experience of working on a consumer facing product is preferred.</li>
            </ul>
            <p><strong>Application process: Email your resumes to <a href="mailto:careers@coverstack.in">careers@coverstack.in</a></strong></p>
          </div>
        </div>
      </div>

      <div data-cms-include="cms/components/faq-item" data-cms-namespace="opening52">
        <div class="faq dynamic-accordian">
          <div class="faq__icon"></div>
          <div class="faq__question"><h3><strong>Customer Advisory Team</strong></h3></div>
          <div accordian-body class="faq__answer">
            <h3><strong>Location:</strong> Gonda, Basti, Gorakhpur</h3>
            <h3><strong>No of vacancy: 20</strong></h3>
            <h4><strong>Job Profile:</strong></h4>
            <ul>
              <li>Generate leads through field visits, referrals, and partnerships.</li>
              <li>Help customers choose the right insurance products and close sales.</li>
            </ul>
            <h4><strong>Candidate Profile:</strong></h4>
            <ul>
              <li>Bachelor’s degree in any field.</li>
              <li>1-3 years of field sales experience (6 Months insurance sales mandatory).</li>
              <li>Valid driver's license with a 2-wheeler and willingness to travel extensively.</li>
            </ul>
            <p><strong>Application Process: Email your resumes to <a href="mailto:careers@coverfox.com">careers@coverfox.com</a></strong></p>
          </div>
        </div>
      </div>
    </section>

    <div class="career-side-form">
      <form id="careerContactForm">
        <input name="name" />
      </form>
    </div>

    <div class="cycle-footer">
      <b>Application process:</b> Email your resumes to <b><a href="mailto:careers@coverfox.com">careers@coverfox.com</a></b>
    </div>
  </body>
</html>
`

test('Coverfox scraper validates the official careers page and extracts inline accordion openings', async () => {
  const coverfox = await loadCoverfoxModule()

  assert.equal(coverfox.SOURCE, 'coverfox')
  assert.equal(coverfox.COMPANY, 'Coverfox')
  assert.equal(coverfox.CAREERS_URL, 'https://www.coverfox.com/careers/')
  assert.equal(coverfox.DEFAULT_APPLICATION_EMAIL, 'careers@coverfox.com')
  assert.equal(coverfox.hasOfficialCareersSignal(officialCareersHtml), true)

  const jobs = coverfox.extractJobListings(officialCareersHtml)

  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[0], {
    title: 'Software Developer (Backend Engineer)',
    company: 'Coverfox',
    department: null,
    location: 'Mumbai / Bangalore, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'software-developer-backend-engineer',
    requisitionId: 'software-developer-backend-engineer',
    sourceUrl: 'https://www.coverfox.com/careers/',
    applyUrl: 'https://www.coverfox.com/careers/',
    employmentType: null,
    experienceRequired: '2+ years',
    minimumQualification: "Bachelor's degree in Computer Science or a related field.",
    preferredQualification: null,
    requiredSkills: [
      'Experience with AWS Lambda, Elastic Search, Kafka, and Celery adds an advantage.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: jobs[0].jobDescription,
    remoteStatus: 'On-site',
  })
  assert.match(jobs[0].jobDescription, /Build insurance platform services using Python, Django, and Java\./)
  assert.match(jobs[0].jobDescription, /careers@coverstack\.in/i)

  assert.equal(jobs[1].title, 'Product Manager')
  assert.equal(jobs[1].location, 'Mumbai, India')
  assert.equal(jobs[1].experienceRequired, '1 to 3 years')
  assert.equal(jobs[1].minimumQualification, 'Graduate / Post Graduate in business, engineering, or a related discipline.')

  assert.equal(jobs[2].title, 'Customer Advisory Team')
  assert.equal(jobs[2].location, 'Gonda, Basti, Gorakhpur, India')
  assert.equal(jobs[2].city, 'Gonda')
  assert.equal(jobs[2].applyUrl, 'https://www.coverfox.com/careers/')
  assert.equal(jobs[2].experienceRequired, '1-3 years')
  assert.equal(jobs[2].minimumQualification, "Bachelor's degree in any field.")
})

test('Coverfox run fetches the careers page and decorates scraper metadata', async () => {
  const coverfox = await loadCoverfoxModule()
  const requestedUrls = []

  const jobs = await coverfox.createCoverfoxScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return officialCareersHtml
    },
  })

  assert.deepEqual(requestedUrls, [coverfox.CAREERS_URL])
  assert.equal(jobs.length, 3)
  assert.deepEqual(jobs[1], {
    title: 'Product Manager',
    company: 'Coverfox',
    department: null,
    location: 'Mumbai, India',
    city: 'Mumbai',
    country: 'India',
    jobId: 'coverfox-product-manager',
    requisitionId: 'coverfox-product-manager',
    sourceUrl: 'https://www.coverfox.com/careers/',
    applyUrl: 'https://www.coverfox.com/careers/',
    employmentType: null,
    experienceRequired: '1 to 3 years',
    minimumQualification: 'Graduate / Post Graduate in business, engineering, or a related discipline.',
    preferredQualification: null,
    requiredSkills: [
      'Experience of working on a consumer facing product is preferred.',
    ],
    postingDate: null,
    closingDate: null,
    jobDescription: jobs[1].jobDescription,
    remoteStatus: 'On-site',
    source: 'coverfox',
    link: 'https://www.coverfox.com/careers/',
    scrapedAt: jobs[1].scrapedAt,
  })
  assert.match(jobs[1].scrapedAt, /\d{4}-\d{2}-\d{2}T/)
})

test('Coverfox fails closed when the verified careers surface changes', async () => {
  const coverfox = await loadCoverfoxModule()

  await assert.rejects(
    coverfox.createCoverfoxScraper().run({
      fetchText: async () => '<html><body><h1>Careers</h1></body></html>',
    }),
    /verified official careers page/i,
  )
})
