import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TasksUnifiedComponent } from './tasks-unified.component';

const routes: Routes = [
  { path: '', component: TasksUnifiedComponent },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class TasksRoutingModule {}
