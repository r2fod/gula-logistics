# Mejoras — hechas hoy y candidatas futuras

## Hechas en esta sesión

- Eliminado `PartnerDashboardModal.jsx` — duplicaba `PartnerDashboardView.jsx` casi por completo (mismas pestañas: financiero, saldos, logística) y se abría encima de él sin necesidad; además rompía en móvil (overflow horizontal, contenido cortado).
- `TaskFlowGraphView.jsx` refactorizado: las 4 secciones casi-idénticas por día (martes/miércoles/jueves/viernes) que repetían la misma lógica de enlaces con nombres de trabajador hardcodeados dentro de cada bloque se unificaron en un único bucle genérico (`dayConfigs.forEach`) + helpers reutilizables (`linkAssignedWorkers`, `linkTrucksFromText`). Antes: ~120 líneas repetidas y frágiles (dependían de que el nombre apareciera literal en el texto). Ahora: ~40 líneas, y usa el campo `assigned` real.
- Corregido overflow horizontal en móvil en los dos selectores de semana (`App.jsx` y `PartnerDashboardView.jsx`).
- Eliminados 3 componentes muertos con contraseñas hardcodeadas de una versión antigua (`AdminPanel.jsx`, `LoginModal.jsx`, `SecureAccessModal.jsx`) — no los importaba nadie.
- `server/src/data/logisticsData.js` estaba totalmente desincronizado del contenido real (un stub de 13 líneas) — quedaba invisible porque el planning nunca llegó a depender de Mongo hasta hoy. Sincronizado.

## Candidatas para una futura pasada de limpieza (no hechas, para no arriesgar el estado actual)

- **Lógica de cálculo de saldos por turnos duplicada 3 veces**: `PartnerDashboardView.jsx`, y el patrón de emparejar `entrada`/`salida` para calcular horas y coste aparece también en `PayrollReportModal.jsx`. Sería un buen candidato a extraer a una función compartida (`calculateShiftsFromEntries(entries, workersList)`).
- **Construcción del mensaje de WhatsApp de saldos** (`handleSendWhatsApp`) está copiada casi al carácter en `PartnerDashboardView.jsx` y `BalancesAgreementsModal.jsx`. Candidata a mover a `apiService.js` o un `utils/whatsapp.js`.
- El patrón `typeof task === 'object' ? task.text : task` (task puede ser string u objeto) se repite en muchos componentes (`WorkerView`, `App.jsx`, `TaskFlowGraphView`, `AdminTaskEditorModal`). Ahora que todas las tareas nuevas se crean como objetos, se podría plantear (con cuidado, hay datos antiguos) normalizar todo a objeto una sola vez al cargar la semana, y quitar esa comprobación de todos los sitios.
- El *polling* de 20s para `clockEntries` y `allWeeks` son dos `setInterval` independientes en `App.jsx` — podría combinarse en uno para menos llamadas, aunque el impacto real es mínimo.

## Rendimiento / escalabilidad — notas honestas

- No hay paginación en fichajes (`GET /api/clock` trae todo). Con el volumen actual (una empresa pequeña, unos pocos fichajes al día) no es un problema real; si la plantilla crece mucho o pasan meses sin limpiar el histórico, revisarlo.
- El *bootstrap* automático de Mongo (crear el documento inicial en el primer `GET`) es correcto para esta escala, pero si algún día hay más de una "semana base" tipo `week_3`, habría que revisar esa lógica (solo bootstrapea `week_3`).
- Backend en el plan gratuito de Render: se duerme tras 15 min de inactividad, la primera petición tras eso tarda 30-50s. No es un bug, pero vale la pena que el usuario lo sepa si nota lentitud "al primer fichaje del día".
