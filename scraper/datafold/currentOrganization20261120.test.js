import fs from'node:fs';import{gunzipSync}from'node:zlib';import{createHash}from'node:crypto';import test from'node:test';import assert from'node:assert/strict';import{readNative,BOARD}from'./currentProgrammeData.js';
const fixture=JSON.parse(gunzipSync(fs.readFileSync(new URL('./fixtures/native-board-20261120.json.gz',import.meta.url)))),text=Buffer.from(fixture.bodyBase64,'base64').toString(),sha=v=>createHash('sha256').update(v).digest('hex');
assert.equal(sha(text),fixture.sha256);assert.equal(fixture.bodyOriginalUnmodified,true);
const marker='window.__appData = ',start=text.indexOf(marker)+marker.length;let end=start,depth=0,quoted=false,escaped=false;
for(;end<text.length;end++){const c=text[end];if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;continue}if(c==='"')quoted=true;else if(c==='{'||c==='[')depth++;else if((c==='}'||c===']')&&!--depth){end++;break}}
const original=JSON.parse(text.slice(start,end)),packet=body=>({url:BOARD,status:200,headers:fixture.headers,text:body,hash:sha(body)}),mutate=fn=>{const value=structuredClone(original);fn(value.organization);return text.slice(0,start)+JSON.stringify(value)+text.slice(end)};
test('actual current feature flags are metadata with unchanged explicit native account and employer',()=>{const value=readNative(packet(text));assert.equal(value.model.organization.organizationId,'25c04251-28a2-46f6-aeea-58822308757a');assert.equal(value.model.organization.hostedJobsPageSlug,'datafold');assert.deepEqual(value.model.organization.activeFeatureFlags,original.organization.activeFeatureFlags)});
for(const[label,change]of[
 ['employer',o=>{o.name='Foreign Employer'}],['tenant',o=>{o.organizationId='00000000-0000-4000-8000-000000000000'}],
 ['slug',o=>{o.hostedJobsPageSlug='foreign'}],['corporate authority',o=>{o.publicWebsite='https://foreign.invalid'}],['demo tenant',o=>{o.isDemoOrg=true}],
 ['additional native board criteria',o=>{o.theme.jobBoardTopDescriptionHtml='<p>India applicants may apply.</p>'}],
])test('current metadata does not admit changed '+label,()=>assert.throws(()=>readNative(packet(mutate(change))),/employer|account|scope|criteria|publication/i));

test('current own organization branding is retained without becoming role or application authority',()=>{const changed=mutate(o=>{o.theme.logoWordmarkImageUrl='https://www.datafold.com/new-public-logo.svg';o.activeFeatureFlags=[...o.activeFeatureFlags,'ControlledNonRecruitmentFlag']});const value=readNative(packet(changed));assert.equal(value.model.organization.theme.logoWordmarkImageUrl,'https://www.datafold.com/new-public-logo.svg');assert.ok(value.model.organization.activeFeatureFlags.includes('ControlledNonRecruitmentFlag'))});
