const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');
const WWW_DIR = path.resolve(__dirname, 'www');

// List of files/folders to copy from root to www
const ASSETS = [
  'index.html',
  'site.webmanifest',
  'favicon.svg',
  'src',
  'public'
];

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stats = fs.statSync(src);
  if (stats.isDirectory()) {
    if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
    fs.readdirSync(src).forEach(childItemName => {
      copyRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
    });
  } else {
    fs.copyFileSync(src, dest);
  }
}

function sync() {
  console.log('Clearing www directory...');
  if (fs.existsSync(WWW_DIR)) {
    fs.rmSync(WWW_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(WWW_DIR, { recursive: true });

  console.log('Copying assets...');
  for (const asset of ASSETS) {
    const srcPath = path.join(ROOT_DIR, asset);
    const destPath = path.join(WWW_DIR, asset);
    copyRecursiveSync(srcPath, destPath);
    console.log(`Copied ${asset}`);
  }

  // Inject Android-specific CSS overrides
  const indexPath = path.join(WWW_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    const androidCss = `
<style>
/* Android-specific CSS overrides (Scoreboard Modal & Topbar layout) */
@media (max-width: 1024px) {
  .topbar-buttons {
    width: 100% !important;
    display: flex !important;
    justify-content: space-between !important;
    flex-direction: row-reverse !important; 
  }
  
  .side-drawer {
    top: 50% !important;
    left: 50% !important;
    right: auto !important;
    bottom: auto !important;
    height: auto !important;
    max-height: 85vh !important;
    width: 90% !important;
    max-width: 400px !important;
    border-radius: 12px !important;
    border: 1px solid var(--line) !important;
    transform: translate(-50%, 150vh) !important;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7) !important;
    transition: transform 300ms cubic-bezier(0.175, 0.885, 0.32, 1.275) !important;
  }

  .side-drawer.open {
    transform: translate(-50%, -50%) !important;
  }
  
  .inline-hint {
    display: none !important;
  }
}
</style>
    `;
    html = html.replace('</head>', androidCss + '\n</head>');
    fs.writeFileSync(indexPath, html);
    console.log('Injected Android CSS overrides into index.html');
  }

  console.log('Sync complete.');
}

sync();
