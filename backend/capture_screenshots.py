import os
import json
import urllib.request
import subprocess
import time

def capture():
    # 1. Login as Farmer AHN-001
    req = urllib.request.Request(
        'http://127.0.0.1:5000/api/auth/login',
        data=json.dumps({'farmer_id': 'AHN-001', 'password': 'Mango-River-Tiger-47'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        token = data['token']
        farmer = data['farmer']

    print('Farmer logged in:', farmer['farmer_id'])

    # 2. Login as Admin ADM-001
    admin_req = urllib.request.Request(
        'http://127.0.0.1:5000/api/auth/login',
        data=json.dumps({'farmer_id': 'ADM-001', 'password': 'Admin-Secure-Pass-2026'}).encode('utf-8'),
        headers={'Content-Type': 'application/json'}
    )
    with urllib.request.urlopen(admin_req) as resp:
        admin_data = json.loads(resp.read().decode('utf-8'))
        admin_token = admin_data['token']
        admin_user = admin_data['farmer']

    print('Admin logged in:', admin_user['farmer_id'])

    dist_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'frontend', 'dist'))
    with open(os.path.join(dist_dir, 'index.html'), 'r', encoding='utf-8') as f:
        idx_content = f.read()

    # Create farmer bootstrap HTML
    farmer_script = (
        f"<script>\n"
        f"localStorage.setItem('terrawise_token', '{token}');\n"
        f"localStorage.setItem('terrawise_farmer', JSON.stringify({json.dumps(farmer)}));\n"
        f"localStorage.setItem('terrawise_lang', 'mr');\n"
        f"</script>\n"
    )
    farmer_html = idx_content.replace('<div id="root"></div>', f'<div id="root"></div>{farmer_script}')
    with open(os.path.join(dist_dir, 'farmer_view.html'), 'w', encoding='utf-8') as f:
        f.write(farmer_html)

    # Create admin bootstrap HTML
    admin_script = (
        f"<script>\n"
        f"localStorage.setItem('terrawise_token', '{admin_token}');\n"
        f"localStorage.setItem('terrawise_farmer', JSON.stringify({json.dumps(admin_user)}));\n"
        f"localStorage.setItem('terrawise_lang', 'mr');\n"
        f"</script>\n"
    )
    admin_html = idx_content.replace('<div id="root"></div>', f'<div id="root"></div>{admin_script}')
    with open(os.path.join(dist_dir, 'admin_view.html'), 'w', encoding='utf-8') as f:
        f.write(admin_html)

    # Create clean frontpage bootstrap HTML (no token in localStorage)
    clean_front_script = (
        f"<script>\n"
        f"localStorage.removeItem('terrawise_token');\n"
        f"localStorage.removeItem('terrawise_farmer');\n"
        f"localStorage.setItem('terrawise_lang', 'mr');\n"
        f"</script>\n"
    )
    clean_front_html = idx_content.replace('<div id="root"></div>', f'<div id="root"></div>{clean_front_script}')
    with open(os.path.join(dist_dir, 'front_view.html'), 'w', encoding='utf-8') as f:
        f.write(clean_front_html)

    chrome = r'C:\Program Files\Google\Chrome\Application\chrome.exe'
    out_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'docs', 'screenshots'))
    front_out_dir = os.path.join(out_dir, 'frontpage')
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(front_out_dir, exist_ok=True)

    views = [
        # Front Page Views
        (360, 740, os.path.join(front_out_dir, 'frontpage_mobile_360px.png'), 'http://127.0.0.1:5000/front_view.html'),
        (768, 1024, os.path.join(front_out_dir, 'frontpage_tablet_768px.png'), 'http://127.0.0.1:5000/front_view.html'),
        (1280, 800, os.path.join(front_out_dir, 'frontpage_desktop_1280px.png'), 'http://127.0.0.1:5000/front_view.html'),
        (1920, 1080, os.path.join(front_out_dir, 'frontpage_widescreen_1920px.png'), 'http://127.0.0.1:5000/front_view.html'),
        (1280, 800, os.path.join(front_out_dir, 'frontpage_demo_drawer_1280px.png'), 'http://127.0.0.1:5000/front_view.html?demo=1'),

        # Farmer Dashboard
        (360, 740, os.path.join(out_dir, 'farmer_dashboard_360px.png'), 'http://127.0.0.1:5000/farmer_view.html'),
        (768, 1024, os.path.join(out_dir, 'farmer_dashboard_768px.png'), 'http://127.0.0.1:5000/farmer_view.html'),
        (1280, 800, os.path.join(out_dir, 'farmer_dashboard_1280px.png'), 'http://127.0.0.1:5000/farmer_view.html'),

        # Admin Portal
        (1280, 800, os.path.join(out_dir, 'admin_portal_1280px.png'), 'http://127.0.0.1:5000/admin_view.html'),
        (768, 1024, os.path.join(out_dir, 'admin_portal_768px.png'), 'http://127.0.0.1:5000/admin_view.html'),
    ]

    for w, h, dest, url in views:
        cmd = [
            chrome,
            '--headless=new',
            '--disable-gpu',
            f'--window-size={w},{h}',
            f'--screenshot={dest}',
            '--virtual-time-budget=3500',
            url
        ]
        res = subprocess.run(cmd, capture_output=True, timeout=15)
        fname = os.path.basename(dest)
        print(f"{fname}: Exists={os.path.exists(dest)}, Size={os.path.getsize(dest) if os.path.exists(dest) else 0} bytes")

if __name__ == '__main__':
    capture()
