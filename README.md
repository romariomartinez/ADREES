# Asistente ADRES FUR

Aplicacion local para ayudar a diligenciar las plantillas:

- `Plantilla_FUR_Primera_Vez.xlsx`
- `Plantilla_SER.xlsx`

La app muestra campos por secciones, aplica reglas condicionales del diccionario ADRES, calcula totales de servicios y exporta archivos Excel usando las plantillas base. Los archivos exportados conservan exactamente los nombres requeridos por ADRES: `Plantilla_FUR_Primera_Vez.xlsx` y `Plantilla_SER.xlsx`.

Tambien incluye usuarios locales para facturadores. La primera vez que se abre, la app pide crear un `super admin`. Despues, solo ese super admin puede crear otros usuarios desde el boton `Usuarios`.

Cada exportacion queda registrada con facturador, numero de factura, plantilla, cantidad de filas y fecha. Si no configuras una base externa, la base local se guarda en `data/app.db` y no se versiona. Si configuras `DATABASE_URL`, la app usa Supabase/Postgres.

Los numeros de factura se normalizan para iniciar siempre con `FVEE`. Si el usuario escribe solo el consecutivo, la app antepone `FVEE` automaticamente.

## Administracion

Desde `Usuarios`, el super admin puede editar nombre, rol, estado activo/inactivo y clave de cada usuario. Tambien puede abrir la actividad de cada usuario para ver sus exportaciones y borradores recientes.

## Borradores e historial

- `Guardar borrador`: guarda el formulario actual aunque falten campos por completar.
- `Borradores`: permite buscar, cargar y eliminar borradores del usuario activo.
- `Historial`: permite buscar facturas exportadas por numero, facturador, plantilla y fechas.
- La app permite exportar facturas con el mismo numero cuando el proceso lo requiere; cada exportacion queda registrada en el historial.

## Autocompletado

La app aprende valores repetidos por usuario al guardar borradores o exportar: NIT, municipios DIVIPOLA, codigo de aseguradora, codigos de habilitacion y direcciones frecuentes. Luego los muestra como sugerencias al volver a escribir esos campos.

## Municipios DIVIPOLA

Los campos de municipio DIVIPOLA usan el listado de `data/divipola.json`, generado desde el CSV oficial `DIVIPOLA-_Codigos_municipios_20260609.csv`. En el formulario se puede buscar por codigo, municipio o departamento, pero al seleccionar queda visible y se guarda solamente el codigo de 5 digitos requerido por ADRES.

## Ejecutar

```powershell
python -m pip install -r requirements.txt
python app.py --port 8787
```

En esta maquina tambien puedes usar:

```powershell
.\run.ps1
```

Abrir:

```text
http://127.0.0.1:8787
```

## Base de datos

La app puede trabajar de dos formas:

- Local: usa SQLite en `data/app.db`.
- Internet: usa Supabase/Postgres cuando existe la variable `DATABASE_URL`.

Para probar Supabase desde tu maquina:

```powershell
$env:DATABASE_URL="postgresql://usuario:clave@host:puerto/postgres?sslmode=require"
python app.py --port 8787
```

La primera vez que arranca con Supabase, la app crea automaticamente las tablas de usuarios, historial, borradores y autocompletado.

## Desplegar en internet

Para esta version, la opcion recomendada sin pagar servidor es Vercel + Supabase.

Supabase guarda usuarios, sesiones, borradores, historial, registros de facturas exportadas y datos de autocompletado en Postgres. Vercel solo ejecuta la app y entrega la interfaz.

Pasos generales:

1. Crea un proyecto en Supabase.
2. En Supabase, copia la cadena `Transaction pooler`, agrega `?sslmode=require` si no lo trae y guardala.
3. Sube este proyecto a un repositorio GitHub privado.
4. En Vercel, crea un proyecto desde ese repositorio.
5. En Vercel, agrega la variable de entorno `DATABASE_URL`.
6. Despliega y abre la URL publica.
7. Crea el super admin en el primer ingreso.

El archivo `vercel.json` configura:

- `/` para abrir `static/index.html`.
- `/api/...` para ejecutar la funcion Python `api/index.py`.

Con Supabase no necesitas disco persistente en Vercel para usuarios, historial ni borradores. Las copias locales de Excel generadas en `exports/` se desactivan automaticamente en Vercel; el archivo que descarga el usuario se genera en memoria en cada exportacion.

Despues de desplegar, puedes probar:

```text
https://tu-proyecto.vercel.app/api/health
```

Debe responder `{"ok": true, ...}`. Si responde error, revisa que `DATABASE_URL` exista en Vercel y tenga `?sslmode=require`.

Para Vercel evita la cadena directa `db.[proyecto].supabase.co:5432`. En Supabase usa `Connect` -> `Transaction pooler`, que normalmente usa host `aws-[region].pooler.supabase.com` y puerto `6543`.

## Notificaciones Firebase

La app puede registrar el telefono/navegador de cada facturador para recibir avisos push. El usuario debe entrar a la app desde su telefono y usar `Activar notificaciones` en el menu del perfil.

En Vercel agrega estas variables de Firebase Web:

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET` opcional
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_VAPID_KEY`

Para que el servidor pueda enviar avisos, agrega tambien la credencial privada del service account:

- `FIREBASE_SERVICE_ACCOUNT_JSON`

Desde `Historial`, el super admin puede usar `Notificar pago` para avisarle al facturador que exporto esa factura. Cuando exista un modulo de pagos real, ese mismo envio se puede llamar automaticamente al confirmar el pago.

## Estructura

- `data/schema.json`: campos, listas permitidas, longitudes, ayudas y reglas condicionales.
- `templates/`: plantillas oficiales usadas como base de exportacion.
- `static/`: interfaz web.
- `exports/`: copias locales de los Excel generados.

## Ajustar reglas

Cuando cambie una guia de ADRES, primero actualiza `data/schema.json`. El servidor y la interfaz leen ese archivo al iniciar.
