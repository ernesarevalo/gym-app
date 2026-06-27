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
   que cada usuario solo pueda leer/escribir su propio documento, y que la
   colección `usernames` (usada para poder loguearse con nombre de usuario)
   sea de lectura pública pero solo el propio usuario pueda crear su entrada:

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
       match /usernames/{username} {
         allow read: if true;
         allow create: if request.auth != null && request.resource.data.uid == request.auth.uid;
         allow update, delete: if request.auth != null && resource.data.uid == request.auth.uid;
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

## 8. Novedades: login flexible, perfil, rutina personalizada y disclaimers

- **Login flexible**: en `/` ahora se puede iniciar sesión con correo+contraseña, **nombre de usuario**+contraseña, o Google. El registro pide nombre, nombre de usuario (único) y correo. La colección `usernames` mapea usuario → uid/email.
- **`/disclaimers`**: aviso médico, política de privacidad y términos de uso. Se firma obligatoriamente la primera vez que se ingresa (checkbox + botón "Aceptar y continuar", que guarda `disclaimers_aceptados: true` en Firestore). Se puede volver a consultar después desde el perfil, en modo solo lectura.
- **`/perfil`**: accesible clickeando "Mi perfil" en el navbar del dashboard. Permite editar nombre, ver usuario/correo (no editables), y cambiar nivel/días/enfoque. También da acceso directo a "Armar mi rutina", a generar una rutina automática nueva, y a los disclaimers.
- **`/armar-rutina`**: armador manual de rutina. Por cada día elegís grupo muscular → ejercicio → series/repeticiones (con presets de Fuerza/Hipertrofia/Resistencia explicados, o números personalizados que se autoclasifican). Al elegir un ejercicio, la app muestra qué grupo entrena y sugiere ejercicios complementarios para ese mismo día con el motivo. También avisa si el día tiene demasiados ejercicios, demasiado volumen de un mismo grupo muscular, o demasiadas series totales.

Toda esta lógica de sugerencias/advertencias es por **reglas simples**, no inteligencia artificial real — está pensada como una ayuda orientativa, no como reemplazo de un profesional (ver disclaimers).

## 9. Panel de administrador (cuenta ernestoarevalo@gmail.com)

El panel de administración (`/admin`) usa **firebase-admin** en el backend
(Flask), porque resetear contraseñas, deshabilitar o eliminar usuarios de
verdad requiere privilegios de servidor que el SDK del navegador no tiene.

### Configurarlo (necesario para que el panel funcione):

1. Firebase Console → ⚙️ Configuración del proyecto → pestaña **"Cuentas de
   servicio"** → botón **"Generar nueva clave privada"**. Se descarga un
   archivo `.json`.
2. **En local**: guardá ese archivo como `gym-app/serviceAccountKey.json`
   (ya está en `.gitignore`, nunca se sube a GitHub).
3. **En Render**: NO subas el archivo. En su lugar:
   - Abrí el `.json` descargado, copiá todo su contenido.
   - En Render → tu servicio → pestaña **Environment** → **Add Environment
     Variable** → nombre `FIREBASE_SERVICE_ACCOUNT_JSON`, valor: pegá el
     JSON completo (todo en una sola variable, como texto).
   - Redeploy el servicio.
4. Solo la cuenta `ernestoarevalo@gmail.com` puede usar `/admin` y las rutas
   `/api/admin/*` — el backend verifica el correo del token de Firebase en
   cada request, así que cambiar esto desde el navegador no sirve para
   saltear la protección.

### Qué permite hacer

- Ver todos los usuarios (perfil, días, enfoque, estado de la cuenta).
- Editar nombre, correo, días y enfoque de cualquier usuario.
- Resetear la contraseña de cualquier usuario (se define una nueva
  directamente).
- Habilitar/deshabilitar el acceso de un usuario sin borrar sus datos.
- Eliminar usuarios por completo (cuenta de Auth + datos en Firestore).
- Crear usuarios nuevos manualmente.

## 10. Otras novedades de esta versión

- **Calentamiento y movilidad articular**: el dashboard ahora muestra, antes
  de la rutina, un bloque general de calentamiento y otro de movilidad
  articular (formato inspirado en tu proyecto `gymroutine`).
- **Técnica completa por ejercicio**: cada ejercicio del catálogo
  (`data/ejercicios.json`) tiene ahora postura, errores comunes y
  consideraciones de seguridad, visibles en un desplegable "Ver técnica
  completa". Hay 5 ejercicios por grupo muscular (30 en total).
- **Mejorar mi rutina**: rota los ejercicios de cada grupo muscular hacia
  otra opción del catálogo y sube progresivamente las series. Guarda la
  rutina previa, así que siempre se puede volver atrás con el botón
  "Volver a la rutina anterior".
- **Fecha de nacimiento + cumpleaños**: se pide en el cuestionario inicial
  (o al completar perfil con Google). El día del cumpleaños, el dashboard
  muestra un pop-up de felicitación.
- **Foto de perfil**: se guarda como una URL de imagen (no hay subida de
  archivos binarios, para mantener el hosting 100% gratuito sin necesitar
  Firebase Storage de pago).
- **Cambio de nombre de usuario**: permitido una sola vez desde `/perfil`.
- **Google con cuenta nueva**: si alguien entra con Google y no tiene cuenta
  todavía, se le pide nombre de usuario y fecha de nacimiento en
  `/completar-perfil` antes de crear la cuenta (en vez de autocompletarla).
- **Modo Bestia con mascota pixel-art**: se agregó el personaje "Capitán
  Beast" (tomado de tu proyecto `gymroutine`) como decoración del modo
  bestia.

⚠️ **Importante**: "Mejorar mi rutina" y las sugerencias de `armar-rutina`
son reglas simples programadas por mí, no inteligencia artificial real ni
asesoramiento de un profesional certificado. Por eso los disclaimers
existen y se piden explícitamente.

## 7. Próximos pasos sugeridos

- Migrar `ejercicios.json` a una colección de Firestore para poder editar
  el catálogo sin tocar código.
- Agregar más ejercicios por grupo muscular.
- Agregar lógica de "deload"/progresión automática de peso sugerido.
