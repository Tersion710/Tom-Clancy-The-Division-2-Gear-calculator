const { app, BrowserWindow, Menu, dialog, shell } = require('electron');
const path = require('path');
const https = require('https');
const fs = require('fs');

const GITHUB_RAW = 'https://raw.githubusercontent.com/ImThatTeriyaki/Tom-Clancy-The-Division-2-Gear-calculator/main';
const GITHUB_PKG_URL  = `${GITHUB_RAW}/package.json`;
const GITHUB_HTML_URL = `${GITHUB_RAW}/division2-gear-calculator.html`;
const GITHUB_API_RELEASES = 'https://api.github.com/repos/ImThatTeriyaki/Tom-Clancy-The-Division-2-Gear-calculator/releases/latest';

// Path where we store the version of the last downloaded update
function getVersionFilePath() {
  return path.join(app.getPath('userData'), 'downloaded-version.json');
}

// Returns the effective current version (downloaded version if newer than bundled)
function getEffectiveVersion() {
  try {
    const vf = getVersionFilePath();
    if (fs.existsSync(vf)) {
      const data = JSON.parse(fs.readFileSync(vf, 'utf8'));
      if (data.version && compareVersions(app.getVersion(), data.version)) {
        return data.version;
      }
    }
  } catch (_) {}
  // Also check the downloaded HTML directly for its version string
  try {
    const updated = path.join(app.getPath('userData'), 'division2-gear-calculator.html');
    if (fs.existsSync(updated)) {
      const content = fs.readFileSync(updated, 'utf8');
      const match = content.match(/Gear Calculator v([\d.]+)/);
      if (match && compareVersions(app.getVersion(), match[1])) {
        return match[1];
      }
    }
  } catch (_) {}
  return app.getVersion();
}

// Save the downloaded version so we don't re-prompt after update
function saveDownloadedVersion(version) {
  try {
    fs.writeFileSync(getVersionFilePath(), JSON.stringify({ version }), 'utf8');
  } catch (_) {}
}

function getHtmlPath() {
  const updated = path.join(app.getPath('userData'), 'division2-gear-calculator.html');
  if (!fs.existsSync(updated)) return path.join(__dirname, 'division2-gear-calculator-v2.html');

  try {
    const content = fs.readFileSync(updated, 'utf8');

    // Basic sanity check — must contain the DB and DOMContentLoaded
    if (!content.includes('DOMContentLoaded') || !content.includes('const DB =')) {
      fs.unlinkSync(updated);
      return path.join(__dirname, 'division2-gear-calculator-v2.html');
    }

    const match = content.match(/Gear Calculator v([\d.]+)/);
    if (match) {
      const downloadedVer = match[1];
      const bundledVer = app.getVersion();
      if (!compareVersions(bundledVer, downloadedVer)) {
        fs.unlinkSync(updated);
        try { fs.unlinkSync(getVersionFilePath()); } catch (_) {}
        return path.join(__dirname, 'division2-gear-calculator-v2.html');
      }
    }
  } catch (_) {
    try { fs.unlinkSync(updated); } catch (_) {}
    return path.join(__dirname, 'division2-gear-calculator-v2.html');
  }

  return updated;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function httpsGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Division2GearCalc-Updater' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location)
        return httpsGet(res.headers.location).then(resolve).catch(reject);
      if (res.statusCode !== 200) { res.resume(); return reject(new Error(`HTTP ${res.statusCode}`)); }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    const tmp = destPath + '.tmp';
    const file = fs.createWriteStream(tmp);
    https.get(url, { headers: { 'User-Agent': 'Division2GearCalc-Updater' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close(); try { fs.unlinkSync(tmp); } catch (_) {}
        return downloadFile(res.headers.location, destPath).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        file.close(); try { fs.unlinkSync(tmp); } catch (_) {}
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      res.pipe(file);
      file.on('finish', () => file.close(() => fs.rename(tmp, destPath, e => e ? reject(e) : resolve())));
    }).on('error', err => { file.close(); try { fs.unlinkSync(tmp); } catch (_) {} reject(err); });
  });
}

function compareVersions(a, b) {
  const pa = a.replace(/^v/,'').split('.').map(Number);
  const pb = b.replace(/^v/,'').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = pa[i]||0, nb = pb[i]||0;
    if (nb > na) return true;
    if (nb < na) return false;
  }
  return false;
}

// ── Themed update window ──────────────────────────────────────────────────────

function showUpdatePrompt(mainWin, localVersion, remoteVersion) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 480, height: 300,
      frame: false, resizable: false, center: true,
      alwaysOnTop: true, parent: mainWin,
      backgroundColor: '#080c10',
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    win.loadURL(`data:text/html,<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{background:%23080c10;color:%23b8cfe0;font-family:'Segoe UI',sans-serif;
           height:100vh;display:flex;flex-direction:column;overflow:hidden;
           border:1px solid %23f4a21e44;border-top:2px solid %23f4a21e;}
      body::before{content:'';position:fixed;inset:0;
        background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,229,255,0.012) 2px,rgba(0,229,255,0.012) 4px);
        pointer-events:none;}
      .corner{position:fixed;width:24px;height:24px;}
      .tl{top:8px;left:8px;border-top:1px solid %23f4a21e66;border-left:1px solid %23f4a21e66;}
      .tr{top:8px;right:8px;border-top:1px solid %23f4a21e66;border-right:1px solid %23f4a21e66;}
      .bl{bottom:8px;left:8px;border-bottom:1px solid %23f4a21e66;border-left:1px solid %23f4a21e66;}
      .br{bottom:8px;right:8px;border-bottom:1px solid %23f4a21e66;border-right:1px solid %23f4a21e66;}
      .header{padding:16px 20px 12px;border-bottom:1px solid %231e3040;
              display:flex;align-items:center;gap:12px;}
      .badge{width:32px;height:32px;background:linear-gradient(135deg,%23f4a21e,%23c07010);
             clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
             display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .badge svg{width:18px;height:18px;fill:%23080c10;}
      .header-text .title{color:%23f4a21e;font-size:0.8rem;font-weight:700;
                          letter-spacing:0.2em;text-transform:uppercase;}
      .header-text .sub{color:%234a6070;font-size:0.62rem;letter-spacing:0.15em;text-transform:uppercase;margin-top:2px;}
      .body{flex:1;padding:20px 24px;display:flex;flex-direction:column;gap:14px;}
      .alert{color:%2300e5ff;font-size:0.68rem;letter-spacing:0.2em;text-transform:uppercase;
             text-shadow:0 0 8px %2300e5ff66;}
      .alert::before{content:'▶ ';}
      .versions{display:flex;gap:16px;}
      .ver-box{flex:1;background:%230c1018;border:1px solid %231e3040;border-left:3px solid %231e3040;
               padding:10px 14px;border-radius:2px;}
      .ver-box.new{border-left-color:%23f4a21e;}
      .ver-box .label{font-size:0.6rem;letter-spacing:0.2em;text-transform:uppercase;color:%234a6070;margin-bottom:4px;}
      .ver-box .num{font-size:1.1rem;font-weight:700;color:%23b8cfe0;font-family:'Courier New',monospace;}
      .ver-box.new .num{color:%23f4a21e;text-shadow:0 0 10px %23f4a21e44;}
      .detail{font-size:0.7rem;color:%234a6070;line-height:1.5;}
      .actions{padding:14px 24px 18px;display:flex;gap:10px;border-top:1px solid %231e3040;}
      button{flex:1;padding:9px 0;border-radius:2px;font-family:'Segoe UI',sans-serif;
             font-size:0.78rem;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;
             cursor:pointer;transition:all 0.15s;border:none;}
      .btn-update{background:linear-gradient(135deg,%23f4a21e,%23c07010);color:%23080c10;}
      .btn-update:hover{background:linear-gradient(135deg,%23ffb83f,%23d08020);
                        box-shadow:0 0 16px %23f4a21e44;}
      .btn-skip{background:%230c1018;color:%234a6070;border:1px solid %231e3040;}
      .btn-skip:hover{color:%23b8cfe0;border-color:%23f4a21e44;}
    </style></head><body>
      <div class="corner tl"></div><div class="corner tr"></div>
      <div class="corner bl"></div><div class="corner br"></div>
      <div class="header">
        <div class="badge"><svg viewBox="0 0 24 24"><path d="M12 2L2 7v5c0 5.25 4.25 10.15 10 11.35C17.75 22.15 22 17.25 22 12V7L12 2zm0 2.18l8 4.37V12c0 4.34-3.46 8.4-8 9.56C7.46 20.4 4 16.34 4 12V8.55l8-4.37zM11 7v2H9v2h2v2H9v2h2v2h2v-2h2v-2h-2v-2h2V9h-2V7h-2z"/></svg></div>
        <div class="header-text">
          <div class="title">Update Available</div>
          <div class="sub">SHD Network — Gear Calculator</div>
        </div>
      </div>
      <div class="body">
        <div class="alert">New version detected</div>
        <div class="versions">
          <div class="ver-box"><div class="label">Installed</div><div class="num">v${localVersion}</div></div>
          <div class="ver-box new"><div class="label">Available</div><div class="num">v${remoteVersion}</div></div>
        </div>
        <div class="detail">Update now to get the latest gear data, bug fixes, and improvements. The tool will relaunch automatically after downloading.</div>
      </div>
      <div class="actions">
        <button class="btn-update" onclick="require('electron').ipcRenderer.send('update-choice','yes')">Update Now</button>
        <button class="btn-skip" onclick="require('electron').ipcRenderer.send('update-choice','no')">Skip</button>
      </div>
    </body></html>`);

    const { ipcMain } = require('electron');
    const handler = (event, choice) => {
      ipcMain.removeListener('update-choice', handler);
      win.close();
      resolve(choice === 'yes');
    };
    ipcMain.on('update-choice', handler);
    win.on('closed', () => { ipcMain.removeListener('update-choice', handler); resolve(false); });
  });
}

function showProgressWindow(mainWin, remoteVersion) {
  const win = new BrowserWindow({
    width: 440, height: 200,
    frame: false, resizable: false, center: true,
    alwaysOnTop: true, parent: mainWin,
    backgroundColor: '#080c10',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });

  win.loadURL(`data:text/html,<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{background:%23080c10;color:%23b8cfe0;font-family:'Segoe UI',sans-serif;
         height:100vh;display:flex;flex-direction:column;align-items:center;
         justify-content:center;gap:18px;border:1px solid %23f4a21e44;border-top:2px solid %23f4a21e;}
    body::before{content:'';position:fixed;inset:0;
      background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,229,255,0.012) 2px,rgba(0,229,255,0.012) 4px);
      pointer-events:none;}
    .badge{width:36px;height:36px;background:linear-gradient(135deg,%23f4a21e,%23c07010);
           clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
           display:flex;align-items:center;justify-content:center;
           animation:pulse 1.5s ease-in-out infinite;}
    @keyframes pulse{0%,100%{filter:drop-shadow(0 0 6px %23f4a21e66)}50%{filter:drop-shadow(0 0 14px %23f4a21eaa)}}
    .badge svg{width:20px;height:20px;fill:%23080c10;}
    .title{color:%23f4a21e;font-size:0.82rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;}
    .bar-wrap{width:300px;height:3px;background:%231e3040;border-radius:2px;overflow:hidden;}
    .bar{height:3px;background:linear-gradient(90deg,%23f4a21e,%2300e5ff);
         animation:scan 1.8s ease-in-out infinite;width:40%;position:relative;}
    @keyframes scan{0%{left:-40%}100%{left:100%}}
    .sub{font-size:0.62rem;color:%234a6070;letter-spacing:0.2em;text-transform:uppercase;}
  </style></head><body>
    <div class="badge"><svg viewBox="0 0 24 24"><path d="M12 2L2 7v5c0 5.25 4.25 10.15 10 11.35C17.75 22.15 22 17.25 22 12V7L12 2zm0 2.18l8 4.37V12c0 4.34-3.46 8.4-8 9.56C7.46 20.4 4 16.34 4 12V8.55l8-4.37zM11 7v2H9v2h2v2H9v2h2v2h2v-2h2v-2h-2v-2h2V9h-2V7h-2z"/></svg></div>
    <div class="title">Downloading Update</div>
    <div class="bar-wrap"><div class="bar" style="position:relative;"></div></div>
    <div class="sub">v${remoteVersion} — Please wait</div>
  </body></html>`);

  return win;
}

// ── Release notes window ──────────────────────────────────────────────────────

function showReleaseNotes(mainWin, version, notes) {
  return new Promise((resolve) => {
    const win = new BrowserWindow({
      width: 560, height: 480,
      frame: false, resizable: false, center: true,
      alwaysOnTop: true, parent: mainWin,
      backgroundColor: '#080c10',
      webPreferences: { nodeIntegration: true, contextIsolation: false }
    });

    // Convert markdown-ish notes to simple HTML
    const htmlNotes = notes
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/^### (.+)$/gm, '<h3>$1</h3>')
      .replace(/^## (.+)$/gm, '<h2>$1</h2>')
      .replace(/^# (.+)$/gm, '<h1>$1</h1>')
      .replace(/^\* (.+)$/gm, '<li>$1</li>')
      .replace(/^- (.+)$/gm, '<li>$1</li>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');

    win.loadURL(`data:text/html,<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{margin:0;padding:0;box-sizing:border-box;}
      body{background:%23080c10;color:%23b8cfe0;font-family:'Segoe UI',sans-serif;
           height:100vh;display:flex;flex-direction:column;
           border:1px solid %23f4a21e44;border-top:2px solid %23f4a21e;overflow:hidden;}
      body::before{content:'';position:fixed;inset:0;
        background:repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,229,255,0.012) 2px,rgba(0,229,255,0.012) 4px);
        pointer-events:none;z-index:0;}
      .corner{position:fixed;width:20px;height:20px;z-index:2;}
      .tl{top:8px;left:8px;border-top:1px solid %23f4a21e55;border-left:1px solid %23f4a21e55;}
      .tr{top:8px;right:8px;border-top:1px solid %23f4a21e55;border-right:1px solid %23f4a21e55;}
      .bl{bottom:8px;left:8px;border-bottom:1px solid %23f4a21e55;border-left:1px solid %23f4a21e55;}
      .br{bottom:8px;right:8px;border-bottom:1px solid %23f4a21e55;border-right:1px solid %23f4a21e55;}
      .header{padding:14px 20px 12px;border-bottom:1px solid %231e3040;
              display:flex;align-items:center;gap:12px;flex-shrink:0;position:relative;z-index:1;}
      .badge{width:30px;height:30px;background:linear-gradient(135deg,%23f4a21e,%23c07010);
             clip-path:polygon(50% 0%,100% 25%,100% 75%,50% 100%,0% 75%,0% 25%);
             display:flex;align-items:center;justify-content:center;flex-shrink:0;}
      .badge svg{width:16px;height:16px;fill:%23080c10;}
      .header-text{flex:1;}
      .header-text .title{color:%23f4a21e;font-size:0.8rem;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;}
      .header-text .sub{color:%234a6070;font-size:0.6rem;letter-spacing:0.15em;text-transform:uppercase;margin-top:2px;}
      .ver-tag{background:%230c1018;border:1px solid %23f4a21e44;border-left:3px solid %23f4a21e;
               padding:4px 12px;font-size:0.72rem;font-weight:700;color:%23f4a21e;
               font-family:'Courier New',monospace;letter-spacing:0.1em;}
      .notes-wrap{flex:1;overflow-y:auto;padding:18px 22px;position:relative;z-index:1;
                  scrollbar-width:thin;scrollbar-color:%23f4a21e44 %230c1018;}
      .notes-wrap::-webkit-scrollbar{width:4px;}
      .notes-wrap::-webkit-scrollbar-track{background:%230c1018;}
      .notes-wrap::-webkit-scrollbar-thumb{background:%23f4a21e44;border-radius:2px;}
      .notes-wrap::-webkit-scrollbar-thumb:hover{background:%23f4a21e;}
      .notes{font-size:0.78rem;line-height:1.7;color:%23b8cfe0;}
      .notes h1,.notes h2{color:%23f4a21e;font-size:0.82rem;font-weight:700;letter-spacing:0.15em;
                          text-transform:uppercase;margin:14px 0 8px;padding-bottom:4px;
                          border-bottom:1px solid %231e3040;}
      .notes h3{color:%2300e5ff;font-size:0.75rem;font-weight:700;letter-spacing:0.1em;
                text-transform:uppercase;margin:10px 0 6px;}
      .notes li{color:%23b8cfe0;margin:4px 0 4px 16px;list-style:none;position:relative;}
      .notes li::before{content:'▶';position:absolute;left:-14px;color:%23f4a21e;font-size:0.5rem;top:3px;}
      .notes strong{color:%23dff0ff;}
      .footer{padding:12px 20px;border-top:1px solid %231e3040;display:flex;
              justify-content:flex-end;flex-shrink:0;position:relative;z-index:1;}
      button{padding:8px 28px;background:linear-gradient(135deg,%23f4a21e,%23c07010);color:%23080c10;
             border:none;border-radius:2px;font-weight:700;font-size:0.78rem;letter-spacing:0.12em;
             text-transform:uppercase;cursor:pointer;}
      button:hover{filter:brightness(1.15);box-shadow:0 0 12px %23f4a21e44;}
    </style></head><body>
      <div class="corner tl"></div><div class="corner tr"></div>
      <div class="corner bl"></div><div class="corner br"></div>
      <div class="header">
        <div class="badge"><svg viewBox="0 0 24 24"><path d="M12 2L2 7v5c0 5.25 4.25 10.15 10 11.35C17.75 22.15 22 17.25 22 12V7L12 2zm0 2.18l8 4.37V12c0 4.34-3.46 8.4-8 9.56C7.46 20.4 4 16.34 4 12V8.55l8-4.37zM11 7v2H9v2h2v2H9v2h2v2h2v-2h2v-2h-2v-2h2V9h-2V7h-2z"/></svg></div>
        <div class="header-text">
          <div class="title">What's New</div>
          <div class="sub">Release Notes — Division 2 Gear Calculator</div>
        </div>
        <div class="ver-tag">v${version}</div>
      </div>
      <div class="notes-wrap">
        <div class="notes">${htmlNotes}</div>
      </div>
      <div class="footer">
        <button onclick="window.close()">Got It — Relaunching</button>
      </div>
    </body></html>`);

    const { ipcMain } = require('electron');
    const handler = () => { ipcMain.removeListener('notes-close', handler); win.close(); resolve(); };
    ipcMain.on('notes-close', handler);
    win.on('closed', () => { ipcMain.removeListener('notes-close', handler); resolve(); });
  });
}

// ── Update check ──────────────────────────────────────────────────────────────

async function checkForUpdates(mainWin) {
  try {
    const raw = await httpsGet(GITHUB_PKG_URL);
    const remotePkg = JSON.parse(raw);
    const remoteVersion = remotePkg.version || '0.0.0';
    const localVersion  = getEffectiveVersion(); // use downloaded version if newer

    if (!compareVersions(localVersion, remoteVersion)) return;

    // Fetch release notes from GitHub API (non-blocking — fall back to empty)
    let releaseNotes = '';
    try {
      const releaseRaw = await httpsGet(GITHUB_API_RELEASES);
      const releaseData = JSON.parse(releaseRaw);
      releaseNotes = releaseData.body || '';
    } catch (_) {}

    const doUpdate = await showUpdatePrompt(mainWin, localVersion, remoteVersion);
    if (!doUpdate) return;

    const progressWin = showProgressWindow(mainWin, remoteVersion);

    try {
      const destPath = path.join(app.getPath('userData'), 'division2-gear-calculator.html');
      await downloadFile(GITHUB_HTML_URL, destPath);
      saveDownloadedVersion(remoteVersion);
      progressWin.close();

      // Show release notes — use GitHub release body if available, otherwise show built-in changelog
      const fallbackNotes = releaseNotes.trim() || `## v${remoteVersion}\n\n- Weapon categories: AR, SMG, LMG, Rifle, Marksman Rifle, Shotgun\n- Gear picker grouped by Gear Sets, Brand Sets, Named & Exotic\n- Sidearm slot now shows sidearms only\n- Primary/Secondary slots exclude sidearms\n- Clear Selection only shown when item is selected\n- New sidearms added: Double Barrel Sawed Off, Orbit, Tempest, Prophet, Lefty, Sheriff, TDI Kard\n- All weapon types verified and corrected\n- Talent slot fixes: Memento, Creeping Death, Vigilance, Spotter, Composure\n- Credits modal with Reddit & YouTube links\n- Bug fixes and stability improvements`;
      await showReleaseNotes(mainWin, remoteVersion, fallbackNotes);

      // Auto-relaunch after notes are dismissed
      app.relaunch();
      app.exit(0);

    } catch (dlErr) {
      progressWin.close();
      dialog.showMessageBox(mainWin, {
        type: 'error', title: 'Update Failed',
        message: 'Could not download the update.',
        detail: `${dlErr.message}\n\nUpdate manually at:\ngithub.com/ImThatTeriyaki/Tom-Clancy-The-Division-2-Gear-calculator`,
        buttons: ['Open GitHub', 'Close'], defaultId: 0
      }).then(({ response }) => {
        if (response === 0) shell.openExternal('https://github.com/ImThatTeriyaki/Tom-Clancy-The-Division-2-Gear-calculator');
      });
    }
  } catch (err) {
    console.log('Update check failed (offline?):', err.message);
  }
}

// ── Theme preference file ─────────────────────────────────────────────────────

function getThemePrefPath() {
  return path.join(app.getPath('userData'), 'div2calc-theme.json');
}

function getSavedTheme() {
  try {
    const p = getThemePrefPath();
    if (fs.existsSync(p)) {
      const data = JSON.parse(fs.readFileSync(p, 'utf8'));
      return data.theme || 'Default';
    }
  } catch (_) {}
  return 'Default';
}

function getSplashFile() {
  const theme = getSavedTheme();
  if (theme === 'Liquid Glass') return 'splash-liquid-glass.html';
  if (theme === 'Aero') return 'splash-aero.html';
  return 'splash.html';
}

// ── Window creation ───────────────────────────────────────────────────────────

function createSplash() {
  const theme = getSavedTheme();
  const isLiquidGlass = theme === 'Liquid Glass';
  const isAero = theme === 'Aero';
  const isCozy = theme === 'Cozy';
  const splash = new BrowserWindow({
    width: (isLiquidGlass || isAero) ? 480 : 520,
    height: (isLiquidGlass || isAero) ? 380 : 340,
    frame: false,
    transparent: true,
    resizable: false,
    center: true, alwaysOnTop: true, skipTaskbar: true,
    backgroundColor: '#00000000',
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  splash.loadFile(isLiquidGlass ? 'splash-liquid-glass.html' : isAero ? 'splash-aero.html' : 'splash.html');
  return splash;
}

function createWelcome() {
  const theme = getSavedTheme();
  const isLiquidGlass = theme === 'Liquid Glass';
  const isAero = theme === 'Aero';
  const isCozy = theme === 'Cozy';
  const win = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 900, minHeight: 600,
    frame: false,
    title: 'Division 2 Gear Calculator',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: isLiquidGlass ? '#050810' : isAero ? '#b8cfd8' : isCozy ? '#1e1a16' : '#080c10',
    show: false,
    webPreferences: { nodeIntegration: false, contextIsolation: true }
  });
  win.loadFile(isLiquidGlass ? 'welcome-liquid-glass.html' : isAero ? 'welcome-aero.html' : 'welcome.html');
  return win;
}

function createMain() {
  const win = new BrowserWindow({
    width: 1400, height: 900,
    minWidth: 900, minHeight: 600,
    title: 'Division 2 Gear Calculator',
    icon: path.join(__dirname, 'icon.png'),
    backgroundColor: '#080c10',
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(getHtmlPath());
  console.log('[MAIN] Loading HTML from:', getHtmlPath());
  return win;
}

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  const { ipcMain } = require('electron');

  // Save theme pref immediately when renderer changes theme
  ipcMain.on('save-theme', (event, themeName) => {
    try {
      const existing = fs.existsSync(getThemePrefPath())
        ? JSON.parse(fs.readFileSync(getThemePrefPath(), 'utf8'))
        : {};
      existing.theme = themeName;
      fs.writeFileSync(getThemePrefPath(), JSON.stringify(existing), 'utf8');
    } catch (_) {}
  });

  const splash = createSplash();
  const main   = createMain();

  // Capture renderer output immediately (before ready-to-show)
  main.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[RENDERER L${level}] ${message} (line ${line})`);
  });
  main.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.log(`[LOAD FAILED] ${errorCode}: ${errorDescription}`);
  });
  main.webContents.on('render-process-gone', (event, details) => {
    console.log(`[RENDERER GONE] reason: ${details.reason}`);
  });

  main.once('ready-to-show', () => {
    setTimeout(() => {
      splash.webContents.executeJavaScript(
        'document.body.style.transition="opacity 0.6s"; document.body.style.opacity="0";'
      );
      setTimeout(() => {
        main.show();
        main.focus();
        splash.destroy();
        checkForUpdates(main);
      }, 650);
    }, 2500);
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMain().show();
  });
});

app.on('window-all-closed', () => app.quit());
