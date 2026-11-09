import assert from 'node:assert/strict'
import test from 'node:test'

const loadModule = async () => import('./script.js')

const careersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Career Opportunities at Tradingo</title>
  </head>
  <body>
    <h1>Work with us !</h1>
    <p>Be a part of the tribe</p>
    <section>
      <h2>Job Opportunities</h2>
      <h3>Sales</h3>
      <div class="w-row">
        <div class="column-34 w-col w-col-6">
          <div class="div-block-248">
            <div class="div-block-294">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url"
                target="_blank"
                class="link-block-11 w-inline-block"
              >
                <h4 class="heading-102">Customer Acquisition Manager</h4>
              </a>
              <p class="paragraph-135">Experience required : 3 - 5 years</p>
              <p class="paragraph-135">Qualification : Any Bachelor's/Graduation degree</p>
            </div>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url"
              target="_blank"
              class="link-13"
            >
              APPLY
            </a>
          </div>
        </div>
        <div class="column-35 w-col w-col-6">
          <div class="div-block-248">
            <div class="div-block-294">
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url"
                target="_blank"
                class="link-block-11 w-inline-block"
              >
                <h4 class="heading-102">Relationship Manager</h4>
              </a>
              <p class="paragraph-135">Experience required : 3 - 5 years</p>
              <p class="paragraph-135">Qualification : Any Bachelor's/Graduation degree</p>
            </div>
            <a
              href="https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url"
              target="_blank"
              class="link-13"
            >
              APPLY
            </a>
          </div>
        </div>
      </div>
    </section>
    <section>
      <h2>Why be a part of Tradingo ?</h2>
    </section>
  </body>
</html>
`

test('Tradingo recognizes the current careers shell and extracts same-page role blocks from the live section layout', async () => {
  const tradingo = await loadModule()

  assert.equal(tradingo.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(
    tradingo.extractSharedApplyUrl(careersHtml),
    'https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url',
  )

  const jobs = tradingo.extractRoleCards(careersHtml)
  assert.equal(jobs.length, 2)
  assert.deepEqual(jobs[0], {
    title: 'Customer Acquisition Manager',
    company: 'Tradingo',
    department: 'Sales',
    location: null,
    city: null,
    country: null,
    jobId: 'customer-acquisition-manager',
    requisitionId: null,
    sourceUrl: 'https://www.gotradingo.com/careers#customer-acquisition-manager',
    applyUrl:
      'https://docs.google.com/forms/d/e/1FAIpQLSfNz7KmZ4ywOs8qJI2RhykU9kCzSZZxxRIJdk-ZkupIbZ4Nqw/viewform?usp=pp_url',
    employmentType: null,
    experienceRequired: '3 - 5 years',
    minimumQualification: "Any Bachelor's/Graduation degree",
    preferredQualification: null,
    requiredSkills: [],
    postingDate: null,
    closingDate: null,
    jobDescription:
      "Experience required: 3 - 5 years Qualification: Any Bachelor's/Graduation degree",
  })
})

test('Tradingo returns the current same-page roles with the shared Google Form apply route', async () => {
  const tradingo = await loadModule()

  const jobs = await tradingo.createTradingoScraper({
    now: () => '2026-08-06T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      assert.equal(url, tradingo.CAREERS_URL)
      return careersHtml
    },
  })

  assert.equal(jobs.length, 2)
  assert.equal(jobs[0].source, 'tradingo')
  assert.equal(
    jobs[0].link,
    'https://www.gotradingo.com/careers#customer-acquisition-manager',
  )
  assert.equal(jobs[1].title, 'Relationship Manager')
  assert.equal(jobs[1].department, 'Sales')
  assert.equal(jobs[1].scrapedAt, '2026-08-06T00:00:00.000Z')
})
