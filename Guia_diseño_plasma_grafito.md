**✅ Guía de Diseño Web - Cyberpunk "Plasma Grafito"**

Basada en la imagen del dormitorio cyberpunk que generamos, aquí tienes una **guía completa y práctica** para usarla como base de diseño web.

### 1. Concepto General (Mood & Estilo)
- **Estilo principal**: Cyberpunk / Tech Noir / Futurista Oscuro
- **Ambiente**: Habitación high-tech con circuitos de plasma, materiales industriales (grafito y fibra de carbono) y neón vibrante.
- **Sensación**: Tecnológica, premium, misteriosa y energética.

### 2. Paleta de Colores

| Uso              | Color Principal          | Código HEX     | Uso Recomendado |
|------------------|--------------------------|----------------|-----------------|
| Fondo principal  | Negro Grafito            | `#0A0A0A`      | Background body |
| Superficies      | Gris Carbón / Dark Gray  | `#1C1C1E`      | Cards, panels   |
| Acentos Neón     | Plasma Blue              | `#00F0FF`      | Links, highlights |
| Acentos Neón 2   | Magenta / Pink Plasma    | `#FF00AA`      | Botones, títulos |
| Texto principal  | Blanco con neón          | `#E0E0E0`      | Textos normales |
| Texto secundario | Gris claro               | `#A0A0A0`      | Subtítulos      |
| Glow / Efectos   | Plasma Glow              | `#00F0FF` + sombra | Hover effects   |

**Gradientes recomendados**:
- Azul-Magenta: `linear-gradient(90deg, #00F0FF, #FF00AA)`
- Oscuro: `linear-gradient(180deg, #1C1C1E, #0A0A0A)`

### 3. Tipografía

- **Títulos principales**: Fuente futurista / Cyber (ej: `Orbitron`, `Rajdhani`, `Exo 2` o `Cyberpunk`)
- **Títulos secundarios**: `Inter` o `Space Grotesk` (bold)
- **Texto cuerpo**: `Inter` o `Satoshi` (regular y medium)
- **Efectos**: 
  - `text-shadow` con neón (`0 0 10px #00F0FF`)
  - `letter-spacing`: 1-2px en títulos

### 4. Layout y Estructura

- **Fondo general**:
  - Negro profundo con sutiles patrones de circuitos (puedes usar SVG o CSS lines).
  - Opcional: overlay de lluvia sutil o partículas de energía.

- **Secciones**:
  - Hero con imagen o ilustración del dormitorio (o vista similar)
  - Navbar transparente con efecto vidrio (glassmorphism) + neón
  - Cards con bordes que brillan al hacer hover
  - Footer con circuitos

### 5. Componentes UI (Recomendados)

**Botones**:
- Bordes delgados con neón
- Hover: glow intenso + escala ligera
- Variantes: `primary` (azul), `secondary` (magenta)

**Tarjetas (Cards)**:
- Fondo `#1C1C1E`
- Borde sutil con neón que se activa en hover
- Interior con leve padding y sombra interna

**Navegación**:
- Logo con texto "PLASMA GRAFITO" en neón
- Menú con líneas de circuito que se iluminan al pasar el cursor

**Inputs / Formularios**:
- Fondo oscuro
- Bordes neón que se activan al focus
- Efecto glow suave

### 6. Efectos y Animaciones (muy importantes)

- **Glow Neón**: `box-shadow: 0 0 15px #00F0FF, 0 0 30px #FF00AA`
- **Circuit Lines**: Líneas finas que se mueven lentamente (CSS animation o canvas)
- **Hover Effects**: 
  - Elementos se iluminan
  - Texto con glitch leve (opcional)
- **Scroll Effects**: Elementos que aparecen con fade + glow
- **Cursor**: Opcional cursor personalizado con pequeño punto neón

### 7. Recomendaciones Técnicas

- **Framework**: Tailwind CSS (ideal para este estilo)
- **Librerías útiles**:
  - `framer-motion` o GSAP (animaciones)
  - `react-glitch` o similar
  - Three.js o particles.js para efectos de plasma (si quieres nivel avanzado)
- **Imágenes**: Usa mucho `mix-blend-mode: screen` o `overlay` para efectos neón.

---

¿Quieres que te prepare ahora mismo:

1. Un **Figma Style Guide** (descripción detallada por pantallas)
2. **Código CSS base** (Tailwind + custom CSS) listo para copiar
3. La **estructura de secciones** para la web (Home, About, Services, etc.)

Dime qué prefieres y te lo entrego.