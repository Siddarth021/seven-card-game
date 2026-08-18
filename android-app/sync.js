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

  // Inject Android-specific CSS overrides for setup card positioning
  const indexPath = path.join(WWW_DIR, 'index.html');
  if (fs.existsSync(indexPath)) {
    let html = fs.readFileSync(indexPath, 'utf8');
    const androidCss = `
<style>
/* Android-only: Vertically center setup screens */
.screen {
  justify-content: center !important;
  padding: 24px 16px !important;
  box-sizing: border-box;
}
.screen-panel {
  max-height: 100% !important;
  overflow-y: auto !important;
  margin: auto !important;
}

/* Android-only: Topbar reorganization */
.game-topbar {
  display: flex !important;
  flex-direction: column !important;
  align-items: stretch !important;
  padding: 16px 16px 8px 16px !important;
  border-bottom: none !important;
  background: transparent !important;
}

/* Brand header with subtle divider */
.game-topbar .brand {
  text-align: center;
  font-size: 22px;
  margin-bottom: 24px !important;
  position: relative;
}
.game-topbar .brand::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: -16px;
  right: -16px;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(212,162,76,0.3) 20%, rgba(212,162,76,0.3) 80%, transparent);
}

/* Home / Scoreboard */
.game-topbar .topbar-buttons {
  order: 2 !important;
  display: flex !important;
  justify-content: space-between !important;
  flex-direction: row-reverse !important; 
  width: 100% !important;
  margin-bottom: 16px !important;
}

/* Round / Threshold */
.game-topbar .turn-meta {
  order: 3 !important;
  display: flex !important;
  justify-content: space-between !important;
  width: 100% !important;
}

/* Hide TURN, CURRENT PLAYER, SHOW */
.game-topbar .turn-meta span:nth-child(2),
.game-topbar .turn-meta span:nth-child(3),
.game-topbar .turn-meta span:nth-child(4) {
  display: none !important;
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
