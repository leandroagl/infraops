import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../clients/client.entity';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Technician } from '../technicians/technician.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus } from './task-status.enum';
import { Task } from './task.entity';

const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  [TaskStatus.PENDING]: [TaskStatus.IN_PROGRESS, TaskStatus.NOT_DONE],
  [TaskStatus.IN_PROGRESS]: [TaskStatus.DONE, TaskStatus.ESCALATED, TaskStatus.NOT_DONE],
  [TaskStatus.DONE]: [],
  [TaskStatus.ESCALATED]: [],
  [TaskStatus.NOT_DONE]: [],
};

@Injectable()
export class TasksService {
  constructor(
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(Client)
    private readonly clientRepository: Repository<Client>,
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(MaintenanceLog)
    private readonly logRepository: Repository<MaintenanceLog>,
  ) {}

  async findAll(filters: FilterTasksDto): Promise<Task[]> {
    const where: Record<string, unknown> = {};
    if (filters.status)      where['status']      = filters.status;
    if (filters.clientId)    where['clientId']    = filters.clientId;
    if (filters.technicianId) where['technicianId'] = filters.technicianId;
    if (filters.type)        where['type']        = filters.type;

    return this.taskRepository.find({
      where,
      relations: ['client', 'technician', 'technician.user'],
      order: { scheduledDate: 'ASC' },
    });
  }

  async create(dto: CreateTaskDto): Promise<Task> {
    const client = await this.clientRepository.findOne({ where: { id: dto.clientId } });
    if (!client) throw new NotFoundException('Cliente no encontrado');

    const technician = await this.technicianRepository.findOne({ where: { id: dto.technicianId } });
    if (!technician) throw new NotFoundException('Técnico no encontrado');

    const task = this.taskRepository.create({
      clientId: dto.clientId,
      technicianId: dto.technicianId,
      type: dto.type,
      scheduledDate: dto.scheduledDate,
    });
    const saved = await this.taskRepository.save(task);
    return this.loadTask(saved.id);
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Se debe proveer al menos un campo para actualizar');
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
    if (dto.scheduledDate !== undefined) updates.scheduledDate = dto.scheduledDate;
    if (dto.odooTicketId !== undefined) updates.odooTicketId = dto.odooTicketId;

    await this.taskRepository.update(id, updates);
    return this.loadTask(id);
  }

  async updateStatus(id: string, newStatus: TaskStatus): Promise<Task> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const allowed = VALID_TRANSITIONS[task.status];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(
        `Transición inválida: ${task.status} → ${newStatus}`,
      );
    }

    const isTerminal = VALID_TRANSITIONS[newStatus].length === 0;
    const completedDate = isTerminal ? new Date() : null;
    await this.taskRepository.update(id, { status: newStatus, completedDate });
    return this.loadTask(id);
  }

  async remove(id: string): Promise<void> {
    const task = await this.taskRepository.findOne({ where: { id } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    await this.logRepository.delete({ taskId: id });
    await this.taskRepository.delete(id);
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