import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Job Opening in MAPSystems</title>
    <meta
      name="description"
      content="View our current job openings for photo editing, graphic design, 3d, and more. Join the family of MAPSystems and fulfil your career dreams."
    >
  </head>
  <body>
    <section class="career-page">
      <div class="job-box">
        <p>
          1) Inside Sales Executive<br>
          Experience: 2-4 years<br>
          Education : Any degree or equivalent<br>
          Job Description<br>
          We are looking for a talented and competitive Inside Sales Representative that thrives in a quick sales cycle environment.<br>
          Interested applicants can email their profiles to: career@mapsystems.in
        </p>
      </div>
      <div class="job-box">
        <p>
          3) Jr Java Script / HTML5 Developer<br>
          Department : Game Development | Openings: 5 No's<br>
          Experience : 0-2 years<br>
          Education : Any Graduate<br>
          Job Summary<br>
          We are seeking a Jr Java Script Developer to join our high growth, creative organization at our office in Bangalore.<br>
          Interested applicants can email their profiles to: career@mapsystems.in
        </p>
      </div>
    </section>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/mapsystems/provider.js')
  } catch {
    assert.fail('Expected MAP Systems provider module at ../../scraper/mapsystems/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/mapsystems/script.js')
  } catch {
    assert.fail('Expected MAP Systems scraper module at ../../scraper/mapsystems/script.js')
  }
}

test('MAP Systems exports the verified first-party static careers-page contract', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'mapsystems',
    companyName: 'MAP Systems',
    officialBrandName: 'MAPSystems',
    adapter: 'script',
    modulePath: '../../scraper/mapsystems/script.js',
    homepageUrl: 'https://mapsystemsindia.com/',
    companyCareerPage: 'https://mapsystemsindia.com/careers.html',
    atsPlatform: 'first-party-static-careers-page',
    countryFilter: 'India',
    paginationStrategy: 'single-static-careers-page',
    extractionStrategy: 'verified-first-party-static-careers-page+job-box-text-sections+mailto-apply',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'mapsystemsindia.com',
    verifiedOn: '2026-07-18',
    verifiedSurfaceSummary:
      'Verified on Saturday, July 18, 2026 that https://mapsystemsindia.com/careers.html was the live first-party MAPSystems careers page, published static job-box text for roles including Inside Sales Executive and Jr Java Script / HTML5 Developer, and directed applicants to career@mapsystems.in for submissions.',
    dryRunFile: 'mapsystems/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('MAP Systems parses static first-party job boxes into India jobs', async () => {
  const mapsystems = await loadScriptModule()

  assert.equal(mapsystems.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(mapsystems.extractJobSections(careersHtml).length, 2)

  const jobs = await mapsystems.run({
    fetchText: async (url) => {
      assert.equal(url, mapsystems.CAREERS_URL)
      return careersHtml
    },
    now: () => '2026-07-18T00:00:00.000Z',
  })

  assert.deepEqual(jobs, [
    {
      title: 'Inside Sales Executive',
      company: 'MAP Systems',
      department: null,
      location: 'India',
      city: null,
      country: 'India',
      jobId: 'inside-sales-executive',
      requisitionId: 'inside-sales-executive',
      sourceUrl: 'https://mapsystemsindia.com/careers.html',
      applyUrl: 'mailto:career@mapsystems.in',
      employmentType: null,
      experienceRequired: '2-4 years',
      minimumQualification: 'Any degree or equivalent',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'We are looking for a talented and competitive Inside Sales Representative that thrives in a quick sales cycle environment.',
      link: 'mailto:career@mapsystems.in',
      source: 'mapsystems',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
    {
      title: 'Jr Java Script / HTML5 Developer',
      company: 'MAP Systems',
      department: 'Game Development',
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      jobId: 'jr-java-script-html5-developer',
      requisitionId: 'jr-java-script-html5-developer',
      sourceUrl: 'https://mapsystemsindia.com/careers.html',
      applyUrl: 'mailto:career@mapsystems.in',
      employmentType: null,
      experienceRequired: '0-2 years',
      minimumQualification: 'Any Graduate',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: null,
      closingDate: null,
      jobDescription:
        'We are seeking a Jr Java Script Developer to join our high growth, creative organization at our office in Bangalore.',
      link: 'mailto:career@mapsystems.in',
      source: 'mapsystems',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})
