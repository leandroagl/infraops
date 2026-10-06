import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { getDeviationSignals } from '../maintenance-logs/deviation-signals/deviation-signals.registry';
import { Task } from '../tasks/task.entity';
import { OdooService } from '../integrations/odoo/odoo.service';
import { MaintenanceDeviation } from './maintenance-deviation.entity';
import { MaintenanceDeviationStatus } from './maintenance-deviation-status.enum';

@Injectable()
export class MaintenanceDeviationsService {
  constructor(
    @InjectRepository(MaintenanceDeviation)
    private readonly repo: Repository<MaintenanceDeviation>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly odooService: OdooService,
  ) {}

  findByTaskId(taskId: string): Promise<MaintenanceDeviation[]> {
    return this.repo.find({ where: { taskId }, order: { detectedAt: 'DESC' } });
  }

  findByTaskIds(taskIds: string[]): Promise<MaintenanceDeviation[]> {
    if (taskIds.length === 0) return Promise.resolve([]);
    return this.repo.find({ where: { taskId: In(taskIds) } });
  }

  async updateStatus(
    id: string,
    status: MaintenanceDeviationStatus,
    userId: string,
  ): Promise<MaintenanceDeviation> {
    const deviation = await this.repo.findOne({ where: { id } });
    if (!deviation) throw new NotFoundException('Desvío no encontrado');
    if (deviation.status !== MaintenanceDeviationStatus.PENDING) {
      throw new ConflictException('Este desvío ya fue resuelto');
    }

    if (status === MaintenanceDeviationStatus.CONFIRMED) {
      return this.confirm(deviation, userId);
    }
    if (status === MaintenanceDeviationStatus.DISMISSED) {
      deviation.status = MaintenanceDeviationStatus.DISMISSED;
      deviation.resolvedAt = new Date();
      deviation.resolvedByUserId = userId;
      return this.repo.save(deviation);
    }
    throw new BadRequestException(`Status inválido: ${status}`);
  }

  private async confirm(
    deviation: MaintenanceDeviation,
    userId: string,
  ): Promise<MaintenanceDeviation> {
    const task = await this.taskRepo.findOne({ where: { id: deviation.taskId } });
    if (!task) throw new NotFoundException('Tarea no encontrada');

    const signal = getDeviationSignals(deviation.taskType).find(
      (s) => s.key === deviation.signalKey,
    );
    const label = signal?.label ?? deviation.signalKey;
    const value = deviation.detectedValueBoolean ?? deviation.detectedValueNumber;

    const odooTicketId = await this.odooService.createDeviationTicket(
      task.clientId,
      deviation.helpdeskTeamId ?? 0,
      deviation.tagIds,
      `Desvío detectado: ${label}`,
      `<p>Desvío detectado en un control de mantenimiento.</p><p>${label}: ${value}</p>`,
    );

    deviation.status = MaintenanceDeviationStatus.CONFIRMED;
    deviation.odooTicketId = odooTicketId;
    deviation.resolvedAt = new Date();
    deviation.resolvedByUserId = userId;
    return this.repo.save(deviation);
  }
}
