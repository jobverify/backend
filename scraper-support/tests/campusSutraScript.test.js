import assert from 'node:assert/strict'
import test from 'node:test'

const loadCampusSutraModule = async () => {
  try {
    return await import('../../scraper/campussutra/script.js')
  } catch {
    assert.fail('Expected Campus Sutra scraper module at ../../scraper/campussutra/script.js')
  }
}

const currentLinkedInSearchCardHtml = `
  <ul class="jobs-search__results-list">
    <li>
      <div class="base-card relative w-full base-card--link base-search-card base-search-card--link job-search-card"
        data-entity-urn="urn:li:jobPosting:4463844121">
        <a class="base-card__full-link absolute top-0 right-0 bottom-0 left-0"
          href="https://in.linkedin.com/jobs/view/videographer-at-campus-sutra-4463844121?position=1&amp;pageNum=0"></a>
        <div class="base-search-card__info">
          <h3 class="base-search-card__title">
            Videographer
          </h3>
          <h4 class="base-search-card__subtitle">
            <a class="hidden-nested-link" href="https://in.linkedin.com/company/campus-sutra">
              Campus Sutra
            </a>
          </h4>
          <div class="base-search-card__metadata">
            <span class="job-search-card__location">
              Bengaluru, Karnataka, India
            </span>
            <time class="job-search-card__listdate--new" datetime="2026-09-09">
              10 hours ago
            </time>
          </div>
        </div>
      </div>
    </li>
  </ul>
`

test('extractSearchResults keeps India jobs from current LinkedIn guest search cards', async () => {
  const { extractSearchResults } = await loadCampusSutraModule()

  assert.deepEqual(extractSearchResults(currentLinkedInSearchCardHtml), [{
    title: 'Videographer',
    company: 'Campus Sutra',
    department: null,
    location: 'Bengaluru, Karnataka, India',
    city: 'Bengaluru',
    country: 'India',
    jobId: '4463844121',
    requisitionId: '4463844121',
    sourceUrl: 'https://in.linkedin.com/jobs/view/videographer-at-campus-sutra-4463844121?position=1&pageNum=0',
    applyUrl: 'https://in.linkedin.com/jobs/view/videographer-at-campus-sutra-4463844121?position=1&pageNum=0',
    employmentType: null,
    experienceRequired: null,
    minimumQualification: null,
    preferredQualification: null,
    requiredSkills: [],
    postingDate: '2026-09-09',
    closingDate: null,
    jobDescription: null,
  }])
})
