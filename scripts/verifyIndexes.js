console.warn(
  "scripts/verifyIndexes.js is deprecated. Use `npm run db:indexes:plan` or `npm run db:indexes:apply` instead.",
);

await import("./indexes.js");
