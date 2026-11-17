// ┌──────────────────────────────────────────────────────────────────────────┐
// │ ALHAMDULLILAH - KASSAM MUSTAPHA - 12/11/2026
// │ Writes the Postman, Insomnia, OpenAPI, Markdown and webhook test files into the repo
// └──────────────────────────────────────────────────────────────────────────┘

const fs = require('fs');
const path = require('path');
const { buildDocs } = require('../src/utils/apiDocs');
const { files } = require('../src/services/docsGenerator');

// usage: npm run docs:export [-- https://bridge.example.com]
const baseUrl = process.argv[2] || process.env.DOCS_BASE_URL || 'http://localhost:5001';
const target = path.join(__dirname, '..', '..');

for (const file of files(buildDocs({ baseUrl }))) {
  fs.writeFileSync(path.join(target, file.name), file.content);
  console.log(`wrote ${file.name} (${file.content.length} bytes)`);
}
