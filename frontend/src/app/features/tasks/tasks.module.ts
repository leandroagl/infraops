import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksUnifiedComponent } from './tasks-unified.component';
import { KpiStripComponent } from './kpi-strip/kpi-strip.component';

@NgModule({
  declarations: [TasksUnifiedComponent, KpiStripComponent],
  imports: [CommonModule, TasksRoutingModule],
})
export class TasksModule {}
