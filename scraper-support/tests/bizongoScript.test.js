import assert from 'node:assert/strict'
import test from 'node:test'

const loadBizongoModule = async () => {
  try {
    return await import('../../scraper/bizongo/script.js')
  } catch {
    assert.fail('Expected Bizongo scraper module at ../../scraper/bizongo/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Careers | Bizongo</title>
    <link rel="canonical" href="https://bizongo.com/careers" />
  </head>
  <body>
    <main>
      <h1>Careers</h1>
      <p>Explore open positions</p>
      <a href="https://careers.bizongo.com/">Apply</a>
    </main>
  </body>
</html>
`

test('Bizongo preserves an unavailable public handoff as the original source failure with native evidence',async()=>{
 const bizongo=await loadBizongoModule(),reason=Error('fetch failed'),reports=[]
 await assert.rejects(bizongo.run({fetchPage:async url=>{if(url===bizongo.CAREERS_URL)return{status:200,url,html:officialCareersHtml};throw reason},onAudit:r=>reports.push(r)}),e=>e===reason)
 assert.equal(bizongo.hasOfficialCareersSignal(officialCareersHtml),true);assert.equal(reports.length,1);assert.equal(reports[0].companyGlobalTotal,null)
})
test('Bizongo rejects changed corporate identity and requests native review if the current handoff becomes available',async()=>{
 const bizongo=await loadBizongoModule()
 await assert.rejects(bizongo.run({fetchPage:async url=>({status:200,url,html:'<html>Jobs</html>'})}),/official careers identity/i)
 await assert.rejects(bizongo.run({fetchPage:async url=>({status:200,url,html:url===bizongo.CAREERS_URL?officialCareersHtml:'<h1>Open Positions</h1>'})}),e=>e.code==='PUBLIC_VACANCY_COLLECTOR_REQUIRED')
})
