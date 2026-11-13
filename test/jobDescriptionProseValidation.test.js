import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProsePart } from '../rewriting/prose.js';
import { checkProseStatements } from '../rewriting/proseValidation.js';

for (const [source, rewritten] of [
  ['You will be responsible for building reliable Python services.', 'You will build reliable Python services.'],
  ['We are looking for experienced database engineers.', 'We seek experienced database engineers.'],
  ['You are required to possess at least 2 years of Python experience.', 'You must have at least 2 years of Python experience.'],
]) test('equivalent grammatical rewording preserves the complete employer statement: ' + source, () => {
  assert.equal(validateProsePart(source, rewritten), null);
});

test('grammatical rewording cannot change the actor, duty, modality, or experience threshold', () => {
  const source = 'You will be responsible for building Python services.';
  for (const text of ['Customers will build Python services.', 'You can build Python services.', 'You will maintain Python services.']) {
    assert.notEqual(validateProsePart(source, text), null);
  }
  assert.notEqual(validateProsePart('You are required to possess at least 2 years of Python experience.', 'You must have at least 5 years of Python experience.'), null);
});

test('removing the duplicated work-model label preserves the complete employer fact', () => {
  const source = 'The work model for the role is: The work model for the role is: #Li_Onsite.';
  assert.equal(validateProsePart(source, 'The work model for the role is: #Li_Onsite.'), null);
  assert.notEqual(validateProsePart(source, 'The work model for the role is: hybrid.'), null);
  assert.notEqual(validateProsePart(source, '#Li_Onsite.'), null);
});

test('a recruitment warning label can join its unchanged notice without changing negation', () => {
  const source = 'Recruitment Fraud Warning. ABB never asks for payment from job applicants.';
  assert.equal(validateProsePart(source, 'Recruitment Fraud Warning: ABB never asks for payment from job applicants.'), null);
  assert.notEqual(validateProsePart(source, 'Recruitment Fraud Warning: ABB asks for payment from job applicants.'), null);
  assert.notEqual(validateProsePart(source, 'Recruitment Fraud Warning: ABB never asks for payment.'), null);
});

for (const [name, source, output] of [
  ['number spelling', 'At least 2 years of Python experience is required.', 'At least two years of Python experience is required.'],
  ['independent statement order', 'Salary is 100000. At least 2 years of Python experience is required.', 'At least 2 years of Python experience is required. Salary is 100000.'],
  ['Markdown and equivalent wording', 'Responsibilities:\nBuild reliable Python applications and maintain automated tests.', '## Responsibilities\n- Develop reliable Python applications and maintain automated tests.'],
  ['numeric formatting', 'Salary is 100,000 USD.', 'Salary is 100000 USD.'],
]) test(`equivalent ${name} passes statement-bound validation`, () => assert.equal(validateProsePart(source, output), null));

for (const [name, source, output, reason] of [
  ['reversed threshold', 'At least 2 years of Python experience is required.', 'At most 2 years of Python experience is required.', 'numeric_relationship_changed'],
  ['swapped numeric subjects', 'Python requires 2 years. Java requires 5 years.', 'Java requires 2 years. Python requires 5 years.', 'numeric_relationship_changed'],
  ['swapped subjects in one statement', 'Python requires 2 years and Java requires 5 years.', 'Java requires 2 years and Python requires 5 years.', 'numeric_relationship_changed'],
  ['changed numeric unit', 'Complete training in 2 days.', 'Complete training in 2 weeks.', 'numeric_relationship_changed'],
  ['missing duty', 'Build Python services. Maintain automated tests.', 'Build Python services.', 'source_details_changed'],
  ['new claim', 'Build Python services.', 'Build Python services. Receive free health insurance.', 'unsupported_claim'],
  ['relocated negation', 'No travel. Overtime is required.', 'Travel is required. No overtime.', 'negation_changed'],
  ['qualification promotion', 'Requirements:\nPython is required. AWS is preferred.', 'Requirements:\nPython is preferred. AWS is required.', 'required_scope_changed'],
  ['lost condition', 'Travel only when customers request it.', 'Travel when customers request it.', 'source_details_changed'],
  ['missing conditional duty', 'Build Python services and maintain tests when needed.', 'Build Python services.', 'source_details_changed'],
]) test(`${name} cannot pass validation`, () => assert.equal(validateProsePart(source, output), reason));

test('heading wording can change without changing the attached qualification scope', () => {
  assert.equal(validateProsePart('Required qualifications:\nPython experience.', '## Requirements\nPython experience.'), null);
  assert.equal(validateProsePart('Preferred qualifications:\nAWS experience.', '## Required qualifications\nAWS experience.'), 'preferred_scope_changed');
});

test('numeric technical identifiers and comparison operators remain intact', () => {
  const source = 'Use C++ vector<T> with HTTP/2 and Python 3.11. Latency must be < 100 ms.';
  assert.equal(validateProsePart(source, source), null);
  assert.equal(validateProsePart(source, source.replace('< 100', '> 100')), 'numeric_relationship_changed');
});

test('actors and actions cannot exchange positions within a statement', () => {
  assert.equal(validateProsePart('You support customers.', 'Customers support you.'), 'source_details_changed');
  assert.equal(validateProsePart('Our team mentors your team.', 'Your team mentors our team.'), 'source_details_changed');
});

for (const [source, output] of [
  ['Salary is $100000.', 'Salary is €100000.'],
  ['Salary is $100000.', 'Salary is 100000.'],
  ['Bonus is 10%.', 'Bonus is 10.'],
  ['Temperature is -20 C.', 'Temperature is 20 C.'],
]) test(`numeric punctuation is factual: ${source}`, () => assert.equal(validateProsePart(source, output), 'numeric_relationship_changed'));

test('obligation and commitment cannot become permission within the same section', () => {
  assert.equal(validateProsePart('Requirements:\nYou must work remotely.', 'Requirements:\nYou can work remotely.'), 'required_scope_changed');
  assert.equal(validateProsePart('We will provide visa sponsorship.', 'We can provide visa sponsorship.'), 'source_details_changed');
  assert.equal(validateProsePart('We will provide sponsorship and can assist relocation.', 'We can provide sponsorship and will assist relocation.'), 'source_details_changed');
});

test('equivalent lower-bound notation and ordinary collaboration phrasing are accepted', () => {
  assert.equal(validateProsePart('2+ years of Python experience is required.', 'At least two years of Python experience is required.'), null);
  assert.equal(validateProsePart('Collaborate with cross-functional teams to deliver reliable software.', 'Work with cross-functional teams to deliver reliable software.'), null);
});

test('coordinated duties can become separate bullets without losing either duty', () => {
  assert.equal(validateProsePart('Build Python services and maintain automated tests.', '- Build Python services.\n- Maintain automated tests.'), null);
});

test('neutral role framing preserves the numeric subject without hiding changed actors or duties', () => {
  const source = 'Build Python services for customer group 1.';
  assert.equal(validateProsePart(source, 'The role involves building Python services for customer group 1.'), null);
  assert.equal(validateProsePart(source, 'The role focuses on developing Python services for customer group 1.'), null);
  assert.equal(validateProsePart(source, 'The role involves building Python services for customer group 2.'), 'numeric_relationship_changed');
  assert.notEqual(validateProsePart('You support customers.', 'The role involves customers supporting you.'), null);
  assert.notEqual(validateProsePart(source, 'The role involves building Python services for customer group 1 and maintaining Java services.'), null);
});

test('preserved group numbers do not conceal a duty becoming an experience requirement', () => {
  const result = checkProseStatements('Build Python services for customer group 1.',
    'The role focuses on building Python services for customer group 1, requiring experience in API design and service upkeep.');
  assert.equal(result.reason, 'required_scope_changed');
  assert.equal(result.diagnostic.evidence, 'Build Python services for customer group 1.');
  assert.equal(validateProsePart('Build Python services for customer group 2.',
    'The role focuses on building Python services for a particular customer group, requiring strong API design skills and ongoing service upkeep.'), 'numeric_relationship_changed');
});

test('hyphenated preference wording retains preferred scope and still rejects promotion', () => {
  for (const phrase of ['nice-to-have', 'good-to-have']) {
    assert.equal(validateProsePart(`AWS experience is ${phrase.replaceAll('-', ' ')}.`, `AWS experience is ${phrase}.`), null);
    assert.equal(validateProsePart('Preferred qualifications:\nAWS experience.', `## ${phrase}\nAWS experience.`), null);
    assert.equal(validateProsePart(`AWS experience is ${phrase}.`, 'AWS experience is required.'), 'preferred_scope_changed');
  }
});

test('a title separated from its unchanged first duty by a line break preserves the source', () => {
  const source = 'Position: Python Automation Engineer Job Description: Design automated test frameworks for embedded devices.';
  const output = 'Position: Python Automation Engineer\nJob Description: Design automated test frameworks for embedded devices.';
  assert.equal(validateProsePart(source, output), null);
});

test('a generated trailing qualification heading cannot change the scope of the next source block', () => {
  assert.equal(validateProsePart('Build Python services.', 'Develop Python services.\n## Required qualifications'), 'required_scope_changed');
});

test('layout changes cannot move a duty between actors or transfer years between technologies', () => {
  assert.equal(validateProsePart('Support engineers and managers. Build services.',
    'Support engineers. And managers build services.'), 'source_details_changed');
  assert.equal(validateProsePart('Required qualifications:\nPython experience.\n3 years of Java experience.',
    'Required qualifications:\nPython experience 3 years.\nJava experience.'), 'numeric_relationship_changed');
});

test('missing spaces after full stops cannot hide changed actor relationships', () => {
  assert.notEqual(validateProsePart('Support engineers and managers.Build services.',
    'Support engineers.And managers build services.'), null);
});

test('bold and bulleted trailing headings cannot escape the fragment scope guard', () => {
  for (const title of ['**Required qualifications**', '- **Required qualifications**', '## **Required qualifications**', '__Required qualifications__']) {
    assert.equal(validateProsePart('Build Python services.', 'Develop Python services.\n' + title), 'required_scope_changed');
  }
});

test('joining an unrecognized source heading does not turn a paragraph full stop into a missing detail', () => {
  const source = 'Skills Descriptors:\nDecision Making and Critical Thinking: Analyze situations and reach productive decisions\n\nSupport customer teams.';
  const output = 'Skills Descriptors: Decision Making and Critical Thinking: Analyze situations and reach productive decisions.\nSupport customer teams.';
  assert.equal(validateProsePart(source, output), null);
  assert.notEqual(validateProsePart(source, output.replace('productive decisions', 'hiring decisions')), null);
});

test('a full stop at an existing paragraph boundary does not change a Java version', () => {
  const source = 'Backend & Java Ecosystem\nJava Proficiency: Strong expertise in Java including JDK 8+ and its ecosystem\n\nBuild reliable services.';
  const output = 'Backend & Java Ecosystem: Java Proficiency: Strong expertise in Java including JDK 8+ and its ecosystem.\nBuild reliable services.';
  assert.equal(validateProsePart(source, output), null);
  assert.equal(validateProsePart(source, output.replace('8+', '17+')), 'numeric_relationship_changed');
});

test('punctuation added inside an existing statement cannot move the numeric subject', () => {
  const source = 'Python experience 3 years and Java experience 5 years\nSupport customer teams.';
  assert.notEqual(validateProsePart(source, 'Python experience. 3 years and Java experience 5 years.\nSupport customer teams.'), null);
  assert.notEqual(validateProsePart(source, 'Python experience 5 years and Java experience 3 years.\nSupport customer teams.'), null);
});

test('a wrapped actor phrase cannot become a separate duty when an unfamiliar heading joins it', () => {
  const source = 'Team overview:\nSupport engineers and managers\nbuild services.';
  const output = 'Team overview: Support engineers and managers. Build services.';
  assert.notEqual(validateProsePart(source, output), null);
});

test('recognized headings do not allow punctuation to detach a wrapped actor from its action', () => {
  const source = 'Role overview:\nClient teams\npay contractors.';
  assert.notEqual(validateProsePart(source, 'Role overview:\nClient teams. Pay contractors.'), null);
  assert.equal(validateProsePart(source, 'Role overview:\nClient teams pay contractors.'), null);
});

test('a wrapped condition cannot be detached with a full stop after an unfamiliar heading', () => {
  const source = 'Role notes:\nTravel is allowed only\nwhen the client requests it.';
  const output = 'Role notes: Travel is allowed only. When the client requests it.';
  assert.notEqual(validateProsePart(source, output), null);
});

test('a source full stop cannot disappear when paragraph merging changes the actors', () => {
  assert.notEqual(validateProsePart('Support engineers.\n\nManagers build services.',
    'Support engineers managers build services.'), null);
});
