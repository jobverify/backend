import assert from 'node:assert/strict'
import test from 'node:test'

const loadOmninosModule = async () => {
  try {
    return await import('../../scraper/omninossolutions/script.js')
  } catch {
    assert.fail('Expected Omninos Solutions scraper module at ../../scraper/omninossolutions/script.js')
  }
}

const officialCareersHtml = `
<!doctype html>
<html lang="en">
  <head>
    <title>Current Job Openings at Omninos | Grow Your Career With Us</title>
  </head>
  <body>
    <h1>Current Openings at Omninos for Technology and Digital Professionals</h1>
    <div class="job-card">
      <span class="designation">UI/UX Designer</span>
      <span class="location">Mohali, India<i class="fad fa-angle-right"></i></span>
    </div>
    <div class="job-card">
      <span class="designation">Product Manager</span>
      <span class="location">Mohali, India<i class="fad fa-angle-right"></i></span>
    </div>
    <div class="job-card">
      <span class="designation">Marketing Manager</span>
      <span class="location">Mohali, India<i class="fad fa-angle-right"></i></span>
    </div>
  </body>
</html>
`

test('Omninos historical literal cards retain only their source title/location observations',async()=>{
 const source=await loadOmninosModule();assert.equal(source.hasOfficialCareersSignal(officialCareersHtml),true)
 assert.deepEqual(source.extractRoles(officialCareersHtml),[{title:'UI/UX Designer',location:'Mohali, India'},{title:'Product Manager',location:'Mohali, India'},{title:'Marketing Manager',location:'Mohali, India'}])
})
test('Omninos body-only historical cards cannot publish or invoke standalone persistence',async()=>{
 const source=await loadOmninosModule();await assert.rejects(source.run({fetchText:async()=>officialCareersHtml}),/unsupported metadata-free/)
 let writes=0;await assert.rejects(source.runStandalone({argv:['node','script.js','--dry-run'],fetchText:async()=>officialCareersHtml,saveToFile:()=>{writes++},saveToDB:async()=>{writes++}}),/unsupported metadata-free/);assert.equal(writes,0)
})
