import assert from 'node:assert/strict'
import test from 'node:test'

const currentCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ixigo careers</title>
    <meta name="description" content="ixigo careers" />
  </head>
  <body>
    <p>Join our team of 250+ passionate folks</p>
    <h1>we are changing the way India travels.</h1>
    <section id="openings">
      <div class="self-center text-5xl text-center font-extrabold text-white px-[13%] mb-12">Open roles</div>
      <div class="w-full border-b-2 grid grid-col-1 py-6">
        <div class="text-center place-self-center justify-self-center self-center">No Jobs Found</div>
      </div>
      <div class="justify-center self-center text-greyClr text-center font-extrabold text-2xl mb-4">
        Could not find an open position that excites you ?
      </div>
      <div class="justify-center self-center mb-2">
        <a rel="noreferrer" href="/cdn-cgi/l/email-protection#1231332037372021">Apply for Another Position</a>
      </div>
    </section>
  </body>
</html>
`

const currentCareersWithJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>ixigo careers</title>
  </head>
  <body>
    <p>Join our team of 250+ passionate folks</p>
    <h1>we are changing the way India travels.</h1>
    <section id="openings">
      <div>Open roles</div>
      <article class="job-card">
        <a href="https://www.ixigo.com/about/careers/research-engineer/">Research Engineer</a>
      </article>
    </section>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/ixigo/script.js')
  } catch {
    assert.fail('Expected ixigo scraper module at ../../scraper/ixigo/script.js')
  }
}

const opening = {
  jobVacancyId: '13351237674', companyIdentifier: 'ixigo',
  publicationId: '744000148960834', destinationCode: 'WIDGET',
  uuid: 'f7bae47a-f4b8-4ef1-bf37-cab734479a36', urlJobName: 'full-stack-intern-b2b',
  vacancyName: 'Full-Stack Intern - B2B', companyName: 'ixigo', refNumber: 'REF392P',
  typeOfEmployment: 'Full-time', departmentId: null, department: null,
  location: 'Gurugram', locationRemote: false, locationHybrid: false,
  locationHybridDescription: null, releasedDate: 1789116667416,
  customFieldValues: [{ fieldId: 'COUNTRY', fieldLabel: 'Country/Region', valueId: 'in', valueLabel: 'India' }],
  regionAbbreviation: 'HR', countryAbbreviation: 'in', countryName: 'India', languageCode: 'en',
}
const apiUrl = 'https://careers.ixigo.com/api/openings'

test('ixigo reads the public openings API even when server HTML says No Jobs Found', async () => {
  const ixigo = await loadModule()
  const requested = []
  const jobs = await ixigo.run({ fetchPage: async url => {
    requested.push(url)
    if (url === ixigo.CURRENT_CAREERS_URL) return { status: 200, url, html: currentCareersHtml }
    if (url === apiUrl) return { status: 200, url, html: JSON.stringify({ data: { results: [opening], numFound: 1 } }) }
    if (url === 'https://api.smartrecruiters.com/v1/companies/ixigo/postings/'+opening.jobVacancyId) return {status:200,url,html:JSON.stringify({
      id:opening.jobVacancyId,name:opening.vacancyName,refNumber:opening.refNumber,company:{name:'ixigo',identifier:'ixigo'},location:{country:'in'},active:true,visibility:'PUBLIC',
      postingUrl:'https://jobs.smartrecruiters.com/ixigo/744000148960834-full-stack-intern-b2b',applyUrl:'https://jobs.smartrecruiters.com/ixigo/744000148960834-full-stack-intern-b2b?oga=true',
      jobAd:{sections:{jobDescription:{text:'<p>Develop production services for the travel platform, collaborate with engineers on technical designs, investigate incidents and improve the reliability and performance of customer applications.</p>'}}},
    })}
    throw new Error('Retired legacy careers redirect should not be required')
  } })
  assert.deepEqual(requested, [ixigo.CURRENT_CAREERS_URL, apiUrl,'https://api.smartrecruiters.com/v1/companies/ixigo/postings/'+opening.jobVacancyId,apiUrl])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Full-Stack Intern - B2B')
  assert.equal(jobs[0].link, 'https://jobs.smartrecruiters.com/ixigo/744000148960834-full-stack-intern-b2b')
  assert.ok(jobs[0].sourceDescription.length>100)
  assert.equal(jobs[0].country, 'India')
  assert.equal(jobs[0].location, 'Gurugram')
  assert.equal(jobs[0].requisitionId, 'REF392P')
})

test('ixigo rejects API errors, malformed records, and truncated results despite the empty HTML placeholder', async () => {
  const ixigo = await loadModule()
  for (const response of [
    { status: 503, html: 'Unavailable' },
    { status: 200, html: JSON.stringify({ error: 'unavailable' }) },
    { status: 200, html: JSON.stringify({ data: { results: [opening], numFound: 2 } }) },
    { status: 200, html: JSON.stringify({ data: { results: [{ ...opening, companyIdentifier: 'unrelated' }], numFound: 1 } }) },
    { status: 200, html: JSON.stringify({ data: { results: [{ ...opening, countryAbbreviation: '' }], numFound: 1 } }) },
  ]) await assert.rejects(ixigo.run({ fetchPage: async url => url === apiUrl
    ? { url, ...response } : { status: 200, url: ixigo.CURRENT_CAREERS_URL, html: currentCareersHtml },
  }), /openings|incomplete|record|company|country/i)
})

test('ixigo only returns empty after a complete API response and filters country eligibility', async () => {
  const ixigo = await loadModule()
  for (const results of [[], [{ ...opening, location: 'Indianapolis, IN', countryAbbreviation: 'us', countryName: 'United States' }]]) {
    assert.deepEqual(await ixigo.run({ fetchPage: async url => ({ status: 200, url,
      html: url === apiUrl ? JSON.stringify({ data: { results, numFound: results.length } }) : currentCareersHtml,
    }) }), [])
  }
})

test('ixigo sentinel pins the verified legacy redirect and current no-jobs careers page URLs', async () => {
  const ixigo = await loadModule()

  assert.equal(ixigo.SOURCE, 'ixigo')
  assert.equal(ixigo.COMPANY, 'ixigo')
  assert.equal(ixigo.HOMEPAGE_URL, 'https://www.ixigo.com/')
  assert.equal(ixigo.LEGACY_CAREERS_URL, 'https://www.ixigo.com/about/careers/')
  assert.equal(ixigo.CURRENT_CAREERS_URL, 'https://careers.ixigo.com/')
  assert.equal(ixigo.hasOfficialCareersSignal(currentCareersHtml), true)
  assert.equal(ixigo.hasVerifiedNoJobsSignal(currentCareersHtml), true)
  assert.equal(ixigo.hasVerifiedNoJobsSignal(currentCareersWithJobsHtml), false)
})

test('ixigo validates the current first-party page before requesting openings', async () => {
  const ixigo = await loadModule()
  for (const page of [
    { status: 503, url: ixigo.CURRENT_CAREERS_URL, html: currentCareersHtml },
    { status: 200, url: ixigo.LEGACY_CAREERS_URL, html: currentCareersHtml },
    { status: 200, url: ixigo.CURRENT_CAREERS_URL, html: '<main>Unexpected page</main>' },
  ]) await assert.rejects(ixigo.run({ fetchPage: async url => {
    assert.equal(url, ixigo.CURRENT_CAREERS_URL)
    return page
  } }), /current careers page|official ixigo careers page/i)
})
