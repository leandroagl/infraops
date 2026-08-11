import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatDialogModule } from '@angular/material/dialog';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SchedulesRoutingModule } from './schedules-routing.module';
import { SchedulesComponent } from './schedules.component';
import { ConfigTabComponent } from './config-tab/config-tab.component';
import { RotationModalComponent } from './config-tab/rotation-modal/rotation-modal.component';
import { GenerationTabComponent } from './generation-tab/generation-tab.component';
import { CalendarTabComponent } from './calendar-tab/calendar-tab.component';

@NgModule({
  declarations: [
    SchedulesComponent,
    ConfigTabComponent,
    RotationModalComponent,
    GenerationTabComponent,
    CalendarTabComponent,
  ],
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatTabsModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
    MatIconModule,
    MatChipsModule,
    MatTooltipModule,
    SchedulesRoutingModule,
  ],
})
export class SchedulesModule {}
