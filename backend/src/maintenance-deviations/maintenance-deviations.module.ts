import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviationRulesModule } from '../deviation-rules/deviation-rules.module';
import { MaintenanceDeviation } from './maintenance-deviation.entity';
import { MaintenanceDeviationEvaluatorService } from './maintenance-deviation-evaluator.service';

@Module({
  imports: [TypeOrmModule.forFeature([MaintenanceDeviation]), DeviationRulesModule],
  providers: [MaintenanceDeviationEvaluatorService],
  exports: [MaintenanceDeviationEvaluatorService],
})
export class MaintenanceDeviationsModule {}
