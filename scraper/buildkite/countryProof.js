import {createHash} from 'node:crypto'
import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
import {geography,officeIndex,nativeHTMLText} from '../../scraper-support/native-sources/declaredGreenhouse/nativeData.js'
const clean=value=>typeof value==='string'?value.replace(/\s+/g,' ').trim():''
const key=value=>clean(value).normalize('NFKC').toLowerCase()
const sorted=values=>[...new Set(values)].sort()
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex')
const country=value=>{const label=clean(value).replace(/^the\s+/i,'');return label==='USA'?'United States':nativeCountryName(label)}
const countries=value=>{const one=country(value);if(one)return[one];const parts=value.split(/\s*,\s*|\s+or\s+|\s+and\s+/i).map(clean).filter(Boolean),names=parts.map(country);return names.length&&names.every(Boolean)?sorted(names):null}
const sourceCountryKeys=record=>Object.keys(record).filter(k=>/country|countries|geograph|worksites?|locations/i.test(k)&&!['location','offices'].includes(k))
const members=(record,directory)=>{
 const result=[]
 for(const assigned of record.offices||[]){
  const office=directory.offices.find(o=>o.id===assigned.id)
  if(!office||Object.keys(office).some(k=>!['id','name','location','parent_id','child_ids','departments'].includes(k))||Object.keys(assigned).some(k=>!['id','name','location','parent_id','child_ids'].includes(k))||['name','location','parent_id'].some(k=>JSON.stringify(assigned[k]??null)!==JSON.stringify(office[k]??null))||JSON.stringify(assigned.child_ids)!==JSON.stringify(office.child_ids))return null
  const matching=(office.departments||[]).flatMap(d=>d.jobs||[]).filter(j=>j.id===record.id&&j.title===record.title&&j.absolute_url===record.absolute_url&&j.location?.name===record.location?.name)
  if(!matching.length)return null
  result.push({officeId:office.id,name:office.name,location:office.location,parent_id:office.parent_id,child_ids:office.child_ids,membershipSHA256:hash(matching.map(j=>({id:j.id,title:j.title,absolute_url:j.absolute_url,location:j.location})))})
 }
 return result
}
const jobSection=text=>{const at=text.search(/\bJob Location\s*:/i);return at<0?'':text.slice(at).replace(/^Job Location\s*:\s*/i,'').slice(0,500)}
const closedBuildkite=text=>{
 const prefixes=[...text.matchAll(/\b(?:This role is remote and requires someone to be located in|This is a fully remote role, open to candidates based in)\b/gi)]
 if(!prefixes.length)return null
 const matches=[...text.matchAll(/\b(?:This role is remote and requires someone to be located in|This is a fully remote role, open to candidates based in)\s+([^.!?]+)\./gi)]
 const statements=matches.map(m=>({statement:m[0],countries:countries(m[1].replace(/\s*\(West Coast only at this stage\)\s*$/i,''))}))
 if(prefixes.length!==matches.length||statements.some(row=>!row.countries))return{unresolved:true,statements,reason:'published-role-country-restriction-unparsed'}
 if(new Set(statements.map(row=>JSON.stringify(row.countries))).size!==1)return{conflict:true,statements,reason:'published-whole-role-country-restrictions-conflict'}
 return{kind:'explicit-role-based-country-list',statement:statements.map(row=>row.statement).join(' '),statements,countries:statements[0].countries}
}
const tripadvisorClause=section=>{
 const grouped=section.match(/^(?:Hybrid|Remote|On[- ]site)\s*-\s*([A-Za-z][A-Za-z ]+?)\s*\(([^()]+)\)\s+or\s+([A-Za-z][A-Za-z ]+?)\s*\(([^()]+)\)(?=\s+This role\b|$)/i)
 if(grouped){const left=country(grouped[1]),right=country(grouped[3]);if(left&&right){const cityCountries={};for(const[name,list]of[[left,grouped[2]],[right,grouped[4]]])for(const city of list.split(/[\/,]/).map(clean)){if(!city||Object.hasOwn(cityCountries,key(city))&&cityCountries[key(city)]!==name)return null;cityCountries[key(city)]=name}return{kind:'labelled-role-country-city-groups',statement:grouped[0],countries:sorted([left,right]),cityCountries}}}
 const direct=section.match(/\bThis role is a remote position in\s+(?:the\s+)?([A-Za-z][A-Za-z ]+?)\./i),name=direct&&country(direct[1])
 return name?{kind:'labelled-role-country-statement',statement:direct[0],countries:[name]}:null
}
export function reviewNativeWorkCountry(record,directory,source){
 const kind=record?.internal_job_id===null?'prospect':Number.isSafeInteger(record?.internal_job_id)&&record.internal_job_id>0?'job':'unresolved'
 if(kind==='prospect')return{kind,indiaScope:'not-vacancy',proof:null}
 const unknown=reason=>({kind,indiaScope:'unknown',proof:null,reason})
 if(kind!=='job'||!['buildkite','tripadvisor'].includes(source)||sourceCountryKeys(record).length)return unknown('unreviewed-native-post-kind-or-country-field')
 let geo;try{geo=geography(record,officeIndex(directory))}catch{return unknown('native-office-directory-unavailable')}
 const base={kind,nativeGeography:geo,proof:null}
 if(geo.sourceNativeCountryConflict)return{...base,indiaScope:'conflict',reason:'native-country-conflict'}
 const text=nativeHTMLText(record.content),section=jobSection(text),statement=source==='buildkite'?closedBuildkite(text):tripadvisorClause(section),evidence=geo.sourceNativeCountryEvidence,unknownPrimary=evidence.primary.filter(p=>!p.country),unknownOffices=evidence.assignedOffices.filter(p=>!p.country),unknownMetadata=evidence.typedMetadata.filter(p=>!p.country),known=geo.sourceNativeCountries
 if(statement?.unresolved)return{...base,indiaScope:'unknown',reason:statement.reason,unresolvedStatements:statement.statements}
 if(statement?.conflict)return{...base,indiaScope:'conflict',reason:statement.reason,conflictingStatements:statement.statements}
 if(statement&&known.some(name=>!statement.countries.includes(name)))return{...base,indiaScope:'conflict',reason:'published-role-country-statement-conflicts-with-native-country',conflictingStatement:statement}
 if(!geo.sourceCountryScopeUnresolved)return{...base,indiaScope:known.includes('India')?'india':'foreign'}
 const bindings=members(record,directory)
 if(!bindings||unknownMetadata.length)return unknown('own-native-office-membership-or-country-metadata-unresolved')
 let proof=statement
 if(source==='buildkite'){
  if(!proof||unknownPrimary.some(p=>p.originalLabel!=='ANZ Region')||unknownOffices.some(p=>p.originalLabel!=='Europe'))return{...base,indiaScope:'unknown',reason:'native-region-or-timezone-has-no-complete-role-owned-country-restriction'}
 }else{
  if(proof?.cityCountries){if(unknownOffices.length||unknownPrimary.some(p=>!Object.hasOwn(proof.cityCountries,key(p.originalLabel))))return{...base,indiaScope:'unknown',reason:'additional-native-place-is-not-bound-by-the-published-country-city-groups'}}
  else if(proof){if(unknownOffices.length||unknownPrimary.some(p=>p.originalLabel!=='Office'))return{...base,indiaScope:'unknown',reason:'additional-native-workplace-remains-unresolved'}}
  else if(unknownPrimary.length===1&&unknownPrimary[0].originalLabel==='Hybrid'&&!unknownOffices.length&&known.length===1&&/\s-\sRemote\s*\/\sHybrid\s*$/.test(record.location?.name||''))proof={kind:'country-bound-native-workstyle-suffix',statement:record.location.name,countries:[known[0]]}
  else if(unknownPrimary.length&&unknownPrimary.every(p=>p.originalLabel==='Office')&&!unknownOffices.length&&known.length===1&&evidence.assignedOffices.length&&/\bThis role\b[^.]{0,180}\b(?:requires|position)\b[^.]{0,180}\boffice\b/i.test(section)&&evidence.assignedOffices.every(p=>p.cityLabel&&key(section).includes(key(p.cityLabel))&&p.country===known[0]))proof={kind:'labelled-role-workplace-and-current-assigned-office',statement:section.match(/\bThis role\b[^.]+\./i)?.[0]||section,countries:[known[0]]}
  if(!proof)return{...base,indiaScope:'unknown',reason:'native-workplace-label-has-no-role-owned-country-binding'}
 }
 proof={...proof,source,jobId:String(record.id),publisher:record.company_name,originalPrimaryLocation:record.location,originalNativeCountries:known,originalCountryAssociationUnresolved:true,officeBindings:bindings,nativeRecordSHA256:hash(record),directorySHA256:hash(directory)}
 proof.bindingSHA256=hash({kind:proof.kind,jobId:proof.jobId,countries:proof.countries,statement:proof.statement,originalPrimaryLocation:proof.originalPrimaryLocation,officeBindings:bindings})
 return{...base,indiaScope:proof.countries.includes('India')?'india':'foreign',countries:proof.countries,proof}
}
