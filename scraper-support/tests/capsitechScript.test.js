import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const {captures}=JSON.parse(gunzipSync(fs.readFileSync(new URL('../../scraper/capsitech/test-data/native-20261103.json.gz',import.meta.url))))
const currentNativeHtml=Buffer.from(captures['production-careers'].body,'base64').toString()
const currentNativePayload=JSON.parse(Buffer.from(captures['production-listing'].body,'base64').toString())

const loadCapsitechModule = async () => {
  try {
    return await import('../../scraper/capsitech/script.js')
  } catch {
    assert.fail('Expected Capsitech scraper module at ../../scraper/scraper/capsitech/script.js')
  }
}

const careerPageHtml = `
  <html>
    <head>
      <title>CA | ACCA | Developer and IT Jobs in Jodhpur | Capsitech</title>
      <script>
        window.RESUME_KEY = 'resume/key=';
      </script>
    </head>
    <body>
      <section id="career_page">
        <form id="Carrer_Form">
          <select id="Job_Position" name="domain"></select>
        </form>
      </section>
    </body>
  </html>
`

const careerOptionsPayload = {
  status: true,
  result: {
    domainsList: [
      {
        label: 'IT',
        domains: [{ id: 'technical-development', name: 'Technical Development' }],
      },
    ],
  },
}

test('run returns no jobs when Capsitech exposes application categories without public opening details', async () => {
  const capsitech = await loadCapsitechModule()
  const requestedUrls = []

  assert.equal(capsitech.hasCareerPageSignal(careerPageHtml), true)
  assert.equal(capsitech.hasPublicPositionOptions(careerOptionsPayload), true)

  const jobs = await capsitech.createCapsitechScraper().run({
    fetchText: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, capsitech.CAREER_PAGE_URL)
      return currentNativeHtml
    },
    fetchJson: async (url) => {
      requestedUrls.push(url)
      assert.equal(url, capsitech.buildCareerOptionsUrl(capsitech.extractResumeKey(currentNativeHtml)))
      return currentNativePayload
    },
  })

  assert.deepEqual(requestedUrls, [
    capsitech.CAREER_PAGE_URL,
    capsitech.buildCareerOptionsUrl(capsitech.extractResumeKey(currentNativeHtml)),
    capsitech.CAREER_PAGE_URL,
    capsitech.buildCareerOptionsUrl(capsitech.extractResumeKey(currentNativeHtml)),
  ])
  assert.deepEqual(jobs, [])
  assert.equal(readInventoryEvidence(jobs).status,'coverage-gap')
  assert.equal(readInventoryEvidence(jobs).reportedTotal,null)
})
