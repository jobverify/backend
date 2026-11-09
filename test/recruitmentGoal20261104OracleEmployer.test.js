import assert from 'node:assert/strict'
import test from 'node:test'
import {oracleRecruitmentEmployer} from '../scraper-support/utils/recruitmentOracle.js'

const legal={Prompt:'Legal Employer',Value:'Example India Private Limited',ControlType:'SingleChoiceList'}
test('Oracle preserves its own explicitly published legal employer flex field',()=>{
 assert.deepEqual(oracleRecruitmentEmployer({LegalEmployer:null,requisitionFlexFields:[legal]}),{employer:{name:legal.Value},binding:null})
})
test('a reviewed native Company field can qualify the posting brand while its legal employer stays unknown',()=>{
 const record={LegalEmployer:null,requisitionFlexFields:[{Prompt:'Company',Value:'Example Brand',ControlType:'SingleChoiceList'}]}
 assert.equal(oracleRecruitmentEmployer(record).employer,null)
 const result=oracleRecruitmentEmployer(record,{companyFlexField:'Company'})
 assert.equal(result.employer.name,'Example Brand')
 assert.equal(result.binding.legalEmployer,null)
 assert.equal(result.binding.method,'native-requisition-company-flex-field')
})
for(const [name,record]of [
 ['top-level conflict',{LegalEmployer:'Other',requisitionFlexFields:[legal]}],
 ['duplicate conflict',{requisitionFlexFields:[legal,{...legal,Value:'Other'}]}],
 ['invalid native employer type',{LegalEmployer:{name:'Example'}}],
 ['invalid flex type',{requisitionFlexFields:[{...legal,Value:{name:'Example'}}]}],
 ['ambiguous flex control',{requisitionFlexFields:[{...legal,ControlType:'MultiChoiceList'}]}],
])test('Oracle cannot ignore a '+name,()=>assert.throws(()=>oracleRecruitmentEmployer(record),/Oracle/))
test('an unreviewed department or company label cannot supply the native employer',()=>{
 assert.equal(oracleRecruitmentEmployer({requisitionFlexFields:[{Prompt:'Department',Value:'Example',ControlType:'SingleChoiceList'},{Prompt:'Company',Value:'Other',ControlType:'SingleChoiceList'}]}).employer,null)
})
