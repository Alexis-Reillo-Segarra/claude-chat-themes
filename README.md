# chat-themes

Temas animados para el chat de Claude Code: una escena ASCII en mosaico (tortugas, peces, burbujas, coral…) que vive en un panel junto a la conversación. Trae tres temas, y cualquiera puede crear el suyo con un archivo JSON, sin escribir código.

| Tema | Qué es |
| --- | --- |
| `laguna` | Laguna Honu: agua turquesa, tortugas y peces amarillos |
| `atardecer` | Agua dorada al caer el sol |
| `abismo` | Arrecife bioluminiscente de noche |

## Instalar

En una sesión de Claude Code en la terminal:

```
/plugin install chat-themes --marketplace Alexis-Reillo-Segarra/claude-chat-themes
```

Responde `y` para añadir el marketplace y elige el ámbito (el de usuario es el primero).

Desde una shell:

```bash
claude plugin install chat-themes --marketplace Alexis-Reillo-Segarra/claude-chat-themes
```

En la app de escritorio, donde `/plugin` no funciona: pulsa + junto al cuadro del prompt, luego Plugins, Add marketplace con `Alexis-Reillo-Segarra/claude-chat-themes`, y después Add plugin.

## Uso

- `/tema laguna`: abre el panel con ese tema (el último elegido se recuerda entre sesiones)
- `/tema lista`: temas instalados
- `/tema recargar`: vuelve a leer los JSON tras editar uno
- `/tema off`: cierra el panel
- O pídeselo a Claude: *"pon mi chat en modo abismo"* o *"hazme un tema de selva con loros"*. Claude escribe el JSON y lo aplica.

En la app de escritorio la escena es un SVG animado; en la terminal, una rejilla de caracteres que se repinta unas 8 veces por segundo.

> Límite actual: un mod de Claude Code dibuja en paneles y bandas, no en el fondo de la ventana de la app. Por eso el tema va en un panel junto al chat.

## Crear un tema

Un tema es un JSON. Guárdalo en `~/.claude/chat-themes/<id>.json` y ejecuta `/tema recargar`.

```json
{
  "id": "mi-tema",
  "label": "Mi tema",
  "description": "Una línea que lo describe",
  "author": "tu-usuario-de-github",
  "water": { "top": "#d4f1f2", "bottom": "#4f9fd3" },
  "dots": "#ffffff",
  "bubble": "#ffffff",
  "tiles": { "S": "#9c7a2c", "s": "#d9b65a", "h": "#e9d98a", "f": "#cdb86a",
             "y": "#f3d64a", "o": "#f0a63a", "w": "#f4f1e4",
             "p": "#e86f86", "P": "#c94c68", "g": "#5fb38a", "G": "#3d8f6c" }
}
```

| Campo | Obligatorio | Qué hace |
| --- | --- | --- |
| `id` | sí | minúsculas, números y guiones; es lo que va tras `/tema` |
| `label` | sí | nombre visible (máx. 40) |
| `description`, `author` | no | se muestran bajo la escena |
| `water.top`, `water.bottom` | sí | degradado del agua, `#rrggbb` |
| `dots`, `bubble` | no | color de la trama de puntos, los reflejos y las burbujas |
| `tiles` | sí | color de cada letra de los sprites |
| `glyphs` | no | qué caracteres se dibujan sobre cada tesela (`"S": "%&#"`) |
| `sprites` | no | dibuja tus propios animales (ver abajo) |

### Sprites propios

Cada sprite es una lista de filas; cada carácter es una tesela del color de `tiles`, y `.` es hueco. `big` y `small` llevan dos fotogramas que se alternan (el aleteo); `floor` es lo que crece en el fondo. Máximo 24×24.

```json
"sprites": {
  "big":   [["..mmmm..", ".mMMMMm.", "..t.t.t."], ["..mmmm..", ".mMMMMm.", ".t.t.t.."]],
  "small": [[".cc", "cCc"], ["cc.", "cCc"]],
  "floor": ["..r..", ".rRr.", "rRRRr"]
}
```

Hay un ejemplo completo en [`examples/medusas.json`](examples/medusas.json). Los sprites que no definas usan los de la laguna.

## Compartir tu tema

Abre una pull request que añada tu JSON a `themes/`. Las normas están en [CONTRIBUTING.md](CONTRIBUTING.md). Cuando se fusiona, todos los que tienen el mod instalado lo reciben al actualizar.

## Licencia

MIT
