"""
app.py - Backend Flask para la App de Rutinas de Gimnasio
-----------------------------------------------------------
NOTA IMPORTANTE SOBRE LA ARQUITECTURA:
- La autenticación (login/registro/Google) y la base de datos de usuarios
  (perfil, rutina asignada, progresión) se manejan 100% desde el FRONTEND
  con el SDK de Firebase (Firebase Auth + Firestore), directamente en el
  navegador. Esto es clave para que el hosting sea gratuito: no necesitamos
  un servidor con base de datos propia.
- Flask aquí cumple dos roles:
    1) Servir las páginas HTML/CSS/JS (frontend).
    2) Exponer una API REST muy simple para servir el catálogo de ejercicios
       desde un archivo JSON local (data/ejercicios.json). Esto evita tener
       que subir manualmente 12+ documentos a Firestore para empezar a
       testear. Más adelante puedes migrar este catálogo a Firestore si
       quieres editarlo desde la nube.

Cómo correrlo en local:
    pip install flask
    python app.py
    Abre http://127.0.0.1:5000
"""

from flask import Flask, jsonify, render_template, abort
import json
import os

app = Flask(__name__)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "ejercicios.json")


def cargar_ejercicios():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


# ---------- RUTAS DE PÁGINAS (FRONTEND) ----------

@app.route("/")
def index():
    """Página de login / registro."""
    return render_template("index.html")


@app.route("/onboarding")
def onboarding():
    """Cuestionario de perfilamiento (primer ingreso)."""
    return render_template("onboarding.html")


@app.route("/dashboard")
def dashboard():
    """Rutina semanal asignada + registro de progresión."""
    return render_template("dashboard.html")


# ---------- API DE EJERCICIOS ----------

@app.route("/api/ejercicios", methods=["GET"])
def get_ejercicios():
    """Devuelve el catálogo completo de ejercicios."""
    try:
        ejercicios = cargar_ejercicios()
        return jsonify(ejercicios)
    except FileNotFoundError:
        abort(404, description="No se encontró el archivo de ejercicios.")


@app.route("/api/ejercicios/<grupo_muscular>", methods=["GET"])
def get_ejercicios_por_grupo(grupo_muscular):
    """Devuelve los ejercicios filtrados por grupo muscular.
    Útil para el modal de 'Cambiar ejercicio'.
    """
    ejercicios = cargar_ejercicios()
    filtrados = [
        e for e in ejercicios
        if e["grupo_muscular"].lower() == grupo_muscular.lower()
    ]
    return jsonify(filtrados)


if __name__ == "__main__":
    # debug=True solo para desarrollo local
    app.run(debug=True, port=5000)
