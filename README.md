# GymApp — Generador de Rutinas de Gimnasio (100% Gratis de alojar)

## 1. Estructura del proyecto

```
gym-app/
├── app.py                     # Backend Flask (sirve páginas + API de ejercicios)
├── data/
│   └── ejercicios.json        # Catálogo de ejercicios (2 por grupo muscular)
├── templates/
│   ├── index.html             # Login / Registro
│   ├── onboarding.html         # Cuestionario de perfilamiento
│   └── dashboard.html         # Rutina semanal + progresión
├── static/
│   ├── css/style.css
│   └── js/
│       ├── firebase-config.js  # ⚠️ Aquí pegas tus credenciales de Firebase
│       ├── auth.js
│       ├── onboarding.js
│       └── dashboard.js
└── requirements.txt
```

## 2. Cómo funciona la arquitectura (y por qué es gratis)

- **Flask** solo sirve archivos estáticos/HTML y un mini API de solo lectura
  para el catálogo de ejercicios (`/api/ejercicios`). No usa base de datos
  propia ni sesiones de servidor.
- **Firebase Auth** maneja registro/login (email+contraseña y Google) desde
  el navegador, usando el plan gratuito "Spark".
- **Firestore** (también plan gratuito) guarda: el perfil del usuario, su
  rutina semanal generada, y el historial de pesos levantados.
- Como no hay servidor con estado ni base de datos paga, puedes alojar:
  - El backend Flask en **Render.com** (free tier) o **PythonAnywhere** (free tier).
  - Firebase Auth + Firestore en el plan **Spark** (gratis, con límites
    generosos para una app personal: 50k lecturas/día, 20k escrituras/día).

## 3. Paso a paso: crear y configurar Firebase

1. Ve a https://console.firebase.google.com y crea un proyecto nuevo
   (botón "Agregar proyecto"). No necesitas activar Google Analytics.
2. En el menú lateral entra a **Compilación > Authentication** → pestaña
   "Sign-in method" → habilita:
   - **Correo electrónico/contraseña**
   - **Google**
3. En el menú lateral entra a **Compilación > Firestore Database** → "Crear
   base de datos" → elige modo de **producción** y la región más cercana.
4. Configura las reglas de seguridad de Firestore (pestaña "Reglas") para
   que cada usuario solo pueda leer/escribir su propio documento:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /usuarios/{userId} {
         allow read, write: if request.auth != null && request.auth.uid == userId;
         match /progreso/{docId} {
           allow read, write: if request.auth != null && request.auth.uid == userId;
         }
       }
     }
   }
   ```

5. Ve a **Configuración del proyecto** (ícono de engranaje arriba a la
   izquierda) → pestaña "General" → sección "Tus apps" → clic en el ícono
   `</>` (Web) para registrar una nueva app web. Ponle un nombre (ej.
   "GymApp Web") y NO marques Firebase Hosting (no lo necesitamos).
6. Firebase te mostrará un objeto `firebaseConfig` con: `apiKey`,
   `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`.
   Copia esos valores y pégalos en `static/js/firebase-config.js`,
   reemplazando los placeholders `TU_API_KEY`, etc.
7. Si usas login con Google, en **Authentication > Sign-in method > Google**
   asegúrate de agregar tu dominio (en local: `localhost`, ya viene
   habilitado por defecto; al desplegar, agrega el dominio de Render/PA en
   "Dominios autorizados").

## 4. Cómo ejecutar la app en local

```bash
# 1. Clona/crea la carpeta del proyecto con los archivos generados
cd gym-app

# 2. Crea un entorno virtual (opcional pero recomendado)
python -m venv venv
source venv/bin/activate   # En Windows: venv\Scripts\activate

# 3. Instala dependencias
pip install -r requirements.txt

# 4. Asegúrate de haber pegado tus credenciales en
#    static/js/firebase-config.js (paso 6 de arriba)

# 5. Corre el servidor
python app.py

# 6. Abre en el navegador
http://127.0.0.1:5000
```

## 5. Flujo de uso

1. El usuario se registra o inicia sesión (email/contraseña o Google).
2. Si es su primer ingreso, se le redirige al cuestionario (`/onboarding`):
   nivel, días disponibles, enfoque.
3. Al enviar el cuestionario, el JS genera una rutina semanal combinando
   un "split" simple (según los días) con el catálogo de ejercicios, y la
   guarda en Firestore (`usuarios/{uid}.rutina`).
4. En `/dashboard` el usuario ve su rutina por día, puede:
   - Pulsar **"Cambiar ejercicio"** → se abre un modal con otras opciones
     del mismo grupo muscular (consultadas vía `/api/ejercicios/<grupo>`).
   - Ingresar el peso levantado y pulsar **"Guardar"** → se actualiza el
     peso actual del ejercicio y se agrega un registro histórico en la
     subcolección `progreso`.
   - Ver una gráfica de evolución de peso por ejercicio (Chart.js).

## 6. Desplegar gratis (resumen)

**Backend (Render.com, free tier):**
1. Sube el proyecto a un repo de GitHub.
2. En Render: "New Web Service" → conecta el repo.
3. Build command: `pip install -r requirements.txt`
4. Start command: `gunicorn app:app` (agrega `gunicorn` a requirements.txt)
5. Despliega. Render te da una URL pública gratis (se "duerme" tras
   inactividad en el free tier, lo cual es aceptable para un proyecto
   personal).

**Firebase:** no necesita despliegue adicional, ya vive en la nube de
Google en el plan gratuito Spark.

## 7. Próximos pasos sugeridos

- Migrar `ejercicios.json` a una colección de Firestore para poder editar
  el catálogo sin tocar código.
- Agregar más ejercicios por grupo muscular.
- Agregar lógica de "deload"/progresión automática de peso sugerido.
