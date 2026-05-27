# InfraOps — Reglas de revisión de código

Este archivo define los criterios que todo código generado debe cumplir
antes de ser aceptado. Usarlo en sesiones de revisión pasando este archivo
como contexto junto con el código a revisar.

---

## Cómo usar este archivo

### Revisión manual
Antes de hacer commit, leer cada sección aplicable al módulo modificado
y verificar que el código la cumple.

### Revisión con Claude (sesión separada)
```
Contexto: [pegar REVIEW_RULES.md]
Código a revisar: [pegar el archivo o módulo]
Módulo: [nombre del módulo]

Revisá el código contra las reglas de REVIEW_RULES.md.
Listá cada problema encontrado con: regla violada, línea aproximada, corrección sugerida.
Si no encontrás problemas, indicalo explícitamente.
```

---

## Reglas generales (aplican a todo el proyecto)

### G1 — TDD
- [ ] Existe un archivo de test para cada archivo de implementación
- [ ] El test cubre el happy path y al menos un caso de error
- [ ] Los tests no dependen de estado externo (base de datos real, APIs externas)
- [ ] Se usan mocks/stubs para dependencias externas
- [ ] Todos los tests pasan antes de considerar el código listo

### G2 — TypeScript
- [ ] No se usa `any` salvo justificación explícita en comentario
- [ ] Todas las funciones tienen tipos de retorno declarados
- [ ] Las interfaces y enums están en archivos separados o en el módulo correspondiente
- [ ] No hay `console.log` en código de producción (solo en tests si es necesario)

### G3 — Nomenclatura
- [ ] Variables, funciones y clases en inglés
- [ ] Nombres descriptivos — no abreviaciones crípticas
- [ ] Enums en UPPER_SNAKE_CASE
- [ ] Clases en PascalCase, funciones y variables en camelCase
- [ ] Archivos en kebab-case

### G4 — Simplicidad
- [ ] Ninguna función hace más de una cosa
- [ ] No hay lógica duplicada que debería estar en un helper o service compartido
- [ ] No hay over-engineering: la solución más simple que resuelve el problema

---

## Reglas de backend — NestJS

### B1 — Separación de responsabilidades
- [ ] El **controller** solo recibe el request, llama al service, devuelve la respuesta
- [ ] El **service** contiene toda la lógica de negocio
- [ ] El **repository** (o TypeORM directamente) maneja el acceso a datos
- [ ] No hay queries SQL o llamadas a TypeORM en controllers

### B2 — DTOs
- [ ] Existe un DTO para cada operación de entrada (CreateXxxDto, UpdateXxxDto)
- [ ] Los DTOs usan `class-validator` para validación (`@IsString`, `@IsEmail`, etc.)
- [ ] Los DTOs de respuesta no exponen campos sensibles (ej: `passwordHash`)
- [ ] Se usa `@Exclude()` o DTOs de respuesta separados para datos sensibles

### B3 — Autenticación y autorización
- [ ] Todos los endpoints excepto `/auth/login` están protegidos con `JwtAuthGuard`
- [ ] Los endpoints que requieren rol específico usan `@Roles()` decorator + `RolesGuard`
- [ ] No se validan roles manualmente dentro del service — eso es responsabilidad del guard
- [ ] El payload del JWT contiene: `sub` (userId), `email`, `role`

### B4 — Manejo de errores
- [ ] Se usan las excepciones de NestJS (`NotFoundException`, `ForbiddenException`, etc.)
- [ ] No se devuelven errores genéricos 500 sin mensaje útil
- [ ] Los errores de validación de DTO se manejan automáticamente por ValidationPipe
- [ ] No hay try/catch vacíos o que silencian errores

### B5 — Base de datos y TypeORM
- [ ] Las entidades tienen decoradores TypeORM completos (`@Entity`, `@Column`, `@PrimaryGeneratedColumn`)
- [ ] Las relaciones tienen el tipo correcto (`@ManyToOne`, `@OneToMany`, etc.) con `cascade` explícito
- [ ] El campo `payload` de `MaintenanceLog` es `jsonb` en PostgreSQL
- [ ] No se cachean en la DB datos que vienen de InfraDoc — esos se consultan en tiempo real
- [ ] Las migraciones están generadas para cada cambio de esquema (no `synchronize: true` en producción)

### B6 — Reglas de negocio específicas
- [ ] El flujo de error siempre abre ticket Odoo ANTES de resolver o escalar
- [ ] La escalada reasigna el ticket existente, no crea uno nuevo
- [ ] El estado `ESCALATED` solo se asigna cuando un técnico senior tomó la tarea
- [ ] Las alertas de vencimiento pertenecen al módulo `notifications`, no a los módulos de tarea

### B7 — Tests de backend
- [ ] Cada service tiene tests unitarios con mocks del repository
- [ ] Cada controller tiene tests con mocks del service
- [ ] Los tests de integración (e2e) usan base de datos de test separada
- [ ] Los tests son deterministas: no dependen del orden de ejecución

---

## Reglas de frontend — Angular

### F1 — Estructura de componentes
- [ ] Componentes standalone solo si hay justificación técnica concreta documentada
- [ ] La lógica de negocio está en services, no en componentes
- [ ] Los componentes solo manejan presentación e interacción del usuario
- [ ] Inputs y outputs están tipados explícitamente

### F2 — Tablas
- [ ] Las tablas de datos usan Ag-Grid, no Angular Material table
- [ ] Angular Material table solo para tablas de configuración simple (< 5 columnas, sin paginación compleja)

### F3 — Formularios
- [ ] Se usan Reactive Forms, no Template-driven Forms
- [ ] Las validaciones están en el FormGroup, no en el template
- [ ] Los errores de validación se muestran de forma consistente en toda la app

### F4 — Autenticación en frontend
- [ ] El token JWT se guarda en `localStorage` con clave estandarizada (`infraops_token`)
- [ ] Existe un `AuthInterceptor` que agrega el header `Authorization: Bearer <token>` a cada request
- [ ] Existe un guard de rutas que redirige a `/login` si no hay token válido
- [ ] El rol del usuario determina qué rutas y elementos de UI son visibles

### F5 — Comunicación con el backend
- [ ] Toda comunicación pasa por un service Angular, nunca llamadas HTTP directas en componentes
- [ ] Se manejan los estados: loading, success, error — no dejar al usuario sin feedback
- [ ] Los errores de API se muestran de forma comprensible, no como objetos crudos

### F6 — Patrón Master/Detail Drawer
- [ ] El drawer de detalle se abre sin navegar a una ruta nueva (panel lateral)
- [ ] El estado del drawer (abierto/cerrado, ítem seleccionado) vive en el componente padre
- [ ] El drawer puede cerrarse con Escape o con el botón de cierre

---

## Reglas de integración

### I1 — InfraDoc
- [ ] Los datos de infraestructura de clientes se consultan en el momento de abrir una tarea
- [ ] No se persisten datos de InfraDoc en la base de datos de InfraOps
- [ ] Si InfraDoc no responde, la tarea puede abrirse con datos en caché temporal (máx. sesión)

### I2 — Odoo
- [ ] La apertura de tickets en Odoo ocurre siempre antes de la resolución
- [ ] El `odooTicketId` se guarda en `MaintenanceTask` después de crear el ticket
- [ ] Si Odoo no responde, el flujo debe quedar en estado que permita reintentar

### I3 — Errores de integración
- [ ] Los errores de servicios externos no deben tirar 500 al cliente
- [ ] Se loguea el error con contexto suficiente para diagnosticar
- [ ] El usuario recibe un mensaje de error accionable, no un stack trace

---

## Checklist pre-commit

Antes de cada commit, verificar:

```
[ ] Los tests pasan localmente (npm run test)
[ ] No hay errores de TypeScript (tsc --noEmit)
[ ] No hay console.log en código de producción
[ ] El código nuevo tiene su test correspondiente
[ ] El commit message está en español y describe el cambio claramente
[ ] No se commitea .env ni credenciales
```

---

## Severidad de problemas

Al revisar código, clasificar cada problema encontrado:

| Severidad | Descripción | Acción |
|---|---|---|
| 🔴 **Bloqueante** | Viola una regla de negocio crítica, expone seguridad, o rompe TDD | No mergear hasta corregir |
| 🟡 **Importante** | Viola una convención establecida o introduce deuda técnica | Corregir en el mismo ciclo |
| 🔵 **Sugerencia** | Mejora de legibilidad o alternativa más limpia | Considerar, no obligatorio |
