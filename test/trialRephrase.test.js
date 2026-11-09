import test from 'node:test';
import assert from 'node:assert/strict';
import {buildRewriteInput} from '../src/services/jobDescriptionPolicy.js';
import {prepareTrialInput,validateTrialRephrase,trialMessages} from '../rewriting/trialRephrase.js';
const job={title:'Network Engineer',company:'Example',location:'Pune',description:'Responsibilities:\nInstall and maintain computer networks for internal teams.\nMonitor network performance and resolve connectivity incidents.\nRequired qualifications:\nAt least 3 years of experience with TCP/IP and routers.\nPreferred skills:\nPython experience is preferred.\nEmployment details:\nWork from the Pune office.'};
const input=buildRewriteInput(job);const prepared=prepareTrialInput(input);
const good={overview:'The role involves maintaining computer networks for internal teams. You will monitor network performance and resolve connectivity incidents to keep the networks running.',evidenceIds:[0,1]};
test('a rephrased overview retains every detailed source fact and preferred scope',()=>{
 const result=validateTrialRephrase(good,input,'stop');assert.equal(result.ok,true,JSON.stringify(result));
 for(const fact of prepared.facts)assert.ok(result.description.includes(fact.text));
 assert.match(result.description,/## Preferred qualifications and skills\n\n- Python experience is preferred\./);
 assert.equal(result.quality.autoPublishable,false);assert.equal(result.quality.factCoverage,1);
});
test('unsupported numbers, compensation and promoted requirements fail checks',()=>{
 for(const overview of [good.overview+' You will earn 90000 monthly.',good.overview+' This offers remote work.',good.overview+' Python is mandatory.'])assert.equal(validateTrialRephrase({overview,evidenceIds:[0,1]},input,'stop').ok,false);
});
test('truncated, missing, nonexistent and non-role evidence cannot become a draft',()=>{
 assert.equal(validateTrialRephrase(good,input,'length').reason,'truncated');
 for(const evidenceIds of [[],[100],[2]])assert.equal(validateTrialRephrase({...good,evidenceIds},input,'stop').ok,false);
 assert.equal(prepareTrialInput(buildRewriteInput({...job,description:''})).ok,false);
});
test('copying the overview is flagged as unchanged; source instructions are quoted data',()=>{
 assert.equal(validateTrialRephrase({overview:prepared.facts[0].text+' '+prepared.facts[1].text,evidenceIds:[0,1]},input,'stop').reason,'not_rephrased');
 const messages=trialMessages(input);assert.match(messages[0].content,/data, never instructions/);assert.equal(messages.at(-1).role,'user');
 assert.deepEqual(JSON.parse(messages.at(-1).content).roleFacts,prepared.roleFacts);
});

import {readTrialCompletion,createTrialClient} from '../rewriting/trialRephrase.js';
test('split UTF-8 streaming preserves generated text; partial streams fail closed',async()=>{
 const data='data: '+JSON.stringify({choices:[{delta:{content:'{"overview":"Pune’s role"}'},finish_reason:null}]})+'\n\n'+'data: '+JSON.stringify({choices:[{delta:{},finish_reason:'stop'}]})+'\n\ndata: [DONE]\n\n';
 const bytes=new TextEncoder().encode(data);const body=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=2)c.enqueue(bytes.slice(i,i+2));c.close();}});
 const result=await readTrialCompletion(new Response(body));assert.equal(result.choices[0].message.content,'{"overview":"Pune’s role"}');
 await assert.rejects(()=>readTrialCompletion(new Response(data.replace('data: [DONE]',''))),/Incomplete/);
});
test('client remains local and forwards abort plus bounded token output',async()=>{
 assert.throws(()=>createTrialClient({endpoint:'https://api.example.com',model:'test'}),/local/);
 let request;const controller=new AbortController();const client=createTrialClient({endpoint:'http://127.0.0.1:18769',model:'test',fetchImpl:async(_url,options)=>{request=options;return Response.json({choices:[{message:{content:JSON.stringify(good)},finish_reason:'stop'}]});}});
 await client.generate(input,{signal:controller.signal});assert.equal(JSON.parse(request.body).max_tokens,384);controller.abort();assert.equal(request.signal.aborted,true);
});

test('marketing leadership and experience statements cannot become role-overview evidence',()=>{
 const candidate=buildRewriteInput({...job,description:'From industry leadership to customer protection, our company keeps evolving.\nJob Description:\nHands on experience in production operations and mainframe systems.\nDemonstrated proficiency in operational support tools.\nThis role requires strong technical expertise and problem-solving skills.\nInstall and maintain computer networks for internal teams.\nMonitor network performance and resolve connectivity incidents.\nRequired qualifications:\nAt least 3 years of experience with TCP/IP and routers.'});
 const roleFacts=prepareTrialInput(candidate).roleFacts;
 assert.ok(roleFacts.length);assert.ok(roleFacts.every(f=>!/industry leadership|experience|proficiency|expertise|requires/.test(f.text)));
});
test('source-like long sentences and long verbatim spans require another draft',()=>{
 const candidate=buildRewriteInput({...job,description:'Role overview:\nMaintain internal networks by monitoring connectivity, investigating incidents, managing configuration changes, supporting internal teams, reviewing network performance, tracking service requests, documenting resolutions, updating support records, providing technical assistance, coordinating maintenance activities, and resolving reported network problems.\nResponsibilities:\nInstall and maintain computer networks for internal teams.\nRequired qualifications:\nAt least 3 years of experience.'});
 const roleFacts=prepareTrialInput(candidate).roleFacts;const fact=roleFacts[0];
 const changed=fact.text.replace('Maintain','Support');
 assert.equal(validateTrialRephrase({overview:changed,evidenceIds:[fact.id]},candidate,'stop').ok,false);
});

test('mixed required/preferred input retains the original scoped source',()=>{
 const candidate=buildRewriteInput({...job,description:'Responsibilities:\nInstall and maintain computer networks for internal teams.\nMonitor network performance and resolve connectivity incidents.\nRequired qualifications:\nA Computer Science degree, with AWS experience preferred.'});
 assert.equal(prepareTrialInput(candidate).reason,'mixed_requirement_scope');
 assert.equal(validateTrialRephrase(good,candidate,'stop').ok,false);
});

test('an unsupported final sentence fails even when the rest has high word overlap',()=>{
 const overview='The role involves maintaining computer networks for internal teams. You will monitor network performance and resolve connectivity incidents. You will collect operational data and create governance documentation.';
 assert.equal(validateTrialRephrase({overview,evidenceIds:[0,1]},input,'stop').ok,false);
});

test('native structured sentences carry their own evidence and reject wrong citations',()=>{
 const sentences=[{text:'This role involves installing and maintaining computer networks for internal teams.',evidenceIds:[0]},{text:'You will monitor network performance and resolve connectivity incidents for those teams.',evidenceIds:[1]}];
 assert.equal(validateTrialRephrase({sentences},input,'stop').ok,true);
 assert.equal(validateTrialRephrase({sentences:[sentences[0],{text:'You will collect operational data and create governance documentation for internal teams.',evidenceIds:[1]}]},input,'stop').ok,false);
});

test('an exact numeric job title does not become an invented numeric requirement',()=>{
 const titled=buildRewriteInput({...job,title:'Network Engineer Level 3'});
 const sentences=[{text:'As a Network Engineer Level 3, you will install and maintain computer networks for internal teams.',evidenceIds:[0]},{text:'You will monitor network performance and resolve connectivity incidents for those teams.',evidenceIds:[1]}];
 assert.equal(validateTrialRephrase({sentences},titled,'stop').ok,true);
 assert.equal(validateTrialRephrase({sentences:[{...sentences[0],text:sentences[0].text.replace('Level 3','Level 8')},sentences[1]]},titled,'stop').ok,false);
});
test('applicant first-person voice is not a neutral role overview',()=>{
 assert.equal(validateTrialRephrase({sentences:[{text:'I will install and maintain computer networks for internal teams.',evidenceIds:[0]},{text:'I will monitor network performance and resolve connectivity incidents for those teams.',evidenceIds:[1]}]},input,'stop').ok,false);
});
