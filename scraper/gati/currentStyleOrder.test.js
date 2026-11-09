import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {currentCorporateScopeHash} from './corporateScope.js'

const html=gunzipSync(fs.readFileSync(new URL('./fixtures/current-careers-20261030.html.gz',import.meta.url))).toString('utf8')
const review=JSON.parse(fs.readFileSync(new URL('./reviewedNativeScope.json',import.meta.url),'utf8')).corporate['https://www.allcargologistics.com/about-us/careers']
test('actual current careers style order preserves original reviewed whole-source scope',()=>{
 assert.equal(createHash('sha256').update(html).digest('hex'),'9db67a1dd98c298f00e9f1d3c6c660a72c6ba9cac6c153adf9c85d58717a7446')
 assert.equal(currentCorporateScopeHash(html,review),'8dbcb7beec12ec9187cd7fd5b08dc89a52d1071c9fe68ed1e6f4e43f0d9da26f')
})
for(const [label,change]of[
 ['published hiring link',s=>s.replace('https://allcargologistics.darwinbox.in/ms/candidatev2/main/careers/home','https://other.darwinbox.in/ms/candidatev2/main/careers/home')],
 ['CSS visibility',s=>s.replace('.express--faqs{position:relative;z-index:5}', '.express--faqs{position:relative;z-index:5;opacity:0}')],
 ['hidden executable script',s=>s.replace('</body>','<script hidden src="https://other.example/hiring.js"></script></body>')],
 ['style attribute',s=>s.replace('<style ng-app-id="ng">','<style ng-app-id="other">')],
])test('actual current careers order still rejects changed '+label,()=>{
 const changed=change(html);assert.notEqual(changed,html,'mutation must affect actual fixture')
 assert.equal(currentCorporateScopeHash(changed,review),null)
})
