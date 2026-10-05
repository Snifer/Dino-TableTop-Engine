# Dino Tabletop Engine 

[![Version](https://img.shields.io/badge/version-0.1.4--alpha-orange.svg)](manifest.json)
[![Obsidian](https://img.shields.io/badge/Obsidian-%3E%3D%200.15.0-7C3AED.svg)](https://obsidian.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![YouTube](https://img.shields.io/badge/YouTube-Bastion%20del%20Dinosaurio-red.svg?logo=youtube)](https://www.youtube.com/@SniferL4bs)

> **[Español](#-español) | [English](#-english)**

---

## 🇪🇸 Español

**Dino Tabletop Engine** es un tablero virtual (VTT - Virtual Tabletop) integrado directamente en **Obsidian**. Está diseñado tanto para jugar rol en solitario (*solo RPG*) como para dirigir partidas grupales, permitiendo conectar mapas, tokens, puntos de interés, contadores, condiciones, rastreador de combate y bestiarios con tus notas de Obsidian mediante propiedades YAML (Frontmatter).

> [!WARNING]
> **Versión Alpha en Desarrollo Activo:** Este plugin se encuentra actualmente en desarrollo y aún no está publicado en la tienda oficial de plugins comunitarios de Obsidian.

---

### ✨ Características Principales

- 🗺️ **Gestión de Campañas y Mapas:**
  - Organiza múltiples campañas, cada una con sus propios mapas.
  - Soporta mapas con imágenes (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) o **mapas dibujados a mano**.
  - Editor vectorial integrado para trazar líneas, lápiz, rectángulos e insertar imágenes/props con historial de deshacer (*undo*).
  - Conservación precisa del scroll y posición de vista al re-renderizar o editar entidades.

- 🪙 **Tokens Interactivos:**
  - Arrastra tokens libremente por el mapa con posicionamiento porcentual adaptable.
  - Barra de vida visual dinámica (cambia de color según el porcentaje de salud).
  - Clic simple para aplicar daño o curación rápidamente.
  - Menú contextual (clic derecho) para editar, eliminar, abrir nota vinculada, modificar estadísticas o añadir condiciones.

- ⚔️ **Rastreador de Combate e Iniciativa (Panel Flotante):**
  - Panel flotante persistente, arrastrable y minimizable con confirmación de seguridad para evitar cierres accidentales.
  - Contador de rondas y botones de turno anterior/siguiente con resaltado visual (`▶`) en la lista y **resplandor pulsante en el token activo del mapa**.
  - Badge de iniciativa editable con reordenamiento automático descendente.
  - Mini barras de vida con colores dinámicos y sincronización bidireccional inmediata con YAML.
  - Importador masivo de tokens del mapa y creación de combatientes manuales (trampas, eventos, refuerzos).

- 🧪 **Condiciones y Efectos de Estado:**
  - Catálogo rápido de condiciones predefinidas (🧪 Envenenado, 🔥 En llamas, 🛡️ Escudo, ⚡ Aturdido, 👁️ Cegado, 💤 Dormido, 🕸️ Inmovilizado, ✨ Bendición, 💀 Maldición, 🎯 Marcado, 👻 Invisible, 🩸 Sangrado).
  - Creación de condiciones personalizadas con nombre, emoji/ícono y duración en rondas (o indefinido `∞`).
  - **Conteo regresivo automático:** Al avanzar los turnos en combate, la duración disminuye automáticamente, emitiendo avisos en Obsidian al expirar.
  - **Integración dentro y fuera de combate:** Badges interactivos en los tokens del mapa, menú contextual y editor de tokens para ajustar o quitar efectos en cualquier momento.

- 🔢 **Contadores en Tiempo Real:**
  - Añade múltiples contadores personalizados a cada token (maná, munición, slots de conjuros, etc.) con valores actuales y máximos opcionales.

- 📐 **Cuadrícula y Calibración de Mapas (Grid):**
  - Superposición de cuadrícula con celdas **cuadradas** o **hexagonales** (en punta o lado plano).
  - Configuración rápida de escala métrica/imperial (`m`, `cm`, `in`) y **calibración interactiva en 2 clics**.
  - Reglas de conteo diagonal (Euclídea, Chebyshev 5-5-5, Manhattan, Alternada 5-10-5, Diagonal 1.5x).
  - Alineación automática de tokens al centro de casilla (*Snap to Grid*).

- 📏 **Cinta Métrica y Medición Interactiva (Measure):**
  - Medición en tiempo real de distancias en línea recta o radios de área.
  - Conversión instantánea a casillas y medidas del mundo real (`m`, `cm`, `in`).
  - Fijación de marcadores permanentes (*pinned rulers*) en el tablero con etiquetas.
  - Detección automática del arco de encaramiento al medir desde modelos de Wargame.

- 🛡️ **Módulo Wargame y Batallas de Miniaturas:**
  - Biblioteca global e independiente de listas de ejército (**Rosters**) con costo en puntos, notas vinculadas y peanas.
  - Unidades con múltiples modelos, arcos de encaramiento (frente, flancos, retaguardia) y asa de rotación 360° con atajos rápidos de ±45° y 180°.
  - **Chequeo visual de cohesión de unidad** en tiempo real con alerta punteada.
  - **Panel flotante de rondas y fases** compatible con turnos por bando (IGOUGO) y activaciones alternadas de unidades.
  - Marcadores de objetivo con control manual y **acumulación automática de Puntos de Victoria (PV)** al avanzar de ronda.
  - Zonas de terreno y áreas de despliegue configurables (rectángulos, círculos y polígonos).

- 📖 **Diario de Campaña (Campaign Diary):**
  - Registro cronológico de notas de sesión, eventos y bitácoras por campaña.

- 🧩 **Sistema de Módulos Opcionales Integrados:**
  - Activa o desactiva herramientas (Rastreador de combate, Cuadrícula, Cinta métrica, Wargame, Diario de campaña, etc.) desde la configuración o directamente con el botón `Módulos` del encabezado.

- 🌐 **Soporte Multilingüe (i18n):**
  - Interfaz completamente traducida en **Español** e **Inglés** con selector en ajustes y respaldo automático.

- 📍 **Puntos de Interés (POI) y Paneles Flotantes:**
  - Coloca marcadores en el mapa con colores personalizados, imágenes o íconos.
  - Al hacer clic en un POI vinculado, se abre una ventana flotante arrastrable y redimensionable para previsualizar o editar la nota en markdown en tiempo real.

- ⚔️ **Soporte de Fuentes de Íconos (RPG-Awesome):**
  - Integra la biblioteca [RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) vía CDN o mediante archivos CSS locales en tu bóveda.
  - Catálogo interactivo con buscador visual (*fuzzy search*) para seleccionar íconos de armas, monstruos, hechizos, cofres, fogatas y más.

- 🐉 **Bestiario Integrado:**
  - Crea plantillas reutilizables de criaturas con estadísticas base o fichas vinculadas.
  - Botón de un solo clic para instanciar criaturas directamente en el mapa activo.

- 📝 **Vinculación con YAML Frontmatter:**
  - Sincroniza automáticamente los puntos de vida y la imagen del token leyendo propiedades YAML de la nota (`hp`, `maxHp`, `puntosDeVida`, `image`, `imagen`, `avatar`, etc.).

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
├── styles.css                  # Estilos del tablero, tokens, paneles, wargame y settings
├── package.json / tsconfig.json
└── src/
    ├── types.ts                # Interfaces de TypeScript, tipos y constantes
    ├── utils.ts                # Utilidades (frontmatter YAML, ID generator, clamp, íconos)
    ├── grid.ts                 # Algoritmos de cuadrícula cuadrada y hexagonal
    ├── drawing.ts              # Lógica de renderizado del lienzo de dibujo vectorial
    ├── i18n/                   # Sistema de internacionalización
    │   ├── index.ts            # Gestor de traducciones t() y configuración
    │   └── locales/            # Diccionarios (es.ts, en.ts)
    ├── modules/                # Sistema de módulos opcionales
    │   ├── registry.ts         # Registro central de módulos integrados
    │   ├── types.ts            # Interfaces de módulos
    │   ├── combatTracker.ts    # Panel flotante de combate, iniciativa y condiciones
    │   ├── measure.ts          # Cinta métrica, marcadores y reglas de medición
    │   ├── wargame.ts          # Módulo Wargame, renderizado de modelos, fases y zonas
    │   └── campaignDiary.ts    # Diario y registro de sesiones de campaña
    ├── settings/
    │   └── DinoSettingTab.ts   # Pestaña de configuración y sección About
    ├── views/
    │   └── DinoTabletopView.ts # Vista principal del tablero, zoom y paneles flotantes
    └── modals/
        ├── TokenEditModal.ts   # Modal para crear y editar tokens
        ├── POIEditModal.ts     # Modal para crear y editar puntos de interés
        ├── BestiaryModals.ts   # Modales de lista y edición del bestiario
        ├── GridConfigModal.ts  # Configuración de cuadrícula y calibración
        ├── MapGridModal.ts     # Modal rápido de cuadrícula
        ├── WargameRosterModals.ts # Biblioteca de Rosters y edición de unidades
        ├── WargameSetupModal.ts   # Configuración de partida wargame (bandos, fases, zonas)
        ├── WargameWoundModal.ts   # Cuadro rápido de heridas para modelos de wargame
        ├── DrawingModals.ts    # Modales del editor de dibujo y nuevo mapa dibujado
        ├── DamageModal.ts      # Cuadro rápido de daño / curación
        ├── AdjustCounterModal.ts # Cuadro rápido de ajuste de contadores
        ├── ModulesModal.ts     # Gestor rápido de módulos desde el tablero
        ├── FileSuggestModal.ts # Selector fuzzy de archivos de la bóveda
        ├── IconSuggestModal.ts # Catálogo fuzzy de íconos RPG-Awesome
        └── NamePromptModal.ts  # Modal de entrada de texto
```

---

### 📜 Registro de Cambios (Changelog)

#### `v0.1.4` (05/10/2026)
- 🛡️ **Módulo Wargame:**
  - Biblioteca independiente de ejércitos (*Rosters*) reutilizable con costo en puntos.
  - Unidades multi-modelo con arcos de encaramiento (frente, flancos, retaguardia) y asa de rotación libre con atajos de ±45°/180°.
  - Chequeo visual en tiempo real de cohesión de unidad.
  - Panel flotante de seguimiento de rondas y fases con soporte para turnos por bando (IGOUGO) y activaciones alternadas.
  - Marcadores de objetivo independientes con asignación de control y suma automática de Puntos de Victoria (PV) al avanzar de ronda.
  - Zonas de terreno y áreas de despliegue configurables (rectangulares, circulares y poligonales).
- 📐 **Módulo de Cuadrícula (Grid):**
  - Cuadrículas cuadradas y hexagonales (*pointy* y *flat*).
  - Calibración automática en 2 clics sobre el mapa.
  - Reglas de conteo diagonal (Euclídea, Chebyshev, Manhattan, Alternada, Diagonal 1.5x) y *snap to grid*.
- 📏 **Módulo Cinta Métrica (Measure):**
  - Medición interactiva en línea recta y radio con unidades reales (`m`, `cm`, `in`) y casillas.
  - Fijación de marcadores permanentes (*pinned rulers*) con etiquetas.
  - Detección automática del arco de encaramiento al medir desde modelos de Wargame.
- 📖 **Módulo Diario de Campaña (Campaign Diary):**
  - Registro integrado de bitácora y sesiones de campaña.
- 🌐 Actualización completa de traducciones en Español e Inglés.

---

### 🦖 Crédito

- Desarrollado por **Snifer - Bastión del Dinosaurio**.
- Canal de YouTube: [Snifer - Bastión del Dinosaurio](https://www.youtube.com/@SniferL4bs)
- Biblioteca de íconos: [RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) por Nagoshiashumari.

---

<br/>

## 🇬🇧 English

**Dino Tabletop Engine** is a virtual tabletop (VTT) built directly inside **Obsidian**. It is designed for both solo roleplaying (*Solo RPG*) and Game Masters running group sessions, allowing you to link maps, tokens, points of interest, resource counters, status conditions, combat tracker, and bestiaries directly with your Obsidian notes using YAML frontmatter.

> [!WARNING]
> **Active Alpha Development:** This plugin is currently in alpha and is not yet available in the official Obsidian Community Plugins directory.

---

### ✨ Key Features

- 🗺️ **Campaign & Map Management:**
  - Organize multiple campaigns, each containing multiple maps.
  - Supports image-based maps (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) or **hand-drawn vector maps**.
  - Built-in drawing editor with pen, line, rectangle tools, and draggable/resizable image props with undo support.
  - Viewport and scroll preservation across re-renders and edits.

- 🪙 **Interactive Tokens:**
  - Freely drag tokens across the map with responsive percentage coordinates.
  - Dynamic visual health bars (color-coded according to remaining HP percentage).
  - Single-click damage/healing modal for fast combat resolution.
  - Context menu (right-click) to edit, delete, open linked notes, adjust stats, or assign conditions.

- ⚔️ **Floating Combat & Initiative Tracker:**
  - Dedicated persistent, draggable, and minimizable tracker window anchored inside `panelsLayer`.
  - Protected close confirmation to prevent accidental loss of active combat state.
  - Round counter and turn progression controls with turn indicator (`▶`) and **active turn glowing pulse animation** on the map token.
  - Editable initiative badges with automatic descending sort.
  - Color-coded mini HP bars with single-click `DamageModal` triggers and bidirectional frontmatter YAML sync.
  - Batch map token importer modal and standalone manual combatant creator.

- 🧪 **Status Conditions & Effects System:**
  - Instant 1-click preset grid for common TTRPG conditions (🧪 Poisoned, 🔥 Burning, 🛡️ Shielded, ⚡ Stunned, 👁️ Blinded, 💤 Asleep, 🕸️ Restrained, ✨ Blessed, 💀 Cursed, 🎯 Marked, 👻 Invisible, 🩸 Bleeding).
  - Custom effect builder with name, emoji/icon, and round duration (or indefinite `∞`).
  - **Automated round countdown:** Turn progression automatically decrements rounds and notifies on expiration.
  - **In-combat & Out-of-combat Token Integration:** Manage effects on any token via context menu (`+ Effect / Condition`), token editor, or clicking interactive status badges directly on map tokens.

- 🔢 **Live Resource Counters:**
  - Attach multiple custom counters (mana, spell slots, ammo, gold, etc.) with optional maximum limits.

- 📐 **Grid & Map Calibration:**
  - Square and hexagonal (**pointy-topped** & **flat-topped**) grid overlays.
  - Scale configuration with imperial/metric units (`m`, `cm`, `in`) and **interactive 2-click calibration**.
  - Configurable diagonal distance measurement rules (Euclidean, Chebyshev 5-5-5, Manhattan, Alternating 5-10-5, Diagonal 1.5x).
  - Snap tokens automatically to grid cell centers (*Snap to Grid*).

- 📏 **Interactive Measuring Tape (Measure):**
  - Real-time line and circle radius distance measuring on the board.
  - Instant conversion to grid cells and real-world units (`m`, `cm`, `in`).
  - Pin persistent measurement rulers to the map board with custom labels.
  - Automatic facing arc detection when measuring from wargame models.

- 🛡️ **Wargame & Miniature Battles Module:**
  - Global, reusable army roster library (**Rosters**) with point costs, linked notes, and base sizes.
  - Multi-model units with customizable arcs (front, flanks, rear) and interactive 360° rotation handles with ±45°/180° shortcuts.
  - **Real-time unit cohesion checking** with dotted alert highlighting.
  - **Floating round & phase tracker panel** supporting both side-by-side (IGOUGO) and alternating unit activations.
  - Objective markers with manual control assignment and **automated Victory Points (VP) accrual** on round change.
  - Terrain and deployment zones with rectangle, circle, and polygon shapes.

- 📖 **Campaign Diary:**
  - In-app chronological session logging, adventure notes, and event tracking per campaign.

- 🧩 **Integrated Optional Modules System:**
  - Toggle specialized tools (Combat Tracker, Grid, Measuring Tape, Wargame, Campaign Diary, etc.) from settings or directly from the board header.

- 🌐 **Full Internationalization (i18n):**
  - Complete English and Spanish localization with in-app language switching.

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
├── styles.css                  # Board, token, panel, wargame, and settings styles
├── package.json / tsconfig.json
└── src/
    ├── types.ts                # TypeScript interfaces, types & constants
    ├── utils.ts                # Utility functions (YAML parser, ID generator, clamp, icons)
    ├── grid.ts                 # Square and hex grid calculation engine
    ├── drawing.ts              # Canvas painting and stroke rendering engine
    ├── i18n/                   # Localization engine
    │   ├── index.ts            # Translation t() helper and language state
    │   └── locales/            # Translation dictionaries (es.ts, en.ts)
    ├── modules/                # Integrated modular subsystem
    │   ├── registry.ts         # Module registry
    │   ├── types.ts            # Module interfaces
    │   ├── combatTracker.ts    # Combat tracker floating panel & conditions
    │   ├── measure.ts          # Measuring tape, pinned rulers & scale engine
    │   ├── wargame.ts          # Wargame module, models renderer, phases & zones
    │   └── campaignDiary.ts    # Campaign diary & session notes
    ├── settings/
    │   └── DinoSettingTab.ts   # Plugin settings tab & About card
    ├── views/
    │   └── DinoTabletopView.ts # Main tabletop board view, zoom & floating panels
    └── modals/
        ├── TokenEditModal.ts   # Token creation and editing modal
        ├── POIEditModal.ts     # Point of interest modal
        ├── BestiaryModals.ts   # Bestiary list & creature editor modals
        ├── GridConfigModal.ts  # Grid configuration and calibration modal
        ├── MapGridModal.ts     # Quick map grid modal
        ├── WargameRosterModals.ts # Army roster library and unit modals
        ├── WargameSetupModal.ts   # Wargame match setup modal (sides, phases, zones)
        ├── WargameWoundModal.ts   # Quick wound adjustment modal for wargame models
        ├── DrawingModals.ts    # Canvas drawing editor & new drawn map modals
        ├── DamageModal.ts      # Quick damage / healing popup
        ├── AdjustCounterModal.ts # Quick counter adjustment popup
        ├── ModulesModal.ts     # Quick board modules toggle modal
        ├── FileSuggestModal.ts # Fuzzy file picker for vault notes and images
        ├── IconSuggestModal.ts # Fuzzy visual icon picker for RPG-Awesome
        └── NamePromptModal.ts  # Generic name input prompt modal
```

---

### 📜 Changelog

#### `v0.1.4` (10/05/2026)
- 🛡️ **Wargame Module:**
  - Standalone army roster library with point cost calculation.
  - Multi-model units with customizable arcs (front, flanks, rear) and 360° rotation handles with ±45°/180° shortcuts.
  - Real-time unit cohesion checking with visual alert.
  - Floating round & phase tracker supporting both IGOUGO and alternating unit activation modes.
  - Objective markers with manual side control and automatic Victory Points (VP) accrual on round change.
  - Terrain and deployment zones (rectangles, circles, and polygons).
- 📐 **Grid Module:**
  - Square & hexagonal grids (*pointy* and *flat*).
  - 2-click interactive map scale calibration.
  - Diagonal rules (Euclidean, Chebyshev, Manhattan, Alternating, Diagonal 1.5x) and *snap to grid*.
- 📏 **Measuring Tape Module (Measure):**
  - Real-time line and radius measurement with real-world units (`m`, `cm`, `in`) and grid cells.
  - Pinned persistent rulers with labels.
  - Automatic facing arc detection when measuring from wargame models.
- 📖 **Campaign Diary Module:**
  - In-app session notes and event tracking per campaign.
- 🌐 Complete Spanish and English i18n support.

---

### 🦖 Credits 

- Developed by **Snifer - Bastión del Dinosaurio**.
- YouTube Channel: [Snifer - Bastión del Dinosaurio](https://www.youtube.com/@SniferL4bs)
- Icon library: [RPG-Awesome](https://github.com/nagoshiashumari/Rpg-Awesome) by Nagoshiashumari.

---

### 📄 License

This project is licensed under the [MIT License](LICENSE).

