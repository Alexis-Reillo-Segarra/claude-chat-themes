# Contribuir un tema

1. Crea tu tema en `~/.claude/chat-themes/<id>.json` y pruébalo con `/tema recargar` y `/tema <id>`, en la app de escritorio y, si puedes, en la terminal.
2. Haz un fork, copia el archivo a `themes/<id>.json` y abre una pull request con una captura o un GIF.

## Normas

- El `id` es único y coincide con el nombre del archivo.
- Solo datos: el JSON no puede ejecutar nada, y el mod rechaza lo que no cumpla el formato del README.
- Sprites y nombres originales: nada de personajes, logotipos ni marcas de otros.
- Que se lea bien: el contraste entre el agua y las teselas debe dejar ver los animales.
- Pon tu usuario en `author` para que se te reconozca en el panel.

## Cambios en el código

El mod está en `hooks/register.tsx` (dibujo y comandos) y `hooks/theme.ts` (formato y validación). Antes de abrir la PR:

```bash
claude plugin validate .
```
