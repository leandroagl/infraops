import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TasksRoutingModule } from './tasks-routing.module';
import { TasksUnifiedComponent } from './tasks-unified.component';

@NgModule({
  declarations: [TasksUnifiedComponent],
  imports: [CommonModule, TasksRoutingModule],
})
export class TasksModule {}
