# Spec: Validación de infraestructura al crear tarea

**Fecha:** 2026-07-02  
**Estado:** aprobado  

## Problema

Es posible crear tareas de mantenimiento para clientes que no tienen la infraestructura que esa tarea requiere (ej. tarea `SERVER_HOST_MAINTENANCE` para un cliente sin servidores ESXi). La tarea queda huérfana: se crea el ticket en Odoo pero no hay nada que mantener.

## Solución

Validar la infraestructura del cliente contra InfraDoc **antes** de persistir la tarea. Si el cliente no tiene los activos requeridos, la creación se bloquea con un mensaje claro. El frontend refleja esto filtrando los tipos de tarea disponibles al seleccionar un cliente.

---

## Mapping TaskType → infraestructura requerida

| TaskType | Campo en `ClientInfrastructureDto` |
|---|---|
| `SERVER_HOST_MAINTENANCE` | `esxiHosts.length > 0` |
| `WINDOWS_DOMAIN_MAINTENANCE` | `windowsVMs.length > 0 \|\| domainControllers.length > 0` |
| `ROUTER_MAINTENANCE` | `routers.length > 0` |
| `QNAP_MAINTENANCE` | `nas.length > 0` |
| `VEEAM_BACKUP` | `nas.length > 0` |
| `TERMINAL_MAINTENANCE` | sin chequeo |
| `SITE_VISIT` | sin chequeo |
| `AV_CONTROL` | sin chequeo |
| `UPS_CONTROL` | sin chequeo |
| `ENDPOINT_INVENTORY` | sin chequeo |

Razonamiento de VEEAM_BACKUP: el backup apunta al NAS/QNAP, si no hay NAS no hay Veeam.

---

## Backend

### 1. `InfradocIntegrationModule` — exportar `InfrastructureService`

```typescript
@Module({
  ...
  exports: [InfrastructureService],
})
export class InfradocIntegrationModule {}
```

### 2. `TasksModule` — importar `InfradocIntegrationModule`

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Task, MaintenanceLog]),
    ClientsModule,
    TechniciansModule,
    OdooIntegrationModule,
    InfradocIntegrationModule,   // nuevo
  ],
  ...
})
export class TasksModule {}
```

### 3. `TasksService` — inyección y validación

Mapa estático privado:

```typescript
private readonly INFRA_REQUIREMENTS: Partial<Record<TaskType, (i: ClientInfrastructureDto) => boolean>> = {
  [TaskType.SERVER_HOST_MAINTENANCE]:    (i) => i.esxiHosts.length > 0,
  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: (i) => i.windowsVMs.length > 0 || i.domainControllers.length > 0,
  [TaskType.ROUTER_MAINTENANCE]:         (i) => i.routers.length > 0,
  [TaskType.QNAP_MAINTENANCE]:           (i) => i.nas.length > 0,
  [TaskType.VEEAM_BACKUP]:               (i) => i.nas.length > 0,
};
```

Método privado:

```typescript
private async validateInfrastructure(clientId: string, type: TaskType): Promise<void> {
  const predicate = this.INFRA_REQUIREMENTS[type];
  if (!predicate) return;

  const infra = await this.infrastructureService.getClientInfrastructure(clientId);
  if (!predicate(infra)) {
    throw new BadRequestException(INFRA_ERROR_MESSAGES[type]);
  }
}
```

Mensajes de error por tipo (constante en el mismo archivo):

```typescript
const INFRA_ERROR_MESSAGES: Partial<Record<TaskType, string>> = {
  SERVER_HOST_MAINTENANCE:    'El cliente no tiene servidores ESXi/BMC registrados en InfraDoc',
  WINDOWS_DOMAIN_MAINTENANCE: 'El cliente no tiene VMs Windows ni controladores de dominio en InfraDoc',
  ROUTER_MAINTENANCE:         'El cliente no tiene routers/firewalls registrados en InfraDoc',
  QNAP_MAINTENANCE:           'El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc',
  VEEAM_BACKUP:               'El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc (requerido para Veeam)',
};
```

En `create()`, antes de llamar a Odoo:

```typescript
async create(dto: CreateTaskDto): Promise<Task> {
  // validaciones existentes (cliente, técnico)...

  await this.validateInfrastructure(dto.clientId, dto.type);  // nuevo — antes de Odoo

  const odooTicketId = await this.odooService.createTicket(...);
  // ...
}
```

**InfraDoc no disponible:** `InfrastructureService` lanza `ServiceUnavailableException`. Se propaga sin capturar — el cliente recibe 503 con mensaje claro.

---

## Frontend

### `TaskCreateDialogComponent`

**Nuevos campos de estado:**
```typescript
infra: ClientInfrastructureDto | null = null;
loadingInfra = false;
infraError = '';
```

**Al cambiar `clientId`** (suscripción a `form.get('clientId').valueChanges`):
1. Resetear `infra`, `infraError`, campo `type`
2. Activar `loadingInfra`
3. Llamar `infrastructureService.getByClientId(clientId)`
4. En success: guardar `infra`, recalcular `availableTaskTypes`
5. En error: setear `infraError = 'No se pudo verificar la infraestructura. Reintentá.'`, deshabilitar submit

**`availableTaskTypes` (getter computado):**
```typescript
get availableTaskTypes() {
  if (!this.infra) return this.taskTypes;  // estado inicial (sin cliente) → muestra todos
  return this.taskTypes.filter(({ value }) => {
    const predicate = this.REQUIRES_INFRA[value];
    return !predicate || predicate(this.infra!);
  });
}
```

El select se deshabilita con `loadingInfra`. Cuando `infraError` está seteado, el select también se deshabilita y se muestra el mensaje de error debajo.

**Reseteo de tipo:** si el tipo actualmente seleccionado no está en `availableTaskTypes`, resetear `form.get('type')`.

**Botón Confirmar deshabilitado** cuando `loadingInfra` o `infraError` no vacío.

**`InfrastructureService` (frontend):** si no existe en `core/services/`, crear uno con un único método `getByClientId(clientId: string): Observable<ClientInfrastructureDto>` que llama a `GET /infrastructure/:clientId`.

---

## Testing

### Backend (`tasks.service.spec.ts`)

| Caso | Resultado esperado |
|---|---|
| Tipo con restricción, cliente tiene infra | crea tarea normalmente |
| Tipo con restricción, cliente sin infra | lanza `BadRequestException` con mensaje específico |
| InfraDoc no disponible | propaga `ServiceUnavailableException` |
| Tipo sin restricción (`SITE_VISIT`, etc.) | crea tarea sin llamar a `InfrastructureService` |

`InfrastructureService` se provee como mock con `jest.fn()`.

### Frontend (`task-create-dialog.component.spec.ts`)

| Caso | Resultado esperado |
|---|---|
| Cliente con solo routers → select tipo | solo muestra `ROUTER_MAINTENANCE` y tipos sin restricción |
| Cliente con infra vacía | tipos con restricción no aparecen |
| InfraDoc falla | muestra error, botón deshabilitado |
| Tipo seleccionado queda excluido al cambiar cliente | campo `type` se resetea |
