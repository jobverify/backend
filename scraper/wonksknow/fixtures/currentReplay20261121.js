import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {document} from '../../../scraper-support/shared/rmkNativePairHtml.js';

export const fixtureFile=new URL('./current-own-india-originals-20261121.json.gz',import.meta.url);
export const digest=value=>createHash('sha256').update(value).digest('hex');
assert.equal(digest(fs.readFileSync(fixtureFile)),'8c6647905160258f924d2127cec1b503ad9dc9002169edc95fb3202bc844a807');
export const originalPacket=JSON.parse(gunzipSync(fs.readFileSync(fixtureFile)));
export const HOME='https://www.wonksknow.com/',BOARD='https://vinterview.ai/wonksknowindia/overview';
export const originalText=record=>Buffer.from(record.bodyBase64,'base64').toString('utf8');
export const firstRoleURL=originalPacket.phases[0].roles[0].url;
export function selectedFragment(html,url){
 const parsed=document(html),parents=new Map(),nodes=[];
 const walk=node=>{nodes.push(node);for(const child of node.children)if(typeof child!=='string'){parents.set(child,node);walk(child);}};walk(parsed.root);
 const anchors=nodes.filter(node=>node.tag==='a'&&/job_application_organization_page/.test(node.attrs.href??''));assert.equal(anchors.length,1);
 assert.equal(new URL(anchors[0].attrs.href,url).searchParams.get('job_id'),new URL(url).searchParams.get('job_id'));
 for(let owner=anchors[0];owner;owner=parents.get(owner))if(parsed.hasClass(owner,'job-opening'))return{parsed,owner,html:parsed.outer(owner)};
 throw Error('Genuine selected-role owner unavailable');
}
export function changeSelected(html,url,change){
 const fragment=selectedFragment(html,url),replacement=change(fragment.html,fragment);
 assert.notEqual(replacement,fragment.html,'Actual selected role mutation must change its real carrier');
 return html.slice(0,fragment.owner.start)+replacement+html.slice(fragment.owner.end);
}
export async function replay(factory,{mutate=(record,text)=>text,options={}}={}){
 const records=structuredClone(originalPacket.responses),calls=[];let cursor=0,audit;
 const fetchImpl=async(url,init)=>{
  const record=records[cursor++];assert(record,'Undeclared extra request');
  assert.equal(url,record.requestedUrl,'Current collector must follow actual own→India overview→all declared roles in both observations');
  assert.equal(init.method,'GET');assert.equal(init.redirect,'manual');assert.equal(init.credentials,'omit');
  assert(!/\/user\/|job_application|graphql/i.test(new URL(url).pathname));
  calls.push({url,method:init.method});
  const change=mutate(record,originalText(record),cursor-1),text=typeof change==='string'?change:change?.text??originalText(record),status=typeof change==='object'?change.status??record.status:record.status;
  const headers={...record.headers,...(typeof change==='object'?change.headers:{})};
  const response=new Response(text,{status,headers});
  Object.defineProperties(response,{url:{value:typeof change==='object'?change.url??record.url:record.url},redirected:{value:typeof change==='object'?change.redirected??record.redirected:record.redirected}});
  return response;
 };
 try{
  const jobs=await factory().run({fetchImpl,requestIntervalMs:0,now:()=>originalPacket.completedAt,onAudit:value=>{audit=value;},...options});
  return{jobs,audit:audit??jobs.nativeCollectionEvidence,error:null,calls,readCount:cursor,expectedReads:records.length};
 }catch(error){return{jobs:null,audit:audit??error.nativeEvidence,error:error.message,errorObject:error,calls,readCount:cursor,expectedReads:records.length};}
}
