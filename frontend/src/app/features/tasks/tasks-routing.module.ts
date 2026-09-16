import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TasksUnifiedComponent } from './tasks-unified.component';
import { TaskConfigComponent } from './config/task-config.component';
import { AdminGuard } from '../../core/guards/admin.guard';

const routes: Routes = [
  { path: '', component: TasksUnifiedComponent },
  { path: 'config', component: TaskConfigComponent, canActivate: [AdminGuard] },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TasksRoutingModule {}
