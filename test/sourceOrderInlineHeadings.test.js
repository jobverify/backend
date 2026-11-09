import test from 'node:test';
import assert from 'node:assert/strict';
import {formatEmployerSource} from '../rewriting/sourceOrderFormatter.js';

test('encoded whole HTML documents expose employer headings without markup attributes',()=>{
 const source='&lt;div class="content-intro"&gt;&lt;h3&gt;Required Qualifications&lt;/h3&gt;&lt;ul&gt;&lt;li data-ccp-props="{123:456}"&gt;3+ years of C++ &amp;amp; Java.&lt;/li&gt;&lt;/ul&gt;&lt;h3&gt;Preferred Qualifications&lt;/h3&gt;&lt;p style="font-size:12px"&gt;Python is a plus.&lt;/p&gt;&lt;/div&gt;';
 const draft=formatEmployerSource(source,{decodeEncodedMarkup:true});
 assert.equal(draft.preserved,true);
 assert.match(draft.description,/## Required Qualifications/);
 assert.match(draft.description,/## Preferred Qualifications/);
 assert.match(draft.description,/- 3\+ years of C\+\+ & Java\./);
 assert.match(draft.description,/Python is a plus\./);
 assert.doesNotMatch(draft.description,/content-intro|data-ccp|font-size|123:456|<\/?(?:div|li|p|h3)/);
 assert.match(formatEmployerSource(source).description,/content-intro/);
});

test('ordinary prose with encoded literal HTML remains prose with the option enabled',()=>{
 const source='Document examples of &lt;div&gt; markup and explain 2 &lt; 3 without changing the employer text.';
 assert.deepEqual(formatEmployerSource(source,{decodeEncodedMarkup:true}),formatEmployerSource(source));
 assert.match(formatEmployerSource(source,{decodeEncodedMarkup:true}).description,/\\<div\\>/);
});

test('explicit combined required-skills and good-to-have headings remain separate',()=>{
 const source='<h3>KEY RESPONSIBILITIES</h3><p>Provide customer support.</p><h3>QUALIFICATIONS &amp; REQUIRED SKILLS</h3><p>Experience: 3 to 5 years in technical support.</p><h3>PREFERRED QUALIFICATIONS</h3><p>Bachelor degree.</p><h4>Good to Have</h4><p>Vendor certifications are preferred.</p>';
 const draft=formatEmployerSource(source,{recoverInlineHeadings:true});
 assert.equal(draft.preserved,true);
 assert.match(draft.description,/## QUALIFICATIONS & REQUIRED SKILLS/);
 assert.match(draft.description,/## Good to Have/);
 assert.ok(draft.description.indexOf('3 to 5 years')<draft.description.indexOf('## PREFERRED QUALIFICATIONS'));
 assert.doesNotMatch(formatEmployerSource(source).description,/## QUALIFICATIONS & REQUIRED SKILLS/);
});

test('the optional formatter recovers explicit flattened employer headings in source order',()=>{
 const source='Company introduction. Your role and responsibilities. Design reliable systems for customers. Qualifications for the role . B. Tech/ B.E and two years of engineering experience. Preferred Qualifications: Python knowledge. More about us. We build industrial products.';
 const draft=formatEmployerSource(source,{recoverInlineHeadings:true});
 assert.equal(draft.preserved,true);
 assert.match(draft.description,/## Your role and responsibilities\./);
 assert.match(draft.description,/## Qualifications for the role \./);
 assert.match(draft.description,/## Preferred Qualifications:/);
 assert.ok(draft.description.indexOf('Design reliable')<draft.description.indexOf('B. Tech/ B.E'));
 assert.ok(draft.description.indexOf('B. Tech/ B.E')<draft.description.indexOf('Python knowledge'));
});
test('ordinary prose mentioning qualifications does not become an invented heading',()=>{
 const draft=formatEmployerSource('We evaluate applicant qualifications for the role during interviews. Responsibilities include coordinating delivery with customers.',{recoverInlineHeadings:true});
 assert.equal(draft.headingCount,0);
 assert.equal(draft.preserved,true);
});
test('the existing baseline format stays unchanged without the experimental option',()=>{
 const source='Job description. Design software. Required Qualifications: Bachelor degree.';
 assert.equal(formatEmployerSource(source).headingCount,0);
 assert.equal(formatEmployerSource(source,{recoverInlineHeadings:true}).headingCount,2);
});

test('exposed employer bullet markers do not cause a false wording-change rejection',()=>{
 const source='Job Description:\nSummary: Protect information assets. Responsibilities: • Analyze and assess risks against business operations. • Implement security measures for network systems.';
 const draft=formatEmployerSource(source,{recoverInlineHeadings:true});
 assert.equal(draft.preserved,true);
 assert.match(draft.description,/Analyze and assess risks against business operations\./);
 assert.match(draft.description,/Implement security measures for network systems\./);
});

test('inline formatting retains numeric signs and literal punctuation inside a fact',()=>{
 const source='Role overview: This position evaluates temperatures from -20 to +50 degrees. Responsibilities: Calculate a • b for the documented test and record each result.';
 const draft=formatEmployerSource(source,{recoverInlineHeadings:true});
 assert.equal(draft.preserved,true);
 assert.match(draft.description,/-20 to \+50 degrees/);
 assert.match(draft.description,/a • b/);
});
