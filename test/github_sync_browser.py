"""End-to-end GitHub Pages adapter regression with a mocked GitHub API.
No GitHub credentials or network calls are used. Requires Playwright and Chromium.
"""
import base64
import json
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
checks = 0

def check(condition, message):
    global checks
    assert condition, message
    checks += 1

class FakeGitHub:
    def __init__(self):
        self.data = None
        self.sha = None
        self.n = 0
        self.repo_public = False
        self.calls = []

    def route(self, route):
        request = route.request
        self.calls.append((request.method, urlsplit(request.url).path))
        headers = {
            'access-control-allow-origin': '*',
            'access-control-allow-methods': 'GET, PUT, OPTIONS',
            'access-control-allow-headers': 'authorization, content-type, x-github-api-version, accept',
            'content-type': 'application/json',
        }
        method = request.method
        path = urlsplit(request.url).path
        status = 200
        if method == 'OPTIONS':
            route.fulfill(status=204, headers=headers, body='')
            return
        if path.endswith('/repos/cuenta-test/club-privado'):
            body = {'full_name': 'cuenta-test/club-privado', 'private': not self.repo_public, 'default_branch': 'main'}
        elif path.endswith('/repos/cuenta-test/club-privado/contents/data/matchpoint.json'):
            if method == 'GET':
                if self.data is None:
                    status = 404
                    body = {'message': 'Not Found'}
                else:
                    body = {
                        'type': 'file', 'sha': self.sha,
                        'content': base64.b64encode(json.dumps(self.data, ensure_ascii=False).encode('utf8')).decode('ascii'),
                    }
            elif method == 'PUT':
                content = request.post_data_json
                if self.sha is not None and content.get('sha') != self.sha:
                    status = 409
                    body = {'message': 'Conflict'}
                elif self.sha is None and content.get('sha'):
                    status = 409
                    body = {'message': 'Conflict'}
                else:
                    self.data = json.loads(base64.b64decode(content['content']).decode('utf8'))
                    self.n += 1
                    self.sha = f'sha_{self.n}'
                    body = {'content': {'sha': self.sha}}
            else:
                status, body = 405, {'message': 'not allowed'}
        else:
            status, body = 404, {'message': 'Not Found'}
        route.fulfill(status=status, headers=headers, body=json.dumps(body, ensure_ascii=False))

HTML = (ROOT / 'index.html').read_text(encoding='utf-8').replace('<link rel="stylesheet" href="assets/style.css">', '').replace('<script src="assets/app.js" defer></script>', '').replace('<script src="assets/github-sync.js" defer></script>', '')
HTML = __import__('re').sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', HTML)
CSS = (ROOT / 'assets/style.css').read_text(encoding='utf8')
SYNC_JS = (ROOT / 'assets/github-sync.js').read_text(encoding='utf8')
APP_JS = (ROOT / 'assets/app.js').read_text(encoding='utf8')

def load(page):
    page.set_content(HTML)
    page.evaluate("""() => {
      const map = {};
      Object.defineProperty(window, 'localStorage', {configurable:true, value: {
        getItem(k) { return Object.prototype.hasOwnProperty.call(map,k) ? map[k] : null; },
        setItem(k,v) { map[k]=String(v); },
        removeItem(k) { delete map[k]; },
        key(i) { return Object.keys(map)[i] || null; },
        get length() { return Object.keys(map).length; },
        entries() { return Object.entries(map); }
      }});
    }""")
    page.add_style_tag(content=CSS)
    page.add_script_tag(content=SYNC_JS)
    page.add_script_tag(content=APP_JS)

def get_state(page):
    return page.evaluate('JSON.parse(localStorage.getItem("matchpoint_demo_local_v1"))')

def connect(page, initial=True):
    page.locator('[data-page="configuracion"]').first.click()
    page.locator('#githubRepo').fill('cuenta-test/club-privado')
    page.locator('#githubBranch').fill('')
    page.locator('#githubPath').fill('data/matchpoint.json')
    page.locator('#githubToken').fill('github_pat_abc123FAKE')
    page.get_by_role('button', name='Conectar y cargar datos de GitHub').click()
    page.wait_for_function('document.querySelector("#githubStatusValue").textContent.includes("GitHub") || document.querySelector("#githubStatusValue").textContent.includes("Sin archivo remoto")')

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    github = FakeGitHub()
    ctx = browser.new_context(viewport={'width': 1280, 'height': 900}, locale='es-ES')
    ctx.route('https://api.github.com/**', github.route)
    page = ctx.new_page()
    page.set_default_timeout(7000)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    load(page)
    check('GitHub 2.2' in page.title(), 'pages title')
    check(len(get_state(page)['players']) == 24, 'seed state')
    connect(page)
    page.wait_for_function('document.querySelector("#githubStatusValue").textContent.includes("Sin archivo remoto")')
    check(github.data is None, 'connection never auto-creates remote data')
    page.get_by_role('button', name='Crear base de datos en GitHub').click()
    page.wait_for_function('document.querySelector("#githubStatusValue").textContent.includes("Sincronizado")')
    check(len(github.data['players']) == 24, 'initialization from current dataset')
    check(github.sha == 'sha_1', 'SHA tracked')
    check('github_pat_abc123FAKE' not in json.dumps(page.evaluate('localStorage.entries()')), 'token never stored in localStorage')
    check(not page.locator('#githubToken').input_value(), 'token field cleared after connect')
    page.locator('[data-page="jugadores"]').first.click()
    page.locator('[data-action="add-player"]').first.click()
    page.locator('input[name="name"]').fill('Jugador GitHub Ñ')
    page.locator('input[name="level"]').fill('3.4') if page.locator('input[name="level"]').count() else None
    # Form has more required fields: inspect and fill through normal UI when needed.
    if page.locator('input[name="position"]').count():
        pass
    # Safer guaranteed mutation: cancel modal and toggle weekly availability.
    page.locator('[data-action="close-modal"]').first.click()
    page.locator('[data-page="disponibilidad"]').first.click()
    slots = page.locator('[data-action="toggle-week-slot"]')
    check(slots.count() > 0, 'available weekly slots')
    slots.first.click()
    page.wait_for_function('document.querySelector("#cloudStatus").textContent.includes("Sincronizado")', timeout=15000)
    check(github.sha == 'sha_2', 'edit saved automatically')
    state1 = get_state(page)
    check(github.data['players'][0]['weekAvailability'] == state1['players'][0]['weekAvailability'], 'remote data agrees with local state')

    # Separate browser profile emulates mobile accessing same GitHub Pages site.
    mobile_ctx = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True, locale='es-ES')
    mobile_ctx.route('https://api.github.com/**', github.route)
    mobile = mobile_ctx.new_page()
    mobile.set_default_timeout(7000)
    mobile_errors = []
    mobile.on('pageerror', lambda error: mobile_errors.append(str(error)))
    mobile.on('dialog', lambda dialog: dialog.accept())
    load(mobile)
    mobile.locator('#mobileMenu').click()
    mobile.locator('[data-page="configuracion"]').first.click()
    mobile.locator('#githubRepo').fill('cuenta-test/club-privado')
    mobile.locator('#githubToken').fill('github_pat_abc123FAKE')
    mobile.get_by_role('button', name='Conectar y cargar datos de GitHub').click()
    mobile.wait_for_function('document.querySelector("#cloudStatus").textContent.includes("Sincronizado")')
    state2 = get_state(mobile)
    check(state2['players'][0]['weekAvailability'] == state1['players'][0]['weekAvailability'], 'mobile downloads same data')
    check('github_pat_abc123FAKE' not in json.dumps(mobile.evaluate('localStorage.entries()')), 'mobile token stays in memory')
    check(mobile.locator('meta[name="viewport"]').get_attribute('content') == 'width=device-width, initial-scale=1', 'responsive viewport')

    # Both devices have sha_2. Desktop writes first, mobile writes with stale sha => conflict.
    page.locator('[data-page="disponibilidad"]').first.click()
    page.locator('[data-action="toggle-week-slot"]:not([disabled])').nth(1).click()
    page.wait_for_function('document.querySelector("#cloudStatus").textContent.includes("Sincronizado")', timeout=15000)
    check(github.sha == 'sha_3', 'desktop second edit synced')
    mobile.locator('#mobileMenu').click()
    mobile.locator('[data-page="disponibilidad"]').first.click()
    mobile.locator('[data-action="toggle-week-slot"]:not([disabled])').nth(2).click()
    mobile.wait_for_function('document.querySelector("#cloudStatus").textContent.includes("Conflicto")', timeout=15000)
    check(github.sha == 'sha_3', 'conflicting edit does not overwrite remote')
    mobile.locator('#mobileMenu').click()
    mobile.locator('[data-page="configuracion"]').first.click()
    mobile.get_by_role('button', name='Descargar cambios de GitHub').click()
    mobile.wait_for_function('document.querySelector("#cloudStatus").textContent.includes("Sincronizado")')
    check(get_state(mobile)['players'][0]['weekAvailability'] == github.data['players'][0]['weekAvailability'], 'conflict resolved via remote reload')

    # Offline edit after disconnect must be protected on reconnection.
    mobile.get_by_role('button', name='Desconectar', exact=True).click()
    mobile.locator('#mobileMenu').click()
    mobile.locator('[data-page="disponibilidad"]').first.click()
    mobile.locator('[data-action="toggle-week-slot"]:not([disabled])').nth(4).click()
    check(mobile.evaluate('localStorage.getItem("matchpoint_pending_local_changes_v1")') == '1', 'offline change flag persisted')
    remote_before = github.sha
    mobile.locator('#mobileMenu').click()
    mobile.locator('[data-page="configuracion"]').first.click()
    mobile.locator('#githubToken').fill('github_pat_abc123FAKE')
    mobile.get_by_role('button', name='Conectar y cargar datos de GitHub').click()
    mobile.wait_for_function('document.querySelector("#cloudStatus").textContent.includes("Conflicto")')
    check(github.sha == remote_before, 'reconnect preserves offline edit without remote overwrite')
    mobile.get_by_role('button', name='Sobrescribir GitHub con datos locales').click()
    mobile.wait_for_function('document.querySelector("#cloudStatus").textContent.includes("Sincronizado")')
    check(github.sha != remote_before, 'manual confirmed upload resolves offline conflict')
    check(mobile.evaluate('localStorage.getItem("matchpoint_pending_local_changes_v1")') is None, 'pending local flag cleared after confirmed upload')

    check(not errors, f'errors desktop: {errors}')
    check(not mobile_errors, f'errors mobile: {mobile_errors}')
    mobile.screenshot(path=str(ROOT / 'tests' / 'captura-movil-github.png'), full_page=True)
    browser.close()

print(f'{checks} GitHub adapter browser regressions passed (mock API; no remote publication).')
