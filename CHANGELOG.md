# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.4] - 2026-10-05

### 🇬🇧 English

#### Added
- **Wargame & Miniature Battles Module:**
  - Standalone army roster library (`settings.wargameRosters`) with point cost calculations, multi-model counts, and base sizes.
  - Multi-model units with customizable arcs (front, flanks, rear) and interactive 360° rotation handles with ±45°/180° shortcuts.
  - Real-time unit cohesion checking based on base sizes and real-world mm distances with dotted alert highlights.
  - Floating round & phase tracker panel supporting both side-by-side (IGOUGO) and alternating unit activation modes.
  - Objective markers with manual side control and automatic Victory Points (VP) accrual on round change.
  - Interactive terrain and deployment zones with draggable repositioning and right-click context menu (rectangle, circle, polygon).
- **Grid & Calibration Module:**
  - Square and hexagonal (pointy-topped & flat-topped) grid overlays.
  - 2-click interactive map scale calibration.
  - Configurable diagonal distance measurement rules (Euclidean, Chebyshev 5-5-5, Manhattan, Alternating 5-10-5, Diagonal 1.5x) and snap to grid.
- **Interactive Measuring Tape Module (Measure):**
  - Real-time line and radius measurement with real-world units (`m`, `cm`, `in`) and grid cells.
  - Pinned persistent rulers with customizable labels.
  - Automatic facing arc detection when measuring from wargame models.
- **Campaign Diary Module:**
  - In-app chronological session logging, adventure notes, and event tracking per campaign.
- **Full Internationalization (i18n):** Complete Spanish and English localization for all new modules and tools.

---

### 🇪🇸 Español

#### Añadido
- **Módulo Wargame y Batallas de Miniaturas:**
  - Biblioteca independiente de listas de ejército (**Rosters**) con cálculo de puntos, cantidad de modelos, notas vinculadas y peanas.
  - Unidades multi-modelo con arcos de encaramiento (frente, flancos, retaguardia) y asa de rotación libre con atajos de ±45°/180°.
  - Chequeo visual en tiempo real de cohesión de unidad con alerta punteada.
  - Panel flotante de seguimiento de rondas y fases con soporte para turnos por bando (IGOUGO) y activaciones alternadas.
  - Marcadores de objetivo independientes con asignación de control y suma automática de Puntos de Victoria (PV) al avanzar de ronda.
  - Zonas de terreno y áreas de despliegue interactivas y arrastrables en el tablero con menú contextual (rectangulares, circulares y poligonales).
- **Módulo de Cuadrícula y Calibración (Grid):**
  - Cuadrículas cuadradas y hexagonales (*pointy* y *flat*).
  - Calibración interactiva en 2 clics sobre el mapa.
  - Reglas de conteo diagonal (Euclídea, Chebyshev 5-5-5, Manhattan, Alternada 5-10-5, Diagonal 1.5x) y *snap to grid*.
- **Módulo Cinta Métrica y Medición Interactiva (Measure):**
  - Medición interactiva en línea recta y radio con unidades reales (`m`, `cm`, `in`) y casillas.
  - Fijación de marcadores permanentes (*pinned rulers*) con etiquetas.
  - Detección automática del arco de encaramiento al medir desde modelos de Wargame.
- **Módulo Diario de Campaña (Campaign Diary):**
  - Registro cronológico de notas de sesión, eventos y bitácoras por campaña.
- **Internacionalización completa (i18n):** Soporte total en Español e Inglés para todos los nuevos módulos.

---

## [0.1.3] - 2026-09-28

### 🇬🇧 English

#### Added
- **Calendars & Progress Clocks Module:**
  - **Zero-Factory Base:** Starts completely clean with no forced presets; full user freedom to name units (e.g. days, turns, rounds, shifts) and starting values.
  - **Arbitrary Repeating Cycles:** Configurable cyclical periods (months, seasons, moon phases, weekdays) with length, initial unit offset, repeat counters, and segment labels.
  - **Format String Engine with Tag Pills:** Dynamic template tags (`{unit}`, `{counter}`, `{CycleName}`, `{CycleName.day}`, `{CycleName.repeat}`) with 1-click chip buttons and live highlighted preview banner.
  - **Progress Clocks:** Interactive SVG radial pie clocks (4, 6, 8, 10, 12 segments) with standalone click-to-fill/unfill and optional auto-advancing linked to calendar unit steps.
  - **Modernized Modal Layout:** Redesigned manager modal with structured form grids, responsive spacing, and JSON template import/export.
- **Cards & Decks Module:**
  - **Global Deck Manager:** Create and customize decks with card definitions, front/back image artwork, copy counts, and linked vault notes.
  - **Tabletop Board Cards:** Drag and drop drawn cards directly onto the tabletop board with percentage coordinates, rotation, and face-up / face-down flipping.
- **Token Inventory Module (Addon):**
  - **Dynamic Token Attachment:** Optional 1:1 inventory attached to tokens on demand via right-click context menu (`+ Add inventory`).
  - **Capacity & Weight Tracking:** Capacity modes (`None`, `Weight / Slots`, `Custom Max`) with interactive progress bars.
  - **Item Management:** Quantity steppers, weight calculations, custom tags, thumbnail previews, and linked note integration.
- **Built-in Offline Icon Font (RPG-Awesome):** Embedded the full RPG-Awesome webfont as Base64 directly inside `styles.css`, removing manual CDN / vault path settings and ensuring zero-setup offline icons.
- **Categorized RPG Icon Packs & Search Grid:** Reorganized the icon picker into thematic packages (Weapons, Armor, Creatures, Magic, Characters, Places, Treasures, Nature, Health, Tools, Food, Zodiac, Dice) with category pill filters, live fuzzy search, and an interactive grid picker.
- **Bestiary Game System & Thematic Packs:**
  - **Categorized Bestiary Entries:** Creatures can now be organized by game systems or thematic packs (e.g. *D&D 5e*, *Call of Cthulhu*, *Cyberpunk*, *Undead*).
  - **Dynamic Pack Pills & Search:** Browse and filter creatures seamlessly with interactive pack pill chips and live multi-field search.
  - **Pack JSON Import & Export:** Export specific packs or the full bestiary to portable `.json` files and import shared creature packs.

---

### 🇪🇸 Español

#### Añadido
- **Módulo de Calendarios y Relojes de Progreso:**
  - **Base sin datos de fábrica:** Comienza completamente limpio sin plantillas obligatorias; total libertad para definir nombres de unidad (días, turnos, rondas, jornadas) y valores iniciales.
  - **Ciclos Repetitivos Arbitrarios:** Periodos cíclicos configurables (meses, estaciones, fases lunares, semanas) con duración, desfase inicial (*offset*), conteo de repeticiones y segmentos.
  - **Motor de Formato con Píldoras Interactivas:** Etiquetas dinámicas (`{unit}`, `{counter}`, `{NombreCiclo}`, `{NombreCiclo.day}`, `{NombreCiclo.repeat}`) con botones tipo chip para inserción rápida y banner de previsualización en vivo.
  - **Relojes de Progreso:** Relojes circulares radiales en SVG interactivos (4, 6, 8, 10, 12 porciones) con avance/retroceso por click y avance automático opcional vinculado a unidades del calendario.
  - **Diseño Modernizado del Modal:** Vista renovada en cuadrícula limpia, espaciado responsivo y exportación/importación de plantillas en JSON.
- **Módulo de Cartas y Mazos:**
  - **Gestor Global de Mazos:** Creación de mazos con definición de cartas, arte de frente/dorso, cantidad de copias y vinculación a notas de la bóveda.
  - **Cartas en el Lienzo:** Robar y colocar cartas en el tablero con coordenadas porcentuales, rotación y volteo boca arriba/abajo.
- **Módulo de Inventario de Tokens (Addon):**
  - **Dependencia Dinámica por Token:** Inventario opcional 1:1 adjuntado bajo demanda desde el menú contextual (`+ Agregar inventario`).
  - **Control de Capacidad y Peso:** Modos de capacidad (`Sin límite`, `Peso / Ranuras`, `Máximo manual`) con barra visual de progreso.
  - **Gestión de Ítems:** Controles rápidos de cantidad (+/-), cálculo de peso acumulado, etiquetas, miniaturas y apertura de notas vinculadas.
- **Fuente de Íconos Integrada Offline (RPG-Awesome):** Incorporación del set completo de fuentes RPG-Awesome en Base64 directamente en `styles.css`. Se eliminaron las opciones manuales de CDN/rutas en los ajustes para funcionar 100% offline sin configuraciones previas.
- **Paquetes de Íconos Categorizados y Cuadrícula de Selección:** Nuevo selector de íconos temático organizado por paquetes (Armas, Armaduras, Criaturas, Magia, Personajes, Lugares, Tesoros, Naturaleza, Salud, Herramientas, Comida, Zodíaco, Dados) con filtro interactivo por píldoras, búsqueda predictiva y vista en cuadrícula.
- **Paquetes Temáticos y por Sistema para el Bestiario:**
  - **Clasificación por Paquetes:** Las criaturas ahora pueden asignarse a paquetes temáticos o sistemas de juego (ej. *D&D 5e*, *Cthulhu*, *Cyberpunk*, *No-muertos*).
  - **Filtro Rápido con Píldoras y Buscador:** Navegación fluida mediante botones tipo chip con conteo de criaturas y buscador en vivo.
  - **Importación y Exportación JSON:** Posibilidad de exportar paquetes individuales o todo el bestiario en `.json` e importar colecciones de criaturas compartidas.

---

## [0.1.2] - 2026-09-28

### 🇬🇧 English

#### Added
- **Floating Initiative & Combat Tracker Module:**
  - **Persistent Floating Panel:** Dedicated draggable and minimizable tracker window anchored inside `panelsLayer` so combat state and turn order remain uninterrupted across board re-renders.
  - **Protected Close:** Security confirmation prompt to prevent accidental closing during active combat sessions.
  - **Turn & Round Progression:** Round counter, previous/next turn controls with turn indicator (`▶`), and dynamic pulsing glow outline (`.dte-token-active-turn`) on the active combatant's map token.
  - **Combatant Management:** Interactive initiative badge with direct click-to-edit and automatic descending sort, color-coded mini HP bars with single-click `DamageModal` triggers and frontmatter YAML sync, batch token importer modal, and standalone manual combatant creator.
- **Status Conditions & Effects System:**
  - **Preset Conditions Grid:** Instant 1-click addition of common TTRPG conditions (🧪 Poisoned, 🔥 Burning, 🛡️ Shielded, ⚡ Stunned, 👁️ Blinded, 💤 Asleep, 🕸️ Restrained, ✨ Blessed, 💀 Cursed, 🎯 Marked, 👻 Invisible, 🩸 Bleeding).
  - **Custom Effects:** Create custom conditions with custom names, icons/emojis, and round duration (or indefinite `∞`).
  - **Automated Round Countdown:** Advancing turns automatically counts down active conditions for the combatant ending their turn, auto-clears expired effects, and sends Obsidian notifications.
  - **Full Map Token & Editor Integration:** Assign and manage conditions on any map token even outside of combat via the token right-click context menu (`+ Effect / Condition`), the `TokenEditModal` conditions editor, or clicking directly on the token's interactive status badges on the board.

#### Fixed
- **Floating Panel Pointer Events & Dragging:** Resolved UI click passthrough on floating panels by ensuring `pointer-events: auto` and isolated drag capture strictly to panel headers.

---

### 🇪🇸 Español

#### Añadido
- **Módulo Rastreador de Combate e Iniciativa Flotante:**
  - **Panel Flotante Persistente:** Ventana arrastrable y minimizable alojada en `panelsLayer` para mantener intacto el estado del combate sin destruirse durante los re-renderizados del tablero.
  - **Protección de Cierre:** Confirmación de seguridad para evitar cerrar accidentalmente el panel a mitad de un combate activo.
  - **Progresión de Turnos y Rondas:** Contador de rondas, botones de turno anterior/siguiente (`▶`) y efecto visual de resplandor pulsante (`.dte-token-active-turn`) en el token activo del mapa.
  - **Gestión de Combatientes:** Badge de iniciativa editable con reordenamiento automático descendente, mini barras de vida con colores dinámicos y apertura de `DamageModal` sincronizada con YAML, selector por lote de tokens del mapa y creación de combatientes manuales.
- **Sistema de Condiciones y Efectos de Estado:**
  - **Catálogo de Estados Predefinidos:** Asignación rápida con 1 click de condiciones clásicas (🧪 Envenenado, 🔥 En llamas, 🛡️ Escudo, ⚡ Aturdido, 👁️ Cegado, 💤 Dormido, 🕸️ Inmovilizado, ✨ Bendición, 💀 Maldición, 🎯 Marcado, 👻 Invisible, 🩸 Sangrado).
  - **Efectos Personalizados:** Creación de condiciones a medida con nombre, emoji/ícono y duración en rondas (o indefinido `∞`).
  - **Conteo Regresivo Automático:** Al avanzar de turno, las condiciones del combatiente se decrementan automáticamente, eliminándose al expirar y emitiendo un aviso en Obsidian.
  - **Integración Total en Tokens y Fuera de Combate:** Asignación y ajuste de efectos en cualquier token fuera de iniciativa desde el menú contextual (click derecho → `+ Efecto / Condición`), el editor de tokens (`TokenEditModal`) o pulsando directamente sobre los mini-badges en el mapa.

#### Corregido
- **Eventos de Puntero y Arrastre en Paneles Flotantes:** Corrección de la propiedad `pointer-events: auto` en el panel de combate para evitar bloqueos de interacción y restricción del arrastre exclusivamente a la cabecera.

---

## [0.1.1] - 2026-09-27

### 🇬🇧 English

#### Added
- **Internationalization (i18n):** Full localization support with English and Spanish dictionaries. Includes an interface language selector in plugin settings (`Auto`, `Spanish`, `English`) with instant UI updates and fallback handling.
- **Integrated Optional Modules System:** Extensible module architecture allowing users to toggle specialized tools without cluttering the board.
- **Board Toolbar Quick Modules Modal:** Dedicated `Modules` button (`puzzle` icon) on the board toolbar to enable/disable modules on the fly.
- **Viewport-Centric Entity Placement:** Adding tokens, points of interest, or bestiary creatures now automatically places them at the center of the currently visible viewport instead of fixed defaults.

#### Changed / Fixed
- **Scroll & Viewport Position Preservation:** Canvas and board scroll position (`scrollLeft`, `scrollTop`) is now preserved across re-renders, token edits, and map updates without resetting to top-left (0, 0).
- **Toolbar UI & Icons Polish:** Semantic grouping of toolbar actions, fixed dropdown chevron overlaps, standardized SVG icon dimensions, and enhanced contrast.

---

### 🇪🇸 Español

#### Añadido
- **Internacionalización (i18n):** Soporte multilingüe completo con diccionarios en Español e Inglés. Selector de idioma en ajustes (`Automático`, `Español`, `English`) con actualización en caliente y mecanismo de respaldo (*fallback*).
- **Sistema de Módulos Opcionales Integrados:** Arquitectura extensible para activar únicamente las herramientas necesarias sin sobrecargar el tablero.
- **Modal Rápido de Módulos en el Tablero:** Botón `Módulos` (ícono `puzzle`) en la barra del tablero para activar/desactivar módulos sin salir a la configuración.
- **Colocación de Entidades en el Centro Visible:** Los nuevos tokens, puntos de interés y criaturas del bestiario ahora se crean en el centro del área visible actual del lienzo en lugar de coordenadas fijas.

#### Cambiado / Corregido
- **Preservación del Scroll y Posición en el Tablero:** La posición de scroll (`scrollLeft`, `scrollTop`) del lienzo ahora se conserva intacta tras cada re-renderizado, edición de tokens o interacción en el mapa sin saltar arriba a la izquierda (0, 0).
- **Diseño y Visibilidad de la Barra de Herramientas:** Agrupación semántica de controles, corrección del solapamiento de flechas en selectores dropdown, estandarización de tamaño de iconos SVG y mejor contraste.

---

## [0.1.0] - 2026-09-27

### 🇬🇧 English

#### Added
- **Interactive Virtual Tabletop (VTT):** Full-featured tabletop board view inside Obsidian for solo RPG and group sessions.
- **Campaign & Map Management:** Support for multiple campaigns, image-based maps (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`), and hand-drawn vector maps with an integrated canvas editor (pen, line, rectangle, image props, undo history).
- **Interactive Tokens:** Draggable map tokens with percentage-based coordinates, dynamic health bars, single-click damage/healing popup, and contextual menus.
- **Dynamic Resource Counters:** Real-time customizable secondary counters (mana, spell slots, ammo, gold) per token.
- **Points of Interest (POI) & Floating Panels:** Custom markers on maps linked to vault notes with floating, draggable, and resizable markdown editor/preview panels.
- **Custom Font & RPG-Awesome Support (Experimental):** Built-in icon font integration via CDN or local vault CSS files, including a fuzzy-search icon catalog modal.
- **Integrated Bestiary:** Reusable creature and NPC templates with single-click instantiation onto maps and YAML stat synchronization.
- **YAML Frontmatter Integration:** Bidirectional stat synchronization (`hp`, `maxHp`, `image`) between vault notes and board tokens.

---

### 🇪🇸 Español

#### Añadido
- **Tablero Virtual Interactivo (VTT):** Vista de tablero completa dentro de Obsidian para partidas en solitario (*Solo RPG*) y dirección de grupos.
- **Gestión de Campañas y Mapas:** Soporte para múltiples campañas, mapas basados en imágenes (`.png`, `.jpg`, `.jpeg`, `.webp`, `.svg`) y mapas dibujados a mano con editor vectorial integrado (lápiz, línea, rectángulo, props de imagen e historial de deshacer).
- **Tokens Interactivos:** Tokens arrastrables con coordenadas porcentuales, barra de vida dinámica, modal rápido de daño/curación y menú contextual con clic derecho.
- **Contadores de Recursos:** Contadores secundarios personalizables en tiempo real (maná, espacios de conjuro, munición, oro) por cada token.
- **Puntos de Interés (POI) y Paneles Flotantes:** Marcadores vinculados a notas de la bóveda con paneles flotantes, arrastrables y redimensionables para previsualizar y editar markdown en directo.
- **Soporte para Fuentes de Íconos y RPG-Awesome (Modo en prueba):** Integración de fuentes de íconos vía CDN o archivo local con catálogo interactivo y buscador difuso (*fuzzy search*).
- **Bestiario Integrado:** Plantillas reutilizables de criaturas y PNJs con colocación directa en el mapa activo y sincronización de ficha YAML.
- **Integración con YAML Frontmatter:** Sincronización bidireccional de estadísticas (`hp`, `maxHp`, `image`) entre notas de la bóveda y tokens del tablero.
