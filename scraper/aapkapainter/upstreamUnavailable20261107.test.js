import test from 'node:test'
import assert from 'node:assert/strict'
import {createAapkaPainterScraper, HOMEPAGE_URL, CAREER_URL, WIDGET_SCRIPT_URL} from './script.js'
import {classifyScraperError} from '../../scraper-support/utils/failureClassification.js'

// Controlled corporate surfaces exercise the current declared-widget failure;
// the actual Nov7 corporate/career/widget responses remain diagnostic local-only.
const home = '<title>AapkaPainter - Expert Painting & Waterproofing Services in India</title><a href="https://aapkapainter.com/career">Career</a><div>BOOK SITE VISIT Select your property type AapkaPainter Solutions Pvt Ltd</div>'
const career = `<title>Career - Jobs at Aapkapainter</title><link rel="canonical" href="https://aapkapainter.com/career"><meta content="Apply to jobs at Aapkapainter today. Learn about careers at Aapkapainter in software, marketing, sales and operations"><div id="job-listing"></div><script>var USERID = '1476';</script><script src="https://ats.zimyo.com/assets/js/jobwidget.js"></script><input value="career"><div>BOOK SITE VISIT Select your property type</div>`
const run = widget => {
  const requested = []
  const outcome = createAapkaPainterScraper().run({fetchPage:async url=>{
    requested.push(url)
    if (url === HOMEPAGE_URL) return {status:200,url,html:home}
    if (url === CAREER_URL) return {status:200,url,html:career}
    assert.equal(url,WIDGET_SCRIPT_URL)
    if (typeof widget === 'function') return widget()
    return widget
  }})
  return {outcome,requested}
}

for (const status of [404,410]) {
  test(`declared missing widget HTTP${status} is unavailable with no empty array or cleanup authority`, async()=>{
    const {outcome,requested} = run({status,url:WIDGET_SCRIPT_URL,html:'<title>Not Found</title>'})
    await assert.rejects(outcome,error=>{
      assert.equal(error.status,status)
      assert.equal(error.failureType,'upstream_unavailable')
      assert.equal(error.sourceUrl,WIDGET_SCRIPT_URL)
      assert.equal(error.scopeComplete,false)
      assert.equal(error.sourceScopeComplete,false)
      assert.equal(error.cleanupAuthority,false)
      assert.deepEqual(classifyScraperError(error),{softFailure:true,upstreamOutage:true,failureKind:'upstream_unavailable'})
      return true
    })
    assert.deepEqual(requested,[HOMEPAGE_URL,CAREER_URL,WIDGET_SCRIPT_URL])
  })
}

test('foreign widget response URL cannot gain the configured missing-widget classification',async()=>{
  const {outcome}=run({status:404,url:'https://unrelated.invalid/jobwidget.js',html:'<title>Not Found</title>'})
  await assert.rejects(outcome,error=>{
    assert.equal(error.failureType,undefined)
    assert.match(error.message,/embedded Zimyo widget state changed materially/)
    return true
  })
})

test('unrecognized original widget transport error is preserved by identity',async()=>{
  const original = Object.freeze({opaque:'unrecognized transport failure'})
  const {outcome}=run(()=>{throw original})
  await assert.rejects(outcome,error=>error===original)
})
