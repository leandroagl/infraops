import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../tasks/task.entity';
import { User } from '../users/user.entity';
import { CreateLogDto } from './dto/create-log.dto';
import { UpdateLogDto } from './dto/update-log.dto';
import { MaintenanceLog } from './maintenance-log.entity';

@Injectable()
export class MaintenanceLogsService {
  constructor(
    @InjectRepository(MaintenanceLog)
    private readonly logRepository: Repository<MaintenanceLog>,
    @InjectRepository(Task)
    private readonly taskRepository: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async create(
    taskId: string,
    dto: CreateLogDto,
    userId: string,
  ): Promise<MaintenanceLog> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const existing = await this.logRepository.findOne({ where: { taskId } });
    if (existing)
      throw new ConflictException('Esta tarea ya tiene un log registrado');

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (!user.technicianId)
      throw new ForbiddenException('El usuario no tiene perfil técnico');

    const log = this.logRepository.create({
      taskId,
      technicianId: user.technicianId,
      payload: dto.payload,
      notes: dto.notes ?? null,
    });
    const saved = await this.logRepository.save(log);
    return this.loadLog(saved.id);
  }

  async findByTaskId(taskId: string): Promise<MaintenanceLog> {
    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const log = await this.logRepository.findOne({
      where: { taskId },
      relations: ['task', 'technician'],
    });
    if (!log) throw new NotFoundException('Esta tarea no tiene log registrado');
    return log;
  }

  async update(taskId: string, dto: UpdateLogDto): Promise<MaintenanceLog> {
    if (Object.keys(dto).length === 0) {
      throw new BadRequestException(
        'Se debe proveer al menos un campo para actualizar',
      );
    }

    const task = await this.taskRepository.findOne({ where: { id: taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const log = await this.logRepository.findOne({ where: { taskId } });
    if (!log) throw new NotFoundException('Esta tarea no tiene log registrado');

    const updates: Partial<MaintenanceLog> = {};
    if (dto.payload !== undefined) updates.payload = dto.payload;
    if (dto.notes !== undefined) updates.notes = dto.notes;

    await this.logRepository.update(log.id, updates);
    return this.loadLog(log.id);
  }

  private async loadLog(id: string): Promise<MaintenanceLog> {
    const log = await this.logRepository.findOne({
      where: { id },
      relations: ['task', 'technician'],
    });
    if (!log) throw new NotFoundException('Log no encontrado');
    return log;
  }
}
