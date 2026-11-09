import assert from 'node:assert/strict'
import test from 'node:test'

const loadCromptonModule = async () => {
  try {
    return await import('../../scraper/crompton/script.js')
  } catch {
    assert.fail('Expected Crompton scraper module at ../../scraper/scraper/crompton/script.js')
  }
}

const sampleHtml = `
<h2>Current Openings</h2>
<ul class="career_list" id="filter-sec">
  <li class="scale-anm all Sales ">
    <span>Territory Sales Manager - All India <div class="career_badge"><span class="badge">Sales</span></div></span>
    <a href="mailto:recruitment@crompton.co.in?subject=Applying for Territory Sales Manager - All India" class="btn_common">Apply Now</a>
  </li>
  <li class="scale-anm all Innovation ">
    <span>Associate Manager - Electronics Design - Mumbai <div class="career_badge"><span class="badge">Innovation Centre</span></div></span>
    <a href="mailto:recruitment@crompton.co.in?subject=Applying for Associate Manager - Electronics Design - Mumbai" class="btn_common">Apply Now</a>
  </li>
</section>
`

test('extractSearchResults maps Crompton official careers cards into job records', async () => {
  const crompton = await loadCromptonModule()
  const jobs = crompton.extractSearchResults(sampleHtml)

  assert.equal(crompton.pageIndicatesJobCards(sampleHtml), true)
  assert.deepEqual(jobs, [
    {
      title: 'Associate Manager - Electronics Design',
      company: 'Crompton Greaves Consumer Electricals Limited',
      department: 'Innovation Centre',
      location: 'Mumbai, India',
      city: 'Mumbai',
      country: 'India',
      jobId: 'crompton-associate-manager-electronics-design-mumbai',
      requisitionId: null,
      sourceUrl: 'https://www.crompton.co.in/pages/careers',
      applyUrl: 'mailto:recruitment@crompton.co.in?subject=Applying for Associate Manager - Electronics Design - Mumbai',
      employmentType: null,
      experienceRequired: null,
      publicExperienceChecked: true,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply via the Crompton careers page.',
    },
    {
      title: 'Territory Sales Manager',
      company: 'Crompton Greaves Consumer Electricals Limited',
      department: 'Sales',
      location: 'All India',
      city: null,
      country: 'India',
      jobId: 'crompton-territory-sales-manager-all-india',
      requisitionId: null,
      sourceUrl: 'https://www.crompton.co.in/pages/careers',
      applyUrl: 'mailto:recruitment@crompton.co.in?subject=Applying for Territory Sales Manager - All India',
      employmentType: null,
      experienceRequired: null,
      publicExperienceChecked: true,
      minimumQualification: null,
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription: 'Apply via the Crompton careers page.',
    },
  ])
})

test('run fetches and decorates Crompton public career openings', async () => {
  const crompton = await loadCromptonModule()
  const requestedUrls = []
  const scraper = crompton.createCromptonScraper({ maxJobs: 1 })

  const jobs = await scraper.run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      return sampleHtml
    },
  })

  assert.deepEqual(requestedUrls, [crompton.CAREER_PAGE_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].source, 'crompton')
  assert.equal(jobs[0].link, jobs[0].applyUrl)
})
