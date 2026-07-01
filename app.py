"""
app.py - Backend Flask para la App de Rutinas de Gimnasio
-----------------------------------------------------------
ARQUITECTURA:
- Auth normal y Firestore (perfil, rutina, progreso) se manejan desde el
  FRONTEND con el SDK cliente de Firebase. Flask sirve HTML/CSS/JS y el
  catálogo de ejercicios (data/ejercicios.json) vía API.
- El panel de ADMINISTRADOR (altas/bajas/reset de contraseña/edición de
  cualquier usuario) SÍ necesita pasar por el backend, porque esas acciones
  requieren privilegios de servidor que el SDK cliente no tiene. Para esto
  usamos firebase-admin con una Service Account.

CÓMO CONFIGURAR LA SERVICE ACCOUNT (necesario para que /api/admin funcione):
  1. Firebase Console -> Configuración del proyecto -> Cuentas de servicio
  2. "Generar nueva clave privada" -> se descarga un .json
  3. Local: guardalo como gym-app/serviceAccountKey.json (¡está en .gitignore,
     NUNCA lo subas a GitHub!)
  4. En Render: NO subas el archivo. En su lugar, copiá todo el contenido del
     .json y pegalo como variable de entorno FIREBASE_SERVICE_ACCOUNT_JSON
     (Render -> tu servicio -> Environment -> Add Environment Variable).

Cómo correrlo en local:
    pip install -r requirements.txt
    python app.py
    Abre http://127.0.0.1:5000
"""

from flask import Flask, jsonify, render_template, abort, request
import json
import os

app = Flask(__name__)

DATA_PATH = os.path.join(os.path.dirname(__file__), "data", "ejercicios.json")
SERVICE_ACCOUNT_PATH = os.path.join(os.path.dirname(__file__), "serviceAccountKey.json")

# Correo de la cuenta administradora. Solo este correo puede usar /api/admin/*
ADMIN_EMAIL = "ernestoarevalo@gmail.com"

# ---------- INICIALIZACIÓN DE FIREBASE ADMIN (para el panel de admin) ----------
firebase_admin_disponible = False
try:
    import firebase_admin
    from firebase_admin import credentials, auth as fb_auth, firestore as fb_firestore

    if not firebase_admin._apps:
        cred = None
        env_json = os.environ.get("FIREBASE_SERVICE_ACCOUNT_JSON")
        if env_json:
            cred = credentials.Certificate(json.loads(env_json))
        elif os.path.exists(SERVICE_ACCOUNT_PATH):
            cred = credentials.Certificate(SERVICE_ACCOUNT_PATH)

        if cred:
            firebase_admin.initialize_app(cred)
            firebase_admin_disponible = True
except Exception as e:  # pragma: no cover
    print("Firebase Admin no se pudo inicializar:", e)


def cargar_ejercicios():
    with open(DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def verificar_admin():
    """Verifica el token de Firebase enviado en el header Authorization
    y confirma que pertenece a la cuenta administradora. Aborta si no."""
    if not firebase_admin_disponible:
        abort(503, description="El panel de administrador no está configurado en el servidor (falta la Service Account).")

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        abort(401, description="Falta el token de autenticación.")

    token = auth_header.split(" ", 1)[1]
    try:
        decoded = fb_auth.verify_id_token(token)
    except Exception:
        abort(401, description="Token inválido o expirado.")

    if decoded.get("email") != ADMIN_EMAIL:
        abort(403, description="No tenés permisos de administrador.")

    return decoded


# ---------- RUTAS DE PÁGINAS (FRONTEND) ----------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/completar-perfil")
def completar_perfil():
    """Datos faltantes cuando alguien entra por primera vez con Google."""
    return render_template("completar_perfil.html")


@app.route("/onboarding")
def onboarding():
    return render_template("onboarding.html")


@app.route("/dashboard")
def dashboard():
    return render_template("dashboard.html")


@app.route("/perfil")
def perfil():
    return render_template("perfil.html")


@app.route("/disclaimers")
def disclaimers():
    return render_template("disclaimers.html")


@app.route("/armar-rutina")
def armar_rutina():
    return render_template("armar_rutina.html")


@app.route("/admin")
def admin_panel():
    """Panel de administrador. El control real de acceso ocurre en el
    backend (verificar_admin) y en el frontend (admin.js verifica el email)."""
    return render_template("admin.html", admin_email=ADMIN_EMAIL)


# ---------- API DE EJERCICIOS ----------

TROFEOS_PATH = os.path.join(os.path.dirname(__file__), "data", "trofeos.json")
TIENDA_PATH  = os.path.join(os.path.dirname(__file__), "data", "tienda.json")


def cargar_trofeos():
    with open(TROFEOS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def cargar_tienda():
    with open(TIENDA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


@app.route("/api/trofeos", methods=["GET"])
def get_trofeos():
    return jsonify(cargar_trofeos())


@app.route("/api/tienda", methods=["GET"])
def get_tienda():
    return jsonify(cargar_tienda())


@app.route("/tienda")
def tienda():
    return render_template("tienda.html")


@app.route("/avatar")
def avatar_page():
    return render_template("avatar.html")


@app.route("/trofeos")
def trofeos_page():
    return render_template("trofeos.html")


@app.route("/api/ejercicios", methods=["GET"])
def get_ejercicios():
    try:
        return jsonify(cargar_ejercicios())
    except FileNotFoundError:
        abort(404, description="No se encontró el archivo de ejercicios.")


@app.route("/api/ejercicios/<grupo_muscular>", methods=["GET"])
def get_ejercicios_por_grupo(grupo_muscular):
    ejercicios = cargar_ejercicios()
    filtrados = [e for e in ejercicios if e["grupo_muscular"].lower() == grupo_muscular.lower()]
    return jsonify(filtrados)


# ---------- API DE ADMINISTRACIÓN (requiere token + email admin) ----------

@app.route("/api/admin/usuarios", methods=["GET"])
def admin_listar_usuarios():
    verificar_admin()
    db = fb_firestore.client()
    docs = db.collection("usuarios").stream()

    usuarios = []
    for doc in docs:
        data = doc.to_dict() or {}
        data["uid"] = doc.id
        try:
            auth_user = fb_auth.get_user(doc.id)
            data["auth_disabled"] = auth_user.disabled
            data["auth_email"] = auth_user.email
        except Exception:
            data["auth_disabled"] = None
            data["auth_email"] = data.get("email")
        usuarios.append(data)

    return jsonify(usuarios)


@app.route("/api/admin/usuarios/<uid>", methods=["PUT"])
def admin_editar_usuario(uid):
    verificar_admin()
    body = request.get_json(force=True) or {}
    db = fb_firestore.client()

    campos_permitidos = {"nombre", "username", "email", "perfil", "fecha_nacimiento", "foto_url"}
    actualizacion = {k: v for k, v in body.items() if k in campos_permitidos}

    if actualizacion:
        db.collection("usuarios").document(uid).set(actualizacion, merge=True)

    # Si cambia el email, también lo actualizamos en Firebase Auth
    if "email" in actualizacion:
        try:
            fb_auth.update_user(uid, email=actualizacion["email"])
        except Exception as e:
            return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify({"ok": True})


@app.route("/api/admin/usuarios/<uid>/reset-password", methods=["POST"])
def admin_resetear_password(uid):
    verificar_admin()
    body = request.get_json(force=True) or {}
    nueva_password = body.get("password")

    if not nueva_password or len(nueva_password) < 6:
        abort(400, description="La nueva contraseña debe tener al menos 6 caracteres.")

    try:
        fb_auth.update_user(uid, password=nueva_password)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify({"ok": True})


@app.route("/api/admin/usuarios/<uid>/toggle-disabled", methods=["POST"])
def admin_toggle_disabled(uid):
    verificar_admin()
    try:
        user = fb_auth.get_user(uid)
        fb_auth.update_user(uid, disabled=not user.disabled)
        nuevo_estado = not user.disabled
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify({"ok": True, "disabled": nuevo_estado})


@app.route("/api/admin/usuarios", methods=["POST"])
def admin_crear_usuario():
    verificar_admin()
    body = request.get_json(force=True) or {}
    email = body.get("email")
    password = body.get("password")
    nombre = body.get("nombre", "")
    username = (body.get("username") or "").strip().lower()

    if not email or not password or not username:
        abort(400, description="Faltan datos obligatorios (email, password, username).")

    db = fb_firestore.client()

    if db.collection("usernames").document(username).get().exists:
        abort(400, description="Ese nombre de usuario ya está en uso.")

    try:
        nuevo_usuario = fb_auth.create_user(email=email, password=password, display_name=nombre)
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    db.collection("usuarios").document(nuevo_usuario.uid).set({
        "nombre": nombre,
        "username": username,
        "email": email,
        "disclaimers_aceptados": False,
        "creado_por_admin": True
    })
    db.collection("usernames").document(username).set({"uid": nuevo_usuario.uid, "email": email})

    return jsonify({"ok": True, "uid": nuevo_usuario.uid})


@app.route("/api/admin/usuarios/<uid>", methods=["DELETE"])
def admin_eliminar_usuario(uid):
    verificar_admin()
    db = fb_firestore.client()

    try:
        doc = db.collection("usuarios").document(uid).get()
        username = (doc.to_dict() or {}).get("username") if doc.exists else None

        fb_auth.delete_user(uid)
        db.collection("usuarios").document(uid).delete()
        if username:
            db.collection("usernames").document(username).delete()
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 400

    return jsonify({"ok": True})


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host="0.0.0.0", port=port)
