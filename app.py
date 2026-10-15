"""CropWise — Flask backend: auth, soil/weather lookup and crop prediction.

Phase 1 hardening (see docs/AUDIT.md): real accounts with hashed passwords, every user route
behind a session check, and a secret key that comes from the environment.
"""
from flask import Flask, render_template, request, session, jsonify, redirect, url_for, flash
import os
import re
import sqlite3
from datetime import datetime
from functools import wraps
import numpy as np
import pandas as pd
import requests
from werkzeug.security import check_password_hash, generate_password_hash

app = Flask(__name__)
# A fixed fallback only makes sense for a throwaway local run; production must set the variable.
app.secret_key = os.environ.get("SECRET_KEY") or os.urandom(32).hex()

# Vercel's filesystem is read-only apart from /tmp, and /tmp is wiped between cold starts, so on
# Vercel accounts live only for the life of the instance. Phase 3 moves this to Postgres.
DB_PATH = os.environ.get("CROPWISE_DB") or ("/tmp/cropwise.db" if os.environ.get("VERCEL") else "cropwise.db")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def login_required(view):
    """Every page that reads or writes a person's data goes through here."""

    @wraps(view)
    def wrapped(*args, **kwargs):
        if "email" not in session:
            if request.path.startswith("/get_") or request.path.startswith("/api/"):
                return jsonify({"success": False, "message": "Please sign in."}), 401
            return redirect(url_for("login"))
        return view(*args, **kwargs)

    return wrapped

def init_db():
    conn = sqlite3.connect(DB_PATH)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            name TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS history(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT NOT NULL,
            crop TEXT NOT NULL,
            confidence REAL NOT NULL,
            nitrogen REAL,
            phosphorus REAL,
            potassium REAL,
            ph REAL,
            temperature REAL,
            humidity REAL,
            rainfall REAL,
            city TEXT,
            created_at TEXT NOT NULL
        )
    """)
    conn.commit()
    conn.close()

init_db()

from predictor import recommend  # the two honest models, their reasons and the outlier check

@app.route('/')
def login():
    if 'email' in session:
        return redirect(url_for('dashboard'))
    return render_template("login.html", error=request.args.get('error'))


@app.route('/login', methods=['POST'])
def login_user():
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    if not EMAIL_RE.match(email) or not password:
        return redirect(url_for('login', error='Enter your email address and password.'))
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    conn.close()
    # One message for both cases, so the form cannot be used to discover who has an account.
    if not row or not check_password_hash(row['password_hash'], password):
        return redirect(url_for('login', error='Those details did not match an account.'))
    session.clear()
    session['email'] = email
    return redirect(url_for('dashboard'))


@app.route('/signup', methods=['GET', 'POST'])
def signup():
    if request.method == 'GET':
        return render_template('signup.html', error=request.args.get('error'))
    name = request.form.get('name', '').strip()
    email = request.form.get('email', '').strip().lower()
    password = request.form.get('password', '')
    if not EMAIL_RE.match(email):
        return redirect(url_for('signup', error='Enter a valid email address.'))
    if len(password) < 8:
        return redirect(url_for('signup', error='Use a password of at least 8 characters.'))
    conn = db()
    if conn.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
        conn.close()
        return redirect(url_for('signup', error='That email already has an account. Sign in instead.'))
    conn.execute(
        "INSERT INTO users(email, password_hash, name, created_at) VALUES(?,?,?,?)",
        (email, generate_password_hash(password, method="pbkdf2:sha256", salt_length=16),
         name or email.split('@')[0],
         datetime.now().isoformat(timespec='seconds')),
    )
    conn.commit()
    conn.close()
    session.clear()
    session['email'] = email
    return redirect(url_for('dashboard'))

@app.route('/dashboard')
@login_required
def dashboard():
    return render_template('dashboard.html',active_page='dashboard')

@app.route('/history')
@login_required
def history():
    conn = db()
    records=conn.execute(
        "SELECT * FROM history WHERE email=? ORDER BY id DESC",
        (session['email'],)
    ).fetchall()
    conn.close()
    return render_template("history.html",records=records,active_page='history')

@app.route('/profile')
@login_required
def profile():
    email=session['email']
    initial=email[0].upper() if email else 'U'
    name=email.split('@')[0].replace('.',' ').replace('_',' ').title()
    conn = db()
    total=conn.execute(
        "SELECT COUNT(*) FROM history WHERE email=?",
        (email,)
    ).fetchone()[0]
    last=conn.execute(
        "SELECT crop,created_at FROM history WHERE email=? ORDER BY id DESC LIMIT 1",
        (email,)
    ).fetchone()
    conn.close()
    return render_template(
        "profile.html",
        email=email,
        initial=initial,
        name=name,
        total=total,
        last=last,
        active_page='profile'
    )

@app.route('/logout')
def logout():
    session.pop('email',None)
    return redirect('/')

@app.route('/soil')
@login_required
def soil():
    return render_template("soil.html",active_page='soil')

@app.route('/climate',methods=['POST'])
@login_required
def climate():
    city=request.form.get('city','').strip()
    session['city']=city
    session['P']=request.form.get('P',40)
    session['K']=request.form.get('K',35)
    session['nitrogen']=request.form.get('nitrogen',1.4)
    session['ph']=request.form.get('ph',6.5)
    session['clay']=request.form.get('clay',25.0)
    session['organic_carbon']=request.form.get('organic_carbon',12.0)
    session['latitude']=request.form.get('latitude',17.3850)
    session['longitude']=request.form.get('longitude',78.4867)
    return render_template("climate.html",locked_city=city)

@app.route('/get_soil_by_city',methods=['POST'])
@login_required
def get_soil_by_city():
    data=request.get_json() or {}
    city=data.get('city','').strip()
    if not city:
        return jsonify({
            "success":False,
            "message":"City name is required."
        }),400
    try:
        geo_response=requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={
                "name":city,
                "count":1,
                "language":"en",
                "format":"json"
            },
            timeout=10
        )
        if geo_response.status_code!=200:
            print("GEOCODING STATUS:",geo_response.status_code)
            print("GEOCODING RESPONSE:",geo_response.text[:500])
            return jsonify({
                "success":False,
                "message":"Unable to find city coordinates."
            }),500
        try:
            geo=geo_response.json()
        except ValueError:
            print("INVALID GEOCODING RESPONSE:",geo_response.text[:500])
            return jsonify({
                "success":False,
                "message":"City API returned invalid data."
            }),500
        results=geo.get("results")
        if not results:
            return jsonify({
                "success":False,
                "message":f"City '{city}' not found."
            }),404
        c=results[0]
        lat=c["latitude"]
        lon=c["longitude"]
        soil_url="https://rest.isric.org/soilgrids/v2.0/properties/query"
        soil_params=[
            ("lat",lat),
            ("lon",lon),
            ("property","nitrogen"),
            ("property","phh2o"),
            ("property","clay"),
            ("property","soc"),
            ("depth","0-5cm"),
            ("value","mean")
        ]
        soil_response=requests.get(
            soil_url,
            params=soil_params,
            timeout=30
        )
        print("\n==============================")
        print("SOILGRIDS STATUS:",soil_response.status_code)
        print("SOILGRIDS RESPONSE:",soil_response.text[:500])
        print("==============================\n")
        if soil_response.status_code!=200:
            return jsonify({
                "success":False,
                "message":"SoilGrids API is currently unavailable. Please try again later."
            }),503
        if not soil_response.text.strip():
            return jsonify({
                "success":False,
                "message":"SoilGrids returned an empty response."
            }),503
        try:
            soil=soil_response.json()
        except ValueError:
            print("INVALID SOILGRIDS RESPONSE:")
            print(soil_response.text[:500])
            return jsonify({
                "success":False,
                "message":"SoilGrids returned an invalid response."
            }),503
        layers={
            x["name"]:x["depths"][0]["values"]["mean"]
            for x in soil.get("properties",{}).get("layers",[])
        }
        nitrogen=round((layers.get("nitrogen") or 140)/100.0,2)
        ph=round((layers.get("phh2o") or 65)/10.0,1)
        clay=round((layers.get("clay") or 250)/10.0,1)
        organic_carbon=round((layers.get("soc") or 120)/10.0,1)
        session['city']=c.get("name",city)
        session['latitude']=lat
        session['longitude']=lon
        session['nitrogen']=nitrogen
        session['ph']=ph
        session['clay']=clay
        session['organic_carbon']=organic_carbon
        return jsonify({
            "success":True,
            "city":c.get("name",city),
            "country":c.get("country",""),
            "latitude":lat,
            "longitude":lon,
            "nitrogen":nitrogen,
            "ph":ph,
            "clay":clay,
            "organic_carbon":organic_carbon
        })
    except requests.exceptions.Timeout:
        return jsonify({
            "success":False,
            "message":"Soil API request timed out. Please try again."
        }),504
    except requests.exceptions.RequestException as e:
        print("REQUEST ERROR:",e)
        return jsonify({
            "success":False,
            "message":"Unable to connect to the soil API."
        }),503
    except Exception as e:
        print("GENERAL API ERROR:",e)
        return jsonify({
            "success":False,
            "message":f"API Error: {str(e)}"
        }),500

@app.route('/get_weather_by_city',methods=['POST'])
@login_required
def get_weather_by_city():
    data=request.get_json() or {}
    city=data.get('city','').strip()
    days=int(data.get('range',30))
    session_city=session.get('city','').strip()
    if session_city and city.lower()!=session_city.lower():
        return jsonify({
            "success":False,
            "message":f"City mismatch! You selected '{session_city}' on the soil page."
        }),400
    if not city:
        return jsonify({
            "success":False,
            "message":"Please enter a city name."
        }),400
    try:
        geo_response=requests.get(
            "https://geocoding-api.open-meteo.com/v1/search",
            params={"name":city,"count":1},
            timeout=5
        )
        geo=geo_response.json()
        results=geo.get("results")
        if not results:
            return jsonify({
                "success":False,
                "message":f"City '{city}' not found."
            }),404
        c=results[0]
        past=max(0,days-1)
        weather_response=requests.get(
            "https://api.open-meteo.com/v1/forecast",
            params={
                "latitude":c["latitude"],
                "longitude":c["longitude"],
                "current":"relative_humidity_2m",
                "daily":"temperature_2m_mean,precipitation_sum",
                "past_days":past,
                "forecast_days":1,
                "timezone":"auto"
            },
            timeout=5
        )
        weather=weather_response.json()
        daily=weather.get("daily",{})
        temps=[
            x for x in daily.get("temperature_2m_mean",[])
            if x is not None
        ]
        rain=[
            x for x in daily.get("precipitation_sum",[])
            if x is not None
        ]
        temp = round(float(np.mean(temps)), 2) if temps else 25.0
        # Accumulated rainfall over the window the farmer chose, scaled to the 30-day basis the
        # training data uses, and nothing else. The old code multiplied by 3 with a floor of 50 mm
        # to force Open-Meteo totals into the dataset's range; that was invented. See docs/DECISIONS.md.
        days_counted = max(1, len(rain))
        rainfall = round(float(np.sum(rain)) * (30.0 / days_counted), 2) if rain else 0.0
        humidity=weather.get("current",{}).get(
            "relative_humidity_2m",
            70.0
        )
        session['temperature']=temp
        session['humidity']=humidity
        session['rainfall']=rainfall
        return jsonify({
            "success":True,
            "city":c.get("name",""),
            "country":c.get("country",""),
            "temperature":temp,
            "humidity":humidity,
            "rainfall": rainfall,
            # Phosphorus and potassium are not published by SoilGrids and are no longer guessed.
            "phosphorus": None,
            "potassium": None,
            "nutrient_note": "Phosphorus and potassium need a soil test. Upload your Soil Health Card to use them."
        })
    except Exception as e:
        return jsonify({
            "success":False,
            "message":str(e)
        }),500

@app.route('/predict', methods=['POST'])
@login_required
def predict():
    """Top three crops for this session's readings, with reasons and an unusual-readings flag."""
    readings = {
        'nitrogen': float(session.get('nitrogen', 1.4)),
        'ph': float(session.get('ph', 6.5)),
        'clay': float(session.get('clay', 25.0)),
        'organic_carbon': float(session.get('organic_carbon', 12.0)),
        'temperature': float(request.form['temperature']),
        'humidity': float(request.form['humidity']),
        'rainfall': float(request.form['rainfall']),
    }
    # The lab model only runs when a soil test supplied real P and K (Soil Health Card, phase 7).
    lab_p, lab_k, lab_n = session.get('lab_P'), session.get('lab_K'), session.get('lab_N')
    if lab_p is not None and lab_k is not None and lab_n is not None:
        result = recommend(
            {
                'N': float(lab_n), 'P': float(lab_p), 'K': float(lab_k),
                'temperature': readings['temperature'], 'humidity': readings['humidity'],
                'ph': readings['ph'], 'rainfall': readings['rainfall'],
            },
            source='lab',
        )
    else:
        result = recommend(readings, source='field')

    best = result['crops'][0]
    conn = db()
    conn.execute("""
        INSERT INTO history(
            email, crop, confidence, nitrogen, phosphorus, potassium,
            ph, temperature, humidity, rainfall, city, created_at
        )
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?)
    """, (
        session.get("email", ""),
        best['crop'],
        best['confidence'],
        readings['nitrogen'],
        lab_p,
        lab_k,
        readings['ph'],
        readings['temperature'],
        readings['humidity'],
        readings['rainfall'],
        session.get("city", ""),
        datetime.now().strftime("%d-%m-%Y %I:%M %p"),
    ))
    conn.commit()
    conn.close()

    soil_data = {
        "N": readings['nitrogen'],
        "P": lab_p,
        "K": lab_k,
        "ph": readings['ph'],
        "temperature": readings['temperature'],
        "humidity": readings['humidity'],
        "rainfall": readings['rainfall'],
    }
    return render_template(
        "result.html",
        top3=[(c['crop'], c['confidence']) for c in result['crops']],
        crops=result['crops'],
        unusual=result['unusual_readings'],
        measured=result['source'] == 'lab',
        soil_data=soil_data,
        active_page='results',
    )


@app.route('/settings')
@login_required
def settings():
    """Account and language preferences. Phase 1: the few settings that already exist."""
    return render_template('settings.html', email=session['email'], active_page='settings')


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=False)
    app.run(debug=True)