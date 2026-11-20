import {nativeCountryName} from '../../scraper-support/shared/nativeJobPosting.js'
const norm=value=>String(value??'').replace(/\s+/g,' ').trim()
const unit=value=>typeof value==='string'&&/^(?:NICE\s+)?Actimize(?:\s*[-–]\s*[\p{L}\p{N}][\p{L}\p{N}\s/&()-]*)?$/iu.test(norm(value))
const scopeField=value=>['businessunit','division','employerunit','hiringunit','organizationunit'].includes(norm(value).replace(/[-_\s]/g,'').toLowerCase())
function wholeCountry(value){if(typeof value!=='string')return null;const prefix=value.split(/\s+-\s+/)[0],country=nativeCountryName(prefix);if(!country)return null;const words=value.match(/[\p{L}]+/gu)??[];for(let start=0;start<words.length;start++)for(let length=1;length<=5&&start+length<=words.length;length++){const phrase=words.slice(start,start+length).join(' ');if(phrase.length>3){const other=nativeCountryName(phrase);if(other&&other!==country)return null}}return country}
export function classifyCurrentActimizeUnit(record){
 const departments=Array.isArray(record?.departments)?record.departments:[],metadata=Array.isArray(record?.metadata)?record.metadata:[],evidence=[...departments.filter(d=>unit(d?.name)).map(d=>({kind:'native-current-department',original:d})),...metadata.filter(m=>scopeField(m?.name)&&unit(typeof m.value==='string'?m.value:m.value?.name)).map(m=>({kind:'native-explicit-employer-unit-field',original:m}))],country=wholeCountry(record?.location?.name)
 return{exactUnitQualified:evidence.length>0,country,evidence,scopeUnresolved:evidence.length===0,metadataKeywordsAndContactDomainsNotEmployerProof:true,titleAndProductSkillKeywordsNotEmployerProof:true}
}
export const isCurrentActimizeIndiaCandidate=record=>{const scope=classifyCurrentActimizeUnit(record);return scope.exactUnitQualified&&scope.country==='India'}
