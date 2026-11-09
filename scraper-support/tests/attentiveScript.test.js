import assert from 'node:assert/strict'
import test from 'node:test'

const loadAttentiveModule = async () => {
  try {
    return await import('../../scraper/attentiveai/script.js')
  } catch {
    return null
  }
}

const buildListingHtml = (cards) => `
<!doctype html>
<html>
  <body>
    <div class="w-dyn-items">
      ${cards.map((card) => `
        <div role="listitem" class="w-dyn-item">
          <div class="careers-page-jobs-listing-card">
            <div class="careers-page-jobs-listing-card-title-wrapper">
              <p fs-list-field="job-title" class="careers-page-jobs-listing-card-title">${card.title}</p>
              <p fs-list-field="job-type" class="careers-page-jobs-listing-card-type">${card.location}</p>
            </div>
            <div class="careers-page-jobs-listing-card-description-wrapper">
              <p fs-list-field="job-description" class="careers-page-jobs-listing-card-description">${card.description}</p>
            </div>
            <a href="${card.url}" target="_blank" class="careers-page-jobs-listing-card-link w-inline-block"></a>
          </div>
        </div>
      `).join('')}
    </div>
  </body>
</html>
`

const buildDetailHtml = ({
  title,
  location,
  employmentType,
  description,
}) => `
<!doctype html>
<html>
  <body>
    <div class="job-details-container">
      <h1 class="font-large-5" title="${title}">${title}</h1>
      <div class="d-flex align-items-center pr-4 pb-3">
        <span class="kch-btn-label-color">${location}</span>
      </div>
      <div class="d-flex align-items-center pr-4 pb-3">
        <span class="kch-btn-label-color">${employmentType}</span>
      </div>
      <div class="job-description-container kch-description-color">${description}</div>
    </div>
  </body>
</html>
`

test('extractSearchResults maps Beam AI listing cards plus Keka detail pages into shared scraper fields', async () => {
  const attentive = await loadAttentiveModule()
  assert.ok(attentive)

  const listingHtml = buildListingHtml([
    {
      title: 'Account Executive',
      location: 'Remote',
      description: 'Own the full outbound cycle for US customers while working from India.',
      url: 'https://attentiveos.keka.com/careers/jobdetails/129707',
    },
    {
      title: 'Product Manager',
      location: 'Noida',
      description: 'Lead product strategy for one of our customer segments.',
      url: 'https://attentiveos.keka.com/careers/jobdetails/130511',
    },
    {
      title: 'Product Manager',
      location: 'Noida',
      description: 'Lead product strategy for one of our customer segments.',
      url: 'https://attentiveos.keka.com/careers/jobdetails/130511',
    },
    {
      title: 'Sales Director',
      location: 'San Jose',
      description: 'Grow enterprise construction accounts in the US market.',
      url: 'https://attentiveos.keka.com/careers/jobdetails/140001',
    },
  ])

  const jobs = attentive.extractSearchResults(listingHtml, {
    detailHtmlByUrl: {
      'https://attentiveos.keka.com/careers/jobdetails/129707': buildDetailHtml({
        title: 'Account Executive',
        location: 'New Delhi, Remote (India)',
        employmentType: 'Full-Time',
        description: '<h3>About Attentive.ai</h3><p>Engage customers and close pipeline across the US market.</p>',
      }),
      'https://attentiveos.keka.com/careers/jobdetails/130511': buildDetailHtml({
        title: 'Product Manager',
        location: 'Noida (India)',
        employmentType: 'Full-Time',
        description: '<h3>What you will do</h3><p>Own roadmap, customer outcomes, and product adoption.</p>',
      }),
      'https://attentiveos.keka.com/careers/jobdetails/140001': buildDetailHtml({
        title: 'Sales Director',
        location: 'San Jose, CA (United States)',
        employmentType: 'Full-Time',
        description: '<p>Lead the North America enterprise sales motion.</p>',
      }),
    },
  })

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Account Executive',
    company: 'Attentive.ai',
    department: null,
    location: 'New Delhi, Remote (India)',
    city: 'New Delhi',
    country: 'India',
    jobId: '129707',
    requisitionId: '129707',
    sourceUrl: 'https://attentiveos.keka.com/careers/jobdetails/129707',
    applyUrl: 'https://attentiveos.keka.com/careers/jobdetails/129707',
    employmentType: 'Full-Time',
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: 'About Attentive.ai Engage customers and close pipeline across the US market.',
    remoteStatus: 'Remote',
  })
  assert.equal(jobs[1].title, 'Product Manager')
  assert.equal(jobs[1].city, 'Noida')
  assert.equal(jobs[1].country, 'India')
  assert.equal(jobs[1].jobId, '130511')
  assert.equal(jobs[1].employmentType, 'Full-Time')
})

test('run fetches the Beam AI careers page, enriches Keka details, and decorates Attentive.ai jobs', async () => {
  const attentive = await loadAttentiveModule()
  assert.ok(attentive)

  const listingHtml = buildListingHtml([
    {
      title: 'Associate Product Manager',
      location: 'Noida',
      description: 'Support roadmap execution for construction AI products.',
      url: 'https://attentiveos.keka.com/careers/jobdetails/134457',
    },
  ])

  const detailHtml = buildDetailHtml({
    title: 'Associate Product Manager',
    location: 'Noida (India)',
    employmentType: 'Full-Time',
    description: '<p>Drive research, experimentation, and execution with engineering and design.</p>',
  })

  const requestedUrls = []
  const scraper = attentive.createAttentiveAiScraper()

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === attentive.CAREER_PAGE_URL) return listingHtml
      if (url === 'https://attentiveos.keka.com/careers/jobdetails/134457') return detailHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.equal(attentive.buildSearchUrl(), attentive.CAREER_PAGE_URL)
  assert.deepEqual(requestedUrls, [
    attentive.CAREER_PAGE_URL,
    'https://attentiveos.keka.com/careers/jobdetails/134457',
  ])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'attentiveai')
  assert.equal(jobs[0].link, 'https://attentiveos.keka.com/careers/jobdetails/134457')
  assert.equal(jobs[0].company, 'Attentive.ai')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
