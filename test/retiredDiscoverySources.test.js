import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScrapers,
  getScraperCatalog,
} from "../scraper-support/providers/index.js";

const isRetiredDiscoveryProvider = (provider = {}) => (
  /(?:\.wellfoundDirectory|\.himalayas(?:Directory|\.app))$/i.test(provider.source || "")
  || ["himalayasDirectory", "wellfoundDirectory"].includes(provider.adapter)
);

test("retired Himalayas and Wellfound companies are absent from the provider catalog", () => {
  const retiredProviders = getScraperCatalog().filter(isRetiredDiscoveryProvider);

  assert.deepEqual(
    retiredProviders.map(({ source }) => source),
    [],
    `Found ${retiredProviders.length} retired discovery provider(s) in the catalog.`,
  );
});

test("retired Himalayas and Wellfound companies cannot produce runnable scrapers", () => {
  const retiredScrapers = buildScrapers().filter(({ provider }) => (
    isRetiredDiscoveryProvider(provider)
  ));

  assert.deepEqual(
    retiredScrapers.map(({ name }) => name),
    [],
    `Built ${retiredScrapers.length} retired discovery scraper(s).`,
  );
});
