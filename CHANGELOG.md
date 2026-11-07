# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.12] - 2026-11-07

### 🇬🇧 English

#### Added
- **Character Sheet – Template Editor: Typography Controls:** New **Typography** section in the sidebar inspector available for all text-displaying widgets (label, text, counter, frame, calculated, button, check, list, grid). Includes:
  - **Bold / Italic toggle buttons** (`B` / `I`) with active-state highlight.
  - **Underline / Strikethrough toggle buttons** (`U` / `S̶`) with active-state highlight.
  - **Text alignment 3-button toggle** (Left / Center / Right) with active-state highlight.
  - **Font size** numeric input (pixels, optional).
  - **Text color** color picker.
  - All properties persisted in `WidgetStyle` (`fontWeight`, `fontStyle`, `textDecoration`, `textAlign`, `fontSize`, `textColor`) and applied to the rendered sheet.

#### Fixed
- **Character Sheet – JSON Import (`Paste JSON` button):** Replaced native `window.prompt()` (unsupported in Electron/Obsidian) with a full Obsidian `Modal` containing a `<textarea>`, resolving `Uncaught Error: prompt() is not supported` on paste.
- **Character Sheet – Counter widget unlimited max:** Counter widgets now support a true unlimited max (no `/9999` label, no progress bar, no value clamping) when no max is defined. The editor sidebar shows a **Max Limit** toggle — OFF defaults new counters to unlimited; ON reveals the max value input.
- **Character Sheet – Active-state highlight on typography buttons:** `.dte-editor-btn.is-active` CSS rule added so Bold, Italic, Underline, Strikethrough, and Alignment buttons visually indicate the current state using `--interactive-accent`.

#### Changed
- **Character Sheet – Token context menu:** Added **Change Template** (`changeCharacterSheet`) and **Remove Sheet** (`removeCharacterSheet`) options to the token right-click menu and to the floating `CharacterSheetPanel` header (repeat / file-minus icons).
- **`SelectTemplateModal`:** Detects when a template is already assigned (`isChange = true`), pre-selects the current template, and exposes a **Remove Sheet** button for quick detachment.
- **Character Sheet – Sidebar inspector:** Widget click no longer causes a full re-render. Only CSS selection classes are updated and `renderSidebar()` is called, eliminating flicker and preserving panel scroll position.
- **`WidgetStyle` type:** Added `fontStyle?: 'normal' | 'italic'` and `textDecoration?: 'none' | 'underline' | 'line-through'`.
- **`CharacterSheetRenderer.renderWidget()`:** All typography properties (`fontSize`, `fontWeight`, `fontStyle`, `textDecoration`, `textAlign`) now applied in the shared wrapper block so they affect every widget type consistently.

---

### 🇪🇸 Español

#### Agregado
- **Hoja de Personaje – Editor de Plantillas: Controles de Tipografía:** Nueva sección **Tipografía** en el inspector lateral, disponible para todos los widgets que muestran texto (literal, texto, contador, recuadro, calculado, botón, casilla, lista, cuadrícula). Incluye:
  - **Botones Negrita / Cursiva** (`B` / `I`) con resaltado de estado activo.
  - **Botones Subrayado / Tachado** (`U` / `S̶`) con resaltado de estado activo.
  - **Selector de alineación** de 3 botones (Izquierda / Centrado / Derecha) con resaltado del seleccionado.
  - **Tamaño de fuente** (campo numérico en píxeles, opcional).
  - **Color de texto** (selector de color).
  - Todas las propiedades persistidas en `WidgetStyle` y aplicadas al renderizado de la hoja.

#### Corregido
- **Hoja de Personaje – Importar JSON (botón "Pegar JSON"):** Reemplazo de `window.prompt()` (no soportado en Electron/Obsidian) por un `Modal` de Obsidian con `<textarea>`, resolviendo el error `Uncaught Error: prompt() is not supported` al pegar.
- **Hoja de Personaje – Contador sin límite máximo:** Los contadores ahora admiten un máximo verdaderamente ilimitado (sin etiqueta `/9999`, sin barra de progreso, sin recorte de valor) cuando no se define un tope. El inspector del editor muestra un toggle **Límite máximo** — desactivado deja el contador libre; activado revela el campo de valor máximo.
- **Hoja de Personaje – Resaltado de botones de tipografía activos:** Se agregó la regla CSS `.dte-editor-btn.is-active` para que los botones de Negrita, Cursiva, Subrayado, Tachado y Alineación indiquen visualmente su estado usando `--interactive-accent`.

#### Modificado
- **Hoja de Personaje – Menú contextual de token:** Se añadieron las opciones **Cambiar plantilla de hoja** (`changeCharacterSheet`) y **Retirar hoja de personaje** (`removeCharacterSheet`) al menú contextual del token y al encabezado del panel flotante `CharacterSheetPanel` (iconos de repetir y de quitar archivo).
- **`SelectTemplateModal`:** Detecta si ya hay una plantilla asignada (`isChange = true`), preselecciona la plantilla actual y expone un botón **Retirar Hoja** para desvincularla rápidamente.
- **Hoja de Personaje – Inspector lateral:** El clic sobre un widget ya no causa un re-render completo. Solo se actualizan las clases CSS de selección y se llama a `renderSidebar()`, eliminando el parpadeo y preservando la posición de scroll del panel.
- **Tipo `WidgetStyle`:** Se agregaron `fontStyle?: 'normal' | 'italic'` y `textDecoration?: 'none' | 'underline' | 'line-through'`.
- **`CharacterSheetRenderer.renderWidget()`:** Todas las propiedades tipográficas (`fontSize`, `fontWeight`, `fontStyle`, `textDecoration`, `textAlign`) se aplican ahora en el bloque compartido del wrapper, afectando consistentemente a todos los tipos de widget.

---

## [0.1.11] - 2026-11-04

### 🇬🇧 English

#### Added
- **Interactive Character Sheets Module (`character-sheet`):**
  - **Decoupled Architecture:** Sheet templates live in `settings.sheetTemplates` (and plugin data), while character data lives directly in note YAML frontmatter and body headings, ensuring the note remains the single source of truth.
  - **Visual Template Editor (`TemplateEditorModal`):** Full-screen visual designer with canvas, 50%–200% zoom, 10px grid snapping, drag-and-drop widget placement, corner resize handles, Z-index layer management (bring to front / send to back), and live preview mode with test fixtures.
  - **10 Core Widgets:**
    - **Background (`Fondo`):** Full-sheet vault image with configurable fit (cover / contain) and opacity.
    - **Image / Portrait (`Imagen`):** Vault-backed image linked to frontmatter key or static path with square or circular shapes.
    - **Frame / Box (`Recuadro`):** Decorative container with custom border, fill color, corner radius, and title.
    - **Label (`Literal`):** Static text for headers, titles, and labels with customizable typography, color, and alignment.
    - **Text Field (`Texto`):** Single-line or multi-line editable field with real-time 400ms debounced auto-save, supporting bindings to both frontmatter keys and markdown body headings (e.g. `## Biography`).
    - **Counter (`Contador`):** Numeric tracker with increment/decrement buttons, min/max limits supporting dynamic `@key` references (e.g. `max: @maxHp`), number and/or progress bar display, and click-to-roll formula shortcuts.
    - **Checkbox (`Casilla`):** Boolean toggle directly updating frontmatter.
    - **Button (`Botón`):** Interactive action button executing dice roll formulas with `@key` resolution, optional 3D Dice Roller integration, and inline bubble result display.
    - **List (`Lista`):** Dynamic YAML array editor for items with add, edit, and delete controls.
    - **Grid / Table (`Cuadrícula`):** Multi-column structured data table supporting text, number, and checkbox columns with dynamic rows.
    - **Calculated Field (`Calculado`):** Read-only auto-computed field evaluating math expressions and functions (`floor`, `ceil`, `round`, `abs`, `min`, `max`) derived from `@key` properties in real time.
  - **Dice Roller Integration & Formula Engine:** Substitutes `@key` variables from frontmatter before rolling, supports safe mathematical evaluations, bridges with `window.DiceRoller` (with 3D animation) and internal PRNG fallback, and automatically records rolls into Dice Tray history.
  - **Floating Gameplay Panel (`CharacterSheetPanel`):** Persistent draggable and minimizable panel with zoom controls, real-time two-way synchronization with note frontmatter, external modification detection via `metadataCache`, and direct template editor shortcut. Multiple sheets can be opened simultaneously for different characters.
  - **Token Integration & Auto-Sync:** Added "Open Character Sheet" to token context menu when a note is linked. Modifying HP, Max HP, or portrait in the sheet automatically syncs with the token on the tactical map. If a note lacks the sheet property, prompts with `SelectTemplateModal` to assign a template.
  - **Template Manager Modal (`TemplateManagerModal`):** Complete template administration interface to create, edit, duplicate, delete, and manage templates. Added 1-click **Export as `.dinovtt` Package** (`ExportSheetPackageModal`) which bundles the template (`sheet.json`), internal manifest, and vault background images into a distributable archive with SHA-256 calculation, as well as a 1-click GitHub Store PR bundle generator. Added a file picker to import standalone `.dinovtt` or JSON template files directly.
  - **Campaign Export & Import Bundle:** Seamlessly packages used sheet templates and referenced vault images into `.dinovtt` campaign bundles.
- **Random Tables Panel Resizing & Maximize Mode:** Added interactive edge and corner drag handles (right, bottom, left, corners) with persistent size saving in settings (`randomTablesPanelSize`). Added a 1-click Maximize/Restore toggle button in the header, increased default width to 440px, and decoupled the scrollable table list from the result card so roll results and action buttons are always fully visible without clipping.
- **Modernized Modules Modal & Categorized Grid (`ModulesModal`):** Redesigned the 12-module flat list into a 760px responsive two-column grid organized into 3 purpose-driven categories (Combat & Tactical Board, Campaign & Characters, Tabletop & Chance). Added quick filter pills (`[All]`, `[Combat]`, `[Campaign]`, `[Dice / Chance]`), active module count badges, real-time search filtering, quick actions (`Enable all`, `Disable all`, `⚡ Lightweight preset`), full-card click-to-toggle interaction, and distinctive category accent borders when active.
- **Dino Community Store & Package Client (`StoreModal`):**
  - **Zero-Backend Architecture:** Decentralized package catalog fetched directly from GitHub (`catalog.json`) via `raw.githubusercontent.com` using Obsidian's `requestUrl`, avoiding CORS limits and maintaining full privacy without intermediate servers.
  - **Single-Archive Atomic Package Format (`.dinovtt`):** All store packages (campaigns, character sheets, random tables, oracle decks, wargame rosters, and all-in-one bundles) distribute as `.dinovtt` containers (standard ZIP DEFLATE). Downloads are atomic and verified using cryptographic SHA-256 digests before extracting with `JSZip`.
  - **Store Client UI (`StoreModal`):**
    - **Explore Tab:** Real-time search across title, tags, description, and author. Type filter pills (`[All]`, `[Campaigns]`, `[Sheets]`, `[Tables]`, `[Oracle]`, `[Wargame]`, `[All-in-one]`), package cards with preview thumbnails, version badges, size metrics, and required module checks.
    - **Package Inspector / Detail View:** Dedicated detail page with preview image, metadata breakdown (author, version, license, language, SHA-256 hash), one-click missing module enabler, external purchase/store link for commercial creator content, and full package `README.md` rendered via Obsidian's `MarkdownRenderer`.
    - **Installed Tab:** Overview of all installed packages in the current vault with version tracking, install dates, vault paths, and clean uninstallation.
    - **Sources Tab:** Configurable catalog sources allowing community groups or custom servers to provide alternative `catalog.json` feeds alongside the official repository.
  - **Store Repository Infrastructure (`store/`):** Automated catalog compilation tool (`store/scripts/build-catalog.mjs`), CI GitHub Action workflow (`validate-and-build-catalog.yml`), community submission guidelines, and starter example package (`aventura-ejemplo`). Dedicated toolbar button and command palette entry (`open-store`).

### 🇪🇸 Español

#### Agregado
- **Módulo de Hojas de Personaje Interactivas (`character-sheet`):**
  - **Arquitectura Desacoplada:** Las plantillas viven en `settings.sheetTemplates`, mientras que los datos residen en el frontmatter YAML y encabezados de la nota del personaje, preservándola como la única fuente de verdad.
  - **Editor Visual de Plantillas (`TemplateEditorModal`):** Diseñador visual con lienzo, zoom 50%–200%, ajuste magnético a cuadrícula de 10px, arrastre y redimensionado de widgets, gestión de capas por Z-index y modo de previsualización interactiva con datos de prueba.
  - **10 Widgets Integrados:**
    - **Fondo:** Imagen de fondo desde el vault con ajuste (cubrir / contener) y opacidad regulable.
    - **Imagen / Retrato:** Retrato vinculado a clave de frontmatter o ruta estática, en forma cuadrada o circular.
    - **Recuadro:** Marco decorativo o contenedor con borde, fondo, radio y título configurable.
    - **Literal:** Texto fijo para etiquetas y títulos con formato tipográfico personalizable.
    - **Texto:** Campo editable de una o múltiples líneas con guardado en segundo plano (debounce 400ms), enlazable a claves frontmatter o encabezados del cuerpo Markdown (`## Historia`).
    - **Contador:** Control numérico con botones +/−, rangos mínimos y máximos estáticos o dinámicos mediante `@clave` (ej. `max: @vidaMax`), visualización numérica y barra de progreso, y tiradas al hacer clic.
    - **Casilla:** Interruptor booleano sincronizado con el frontmatter.
    - **Botón:** Botón de acción con tiradas de dados, resolución de `@clave`, render 3D opcional con Dice Roller y burbuja de resultado temporal.
    - **Lista:** Editor dinámico de listas en formato de arreglo YAML con añadir, editar y eliminar ítems.
    - **Cuadrícula:** Tabla estructurada con columnas de texto, número o casilla y filas dinámicas.
    - **Calculado:** Campo de solo lectura que evalúa en tiempo real operaciones matemáticas y funciones (`floor`, `ceil`, `round`, `abs`, `min`, `max`) basadas en `@clave`.
  - **Integración con Dice Roller y Sustitución de Variables:** Reemplazo automático de variables `@clave` antes de tirar, evaluación matemática segura, puente con `window.DiceRoller` (render 3D) y respaldo aleatorio interno, con guardado en el historial de la bandeja de dados.
  - **Panel Flotante de Juego (`CharacterSheetPanel`):** Panel persistente arrastrable y minimizable con zoom regulable, sincronización bidireccional inmediata, actualización reactiva ante cambios externos de la nota y acceso directo al editor de plantillas. Admite múltiples fichas abiertas simultáneamente.
  - **Integración con Tokens de Mapa:** Opción "Abrir hoja de personaje" en el menú contextual de tokens con nota vinculada. Cambios en vida o imagen se sincronizan en vivo con el token en el tablero. Modal `SelectTemplateModal` para asignar plantilla si la nota aún no la tiene.
  - **Template Manager Modal (`TemplateManagerModal`):** Interfaz para crear, duplicar, eliminar y gestionar plantillas. Incorpora **Exportar paquete `.dinovtt`** (`ExportSheetPackageModal`) que comprime la plantilla (`sheet.json`), el manifiesto interno y las imágenes de fondo asociadas con cálculo de SHA-256, junto a un generador de paquetes listos para PR en GitHub. Añade selector de archivos para importar directamente plantillas en formato `.dinovtt` o JSON.
  - **Exportación e Importación de Campaña:** Incluye automáticamente las plantillas de hoja utilizadas y sus imágenes de fondo en los archivos `.dinovtt`.
- **Redimensionamiento y Modo Maximizar en Tablas Aleatorias:** Tiradores interactivos en bordes y esquinas (derecho, inferior, izquierdo, esquinas) para redimensionar el panel arrastrando directamente, con persistencia de tamaño en ajustes (`randomTablesPanelSize`). Nuevo botón de Maximizar/Restaurar en la cabecera, ancho base ampliado a 440px y anclaje al pie de la tarjeta de resultado para evitar recortes.
- **Rediseño y Categorización del Modal de Módulos (`ModulesModal`):** Modernización completa de la lista plana de 12 módulos en una cuadrícula responsive de 2 columnas de 760px, agrupada en 3 categorías temáticas (Combate y Tablero Táctico, Campaña y Personajes, Mesa de Juego y Azar). Incorpora buscador en tiempo real, píldoras de filtro rápido (`[Todos]`, `[Combate]`, `[Campaña]`, `[Dados / Azar]`), contador dinámico de módulos activos, acciones rápidas (`Activar todos`, `Desactivar todos`, `⚡ Perfil ligero`), alternancia al pulsar en cualquier parte de la tarjeta y bordes de acento coloreados según categoría activa.
- **Tienda Comunitaria y Cliente de Paquetes (`StoreModal`):**
  - **Arquitectura sin Servidor Central:** Catálogo descentralizado consumido directamente desde GitHub (`catalog.json`) mediante `requestUrl` de Obsidian, eludiendo problemas de CORS y garantizando privacidad sin requerir servidores intermediarios.
  - **Formato Atómico de Paquete `.dinovtt`:** Distribución integral en archivos comprimidos `.dinovtt` (ZIP DEFLATE) para campañas, fichas de personaje, tablas aleatorias, mazos de oráculo y sistemas completos. Descargas atómicas con verificación criptográfica obligatoria de integridad (SHA-256) antes de la extracción con `JSZip`.
  - **Interfaz de Usuario (`StoreModal`):**
    - **Pestaña Explorar:** Buscador en tiempo real por título, autor, descripción y etiquetas; píldoras de filtrado por categoría (`[Todos]`, `[Campañas]`, `[Hojas]`, `[Tablas]`, `[Oráculo]`, `[Wargame]`, `[Todo en uno]`), tarjetas con miniaturas, versión, tamaño formateado y chequeo de dependencias de módulos.
    - **Inspector de Paquete / Vista de Detalle:** Vista pormenorizada con imagen de portada, ficha técnica (autor, versión, licencia, idioma, hash SHA-256), activación con un clic de módulos requeridos no activos, enlaces a tiendas externas para creadores comerciales y lectura del `README.md` renderizado nativamente con `MarkdownRenderer`.
    - **Pestaña Instalados:** Listado de paquetes presentes en la bóveda con versión, fecha de instalación, ruta de almacenamiento y desinstalación limpia con un solo clic.
    - **Pestaña Fuentes:** Gestión modular de repositorios permitiendo añadir fuentes personalizadas de comunidades o servidores estáticos independientes.
  - **Infraestructura del Repositorio de la Tienda (`store/`):** Script compilador de catálogo (`store/scripts/build-catalog.mjs`), flujo de integración continua con GitHub Actions (`validate-and-build-catalog.yml`), guía de publicación para la comunidad y paquete de ejemplo ("La Cripta del Nigromante"). Acceso directo desde botón en la barra del tablero e instrucción en la paleta de comandos (`open-store`).

## [0.1.10] - 2026-10-25

### 🇬🇧 English

#### Added
- **Persistent Campaign Characters (Party System):**
  - **Global Campaign Characters Registry:** Added `CampaignCharacter` entity stored at the campaign level, enabling persistent characters across any map or canvas.
  - **Party Management Modal (`PartyModal`):** Search, create, edit, delete, and deploy party members with real-time stats overview (HP bar, active conditions, inventory badges, and current map location).
  - **Character Editor (`PartyCharacterEditModal`):** Direct configuration of character name, token color, size, HP/Max HP, RPG icon picker, token avatar image, note links with frontmatter stat reading, and live counters editor.
  - **State Inheritance Selection (`PartyInheritModal`):** When placing a persistent character onto a new map, users can choose between transferring current state (remaining HP, conditions, inventory) or starting fresh (reset to full HP and cleared conditions).
  - **Configurable Inheritance Modes:** Added campaign-level setting `characterSyncMode` (`prompt` | `always` | `never`), allowing groups to automatically inherit, always reset, or ask every time.
  - **Two-Way Live Synchronization:** Any modification made on a map token (damage, healing, counter changes, conditions, inventory adjustments, and edit modal saves) immediately writes back to the campaign character.
  - **Token Quick Actions & Visual Badges:** Persistent tokens display a star badge (`⭐`), with token context menu options to link any existing map token into the Campaign Party or unlink it.
  - **Campaign Export & Import Compatibility (v2 Package Manifest):** Fully bundles campaign party characters, remapping and packing their avatar images, linked notes, and inventory item assets in `.dinovtt` files.
  - **Modular Toggle in Settings:** Registered under Optional Modules (`persistent-characters`) with integrated toolbar pill and dock button.
- **Random Tables Engine (`random-tables`):**
  - **Markdown Table Parser & Validator:** Full parsing support for numeric ranges (`1`, `2-4`, `01-05`), weighted distribution (`Peso`, `%`), and uniform lists, along with extra metadata columns. Deep validation detects overlapping ranges, missing numeric gaps according to dice formulas, and invalid bounds.
  - **Multi-Table Markdown Hierarchy:** Recognizes multiple tables within the same note demarcated by Markdown headers (`#`, `##`, etc.) and reads frontmatter configuration (`dte-table`, `dte-tags`, `dte-name`, `dte-roll`, `dte-campaign`).
  - **Campaign & Global Scopes:** Note tagging `#dte-table` sets global scope, while `#dte-table/<campaign>` scopes tables to specific campaigns.
  - **Reactive Vault Indexer:** Real-time indexing powered by `metadataCache.on('changed')` and vault event listeners, keeping tables updated upon edit without saving stale duplicates to `data.json`.
  - **Flexible Roll Engine & No-Repeat:** Evaluates dice formulas (`1d6`, `1d20`, `2d6+2`, `d100`), weighted probabilities, or uniform distributions. Includes a toggleable "No Repeat" (without replacement) mode that tracks used entries, flags exhaustion, and provides one-click resetting.
  - **Nested Rolls & Chained Tables:** Automatically evaluates embedded dice rolls (e.g. `2d6 coins` -> `7 (2d6) coins`) and recursively rolls chained tables referenced via `[[Table Name]]` wikilinks.
  - **Floating Interactive Panel (`RandomTablesPanel`):** Draggable and minimizable floating panel featuring real-time search, tag filtering, campaign/global categorization, inline quick-roll (`⟳`), table row previews with warning badges, result action cards (re-roll, copy markdown, open source note, insert into active note editor), and campaign-scoped persistent history with editable annotations.
  - **Settings & Command Integration:** Configurable tag prefix setting in Dino Tabletop options, command palette entry (`open-random-tables`), and dock toolbar integration.

### 🇪🇸 Español

#### Agregado
- **Personajes Persistentes de Campaña (Sistema de Party):**
  - **Registro Global de Personajes de Campaña:** Nueva entidad `CampaignCharacter` a nivel de campaña, permitiendo tener PJs y PNJs persistentes a través de cualquier lienzo o mapa.
  - **Panel de Gestión de Party (`PartyModal`):** Interfaz para buscar, crear, editar, eliminar y colocar miembros del grupo con visualización en tiempo real (barra de vida, condiciones activas, insignias de inventario y ubicación actual en el mapa).
  - **Editor de Personaje (`PartyCharacterEditModal`):** Configuración de nombre, color de token, tamaño, vida actual y máxima, selector de iconos RPG, retrato de token, notas vinculadas con lectura de frontmatter y editor de contadores.
  - **Transferencia y Herencia de Estados (`PartyInheritModal`):** Al colocar un personaje persistente en un nuevo mapa, permite elegir entre heredar el estado actual (vida restante, condiciones, inventario) o iniciar fresco (vida completa y sin condiciones).
  - **Modos de Sincronización Configurables:** Ajuste por campaña `characterSyncMode` (`prompt` | `always` | `never`) para heredar automáticamente, reiniciar siempre o consultar en cada colocación.
  - **Sincronización Bidireccional en Tiempo Real:** Cualquier modificación sobre el token en el mapa (daño, curación, contadores, condiciones, inventario o guardado del editor) se actualiza al instante en el personaje de campaña.
  - **Insignias Visuales y Menú Contextual:** Los tokens persistentes cuentan con una insignia (`⭐`), y el menú contextual permite vincular cualquier token existente a la Party o desvincularlo.
  - **Exportación e Importación Completa (Manifest v2):** Empaqueta y remapea automáticamente retratos, notas vinculadas y activos de inventario de los personajes en archivos `.dinovtt`.
  - **Módulo Opcional en Ajustes:** Integrado en la lista de módulos opcionales (`persistent-characters`) con botón en la barra de herramientas y píldora en la cabecera.
- **Motor de Tablas Aleatorias (`random-tables`):**
  - **Parser de Tablas Markdown y Validación:** Soporte completo para rangos numéricos (`1`, `2-4`, `01-05`), selección ponderada (`Peso`, `%`) y listas uniformes, además de columnas de metadatos adicionales. Validación profunda que detecta solapamientos de rangos, huecos numéricos según la fórmula de dados y límites no válidos.
  - **Múltiples Tablas por Nota:** Reconoce varias tablas en una misma nota delimitadas por encabezados Markdown (`#`, `##`, etc.) y lee metadatos desde el frontmatter (`dte-table`, `dte-tags`, `dte-name`, `dte-roll`, `dte-campaign`).
  - **Alcance Global y por Campaña:** La etiqueta `#dte-table` asigna alcance global, mientras que `#dte-table/<campaña>` restringe la tabla a la campaña indicada.
  - **Indexador Reactivo:** Indexación en tiempo real impulsada por `metadataCache.on('changed')` y eventos del vault, manteniendo las tablas actualizadas en vivo sin almacenar copias redundantes en `data.json`.
  - **Motor de Tiradas y Modo Sin Reposición:** Resuelve fórmulas de dados (`1d6`, `1d20`, `2d6+2`, `d100`), pesos proporcionales y azar uniforme. Incluye modo opcional "Sin reposición" que lleva registro de filas usadas, alerta cuando la tabla se agota y permite reiniciarla.
  - **Tiradas Anidadas y Tablas Encadenadas:** Resuelve automáticamente fórmulas de dados incrustadas en el resultado (ej. `2d6 monedas` -> `7 (2d6) monedas`) y encadena recursivamente tablas vinculadas mediante enlaces `[[Nombre de Tabla]]`.
  - **Panel Flotante Interactivo (`RandomTablesPanel`):** Panel flotante arrastrable y minimizable con buscador en tiempo real, filtro por etiquetas, categorización de tablas de campaña y globales, tirada directa (`⟳`), vista previa de filas con avisos de advertencia, tarjeta de último resultado (tirar de nuevo, copiar en markdown, abrir nota fuente e insertar en la nota activa) e historial persistente por campaña con notas editables.
  - **Ajustes y Comandos:** Prefijo de tag configurable desde la pestaña de ajustes de Dino Tabletop, comando en la paleta de Obsidian (`open-random-tables`) e integración en la barra de herramientas del tablero.

## [0.1.9] - 2026-10-25

### 🇬🇧 English

#### Changed
- **Obsidian API Compatibility (`obsidianmd/no-unsupported-api`):** Bumped `minAppVersion` to `1.13.0` in `manifest.json` ensuring full support for modern destructive button APIs (`setDestructive()`).
- **Command Registration Standards:** Removed redundant plugin ID prefix from command identifier in `main.ts` (`open-view` instead of `open-dino-tabletop-engine`), preventing duplicate namespacing in Obsidian's command palette.
- **Dependency Modernization:** Replaced external `builtin-modules` package with native `node:module` import in `esbuild.config.mjs`, eliminating unnecessary npm dependency.
- **Cross-Window Safe DOM Type Checking:** Replaced cross-window unsafe `instanceof HTMLElement` with Obsidian's native `.instanceOf(HTMLElement)` helper in `diceTray.ts`.
- **Config Directory Compliance:** Replaced hardcoded `.obsidian` path fallback with dynamic `app.vault.configDir` retrieval in `cellStore.ts`.
- **Strict TypeScript Typing & Linter Compliance (`no-unsafe-*`):**
  - Resolved unnecessary type assertions (`as TranslationKey`, `as unknown as MouseEvent`) across module registrations and view handlers.
  - Replaced `any` with strong `IDinoTabletopView` and `DinoPlugin` typings across modules (`campaignDiary`, `cards`, `diceTray`, `measure`, `missions`, `oracle`, `playerView`, `timeline`, `wargame`).
  - Fixed unsafe arguments and return types in `cellBoardSelect`, `BestiaryModals`, and `OraclePanel`.
  - Accurately typed event listeners as `EventListener` and `EventRef` to eliminate unsafe argument conversions.

### 🇪🇸 Español

#### Modificado
- **Compatibilidad con API de Obsidian (`obsidianmd/no-unsupported-api`):** Se actualizó `minAppVersion` a `1.13.0` en `manifest.json` para garantizar soporte nativo de botones destructivos (`setDestructive()`).
- **Estandarización de Comandos:** Se eliminó el prefijo redundante del ID del plugin en `main.ts` (`open-view` en lugar de `open-dino-tabletop-engine`), evitando duplicación en la paleta de comandos de Obsidian.
- **Modernización de Dependencias:** Se reemplazó el paquete externo `builtin-modules` por la API nativa de Node `node:module` en `esbuild.config.mjs`, removiendo la dependencia innecesaria.
- **Comprobación de Tipos DOM Segura entre Ventanas:** Se reemplazó `instanceof HTMLElement` por el helper nativo de Obsidian `.instanceOf(HTMLElement)` en `diceTray.ts`.
- **Directorio de Configuración Dinámico:** Se eliminó la ruta harcodeada `.obsidian` usando `app.vault.configDir` en `cellStore.ts`.
- **Tipado Estricto y Resolución de Warnings (`no-unsafe-*`):**
  - Se eliminaron aserciones innecesarias (`as TranslationKey`, `as unknown as MouseEvent`) en el registro de módulos y manejadores de vistas.
  - Se reemplazó `any` por tipos estrictos (`IDinoTabletopView`, `DinoPlugin`) en todos los módulos principales (`campaignDiary`, `cards`, `diceTray`, `measure`, `missions`, `oracle`, `playerView`, `timeline`, `wargame`).
  - Se corrigieron retornos y argumentos inseguros en `cellBoardSelect`, `BestiaryModals` y `OraclePanel`.
  - Se tiparon correctamente los listeners de eventos como `EventListener` y `EventRef`.

## [0.1.8] - 2026-10-17

### 🇬🇧 English

#### Added
- **Official MIT License:** Added root `LICENSE` file adhering to Obsidian Community Plugins requirements.

#### Changed
- **Obsidian API Compatibility:** Bumped `minAppVersion` to `1.5.0` in `manifest.json` ensuring compatibility with modern Obsidian APIs (`obsidianmd/no-unsupported-api`).
- **Standardized Description:** Formatted manifest description in English without redundant name prefix or forbidden keywords.
- **Settings UI Canonization:** Refactored settings tab headings to use `new Setting(containerEl).setName(...).setHeading()` for consistent typography and theme integration.
- **CSS Architecture & Linting (`no-static-styles-assignment`):**
  - Refactored static inline style assignments across views, modales, and modules into dedicated CSS classes in `styles.css`.
  - Adopted Obsidian element helpers (`setCssStyles`, `.hide()`, `.show()`) for dynamic positioning and visibility toggles.
  - Removed deprecated `speak: none` property from embedded icon font styles.

### 🇪🇸 Español

#### Agregado
- **Licencia MIT Oficial:** Se agregó el archivo `LICENSE` en la raíz del repositorio cumpliendo con las directrices de plugins comunitarios de Obsidian.


#### Modificado
- **Compatibilidad con API de Obsidian:** Se actualizó `minAppVersion` a `1.5.0` en `manifest.json`, resolviendo advertencias de APIs no soportadas (`obsidianmd/no-unsupported-api`).
- **Descripción Estandarizada:** Se actualizó la descripción del manifiesto en inglés, sin prefijo redundante del nombre ni uso de la palabra "Obsidian".
- **Encabezados en Ajustes:** Se migraron los encabezados de la pestaña de configuración a `new Setting(containerEl).setName(...).setHeading()` garantizando integración nativa con cualquier tema.
- **Arquitectura CSS y Limpieza de Estilos (`no-static-styles-assignment`):**
  - Se eliminaron las asignaciones de estilos estáticos en línea en vistas, modales y módulos, migrándolos a clases reutilizables en `styles.css`.
  - Se adoptaron los métodos nativos de Obsidian (`setCssStyles`, `.hide()`, `.show()`) para transformaciones dinámicas y visibilidad.
  - Se eliminó la propiedad obsoleta `speak: none` de los estilos de la fuente de iconos embebida.

#
## [0.1.7] - 2026-10-15

### 🇬🇧 English

#### Added
- **Hierofante Module (Solo RPG Oracle):**
  - Tarot interpretation and oracle engine for solo RPG gaming based on *Hierofante*.
  - 78 preloaded tarot cards with automated vault image matching.
  - Declarative rules: Yes/No mode with variable difficulty (1–10) and Random Event mode with inverted complications.
  - Campaign-bound reading history: all extracted cards are automatically logged and preserved across sessions and exports.
  - Floating panel featuring unobscured full-card artwork view (`object-fit: contain`), 180° orientation rotation, and reading details.
- **CellBoard Improvements:**
  - Added "Pintar rectángulo" (`rectPaint`) tool and "Pintar celdas" in the selection toolbar to quickly paint cell areas by dragging a rectangle.
  - Added drag handle to the lateral toolbar with position persistence so it can be moved freely without obscuring campaign headers or controls.
  - Added right-click guards to all board drawing/moving tools to preserve the context menu.
  - Fixed laser pointer remaining visible after switching tools or leaving the canvas.

### 🇪🇸 Español

#### Agregado
- **Módulo Hierofante (Oráculo para Rol en Solitario):**
  - Motor de consulta e interpretación de tarot para juegos en solitario basado en *Hierofante*.
  - 78 cartas pre-cargadas con nombres, palos, palabras clave y emparejador masivo de imágenes desde la bóveda.
  - Reglas declarativas: Modo Sí/No con dificultad configurable (1–10) y Evento aleatorio con giros para cartas invertidas.
  - Historial persistente por campaña: cada carta extraída se registra automáticamente y se exporta/importa junto con la campaña.
  - Panel flotante con vista completa de carta (`object-fit: contain`), giro de 180° y desglose de resultados.
- **Mejoras en CellBoard:**
  - Se agregó la herramienta "Pintar rectángulo" (`rectPaint`) y el botón "Pintar celdas" en la barra de selección para rellenar áreas rectangulares de celdas mediante arrastre.
  - Barra de herramientas lateral ahora es arrastrable (con tirador de agarre) y guarda su posición para no solapar el selector de campañas.
  - Se bloquearon las acciones de dibujo/movimiento con clic derecho para permitir el uso libre del menú contextual.
  - Se solucionó el problema por el cual el puntero láser permanecía en pantalla tras cambiar de herramienta o salir del canvas.

#
## [0.1.6] - 2026-10-14

### 🇬🇧 English

#### Added
- **CellBoard (Interactive Cell Board Canvas):**
  - New procedural grid-based board type (`cellMap`, `coordSpace: 'world'`) with infinite canvas support.
  - Dedicated lateral tools dock (`CellBoardLateralToolbar`):
    - **Move / Navigate:** Smooth viewport panning and cursor-anchored zoom.
    - **Cell Painting & Erasing:** Tactical grid cell coloring with customizable palette and eraser mode.
    - **Flood Fill:** Fast area filling for contiguous cell regions.
    - **Borders & Walls:** Place and manage horizontal and vertical tactical wall segments.
    - **Cellular Fog of War:** Interactive fog painting/revealing with auto-reveal based on token vision radius (`token.revealsFog`).
    - **Advanced Selection Tool:** Marquee selection box, multi-entity group drag with grid snapping, copy/paste clipboard, and deletion with full Undo/Redo history.
    - **Laser Pointer & Attention Ping:** Transient laser trails and animated ping markers for live table direction.
- **Quest & Mission Logs Module:**
  - Dedicated tracker panel for campaign quests, main/secondary objectives, rewards, and linked Markdown notes.

#### Fixed
- **World-Space Entity Dragging & Grid Snapping:**
  - Fixed token and POI movement in CellBoard boards: resolved coordinate clamping bug where legacy percentage snap (`snapCoordsToGrid`) corrupted world pixel positions upon release.
  - Added [snapWorldToCell](file:///Users/snifer/Downloads/dino-tabletop-engine/dino-tabletop-engine-src/src/modules/cellCoordinates.ts#L88) to align tokens cleanly centered within cell boundaries.
  - Implemented relative delta dragging to eliminate pointer jumping when picking up tokens or POIs.
  - Seamless delegation between the Select tool and entity drag handlers.

---

### 🇪🇸 Español

#### Añadido
- **CellBoard (Pizarra de Celdas Interactiva):**
  - Nuevo tipo de mapa procedural basado en celdas (`cellMap`, `coordSpace: 'world'`) sobre un lienzo infinito.
  - Barra lateral de herramientas tácticas (`CellBoardLateralToolbar`):
    - **Mover / Navegar:** Panning fluido del viewport y zoom centrado en la posición del puntero.
    - **Pintar y Borrar Celdas:** Pintado táctico directo sobre la grilla con selector de colores y borrador.
    - **Rellenar Región (Flood Fill):** Relleno rápido de bloques de celdas contiguas.
    - **Bordes y Muros:** Creación y gestión de paredes y barreras tácticas horizontales y verticales.
    - **Niebla de Guerra Celular:** Pintado y revelado de celdas, con revelado automático por radio de visión del token (`token.revealsFog`).
    - **Herramienta de Selección Avanzada:** Selección por recuadro (marquee), arrastre grupal con snap a la grilla, copiar/pegar y eliminación con historial completo de Deshacer / Rehacer (Undo / Redo).
    - **Puntero Láser y Ping de Atención:** Trazos láser temporales y marcadores animados de atención en el tablero.
- **Módulo de Misiones y Bitácora (Quest & Mission Logs):**
  - Panel dedicado para gestionar misiones principales y secundarias, objetivos, recompensas y notas asociadas.

#### Corregido
- **Arrastre de Entidades y Ajuste a Grilla en Espacio de Mundo:**
  - Corrección en el movimiento de tokens y POIs en CellBoard: resuelto el error donde el ajuste porcentual legacy (`snapCoordsToGrid`) rompía las coordenadas en píxeles al soltar el ratón.
  - Incorporado [snapWorldToCell](file:///Users/snifer/Downloads/dino-tabletop-engine/dino-tabletop-engine-src/src/modules/cellCoordinates.ts#L88) para centrar tokens de manera precisa dentro de cada celda.
  - Implementado arrastre por desplazamiento relativo (delta), eliminando saltos bruscos al hacer clic y arrastrar.
  - Convivencia transparente entre la herramienta Selección y los controladores de movimiento de fichas.

---

## [0.1.5] - 2026-10-06

### 🇬🇧 English

#### Added
- **Campaign Export & Import System (`.dinovtt`):**
  - Standalone `.dinovtt` package bundle format with full ZIP compression.
  - Automatic harvesting and bundling of map backgrounds, token avatars, POI images, drawing images, and cards.
  - Optional Markdown notes inclusion for tokens, POIs, inventory items, and Campaign Diary session logs.
  - **Bestiary Pack Integration:** Filter and bundle creatures by specific Bestiary packs (`entry.pack`), creatures currently placed on maps, all creatures, or none.
  - Automatic vault folder structuring and asset path remapping on import.
  - Import campaign button in the main toolbar and export option in the Campaign options menu.

---

### 🇪🇸 Español

#### Añadido
- **Sistema de Exportación e Importación de Campañas (`.dinovtt`):**
  - Formato de paquete bundle `.dinovtt` con compresión ZIP completa.
  - Recolección y empaquetado automático de fondos de mapas, avatares de tokens, imágenes de POIs, dibujos y cartas.
  - Inclusión opcional de notas Markdown vinculadas a tokens, POIs, inventario y diario de campaña.
  - **Integración con Paquetes del Bestiario:** Selección y filtrado de criaturas por paquetes específicos (`entry.pack`), solo criaturas usadas en los mapas, bestiario completo o ninguno.
  - Estructuración automática de carpetas en la bóveda y remapeo de rutas relativas al importar.
  - Botón de importar campaña en la barra de herramientas y opción de exportar en el menú de opciones de campaña.

---

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
