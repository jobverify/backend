/** Check rendered drafts independently of generation; do not claim semantic accuracy. */
import fs from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createInterface} from 'node:readline';
import path from 'node:path';
import {FACT_SECTIONS} from './factPlan.js';
import {formatEmployerSource} from './sourceOrderFormatter.js';
import {writeFileAtomically} from './atomicFile.js';
import {buildRewriteInput,validateRewrite} from '../src/services/jobDescriptionPolicy.js';

export function auditDescriptionCase(value) {
  const failures=[];
  if(!value.description)return {ok:false,failures:['missing_description']};
  if(value.outputMethod==='source_order_formatter_fallback') {
    const formatted=formatEmployerSource(value.originalDescription);
    if(!formatted.preserved||value.description!==formatted.description)failures.push('source_payload_changed');
  } else if(value.outputMethod==='validated_source_grounded_sections') {
    if (!value.job || !value.rawPlan) failures.push('missing_grounded_input_for_audit');
    else {
      const input=buildRewriteInput({...value.job,sourceDescription:value.originalDescription});
      const checked=validateRewrite(value.rawPlan,input,value.finishReason);
      if(!checked.ok)failures.push('grounded_'+checked.reason);
      else if(value.description!==checked.description)failures.push('rendered_description_changed');
    }
  } else if(value.outputMethod==='validated_model_plan') {
    if(!Array.isArray(value.sourceSectionFacts)||!value.sourceSectionFacts.length)failures.push('missing_source_facts_for_audit');
    const sections=new Map();let current=null;
    for(const line of value.description.split('\n')) {
      if(line.startsWith('## ')){current=FACT_SECTIONS.indexOf(line.slice(3));if(!sections.has(current))sections.set(current,[]);}
      else if(current!==null)sections.get(current).push(line);
    }
    for(const fact of value.sourceSectionFacts||[]) {
      if(!value.description.includes(fact.text))failures.push('source_fact_missing');
      if([2,3,4].includes(fact.section)&&!(sections.get(fact.section)||[]).join('\n').includes(fact.text))failures.push(fact.section===4?'preferred_scope_changed':'required_scope_changed');
    }
  } else failures.push('unknown_output_method');
  return {ok:!failures.length,failures:[...new Set(failures)]};
}

export async function auditDescriptionRun(outputDir) {
  const counts={reviewed:0,checksPassed:0,modelDrafts:0,fallbackDrafts:0,failed:0},reasons={},failures=[],sample=[],strata=new Map();
  const lines=createInterface({input:createReadStream(path.join(outputDir,'results.ndjson')),crlfDelay:Infinity});
  for await(const line of lines) {
    if(!line.trim())continue;
    const row=JSON.parse(line),file=path.join(outputDir,'cases',String(row.index).padStart(6,'0')+'-'+row.key.slice(0,12)+'.json');
    const value=JSON.parse(await fs.readFile(file,'utf8')),check=auditDescriptionCase(value);
    counts.reviewed++;if(check.ok)counts.checksPassed++;else{counts.failed++;failures.push({key:row.key,source:row.source,title:row.title,file,failures:check.failures});for(const reason of check.failures)reasons[reason]=(reasons[reason]||0)+1;}
    if(['validated_model_plan','validated_source_grounded_sections'].includes(row.outputMethod))counts.modelDrafts++;else if(row.outputMethod==='source_order_formatter_fallback')counts.fallbackDrafts++;
    const words=row.sourceWords<250?'under250':row.sourceWords<500?'250-499':row.sourceWords<1000?'500-999':'1000plus';
    const stratum=words+'|'+row.outputMethod+'|'+(row.reason||'accepted');
    if((strata.get(stratum)||0)<2&&sample.length<80){sample.push({file,source:row.source,title:row.title,words:row.sourceWords,method:row.outputMethod,reason:row.reason,check,...value});strata.set(stratum,(strata.get(stratum)||0)+1);}
  }
  const summary={generatedAt:new Date().toISOString(),...counts,reasons,reviewSampleSize:sample.length,
    verifies:['Historical plans retain parsed facts; grounded sections pass source evidence validation and render equality','Required and preferred facts remain in their parsed source sections','Fallback output preserves normalized source wording and order'],
    limitation:'These automatic checks depend on the source parser and validator. They do not independently prove semantic entailment or category correctness. The stratified sample still requires semantic review.'};
  await writeFileAtomically(path.join(outputDir,'quality-audit.json'),JSON.stringify({...summary,failures},null,2)+'\n');
  await writeFileAtomically(path.join(outputDir,'review-sample.json'),JSON.stringify(sample,null,2)+'\n');
  return summary;
}
