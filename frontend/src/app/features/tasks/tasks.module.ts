import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksUnifiedComponent } from './tasks-unified.component';
import { KpiStripComponent } from './kpi-strip/kpi-strip.component';
import { CycleTableComponent } from './cycle-table/cycle-table.component';
import { SharedModule } from '../../shared/shared.module';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@NgModule({
  declarations: [TasksUnifiedComponent, KpiStripComponent, CycleTableComponent],
  imports: [CommonModule, TasksRoutingModule, SharedModule, MatButtonModule, MatIconModule],
})
export class TasksModule {}
