# token-diet

Plugin para que tu cuota de Claude Code dure mas, sin bajar la calidad del codigo. No comprime la salida de los comandos: para eso sigue usando una herramienta aparte (por ejemplo RTK).

En transcripciones reales, mas del 70% del coste ponderado son lecturas de cache: el contexto entero se reenvia en cada llamada al modelo. Las respuestas de Claude son solo un 7%. Por eso este plugin ataca el tamano del contexto, no solo la prosa.

## Cuanto ahorra

Estimado sobre unas 5.700 llamadas reales al modelo (17 sesiones de programacion), con los pesos de coste de la API. Partiendo de 100:

| Como lo usas | Coste | Ahorro |
|---|---|---|
| Sin nada | 100 | - |
| Solo el ajuste recomendado (abajo) | 57 | 43% |
| Ajuste + plugin, sin tocar la banda | 55 | **45%** |
| Ajuste + plugin, usandolo bien (ver abajo) | 47 | **53%** |

El plugin por si solo, sin hacer nada, ahorra un 3%: reglas de respuesta (1%), aviso tras una pausa (1-2%) y capturas reducidas (0,2%). El resto sale de compactar o limpiar al acabar cada tarea. Limpiar al cambiar de tarea ahorra aun mas, pero no se puede medir en las transcripciones y no esta contado.

## Como usarlo bien

1. **Pon el ajuste recomendado** (`CLAUDE_CODE_AUTO_COMPACT_WINDOW`, abajo). Es el mayor ahorro y no lo puede poner un plugin.
2. **Al acabar una tarea, pulsa `2` compactar** si la banda lo ofrece (desde 100K). Conservas el hilo y el contexto baja. Nunca corta una tarea a medias: solo se ejecuta cuando Claude ha terminado.
3. **Al empezar algo que no tiene que ver, pulsa `1` limpiar** (`/clear`). Vuelves al contexto minimo; la conversacion anterior se pierde.
4. **Si el aviso tras una pausa te para, haz caso** salvo que sigas con lo mismo: tras una hora la cache ha caducado y seguir reescribe todo el contexto.
5. **Usa RTK al lado** para comprimir la salida de los comandos, que este plugin no toca.
6. **Revisa capturas con el agente `visual-check`** en vez de leerlas en la conversacion principal.

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
- **Banda con boton** (modulo `hooks/register.tsx`): desde 50K de contexto, una linea encima del cuadro de texto muestra un medidor y los botones `1` limpiar (hace `/clear` y conserva lo que tengas escrito) y `3` ocultar (hasta que el contexto crezca 50K mas). Desde 100K sale tambien `2` compactar: hace `/compact` pidiendo conservar rutas, decisiones, errores y pasos pendientes, y solo se ejecuta cuando Claude ha terminado, asi que no corta ninguna tarea. Solo es interfaz: no gasta tokens. `1` hace `/clear`, asi que la conversacion actual se pierde.
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
