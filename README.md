# token-diet

Plugin para que tu cuota de Claude Code dure mas, sin bajar la calidad del codigo. No comprime la salida de los comandos: para eso sigue usando una herramienta aparte (por ejemplo RTK).

En transcripciones reales, cerca del 80% del coste ponderado son lecturas de cache: el contexto entero se reenvia en cada llamada al modelo. Y las imagenes leidas al revisar capturas son el 95% de todo lo que devuelven las herramientas. Por eso este plugin ataca el tamano del contexto, no solo la prosa.

## Instalar

```
/plugin install token-diet --marketplace Serberar/token-diet
```

O desde la terminal:

```
claude plugin marketplace add Serberar/token-diet
claude plugin install token-diet@token-diet
```

Reinicia Claude Code despues de instalar.

## Que hace

- **Bloque de reglas** (`SessionStart`, `SubagentStart`): mete `rules.md`, unos 320 tokens, en cada sesion y subagente. Reglas de codigo (el cambio completo mas pequeno, reutilizar antes de escribir, nada de abstracciones que nadie pidio, nunca recortar validacion ni seguridad, no adivinar APIs) y de respuesta (contestar primero, sin resumenes, solo las lineas que cambian). Sustituye a plugins de estilo cuyas listas de skills y recordatorios por mensaje se reenviaban en cada llamada. Edita `rules.md` para ajustarlo.
- **Reduccion de imagenes** (`PreToolUse` en `Read`, Windows): las PNG/JPG/BMP/GIF de mas de 1280 px en el lado largo se cambian por una copia reducida y cacheada antes de que Claude las lea. Solo se aprueban sin preguntar las imagenes dentro del proyecto; las de otras rutas pasan por el aviso de permisos. `TOKEN_DIET_MAX_EDGE` cambia el limite; `0` lo apaga. Para resolucion completa, copia el archivo a un nombre que contenga `.full.` y lee ese.
- **Agente `visual-check`**: revisa capturas, diapositivas y diagramas en su propio contexto y devuelve un veredicto corto, asi las imagenes no entran en la conversacion principal.
- **Aviso de `/clear` tras una pausa** (`UserPromptSubmit`): si la ultima llamada tenia 80K+ de contexto y llevas 60+ minutos parado, la cache ha caducado y seguir reescribe todo. El hook bloquea ese mensaje una vez y sugiere `/clear`; reenvia el mismo mensaje para seguir. Ajusta con `TOKEN_DIET_NUDGE_CTX` y `TOKEN_DIET_NUDGE_IDLE_MIN` (`0` en el primero lo apaga).
- **Banda con boton** (modulo `hooks/register.tsx`): desde 50K de contexto, una linea encima del cuadro de texto muestra un medidor y tres botones: `1` limpia y repite tu ultimo mensaje, `2` limpia y conserva el borrador, `3` la oculta hasta que el contexto crezca 50K mas. Desde 100K sale tambien `4` compactar: hace `/compact` pidiendo conservar rutas, decisiones, errores y pasos pendientes, y solo se ejecuta cuando Claude ha terminado, asi que no corta ninguna tarea. Solo es interfaz: no gasta tokens. `1` y `2` hacen `/clear`, asi que la conversacion actual se pierde.
- **`/token-diet:token-audit [dias]`**: reparto del coste, sesiones mas pesadas y resultados de herramientas mas grandes, leidos de `~/.claude/projects`.

## Ajuste recomendado (un plugin no puede ponerlo)

Anade a `env` en `~/.claude/settings.json`:

```json
"CLAUDE_CODE_AUTO_COMPACT_WINDOW": "200000"
```

Compacta hacia 200K en vez de cerca de 1M. Es el mayor ahorro individual. El medidor de la banda usa ese valor como escala (200K si no esta puesto).

## Tests

```
node tests/nudge.test.js
node tests/rules.test.js
node tests/shrink.test.js
claude plugin test .
```

## Licencia

MIT
