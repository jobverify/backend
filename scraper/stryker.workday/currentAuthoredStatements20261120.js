import {readNativeDocument} from '../../scraper-support/utils/activeNativeHtml.js'
import {authoredNativeLines} from '../../scraper-support/native-sources/firstPartyNativeHtml.js'
import {countryName} from '../../scraper-support/native-sources/jobPostingData.js'

const normalize=value=>String(value??'').replace(/\s+/g,' ').trim()
const months=['january','february','march','april','may','june','july','august','september','october','november','december']
function authoredDate(raw,validate,label,observedAt,deadline,failure){
 if(typeof raw!=='string'||!raw.trim())throw failure('Malformed authored '+label)
 const value=raw.trim().replace(/[.!]$/,'')
 if(/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(value))return validate(value,label,observedAt,deadline)
 let match=value.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(\d{4})$/i),day,month,year
 if(match)[,day,month,year]=match
 else{match=value.match(/^([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})$/i);if(match)[,month,day,year]=match}
 const index=months.findIndex(name=>name===month?.toLowerCase()||name.slice(0,3)===month?.toLowerCase())
 if(index<0)throw failure('Malformed authored '+label)
 const calendar=year+'-'+String(index+1).padStart(2,'0')+'-'+day.padStart(2,'0')
 return {...validate(calendar,label,observedAt,deadline),raw:value,normalizedCalendar:calendar}
}
export function countryMentions(value,geography){
 const states=new Set(geography.originalPlaces.flatMap(p=>[p.state,p.stateAbbr]).map(v=>normalize(v).toLowerCase()).filter(Boolean)),words=value.match(/[\p{L}]+/gu)??[],found=new Set()
 for(let start=0;start<words.length;start++)for(let length=1;length<=5&&start+length<=words.length;length++){
  const phrase=words.slice(start,start+length).join(' ')
  if(states.has(phrase.toLowerCase())||phrase.length<=3&&phrase!==phrase.toUpperCase())continue
  const country=countryName(phrase);if(country)found.add(country)
 }
 return [...found]
}
// Interpret scoped authored statements, including those in an otherwise partial
// description. General office references and conditional future filling language
// do not establish the workplace or closure of this vacancy.
export function readAuthoredRoleStatements(records,{failure,validateDate,observedAt,geography,employerNames}){
 const statements=[],publications=[],deadlines=[],need=(ok,message)=>{if(!ok)throw failure(message)}
 const walk=(value,origin,depth=0)=>{
  need(depth<=32,'Excessive native criteria metadata nesting')
  if(!value||typeof value!=='object')return
  for(const [key,part] of Object.entries(value)){
   const field=origin+'.'+key
   if(part&&typeof part==='object'){walk(part,field,depth+1);continue}
   if(typeof part!=='string'||!/description|criteria|qualification|requirement|html$/i.test(key))continue
   const root=readNativeDocument(part).nodes(n=>n.tag==='root')[0],lines=authoredNativeLines(root).map(normalize).filter(Boolean)
   for(const [index,line] of lines.entries()){
    for(const sentence of line.split(/[.!?](?:\s|$)/)){
     const closed=/\b(?:(?:this|the)\s+)?(?:job|role|vacancy|position)\s+(?:is\s+(?:now\s+)?(?:closed|filled|unavailable|no longer available)|has\s+been\s+(?:closed|filled))\b|\b(?:we|company)\s+ha(?:ve|s)\s+(?:closed|filled)\s+(?:this|the)\s+(?:job|role|vacancy|position)\b|\b(?:no longer accepting applications|applications (?:are|have been) closed)\b/i.exec(sentence)
     if(closed)need(/\b(?:until|if|when|once|unless)\b/i.test(sentence.slice(0,closed.index)),'Authored criteria declare this role closed or filled: '+field)
    }
    const match=line.match(/^(?:[•*\-]\s*)?(Closing Date|Application Deadline|Applications Close|Apply By|Valid Through|Expiry Date|Deadline|Date Posted|Posting Date|Publication Date|Published On|Country|Job Location|Work Location|Location|Workplace|Hiring Organization|Legal Employer|Employer|Company|Job Status|Publication Status|Status|Availability)\s*:\s*(.*)$/i)
    if(!match)continue
    const label=match[1],raw=match[2]||lines[index+1]||'',record={origin:field,label,raw}
    statements.push(record)
    if(/status|availability/i.test(label)){
     need(/^(?:open|active|published|approved|accepting applications)$/i.test(raw.trim()),'Authored vacancy status/availability is not current: '+field);record.kind='vacancy-availability'
    }else if(/closing|deadline|applications close|apply by|valid through|expiry/i.test(label)){
     if(/^(?:open until filled|until filled|ongoing|rolling|not specified|n\/?a)$/i.test(raw)){record.kind='open-ended-or-unavailable-deadline';continue}
     const date=authoredDate(raw,validateDate,'deadline',observedAt,true,failure);deadlines.push({field,...date,originalLabel:label});record.kind='deadline';record.date=date
    }else if(/posted|posting date|publication date|published on/i.test(label)){
     const date=authoredDate(raw,validateDate,'publication',observedAt,false,failure);publications.push({field,...date,originalLabel:label});record.kind='publication';record.date=date
    }else if(/employer|organization|company/i.test(label)){
     need(employerNames.some(name=>normalize(name).toLowerCase()===normalize(raw).toLowerCase()),'Authored labelled employer contradicts this role: '+field);record.kind='employer-display'
    }else{
     const countries=label.toLowerCase()==='country'?[countryName(raw)].filter(Boolean):countryMentions(raw,geography)
     need(label.toLowerCase()!=='country'||countries.length>0,'Unqualified authored country label: '+field)
     need(countries.every(country=>geography.countries.includes(country)),'Authored labelled workplace/country contradicts this role: '+field)
     record.kind='workplace';record.countries=countries
    }
   }
  }
 }
 for(const [origin,record] of Object.entries(records))walk(record,origin)
 return {statements,publications,deadlines}
}

// These flags belong to this vacancy's actual native row, JobPosting and own
// role scopes. Unrelated navigation state and EmploymentStatus are not status.
export function readNativePublicationCarriers(model,row,d,owners,{failure,employerNames,validateDate,observedAt}){
 const records=[],publications=[],deadlines=[],need=(ok,message)=>{if(!ok)throw failure(message)},keyName=key=>key.replace(/^data-/i,'').replace(/[-_]/g,'').toLowerCase()
 const positive=new Set(['active','isactive','published','ispublished','canapply','isavailable']),negative=new Set(['closed','isclosed','archived','isarchived','expired','isexpired','disabled','isdisabled','deleted','isdeleted']),statuses=new Set(['status','jobstatus','postingstatus','publicationstatus','availability']),employers=new Set(['employer','employername','hiringorganization','legalemployer','company','companyname']),published=new Set(['dateposted','postingdate','publishedat']),expired=new Set(['validthrough','closingdate','applicationdeadline','expirydate'])
 function read(key,raw,origin,typed=false){
  const name=keyName(key);let kind
  if(statuses.has(name)){need(typeof raw==='string'&&/^(?:open|active|published|approved|accepting applications)$/i.test(normalize(raw)),'Native scoped vacancy status unavailable: '+origin+'.'+key);kind='vacancy-status'}
  else if(positive.has(name)||negative.has(name)){
   const value=typed?raw:typeof raw==='string'&&/^(?:true|false|1|0)$/i.test(raw.trim())?/^(?:true|1)$/i.test(raw.trim()):null
   need(typeof value==='boolean'&&value===positive.has(name),'Native scoped publication/availability disabled: '+origin+'.'+key);kind='vacancy-availability'
  }else if(employers.has(name)){
   const value=raw&&typeof raw==='object'&&!Array.isArray(raw)?raw.name:raw
   need(typeof value==='string'&&employerNames.some(v=>normalize(v).toLowerCase()===normalize(value).toLowerCase()),'Native scoped employer contradicts this vacancy: '+origin+'.'+key);kind='employer-display'
  }else if(['country','countrycode','addresscountry','jobcountry','workcountry','workplacecountry'].includes(name)){
   need(typeof raw==='string'&&countryName(raw)==='India','Native scoped country contradicts this vacancy: '+origin+'.'+key);kind='country'
  }else if(published.has(name)||expired.has(name)){
   const deadline=expired.has(name),value=authoredDate(raw,validateDate,deadline?'deadline':'publication',observedAt,deadline,failure),field=origin+'.'+key
   ;(deadline?deadlines:publications).push({field,...value});kind=deadline?'deadline':'publication'
  }else return
  records.push({origin,field:key,raw,kind})
 }
 for(const[key,value]of Object.entries(model))if(value!=null)read(key,value,'JobPosting',true)
 const attrs=(attributes,origin)=>{for(const[key,value]of Object.entries(attributes??{}))if(key.startsWith('data-'))read(key,value,origin);need(!Object.hasOwn(attributes??{},'disabled')&&attributes?.['aria-disabled']!=='true','Native own vacancy carrier disabled: '+origin)}
 attrs(row.nativeAttributes,'listing.anchor');attrs(row.nativeRowAttributes,'listing.row')
 const itemprops=(doc,node,origin)=>{for(const n of doc.nodes(n=>typeof n.attrs.itemprop==='string',node))for(const key of n.attrs.itemprop.split(/\s+/).filter(Boolean))read(key,n.attrs.content??n.attrs.datetime??doc.text(n),origin+'.itemprop')}
 if(typeof row.originalRowHTML==='string'){const listing=readNativeDocument(row.originalRowHTML),root=listing.nodes(n=>n.tag==='root')[0];for(const n of root.children.filter(n=>typeof n!=='string'))attrs(n.attrs,'listing.original-row');itemprops(listing,root,'listing')}
 for(const[index,owner]of owners.entries()){attrs(owner.attrs,'role.owner['+index+']');itemprops(d,owner,'role.owner['+index+']')}
 records.sort((a,b)=>(a.origin+'.'+a.field).localeCompare(b.origin+'.'+b.field));publications.sort((a,b)=>a.field.localeCompare(b.field));deadlines.sort((a,b)=>a.field.localeCompare(b.field))
 return{records,publications,deadlines}
}
