const cp = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const baseOutDir = path.resolve(__dirname, '..', 'docs', 'screenshots');
const frontOutDir = path.join(baseOutDir, 'frontpage');

fs.mkdirSync(baseOutDir, { recursive: true });
fs.mkdirSync(frontOutDir, { recursive: true });

async function getAuthTokens() {
  const fetchAuth = (url, body) => new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let str = '';
      res.on('data', d => str += d);
      res.on('end', () => resolve(JSON.parse(str)));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });

  const farmerRes = await fetchAuth('http://127.0.0.1:5000/api/auth/login', {
    farmer_id: 'AHN-001',
    password: 'Mango-River-Tiger-47'
  });

  const adminRes = await fetchAuth('http://127.0.0.1:5000/api/auth/login', {
    farmer_id: 'ADM-001',
    password: 'Admin-Secure-Pass-2026'
  });

  return { farmer: farmerRes, admin: adminRes };
}

function writeBootstrapHtml(distDir, auth) {
  const idx = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8');

  // Farmer view
  const farmerScript = `<script>
    localStorage.setItem('terrawise_token', '${auth.farmer.token}');
    localStorage.setItem('terrawise_farmer', JSON.stringify(${JSON.stringify(auth.farmer.farmer)}));
    localStorage.setItem('terrawise_lang', 'mr');
  </script>`;
  fs.writeFileSync(path.join(distDir, 'farmer_view.html'), idx.replace('<div id="root"></div>', `<div id="root"></div>${farmerScript}`));

  // Admin view
  const adminScript = `<script>
    localStorage.setItem('terrawise_token', '${auth.admin.token}');
    localStorage.setItem('terrawise_farmer', JSON.stringify(${JSON.stringify(auth.admin.farmer)}));
    localStorage.setItem('terrawise_lang', 'mr');
  </script>`;
  fs.writeFileSync(path.join(distDir, 'admin_view.html'), idx.replace('<div id="root"></div>', `<div id="root"></div>${adminScript}`));

  // Clean front view
  const frontScript = `<script>
    localStorage.removeItem('terrawise_token');
    localStorage.removeItem('terrawise_farmer');
    localStorage.setItem('terrawise_lang', 'mr');
  </script>`;
  fs.writeFileSync(path.join(distDir, 'front_view.html'), idx.replace('<div id="root"></div>', `<div id="root"></div>${frontScript}`));
}

async function capture() {
  console.log('Logging in and generating bootstrap HTML...');
  const auth = await getAuthTokens();
  const distDir = path.resolve(__dirname, '..', 'frontend', 'dist');
  writeBootstrapHtml(distDir, auth);

  const targets = [
    // Front page
    { url: 'http://127.0.0.1:5000/front_view.html', w: 360, h: 740, mobile: true, scale: 2, dest: path.join(frontOutDir, 'frontpage_mobile_360px.png') },
    { url: 'http://127.0.0.1:5000/front_view.html', w: 768, h: 1024, mobile: false, scale: 1.5, dest: path.join(frontOutDir, 'frontpage_tablet_768px.png') },
    { url: 'http://127.0.0.1:5000/front_view.html', w: 1280, h: 800, mobile: false, scale: 1, dest: path.join(frontOutDir, 'frontpage_desktop_1280px.png') },
    { url: 'http://127.0.0.1:5000/front_view.html', w: 1920, h: 1080, mobile: false, scale: 1, dest: path.join(frontOutDir, 'frontpage_widescreen_1920px.png') },
    { url: 'http://127.0.0.1:5000/front_view.html?demo=1', w: 1280, h: 800, mobile: false, scale: 1, dest: path.join(frontOutDir, 'frontpage_demo_drawer_1280px.png') },

    // Farmer Dashboard
    { url: 'http://127.0.0.1:5000/farmer_view.html', w: 360, h: 740, mobile: true, scale: 2, dest: path.join(baseOutDir, 'farmer_dashboard_360px.png') },
    { url: 'http://127.0.0.1:5000/farmer_view.html', w: 768, h: 1024, mobile: false, scale: 1.5, dest: path.join(baseOutDir, 'farmer_dashboard_768px.png') },
    { url: 'http://127.0.0.1:5000/farmer_view.html', w: 1280, h: 800, mobile: false, scale: 1, dest: path.join(baseOutDir, 'farmer_dashboard_1280px.png') },

    // Admin Portal
    { url: 'http://127.0.0.1:5000/admin_view.html', w: 1280, h: 800, mobile: false, scale: 1, dest: path.join(baseOutDir, 'admin_portal_1280px.png') },
    { url: 'http://127.0.0.1:5000/admin_view.html', w: 768, h: 1024, mobile: false, scale: 1.5, dest: path.join(baseOutDir, 'admin_portal_768px.png') }
  ];

  console.log(`Starting Chrome to capture ${targets.length} viewports via CDP...`);
  const chrome = cp.spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    'about:blank'
  ]);

  await new Promise(r => setTimeout(r, 1500));

  for (const t of targets) {
    await new Promise((resolve) => {
      http.get('http://localhost:9222/json', (res) => {
        let str = '';
        res.on('data', d => str += d);
        res.on('end', () => {
          const pageList = JSON.parse(str);
          const page = pageList.find(p => p.type === 'page');
          if (!page) { resolve(); return; }

          const ws = new WebSocket(page.webSocketDebuggerUrl);
          ws.onopen = () => {
            ws.send(JSON.stringify({ id: 1, method: 'Page.navigate', params: { url: t.url } }));
          };

          ws.onmessage = (evt) => {
            const msg = JSON.parse(evt.data);
            if (msg.id === 1) {
              // Wait 1.2s for React render and Leaflet tile mount
              setTimeout(() => {
                ws.send(JSON.stringify({
                  id: 2,
                  method: 'Emulation.setDeviceMetricsOverride',
                  params: { width: t.w, height: t.h, deviceScaleFactor: t.scale, mobile: t.mobile }
                }));
                setTimeout(() => {
                  ws.send(JSON.stringify({ id: 3, method: 'Page.captureScreenshot', params: { format: 'png' } }));
                }, 800);
              }, 1200);
            } else if (msg.id === 3 && msg.result?.data) {
              const buffer = Buffer.from(msg.result.data, 'base64');
              fs.writeFileSync(t.dest, buffer);
              console.log(`Saved ${path.basename(t.dest)} (${buffer.length} bytes, ${t.w}x${t.h})`);
              ws.close();
              resolve();
            }
          };
        });
      });
    });
  }

  chrome.kill();
  console.log('All screenshots successfully captured!');
}

capture().catch(err => {
  console.error('Capture failed:', err);
  process.exit(1);
});
