import { access, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const requiredFiles = [
  'public/index.html',
  'public/checkout.html',
  'public/portal.html',
  'public/admin.html',
  'public/styles.css',
  'netlify.toml',
  'supabase/schema.sql'
];

for (const file of requiredFiles) {
  await access(join(process.cwd(), file));
}

const functions = await readdir(join(process.cwd(), 'netlify/functions'));
if (!functions.some((file) => file.endsWith('.mjs'))) {
  throw new Error('No Netlify functions found.');
}

console.log('Sentinel Care static build check passed.');
