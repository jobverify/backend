import assert from 'node:assert/strict'
import test from 'node:test'

const archivePageOneHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Archive | TAAL Tech</title>
  </head>
  <body>
    <h1>Careers</h1>
    <article class="job-card">
      <h2><a href="https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/">Technical Publications Engineer (Video-Based Training)</a></h2>
      <a class="apply" href="https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/">Apply Now</a>
      <p>Full Time</p>
      <p>Bangalore</p>
      <p>Posted 3 weeks ago</p>
    </article>
    <article class="job-card">
      <h2><a href="https://www.taaltech.com/careers/field-service-engineer/">Field Service Engineer</a></h2>
      <a class="apply" href="https://www.taaltech.com/careers/field-service-engineer/">Apply Now</a>
      <p>Full Time</p>
      <p>United States</p>
      <p>Posted 2 weeks ago</p>
    </article>
    <a class="next page-numbers" href="https://www.taaltech.com/careers/page/2/">2</a>
  </body>
</html>
`

const archivePageTwoHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Archive | Page 2 of 3 | TAAL Tech</title>
  </head>
  <body>
    <h1>Careers</h1>
    <article class="job-card">
      <h2><a href="https://www.taaltech.com/careers/piping-designers-plant-3d/">Piping Designers - Plant 3D</a></h2>
      <a class="apply" href="https://www.taaltech.com/careers/piping-designers-plant-3d/">Apply Now</a>
      <p>Full Time</p>
      <p>Bangalore</p>
      <p>Posted 2 months ago</p>
    </article>
    <a class="next page-numbers" href="https://www.taaltech.com/careers/page/3/">3</a>
  </body>
</html>
`

const archivePageThreeHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Archive | Page 3 of 3 | TAAL Tech</title>
  </head>
  <body>
    <h1>Careers</h1>
    <p>No jobs found</p>
  </body>
</html>
`

const currentArchivePageHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Jobs Archive | TAAL Tech</title>
  </head>
  <body>
    <h1>Careers</h1>
    <!-- <li class="extra-design-button"><a href="contact.html">Contact Us</a></li> -->
    <h4><a href="https://www.taaltech.com/careers/civil-and-structural-designer-2/">Civil and Structural designer</a></h4>
    <a href="https://www.taaltech.com/careers/civil-and-structural-designer-2/">Apply Now</a>
    <p>Full Time</p>
    <p>Bangalore</p>
    <p>Posted 3 days ago</p>

    <h4><a href="https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/">Technical Publications Engineer (Video-Based Training)</a></h4>
    <a href="https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/">Apply Now</a>
    <p>Full Time</p>
    <p>Bangalore</p>
    <p>Posted 1 month ago</p>
  </body>
</html>
`

const technicalPublicationsDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Technical Publications Engineer (Video-Based Training) | TAAL Tech</title>
  </head>
  <body>
    <h1>Technical Publications Engineer (Video-Based Training)</h1>
    <p>Position name | Technical Publications Engineer (Video-Based Training)</p>
    <p>No. of positions | 1</p>
    <p>Education required | BE / BTech</p>
    <p>Experience required | 5+ Years</p>
    <p>Skills required | Create user guides, work instructions, and training documentation.</p>
    <h2>Apply For This Job</h2>
  </body>
</html>
`

const pipingDesignersDetailHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Piping Designers - Plant 3D | TAAL Tech</title>
  </head>
  <body>
    <h1>Piping Designers - Plant 3D</h1>
    <p>Position name | Piping Designer - Plant 3D</p>
    <p>No. of positions | 20</p>
    <p>Education required | Diploma / BE</p>
    <p>Experience required | 5+ Years</p>
    <p>Skills required | Proficient in AutoCAD Plant 3D.</p>
    <h2>Apply For This Job</h2>
  </body>
</html>
`

const loadModule = async () => {
  try {
    return await import('../../scraper/taaltechindia/script.js')
  } catch {
    assert.fail('Expected TAAL Tech India scraper module at ../../scraper/taaltechindia/script.js')
  }
}

test('TAAL Tech India helpers stay pinned to the verified first-party jobs archive and detail pages', async () => {
  const taal = await loadModule()

  assert.equal(taal.hasOfficialArchiveSignal(archivePageOneHtml), true)
  assert.equal(taal.hasNoJobsFoundSignal(archivePageThreeHtml), true)
  assert.equal(taal.hasNextArchivePageSignal(archivePageOneHtml), true)
  assert.equal(taal.hasNextArchivePageSignal(archivePageThreeHtml), false)
  assert.deepEqual(taal.extractListingCards(archivePageOneHtml), [
    {
      title: 'Technical Publications Engineer (Video-Based Training)',
      detailUrl: 'https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/',
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedLabel: 'Posted 3 weeks ago',
    },
    {
      title: 'Field Service Engineer',
      detailUrl: 'https://www.taaltech.com/careers/field-service-engineer/',
      employmentType: 'Full Time',
      location: 'United States',
      postedLabel: 'Posted 2 weeks ago',
    },
  ])
  assert.deepEqual(taal.extractJobDetail(technicalPublicationsDetailHtml), {
    canonicalTitle: 'Technical Publications Engineer (Video-Based Training)',
    jobDescription:
      'Position name | Technical Publications Engineer (Video-Based Training) No. of positions | 1 Education required | BE / BTech Experience required | 5+ Years Skills required | Create user guides, work instructions, and training documentation.',
    minimumQualification: 'BE / BTech',
    experienceRequired: '5+ Years',
  })
  assert.deepEqual(taal.extractListingCards(currentArchivePageHtml), [
    {
      title: 'Civil and Structural designer',
      detailUrl: 'https://www.taaltech.com/careers/civil-and-structural-designer-2/',
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedLabel: 'Posted 3 days ago',
    },
    {
      title: 'Technical Publications Engineer (Video-Based Training)',
      detailUrl: 'https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/',
      employmentType: 'Full Time',
      location: 'Bangalore',
      postedLabel: 'Posted 1 month ago',
    },
  ])
})

test('TAAL Tech India run paginates the verified jobs archive, filters to India roles, and decorates detail pages', async () => {
  const taal = await loadModule()
  const requestedUrls = []

  const jobs = await taal.createTaalTechIndiaScraper({
    now: () => '2026-07-18T00:00:00.000Z',
  }).run({
    fetchText: async (url) => {
      requestedUrls.push(url)

      if (url === taal.CAREERS_URL) return archivePageOneHtml
      if (url === taal.buildArchivePageUrl(2)) return archivePageTwoHtml
      if (url === taal.buildArchivePageUrl(3)) return archivePageThreeHtml
      if (url === 'https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/') {
        return technicalPublicationsDetailHtml
      }
      if (url === 'https://www.taaltech.com/careers/piping-designers-plant-3d/') {
        return pipingDesignersDetailHtml
      }

      throw new Error(`Unexpected TAAL Tech URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [
    taal.CAREERS_URL,
    'https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/',
    taal.buildArchivePageUrl(2),
    'https://www.taaltech.com/careers/piping-designers-plant-3d/',
    taal.buildArchivePageUrl(3),
  ])

  assert.deepEqual(jobs, [
    {
      jobId: 'piping-designers-plant-3d',
      title: 'Piping Designers - Plant 3D',
      company: 'Taal Tech India',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      sourceUrl: 'https://www.taaltech.com/careers/piping-designers-plant-3d/',
      applyUrl: 'https://www.taaltech.com/careers/piping-designers-plant-3d/',
      link: 'https://www.taaltech.com/careers/piping-designers-plant-3d/',
      employmentType: 'Full Time',
      experienceRequired: '5+ Years',
      minimumQualification: 'Diploma / BE',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: 'Posted 2 months ago',
      closingDate: null,
      jobDescription:
        'Position name | Piping Designer - Plant 3D No. of positions | 20 Education required | Diploma / BE Experience required | 5+ Years Skills required | Proficient in AutoCAD Plant 3D.',
      remoteStatus: 'On-site',
      source: 'taaltechindia',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
    {
      jobId: 'technical-publications-engineer-video-based-training',
      title: 'Technical Publications Engineer (Video-Based Training)',
      company: 'Taal Tech India',
      department: null,
      location: 'Bangalore, India',
      city: 'Bangalore',
      country: 'India',
      sourceUrl: 'https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/',
      applyUrl: 'https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/',
      link: 'https://www.taaltech.com/careers/technical-publications-engineer-video-based-training/',
      employmentType: 'Full Time',
      experienceRequired: '5+ Years',
      minimumQualification: 'BE / BTech',
      preferredQualification: null,
      requiredSkills: [],
      postingDate: 'Posted 3 weeks ago',
      closingDate: null,
      jobDescription:
        'Position name | Technical Publications Engineer (Video-Based Training) No. of positions | 1 Education required | BE / BTech Experience required | 5+ Years Skills required | Create user guides, work instructions, and training documentation.',
      remoteStatus: 'On-site',
      source: 'taaltechindia',
      scrapedAt: '2026-07-18T00:00:00.000Z',
    },
  ])
})

test('TAAL Tech India fails closed when the verified jobs archive drifts materially', async () => {
  const taal = await loadModule()

  await assert.rejects(
    taal.createTaalTechIndiaScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected</h1></body></html>',
    }),
    /verified taal tech jobs archive/i,
  )
})

test('TAAL Tech India returns an empty result when the live archive host times out', async () => {
  const taal = await loadModule()

  const jobs = await taal.createTaalTechIndiaScraper().run({
    fetchText: async () => {
      const error = new TypeError('fetch failed')
      error.cause = {
        code: 'UND_ERR_CONNECT_TIMEOUT',
        message: 'Connect Timeout Error (attempted addresses: 172.67.140.63:443, 104.21.27.7:443, timeout: 10000ms)',
      }
      throw error
    },
  })

  assert.deepEqual(jobs, [])
})
