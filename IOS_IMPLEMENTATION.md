# OptiChat iOS — estado de implementación

## Línea base auditada (2026-06-20)

El commit `f9ef460` afirmaba paridad completa con Android, pero la aplicación solo contenía pantallas parciales. Entre los fallos comprobados estaban autenticación Socket.IO mediante `query` en vez de `auth`, llamadas sin `callId`, sin registro REST ni TURN, ruta de estados incorrecta, historial de llamadas interpretado con un contrato inexistente y datos ficticios en Info del contacto.

## Implementado en la reconstrucción Codex

- Sesión persistente con rotación automática de refresh token.
- Reconexión al recuperar Internet o volver la app al primer plano.
- Perfil y avatar propios conservados en almacenamiento privado para uso offline.
- Caché por conversación de chats, mensajes y multimedia; carga de todas las páginas.
- Outbox persistente para texto, fotos, videos, audio y documentos con `clientMessageId` y reintento automático.
- Presencia, escribiendo, leído, entregado, eliminado y destacado sincronizados por Socket.IO.
- Grabación de voz manteniendo pulsado, contador, deslizar arriba para bloquear, enviar o descartar.
- Multimedia normal y de visualización única, visor interno, guardado en Fotos, reenvío y documentos.
- Pulsación larga: copiar, destacar, reenviar, eliminar para mí y eliminar para todos dentro de una hora.
- Contact Info con teléfono real, presencia, audio/video, conteos, galería, destacados y almacenamiento local real liberable.
- Estados de 24 horas sobre `/statuses`, carga, publicación, reproducción y borrado.
- Perfil editable, avatar, dispositivos vinculados y copias de seguridad manuales/automáticas/restauración.
- Historial real de llamadas y rellamada.
- WebRTC con credenciales TURN del backend, `callId`, oferta REST, acuse de timbrado, ICE en cola, respuesta/finalización y solicitud aceptable de audio a video con renegociación SDP.
- Bundle ID `com.optishieldx.optichat`, versión `1.3.0 (110)` y permisos iOS descriptivos.

## Verificación local

- `npx tsc --noEmit`: correcto.
- Jest: 3 pruebas correctas (deduplicación de outbox, ventana de eliminación y client IDs).
- ESLint: sin errores.
- Metro bundle iOS Release: correcto.
- GitHub Actions run `27895172085`: build Release correcto en 4m14s.
- IPA: `dist/OptiChatIOS-1aa9190c.ipa`, 15,724,898 bytes, SHA-256 `9E2D477BF683AA687EC40233C62643DD7288BD6FE7B5235562482E9A5D69DA64`.
- El `Info.plist` extraído del IPA confirma `com.optishieldx.optichat`, versión `1.3.0`, build `110` y nombre `OptiChat`.
- El bundle empacado contiene los marcadores de cambio a video, renegociación, outbox v2, grabación bloqueable y backups.

## Pendiente de verificación/infraestructura Apple

- Instalar y probar el IPA en el iPhone real. MobAI no estaba ejecutándose en `localhost:8686` al terminar el build.
- Las llamadas/mensajes con la app terminada requieren APNs/FCM para iOS. No existe `GoogleService-Info.plist`, entitlement Push Notifications ni credencial APNs en este proyecto; no se inventarán ni se incluirán secretos falsos.
- iOS no ofrece una API que garantice bloquear una captura de pantalla estática. Se puede detectar después y avisar al remitente; la protección durante grabación/espejado sí puede ocultar contenido. Esto se tratará en la integración nativa de visualización única.
