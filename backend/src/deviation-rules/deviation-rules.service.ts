import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getDeviationSignals } from '../maintenance-logs/deviation-signals/deviation-signals.registry';
import { DeviationSignal } from '../maintenance-logs/deviation-signals/deviation-signal.interface';
import { TaskType } from '../tasks/task-type.enum';
import { CreateDeviationRuleDto } from './dto/create-deviation-rule.dto';
import { UpdateDeviationRuleDto } from './dto/update-deviation-rule.dto';
import { DeviationOperator } from './deviation-operator.enum';
import { DeviationRule } from './deviation-rule.entity';

export interface AvailableDeviationSignal {
  taskType: TaskType;
  key: string;
  label: string;
  valueType: 'number' | 'boolean';
}

@Injectable()
export class DeviationRulesService {
  constructor(
    @InjectRepository(DeviationRule)
    private readonly repo: Repository<DeviationRule>,
  ) {}

  findAll(): Promise<DeviationRule[]> {
    return this.repo.find();
  }

  getAvailableSignals(): AvailableDeviationSignal[] {
    return Object.values(TaskType).flatMap((taskType) =>
      getDeviationSignals(taskType).map((signal) => ({
        taskType,
        key: signal.key,
        label: signal.label,
        valueType: signal.valueType,
      })),
    );
  }

  async create(dto: CreateDeviationRuleDto): Promise<DeviationRule> {
    const signal = this.resolveSignal(dto.taskType, dto.signalKey);
    this.validateThreshold(signal, dto.operator, dto.thresholdNumber, dto.thresholdBoolean);

    const existing = await this.repo.findOne({
      where: { taskType: dto.taskType, signalKey: dto.signalKey },
    });
    if (existing) {
      throw new ConflictException(
        `Ya existe una regla para ${dto.taskType} + ${dto.signalKey}`,
      );
    }

    const rule = this.repo.create({
      taskType: dto.taskType,
      signalKey: dto.signalKey,
      operator: dto.operator,
      thresholdNumber: dto.thresholdNumber ?? null,
      thresholdBoolean: dto.thresholdBoolean ?? null,
      enabled: dto.enabled ?? true,
      helpdeskTeamId: dto.helpdeskTeamId ?? null,
      tagIds: dto.tagIds ?? [],
    });
    return this.repo.save(rule);
  }

  async update(id: string, dto: UpdateDeviationRuleDto): Promise<DeviationRule> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Regla de desvío no encontrada');

    const signal = this.resolveSignal(existing.taskType, existing.signalKey);
    const operator = dto.operator ?? existing.operator;
    const thresholdNumber =
      dto.thresholdNumber !== undefined ? dto.thresholdNumber : existing.thresholdNumber;
    const thresholdBoolean =
      dto.thresholdBoolean !== undefined ? dto.thresholdBoolean : existing.thresholdBoolean;
    this.validateThreshold(signal, operator, thresholdNumber ?? undefined, thresholdBoolean ?? undefined);

    existing.operator = operator;
    existing.thresholdNumber = thresholdNumber;
    existing.thresholdBoolean = thresholdBoolean;
    if (dto.enabled !== undefined) existing.enabled = dto.enabled;
    if (dto.helpdeskTeamId !== undefined) existing.helpdeskTeamId = dto.helpdeskTeamId;
    if (dto.tagIds !== undefined) existing.tagIds = dto.tagIds;

    return this.repo.save(existing);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.repo.findOne({ where: { id } });
    if (!existing) throw new NotFoundException('Regla de desvío no encontrada');
    await this.repo.remove(existing);
  }

  private resolveSignal(taskType: TaskType, signalKey: string): DeviationSignal<unknown> {
    const signal = getDeviationSignals(taskType).find((s) => s.key === signalKey);
    if (!signal) {
      throw new BadRequestException(
        `La señal "${signalKey}" no existe para el tipo de tarea ${taskType}`,
      );
    }
    return signal;
  }

  private validateThreshold(
    signal: DeviationSignal<unknown>,
    operator: DeviationOperator,
    thresholdNumber: number | undefined,
    thresholdBoolean: boolean | undefined,
  ): void {
    if (signal.valueType === 'boolean') {
      if (operator !== DeviationOperator.EQ) {
        throw new BadRequestException(
          `La señal "${signal.key}" es booleana: solo admite el operador "eq"`,
        );
      }
      if (thresholdBoolean === undefined || thresholdBoolean === null) {
        throw new BadRequestException(
          `La señal "${signal.key}" requiere thresholdBoolean`,
        );
      }
      return;
    }

    if (thresholdNumber === undefined || thresholdNumber === null) {
      throw new BadRequestException(`La señal "${signal.key}" requiere thresholdNumber`);
    }
  }
}
