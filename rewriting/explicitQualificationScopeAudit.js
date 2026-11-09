/** Independent audit of explicit employer qualification blocks; never uses parser scope labels. */
import {FACT_SECTIONS} from './factPlan.js';

const mandatory='(?:required (?:qualifications?(?: and skills)?|technical skills|skills|experience|education)|minimum (?:qualifications?|requirements)|basic (?:qualifications?|requirements)|required|requirements|you should have|what we need to see|what you[\u2019\x27]ll need)';
const optional='(?:preferred (?:qualifications?(?: and skills)?|skills|experience|education)|desired (?:qualifications?|skills|skill set(?: \\(not every applicant will have all of these skills\\))?)|additional experience desired|preferred|nice[- ]to[- ]have|good to have|ways to stand out from the crowd)';
const other='(?:responsibilities|your role and responsibilities|role overview|job description|(?:more )?about (?:us|the employer|the company)|company description|company|your team|our team|benefits(?: and perks)?|rewards and benefits|what we offer|application details|employment details|employment type|employee type|position type|positions available|experience level|job family|posting statement|additional information|use of AI in hiring|EEO statement|equal employment opportunity(?: statement)?|location|job req type|required travel|travel requirements|education|experience|qualifications?|qualification\\s*(?:&|and)\\s*experience|soft skills|shift(?: time)?)';
const labels=new RegExp('(?:^|\\n|[.!?][ \\t]+)[ \\t]*(?:[-•●*][ \\t]+)?('+mandatory+'|'+optional+'|'+other+')[ \\t]*(?::|\\.(?=\\s|$)|(?=\\n|$))','gi');
const isMandatory=new RegExp('^'+mandatory+'$','i'),isOptional=new RegExp('^'+optional+'$','i');
const normalize=value=>String(value??'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const decode=value=>String(value??'').replace(/&#(x[0-9a-f]+|\d+);/gi,(all,n)=>{const code=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return code>0&&code<=0x10ffff?String.fromCodePoint(code):all;})
 .replace(/&(amp|nbsp|quot|apos|lt|gt|ndash|mdash);/gi,(_,name)=>({amp:'&',nbsp:' ',quot:'"',apos:"'",lt:'<',gt:'>',ndash:'\u2013',mdash:'\u2014'}[name.toLowerCase()]));
const contains=(body,fact)=>(' '+body+' ').includes(' '+fact+' ');
const employerBlocks=raw=>{
 const plain=decode(String(raw??'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<\/?(?:p|br|div|li|h[1-6]|section|ul|ol|tr)\b[^>]*>/gi,'\n').replace(/<[^>]+>/g,' ')).replace(/[^\S\r\n]+/g,' ');
 const markers=new Map();
 const add=(match,scope=null)=>{const heading=match[1].trim(),index=match.index+match[0].indexOf(heading);if(!markers.has(index))markers.set(index,{index,end:match.index+match[0].length,heading,scope});};
 for(const match of plain.matchAll(labels))add(match,isMandatory.test(match[1])?'required':isOptional.test(match[1])?'preferred':null);
 for(const match of plain.matchAll(/(\bis (?:proud to be )?an? equal opportunity employer\b)/gi))add(match);
 for(const match of plain.matchAll(/(?:^|\n)[ \t]*(If this job posting draws your interest,[ \t]*we would love to hear from you[!.]?)/gi))add(match);
 for(const match of plain.matchAll(/(?:^|\n)[ \t]*(What is it like working for [^\n?]{1,80}\?)[ \t]*(?=\n|$)/gi))add(match);
 for(const match of plain.matchAll(/^[ \t]*([^\n:.!?]{2,80}):[ \t]*(?=\n|$)/gm)){
  if(!/^(?:(?:solid|strong|good|sound|deep|working|basic|thorough)\s+)?(?:understanding|knowledge|experience|proficiency|expertise)(?:\s+(?:of|in|with))?\s*$/i.test(match[1].trim()))add(match);
 }
 for(const match of plain.matchAll(/^[ \t]*(About [^\n:.!?]{1,80})[ \t]*[:.]?[ \t]*(?=\n|$)/gm))add(match);
 const ordered=[...markers.values()].sort((a,b)=>a.index-b.index);
 return ordered.flatMap((marker,index)=>{
  const body=plain.slice(marker.end,ordered[index+1]?.index??plain.length);
  return marker.scope?[{scope:marker.scope,heading:marker.heading,text:normalize(body),clauses:body.split(/\n+|(?<=[.!?])\s+(?=[A-Z])/).map(raw=>({raw,text:normalize(raw)}))}]:[];
 });
};
const renderedBlocks=description=>{
 const sections=[];let current;
 for(const line of String(description??'').split('\n')){
  if(line.startsWith('## ')){current={name:line.slice(3),id:FACT_SECTIONS.indexOf(line.slice(3)),lines:[]};sections.push(current);}
  else if(current)current.lines.push(line);
 }
 return sections.map(section=>({...section,text:normalize(section.lines.join(' '))}));
};

export function auditExplicitQualificationScope(value) {
 const result={modelDraft:value.outputMethod==='validated_model_plan',organizedDraft:['validated_model_plan','validated_deterministic_plan'].includes(value.outputMethod),scopedFacts:0,ambiguousFacts:0,uncoveredFacts:0,excludedEmploymentConditions:0,findings:[]};
 if(!result.organizedDraft)return result;
 const source=employerBlocks(value.originalDescription),rendered=renderedBlocks(value.description);
 for(const fact of value.sourceSectionFacts||[]){
  const text=normalize(fact.text);
  if(text.length<15||text.split(' ').length<3){result.uncoveredFacts++;continue;}
  const matches=source.filter(block=>contains(block.text,text)),scopes=new Set(matches.map(block=>block.scope));
  if(!scopes.size){result.uncoveredFacts++;continue;}
  if(scopes.size>1){result.ambiguousFacts++;continue;}
  if(/\b(?:background checks?|work authorization|immigration sponsorship|export licensing|equal opportunity employer)\b/i.test(fact.text)||/^This (?:job|role|position) requires? (?:an? awareness|a commitment)\b/i.test(fact.text)||/^Job level will be commensurate with experience\.?$/i.test(fact.text.trim())){result.excludedEmploymentConditions++;continue;}
  const contexts=matches.flatMap(block=>block.clauses.filter(clause=>contains(clause.text,text))).map(clause=>clause.raw);
  const individualPreference=contexts.some(context=>/\b(?:preferred|preferable|nice to have|good to have|desirable|(?:will be|would be|is|are) a plus|(?:will|would) be an? advantage|(?:is|are) (?:highly )?advantageous)\b/i.test(context));
  const mandatoryWithinPreference=scopes.has('preferred')&&contexts.some(context=>/\b(?:required|requires?|mandatory|must)\b/i.test(context));
  if(mandatoryWithinPreference||individualPreference&&contexts.some(context=>/\b(?:required|requires?|mandatory|must|minimum|at least)\b/i.test(context))){result.ambiguousFacts++;continue;}
  const expected=individualPreference?'preferred':[...scopes][0],observed=rendered.filter(block=>contains(block.text,text));result.scopedFacts++;
  const correct=observed.some(block=>expected==='required'?[2,3].includes(block.id):block.id===4);
  const opposite=observed.some(block=>expected==='required'?block.id===4:[2,3].includes(block.id));
  if(opposite||!correct)result.findings.push({reason:opposite?(expected==='required'?'required_demoted':'preferred_promoted'):(expected==='required'?'required_unclassified':'preferred_unclassified'),fact:fact.text,expected,observed:observed.map(block=>block.name),sourceHeadings:[...new Set(matches.map(block=>block.heading))]});
 }
 return result;
}
