import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {buildDeterministicFactPlan} from '../rewriting/deterministicFactPlan.js';

const overview='This role involves developing reliable software services for customer operations and collaborating with engineering teams to improve service quality across the organization.';
const required='Bachelor degree in Computer Science or equivalent practical experience developing software services for customers and collaborating with engineering teams on production systems.';
const preferred='Experience working with cloud platforms and containerized applications is preferred for this position.';
const job=description=>buildRewriteInput({title:'Software Engineer',company:'Example',location:'Pune, India',description});
const context={preserveContext:true};

test('a fully fixed plan renders employer wording without a model',()=>{
 const input=job('Role overview:\n'+overview+'\nRequired qualifications:\n'+required+'\nPreferred qualifications:\n'+preferred);
 const result=buildDeterministicFactPlan(input,context);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.modelRequired,false);
 assert.equal(result.quality.method,'deterministic_source_fact_organization');
 assert.match(result.description,/## Role overview\n/);
 assert.ok(result.description.includes(overview));
 assert.match(result.description,/## Required qualifications\n\n- Bachelor degree/);
 assert.match(result.description,/## Preferred qualifications and skills\n\n- Experience working/);
});

test('a fixed plan with no overview keeps qualification scope and adds no overview prose',()=>{
 const input=job('Required qualifications:\n'+required+' '+required.replace('Bachelor degree','Advanced degree')+'\nPreferred qualifications:\n'+preferred);
 const result=buildDeterministicFactPlan(input,context);
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.equal(result.compactPlan.overviewFactId,null);
 assert.match(result.description,/## Role overview\n\nSoftware Engineer at Example\n\n## Required qualifications/);
 assert.ok(result.description.includes(preferred));
});

test('unlabelled facts with competing categories still require a model',()=>{
 const input=job('We offer medical insurance and paid leave to employees.\nRole overview:\n'+overview+'\nRequired qualifications:\n'+required);
 const result=buildDeterministicFactPlan(input,context);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'category_choice_required');
 assert.equal(result.modelRequired,true);
});

test('multiple overview candidates are not silently reduced to the first',()=>{
 const input=job('Role overview:\n'+overview+'\nThis position involves coordinating customer support projects and helping engineering teams resolve service issues.\nRequired qualifications:\n'+required);
 const result=buildDeterministicFactPlan(input,context);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'overview_choice_required');
 assert.equal(result.modelRequired,true);
});

test('an incomplete source is rejected before claiming a deterministic draft',()=>{
 const result=buildDeterministicFactPlan(job('Job Title XXXXXX Bullet points outlining key skills/experience.'),context);
 assert.equal(result.ok,false);
 assert.equal(result.reason,'unfilled_employer_template');
 assert.equal(result.modelRequired,false);
});
