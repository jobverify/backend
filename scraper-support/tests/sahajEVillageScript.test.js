import assert from 'node:assert/strict'
import test from 'node:test'

const companyInfoHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h1>AAJEEVIKA / SGSY Special Project</h1>
    <p>Implemented by: Sahaj e Village Ltd.</p>
    <h2>About THE PIA</h2>
    <p>Sahaj e-Village Ltd, an ISO 27001 company, a Srei Venture Initiative, has the mission of bridging the digital divide between rural and urban India.</p>
    <p>Name of Organization/Institution Sahaj E Village Ltd.</p>
    <p>Registration Details of the Organisation Registered under Co Act of 1956 vide registration Number 95455</p>
    <p>@ Copyright 2012-2013 SeVL . All Rights Reserved</p>
  </body>
</html>
`

const learningJoinUsHtml = `
<!doctype html>
<html lang="en">
  <body>
    <h2>Why Join Sahaj eLearning Courses</h2>
    <h2>Benefits of e Shiksha</h2>
    <h2>Sahaj Certificate</h2>
    <h2>NSDC Certificate</h2>
    <h2>Sahaj e Shiksha Course Fees</h2>
    <p>JOB - TRAINER</p>
    <p>DOMESTIC_DATA_ENTRY_OPERATOR_2010</p>
    <p>© Sahaj e-Village Limited Best viewed in Google Chrome version 60 and above</p>
  </body>
</html>
`

const publicCompanyJobsHtml = `
<!doctype html>
<html lang="en">
  <head>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"JobPosting","title":"Training Program Manager"}
    </script>
  </head>
  <body>
    <h2>Why Join Sahaj eLearning Courses</h2>
    <h2>Benefits of e Shiksha</h2>
    <h2>Sahaj Certificate</h2>
    <h2>NSDC Certificate</h2>
    <h2>Sahaj e Shiksha Course Fees</h2>
    <h1>Current Openings</h1>
    <a href="/careers/training-program-manager">Apply Now</a>
    <p>© Sahaj e-Village Limited Best viewed in Google Chrome version 60 and above</p>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/sahajevillage/script.js')
  } catch {
    assert.fail('Expected Sahaj e-Village scraper module at ../../scraper/sahajevillage/script.js')
  }
}

test('Sahaj e-Village sentinel helpers stay pinned to the verified exact-name legacy surfaces', async () => {
  const sahajEVillage = await loadModule()

  assert.equal(sahajEVillage.SOURCE, 'sahajevillage')
  assert.equal(sahajEVillage.COMPANY, 'Sahaj e-Village')
  assert.equal(sahajEVillage.OFFICIAL_BRAND_NAME, 'Sahaj e-Village Limited')
  assert.equal(sahajEVillage.VERIFIED_ON, '2026-07-17')
  assert.equal(sahajEVillage.COMPANY_INFO_URL, 'https://skilldevelopment.sahajcorporate.com/')
  assert.equal(
    sahajEVillage.LEARNING_HOME_URL,
    'https://cblearning.sahajcorporate.com/elportal/home/index.php',
  )
  assert.equal(
    sahajEVillage.LEARNING_JOIN_US_URL,
    'https://cblearning.sahajcorporate.com/elportal/home/join_us.php',
  )
  assert.equal(sahajEVillage.hasOfficialCompanyInfoSignal(companyInfoHtml), true)
  assert.equal(sahajEVillage.hasOfficialLearningJoinUsSignal(learningJoinUsHtml), true)
  assert.equal(sahajEVillage.hasPublicCompanyJobsSignal(learningJoinUsHtml), false)
  assert.equal(sahajEVillage.hasPublicCompanyJobsSignal(publicCompanyJobsHtml), true)
  assert.match(sahajEVillage.VERIFIED_SURFACE_SUMMARY, /no trustworthy public company jobs surface/i)
})

test('Sahaj e-Village sentinel returns [] only while the verified legacy first-party pages remain non-corporate-job surfaces', async () => {
  const sahajEVillage = await loadModule()
  const requestedUrls = []

  const jobs = await sahajEVillage.createSahajEVillageScraper().run({
    fetchPage: async (url) => {
      requestedUrls.push(url)

      if (url === sahajEVillage.COMPANY_INFO_URL) {
        return { status: 200, url, html: companyInfoHtml }
      }

      if (url === sahajEVillage.LEARNING_JOIN_US_URL) {
        return { status: 200, url, html: learningJoinUsHtml }
      }

      throw new Error(`Unexpected Sahaj e-Village URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    sahajEVillage.COMPANY_INFO_URL,
    sahajEVillage.LEARNING_JOIN_US_URL,
  ])
  assert.deepEqual(jobs, [])
})

test('Sahaj e-Village sentinel fails closed when the verified legacy contract drifts or starts exposing company jobs', async () => {
  const sahajEVillage = await loadModule()

  await assert.rejects(
    sahajEVillage.createSahajEVillageScraper().run({
      fetchPage: async (url) => {
        if (url === sahajEVillage.COMPANY_INFO_URL) {
          return {
            status: 200,
            url,
            html: companyInfoHtml.replace('registration Number 95455', 'registration Number 00000'),
          }
        }

        throw new Error(`Unexpected Sahaj e-Village URL: ${url}`)
      },
    }),
    /company info/i,
  )

  await assert.rejects(
    sahajEVillage.createSahajEVillageScraper().run({
      fetchPage: async (url) => {
        if (url === sahajEVillage.COMPANY_INFO_URL) {
          return { status: 200, url, html: companyInfoHtml }
        }

        if (url === sahajEVillage.LEARNING_JOIN_US_URL) {
          return { status: 200, url, html: publicCompanyJobsHtml }
        }

        throw new Error(`Unexpected Sahaj e-Village URL: ${url}`)
      },
    }),
    /public company jobs/i,
  )
})
