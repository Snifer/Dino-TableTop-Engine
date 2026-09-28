# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-09-27

### 🇬🇧 English

#### Added
- **Internationalization (i18n):** Full localization support with English and Spanish dictionaries. Includes an interface language selector in plugin settings (`Auto`, `Spanish`, `English`) with instant UI updates and fallback handling.
- **Integrated Optional Modules System:** Extensible module architecture allowing users to toggle specialized tools without cluttering the board:
  - **Combat Tracker Module (`combat-tracker`):** Round tracking, turn order progression, and quick token HP delta buttons.
  - **Cards & Decks Module (`cards`):** Integrated card & deck management tool.
- **Board Toolbar Quick Modules Modal:** Dedicated `Modules` button (`puzzle` icon) on the board toolbar to enable/disable modules on the fly.
- **Viewport-Centric Entity Placement:** Adding tokens, points of interest, or bestiary creatures now automatically places them at the center of the currently visible viewport instead of fixed defaults.

#### Changed / Fixed
- **Scroll & Viewport Position Preservation:** Canvas and board scroll position (`scrollLeft`, `scrollTop`) is now preserved across re-renders, token edits, and map updates without resetting to top-left (0, 0).
- **Toolbar UI & Icons Polish:** Semantic grouping of toolbar actions, fixed dropdown chevron overlaps, standardized SVG icon dimensions, and enhanced contrast.

---

### 🇪🇸 Español

#### Añadido
- **Internacionalización (i18n):** Soporte multilingüe completo con diccionarios en Español e Inglés. Selector de idioma en ajustes (`Automático`, `Español`, `English`) con actualización en caliente y mecanismo de respaldo (*fallback*).
- **Sistema de Módulos Opcionales Integrados:** Arquitectura extensible para activar únicamente las herramientas necesarias sin sobrecargar el tablero:
  - **Módulo Rastreador de Combate (`combat-tracker`):** Gestión de rondas, avance de turnos y ajuste rápido de HP de tokens.
  - **Módulo de Cartas y Mazos (`cards`):** Herramienta para gestión de cartas y mazos en mesa.
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
