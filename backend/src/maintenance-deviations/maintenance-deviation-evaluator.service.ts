import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { getDeviationSignals } from '../maintenance-logs/deviation-signals/deviation-signals.registry';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Task } from '../tasks/task.entity';
import { DeviationOperator } from '../deviation-rules/deviation-operator.enum';
import { DeviationRule } from '../deviation-rules/deviation-rule.entity';
import { DeviationRulesService } from '../deviation-rules/deviation-rules.service';
import { MaintenanceDeviation } from './maintenance-deviation.entity';
import { MaintenanceDeviationStatus } from './maintenance-deviation-status.enum';

@Injectable()
export class MaintenanceDeviationEvaluatorService {
  constructor(
    @InjectRepository(MaintenanceDeviation)
    private readonly repo: Repository<MaintenanceDeviation>,
    private readonly deviationRulesService: DeviationRulesService,
  ) {}

  async evaluate(log: MaintenanceLog, task: Task): Promise<MaintenanceDeviation[]> {
    const rules = (await this.deviationRulesService.findAll()).filter(
      (rule) => rule.enabled && rule.taskType === task.type,
    );
    if (rules.length === 0) return [];

    const signals = getDeviationSignals(task.type);
    const created: MaintenanceDeviation[] = [];

    for (const rule of rules) {
      const signal = signals.find((s) => s.key === rule.signalKey);
      if (!signal) continue;

      const value = signal.compute(log.payload);
      if (value === null) continue;
      if (!this.matches(rule, value)) continue;

      const existing = await this.repo.findOne({
        where: { logId: log.id, signalKey: rule.signalKey },
      });
      if (existing) continue;

      const deviation = this.repo.create({
        logId: log.id,
        taskId: task.id,
        ruleId: rule.id,
        taskType: rule.taskType,
        signalKey: rule.signalKey,
        operator: rule.operator,
        thresholdNumber: rule.thresholdNumber,
        thresholdBoolean: rule.thresholdBoolean,
        detectedValueNumber: typeof value === 'number' ? value : null,
        detectedValueBoolean: typeof value === 'boolean' ? value : null,
        helpdeskTeamId: rule.helpdeskTeamId,
        tagIds: rule.tagIds,
        status: MaintenanceDeviationStatus.PENDING,
      });
      created.push(await this.repo.save(deviation));
    }

    return created;
  }

  private matches(rule: DeviationRule, value: number | boolean): boolean {
    if (typeof value === 'boolean') {
      return rule.operator === DeviationOperator.EQ && value === rule.thresholdBoolean;
    }
    const threshold = rule.thresholdNumber as number;
    switch (rule.operator) {
      case DeviationOperator.GT:
        return value > threshold;
      case DeviationOperator.GTE:
        return value >= threshold;
      case DeviationOperator.LT:
        return value < threshold;
      case DeviationOperator.LTE:
        return value <= threshold;
      case DeviationOperator.EQ:
        return value === threshold;
    }
  }
}
