import {nativeDate} from '../../scraper-support/shared/nativeJobPosting.js'
import {constraints as canonicalConstraints,need} from './currentFacts20261120.js'

const key=value=>String(value).replace(/^data[-_:]/i,'').replace(/[-_\s]/g,'').toLowerCase()
const posting=new Set(['dateposted','posteddate','postingdate','publicationdate','publishedat','publishedon','createddate','createdat'])
const expiry=new Set(['expires','validthrough','closingdate','applicationdeadline','dateexpires','expirydate','expirationdate','applicationsclose'])
const normalizedField=token=>['listed','islisted','visible','isvisible'].includes(key(token))?'ispublished':['hidden','ishidden','confidential','isconfidential'].includes(key(token))?'isclosed':['worklocationcountry','joblocationcountry','locationcountry'].includes(key(token))?'workcountry':key(token)==='applicationsclose'?'validThrough':token
const dateField=token=>posting.has(key(token))&&!['dateposted','posteddate','postingdate','publicationdate'].includes(key(token))?'datePosted':normalizedField(token)

// The genuine public feed supplies numeric UTC offsets. Validate local calendar,
// clock and finite civil offset before comparing in UTC; never replace raw data.
export function sourceDate(value){
 need(typeof value==='string','native publication date must be a string')
 const raw=value,trimmed=value.trim(),match=/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?([+-])(\d{2}):(\d{2})$/.exec(trimmed)
 if(!match){const us=/^(\d{2})\/(\d{2})\/(\d{4})$/.exec(trimmed),parsed=nativeDate(us?us[3]+'-'+us[1]+'-'+us[2]:trimmed,{required:true});return{...parsed,raw}}
 const[,day,hour,minute,second,fraction,sign,offsetHour,offsetMinute]=match
 need(+hour<24&&+minute<60&&+second<60&&+offsetMinute<60&&(+offsetHour<14||+offsetHour===14&&+offsetMinute===0),'impossible source timestamp clock/timezone')
 const localText=day+'T'+hour+':'+minute+':'+second+'.'+(fraction??'').padEnd(3,'0')+'Z',local=new Date(localText)
 need(Number.isFinite(+local)&&local.toISOString()===localText,'impossible source timestamp calendar')
 const offset=(+offsetHour*60+ +offsetMinute)*60000*(sign==='+'?1:-1),instant=new Date(+local-offset)
 need(Number.isFinite(+instant),'source timestamp instant outside supported calendar')
 return{raw,iso:instant.toISOString(),precision:fraction?'millisecond':'second',exact:true}
}

// Canonical constraints retain their publication/expiry policy. Only this
// source's recognized date carriers are decoded; all other facts pass unchanged.
export function constraints(properties,blocks,config){
 const originals=new Map(),remember=(field,value,kind)=>{
  const date=sourceDate(value),id=kind+'\0'+field+'\0'+date.iso,list=originals.get(id)??[]
  list.push(date);originals.set(id,list);return date.exact?date.iso:value.trim()
 }
 const normalized=properties.map(property=>{
  const tokens=String(property.key).split(/\s+/).filter(Boolean),dateTokens=tokens.filter(token=>posting.has(key(token))||expiry.has(key(token)))
  if(!dateTokens.length||property.value==null||property.value==='')return{...property,key:tokens.map(normalizedField).join(' ')}
  let value=property.value
  for(const token of dateTokens)value=remember(dateField(token),property.value,posting.has(key(token))?'posted':'expiry')
  return{...property,key:tokens.map(dateField).join(' '),value}
 })
 const lines=blocks.map(block=>{
  const labelled=/^([^:]{1,45})\s*:\s*(.+)$/.exec(block)
  if(!labelled)return block
  if(!posting.has(key(labelled[1]))&&!expiry.has(key(labelled[1])))return normalizedField(labelled[1])+': '+labelled[2]
  const field=posting.has(key(labelled[1]))&&!['dateposted','posteddate','postingdate','publicationdate'].includes(key(labelled[1]))?'datePosted':labelled[1]
  return field+': '+remember(field,labelled[2].trim(),posting.has(key(labelled[1]))?'posted':'expiry')
 })
 const dates=canonicalConstraints(normalized,lines,config)
 for(const kind of['posted','expiry'])for(const date of dates[kind]){const original=originals.get(kind+'\0'+date.field+'\0'+date.iso)?.shift();if(original)Object.assign(date,original)}
 return dates
}
