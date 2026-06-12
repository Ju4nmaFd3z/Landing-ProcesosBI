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

Es un sitio 100 % estático: basta con subir el contenido del repositorio a la
raíz del webspace (`/`) por SFTP, o conectar el repo con **Ionos Deploy Now**
(tipo de proyecto: *Static site*, sin paso de build, directorio de publicación: `/`).

`index.html` debe quedar en la raíz del documento del dominio.

## Créditos

- Contenido y proyecto: Antonio Sánchez Palenzuela · ProcesosBI
- Diseño web: [Juanma Fernández](https://juanma-dev-portfolio.vercel.app)
