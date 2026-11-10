import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { run } from './script.js'
import { oracleRecruitmentEmployer } from '../../scraper-support/utils/recruitmentOracle.js'
import { readInventoryEvidence } from '../../scraper-support/utils/inventoryEvidence.js'

const capture = JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/runtime20261110.json.gz', import.meta.url))))
const declaration = {kind:'native-role-organization-label',field:'ExternalDescriptionStr',label:'Organization Name',name:'Kotak Mahindra Bank Ltd'}
const own = capture.captures.find(row => row.url.includes('recruitingCEJobRequisitionDetails') && JSON.parse(row.body).items[0].Id === '227394')
const native = JSON.parse(own.body).items[0]
const replay = (change = value => value) => ({
  now: () => '2026-11-10T16:25:47.705Z',
  fetchPage: async url => {
    const row = capture.captures.find(row => row.url === url && !/json/.test(row.contentType || ''))
    assert.ok(row, 'Captured page is required: ' + url)
    return {status:row.status,url:row.responseUrl,html:row.body,contentType:row.contentType}
  },
  fetchJson: async (url, init = {}) => {
    const row = capture.captures.find(row => row.url === url && (row.requestBody || null) === (init.body || null))
    assert.ok(row, 'Captured native response is required: ' + url)
    return change(JSON.parse(row.body), url)
  },
})

test('registered Kotak reader recovers the own-role Organization Name declaration from authentic native full criteria', async () => {
  const jobs = await run(replay())
  const job = jobs.find(job => job.jobId === '227394')
  assert.ok(job)
  assert.equal(job.source, 'kotakmahindrabank')
  assert.equal(job.company, 'Kotak Mahindra Bank')
  assert.equal(job.jobId, '227394')
  assert.equal(job.country, 'India')
  assert.equal(job.sourceDescription, native.ExternalDescriptionStr)
  assert.equal(job.nativeHiringOrganization.name, 'Kotak Mahindra Bank Ltd')
  assert.equal(job.nativeLegalEmployer, null)
  assert.equal(job.nativeEmployerBinding.method, 'native-role-description-organization-label')
  assert.equal(job.nativeEmployerBinding.field, 'ExternalDescriptionStr')
  assert.equal(job.nativeEmployerBinding.legalEmployer, null)
  assert.equal(job.sourceListingComplete, false)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
  assert.equal(readInventoryEvidence(jobs).status, 'coverage-gap')
})

test('Oracle organization declaration is opt-in and does not replace a conflicting native legal employer', () => {
  assert.equal(oracleRecruitmentEmployer(native).employer, null)
  const result = oracleRecruitmentEmployer({...native,LegalEmployer:'Other Bank Limited'}, {descriptionEmployerDeclaration:declaration})
  assert.equal(result.employer.name, 'Other Bank Limited')
  assert.equal(result.binding, null)
})

for (const [name, description] of [
  ['a different organization', '<p>Organization Name</p><p>Other Bank Limited</p>'],
  ['an unrelated next label', '<p>Organization Name</p><p>Job Family</p><p>Kotak Mahindra Bank Ltd</p>'],
  ['a conflicting repeated label', '<p>Organization Name</p><p>Kotak Mahindra Bank Ltd</p><p>Organization Name</p><p>Other Bank Limited</p>'],
  ...['template','blockquote','q','pre','code','script','aside'].map(tag => [tag, '<'+tag+'><p>Organization Name</p><p>Kotak Mahindra Bank Ltd</p></'+tag+'>']),
  ['hidden', '<div hidden><p>Organization Name</p><p>Kotak Mahindra Bank Ltd</p></div>'],
  ['aria hidden', '<div aria-hidden="true"><p>Organization Name</p><p>Kotak Mahindra Bank Ltd</p></div>'],
  ['style hidden', '<div style="display:none"><p>Organization Name</p><p>Kotak Mahindra Bank Ltd</p></div>'],
]) test('Oracle does not turn '+name+' into own-role employer proof', () => {
  const result = oracleRecruitmentEmployer({...native,ExternalDescriptionStr:description},{descriptionEmployerDeclaration:declaration})
  assert.equal(result.employer, null)
})

for (const [name, change] of [
  ['foreign country', detail => ({...detail,PrimaryLocationCountry:'US',workLocation:[],secondaryLocations:[]})],
  ['missing full role criteria', detail => ({...detail,ExternalDescriptionStr:'<p>Organization Name</p><p>Kotak Mahindra Bank Ltd</p>',ExternalQualificationsStr:'',ExternalResponsibilitiesStr:''})],
  ['conflicting employer', detail => ({...detail,LegalEmployer:'Other Bank Limited'})],
]) test('registered Kotak reader preserves '+name+' exclusions', async () => {
  const jobs = await run(replay((payload,url) => url === own.url ? {...payload,items:[change(payload.items[0])]} : payload))
  assert.equal(jobs.some(job => job.jobId === '227394'), false)
})

test('own-role organization declaration cannot override a contradictory native Organization field', () => {
  const result = oracleRecruitmentEmployer({...native,Organization:'Other Bank Limited'}, {descriptionEmployerDeclaration:declaration})
  assert.equal(result.employer, null)
})

const recentCapture = capture.captures.find(row => row.url.includes('recruitingCEJobRequisitionDetails') && JSON.parse(row.body).items[0].Id === '273830')
const recent = JSON.parse(recentCapture.body).items[0]
const workplaceStatement = 'Legal Manager \u2013 Credit Card \u2013 Hardship Assistance Unit at Kotak Mahindra Bank manages the legal and regulatory aspects of credit card customer hardship, debt restructuring, and dispute resolution.'
const workplaceDeclaration = {kind:'native-role-workplace-statement',field:'ExternalDescriptionStr',id:'273830',
  title:'Legal Manager_CREDIT CARD_0233_4673_1099259_HRR',name:'Kotak Mahindra Bank',
  position:'Legal Manager \u2013 Credit Card \u2013 Hardship Assistance Unit',statement:workplaceStatement}

test('the direct workplace guard controls use the valid authentic native role declaration', () => {
  const result = oracleRecruitmentEmployer(recent, {roleWorkplaceDeclarations:[workplaceDeclaration]})
  assert.equal(result.employer.name, 'Kotak Mahindra Bank')
  assert.equal(result.binding.statement, workplaceStatement)
})

test('registered Kotak reader recovers the recent exact native role with its own workplace statement', async () => {
  const jobs = await run(replay())
  const job = jobs.find(job => job.jobId === '273830')
  assert.ok(job)
  assert.equal(job.title, 'Legal Manager_CREDIT CARD_0233_4673_1099259_HRR')
  assert.equal(job.sourceDescription, recent.ExternalDescriptionStr)
  assert.equal(job.country, 'India')
  assert.equal(job.nativeEmployerBinding.method, 'explicit-native-role-workplace-statement')
  assert.equal(job.nativeEmployerBinding.nativeId, '273830')
  assert.equal(job.nativeLegalEmployer, null)
  assert.equal(job.sourceScopeComplete, false)
  assert.equal(job.lifecycleCleanupAllowed, false)
})

for (const [name, change] of [
  ['unbound native identity', detail => ({...detail,Id:'999999'})],
  ['unbound native title', detail => ({...detail,Title:'Different role at the bank'})],
  ['substring-only name', detail => ({...detail,ExternalDescriptionStr:detail.ExternalDescriptionStr.replace('at Kotak Mahindra Bank manages','at Kotak Mahindra Bank Services manages')})],
  ['generic About Us text', detail => ({...detail,ExternalDescriptionStr:'<p>About Kotak Mahindra Group</p>'+detail.ExternalDescriptionStr})],
  ['a sample context', detail => ({...detail,ExternalDescriptionStr:'<p>Example role description:</p>'+detail.ExternalDescriptionStr})],
  ['an unrelated role description', detail => ({...detail,ExternalDescriptionStr:detail.ExternalDescriptionStr.replace('Legal Manager \u2013 Credit Card','Marketing Manager \u2013 Credit Card')})],
  ['a conflicting legal employer', detail => ({...detail,LegalEmployer:'Other Bank Limited'})],
  ['a conflicting native organization', detail => ({...detail,Organization:'Other Bank Limited'})],
  ['an active employer denial', detail => ({...detail,ExternalDescriptionStr:detail.ExternalDescriptionStr+'<p>You will not be employed by Kotak Mahindra Bank.</p>'})],
  ['an active foreign employer label', detail => ({...detail,ExternalDescriptionStr:detail.ExternalDescriptionStr+'<p>Employer: Other Bank Limited</p>'})],
  ...['template','blockquote','q','pre','code','script','aside'].map(tag => [tag, detail => ({...detail,ExternalDescriptionStr:'<'+tag+'>'+detail.ExternalDescriptionStr+'</'+tag+'>'})]),
  ['hidden own-role text', detail => ({...detail,ExternalDescriptionStr:'<div hidden>'+detail.ExternalDescriptionStr+'</div>'})],
  ['aria hidden own-role text', detail => ({...detail,ExternalDescriptionStr:'<div aria-hidden="true">'+detail.ExternalDescriptionStr+'</div>'})],
]) test('reviewed workplace statement cannot qualify '+name, () => {
  const result = oracleRecruitmentEmployer(change(recent), {roleWorkplaceDeclarations:[workplaceDeclaration]})
  assert.equal(result.employer?.name === 'Kotak Mahindra Bank', false)
})

test('recent own-role workplace declaration cannot override a foreign work country', async () => {
  const jobs = await run(replay((payload,url) => url === recentCapture.url ? {...payload,items:[{...payload.items[0],PrimaryLocationCountry:'US',workLocation:[],secondaryLocations:[]}]} : payload))
  assert.equal(jobs.some(job => job.jobId === '273830'), false)
})

test('Organization Name proof cannot override another active employer label', () => {
  const result = oracleRecruitmentEmployer({...native,ExternalDescriptionStr:native.ExternalDescriptionStr+'<p>Employer: Other Bank Limited</p>'}, {descriptionEmployerDeclaration:declaration})
  assert.equal(result.employer, null)
})

const publicCriteriaFields = ['ExternalDescriptionStr','ExternalResponsibilitiesStr','ExternalQualificationsStr','CorporateDescriptionStr','OrganizationDescriptionStr']
for (const [proof, detail, options, expectedEmployer] of [
  ['organization label', native, {descriptionEmployerDeclaration:declaration}, 'Kotak Mahindra Bank Ltd'],
  ['exact role workplace', recent, {roleWorkplaceDeclarations:[workplaceDeclaration]}, 'Kotak Mahindra Bank'],
]) {
  for (const field of publicCriteriaFields) {
    for (const [conflict, html] of [
      ['employment denial','<p>You will not be employed by '+expectedEmployer+'.</p>'],
      ['foreign employer label','<p>Employer: Other Bank Limited</p>'],
      ['plain employment denial','You will not be employed by '+expectedEmployer+'.'],
      ['named employer denial', '<p>'+expectedEmployer+' is not your employer.</p>'],
      ['plain future named employer denial',expectedEmployer+' will not be your employer.'],
      ['plain foreign employer label','Employer: Other Bank Limited'],
      ['loose employer label after a nested block','<div><p>Additional native criteria</p>Employer: Other Bank Limited</div>'],
      ['loose employer label before a nested block','<section>Employer: Other Bank Limited<p>Additional native criteria</p></section>'],
    ]) test(proof+' rejects active '+conflict+' in '+field, () => {
      const result = oracleRecruitmentEmployer({...detail,[field]:(detail[field] || '')+html}, options)
      assert.equal(result.employer, null)
    })
    for (const [inert, wrap] of [
      ['quoted', html => '<blockquote>'+html+'</blockquote>'],
      ['hidden', html => '<div hidden>'+html+'</div>'],
      ['template', html => '<template>'+html+'</template>'],
      ['code sample', html => '<pre>'+html+'</pre>'],
    ]) test(proof+' ignores '+inert+' conflict in '+field, () => {
      const html = wrap('<p>You will not be employed by '+expectedEmployer+'.</p><p>Employer: Other Bank Limited</p>')
      const result = oracleRecruitmentEmployer({...detail,[field]:(detail[field] || '')+html}, options)
      assert.equal(result.employer.name, expectedEmployer)
    })
  }
}
for (const [id, row] of [['227394',own],['273830',recentCapture]]) {
  test('registered Kotak excludes role'+id+' when another public criteria field declares a different employer', async () => {
    const jobs = await run(replay((payload,url) => url === row.url ? {...payload,items:[{...payload.items[0],ExternalResponsibilitiesStr:'<p>Employer: Other Bank Limited</p>'}]} : payload))
    assert.equal(jobs.some(job => job.jobId === id), false)
  })
}
