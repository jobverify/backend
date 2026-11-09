import test from 'node:test';
import assert from 'node:assert/strict';
import {publicPostingDescription} from '../rewriting/publicPostingDescription.js';

const job={title:'Financial Planning & Analysis, Staff',company:'Synopsys',jobId:'19219',sourceUrl:'https://careers.synopsys.com/job/hyderabad/fpa/44408/101746583184'};
const posting={ '@type':'JobPosting',title:job.title,hiringOrganization:{name:job.company},identifier:{value:job.jobId},url:job.sourceUrl,description:'<h3>What You’ll Need:</h3><p>10+ years of financial planning experience.</p>'};
const html=value=>`<script type="application/ld+json">${JSON.stringify(value)}</script>`;

test('recovers an exact employer-authored role in a schema graph',()=>{
  assert.equal(publicPostingDescription(job,html({'@graph':[posting]}),job.sourceUrl)?.description,posting.description);
});
test('source-local employer aliases are opt-in and never change the URL or role identity requirement',()=>{
  const branded={...posting,hiringOrganization:{name:'Verified employer brand'}};
  assert.equal(publicPostingDescription(job,html(branded),job.sourceUrl),null);
  assert.equal(publicPostingDescription(job,html(branded),job.sourceUrl,{employerAliases:['Verified employer brand']})?.description,posting.description);
  assert.equal(publicPostingDescription(job,html({...branded,identifier:{value:'wrong-role'}}),job.sourceUrl,{employerAliases:['Verified employer brand']}),null);
});
test('rejects another role, employer or generic career page even when a description exists',()=>{
  for(const change of [{title:'Another role'},{hiringOrganization:{name:'Another employer'}},{identifier:{value:'9999'}},{url:'https://careers.synopsys.com/search-jobs'}])
    assert.equal(publicPostingDescription(job,html({...posting,...change}),job.sourceUrl),null);
  assert.equal(publicPostingDescription(job,html(posting),'https://careers.synopsys.com/search-jobs'),null);
});
test('rejects malformed or ambiguous role schemas',()=>{
  assert.equal(publicPostingDescription(job,'<script type="application/ld+json">{broken</script>',job.sourceUrl),null);
  assert.equal(publicPostingDescription(job,html([posting,posting]),job.sourceUrl),null);
});

test('rejects schemas inside inactive HTML and placeholder descriptions',()=>{
  for(const content of [`<!--${html(posting)}-->`, `<template>${html(posting)}</template>`,
    `<textarea>${html(posting)}</textarea>`, `<div hidden>${html(posting)}</div>`,
    html({...posting,description:'Description coming soon'}),
    html({...posting,description:'<template>Responsibilities: lead finance projects.</template>'})])
    assert.equal(publicPostingDescription(job,content,job.sourceUrl),null);
});

test('hash-routed role URLs must match even when the schema omits its native identifier',()=>{
  const routed={...job,sourceUrl:'https://careers.synopsys.com/#/job/R100'};
  const schema={...posting,identifier:undefined,url:'https://careers.synopsys.com/#/job/R101'};
  assert.equal(publicPostingDescription(routed,html(schema),routed.sourceUrl),null);
});
