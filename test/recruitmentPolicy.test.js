import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveClassification, applyClassification, buildClassificationInput, CLASSIFICATION_POLICY } from '../src/services/jobClassificationPolicy.js';

const now = new Date('2026-10-03T12:00:00Z');
const classify = job => applyClassification({ ...job, classification: resolveClassification(job, null, { now, mode: 'policy' }) });
const examples = [
  ['previous graduating cohort', { title: 'Graduate Engineer', description: 'Full-time recruitment for 2025 batch pass outs.' }, 'Full-time Experienced', [1]],
  ['current graduating cohort', { title: 'Graduate Engineer', description: '2026 graduates can apply for this full-time role.' }, 'Full-time Fresher', [0]],
  ['recent bachelor completion', { title: 'Software Engineer', description: "Candidates who recently completed a bachelor's degree can apply." }, 'Full-time Fresher', [0]],
  ['recent master completion', { title: 'Analyst', description: "Applicants who have recently completed their master's are eligible." }, 'Full-time Fresher', [0]],
  ['ongoing bachelor studies', { title: 'Engineering Placement', description: "Applicants must be currently pursuing a bachelor's degree." }, 'Intern', [0]],
  ['ongoing master studies', { title: 'Research Placement', description: "Currently pursuing a master's degree required." }, 'Intern', [0]],
  ['enrolled master students', { title: 'Research Placement', description: "Minimum qualifications:\nCurrently enrolled in a master's degree program. Prior 2 years of professional experience required." }, 'Intern', [0]],
  ['intern with no stated years', { title: 'Corporate Trainer Intern', description: 'Support training sessions and learn on the job.' }, 'Intern', [0]],
  ['experience stated in text', { title: 'Software Engineer', description: 'Full-time role. Minimum 4 years of professional experience required.' }, 'Full-time Experienced', Array.from({ length: 12 }, (_, i) => i + 4)],
  ['manager with no stated years', { title: 'Engineering Manager', description: 'Own the engineering function and manage the team.' }, 'Full-time Experienced', Array.from({ length: 15 }, (_, i) => i + 1)],
  ['contract vacancy', { title: 'Contract Engineer', description: 'This is a six-month contract position. 3-5 years of professional experience required.' }, 'Contract', [3, 4, 5]],
];

test('a flattened ideal-candidate section requires prior project experience', () => {
  const job = classify({ title: 'Product Definition Analyst 3', description:
    'Accountabilities Analysis and product definition. Skills Python and SQL. About the ideal candidate: University degree in Computer Science or equivalent work experience. Experience delivering end-to-end analytics projects. Experience in the software development lifecycle including coding and testing. Experience in data modeling is a plus. Diversity & Inclusion We are a company with experience in travel technology.' });
  assert.equal(job.jobType, 'Full-time Experienced');
  assert.deepEqual(job.experienceYears, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(job.experienceBasis, 'experienced_role_default');
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
});

test('a company-introduced mandatory applicant requirement still requires experience', () => {
  const job = classify({ title: 'Engineer', description:
    'About the ideal candidate: We have one mandatory requirement: candidates must have experience in software delivery.' });
  assert.equal(job.jobType, 'Full-time Experienced');
});

test('flattened required experience resets a preceding optional skills section', () => {
  const job = classify({ title: 'Operator - Technology Support', description:
    'Skills Required: Basic understanding of mechanical systems. Additional Skills / Knowledge Preferred: Knowledge of SCADA is preferred. Education: Polytechnic diploma. Experience: 0 - 2 years related experience in this field. Reports To: Technology Support Manager.' });
  assert.equal(job.jobType, 'Full-time Fresher');
  assert.deepEqual(job.experienceYears, [0]);
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 0);
  assert.equal(job.classification.resolved.employerExperienceProfile.maximumYears, 2);
});

test('a plain experience heading ends optional skills without needing an education heading', () => {
  const job = classify({ title: 'Engineer', description:
    'Preferred skills: Python is a plus. Experience: 2 - 4 years of professional experience required.' });
  assert.equal(job.jobType, 'Full-time Experienced');
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 2);
  assert.equal(job.classification.resolved.employerExperienceProfile.maximumYears, 4);
});

test('a labelled experience range retains month units and employer bounds', () => {
  const job = classify({ title: 'Engineer', description: 'Education: Bachelors degree. Experience: 6 - 12 months related experience required.' });
  assert.equal(job.jobType, 'Full-time Experienced');
  assert.deepEqual(job.experienceYears, [1]);
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, .5);
  assert.equal(job.classification.resolved.employerExperienceProfile.maximumYears, 1);
});

test('labelled repeated and mixed-unit ranges retain the complete employer bounds', async t => {
  for (const quantity of ['6 months - 1 year', '6 months - 12 months', '6 months to 1 year']) await t.test(quantity, () => {
    const job = classify({ title: 'Engineer', description: `Experience: ${quantity} related experience required.` });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.deepEqual(job.experienceYears, [1]);
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, .5);
    assert.equal(job.classification.resolved.employerExperienceProfile.maximumYears, 1);
  });
});

test('an abbreviated senior vacancy is experienced without a numeric requirement', () => {
  const job = classify({ title: 'Sr. Engineer - Stack Development', description:
    'Support engineering development and root cause investigations. Key Skills Required: Strong failure analysis skills.' });
  assert.equal(job.jobType, 'Full-time Experienced');
  assert.deepEqual(job.experienceYears, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
});

test('explicit hiring of an experienced associate does not depend on an occupation title', () => {
  const job = classify({ title: 'Events Marketing', sourceEmploymentType: 'Full Time', description:
    'We are looking for an experienced, metrics-driven Associate - Event Marketing to lead our event presence. Desired Experience: 2+ years managing events.' });
  assert.equal(job.jobType, 'Full-time Experienced');
  assert.deepEqual(job.experienceYears, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
  assert.equal(job.experienceProfile.preferredMinimumYears, 2);
});

test('hiring wording about an experienced intern cannot promote the vacancy to experienced full-time', () => {
  const job = classify({ title: 'Engineering Placement', description: 'We are looking for an experienced intern to assist the team.' });
  assert.equal(job.jobType, 'Intern');
  assert.deepEqual(job.experienceYears, [0]);
});

test('an explicitly preferred experience section cannot become a required minimum', () => {
  const job = classify({ title: 'Engineer', description:
    'Full-time role. Minimum qualifications: Bachelors degree. Preferred Experience: 3 years of professional experience.' });
  assert.equal(job.jobType, 'Unspecified');
  assert.deepEqual(job.experienceYears, []);
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
  assert.equal(job.experienceProfile.preferredMinimumYears, 3);
});

test('unconditional fresher eligibility survives a preceding preferred experience section', () => {
  for (const eligibility of ['Freshers welcome.', 'Fresh graduates are eligible to apply.',
    'This role welcomes recent graduates.', 'New graduates can apply.']) {
    const result = resolveClassification({ title: 'Engineer',
      description: `Preferred experience: 1 year. ${eligibility}` }, null, { now, mode: 'policy' });
    assert.equal(result.resolved.jobType, 'Full-time Fresher', eligibility);
    assert.deepEqual(result.resolved.experienceYears, [0]);
    assert.equal(result.resolved.experienceProfile.minimumYears, 0);
    assert.equal(result.resolved.experienceProfile.preferredMinimumYears, 1);
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, null);
  }
});

test('required positive experience survives unconditional fresher wording beside preferred experience', () => {
  for (const job of [
    { description: 'Minimum 3 years of professional experience required. Preferred experience: 5 years. Freshers welcome.' },
    { description: 'Freshers welcome. Minimum 3 years of professional experience required. Preferred experience: 5 years.' },
    { description: 'Required: 3 years of professional experience. Fresh graduates are eligible to apply.', preferredQualification: '5 years of experience preferred.' },
    { sourceExperienceRequired: '3', description: 'Preferred experience: 5 years. New graduates can apply.' },
  ]) {
    const result = resolveClassification({ title: 'Engineer', ...job }, null, { now, mode: 'policy' });
    assert.equal(result.resolved.jobType, 'Full-time Experienced', job.description);
    assert.equal(result.resolved.experienceProfile.minimumYears, 3);
    assert.equal(result.resolved.employerExperienceProfile.minimumYears, 3);
    assert.equal(result.resolved.experienceProfile.preferredMinimumYears, 5);
    assert.equal(result.resolved.experienceBasis, 'employer_requirement');
    assert.ok(result.resolved.experienceYears.every(year => year >= 3));
  }
});

test('negated, conditional and preferred-only fresher wording cannot end an optional section', () => {
  for (const eligibility of ['Freshers are not eligible to apply.',
    'Freshers may apply only if they have 2 years of professional experience.',
    'Freshers are preferred.', 'We mentor fresh graduates.']) {
    const result = resolveClassification({ title: 'Engineer',
      description: `Preferred experience: 1 year. ${eligibility}` }, null, { now, mode: 'policy' });
    assert.notEqual(result.resolved.jobType, 'Full-time Fresher', eligibility);
    assert.equal(result.resolved.experienceProfile.preferredMinimumYears, 1);
  }
  const student = resolveClassification({ title: 'Engineer', description:
    "Full-time role. Preferred qualifications:\nCurrently pursuing a bachelor's degree." }, null, { now, mode: 'policy' });
  assert.notEqual(student.resolved.jobType, 'Intern');
});

test('inline optional modifiers on numeric experience cannot become a required minimum', async t => {
  for (const modifier of ['desired', 'good to have', 'optional', 'a bonus', 'desirable', 'nice-to-have']) await t.test(modifier, () => {
    const job = classify({ title: 'Engineer', description:
      `Full-time role. Preferred qualifications: Certification is preferred. Experience: 3 years of professional experience is ${modifier}.` });
    assert.equal(job.jobType, 'Unspecified');
    assert.deepEqual(job.experienceYears, []);
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
    assert.equal(job.experienceProfile.preferredMinimumYears, 3);
  });
});

test('or-more years remains an open-ended employer requirement', () => {
  const job = classify({ title: 'Technical Writer', description: 'Requirements: You have 2 or more years of experience in technical writing for software products.' });
  assert.equal(job.jobType, 'Full-time Experienced');
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 2);
  assert.equal(job.classification.resolved.employerExperienceProfile.isOpenEnded, true);
  assert.deepEqual(job.experienceYears, Array.from({ length: 14 }, (_, i) => i + 2));
});

test('an explicit mandatory candidate quantity survives adjacent optional experience', async t => {
  for (const description of [
    'Preferred qualifications: Research publications are desired. Skills and Experience: Candidate must have 15+ years of background in Analytics, Data Science and Machine learning.',
    'Skills and Experience: Candidate must have 15+ years of background in Analytics and Machine learning This will be an individual contributor role Experience as a Business Analyst in Data Science Solutions is a plus.',
  ]) await t.test(description, () => {
    const job = classify({ title: 'Sr Principal Engineer - Data Science', description });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 15);
    assert.equal(job.classification.resolved.employerExperienceProfile.isOpenEnded, true);
    assert.deepEqual(job.experienceYears, [15]);
  });
});

test('optional ideal-candidate experience and company history remain distinct from requirements', async t => {
  for (const description of [
    'About the ideal candidate: University degree required. Experience in data modeling is a plus. Experience in software delivery is a bonus.',
    'About the ideal candidate: University degree required. About us: Our company has experience in the software development lifecycle.',
    'About the ideal candidate: University degree required. Responsibilities: Deliver projects and provide an excellent experience in travel planning.',
    'About the ideal candidate: University degree required. Diversity & Inclusion We are a company with experience in travel technology.',
    'About the ideal candidate: University degree required. Company Overview Our company has experience in software delivery.',
    'About the ideal candidate: University degree required. Our company has experience in travel technology.',
    'About the ideal candidate: University degree required. Experience in data modeling is desired.',
    'About the ideal candidate: University degree required. Experience in software delivery is good to have.',
  ]) await t.test(description, () => {
    const job = classify({ title: 'Product Definition Analyst', description });
    assert.equal(job.jobType, 'Unspecified');
    assert.equal(job.experienceProfile.minimumYears, null);
    assert.deepEqual(job.experienceYears, []);
  });
});

test('a flattened education-and-experience section requires experience without inventing employer years', () => {
  const job = classify({ title: 'Customer Service Associate III', description:
    'Job Description Communicate with customers. Education and Experience Bachelors degree or equivalent experience. Insurance certification will be preferred. Experience in voice process and zeal to learn about property. Functional Skills Knowledge of insurance policies.' });
  assert.equal(job.jobType, 'Full-time Experienced');
  assert.deepEqual(job.experienceYears, Array.from({ length: 15 }, (_, i) => i + 1));
  assert.equal(job.experienceBasis, 'experienced_role_default');
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
});

test('preferred voice experience and company experience do not require applicant experience', () => {
  for (const description of [
    'Education and Experience Bachelors degree or equivalent experience. Experience in voice process is preferred. Functional Skills Communicate with customers.',
    'About us Our company has experience in voice process operations. Responsibilities Support customers and develop your skills.',
  ]) {
    const job = classify({ title: 'Customer Service Associate', description });
    assert.equal(job.jobType, 'Unspecified');
    assert.equal(job.experienceProfile.minimumYears, null);
    assert.deepEqual(job.experienceYears, []);
  }
});

test('required education-and-experience requirements reset a preceding preferred section', () => {
  const result = classify({ title: 'Customer Service Associate', description:
    'Preferred qualifications: Certification is preferred. Education and Experience Bachelors degree or equivalent experience. Experience in voice process. Functional Skills Communicate clearly.' });
  assert.equal(result.jobType, 'Full-time Experienced');
  assert.equal(result.experienceBasis, 'experienced_role_default');
});

test('restored education-and-experience headings retain their optional modifiers', () => {
  for (const modifier of ['Preferred', 'Desirable', 'Optional', 'Desired', 'Nice to have', 'Good to have', 'Bonus']) {
    const result = classify({ title: 'Customer Service Associate', description:
      `${modifier} Education and Experience: Bachelors degree or equivalent experience. Experience in voice process. Functional Skills Communicate clearly.` });
    assert.equal(result.jobType, 'Unspecified', modifier);
    assert.equal(result.experienceProfile.minimumYears, null, modifier);
    assert.deepEqual(result.experienceYears, [], modifier);
  }
});

for (const [name, job, jobType, experienceYears] of examples) {
  test(`recruitment rule: ${name}`, () => {
    const result = classify(job);
    assert.equal(result.jobType, jobType);
    assert.deepEqual(result.experienceYears, experienceYears);
    assert.equal(result.classification.authoritative, true);
    assert.equal(result.classification.decisionSource, 'policy');
    if (jobType === 'Full-time Experienced') assert.ok(result.experienceYears.every(year => year >= 1 && year <= 15));
  });
}

test('cohort inference is labelled and invalidates on the reference year', () => {
  const job = examples[0][1];
  const result = classify(job);
  assert.equal(result.experienceProfile.hasExplicitExperience, false);
  assert.equal(result.experienceBasis, 'graduation_cohort');
  assert.equal(result.classification.resolved.experienceBasis, 'graduation_cohort');
  assert.match(result.experienceRequired, /1 year/);
  assert.notEqual(buildClassificationInput(job, { now }).inputHash, buildClassificationInput(job, { now: new Date('2027-01-01') }).inputHash);
});

test('only employer-provided batch fields enter model context', () => {
  const job = { title: 'Engineer', description: 'Build products.', eligibleBatches: [2025] };
  assert.deepEqual(buildClassificationInput(job, { now }).eligibleBatches, []);
  assert.deepEqual(buildClassificationInput({ ...job, eligibleBatchesProvenance: 'source' }, { now }).eligibleBatches, [2025]);
});

test('the requested category defaults outrank conflicting employer requirements', () => {
  const graduate = classify({ title: 'Associate System Engineer', sourceEmploymentType: 'Full Time', sourceExperienceRequired: 0, description: '2025 batch graduates can apply.' });
  assert.equal(graduate.jobType, 'Full-time Experienced');
  assert.deepEqual(graduate.experienceYears, [1]);
  assert.equal(graduate.sourceExperienceRequired, 0);
  const intern = classify({ title: 'Finance Intern', description: 'Internship requires 2 years of accounting experience.' });
  assert.equal(intern.jobType, 'Intern');
  assert.deepEqual(intern.experienceYears, [0]);
  assert.equal(intern.classification.resolved.employerExperienceProfile.minimumYears, 2);
  const senior = classify({ title: 'Engineer', description: "Completed a bachelor's degree required. Must have 5 years of professional experience." });
  assert.equal(senior.jobType, 'Full-time Experienced');
  assert.deepEqual(senior.experienceYears, [5]);
});

test('incidental intern/student words, founding dates and education duration cannot become vacancy facts', () => {
  const manager = classify({ title: 'Internship Programme Manager', description: 'Manage and mentor interns. Full-time position.' });
  assert.equal(manager.jobType, 'Full-time Experienced');
  assert.ok(!manager.experienceYears.includes(0));
  const recent = classify({ title: 'Graduate Engineer', description: "Founded in 2025. This full-time vacancy welcomes recent graduates with a four-year bachelor's degree." });
  assert.equal(recent.jobType, 'Full-time Fresher');
  assert.deepEqual(recent.experienceYears, [0]);
  const staff = classify({ title: 'Engineer', description: 'Our staff are currently pursuing masters through employer support. Develop software.' });
  assert.equal(staff.jobType, 'Unspecified');
  assert.deepEqual(staff.experienceYears, []);
});

test('complete model fallback supplies a public label while source facts remain unresolved and quality gates still apply', () => {
  const choices = { jobType: 'Intern' };
  const answers = Object.fromEntries(Object.entries(CLASSIFICATION_POLICY.questions).map(([key, question]) => {
    const labels = Object.keys(question.criteria), choice = choices[key];
    return [key, { choice, probabilities: Object.fromEntries(labels.map(label => [label, label === choice ? .999 : .001 / (labels.length - 1)])) }];
  }));
  const source = { title: 'Engineer', description: 'Develop software.' };
  const prediction = { complete: true, windows: 1, answers };
  const result = resolveClassification(source, prediction, { mode: 'policy', now });
  assert.notEqual(result.status, 'accepted');
  assert.equal(result.reason, 'model_unvalidated');
  assert.equal(result.resolved.jobType, 'Unspecified');
  assert.equal(result.comparison.logicJobType, 'Unspecified');
  assert.equal(applyClassification({ ...source, classification: result }).jobType, 'Intern');
  assert.deepEqual(applyClassification({ ...source, classification: result }).experienceYears, []);
  for (const blocked of [{ ...result, complete: false }, { ...result, sourceQualityIssues: ['unqualified source content'] }]) {
    assert.equal(applyClassification({ ...source, classification: blocked }).jobType, 'Unspecified');
  }
  const required = { title: 'Engineer', description: 'Full-time role. Minimum 3 years of professional experience required.' };
  const classified = applyClassification({ ...required, classification: resolveClassification(required, prediction, { mode: 'policy', now }) });
  assert.equal(classified.jobType, 'Full-time Experienced');
  assert.equal(classified.experienceProfile.minimumYears, 3);
});

test('source rules cannot turn a missing description into a complete model scan', () => {
  const job = classify({ title: 'Intern' });
  assert.equal(job.classification.complete, false);
  assert.equal(job.jobType, 'Unspecified');
  assert.deepEqual(job.experienceYears, []);
});

test('optional or mixed student eligibility cannot override an experienced employee role', () => {
  for (const description of [
    "Minimum 5 years of professional experience required. Pursuing a master's degree is desirable.",
    "Completed a bachelor's degree OR currently pursuing a bachelor's degree. Minimum 5 years of professional experience required.",
    "Minimum 5 years of professional experience required. Candidates may be pursuing a part-time masters while working.",
    "Completed a bachelor's degree OR\nCurrently pursuing a master's degree. Minimum 5 years of professional experience required.",
  ]) {
    const job = classify({ title: 'Senior Software Engineer', description });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.equal(job.experienceProfile.minimumYears, 5);
  }
});

test('people supervised, recruitment cohorts and software release years are not applicant graduation facts', () => {
  for (const [title, description, minimumYears] of [
    ['Programme Director', 'Full-time role. Supervise recent graduates and support their career development. Minimum 10 years of professional experience required.', 10],
    ['Programme Director', 'Full-time role. Coach recent graduates and support their career development. Minimum 10 years of professional experience required.', 10],
    ['Programme Director', 'Full-time role. You must coach recent graduates and support their career development. Minimum 10 years of professional experience required.', 10],
    ['Engineering Manager', 'Lead our graduate recruitment programme for the 2025 batch. Minimum 8 years of professional experience required.', 8],
    ['Engineer', 'Bachelor graduates must have experience with AutoCAD 2025. Minimum 5 years of professional experience required.', 5],
    ['Engineering Manager', 'We are hiring an intern to support you. Minimum 7 years of professional experience required.', 7],
  ]) {
    const job = classify({ title, description });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.equal(job.experienceProfile.minimumYears, minimumYears);
    assert.equal(job.experienceBasis, 'employer_requirement');
  }
});

test('prefix intern vacancies and contract-management occupations are disambiguated', () => {
  const intern = classify({ title: 'Intern - Software Engineering', description: 'Learn engineering skills and help with coding.' });
  assert.equal(intern.jobType, 'Intern');
  assert.deepEqual(intern.experienceYears, [0]);
  for (const title of ['Contract Manager', 'Temporary Works Design Engineer']) {
    const employee = classify({ title, description: 'Permanent full-time role. Manage supplier contracts. Minimum 5 years of professional experience required.' });
    assert.equal(employee.jobType, 'Full-time Experienced');
    assert.equal(employee.experienceProfile.minimumYears, 5);
  }
});

test('prior experience without a number uses a positive range rather than a career-break duration', () => {
  for (const description of [
    'Experienced professionals returning to work. Prior professional experience required. 0-3 years of career break allowed.',
    'Qualifications for the role. Candidate must have experience on HV Motors and Generators.',
    'Qualifications for the role. Engineering degree with experience in networking or cybersecurity.',
    'Qualifications for the role. You possess experience in designing and building prototypes.',
    'Qualifications for the role. Worked on repairing and troubleshooting of HV motors.',
  ]) {
    const job = classify({ title: 'Engineer', description });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.deepEqual(job.experienceYears, Array.from({ length: 15 }, (_, index) => index + 1));
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
  }
  const mixed = classify({ title: 'Engineer', description: 'Minimum 5 years of professional experience required and a career break of up to 3 years allowed.' });
  assert.equal(mixed.experienceProfile.minimumYears, 5);
  assert.equal(mixed.classification.resolved.employerExperienceProfile.minimumYears, 5);
});

test('ordinary words and optional skills do not imply completed degrees or required experience', () => {
  const assembly = classify({ title: 'Assembler', description: 'You will be mainly accountable for semi-finished products.' });
  assert.equal(assembly.jobType, 'Unspecified');
  assert.deepEqual(assembly.experienceYears, []);
  const graduate = classify({ title: 'Engineer', description: "Must have completed a bachelor's degree. Qualifications for the role. Experience in networking is preferred." });
  assert.equal(graduate.jobType, 'Full-time Fresher');
  assert.deepEqual(graduate.experienceYears, [0]);
  for (const preferred of ['Candidates should have prior experience with CAD', 'You possess experience in designing prototypes', "Currently enrolled in a master's degree"]) {
    const job = classify({ title: 'Engineer', description: `Completed a bachelor's degree required. Preferred qualifications:\n${preferred}` });
    assert.equal(job.jobType, 'Full-time Fresher');
    assert.deepEqual(job.experienceYears, [0]);
  }
  const template = classify({ title: '00', description: 'Qualifications for the role. Experience in {insert relevant field} required.' });
  assert.equal(template.jobType, 'Unspecified');
  assert.deepEqual(template.experienceYears, []);
});

test('experienced filter years remain within the product bracket while employer years are preserved', () => {
  for (const [requirement, expectedYears] of [[18, [15]], [0.5, [1]], [0.25, [1]]]) {
    const job = classify({ title: 'Engineer', sourceExperienceRequired: requirement, description: 'Develop and test products.' });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.deepEqual(job.experienceYears, expectedYears);
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, requirement);
    assert.equal(job.sourceExperienceRequired, requirement);
  }
});

test('direct fresher eligibility survives duties in the same qualification sentence', () => {
  const job = classify({ title: 'Accounting & Reporting Analyst', description: 'Freshers with post-graduation or 2 - 3 years of experience with a Degree in Commerce background demonstrating advanced skills in managing end-to-end payment cycles.' });
  assert.equal(job.jobType, 'Full-time Fresher');
  assert.deepEqual(job.experienceYears, [0]);
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 2);
  const director = classify({ title: 'Programme Director', description: 'Minimum 10 years of professional experience required. Responsibilities:\nRecent graduates on our team must receive mentoring from you.' });
  assert.equal(director.jobType, 'Full-time Experienced');
  assert.equal(director.experienceProfile.minimumYears, 10);
});

test('an alternative fresher path cannot erase a separate mandatory numeric requirement', () => {
  for (const requirement of ['Minimum 3 years of professional experience required.',
    '3 years of professional experience is mandatory.']) {
    const job = classify({ title: 'Engineer', description:
      `Freshers with post-graduation or 2 - 3 years of experience may apply. ${requirement}` });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.equal(job.experienceProfile.minimumYears, 3);
    assert.equal(job.experienceBasis, 'employer_requirement');
  }
});

test('intern vacancy titles retain zero years when a specialty, date or careers-site suffix follows intern', () => {
  for (const title of ['Digital Marketing Intern – Creative Designer', 'Technical Trainer Intern-2026',
    'Applied ML Intern, Wireless Technologies & Ecosystems', 'Associate Software Engineer Intern - YMS',
    'BCG X Finance Intern in Gurgaon, Haryana, India | Finance at BCG']) {
    const job = classify({ title, sourceExperienceRequired: '2', description: 'Assist the team with project tasks and develop practical skills.' });
    assert.equal(job.jobType, 'Intern', title);
    assert.deepEqual(job.experienceYears, [0], title);
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 2);
  }
});

test('advertised internship duration identifies a trainee vacancy without treating duration as work experience', () => {
  const job = classify({ title: 'Training Operations Trainee', sourceEmploymentType: 'Full Time',
    description: 'Employment Type: Full Time. Stipend: INR 15000/Month. Internship duration: 6 months. This exciting internship will allow you to enhance your skills in operations.' });
  assert.equal(job.jobType, 'Intern');
  assert.deepEqual(job.experienceYears, [0]);
  assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, null);
});

test('intern programme managers and converted employee roles stay distinct from intern vacancies', () => {
  for (const title of ['Intern Programme Manager', 'Internship Recruitment Coordinator',
    'Manager - Intern Recruitment', 'L1 TIBCO Support Engineer (Intern-converted-to-FTE)']) {
    const job = classify({ title, sourceEmploymentType: 'Full Time', sourceExperienceRequired: '3',
      description: 'Permanent employee position. Manage internship duration and supervise the interns on the team.' });
    assert.equal(job.jobType, 'Full-time Experienced', title);
    assert.deepEqual(job.experienceYears, [3]);
  }
});

test('escaped ATS HTML becomes readable source sections before classification without altering the scraped original', () => {
  const html = '<h2>Goals</h2><p>In 3 months:</p><p>Understand the business.</p><h2>Requirements</h2><p>Minimum 8 years of professional experience required.</p>';
  const escaped = html.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
  for (const description of [escaped, escaped.replaceAll('&', '&amp;')]) {
    const source = { title: 'Associate Director, Client Services', description };
    const input = buildClassificationInput(source, { now });
    assert.ok(input.body.includes('Requirements\nMinimum 8 years'), input.body);
    assert.ok(!input.body.includes('&lt;') && !input.body.includes('<p>'));
    const job = classify(source);
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 8);
    assert.equal(source.description, description);
  }
});

test('future performance milestones and service bonds cannot become prior professional experience', () => {
  const director = classify({ title: 'Vice President, Commerce',
    description: 'In this role, your goals will be:\nIn 3 months:\nUnderstand the business.\nIn 6 months:\nDevelop a framework.\nRequirements:\nLead cross-functional teams.' });
  assert.equal(director.jobType, 'Full-time Experienced');
  assert.deepEqual(director.experienceYears, Array.from({ length: 15 }, (_, index) => index + 1));
  assert.equal(director.classification.resolved.employerExperienceProfile.minimumYears, null);
  const intern = classify({ title: 'Technical Trainer Intern-2026',
    description: 'Initially for 6 months you will receive a stipend; on conversion to full time, there is 2 years of bond. Freshers welcome.' });
  assert.equal(intern.jobType, 'Intern');
  assert.deepEqual(intern.experienceYears, [0]);
  assert.equal(intern.classification.resolved.employerExperienceProfile.minimumYears, null);
});

test('financial bond work remains professional experience', () => {
  for (const title of ['Bond Trader', 'Senior Fixed Income Analyst']) {
    const job = classify({ title, sourceEmploymentType: 'Full Time',
      description: 'Minimum 5 years of bond trading experience required. Experience in bond market analysis is mandatory.' });
    assert.equal(job.jobType, 'Full-time Experienced');
    assert.deepEqual(job.experienceYears, Array.from({ length: 11 }, (_, index) => index + 5));
    assert.equal(job.classification.resolved.employerExperienceProfile.minimumYears, 5);
  }
});

test('intern recruitment occupations and managing a programme are employee vacancies', () => {
  for (const title of ['Internship Recruiter', 'Internship Program Specialist', 'Internship Program Manager', 'Recruitment Coordinator']) {
    const job = classify({ title, sourceEmploymentType: 'Full Time', sourceExperienceRequired: '5',
      description: 'Your responsibilities include managing this internship and onboarding its participants.' });
    assert.equal(job.jobType, 'Full-time Experienced', title);
    assert.deepEqual(job.experienceYears, [5]);
  }
});

test('specialty-labelled intern placements remain internships', () => {
  for (const title of ['Intern - Operations Specialist', 'Intern - Recruitment Specialist', 'Intern - Training Specialist']) {
    const job = classify({ title, description: 'Assist the team and learn practical skills on the job.' });
    assert.equal(job.jobType, 'Intern', title);
    assert.deepEqual(job.experienceYears, [0]);
  }
});

test('internship wording can refer to working with staff while administration duties cannot identify the vacancy', () => {
  const intern = classify({ title: 'Operations Trainee', sourceEmploymentType: 'Full Time',
    description: 'This internship will allow you to work with our staff and learn business operations.' });
  assert.equal(intern.jobType, 'Intern');
  assert.deepEqual(intern.experienceYears, [0]);
  const employee = classify({ title: 'Recruitment Coordinator', sourceEmploymentType: 'Full Time', sourceExperienceRequired: '5',
    description: 'Your responsibilities include administering this internship and onboarding its participants.' });
  assert.equal(employee.jobType, 'Full-time Experienced');
});
