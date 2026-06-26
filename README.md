# ProcesosBI — Landing

Landing page estática de **ProcesosBI**: Business Intelligence real, sin humo.
Primero los datos. Después la IA. Siempre el beneficio.

## Concepto

Toda la página es un único circuito: un **filamento de luz cálida** (path SVG
con glow) nace en el hero, se dibuja en sincronía exacta con el scroll,
serpentea entre las secciones encendiendo nodos con anotaciones, y termina
cayendo en vertical sobre el botón «¿Hablamos?», que se enciende con una
secuencia de ignición (destello, ondas expansivas, chispas) al recibirlo.

Dirección de arte: casi monocromo (negro neutro y marfil) con un único acento
de luz ámbar. Dos fuentes: Newsreader (serif editorial) y Hanken Grotesk.

## Estructura

```
/
├── index.html            # toda la página
├── favicon.svg
└── assets/
    ├── css/styles.css    # estilos
    ├── img/
    │   └── antonio.svg   # retrato provisional (monograma)
    └── js/
        ├── thread.js     # motor del hilo de luz (scroll-driven)
        └── main.js       # nav, reveals, contadores
```

## Foto del fundador

La sección «Quién está detrás» busca `assets/img/antonio.jpg` (retrato
vertical, proporción 4:5, mínimo ~800 px de ancho). Mientras no exista,
se muestra automáticamente el monograma provisional. Para activar la
foto real basta con añadir el archivo con ese nombre; no hay que tocar
el código.

Sin build, sin dependencias, sin frameworks. HTML + CSS + JS vanilla.

## Despliegue en Ionos

El despliegue es **automático**: cada `push` a la rama `main` lanza un workflow
de **GitHub Actions** que sube la web al **webspace de Ionos por SFTP**. También
puede lanzarse a mano desde la pestaña *Actions* del repo (botón *Run workflow*).

El workflow vive en `.github/workflows/deploy.yml`. Antes de subir, prepara una
carpeta limpia con **solo** lo publicable —`index.html`, `favicon.svg` y
`assets/`— de modo que nunca se publican `.git`, `.github`, `_privado/`,
`README.md` ni archivos `.DS_Store`. `index.html` queda en la raíz del documento
del dominio (la ruta `IONOS_REMOTE_PATH`).

### Secrets que hay que crear en GitHub

En **Settings → Secrets and variables → Actions → New repository secret**, crea:

| Secret                | Obligatorio | Qué es                                                        |
| --------------------- | ----------- | ------------------------------------------------------------ |
| `IONOS_SFTP_HOST`     | Sí          | Host/servidor SFTP del webspace (p. ej. `access-xxx.webspace-host.com`). |
| `IONOS_SFTP_USER`     | Sí          | Usuario SFTP del webspace.                                   |
| `IONOS_SFTP_PASSWORD` | Sí          | Contraseña SFTP.                                             |
| `IONOS_REMOTE_PATH`   | Sí          | Ruta remota de publicación (raíz del documento del dominio), p. ej. `/`. |
| `IONOS_SFTP_PORT`     | No          | Puerto SFTP. Si no se define, se usa `22`.                   |

Los datos de host, usuario y contraseña están en el panel de Ionos, en la
sección **Webspace → Acceso SFTP/SSH** del dominio correspondiente.

Una vez creados los secrets, cualquier `push` a `main` publica la web sin más
pasos.

## Créditos

- Contenido y proyecto: Antonio Sánchez Palenzuela · ProcesosBI
- Diseño web: [Juanma Fernández](https://juanma-dev-portfolio.vercel.app)
