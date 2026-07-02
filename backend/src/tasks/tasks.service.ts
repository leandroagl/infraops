import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Technician } from '../technicians/technician.entity';
import { OdooService } from '../integrations/odoo/odoo.service';
import { InfrastructureService } from '../integrations/infradoc/infrastructure.service';
import { ClientInfrastructureDto } from '../integrations/infradoc/dto/client-infrastructure.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './task-status.enum';
import { TaskType } from './task-type.enum';
import { Task } from './task.entity';

const INFRA_ERROR_MESSAGES: Partial<Record<TaskType, string>> = {
  [TaskType.SERVER_HOST_MAINTENANCE]:    'El cliente no tiene servidores ESXi/BMC registrados en InfraDoc',
  [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: 'El cliente no tiene VMs Windows ni controladores de dominio en InfraDoc',
  [TaskType.ROUTER_MAINTENANCE]:         'El cliente no tiene routers/firewalls registrados en InfraDoc',
  [TaskType.QNAP_MAINTENANCE]:           'El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc',
  [TaskType.VEEAM_BACKUP]:               'El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc (requerido para Veeam)',
};

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.IN_PROGRESS, TaskStatus.NOT_DONE],
  [TaskStatus.IN_PROGRESS]: [
    TaskStatus.DONE,
    TaskStatus.ESCALATED,
    TaskStatus.NOT_DONE,
  ],
  [TaskStatus.DONE]: [],
  [TaskStatus.ESCALATED]: [],
  [TaskStatus.NOT_DONE]: [],
};

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  private readonly INFRA_REQUIREMENTS: Partial<Record<TaskType, (i: ClientInfrastructureDto) => boolean>> = {
    [TaskType.SERVER_HOST_MAINTENANCE]:    (i) => i.esxiHosts.length > 0,
    [TaskType.WINDOWS_DOMAIN_MAINTENANCE]: (i) => i.windowsVMs.length > 0 || i.domainControllers.length > 0,
    [TaskType.ROUTER_MAINTENANCE]:         (i) => i.routers.length > 0,
    [TaskType.QNAP_MAINTENANCE]:           (i) => i.nas.length > 0,
    [TaskType.VEEAM_BACKUP]:               (i) => i.nas.length > 0,
  };

  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(MaintenanceLog)
    private readonly logRepository: Repository<MaintenanceLog>,
    private readonly odooService: OdooService,
    private readonly infrastructureService: InfrastructureService,
  ) {}

  async findAll(filters: FilterTasksDto): Promise<Task[]> {
    const where: Record<string, unknown> = {};
    if (filters.status) where['status'] = filters.status;
    if (filters.clientId) where['clientId'] = filters.clientId;
    if (filters.technicianId) where['technicianId'] = filters.technicianId;
    if (filters.type) where['type'] = filters.type;

    return this.taskRepository.find({
      where,
      relations: ['client', 'technician', 'technician.user'],
      order: { scheduledDate: 'ASC' },
    });
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    const client = await this.clientRepository.findOne({
      where: { id: dto.clientId },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const technician = await this.technicianRepository.findOne({
      where: { id: dto.technicianId },
    });
    if (!technician) throw new NotFoundException('Técnico no encontrado');

    await this.validateInfrastructure(dto.clientId, dto.type);

    const odooTicketId = await this.odooService.createTicket(
      dto.clientId,
      dto.technicianId,
      dto.type,
    );

    const task = this.taskRepository.create({
      clientId: dto.clientId,
      technicianId: dto.technicianId,
      type: dto.type,
      scheduledDate: dto.scheduledDate,
      odooTicketId,
    });
    const saved = await this.taskRepository.save(task);
    return this.loadTask(saved.id);
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Se debe proveer al menos un campo para actualizar',
      );
    }

    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    if (dto.technicianId !== undefined) {
      const technician = await this.technicianRepository.findOne({
        where: { id: dto.technicianId },
      });
      if (!technician) throw new NotFoundException('Técnico no encontrado');
    }

    const updates: Partial<Task> = {};
    if (dto.technicianId !== undefined) updates.technicianId = dto.technicianId;
    if (dto.scheduledDate !== undefined)
      updates.scheduledDate = dto.scheduledDate;
    if (dto.odooTicketId !== undefined) updates.odooTicketId = dto.odooTicketId;

    await this.taskRepository.update(id, updates);
    return this.loadTask(id);
  }

  async updateStatus(
    id: string,
    newStatus: TaskStatus,
    timeSpentMinutes?: number,
  ): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['technician', 'technician.user'],
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const allowed = VALID_TRANSITIONS[task.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transición inválida: ${task.status} → ${newStatus}`,
      );
    }

    if (newStatus === TaskStatus.IN_PROGRESS && task.odooTicketId !== null) {
      await this.odooService.markTicketInProgress(task.odooTicketId);
    }

    const isTerminal = VALID_TRANSITIONS[newStatus].length === 0;
    const completedDate = isTerminal ? new Date() : null;

    const shouldCloseTicket =
      (newStatus === TaskStatus.DONE || newStatus === TaskStatus.NOT_DONE) &&
      task.odooTicketId !== null;

    if (shouldCloseTicket) {
      const userId = task.technician?.user?.id;
      if (!userId)
        throw new BadRequestException(
          'La tarea no tiene técnico con usuario asociado',
        );

      const employeeId = await this.odooService.resolveEmployeeId(userId);
      if (employeeId === null) {
        throw new BadRequestException(
          'El técnico no tiene odooEmployeeId sincronizado',
        );
      }

      if (newStatus === TaskStatus.DONE && !timeSpentMinutes) {
        throw new BadRequestException(
          'Se requiere timeSpentMinutes para marcar una tarea como DONE',
        );
      }
      const unitAmount = (timeSpentMinutes ?? 0) / 60;
      await this.odooService.closeTicket(
        task.odooTicketId!,
        employeeId,
        unitAmount,
      );
    }

    await this.taskRepository.update(id, { status: newStatus, completedDate });

    if (newStatus === TaskStatus.DONE && task.odooTicketId !== null) {
      const log = await this.logRepository.findOne({ where: { taskId: id } });
      if (log?.notes) {
        try {
          await this.odooService.postInternalNote(task.odooTicketId, log.notes);
        } catch (err) {
          this.logger.warn(`No se pudo postear nota interna en Odoo: ${(err as Error).message}`);
        }
      }
    }

    return this.loadTask(id);
  }

  async remove(id: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    await this.logRepository.delete({ taskId: id });
    await this.taskRepository.delete(id);
  }

  private async validateInfrastructure(clientId: string, type: TaskType): Promise<void> {
    const predicate = this.INFRA_REQUIREMENTS[type];
    if (!predicate) return;

    const infra = await this.infrastructureService.getClientInfrastructure(clientId);
    if (!predicate(infra)) {
      throw new BadRequestException(INFRA_ERROR_MESSAGES[type]);
    }
  }

  private async loadTask(id: string): Promise<Task> {
    const task = await this.taskRepository.findOne({
      where: { id },
      relations: ['client', 'technician', 'technician.user'],
    });
    if (!task) throw new NotFoundException('Tarea no encontrada');
    return task;
  }
}
