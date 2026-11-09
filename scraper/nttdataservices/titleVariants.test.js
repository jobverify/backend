import assert from 'node:assert/strict'
import test from 'node:test'
import {readFileSync} from 'node:fs'
import {hasOfficialHomepageSignal,hasOfficialCareersSignal} from './script.js'
const homepage=readFileSync(new URL('./fixtures/homepage-title-20261020.html',import.meta.url),'utf8')
const careers=readFileSync(new URL('./fixtures/careers-title-20261020.html',import.meta.url),'utf8')

test('current official NTT DATA homepage accepts its exact branded title suffix',()=>{
  assert.match(homepage,/<title[^>]*>Intelligence to Impact \| NTT DATA<\/title>/)
  assert.equal(hasOfficialHomepageSignal(homepage),true)
})
test('current official NTT DATA careers page accepts its exact branded title suffix',()=>{
  assert.match(careers,/<title[^>]*>Accelerate your career \| NTT DATA<\/title>/)
  assert.equal(hasOfficialCareersSignal(careers),true)
})
for(const [name,body,validate] of [['homepage',homepage,hasOfficialHomepageSignal],['careers',careers,hasOfficialCareersSignal]]){
  test('current NTT '+name+' still rejects a different company title suffix',()=>{
    const changed=body.replace(/(<title[^>]*>[^<]+) \| NTT DATA(<\/title>)/,'$1 | Other Company$2')
    assert.notEqual(changed,body)
    assert.equal(validate(changed),false)
  })
}
test('current branded homepage still requires the exact corporate canonical identity',()=>{
  const changed=homepage.replace(/href="https:\/\/www\.nttdata\.com\/en-us"/g,'href="https://example.org/en-us"')
  assert.notEqual(changed,homepage)
  assert.equal(hasOfficialHomepageSignal(changed),false)
})
