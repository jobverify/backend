import test from 'node:test';
import assert from 'node:assert/strict';
import {buildSourceFacts,factPlanMessages,assessRewriteInput} from '../rewriting/factPlan.js';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';

for (const [heading,section] of [['You should have',2],['What we need to see',2],['Basic Requirements',2],['Required Technical Skills',3],['About You',2],['Ways to stand out from the crowd',4]]) {
  test('local context keeps '+heading+' out of the preceding section',()=>{
    const input=buildRewriteInput({title:'Engineer',description:'Responsibilities:\nDesign reliable software for customers.\nPreferred qualifications:\nCloud knowledge.\n'+heading+'\nBachelor degree and three years of Java experience.'});
    const facts=buildSourceFacts(input,{preserveContext:true});
    assert.equal(facts.find(f=>f.text==='Bachelor degree and three years of Java experience.')?.section,section);
    assert.ok(!facts.some(f=>f.text===heading));
  });
}
test('an unknown colon heading stops inherited qualification scope',()=>{
  const input=buildRewriteInput({title:'Engineer',description:'Required qualifications:\nBachelor degree and experience in software engineering.\nWorking at our organization:\nWe welcome applications from all backgrounds.'});
  const facts=buildSourceFacts(input,{preserveContext:true});
  assert.equal(facts.find(f=>f.text==='We welcome applications from all backgrounds.')?.section,9);
});

test('a candidate skill is not presented as employer history in the local trial',()=>{
  const input=buildRewriteInput({title:'Principal',company:'Adobe',description:
    'This position emphasizes managing complex enterprise programs and building positive relationships with senior leaders. '+
    'Established skill in guiding priorities and decisions in the absence of direct control. '+
    'Lead complex cross-functional programs from strategy through execution.'});
  const message=JSON.parse(factPlanMessages(input,{preserveContext:true})[1].content);
  const fact=message.unlabelledFacts.find(f=>f.text.startsWith('Established skill'));
  assert.ok(!fact||!fact.allowedCategories.includes(7));
});

test('a duty mentioning the employer cannot become employer background in the local trial',()=>{
  const input=buildRewriteInput({title:'Engineer',company:'ABB',description:
    'This role involves managing complex engineering projects at ABB and coordinating delivery with customers. '+
    'Develop reliable automation systems to meet customer project requirements and collaborate with engineering teams.'});
  const message=JSON.parse(factPlanMessages(input,{preserveContext:true})[1].content);
  const fact=message.unlabelledFacts.find(f=>f.text.startsWith('This role'));
  assert.ok(!fact||!fact.allowedCategories.includes(7));
});

test('unfinished employer instructions are flagged instead of accepted as publication-ready content',()=>{
  const input=buildRewriteInput({title:'Consultant',company:'Aon',description:
    'Job Title XXXXXX Two headline questions followed by a sentence with an exclamation mark. '+
    'You want this to be as engaging as possible, but concise and to the point. '+
    'Skills and experience that will lead to success Bullet points outlining key skills/experience.'});
  assert.deepEqual(assessRewriteInput(input,{preserveContext:true}),{ok:false,reason:'unfilled_employer_template'});
});

test('a knowledge subheading retains the surrounding required qualification scope',()=>{
  const input=buildRewriteInput({title:'Staff Engineer',company:'Analog Devices India',description:
    'Required Qualifications\nEight years of physical design experience.\nSolid understanding of:\n'+
    'Power grid and PDN methodology including IR/EM mitigation.\nAdvanced clock tree design and constraints.'});
  const facts=buildSourceFacts(input,{preserveContext:true});
  assert.equal(facts.find(f=>f.text.startsWith('Power grid'))?.section,2);
  assert.equal(facts.find(f=>f.text.startsWith('Advanced clock'))?.section,2);
});

test('an employer heading without the catalog country suffix covers the employer introduction',()=>{
  const input=buildRewriteInput({title:'Staff Engineer',company:'Analog Devices India',description:
    'About Analog Devices\nADI combines analog, digital and software technologies.\nRequired Qualifications\nEight years of physical design experience.'});
  const facts=buildSourceFacts(input,{preserveContext:true});
  assert.equal(facts.find(f=>f.text.startsWith('ADI combines'))?.section,7);
  assert.ok(!facts.some(f=>f.text==='About Analog Devices'));
});

test('spaced engineering-degree abbreviations remain attached to their qualification',()=>{
  const input=buildRewriteInput({title:'Engineer',description:'Required Qualifications\nB. Tech/ B.E from a reputed University with First Class in Chemical engineering.'});
  const facts=buildSourceFacts(input,{preserveContext:true});
  assert.ok(facts.some(f=>f.text.startsWith('B. Tech/ B.E')));
  assert.ok(!facts.some(f=>f.text==='B.'));
});

test('export-access conditions and equal-opportunity statements do not inherit required skills',()=>{
  const input=buildRewriteInput({title:'Engineer',description:'Required Qualifications\nEight years of physical design experience.\n'+
    'For positions requiring access to technical data, an export licensing review may be required.\n'+
    'Analog Devices is an equal opportunity employer.\nWe welcome candidates from all backgrounds.'});
  const facts=buildSourceFacts(input,{preserveContext:true});
  assert.equal(facts.find(f=>f.text.startsWith('For positions requiring'))?.section,5);
  assert.equal(facts.find(f=>f.text.startsWith('Analog Devices is'))?.section,9);
  assert.equal(facts.find(f=>f.text.startsWith('We welcome'))?.section,9);
});

test('a single good-to-have sentence does not demote subsequent required skills',()=>{
  const input=buildRewriteInput({title:'Engineer',description:'Required Technical Skills\n'+
    'Good to have some knowledge on Java Spring framework.\n'+
    'Strong proficiency in relational database management systems and SQL query optimization.'});
  const facts=buildSourceFacts(input,{preserveContext:true});
  assert.ok(facts.some(f=>f.text==='Good to have some knowledge on Java Spring framework.'&&f.section===4));
  assert.equal(facts.find(f=>f.text.startsWith('Strong proficiency'))?.section,3);
});

test('a scripting-language experience clause cannot promote a preferred skills block to required',()=>{
  const input=buildRewriteInput({title:'Physical Design Lead',description:'Preferred Experience:\n'+
    'Strong in scripting, Scripting language experience: TCL, Perl, Python, Makefile.\n'+
    'Drive team towards common requirements and flows.'});
  const facts=buildSourceFacts(input,{preserveContext:true});
  assert.ok(facts.some(f=>f.text==='Strong in scripting, Scripting language experience: TCL, Perl, Python, Makefile.'&&f.section===4));
  assert.equal(facts.find(f=>f.text.startsWith('Drive team'))?.section,4);
});

test('a must-have sentence retains its wording and the surrounding required-skills section',()=>{
 const input=buildRewriteInput({title:'Engineer',description:'Required Technical Skills\n'+
   'Must have experience on cloud technologies including AWS services.\n'+
   'Strong proficiency in relational database management systems and SQL query optimization.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.ok(facts.some(f=>f.text==='Must have experience on cloud technologies including AWS services.'&&f.section===3));
 assert.equal(facts.find(f=>f.text.startsWith('Strong proficiency'))?.section,3);
});

test('a flattened sentence-boundary About the role heading ends employer background',()=>{
 const input=buildRewriteInput({title:'Senior RF Engineer',company:'Constelli',description:
   'About Us We provide turnkey solutions for signal processing. '+
   'Our solutions range from tactical radios to mission critical applications. '+
   'About the role As a Senior RF Hardware Design Engineer, you will play a key role in the design and verification of RF hardware subsystems. '+
   'The engineer will translate system-level requirements into circuit-level specifications.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('We provide'))?.section,7);
 assert.equal(facts.find(f=>f.text.startsWith('As a Senior RF'))?.section,0);
 assert.equal(facts.find(f=>f.text.startsWith('The engineer will'))?.section,0);
 assert.ok(!facts.some(f=>f.text.startsWith('About the role')));
});

test('flattened role and skill headings stop duties from absorbing candidate information',()=>{
 const input=buildRewriteInput({title:'Java Developer',description:
   'Role Summary This role is responsible for full-stack development. '+
   'Key Responsibilities Develop reliable backend services and APIs.\n\n'+
   'Minimum 4 years of relevant professional experience in a similar role. '+
   'Technical Skills Solid understanding of core concepts and tools relevant to the role. '+
   'Professional Competencies Strong analytical and problem-solving skills. '+
   "Education Bachelor's degree in Computer Science or equivalent experience."});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('This role is'))?.section,0);
 assert.equal(facts.find(f=>f.text.startsWith('Develop reliable'))?.section,1);
 assert.equal(facts.find(f=>f.text.startsWith('Minimum 4 years'))?.section,2);
 assert.equal(facts.find(f=>f.text.startsWith('Solid understanding'))?.section,3);
 assert.equal(facts.find(f=>f.text.startsWith('Strong analytical'))?.section,9);
 assert.equal(facts.find(f=>f.text.startsWith("Bachelor's degree"))?.section,2);
});

test('ordinary role and education phrases do not become flattened headings',()=>{
 const input=buildRewriteInput({title:'Engineer',description:
   'About Us Our company helps candidates learn about the role and the employer. '+
   'Education and mentoring are part of our community initiatives.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Our company helps'))?.section,7);
 assert.equal(facts.find(f=>f.text.startsWith('Education and mentoring'))?.section,7);
});

test('an explicit candidate preference survives a neutral competency heading',()=>{
 const input=buildRewriteInput({title:'Java Developer',description:
   'Key Competencies:\nStrong analytical and problem-solving skills.\n'+
   'Experience in working within agile or iterative delivery environments is preferred.\n'+
   'Good communication and stakeholder management skills.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Experience in working'))?.section,4);
 assert.equal(facts.find(f=>f.text.startsWith('Good communication'))?.section,9);
});

test('an is-a-plus skill remains optional inside the employer requirements list',()=>{
 const input=buildRewriteInput({title:'Verification Engineer',description:'Requirements:\nBachelor degree and experience in electronic engineering.\nKnowledge of PCI Express protocol is a plus.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Knowledge of PCI'))?.section,4);
});

test('spaced preferred headings do not leave a skills fragment or inherit minimum scope',()=>{
 const input=buildRewriteInput({title:'Engineer',description:'Minimum qualifications\nBachelor degree in electronic engineering.\nPreferred \u00a0 skills\nObject oriented programming and Python development experience.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Object oriented'))?.section,4);
 assert.ok(!facts.some(f=>f.text==='skills'));
});

test('singular minimum qualification and desired-skill headings end preceding metadata',()=>{
 const input=buildRewriteInput({title:'Engineer',description:'Location: Bangalore\nMinimum Qualification: Bachelor degree and relevant analog design experience.\nPositions Available: Analog Design, RF Design\nDesired Skill Set (not every applicant will have all of these skills)\nExpertise in transistor level analog design.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Bachelor degree'))?.section,2);
 assert.equal(facts.find(f=>f.text.startsWith('Positions Available'))?.section,5);
 assert.equal(facts.find(f=>f.text.startsWith('Expertise in transistor'))?.section,4);
});

test('conditional required and optional skills in a desired list are withheld from a simplified plan',()=>{
 const input=buildRewriteInput({title:'Analog Engineer',description:'Responsibilities:\nDesign reliable electronic systems and collaborate with customer engineering teams.\nDesired Skill Set (not every applicant will have all of these skills)\nRF Design positions require experience in amplifier design; knowledge of wireless system trade-offs will be a plus.'});
 assert.equal(assessRewriteInput(input,{preserveContext:true}).reason,'mixed_requirement_scope');
});

test('a proud-to-be equal-opportunity footer cannot remain in required qualifications',()=>{
 const input=buildRewriteInput({title:'Engineer',company:'Broadcom',description:'Requirements:\nBachelor degree and relevant engineering experience.\nBroadcom is proud to be an equal opportunity employer. We consider qualified applicants from all backgrounds.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Broadcom is proud'))?.section,9);
 assert.equal(facts.find(f=>f.text.startsWith('We consider'))?.section,9);
});

test('HTML emphasis around neutral qualification headings ends inherited duties',()=>{
 const input=buildRewriteInput({title:'Network Engineer',description:
  '<p>Responsibilities:</p><p>Monitor client infrastructure and resolve technical incidents.</p>'+
  '<p><strong>Knowledge and Attributes:</strong></p><p>Ability to communicate across cultures and social groups.</p>'+
  "<p><strong>Academic Qualifications and Certifications:</strong></p><p>Bachelor's degree or equivalent qualification in IT or Computing.</p>"});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Monitor client'))?.section,1);
 assert.equal(facts.find(f=>f.text.startsWith('Ability to communicate'))?.section,9);
 assert.equal(facts.find(f=>f.text.startsWith("Bachelor's degree"))?.section,9);
 const production=buildSourceFacts(input);
 assert.equal(production.find(f=>f.text.startsWith("Bachelor's degree"))?.section,1);
});

test('a bold workplace-type field stays employment metadata after required experience',()=>{
 const input=buildRewriteInput({title:'Network Engineer',description:
  '<p>Required Experience:</p><p>Moderate level of relevant managed services experience.</p>'+
  '<p><strong>Workplace type:</strong></p><p>On-site Working</p>'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.includes('On-site Working'))?.section,5);
 assert.ok(facts.some(f=>f.text==='Workplace type: On-site Working'));
});

test('an optional vendor within a required capability is withheld without changing the source sentence',()=>{
 const text='Moderate level knowledge in ticketing tools preferably Service Now.';
 const input=buildRewriteInput({title:'Network Engineer',description:
  'Responsibilities:\nMonitor client infrastructure and resolve technical incidents in agreed service levels.\n'+
  'Required Experience:\nModerate level of relevant managed services experience.\n'+text});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.ok(facts.some(f=>f.text===text));
 assert.equal(assessRewriteInput(input,{preserveContext:true}).reason,'mixed_requirement_scope');
});

test('a whole optional preferably sentence does not change subsequent required experience',()=>{
 const input=buildRewriteInput({title:'Network Engineer',description:
  'Required Experience:\nPreferably five years of experience with Python.\n'+
  'Strong knowledge of ticketing tools and network incident management.'});
 const facts=buildSourceFacts(input,{preserveContext:true});
 assert.equal(facts.find(f=>f.text.startsWith('Preferably five'))?.section,4);
 assert.equal(facts.find(f=>f.text.startsWith('Strong knowledge'))?.section,2);
});
