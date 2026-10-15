"""Phase 1 smoke test: auth gates, signup, login, dead links."""
import os, sys
os.environ['SECRET_KEY'] = 'test-key'
os.environ['CROPWISE_DB'] = '/tmp/cropwise_test.db'
if os.path.exists('/tmp/cropwise_test.db'): os.remove('/tmp/cropwise_test.db')
sys.path.insert(0, '.')
import app as A
A.app.config['TESTING'] = True
c = A.app.test_client()

fails = []
def check(name, cond, extra=''):
    print(('PASS  ' if cond else 'FAIL  ') + name + ('' if cond else f'  <- {extra}'))
    if not cond: fails.append(name)

# 1. every user route redirects when signed out
for path in ['/dashboard', '/soil', '/history', '/profile', '/settings']:
    r = c.get(path)
    check(f'signed out {path} -> login', r.status_code == 302 and '/' in r.headers.get('location',''), r.status_code)
for path, data in [('/climate', {}), ('/predict', {})]:
    r = c.post(path, data=data)
    check(f'signed out POST {path} blocked', r.status_code == 302, r.status_code)
for path in ['/get_soil_by_city', '/get_weather_by_city']:
    r = c.post(path, json={'city': 'Hyderabad'})
    check(f'signed out {path} -> 401', r.status_code == 401, r.status_code)

# 2. the old backdoor is gone
r = c.post('/login', data={'email': 'anyone@gmail.com', 'password': 'x'}, follow_redirects=False)
check('unknown gmail cannot sign in', '/dashboard' not in r.headers.get('location', ''), r.headers.get('location'))

# 3. signup works, and is not gmail-only
r = c.post('/signup', data={'name': 'Jiya', 'email': 'jiya@outlook.com', 'password': 'farming123'})
check('signup non-gmail works', r.status_code == 302 and 'dashboard' in r.headers.get('location',''), r.headers.get('location'))
r = c.get('/dashboard')
check('dashboard reachable after signup', r.status_code == 200, r.status_code)

# 4. password is hashed, not stored
import sqlite3
row = sqlite3.connect('/tmp/cropwise_test.db').execute("SELECT password_hash FROM users").fetchone()[0]
check('password stored hashed', 'farming123' not in row and len(row) > 40, row[:20])

# 5. short password rejected, duplicate rejected
c.get('/logout')
r = c.post('/signup', data={'name':'x','email':'short@x.com','password':'123'})
check('short password rejected', 'error' in r.headers.get('location',''), r.headers.get('location'))
r = c.post('/signup', data={'name':'x','email':'jiya@outlook.com','password':'farming123'})
check('duplicate email rejected', 'error' in r.headers.get('location',''), r.headers.get('location'))

# 6. login with the real password
r = c.post('/login', data={'email':'jiya@outlook.com','password':'farming123'})
check('login with correct password', 'dashboard' in r.headers.get('location',''), r.headers.get('location'))
r = c.post('/login', data={'email':'jiya@outlook.com','password':'wrong'})
check('login with wrong password refused', 'error' in r.headers.get('location',''), r.headers.get('location'))

# 7. no dead links left in rendered pages
c.post('/login', data={'email':'jiya@outlook.com','password':'farming123'})
for path in ['/dashboard', '/soil', '/history', '/profile', '/settings']:
    html = c.get(path).get_data(as_text=True)
    check(f'no href="#" on {path}', 'href="#"' not in html)
c.get('/logout')
html = c.get('/').get_data(as_text=True)
check('signup link on login page', '/signup' in html)
check('gmail-only pattern removed', 'gmail' not in html.lower())
html = c.get('/signup').get_data(as_text=True)
check('signup page renders', 'CREATE ACCOUNT' in html)

print('\n' + ('ALL PASS' if not fails else f'{len(fails)} FAILED: {fails}'))
sys.exit(1 if fails else 0)
