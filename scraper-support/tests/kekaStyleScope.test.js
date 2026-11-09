import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {captureActiveHiringScope,createCurrentSourceScope} from '../shared/kekaCurrentSourceScope.js'
import {createOpenFinancialTechnologiesScraper} from '../../scraper/openfinancialtechnologies/script.js'
import {transport} from '../../scraper/acciojob/current.fixture.js'
import {readInventoryEvidence} from '../utils/inventoryEvidence.js'

const url='https://employer.example/careers'
const html='<html><head><style id="first" media="screen">.jobs{display:block}</style><link rel="stylesheet" href="/layout.css"><style id="last">.jobs{color:navy}</style></head><body><a class="jobs" href="https://employer.keka.com/careers">Careers</a></body></html>'
const snapshot=body=>captureActiveHiringScope(body,url)
for(const[label,change]of[
 ['existing style hiding rule',body=>body.replace('.jobs{display:block}','.jobs{display:block}.jobs{display:none!important}')],
 ['unknown additional hiring CSS',body=>body.replace('.jobs{display:block}','.jobs{display:block}@import url("https://hiring.example/new.css");')],
 ['style media attributes',body=>body.replace('media="screen"','media="not all"')],
 ['style cascade order',body=>body.replace(/(<style[^>]*>[\s\S]*?<\/style>)(<link[^>]*>)(<style[^>]*>[\s\S]*?<\/style>)/,'$3$2$1')],
 ['duplicate stylesheet body',body=>body.replace('</head>','<style id="last">.jobs{color:navy}</style></head>')],
 ['style position relative to linked stylesheet',body=>body.replace(/(<style[^>]*>[\s\S]*?<\/style>)(<link[^>]*>)/,'$2$1')],
 ])test(`Keka source scope observes ${label}`,()=>{
  const baseline=snapshot(html),changed=change(html)
  assert.notDeepEqual(snapshot(changed),baseline)
  const scope=createCurrentSourceScope({baselines:{[url]:baseline},kekaRootUrl:'https://employer.keka.com/careers/'})
  scope.observe(url,changed)
  assert.ok(scope.gaps.has(`changed-active-styles:${url}`))
 })

test('Keka source style records retain raw ordered bodies, attributes and exact body SHA',()=>{
 const styles=snapshot(html).styles
 assert.equal(styles.length,2)
 assert.equal(styles[0].raw,'.jobs{display:block}')
 assert.equal(styles[0].attributes.media,'screen')
 assert.equal(styles[0].sha256,createHash('sha256').update(styles[0].raw).digest('hex'))
 assert.ok(styles[0].position<styles[1].position)
})

test('Keka scope still notices stylesheet activation from an inert template',()=>{
 const inert='<head><template id="held"><style>.jobs{display:none}</style></template></head>'
 const active='<head><template id="held"></template><style>.jobs{display:none}</style></head>'
 assert.notDeepEqual(snapshot(inert),snapshot(active))
})

test('Keka style observation preserves every existing text, script, form, frame and attribute field',()=>{
 const before=snapshot(html),after=snapshot(html.replace('.jobs{display:block}','.jobs{display:none}'))
 for(const key of Object.keys(before).filter(key=>key!=='styles'))assert.deepEqual(after[key],before[key],key)
})

test('Open Financial existing-style drift cannot retain a verified empty inventory',async()=>{
 const jobs=await createOpenFinancialTechnologiesScraper().run({fetchImpl:transport((nativeUrl,body)=>{
  if(nativeUrl!=='https://open.money/company/careers')return body
  assert.match(body,/<\/style\s*>/i)
  return body.replace(/<\/style\s*>/i,'a[href*="keka.com"]{display:none!important}</style>')
 })})
 assert.equal(jobs.length,0)
 assert.equal(readInventoryEvidence(jobs).listingComplete,false)
 assert.equal(readInventoryEvidence(jobs).indiaFacetCount,null)
 assert.notEqual(readInventoryEvidence(jobs).status,'verified-empty')
})
