# BAKS Rentals

## Agregar o editar productos

Cada producto vive en `catalogo/<categoria>/<producto>/producto.json`. Edita los campos
del archivo y agrega las fotos dentro de la misma carpeta. La primera imagen se usa como
portada; el resto aparece en la galería cuando la ficha se amplíe.

Después ejecuta:

```bash
npm run build:catalog
```

Esto actualiza `catalogo.json` y `catalogo-data.js`, que es el archivo que lee la web. La web funciona al abrirse directamente desde Safari o Chrome, sin servidor local.

## Cambiar el orden de las categorías

Edita `catalogo/categorias.json` y cambia el valor de `orden` de cada categoría. Un número menor aparece primero. Luego ejecuta `npm run build:catalog`.

## Correos de cotización

El sitio incluye una función de Netlify que manda el resumen tanto al cliente como a BAKS.
Antes de publicar, configura estas variables de entorno en Netlify:

```text
RESEND_API_KEY=re_xxxxxxxxx
QUOTE_FROM=BAKS Rentals <cotizaciones@tudominio.com>
QUOTE_TO=tu-correo@tudominio.com
```

`QUOTE_FROM` debe ser una dirección de un dominio verificado en Resend. Sin esas variables,
el sitio muestra un aviso y no confirma el envío.

## Publicación

Sube esta carpeta a un repositorio y conéctala a Netlify. El archivo `netlify.toml` ya
publica el sitio y habilita la función de correo.
