const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname);
const distDir = path.join(__dirname, 'dist');

if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

// Process index.html
const html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf-8');
const result = html
  .replace(/__SUPABASE_URL__/g, process.env.SUPABASE_URL || '')
  .replace(/__SUPABASE_ANON_KEY__/g, process.env.SUPABASE_ANON_KEY || '');

fs.writeFileSync(path.join(distDir, 'index.html'), result);

// Copy css/ directory
const cssDir = path.join(srcDir, 'css');
const distCssDir = path.join(distDir, 'css');
if (!fs.existsSync(distCssDir)) fs.mkdirSync(distCssDir, { recursive: true });
fs.readdirSync(cssDir).forEach(file => {
  fs.copyFileSync(path.join(cssDir, file), path.join(distCssDir, file));
});

// Copy js/ directory
const jsDir = path.join(srcDir, 'js');
const distJsDir = path.join(distDir, 'js');
if (!fs.existsSync(distJsDir)) fs.mkdirSync(distJsDir, { recursive: true });
fs.readdirSync(jsDir).forEach(file => {
  const content = fs.readFileSync(path.join(jsDir, file), 'utf-8');
  const processed = content
    .replace(/__SUPABASE_URL__/g, process.env.SUPABASE_URL || '')
    .replace(/__SUPABASE_ANON_KEY__/g, process.env.SUPABASE_ANON_KEY || '');
  fs.writeFileSync(path.join(distJsDir, file), processed);
});
