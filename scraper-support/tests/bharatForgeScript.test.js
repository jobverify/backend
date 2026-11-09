import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'
const currentPublicFixture=()=>JSON.parse(gunzipSync(readFileSync(new URL('../../scraper/bharatforge/test-data/current-public-20261103.json.gz',import.meta.url))))
const currentCorporateHTML=()=>currentPublicFixture().responses[0].body
import assert from 'node:assert/strict'
import test from 'node:test'

const loadBharatForgeModule = async () => {
  try {
    return await import('../../scraper/bharatforge/script.js')
  } catch {
    return null
  }
}

const careerPageHtml = `
<!DOCTYPE html>
<html>
  <body>
    <section class="career-form">
      <h2>Build Your Future with Bharat Forge</h2>
      <form id="career-form" method="post" action="https://www.bharatforge.com/careers/submit">
        <input type="hidden" name="_token" value="csrf-token" />
      </form>
      <p>Share your resume with us at <a href="mailto:careers@kalyani.in">careers@kalyani.in</a></p>
    </section>
  </body>
</html>
`

test('extractSearchResults returns no openings when the Bharat Forge page only exposes a resume form', async () => {
  const bharatForge = await loadBharatForgeModule()
  assert.ok(bharatForge)

  assert.deepEqual(bharatForge.extractSearchResults(careerPageHtml), [])
})

test("Bharat Forge current public general-intake observations do not invent native vacancy inventory", async () => {
 const bharat=await loadBharatForgeModule(),calls=[];let audit
 const jobs=await bharat.run({fetchPage:async url=>{calls.push(url);return{url,status:200,html:currentCorporateHTML()}},onAudit:value=>{audit=value}})
 assert.deepEqual(calls,[bharat.CAREER_PAGE_URL,bharat.CAREER_PAGE_URL]);assert.deepEqual(jobs,[]);assert.equal(readInventoryEvidence(jobs).reportedTotal,null);assert.equal(audit.observations[0].kind,'general-expertise-resume-intake');assert.equal(audit.observations[0].country,null);assert.equal(audit.observations[0].descriptionComplete,false)
})
