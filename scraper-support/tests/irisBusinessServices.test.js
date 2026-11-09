import assert from 'node:assert/strict'
import test from 'node:test'

const loadCatalog = async () => import('../../scraper/irisbusinessservices/catalog.js')
const loadScript = async () => import('../../scraper/irisbusinessservices/script.js')

const currentOpeningsHtml = `<!doctype html><html><head><title>Current Openings | IRIS RegTech Solutions Limited</title></head>
<body><h1>Current Openings</h1><p>IRIS RegTech Solutions Limited (formerly known as IRIS Business Services Limited)</p>
<script>window.khConfig = {identifier: '01edd099-97eb-4b24-a38b-4f0d22b0e27f',domain: 'https://irsl.keka.com/careers/',targetContainer: '#khembedjobs'}</script>
<script src='https://irsl.keka.com/careers/api/embedjobs/js/01edd099-97eb-4b24-a38b-4f0d22b0e27f' defer></script>
<div id='khembedjobs'></div></body></html>`
const info = { name: 'IRIS RegTech Solutions Limited', shortName: 'IRIS RegTech Solutions Limited', careersPortalDomain: 'irsl.keka.com' }
const row = (id, locations) => ({ id, title: 'Software Engineer', description: '<p>Build regulatory software.</p>', jobLocations: locations,
  departmentName: 'Technology', publishedOn: '2026-09-29T06:44:46.9Z', jobType: 2, experience: '4-6', skillNames: ['Java'] })
const india = { city: 'Navi Mumbai', countryCode: 'IN', countryName: 'India' }

test('IRIS catalog points to the current first-party Keka handoff', async () => {
  const { IRIS_BUSINESS_SERVICES_CATALOG: catalog } = await loadCatalog()
  assert.equal(catalog.source, 'irisbusinessservices')
  assert.equal(catalog.companyCareerPage, 'https://irisregtech.com/about-us/careers/current-openings/')
  assert.equal(catalog.atsPlatform, 'keka')
  assert.equal(catalog.verifiedOn, '2026-10-03')
})

test('IRIS parses confirmed India postings and flags unknown geography', async () => {
  const iris = await loadScript()
  assert.equal(iris.hasOfficialCareersSignal(currentOpeningsHtml), true)
  const urls = []
  const jobs = await iris.run({
    fetchText: async url => { urls.push(url); return currentOpeningsHtml },
    fetchJson: async url => {
      urls.push(url)
      return url.includes('careerportalinfo') ? info : [row(143075, [india]), row(143076, [])]
    },
    now: () => '2026-10-03T00:00:00.000Z',
  })
  assert.deepEqual(urls, [iris.CAREERS_URL, iris.KEKA_INFO_URL, iris.KEKA_JOBS_URL])
  assert.equal(jobs.length, 1)
  assert.equal(jobs[0].title, 'Software Engineer')
  assert.equal(jobs[0].location, 'Navi Mumbai, India')
  assert.equal(jobs[0].sourceUrl, 'https://irsl.keka.com/careers/jobdetails/143075')
  assert.equal(jobs[0].applyUrl, 'https://irsl.keka.com/careers/applyjob/143075')
  assert.equal(jobs[0].sourceListingComplete, false)
  assert.equal(jobs[0].postingDate, '2026-09-29')
})

test('IRIS rejects an unlinked feed, wrong tenant, and malformed inventory', async () => {
  const iris = await loadScript()
  const execute = (html, details, payload) => iris.run({
    fetchText: async () => html,
    fetchJson: async url => url.includes('careerportalinfo') ? details : payload,
  })
  await assert.rejects(execute(currentOpeningsHtml.replace('irsl.keka.com', 'other.keka.com'), info, [row(1, [india])]), /first-party.*Keka/i)
  await assert.rejects(execute(currentOpeningsHtml, { ...info, careersPortalDomain: 'other.keka.com' }, [row(1, [india])]), /tenant identity/i)
  await assert.rejects(execute(currentOpeningsHtml, info, [row(1, [india]), row(1, [india])]), /duplicate/i)
  await assert.rejects(execute(currentOpeningsHtml, info, { jobs: [] }), /array/i)
})
