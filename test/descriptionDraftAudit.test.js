import test from 'node:test';
import assert from 'node:assert/strict';
import {auditDescriptionCase} from '../rewriting/auditDescriptionRun.js';
import {formatEmployerSource} from '../rewriting/sourceOrderFormatter.js';

test('audit catches a required fact copied into preferred qualifications',()=>{
 const result=auditDescriptionCase({outputMethod:'validated_model_plan',sourceSectionFacts:[{section:2,text:'Three years of Java experience.'}],description:'## Preferred qualifications and skills\n\n- Three years of Java experience.'});
 assert.equal(result.ok,false);assert.ok(result.failures.includes('required_scope_changed'));
});
test('audit catches omitted facts even when a model plan was accepted',()=>{
 const result=auditDescriptionCase({outputMethod:'validated_model_plan',sourceSectionFacts:[{section:1,text:'Maintain customer software.'},{section:2,text:'Bachelor degree.'}],description:'## Required qualifications\n\n- Bachelor degree.'});
 assert.equal(result.ok,false);assert.ok(result.failures.includes('source_fact_missing'));
});
test('fallback keeps HTML source wording, original headings and scope',()=>{
 const originalDescription='<p>Basic Requirements</p><ul><li>Bachelor degree &amp; three years of experience.</li></ul><p>Preferred Qualifications</p><p>Cloud skills.</p>';
 const formatted=formatEmployerSource(originalDescription);
 assert.equal(auditDescriptionCase({originalDescription,outputMethod:'source_order_formatter_fallback',description:formatted.description}).ok,true);
 assert.equal(auditDescriptionCase({originalDescription,outputMethod:'source_order_formatter_fallback',description:formatted.description.replace('three','one')}).ok,false);
});
