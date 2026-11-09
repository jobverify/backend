import assert from 'node:assert/strict'
import test from 'node:test'

import { extractJobDetail, run } from './script.js'

test('Electronic Arts propagates official source failure instead of reporting unobserved empty jobs', async () => {
  await assert.rejects(run({ fetchPage: async () => { throw Error('EA official source unavailable') } }), /EA official source unavailable/)
})

test('Electronic Arts honors caller cancellation before observing official inventory', async () => {
  const controller = new AbortController()
  controller.abort(new Error('stop EA source'))
  await assert.rejects(run({ signal: controller.signal }), /stop EA source/)
})

test('extractJobDetail derives experience requirements from EA job descriptions', () => {
  const detail = extractJobDetail(`
    <meta property="og:title" content="Game Designer II">
    <article class="article article--details ">
      <h2>Description &amp; Requirements</h2>
      <div class="article__content__view__field__value">
        <p>What You Bring</p>
        <p>5+ years of game design experience.</p>
      </div>
    </article>
  `, {
    title: 'Game Designer II',
    sourceUrl: 'https://jobs.ea.com/en_US/careers/JobDetail/Game-Designer-II/215680',
  })

  assert.equal(detail.experienceRequired, '5+ years of game design experience')
})

test('extractJobDetail scans through nested markup in EA job descriptions', () => {
  const detail = extractJobDetail(`
    <meta property="og:title" content="Game Designer II">
    <article class="article article--details ">
      <h2>Description &amp; Requirements</h2>
      <div class="article__content__view__field__value">
        <div><p>What You Bring</p></div>
        <ul><li>5+ years of game design experience, ideally on mobile games.</li></ul>
      </div>
    </article>
  `)

  assert.equal(detail.experienceRequired, '5+ years of game design experience')
})
