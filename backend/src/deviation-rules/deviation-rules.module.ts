import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviationRule } from './deviation-rule.entity';
import { DeviationRulesService } from './deviation-rules.service';
import { DeviationRulesController } from './deviation-rules.controller';

@Module({
  imports: [TypeOrmModule.forFeature([DeviationRule])],
  controllers: [DeviationRulesController],
  providers: [DeviationRulesService],
  exports: [DeviationRulesService],
})
export class DeviationRulesModule {}
