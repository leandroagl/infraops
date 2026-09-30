import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Task } from '../tasks/task.entity';
import { DeviationRulesModule } from '../deviation-rules/deviation-rules.module';
import { OdooIntegrationModule } from '../integrations/odoo/odoo-integration.module';
import { MaintenanceDeviation } from './maintenance-deviation.entity';
import { MaintenanceDeviationEvaluatorService } from './maintenance-deviation-evaluator.service';
import { MaintenanceDeviationsService } from './maintenance-deviations.service';
import { MaintenanceDeviationsController } from './maintenance-deviations.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([MaintenanceDeviation, Task]),
    DeviationRulesModule,
    OdooIntegrationModule,
  ],
  controllers: [MaintenanceDeviationsController],
  providers: [MaintenanceDeviationEvaluatorService, MaintenanceDeviationsService],
  exports: [MaintenanceDeviationEvaluatorService],
})
export class MaintenanceDeviationsModule {}
