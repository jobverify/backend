import assert from 'node:assert/strict'
import test from 'node:test'

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Openings - Fingent Careers</title>
  </head>
  <body>
    <section class="open-positions careeropenings pb-85">
      <h1>Explore Our Current Openings</h1>
      <a href="https://www.fingent.com/careers/jobs/senior-consultant-magento-contract/">Senior Consultant &#8211; Magento (Contract) 4-10 Years</a>
      <a href="https://www.fingent.com/careers/jobs/junior-devops-engineer-devops-engineer/">Junior DevOps Engineer/DevOps Engineer 1-3Years</a>
      <a href="https://www.fingent.com/careers/jobs/associate-technical-lead-net/">Associate Technical Lead – .NET 8 - 14 years</a>
      <a href="https://www.fingent.com/careers/jobs/senior-software-engineer-net-4/">Senior Software Engineer .NET 6 - 8 years</a>
      <a href="https://www.fingent.com/careers/jobs/devops-engineer-2/">Junior DevOps Engineer 1-3Years</a>
      <a href="https://www.fingent.com/careers/jobs/data-engineer/">Data Engineer 6+ Years</a>
    </section>
  </body>
</html>
`

const loadProviderModule = async () => {
  try {
    return await import('../../scraper/fingent/provider.js')
  } catch {
    assert.fail('Expected Fingent provider module at ../../scraper/fingent/provider.js')
  }
}

const loadScriptModule = async () => {
  try {
    return await import('../../scraper/fingent/script.js')
  } catch {
    assert.fail('Expected Fingent scraper module at ../../scraper/fingent/script.js')
  }
}

test('Fingent exports local provider metadata for the verified Friday, August 14, 2026 first-party openings page', async () => {
  const providerModule = await loadProviderModule()
  const scriptModule = await loadScriptModule()

  assert.deepEqual(providerModule.provider, {
    source: 'fingent',
    companyName: 'Fingent',
    officialBrandName: 'Fingent',
    adapter: 'script',
    modulePath: '../../scraper/fingent/script.js',
    homepageUrl: 'https://www.fingent.com/careers/',
    companyCareerPage: 'https://www.fingent.com/careers/career-openings/',
    atsPlatform: 'official-first-party-openings-page',
    countryFilter: 'India',
    paginationStrategy: 'single-page-searchable-list',
    extractionStrategy: 'verified-first-party-openings-page+careers-jobs-links+public-title-and-experience',
    parser: 'custom-script',
    normalizationProfile: 'engineering-default',
    companyDomain: 'fingent.com',
    verifiedOn: '2026-08-14',
    verifiedSurfaceSummary:
      'Verified on Friday, August 14, 2026 that https://www.fingent.com/careers/ remained the live Fingent careers home with title "Home - Fingent Careers", and that https://www.fingent.com/careers/career-openings/ remained the live first-party Fingent openings page with title "Career Openings - Fingent Careers". The page publicly exposed /careers/jobs/ links such as Senior Consultant - Magento (Contract), Junior DevOps Engineer/DevOps Engineer, Associate Technical Lead - .NET, Senior Software Engineer .NET, and Data Engineer with visible experience ranges in the listing text.',
    dryRunFile: 'fingent/jobs.json',
  })

  assert.equal(scriptModule.SOURCE, providerModule.provider.source)
  assert.equal(scriptModule.COMPANY, providerModule.provider.companyName)
  assert.equal(scriptModule.CAREERS_URL, providerModule.provider.companyCareerPage)
  assert.equal(scriptModule.VERIFIED_AT, providerModule.provider.verifiedOn)
  assert.deepEqual(scriptModule.PROVIDER_METADATA, providerModule.provider)
})

test('Fingent extracts the verified Friday, August 14, 2026 current openings from the first-party openings page', async () => {
  const fingent = await loadScriptModule()

  assert.equal(fingent.hasOfficialCareersSignal(careersHtml), true)
  assert.deepEqual(
    fingent.extractOpenings(careersHtml).map((job) => [job.title, job.experience, job.sourceUrl]),
    [
      ['Senior Consultant - Magento (Contract)', '4-10 Years', 'https://www.fingent.com/careers/jobs/senior-consultant-magento-contract/'],
      ['Junior DevOps Engineer/DevOps Engineer', '1-3Years', 'https://www.fingent.com/careers/jobs/junior-devops-engineer-devops-engineer/'],
      ['Associate Technical Lead - .NET', '8 - 14 years', 'https://www.fingent.com/careers/jobs/associate-technical-lead-net/'],
      ['Senior Software Engineer .NET', '6 - 8 years', 'https://www.fingent.com/careers/jobs/senior-software-engineer-net-4/'],
      ['Junior DevOps Engineer', '1-3Years', 'https://www.fingent.com/careers/jobs/devops-engineer-2/'],
      ['Data Engineer', '6+ Years', 'https://www.fingent.com/careers/jobs/data-engineer/'],
    ],
  )

  await assert.rejects(fingent.run({fetchText:async()=>careersHtml,now:()=> '2026-08-14T00:00:00.000Z'}),/declared role-field author stylesheet/)
})

test('Fingent fails closed when the verified openings page changes materially or stops exposing public roles', async () => {
  const fingent = await loadScriptModule()

  await assert.rejects(
    fingent.run({
      fetchText: async () => '<html><title>Careers</title><body>Unexpected</body></html>',
    }),
    /verified first-party openings page changed materially/i,
  )

  await assert.rejects(
    fingent.run({
      fetchText: async () => `
        <html>
          <head><title>Career Openings - Fingent Careers</title></head>
          <body><h1>Explore Our Current Openings</h1><section class="open-positions careeropenings pb-85"></section></body>
        </html>
      `,
    }),
    /no longer exposes public roles|no active advertised roles/i,
  )
})
