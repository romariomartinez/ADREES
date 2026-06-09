# Asistente ADRES FUR

Aplicacion local para ayudar a diligenciar las plantillas:

- `Plantilla_FUR_Primera_Vez.xlsx`
- `Plantilla_SER.xlsx`

La app muestra campos por secciones, aplica reglas condicionales del diccionario ADRES, calcula totales de servicios y exporta archivos Excel usando las plantillas base. Los archivos exportados conservan exactamente los nombres requeridos por ADRES: `Plantilla_FUR_Primera_Vez.xlsx` y `Plantilla_SER.xlsx`.

Tambien incluye usuarios locales para facturadores. La primera vez que se abre, la app pide crear un `super admin`. Despues, solo ese super admin puede crear otros usuarios desde el boton `Usuarios`.

Cada exportacion queda registrada con facturador, numero de factura, plantilla, cantidad de filas y fecha. La base local se guarda en `data/app.db` y no se versiona.

Los numeros de factura se normalizan para iniciar siempre con `FVEE`. Si el usuario escribe solo el consecutivo, la app antepone `FVEE` automaticamente.

## Administracion

Desde `Usuarios`, el super admin puede editar nombre, rol, estado activo/inactivo y clave de cada usuario. Tambien puede abrir la actividad de cada usuario para ver sus exportaciones y borradores recientes.

## Borradores e historial

- `Guardar borrador`: guarda el formulario actual aunque falten campos por completar.
- `Borradores`: permite buscar, cargar y eliminar borradores del usuario activo.
- `Historial`: permite buscar facturas exportadas por numero, facturador, plantilla y fechas.
- La app bloquea exportaciones duplicadas para la misma combinacion de plantilla y numero de factura.

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

## Desplegar en internet

La opcion recomendada para esta version es Render, porque permite correr el servidor Python y usar un disco persistente para guardar `data/app.db` con usuarios, borradores e historial.

Pasos generales:

1. Sube este proyecto a un repositorio GitHub privado.
2. En Render, crea un `Blueprint` o `Web Service` desde ese repositorio.
3. Si usas `render.yaml`, Render lee la configuracion automaticamente.
4. Verifica que exista un disco persistente montado en `/var/data`.
5. Abre la URL publica que Render entregue y crea el super admin.

El archivo `render.yaml` incluye:

- instalacion con `pip install -r requirements.txt`
- inicio con `python app.py --host 0.0.0.0 --port $PORT`
- variable `ADRES_DATA_DIR=/var/data`
- disco persistente de 1 GB

Vercel no es la mejor opcion para esta version porque la app usa SQLite local para usuarios, borradores e historial. Para Vercel convendria migrar la base a Postgres/Supabase/Neon y adaptar el backend a WSGI/ASGI o funciones serverless.

## Estructura

- `data/schema.json`: campos, listas permitidas, longitudes, ayudas y reglas condicionales.
- `templates/`: plantillas oficiales usadas como base de exportacion.
- `static/`: interfaz web.
- `exports/`: copias locales de los Excel generados.

## Ajustar reglas

Cuando cambie una guia de ADRES, primero actualiza `data/schema.json`. El servidor y la interfaz leen ese archivo al iniciar.
