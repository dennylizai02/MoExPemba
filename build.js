const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf-8');

const result = html
  .replace(/__SUPABASE_URL__/g, process.env.SUPABASE_URL || '')
  .replace(/__SUPABASE_ANON_KEY__/g, process.env.SUPABASE_ANON_KEY || '');

fs.writeFileSync(path.join(__dirname, 'dist', 'index.html'), result);
