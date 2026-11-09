import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSourceFacts} from '../rewriting/factPlan.js';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
for(const [heading,section,text] of [
 ['Required:',2,'Six to ten years of product management experience.'],
 ['Preferred:',4,'Experience with modern MLOps tools.'],
 ['You will be mainly accountable for.',1,'Delivery Leadership - Lead delivery of finance solutions.'],
 ['Use of AI in Hiring',6,'An attempt to falsify information in an application will result in disqualification.'],
])test('observed employer heading '+heading+' ends the preceding section',()=>{
 const input=buildRewriteInput({title:'Engineer',company:'ABB',description:'Benefits:\nMedical insurance and paid leave.\n'+heading+'\n'+text});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text===text)?.section,section);
 assert.ok(!facts.some(f=>f.text===heading));
});
