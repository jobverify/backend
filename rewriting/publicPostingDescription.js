/** Conservative recovery from an exact role page's employer-authored content. */
import {extractActiveDescription, readNativeDocument} from '../scraper-support/utils/activeNativeHtml.js';
import {ripplingPostingDescription} from './ripplingPostingDescription.js';
import {visiblePostingDescription} from './visiblePostingDescription.js';
const identity=value=>String(value??'').replace(/&amp;/gi,'&').replace(/\s+/g,' ').trim().toLowerCase();
const sameUrl=(a,b)=>{try{const x=new URL(a),y=new URL(b);return x.protocol==='https:'&&y.protocol==='https:'&&x.origin===y.origin&&x.pathname.replace(/\/$/,'')===y.pathname.replace(/\/$/,'')&&x.search===y.search&&x.hash===y.hash;}catch{return false;}};
export {sameUrl as isExactPublicJobUrl};
export function publicPostingDescription(job,html,responseUrl,{employerAliases=[],normalizeTitle=identity}={}) {
  const url=job.sourceUrl||job.applyUrl||job.link;
  if(!sameUrl(url,responseUrl)||!identity(job.title)||!identity(job.company))return null;
  const records=[];
  const visit=(value,depth=0)=>{
    if(!value||depth>8)return;
    if(Array.isArray(value)){for(const item of value)visit(item,depth+1);return;}
    if(typeof value!=='object')return;
    const types=Array.isArray(value['@type'])?value['@type']:[value['@type']];
    if(types.includes('JobPosting'))records.push(value);
    if(value['@graph'])visit(value['@graph'],depth+1);
  };
  let scripts,document;
  try{document=readNativeDocument(html);scripts=document.nodes(node=>node.tag==='script'&&!node.attrs.src&&String(node.attrs.type??'').trim().toLowerCase()==='application/ld+json');}catch{return null;}
  for(const script of scripts){
    try{visit(JSON.parse(script.raw));}catch{return null;}
  }
  if(records.length===0)return ripplingPostingDescription(job,document,responseUrl,{employerAliases,normalizeTitle})
    || visiblePostingDescription(job,document,responseUrl,{sameUrl,normalizeTitle});
  const employers=[job.company,...employerAliases].map(identity);
  const matches=records.filter(value=>identity(normalizeTitle(value.title))===identity(normalizeTitle(job.title))&&employers.includes(identity(value.hiringOrganization?.name))&&sameUrl(value.url,url));
  if(matches.length!==1)return null;
  const value=matches[0],id=value.identifier?.value??(typeof value.identifier==='string'?value.identifier:null),expectedId=job.jobId??job.requisitionId;
  if(id!==null&&id!==undefined&&expectedId!==null&&expectedId!==undefined&&String(id)!==String(expectedId))return null;
  if(!extractActiveDescription(value.description))return null;
  return {description:value.description,evidence:{method:'exact_role_jobposting_schema',url:responseUrl,title:value.title,employer:value.hiringOrganization.name,jobId:id??null}};
}
