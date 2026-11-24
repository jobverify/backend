import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {gunzipSync} from 'node:zlib'
import {readFrontNativeHtml} from './currentProgrammeRenderer.js'

const fixture=JSON.parse(gunzipSync(readFileSync(new URL('./test-data/current-native-role-20261121.json.gz',import.meta.url))))
const original=Buffer.from(fixture.bodyBase64,'base64').toString('utf8')
const serialized=JSON.stringify(fixture.organization)
const read=organization=>{
 assert.equal(original.split(serialized).length,2,'exact single original organization carrier')
 const text=original.replace(serialized,JSON.stringify(organization))
 return readFrontNativeHtml({text,url:fixture.url,headers:fixture.headers})
}
test('actual retained current Front organization passes to explicitly privacy-qualified nonce boundary',()=>{
 assert.equal(fixture.originalUnmodified,false)
 assert.throws(()=>read(structuredClone(fixture.organization)),error=>error.reason==='native-carrier'&&/nonce/.test(error.message))
})
const changes=[
 ['employer identity',o=>o.name='Another employer'],
 ['account identity',o=>o.organizationId='00000000-0000-4000-8000-000000000000'],
 ['native tenant',o=>o.hostedJobsPageSlug='another-employer'],
 ['alternate publication authority',o=>o.customJobsPageUrl='https://elsewhere.example/jobs'],
 ['additional board criteria',o=>o.theme.jobBoardTopDescriptionHtml='<p>Only residents of India may apply.</p>'],
 ['alternate role routing',o=>o.theme.jobPostingBackUrl='https://elsewhere.example/jobs'],
 ['additional legal notice',o=>o.recruitingPrivacyPolicyUrl='https://front.com/new-recruiting-notice'],
 ['unreviewed feature semantics',o=>o.activeFeatureFlags.push('UnreviewedEligibilityMode')],
 ['removed feature declaration',o=>o.activeFeatureFlags.pop()],
 ['additional organization field',o=>o.applicantLocationRequirements='India'],
 ['additional theme field',o=>o.theme.applicantLocationRequirements='India'],
 ['changed board filtering',o=>o.theme.showJobFilters=false],
]
for(const[label,change]of changes)test('holds changed current organization: '+label,()=>{
 const organization=structuredClone(fixture.organization);change(organization)
 assert.throws(()=>read(organization),error=>error.reason==='native-organization')
})
