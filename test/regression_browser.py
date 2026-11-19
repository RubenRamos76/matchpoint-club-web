"""Optional QA regression for Matchpoint Club 2.1.
Requires local Python with playwright and a Chromium browser.
Runs without network, and makes no Playtomic requests.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json

ROOT = Path(__file__).resolve().parent.parent
HTML = (ROOT / 'index.html').read_text(encoding='utf-8').replace('<link rel="stylesheet" href="assets/style.css">', '').replace('<script src="assets/app.js" defer></script>', '').replace('<script src="assets/github-sync.js" defer></script>', '')
HTML = __import__('re').sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', HTML)
CSS = (ROOT / 'assets/style.css').read_text(encoding='utf-8')
JS = (ROOT / 'assets/app.js').read_text(encoding='utf-8')
KEY = 'matchpoint_demo_local_v1'
CHECKS = 0


def ok(condition, message):
    global CHECKS
    assert condition, message
    CHECKS += 1


def load(page, prior=None):
    page.set_content(HTML)
    page.evaluate("""stored => {
      const map = stored || {};
      Object.defineProperty(window, 'localStorage', {configurable:true, value: {
        getItem(k) { return Object.prototype.hasOwnProperty.call(map,k) ? map[k] : null; },
        setItem(k,v) { map[k]=String(v); },
        removeItem(k) { delete map[k]; },
      }});
      window.__getDemoState = () => JSON.parse(map['matchpoint_demo_local_v1']);
    }""", prior or {})
    page.add_style_tag(content=CSS)
    page.add_script_tag(content=JS)


def jsstate(page):
    return page.evaluate('window.__getDemoState()')


def local_yesterday(page):
    return page.evaluate("""() => {let d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-1);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}""")


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1520, 'height': 940}, locale='es-ES')
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    load(page)
    state = jsstate(page)
    ok(state['schema'] == 2, 'new data schema')
    ok(len(state['players']) == 24, 'seed player count')
    ok(len(state['matches']) == 5, 'seed with historical matches')
    ok(all('weekAvailability' in p for p in state['players']), 'weekly records')
    ok(all('baseLevel' in p for p in state['players']), 'base rating')
    ok(any(m['status']=='finalizado' for m in state['matches']), 'example scored match')
    initial_rating = next(p for p in state['players'] if p['id']=='p1')['level']
    ok(initial_rating > 3.2, 'winner rating increased from historical match')

    # Player listing: date of latest local play and two distinct badges.
    page.locator('[data-page="jugadores"]').first.click()
    ok(page.locator('#playersBody tr[data-player-id]').count() == 24, 'player table')
    ok(page.locator('#playersBody tr[data-player-id="p1"] .last-played').count() == 1, 'last played prominent')
    ok(page.locator('#playersBody tr[data-player-id="p1"] .activity-pill.active').count() == 1, 'club 48h')
    ok(page.locator('#playersBody tr[data-player-id="p5"] .activity-pill.active').count() == 0, 'older than 48h')
    ok(page.locator('#playersBody tr[data-player-id="p1"] .activity-pill.unknown').count() == 1, 'no Playtomic data not falsely marked absent')
    ok(page.get_by_text('Última vez en el club').count() >= 1, 'visible column')

    # Edit favorite for a particular weekday, not only today/tomorrow.
    page.locator('[data-action="edit-player"][data-id="p1"]').click()
    ok(page.locator('input[name^="av_"]').count() == 28, 'seven-day availability')
    ok(page.locator('input[name^="fav_"]').count() == 28, 'seven-day favorite')
    page.locator('input[name="fav_lun"][value="16:30"]').check(force=True)
    page.get_by_role('button', name='Guardar ficha').click()
    state=jsstate(page)
    p1=next(p for p in state['players'] if p['id']=='p1')
    ok('16:30' in p1['weekAvailability']['lun']['favorite'], 'favorite saved Monday')
    ok('16:30' in p1['weekAvailability']['lun']['available'], 'favorite auto-adds available')

    # Register a match, assert level recalculation & idempotence.
    page.locator('[data-page="partidos"]').first.click()
    page.locator('[data-action="score-match"][data-id="m1"]').click()
    ok(page.get_by_text('Registrar resultado del partido').count() == 1, 'result modal')
    # Empty on new record; never silently save an invented score.
    ok(page.locator('[name="set_0_0"]').input_value() == '', 'score starts blank')
    page.locator('#playedDate').fill(local_yesterday(page))
    page.locator('#playedTime').fill('18:00')
    page.locator('[name="set_0_0"]').fill('6')
    page.locator('[name="set_0_1"]').fill('6')
    page.locator('[name="set_1_0"]').fill('6')
    page.locator('[name="set_1_1"]').fill('2')
    page.get_by_role('button', name='Guardar resultado y recalcular nivel').click()
    ok(page.get_by_text('El set 1 no tiene un marcador válido').count() == 1, 'invalid set rejected')
    page.locator('[name="set_0_1"]').fill('4')
    page.get_by_role('button', name='Guardar resultado y recalcular nivel').click()
    state=jsstate(page)
    ok(next(m for m in state['matches'] if m['id']=='m1')['status']=='finalizado', 'result stored')
    new_rating=next(p for p in state['players'] if p['id']=='p1')['level']
    ok(new_rating > initial_rating, 'additional win raises rating')
    ok(next(p for p in state['players'] if p['id']=='p3')['level'] < 3.18, 'loss lowers rating')
    ok(page.locator('[data-action="match-day"].active').inner_text()=='Finalizados', 'finalized tab selected')

    # Edit same result (must not double-apply).
    page.locator('[data-action="score-match"][data-id="m1"]').click()
    page.get_by_role('button',name='Actualizar resultado').click()
    state=jsstate(page)
    same_rating=next(p for p in state['players'] if p['id']=='p1')['level']
    ok(same_rating == new_rating, 'same result is idempotent')

    # Undo result and ensure the previous historical result remains.
    page.on('dialog', lambda dialog: dialog.accept())
    page.locator('[data-action="remove-result"][data-id="m1"]').click()
    state=jsstate(page)
    ok(next(m for m in state['matches'] if m['id']=='m1')['status']=='confirmado', 'result removed')
    ok(next(p for p in state['players'] if p['id']=='p1')['level'] == initial_rating, 'rating restored')
    ok(next(m for m in state['matches'] if m['id']=='m1').get('result') is None, 'score removed')

    # Simulated other club activity must remain explicitly labeled demo.
    page.locator('[data-page="jugadores"]').first.click()
    page.locator('[data-action="edit-player"][data-id="p1"]').click()
    page.locator('#externalLastAt').fill(local_yesterday(page)+'T19:30')
    page.get_by_role('button',name='Guardar ficha').click()
    ok(page.locator('#playersBody tr[data-player-id="p1"] .activity-pill.demo').count()==1, 'external activity clearly demo')
    ok('demo' in next(p for p in jsstate(page)['players'] if p['id']=='p1')['externalSource'], 'demo source persisted')

    # Old v1 localStorage migration and preservation of players, matches, bookings.
    saved=jsstate(page)
    old=json.loads(json.dumps(saved))
    old['schema']=1
    old['matches']=old['matches'][:3]
    old['players'][0].pop('weekAvailability',None)
    old['players'][0].pop('baseLevel',None)
    old['players'][0]['availability']={'hoy':['18:00','21:00'],'manana':['16:30']}
    other=browser.new_page(viewport={'width':900,'height':700})
    other_errors=[]
    other.on('pageerror',lambda e:other_errors.append(str(e)))
    load(other, {KEY:json.dumps(old)})
    restored=jsstate(other)
    ok(restored['schema']==2, 'schema migrated')
    ok(len(restored['players'])==len(old['players']), 'players preserved')
    ok(len(restored['matches'])==len(old['matches']), 'matches preserved')
    ok(len(restored['reservations'])==len(old['reservations']), 'reservations preserved')
    weekkey=other.evaluate("""() => {const d=new Date(), keys=['dom','lun','mar','mie','jue','vie','sab'];return keys[d.getDay()]}""")
    ok('21:00' in restored['players'][0]['weekAvailability'][weekkey]['available'], 'today slots migrated')
    ok(not other_errors, f'migration js errors: {other_errors}')

    # Import an exported v2.0 copy even when the directory / browser changed.
    page.locator('[data-page="configuracion"]').first.click()
    page.locator('#importDemoFile').set_input_files({
        'name': 'matchpoint-v2-backup.json', 'mimeType': 'application/json', 'buffer': json.dumps(old).encode('utf-8')
    })
    page.wait_for_function('window.__getDemoState().matches.length === 3')
    imported=jsstate(page)
    ok(imported['schema']==2, 'import migrates schema')
    ok(len(imported['players'])==len(old['players']), 'import preserves players')
    ok(len(imported['reservations'])==len(old['reservations']), 'import preserves reservations')

    # Mobile: user can reach the same date and two markers without a desktop.
    mobile=browser.new_page(viewport={'width':390,'height':844},locale='es-ES')
    mobile_errors=[]
    mobile.on('pageerror',lambda e:mobile_errors.append(str(e)))
    load(mobile)
    mobile.locator('#mobileMenu').click()
    mobile.locator('[data-page="jugadores"]').first.click()
    ok(mobile.locator('#playersBody tr[data-player-id="p1"] .player-summary small').count()==1, 'last played under player name on mobile')
    ok(mobile.locator('#playersBody tr[data-player-id="p1"] .activity-pill.active').count()==1, 'recent local activity visible on mobile')
    mobile.wait_for_timeout(350) # finish sidebar closing animation
    mobile.screenshot(path=str(ROOT.parent/'matchpoint_players_mobile_2.1.png'),full_page=True)
    ok(not mobile_errors, f'mobile JS errors: {mobile_errors}')
    ok(not errors, f'js errors: {errors}')
    browser.close()

print(f'{CHECKS} browser regressions passed')
