# Dino Tabletop Engine 

[![Version](https://img.shields.io/badge/version-0.1.0--alpha-orange.svg)](manifest.json)
[![Obsidian](https://img.shields.io/badge/Obsidian-%3E%3D%200.15.0-7C3AED.svg)](https://obsidian.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![YouTube](https://img.shields.io/badge/YouTube-Bastion%20del%20Dinosaurio-red.svg?logo=youtube)](https://www.youtube.com/@SniferL4bs)

> **[Español](#-español) | [English](#-english)**

---

## 🇪🇸 Español

**Dino Tabletop Engine** es un tablero virtual (VTT - Virtual Tabletop) integrado directamente en **Obsidian**. Está diseñado tanto para jugar rol en solitario (*solo RPG*) como para dirigir partidas grupales, permitiendo conectar mapas, tokens, puntos de interés, contadores y bestiarios con tus notas de Obsidian mediante propiedades YAML (Frontmatter).

> [!WARNING]
> **Versión Alpha en Desarrollo Activo:** Este plugin se encuentra actualmente en desarrollo y aún no está publicado en la tienda oficial de plugins comunitarios de Obsidian.

---

### ✨ Características Principales

- 🗺️ **Gestión de Campañas y Mapas:**
  - Organiza múltiples campañas, cada una con sus propios mapas.
  - Soporta mapas con imágenes (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) o **mapas dibujados a mano**.
  - Editor vectorial integrado para trazar líneas, lápiz, rectángulos e insertar imágenes/props con historial de deshacer (*undo*).

- 🪙 **Tokens Interactivos:**
  - Arrastra tokens libremente por el mapa con posicionamiento porcentual adaptable.
  - Barra de vida visual dinámica (cambia de color según el porcentaje de salud).
  - Clic simple para aplicar daño o curación rápidamente.
  - Menú contextual (clic derecho) para editar, eliminar, abrir nota vinculada o modificar estadísticas.

- 🔢 **Contadores en Tiempo Real:**
  - Añade múltiples contadores personalizados a cada token (maná, munición, slots de conjuros, etc.) con valores actuales y máximos opcionales.

- 📍 **Puntos de Interés (POI) y Paneles Flotantes:**
  - Coloca marcadores en el mapa con colores personalizados, imágenes o íconos.
  - Al hacer clic en un POI vinculado, se abre una ventana flotante arrastrable y redimensionable para previsualizar o editar la nota en markdown en tiempo real.

- ⚔️ **Soporte de Fuentes de Íconos (RPG-Awesome):**
  - Integra por defecto la biblioteca [RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) vía CDN o mediante archivos CSS locales en tu bóveda. (Modo en prueba)
  - Catálogo interactivo con buscador visual (*fuzzy search*) para seleccionar íconos de armas, monstruos, hechizos, cofres, fogatas y más.

- 🐉 **Bestiario Integrado:**
  - Crea plantillas reutilizables de criaturas con estadísticas base o fichas vinculadas.
  - Botón de un solo clic para instanciar criaturas directamente en el mapa activo.

- 📝 **Vinculación con YAML Frontmatter:**
  - Sincroniza automáticamente los puntos de vida y la imagen del token leyendo propiedades YAML de la nota (`hp`, `maxHp`, `puntosDeVida`, `image`, `imagen`, `avatar`, etc.).
  - Los cambios de vida en el tablero pueden actualizar automáticamente el YAML de la nota.

- ⚙️ **Pestaña de Configuración (*Settings*):**
  - Configura la URL o ruta local del archivo CSS de íconos y el prefijo de clase.
  - Botón de recarga de estilos en caliente.
  - Sección *Acerca de* con acceso al canal de YouTube de **Snifer - Bastión del Dinosaurio**.

---

### 📦 Instalación

#### Opción 1: Instalación Manual de Release
1. Descarga los archivos de la versión: `manifest.json`, `main.js` y `styles.css`.
2. Crea una carpeta llamada `dino-tabletop-engine` dentro de tu bóveda en:
   ```
   TuBoveda/.obsidian/plugins/dino-tabletop-engine/
   ```
3. Copia los 3 archivos dentro de esa carpeta.
4. En Obsidian ve a **Ajustes → Plugins de la comunidad**, desactiva el modo restringido si es necesario y activa **Dino Tabletop Engine**.

#### Opción 2: Compilar desde el Código Fuente
1. Clona o descarga este repositorio.
2. Abre una terminal en la carpeta del proyecto y ejecuta:
   ```bash
   # Instalar dependencias
   npm install

   # Compilar para producción (genera main.js)
   npm run build

   # O modo desarrollo (recompila automáticamente al guardar cambios)
   npm run dev
   ```
3. Copia `manifest.json`, `main.js` y `styles.css` a la carpeta de plugins de tu bóveda Obsidian.

---

### 📂 Estructura del Código

El proyecto está organizado en módulos limpios dentro de `src/`:

```
├── main.ts                     # Punto de entrada del Plugin (ciclo de vida y comandos)
├── manifest.json               # Manifiesto del plugin para Obsidian
├── styles.css                  # Estilos del tablero, tokens, paneles y settings
├── package.json / tsconfig.json
└── src/
    ├── types.ts                # Interfaces de TypeScript, tipos y constantes
    ├── utils.ts                # Utilidades (frontmatter YAML, ID generator, clamp, íconos)
    ├── drawing.ts              # Lógica de renderizado del lienzo de dibujo vectorial
    ├── settings/
    │   └── DinoSettingTab.ts   # Pestaña de configuración y sección About
    ├── views/
    │   └── DinoTabletopView.ts # Vista principal del tablero, zoom y paneles flotantes
    └── modals/
        ├── TokenEditModal.ts   # Modal para crear y editar tokens
        ├── POIEditModal.ts     # Modal para crear y editar puntos de interés
        ├── BestiaryModals.ts   # Modales de lista y edición del bestiario
        ├── DrawingModals.ts    # Modales del editor de dibujo y nuevo mapa dibujado
        ├── DamageModal.ts      # Cuadro rápido de daño / curación
        ├── AdjustCounterModal.ts # Cuadro rápido de ajuste de contadores
        ├── FileSuggestModal.ts # Selector fuzzy de archivos de la bóveda
        ├── IconSuggestModal.ts # Catálogo fuzzy de íconos RPG-Awesome
        ├── NamePromptModal.ts  # Modal de entrada de texto
        └── CountersEditor.ts   # Componente reutilizable para editar contadores
```

---

### 🦖 Crédito

- Desarrollado por **Snifer - Bastión del Dinosaurio**.
- Canal de YouTube: [Snifer - Bastión del Dinosaurio](https://www.youtube.com/@SniferL4bs)
- Biblioteca de íconos: [RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) por Nagoshiashumari.

---

<br/>

## 🇬🇧 English

**Dino Tabletop Engine** is a virtual tabletop (VTT) built directly inside **Obsidian**. It is designed for both solo roleplaying (*Solo RPG*) and Game Masters running group sessions, allowing you to link maps, tokens, points of interest, counters, and bestiaries directly with your Obsidian notes using YAML frontmatter.

> [!WARNING]
> **Active Alpha Development:** This plugin is currently in alpha and is not yet available in the official Obsidian Community Plugins directory.

---

### ✨ Key Features

- 🗺️ **Campaign & Map Management:**
  - Organize multiple campaigns, each containing multiple maps.
  - Supports image-based maps (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) or **hand-drawn vector maps**.
  - Built-in drawing editor with pen, line, rectangle tools, and draggable/resizable image props with undo support.

- 🪙 **Interactive Tokens:**
  - Freely drag tokens across the map with responsive percentage coordinates.
  - Dynamic visual health bars (color-coded according to remaining HP percentage).
  - Single-click damage/healing modal for fast combat resolution.
  - Context menu (right-click) to edit, delete, open linked notes, or adjust stats.

- 🔢 **Live Resource Counters:**
  - Attach multiple custom counters (mana, spell slots, ammo, gold, etc.) with optional maximum limits.

- 📍 **Points of Interest (POI) & Floating Note Panels:**
  - Place custom markers on the map with custom colors, images, or font icons.
  - Clicking a linked POI opens a persistent, draggable, and resizable floating window to read and edit the markdown note in real time.

- ⚔️ **Custom Icon Fonts & RPG-Awesome Support:**
  - Comes with built-in support for [RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) via CDN or local vault CSS files.
  - Visual fuzzy-search icon catalog to quickly pick weapon, monster, magic, chest, campfire, and item icons.

- 🐉 **Integrated Bestiary:**
  - Create reusable creature stat templates linked to monster vault notes.
  - Single-click placement of new creature tokens onto the active map.

- 📝 **Bidirectional YAML Frontmatter Sync:**
  - Automatically reads token HP, max HP, and images from frontmatter properties (`hp`, `maxHp`, `image`, `avatar`, `puntosDeVida`, etc.).
  - In-game HP adjustments can automatically sync back to update the note's frontmatter.

- ⚙️ **Settings Tab:**
  - Configure icon CSS source (remote CDN URL or local vault path) and CSS class prefix.
  - Live reload button for icon stylesheets.
  - *About* section with quick access to the **Bastión del Dinosaurio** YouTube channel.

---

### 📦 Installation

#### Option 1: Manual Installation from Release
1. Download `manifest.json`, `main.js`, and `styles.css`.
2. Create a folder named `dino-tabletop-engine` inside your vault:
   ```
   YourVault/.obsidian/plugins/dino-tabletop-engine/
   ```
3. Place all 3 files in that directory.
4. In Obsidian, go to **Settings → Community plugins**, turn off restricted mode if needed, and enable **Dino Tabletop Engine**.

#### Option 2: Build from Source
1. Clone or download this repository.
2. Open a terminal in the project directory and run:
   ```bash
   # Install dependencies
   npm install

   # Production build (creates main.js)
   npm run build

   # Development mode (auto-recompiles on file save)
   npm run dev
   ```
3. Copy `manifest.json`, `main.js`, and `styles.css` into your vault plugin directory.

---

### 📂 Code Architecture

The codebase is organized into clean TypeScript modules under `src/`:

```
├── main.ts                     # Plugin entry point (lifecycle & commands)
├── manifest.json               # Obsidian plugin metadata
├── styles.css                  # Board, token, panel, and settings styles
├── package.json / tsconfig.json
└── src/
    ├── types.ts                # TypeScript interfaces, types & constants
    ├── utils.ts                # Utility functions (YAML parser, ID generator, clamp, icons)
    ├── drawing.ts              # Canvas painting and stroke rendering engine
    ├── settings/
    │   └── DinoSettingTab.ts   # Plugin settings tab & About card
    ├── views/
    │   └── DinoTabletopView.ts # Main tabletop board view, zoom & floating panels
    └── modals/
        ├── TokenEditModal.ts   # Token creation and editing modal
        ├── POIEditModal.ts     # Point of interest modal
        ├── BestiaryModals.ts   # Bestiary list & creature editor modals
        ├── DrawingModals.ts    # Canvas drawing editor & new drawn map modals
        ├── DamageModal.ts      # Quick damage / healing popup
        ├── AdjustCounterModal.ts # Quick counter adjustment popup
        ├── FileSuggestModal.ts # Fuzzy file picker for vault notes and images
        ├── IconSuggestModal.ts # Fuzzy visual icon picker for RPG-Awesome
        ├── NamePromptModal.ts  # Generic name input prompt modal
        └── CountersEditor.ts   # Reusable counter manager component
```

---

### 🦖 Credits 

- Developed by **Snifer - Bastión del Dinosaurio**.
- YouTube Channel: [Snifer - Bastión del Dinosaurio](https://www.youtube.com/@SniferL4bs)
- Icon library: [RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) by Nagoshiashumari.

---

### 📄 License

This project is licensed under the [MIT License](LICENSE).
