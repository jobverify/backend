import test from 'node:test';
import assert from 'node:assert/strict';
import {auditExplicitQualificationScope} from '../rewriting/explicitQualificationScopeAudit.js';

const experience='Six years of experience in product management and technology strategy.';
const cloud='Experience designing reliable cloud services for enterprise customers.';
const value=(originalDescription,description,text=experience)=>({outputMethod:'validated_model_plan',originalDescription,description,sourceSectionFacts:[{text,section:9}]});

test('additional experience desired is an explicit optional source block',()=>{
 const result=auditExplicitQualificationScope(value('Minimum Qualifications:\nRequired database experience.\nAdditional Experience Desired:\n'+cloud,'## Required qualifications\n\n- '+cloud,cloud));
 assert.equal(result.findings[0]?.reason,'preferred_promoted');
});

test('a working-life question separates the employer footer from qualifications',()=>{
 const footer='Imagine a flexible work environment and support for wellbeing.';
 const result=auditExplicitQualificationScope(value('Required Skills:\n'+cloud+'\nWhat is it like working for 3Pillar Global?\n'+footer,'## Additional role details\n\n- '+footer,footer));
 assert.equal(result.scopedFacts,0);
 assert.deepEqual(result.findings,[]);
});

test('the original Required heading exposes an error even when stored parser scope says Additional',()=>{
 const result=auditExplicitQualificationScope(value('Required:\n'+experience+'\nBenefits:\nHealth insurance.','## Additional role details\n\n- '+experience));
 assert.equal(result.scopedFacts,1);
 assert.equal(result.findings[0].reason,'required_unclassified');
});
test('raw preferred HTML exposes promotion into mandatory qualifications independently of parser labels',()=>{
 const result=auditExplicitQualificationScope(value('<h3>Preferred Qualifications</h3><p>'+cloud+'</p><h3>Benefits</h3><p>Health insurance.</p>','## Required qualifications\n\n- '+cloud,cloud));
 assert.equal(result.findings[0].reason,'preferred_promoted');
});
test('knowledge subheadings keep the original required scope',()=>{
 const original='Required Qualifications\nSolid understanding of:\n'+cloud+'\nAbout us:\nWe build hardware.';
 const result=auditExplicitQualificationScope(value(original,'## Required skills\n\n- '+cloud,cloud));
 assert.equal(result.scopedFacts,1);
 assert.deepEqual(result.findings,[]);
});
test('duplicate facts in different employer scopes remain explicitly ambiguous',()=>{
 const result=auditExplicitQualificationScope(value('Required qualifications:\n'+cloud+'\nPreferred qualifications:\n'+cloud,'## Required qualifications\n\n- '+cloud+'\n\n## Preferred qualifications and skills\n\n- '+cloud,cloud));
 assert.equal(result.ambiguousFacts,1);
 assert.equal(result.scopedFacts,0);
});
test('ordinary prose mentioning required qualifications is not mistaken for a heading',()=>{
 const result=auditExplicitQualificationScope(value('We review required qualifications during interviews. '+experience,'## Additional role details\n\n- '+experience));
 assert.equal(result.scopedFacts,0);
 assert.deepEqual(result.findings,[]);
});
test('employment conditions inside qualification blocks are reported as exclusions, not candidate-skill errors',()=>{
 const text='This job offer is contingent on passing a background check and having work authorization.';
 const result=auditExplicitQualificationScope(value('Required qualifications:\n'+text,'## Employment details\n\n- '+text,text));
 assert.equal(result.excludedEmploymentConditions,1);
 assert.deepEqual(result.findings,[]);
});

test('a separate Education heading ends the previous nice-to-have scope without inferring mandatory status',()=>{
 const degree='Bachelor or Master Degree in Computer Science or a relevant technical field.';
 const result=auditExplicitQualificationScope(value('Nice to Have:\nCloud experience.\nEducation:\n'+degree,'## Required qualifications\n\n- '+degree,degree));
 assert.equal(result.scopedFacts,0);assert.deepEqual(result.findings,[]);
});
test('a Good to Have heading establishes optional scope after required skills',()=>{
 const result=auditExplicitQualificationScope(value('Required Technical Skills:\nDesign software systems.\nGood to Have:\n'+cloud,'## Preferred qualifications and skills\n\n- '+cloud,cloud));
 assert.equal(result.scopedFacts,1);assert.deepEqual(result.findings,[]);
});
test('unknown soft-skill headings terminate inherited scope instead of producing guessed qualification errors',()=>{
 const text='Team collaboration and clear communication with engineering stakeholders.';
 const result=auditExplicitQualificationScope(value('Nice to Have:\nCloud knowledge.\nSoft Skills:\n'+text,'## Additional role details\n\n- '+text,text));
 assert.equal(result.scopedFacts,0);assert.deepEqual(result.findings,[]);
});
test('an explicit individual preference overrides its surrounding required list',()=>{
 const text='Knowledge of EPLAN Pro Panel will be an advantage.';
 const result=auditExplicitQualificationScope(value('Required Skills:\n'+text,'## Preferred qualifications and skills\n\n- '+text,text));
 assert.equal(result.scopedFacts,1);assert.deepEqual(result.findings,[]);
});
test('employer and company metadata blocks end a preferred skill list',()=>{
 for(const heading of ['About Autodesk','Company:']){
  const text='Our company creates software used by engineering organizations worldwide.';
  const result=auditExplicitQualificationScope(value('Preferred Qualifications:\nCloud knowledge.\n'+heading+'\n'+text,'## About the employer\n\n- '+text,text));
  assert.equal(result.scopedFacts,0);assert.deepEqual(result.findings,[]);
 }
});
test('an employer compliance obligation is not a candidate skill or experience qualification',()=>{
 const text='This job requires an awareness of potential compliance risks and a commitment to act with integrity.';
 const result=auditExplicitQualificationScope(value('Required Skills:\n'+text,'## Employment details\n\n- '+text,text));
 assert.equal(result.excludedEmploymentConditions,1);assert.deepEqual(result.findings,[]);
});

test('modality is read from the source sentence even when a parser drops its preference prefix',()=>{
 const source='Required Technical Skills\nGood to have some knowledge on Java Spring framework.\n'+cloud;
 const result=auditExplicitQualificationScope({...value(source,'## Preferred qualifications and skills\n\n- some knowledge on Java Spring framework.\n\n- '+cloud),sourceSectionFacts:[{text:'some knowledge on Java Spring framework.',section:4},{text:cloud,section:4}]});
 assert.equal(result.findings.length,1);assert.equal(result.findings[0].fact,cloud);assert.equal(result.findings[0].reason,'required_demoted');
});

test('a degree described as a plus keeps its source preference even in a minimum-qualification block',()=>{
 const text='Master’s degree or relevant certifications are a plus.';
 assert.deepEqual(auditExplicitQualificationScope(value('Minimum Qualifications:\n'+text,'## Preferred qualifications and skills\n\n- '+text,text)).findings,[]);
});

test('a shift metadata label terminates the previous preferred qualification block',()=>{
 const text='Shift: 13:00 to 22:00 IST';
 assert.equal(auditExplicitQualificationScope(value('Good to have:\nCloud knowledge.\n'+text,'## Employment details\n\n- '+text,text)).scopedFacts,0);
});

test('deterministic plans are audited without counting them as model drafts',()=>{
 const result=auditExplicitQualificationScope({...value('Preferred Qualifications:\n'+cloud,'## Required qualifications\n\n- '+cloud,cloud),outputMethod:'validated_deterministic_plan'});
 assert.equal(result.modelDraft,false);
 assert.equal(result.organizedDraft,true);
 assert.equal(result.scopedFacts,1);
 assert.equal(result.findings[0].reason,'preferred_promoted');
});

test('source-order fallbacks are not treated as reorganized plans',()=>{
 const result=auditExplicitQualificationScope({...value('Preferred Qualifications:\n'+cloud,'## Preferred Qualifications\n\n- '+cloud,cloud),outputMethod:'source_order_formatter_fallback'});
 assert.equal(result.organizedDraft,false);
 assert.equal(result.scopedFacts,0);
});

test('extra and nonbreaking spaces in an explicit preferred heading retain its optional scope',()=>{
 const result=auditExplicitQualificationScope(value('Minimum qualifications\nBachelor degree.\nPreferred \u00a0 skills\n'+cloud,'## Preferred qualifications and skills\n\n- '+cloud,cloud));
 assert.equal(result.scopedFacts,1);
 assert.deepEqual(result.findings,[]);
});

test('an equal-opportunity sentence terminates the preceding qualification block',()=>{
 const text='We welcome applicants from all backgrounds and treat them fairly.';
 const result=auditExplicitQualificationScope(value('Requirements:\nBachelor degree.\nBroadcom is proud to be an equal opportunity employer.\n'+text,'## Additional role details\n\n- '+text,text));
 assert.equal(result.scopedFacts,0);
 assert.deepEqual(result.findings,[]);
});

test('the employer Desired Skill Set disclaimer establishes optional scope',()=>{
 const source='Minimum Qualification: Bachelor degree.\nDesired Skill Set (not every applicant will have all of these skills)\n'+cloud;
 const result=auditExplicitQualificationScope(value(source,'## Preferred qualifications and skills\n\n- '+cloud,cloud));
 assert.equal(result.scopedFacts,1);
 assert.deepEqual(result.findings,[]);
});

test('Positions Available metadata ends the minimum-qualification block',()=>{
 const text='Positions Available: Analog Design, RF Design';
 const result=auditExplicitQualificationScope(value('Minimum Qualification: Bachelor degree.\n'+text,'## Employment details\n\n- '+text,text));
 assert.equal(result.scopedFacts,0);
 assert.deepEqual(result.findings,[]);
});

test('job-level calibration is excluded from candidate-qualification findings',()=>{
 const text='Job level will be commensurate with experience.';
 const result=auditExplicitQualificationScope(value('Minimum Qualification: Bachelor degree. '+text,'## Employment details\n\n- '+text,text));
 assert.equal(result.excludedEmploymentConditions,1);
 assert.deepEqual(result.findings,[]);
});

test('will be a plus is an individual preference inside a minimum-qualification block',()=>{
 const text='Knowledge of Wireless Transceiver architectures and System trade-offs will be a plus';
 const result=auditExplicitQualificationScope(value('Minimum Qualification:\n'+text,'## Preferred qualifications and skills\n\n- '+text,text));
 assert.equal(result.scopedFacts,1);
 assert.deepEqual(result.findings,[]);
});

test('role-specific required and optional clauses in one fact remain ambiguous',()=>{
 const text='RF Design positions require experience in analog design blocks; knowledge of Wireless Transceiver architectures and System trade-offs will be a plus';
 const result=auditExplicitQualificationScope(value('Minimum Qualification:\n'+text,'## Employment details\n\n- '+text,text));
 assert.equal(result.ambiguousFacts,1);
 assert.equal(result.scopedFacts,0);
 assert.deepEqual(result.findings,[]);
});

test('a role-specific requirement beneath Desired Skill Set is reported as conflicting source scope',()=>{
 const text='Analog Design positions require design experience in amplifier and oscillator circuits';
 const source='Desired Skill Set (not every applicant will have all of these skills)\n'+text;
 const result=auditExplicitQualificationScope(value(source,'## Employment details\n\n- '+text,text));
 assert.equal(result.ambiguousFacts,1);
 assert.equal(result.scopedFacts,0);
 assert.deepEqual(result.findings,[]);
});

test('a duration threshold within an explicit preferred block stays optional',()=>{
 const text='At least five years of experience designing cloud services';
 const result=auditExplicitQualificationScope(value('Preferred Qualifications:\n'+text,'## Preferred qualifications and skills\n\n- '+text,text));
 assert.equal(result.scopedFacts,1);
 assert.deepEqual(result.findings,[]);
});

test('an application invitation ends qualification scope before the employer footer',()=>{
 const invitation='If this job posting draws your interest, we would love to hear from you!';
 const employer='Come join Analog Devices and work on innovative technologies.';
 const result=auditExplicitQualificationScope({
  ...value('Preferred Skills:\n'+cloud+'\n'+invitation+'\n'+employer,'## Preferred qualifications and skills\n\n- '+cloud+'\n\n## Application details\n\n- '+invitation+'\n\n## About the employer\n\n- '+employer),
  sourceSectionFacts:[{text:cloud,section:4},{text:invitation,section:6},{text:employer,section:7}],
 });
 assert.equal(result.scopedFacts,1);
 assert.equal(result.uncoveredFacts,2);
 assert.deepEqual(result.findings,[]);
});
