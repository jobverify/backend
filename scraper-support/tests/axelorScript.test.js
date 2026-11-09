import assert from 'node:assert/strict'
import test from 'node:test'

const loadAxelorModule = async () => {
  try {
    return await import('../../scraper/axelor/script.js')
  } catch {
    return null
  }
}

const buildListingPage = ({
  totalPages = 1,
  cards = [],
}) => `
<!doctype html>
<html>
  <head>
    <title>Job offers | Axelor</title>
  </head>
  <body>
    <div class="wpgb-grid">
      ${cards.map((card, index) => `
        <article class="wpgb-card wpgb-card-${index + 1}">
          <div class="wpgb-card-wrapper">
            <div class="wpgb-card-inner" data-action>
              <div class="wpgb-card-content wpgb-scheme-dark">
                <div class="wpgb-card-body">
                  <div class="wpgb-block-3"><i class="material-icons-two-tone">place</i></div>
                  <div class="wpgb-block-1">
                    <span class="wpgb-block-term">${card.city}</span>
                    <span> - </span>
                    <span class="wpgb-block-term">${card.country}</span>
                  </div>
                </div>
                <div class="wpgb-card-footer">
                  <a class="wpgb-block-2" href="${card.href}">${card.title}</a>
                  <a class="wpgb-block-5" href="${card.href}"><p>See the offer</p></a>
                </div>
              </div>
              <a class="wpgb-card-layer-link" href="${card.href}"></a>
            </div>
          </div>
        </article>
      `).join('')}
    </div>
    <nav class="wpgb-pagination-facet" aria-label="Page navigation">
      <ul class="wpgb-pagination">
        ${Array.from({ length: totalPages }, (_, index) => `
          <li class="wpgb-page">
            <a href="https://axelor.com/job-offers/?_job_offers_pagination=${index + 1}" data-page="${index + 1}">${index + 1}</a>
          </li>
        `).join('')}
      </ul>
    </nav>
  </body>
</html>
`

test('extractSearchResults keeps only India cards from the Axelor public job offers page', async () => {
  const axelor = await loadAxelorModule()
  assert.ok(axelor)

  const pageHtml = buildListingPage({
    totalPages: 2,
    cards: [
      {
        city: 'Surat',
        country: 'India',
        href: 'https://axelor.com/business-intelligence-developer/',
        title: 'Business Intelligence Developer',
      },
      {
        city: 'Champs-sur-Marne',
        country: 'France',
        href: 'https://axelor.com/erp-project-manager/',
        title: 'Chef de Projet ERP',
      },
      {
        city: 'Bangalore',
        country: 'India',
        href: 'https://axelor.com/node-js-developer-india/',
        title: 'Node JS Developer',
      },
    ],
  })

  const jobs = axelor.extractSearchResults(pageHtml)

  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Business Intelligence Developer',
    company: 'Axelor',
    department: null,
    location: 'Surat, India',
    city: 'Surat',
    country: 'India',
    jobId: 'business-intelligence-developer',
    requisitionId: 'business-intelligence-developer',
    sourceUrl: 'https://axelor.com/business-intelligence-developer/',
    applyUrl: 'https://axelor.com/business-intelligence-developer/',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription: null,
    remoteStatus: 'On-site',
  })
  assert.equal(jobs[1].title, 'Node JS Developer')
  assert.equal(jobs[1].city, 'Bangalore')
  assert.equal(jobs[1].jobId, 'node-js-developer-india')
})

test('run paginates through Axelor listing pages and decorates India openings', async () => {
  const axelor = await loadAxelorModule()
  assert.ok(axelor)

  const requestedUrls = []
  const scraper = axelor.createAxelorScraper()
  const pageOne = buildListingPage({
    totalPages: 2,
    cards: [
      {
        city: 'Surat',
        country: 'India',
        href: 'https://axelor.com/business-intelligence-developer/',
        title: 'Business Intelligence Developer',
      },
    ],
  })
  const pageTwo = buildListingPage({
    totalPages: 2,
    cards: [
      {
        city: 'Bangalore',
        country: 'India',
        href: 'https://axelor.com/reactjs-developer/',
        title: 'ReactJS Developer',
      },
    ],
  })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === axelor.CAREER_PAGE_URL) return pageOne
      if (url === axelor.buildSearchUrl(2)) return pageTwo
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    axelor.CAREER_PAGE_URL,
    axelor.buildSearchUrl(2),
  ])
  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'axelor')
  assert.equal(jobs[0].link, 'https://axelor.com/business-intelligence-developer/')
  assert.equal(jobs[1].jobId, 'reactjs-developer')
  assert.equal(typeof jobs[0].scrapedAt, 'string')
})
