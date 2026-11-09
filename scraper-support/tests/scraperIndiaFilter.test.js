import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { saveToFile } from '../utils/saveToDB.js'
import { filterIndiaJobs } from '../utils/indiaLocationFilter.js'

test('saveToFile keeps all India jobs and excludes non-India jobs', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-india-filter-'))
  const filePath = path.join(tmpDir, 'jobs.json')

  saveToFile(
    [
      {
        title: 'Software Engineer',
        company: 'Example India',
        location: 'Bengaluru, India',
        city: 'Bangalore',
        link: 'https://example.com/india-role',
      },
      {
        title: 'Backend Engineer',
        company: 'Example US',
        location: 'Austin, United States',
        city: 'Austin',
        link: 'https://example.com/us-role',
      },
      {
        title: 'India Offsite Analyst',
        company: 'Example Offsite',
        location: 'India Offsite (ZIN99)',
        city: 'India Offsite (ZIN99)',
        country: 'India',
        link: 'https://example.com/india-offsite-role',
      },
      {
        title: 'Support Engineer',
        company: 'Example Noida',
        location: 'Noida',
        city: 'Noida',
        link: 'https://example.com/noida-role',
      },
      {
        title: 'Remote Engineer',
        company: 'Example Remote',
        location: 'Remote',
        city: 'Remote',
        link: 'https://example.com/remote-role',
      },
    ],
    filePath,
  )

  const savedJobs = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  assert.deepEqual(
    savedJobs.map((job) => job.title),
    ['Software Engineer', 'India Offsite Analyst', 'Support Engineer', 'Remote Engineer'],
  )
})

test('saveToFile keeps allowed city-only India locations', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-india-filter-'))
  const filePath = path.join(tmpDir, 'jobs.json')

  saveToFile(
    [
      {
        title: 'QA Engineer',
        company: 'Example Hazira',
        location: 'Hazira',
        city: 'Hazira',
        link: 'https://example.com/qa-role',
      },
    ],
    filePath,
  )

  const savedJobs = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  assert.equal(savedJobs.length, 1)
  assert.equal(savedJobs[0].title, 'QA Engineer')
})

test('saveToFile writes normalized experience when it can be inferred from the scraped description', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-india-filter-'))
  const filePath = path.join(tmpDir, 'jobs.json')

  saveToFile(
    [
      {
        title: 'Senior Digital Data Analyst',
        company: 'Example India',
        location: 'Bengaluru, India',
        city: 'Bengaluru',
        link: 'https://example.com/analyst-role',
        experienceRequired: null,
        jobDescription: 'Qualifications Required 5+ years of experience in digital analytics, web analytics, marketing analytics, or a related field.',
      },
    ],
    filePath,
  )

  const savedJobs = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  assert.equal(savedJobs.length, 1)
  assert.equal(savedJobs[0].experienceRequired, '5+ years')
})

test('saveToFile does not promote medium-confidence non-numeric experience prose into experienceRequired', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jobverify-india-filter-'))
  const filePath = path.join(tmpDir, 'jobs.json')

  saveToFile(
    [
      {
        title: 'Inside Sales Representative',
        company: 'Example India',
        location: 'Kochi, India',
        city: 'Kochi',
        link: 'https://example.com/inside-sales-role',
        experienceRequired: null,
        jobDescription:
          "What you've got? Hands-on experience in inside sales and lead generation Opportunity to work closely with an experienced sales team.",
      },
    ],
    filePath,
  )

  const savedJobs = JSON.parse(fs.readFileSync(filePath, 'utf8'))

  assert.equal(savedJobs.length, 1)
  assert.equal(savedJobs[0].experienceRequired, null)
})

test('filterIndiaJobs keeps city-only India jobs and plain remote jobs without requiring country', () => {
  const filteredJobs = filterIndiaJobs([
    {
      title: 'Platform Engineer',
      location: 'Bengaluru, India',
      city: 'Bangalore',
    },
    {
      title: 'SDET',
      location: 'Bangalore Area',
      city: 'Bangalore',
    },
    {
      title: 'Support Engineer',
      location: 'Noida',
      city: 'Noida',
    },
    {
      title: 'Equifax Analyst',
      location: 'IND-Trivandrum-Equifax Analytics-PEC',
      city: 'IND-Trivandrum-Equifax Analytics-PEC',
    },
    {
      title: 'Offsite Analyst',
      location: 'India Offsite (ZIN99)',
      city: 'India Offsite (ZIN99)',
    },
    {
      title: 'Backend Engineer',
      location: 'Austin, United States',
      city: 'Austin',
    },
    {
      title: 'Staff Engineer',
      location: 'Remote',
      city: 'Remote',
    },
  ])

  assert.deepEqual(
    filteredJobs.map((job) => job.title),
    ['Platform Engineer', 'SDET', 'Support Engineer', 'Equifax Analyst', 'Offsite Analyst', 'Staff Engineer'],
  )
})

test('filterIndiaJobs keeps India apiPortal jobs and rejects non-India apiPortal jobs', () => {
  const filteredJobs = filterIndiaJobs([
    {
      title: 'Graduate Software Engineer',
      location: 'Bengaluru, India',
      city: 'Bengaluru',
      source: 'razorpay',
    },
    {
      title: 'Backend Engineer',
      location: 'Austin, United States',
      city: 'Austin',
      source: 'freshworks',
    },
  ])

  assert.deepEqual(filteredJobs.map((job) => job.title), ['Graduate Software Engineer'])
})

test('filterIndiaJobs rejects foreign locations even when the country field is mislabeled as India', () => {
  const filteredJobs = filterIndiaJobs([
    {
      title: 'Leaked Role',
      country: 'India',
      location: 'Austin, Texas, United States of America',
      city: 'Austin',
    },
    {
      title: 'Valid India Role',
      country: 'India',
      location: 'Bengaluru, India',
      city: 'Bangalore',
    },
  ])

  assert.deepEqual(filteredJobs.map((job) => job.title), ['Valid India Role'])
})
