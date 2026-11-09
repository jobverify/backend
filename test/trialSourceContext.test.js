import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {prepareTrialInput,validateTrialRephrase} from '../rewriting/trialRephrase.js';

test('a candidate travel opportunity cannot ground a generated travel duty',()=>{
 const input=buildRewriteInput({title:'Solutions Architect',company:'Cloudera',description:
  'Job Description:\nDevelop solutions using Hadoop, NiFi, Spark and related Big Data technology to solve complex data problems.\n'+
  'This role will present the successful candidate the opportunity to travel across Asia Pacific and across multiple industries and large customer organisations.\n'+
  'Responsibilities:\nConfigure data platforms and support customers with troubleshooting and deployment.'});
 const prepared=prepareTrialInput(input);
 assert.equal(prepared.ok,true);
 const result=validateTrialRephrase({sentences:[
  {text:'You will develop solutions using Hadoop, NiFi, Spark and related Big Data technology to solve complex data problems.',evidenceIds:[0]},
  {text:'You will travel across Asia Pacific and large customer organizations to present the successful candidate.',evidenceIds:[1]},
 ]},input,'stop');
 assert.equal(result.ok,false,'The observed meaning-changing overview must not pass draft checks.');
 assert.ok(!prepared.roleFacts.some(f=>f.text.includes('successful candidate')));
 assert.ok(prepared.facts.some(f=>f.text.includes('the opportunity to travel')),'Keep the opportunity in the detailed source facts.');
});

test('ordinary customer travel and business-opportunity duties remain eligible',()=>{
 const input=buildRewriteInput({title:'Account Manager',description:
  'Responsibilities:\nTravel across Asia Pacific to support customer projects and resolve delivery issues.\n'+
  'Create business opportunities by developing relationships with customers and coordinating sales activities across the region.'});
 const prepared=prepareTrialInput(input);
 assert.equal(prepared.ok,true);
 assert.ok(prepared.roleFacts.some(f=>f.text.startsWith('Travel across')));
 assert.ok(prepared.roleFacts.some(f=>f.text.startsWith('Create business opportunities')));
});

test('opportunity wording attached to a concrete supervised engineering duty remains usable',()=>{
 const input=buildRewriteInput({title:'Associate Project Engineer',company:'ABB',description:
  'Responsibilities:\nIn this role, you will have the opportunity to support engineering activities in all types of project sizes and complexities, under the supervision of senior engineers.\n'+
  'Design reliable engineering solutions and coordinate project delivery with customers and engineering teams.'});
 const prepared=prepareTrialInput(input);
 assert.equal(prepared.ok,true);
 assert.ok(prepared.roleFacts.some(f=>f.text.includes('under the supervision of senior engineers')));
});

test('employer empowerment and growth slogans cannot ground a job-duty overview',()=>{
 const input=buildRewriteInput({title:'Associate Project Engineer',company:'ABB',description:
  'Role overview:\nYou’ll be empowered to lead, supported to grow, and proud of the impact we create together.\n'+
  'Responsibilities:\nDesign reliable engineering solutions and coordinate project delivery with customers and engineering teams.'});
 const prepared=prepareTrialInput(input);
 assert.equal(prepared.ok,true);
 assert.ok(!prepared.roleFacts.some(f=>f.text.includes('empowered to lead')));
 assert.ok(prepared.facts.some(f=>f.text.includes('empowered to lead')));
});

const networkOverview={sentences:[
 {text:'This role involves installing and maintaining computer networks for internal teams.',evidenceIds:[0]},
 {text:'You will monitor network performance and resolve connectivity incidents for those teams.',evidenceIds:[1]},
]};
const networkDuties='Install and maintain computer networks for internal teams.\nMonitor network performance and resolve connectivity incidents.\n';

test('repeated None field values retain their distinct travel and relocation meaning',()=>{
 const input=buildRewriteInput({title:'Network Engineer',description:'Responsibilities:\n'+networkDuties+
  'Travel Requirements\nNone\nRelocation Provided\nNone\nPosition Type\nExperienced\nReferral Payment Plan\nNo'});
 const result=validateTrialRephrase(networkOverview,input,'stop');
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.match(result.description,/- Travel Requirements: None\b/);
 assert.match(result.description,/- Relocation Provided: None\b/);
 assert.match(result.description,/- Position Type: Experienced\b/);
 assert.match(result.description,/- Referral Payment Plan: No\b/);
 assert.ok(prepareTrialInput(input).facts.filter(f=>/None|Experienced|No$/.test(f.text)).every(f=>f.section===5));
});

test('equal text in required and preferred sections keeps both source scopes',()=>{
 const input=buildRewriteInput({title:'Network Engineer',description:'Responsibilities:\n'+networkDuties+
  'Required skills:\nNetworking knowledge.\nPreferred skills:\nNetworking knowledge.\nEmployment details:\nFull time role based in Pune.'});
 const prepared=prepareTrialInput(input);
 assert.deepEqual(prepared.facts.filter(f=>f.text==='Networking knowledge.').map(f=>f.section),[3,4]);
 const result=validateTrialRephrase(networkOverview,input,'stop');
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.match(result.description,/## Required skills\n\n- Networking knowledge\./);
 assert.match(result.description,/## Preferred qualifications and skills\n\n- Networking knowledge\./);
});

test('an empty employment field cannot consume the next colonless qualification heading',()=>{
 for(const heading of ['Required Qualifications','required qualifications']){
  const input=buildRewriteInput({title:'Network Engineer',description:'Responsibilities:\n'+networkDuties+
   'Relocation Provided\n'+heading+' Bachelor degree or equivalent practical experience in a relevant field.'});
  const facts=prepareTrialInput(input).facts;
  assert.ok(facts.some(f=>f.text==='Bachelor degree or equivalent practical experience in a relevant field.'&&f.section===2));
  assert.ok(!facts.some(f=>f.text.startsWith('Relocation Provided:')),'An absent source value stays absent.');
 }
});

test('employer role, fit and office-policy headings separate duties from eligibility and attendance',()=>{
 const input=buildRewriteInput({title:'Network Engineer',company:'Philips',description:'Your role:\n'+networkDuties+
  'You are the right fit:\nBachelor or master’s degree in a relevant field.\n'+
  'How we work together:\nFor our office-based teams, this means working in-person at least 3 days per week.\n'+
  'This role is an office-based role.\nAbout Philips:\nWe are a health technology company.'});
 const result=validateTrialRephrase(networkOverview,input,'stop');
 assert.equal(result.ok,true,JSON.stringify(result));
 assert.match(result.description,/## Required qualifications\n\n- Bachelor or master’s degree/);
 assert.match(result.description,/## Employment details\n\n- For our office-based teams/);
 assert.match(result.description,/## About the employer\n\n- We are a health technology company\./);
 const facts=prepareTrialInput(input).facts;
 assert.ok(!facts.some(f=>/^(?:Your role|You are the right fit|How we work together):?$/.test(f.text)));
});

test('a repeated senior-manager title cannot become duty evidence after scope preservation',()=>{
 const input=buildRewriteInput({title:'Senior Product Manager',description:
  'Job Title\nSenior Product Manager\nJob Description\nSenior Product Manager\nResponsibilities:\n'+networkDuties+
  'Required Qualifications:\nBachelor degree or equivalent practical experience in a relevant field.'});
 const prepared=prepareTrialInput(input);
 assert.equal(prepared.ok,true);
 assert.ok(!prepared.roleFacts.some(f=>f.text==='Senior Product Manager'));
 assert.ok(prepared.roleFacts.some(f=>f.text.startsWith('Install and maintain')));
});
