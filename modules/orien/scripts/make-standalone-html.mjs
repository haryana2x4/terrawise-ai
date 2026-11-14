import fs from 'node:fs';
import path from 'node:path';

const projectDir = 'C:\\Users\\Rocky\\Desktop\\Beyond Earth';
const distDir = path.join(projectDir, 'dist');
const htmlPath = path.join(distDir, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');

// Find JS and CSS in assets
const assetsDir = path.join(distDir, 'assets');
const files = fs.readdirSync(assetsDir);
const jsFile = files.find(f => f.endsWith('.js'));
const cssFile = files.find(f => f.endsWith('.css'));

if (cssFile) {
  const css = fs.readFileSync(path.join(assetsDir, cssFile), 'utf8');
  html = html.replace(/<link rel="stylesheet"[^>]+>/i, () => `<style>\n${css}\n</style>`);
}

if (jsFile) {
  const js = fs.readFileSync(path.join(assetsDir, jsFile), 'utf8');
  // Use a replacer function to avoid String.prototype.replace expanding special $ patterns like $' or $&
  html = html.replace(/<script type="module"[^>]+><\/script>/i, () => `<script type="module">\n${js}\n</script>`);
}

// Add Netlify SPA redirect support
const redirectsPath = path.join(distDir, '_redirects');
fs.writeFileSync(redirectsPath, '/*    /index.html   200\n', 'utf8');

const desktopHtmlPath = 'C:\\Users\\Rocky\\Desktop\\Beyond_Earth.html';
fs.writeFileSync(desktopHtmlPath, html, 'utf8');
console.log(`Standalone HTML created successfully at: ${desktopHtmlPath} (${(html.length / 1024).toFixed(1)} KB)`);

// Also copy dist to Desktop as "Beyond Earth Website"
const desktopWebsiteDir = 'C:\\Users\\Rocky\\Desktop\\Beyond Earth Website';
fs.cpSync(distDir, desktopWebsiteDir, { recursive: true });
// Also place the standalone HTML as index.html in a special Netlify Single File folder
const netlifyDeployDir = 'C:\\Users\\Rocky\\Desktop\\Netlify_Deploy';
if (!fs.existsSync(netlifyDeployDir)) fs.mkdirSync(netlifyDeployDir, { recursive: true });
fs.writeFileSync(path.join(netlifyDeployDir, 'index.html'), html, 'utf8');
fs.writeFileSync(path.join(netlifyDeployDir, '_redirects'), '/*    /index.html   200\n', 'utf8');
console.log(`Portable Website folder created at: ${desktopWebsiteDir}`);
console.log(`Netlify Ready Single-File Folder created at: ${netlifyDeployDir}`);
