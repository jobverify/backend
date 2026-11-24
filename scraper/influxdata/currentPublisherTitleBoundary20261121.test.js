import test from 'node:test'
import assert from 'node:assert/strict'
import './currentReviewedCollectionBoundary20261120.test.js'
import {replay,HOME,close,element,exact} from './currentConfiguredBoard20261120.test.js'
const title=value=>close(HOME,html=>element(html,node=>node.tag==='title',(outer,node)=>exact(outer,node.raw,value)))
test('Influx publisher title peer: actual own title cannot name another employer',async()=>{await assert.rejects(replay(title('Careers at Other Employer')),error=>error.nativeContradiction===true&&error.failureKind==='parser_or_contract_error')})
for(const value of['Explore current career opportunities','Careers at InfluxData','Join our team'])test('Influx publisher title compatibility: '+value,async()=>{const result=await replay(title(value));assert.equal(result.calls.length,8);assert.equal(result.jobs.length,0);assert.equal(result.assessment.zeroJobEvidence,'fetched-zero');assert.equal(result.assessment.runnerOutcome.success,true);assert.equal(result.assessment.cleanupOptions.replaceExisting,false)})
