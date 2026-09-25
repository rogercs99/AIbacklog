# Habbo web local v0.8.0 — checkpoint 2026-09-25

## Estado
Hito local reproducible. No se desplegó a producción y FINAL-v2 canónico sigue intacto.

Bundle completo en ChatGPT Library:
- `/Habbo 2009 Dual Linux/habbo-web-local-v0.8.0-v31-repair-20260925.zip`
- SHA-256: `7ca8aac0dcc26f44776e8a81fffd392c6146d6a4930e0cb4ed13ff1008768206`

## Causa raíz V31
El modal Director `Object expected` al materializar el avatar no era Wine, el prefix, el prompt SSO ni la figura. La build backend empaquetada contenía una regresión de serialización en `USER_OBJECTS`: un entero extra desplazaba el paquete de entidad V31.

Se reconstruyó Havana desde el commit exacto:
`b550f00f27788145d26723fd19e943aa63504a63`

Su `USER_OBJECTS` mantiene el formato compatible con V31.

## Runtime V31 v0.8.0
- PRoot 5.4: solo filesystem/binds. Nunca usar `-q`.
- QEMU i386 9.2.4 explícito.
- Wine32 5.11.
- Wrapper nativo estático para reenviar recursivamente `wine`, `wine-preloader` y `wineserver` por QEMU preservando argv[0].
- `/lib/ld-linux.so.2 -> ../usr/lib32/ld-linux.so.2` idempotente dentro del rootfs.
- `libtalloc` local de PRoot exportada cuando existe.
- `vars.txt` CRLF.
- URLs V31 de DCR/textos/variables reescritas al origen local.
- `fuse_client.cct` servido por WWW debe ser la variante compatible de hiperesp.
- Auto-submit del projector mediante XTest sobre el botón real `Jogar`; Enter/Space no son fiables.

## Prueba real gameplay
- SSO real: PASS.
- TCP 127.0.0.1:12321: ESTABLISHED.
- room 1000 RogerVideo Lab: PASS.
- G_USRS/G_STAT: PASS.
- avatar visible: PASS.
- `Object expected`: ausente con backend limpio.
- WALK #1: 2026-09-25T20:59:41.611 / AKQBQA.
- WALK #2: 2026-09-25T21:00:39.190 / AKQAPA.
- path segundo WALK: (8,9)->(7,8)->(7,7)->(7,6)->(6,5)->(5,4).
- framebuffer diff limpio: 5.053 píxeles, bbox=(471,258,599,509).

## Lifecycle real
Repetido sobre display :123, RFB 59132 y WS 18132:
- start: healthy=yes.
- status: healthy=yes.
- Xvfb/launcher/x11vnc/websockify vivos.
- stop: PASS.
- después de stop: puertos RFB/WS cerrados, sin procesos del prefix, sin procesos del cliente y sin Xvfb :123.

Se endureció stop_group a TERM + espera + KILL de respaldo para evitar PRoot residual.

## Regresiones
El bundle incluye:
- `scripts/v31_stream_runtime.sh`
- `scripts/v31_ticket_injector.py`
- `scripts/runtime/qemu-wine-wrapper.c`
- `tests/v31_regression_v080.py`
- `tests/v31_runtime_lifecycle_v07.py`
- evidencias visuales y logs sanitizados.

Antes de promoción:
1. repetir R39 real contra el mismo backend;
2. matriz Chrome integrada;
3. Safari/WebKit como gate independiente.

No reintroducir un JAR con el entero extra de USER_OBJECTS.
