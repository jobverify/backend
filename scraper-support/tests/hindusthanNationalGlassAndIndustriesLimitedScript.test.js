import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const fixturesDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'fixtures',
  'hindusthannationalglassandindustrieslimited',
)

const readFixture = (name) => readFileSync(path.join(fixturesDir, name), 'utf8')

const loadModule = async () => {
  try {
    return await import('../../scraper/hindusthannationalglassandindustrieslimited/script.js')
  } catch {
    assert.fail('Expected Hindusthan National Glass & Industries Limited scraper module at ../../scraper/hindusthannationalglassandindustrieslimited/script.js')
  }
}

test('HNG validates the verified first-party current vacancies page and parses inline openings', async () => {
  const hng = await loadModule()
  const careersHtml = readFixture('current-vacancies.html')

  assert.equal(hng.SOURCE, 'hindusthannationalglassandindustrieslimited')
  assert.equal(hng.COMPANY, 'Hindusthan National Glass & Industries Limited')
  assert.equal(hng.HOMEPAGE_URL, 'https://www.hngil.com/')
  assert.equal(hng.CAREERS_URL, 'https://www.hngil.com/p/current-vacancies-1')
  assert.equal(hng.hasOfficialCareersSignal(careersHtml), true)
  assert.equal(hng.extractApplicationFormUrl(careersHtml), null)
  assert.equal(hng.pageExposesMaterialActionLinkChange(careersHtml), false)

  assert.deepEqual(
    hng.extractVacancyRows(careersHtml).map((job) => ({
      title: job.title,
      department: job.department,
      requisitionId: job.requisitionId,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      publicExperienceChecked: job.publicExperienceChecked,
    })),
    [
      {
        title: 'Dy.GM/AGM',
        department: 'Production',
        requisitionId: 'P01NDP/PCH',
        sourceUrl: 'https://www.hngil.com/p/current-vacancies-1',
        applyUrl: 'https://www.hngil.com/p/current-vacancies-1',
        publicExperienceChecked: true,
      },
      {
        title: 'Dy.Manager/Asst.Manager',
        department: 'Production',
        requisitionId: 'P02SNR/NDP/RSR',
        sourceUrl: 'https://www.hngil.com/p/current-vacancies-1',
        applyUrl: 'https://www.hngil.com/p/current-vacancies-1',
        publicExperienceChecked: true,
      },
      {
        title: 'Shift Engineer',
        department: 'Production',
        requisitionId: 'P03SNR/NDP',
        sourceUrl: 'https://www.hngil.com/p/current-vacancies-1',
        applyUrl: 'https://www.hngil.com/p/current-vacancies-1',
        publicExperienceChecked: true,
      },
      {
        title: 'Sr. Technician/Technician/Jr. Technician',
        department: 'Production',
        requisitionId: 'P03SNR/NDP/RSR/BGH',
        sourceUrl: 'https://www.hngil.com/p/current-vacancies-1',
        applyUrl: 'https://www.hngil.com/p/current-vacancies-1',
        publicExperienceChecked: true,
      },
      {
        title: 'Dy.GM/AGM',
        department: 'Quality',
        requisitionId: 'Q01RSR',
        sourceUrl: 'https://www.hngil.com/p/current-vacancies-1',
        applyUrl: 'https://www.hngil.com/p/current-vacancies-1',
        publicExperienceChecked: true,
      },
    ],
  )
})

test('HNG scraper returns the verified inline vacancies from the current first-party surface', async () => {
  const hng = await loadModule()
  const careersHtml = readFixture('current-vacancies.html')
  const requestedUrls = []

  const jobs = await hng.createHindusthanNationalGlassAndIndustriesLimitedScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      if (url === hng.CAREERS_URL) return careersHtml
      throw new Error(`Unexpected URL: ${url}`)
    },
  })

  assert.deepEqual(requestedUrls, [hng.CAREERS_URL])
  assert.equal(jobs.length, 5)
  assert.deepEqual(
    jobs.map((job) => ({
      title: job.title,
      department: job.department,
      country: job.country,
      sourceUrl: job.sourceUrl,
      applyUrl: job.applyUrl,
      publicExperienceChecked: job.publicExperienceChecked,
    })),
    [
      {
        title: 'Dy.GM/AGM',
        department: 'Production',
        country: 'India',
        sourceUrl: hng.CAREERS_URL,
        applyUrl: hng.CAREERS_URL,
        publicExperienceChecked: true,
      },
      {
        title: 'Dy.Manager/Asst.Manager',
        department: 'Production',
        country: 'India',
        sourceUrl: hng.CAREERS_URL,
        applyUrl: hng.CAREERS_URL,
        publicExperienceChecked: true,
      },
      {
        title: 'Shift Engineer',
        department: 'Production',
        country: 'India',
        sourceUrl: hng.CAREERS_URL,
        applyUrl: hng.CAREERS_URL,
        publicExperienceChecked: true,
      },
      {
        title: 'Sr. Technician/Technician/Jr. Technician',
        department: 'Production',
        country: 'India',
        sourceUrl: hng.CAREERS_URL,
        applyUrl: hng.CAREERS_URL,
        publicExperienceChecked: true,
      },
      {
        title: 'Dy.GM/AGM',
        department: 'Quality',
        country: 'India',
        sourceUrl: hng.CAREERS_URL,
        applyUrl: hng.CAREERS_URL,
        publicExperienceChecked: true,
      },
    ],
  )
  assert.ok(jobs.every((job) => job.publicExperienceChecked === true))
})

test('HNG scraper fails closed when the verified first-party vacancies contract changes materially', async () => {
  const hng = await loadModule()
  const careersHtml = readFixture('current-vacancies.html')

  await assert.rejects(
    hng.createHindusthanNationalGlassAndIndustriesLimitedScraper().run({
      fetchText: async () => '<html><body><h1>Unexpected careers page</h1></body></html>',
    }),
    /verified official current vacancies surface/i,
  )

  await assert.rejects(
    hng.createHindusthanNationalGlassAndIndustriesLimitedScraper().run({
      fetchText: async () => careersHtml.replace(
        '<a class="btn-view-details">View/Download Detail</a>',
        '<a class="btn-view-details" href="/uploads/jobs/P01NDP-PCH.pdf">View/Download Detail</a>',
      ),
    }),
    /material action link change/i,
  )
})
