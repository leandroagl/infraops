import { Component, OnInit } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { User } from '../../../../core/models/user.models';
import { UsersService } from '../../../../core/services/users.service';
import { TechniciansService } from '../../../../core/services/technicians.service';

@Component({
  selector: 'app-assign-technician-dialog',
  templateUrl: './assign-technician-dialog.component.html',
})
export class AssignTechnicianDialogComponent implements OnInit {
  availableUsers: User[] = [];
  selectedUserId = '';
  loading = false;
  saving = false;
  error = '';

  constructor(
    private dialogRef: MatDialogRef<AssignTechnicianDialogComponent>,
    private usersService: UsersService,
    private techniciansService: TechniciansService,
  ) {}

  ngOnInit(): void {
    this.loading = true;
    this.usersService.getAll().subscribe({
      next: users => {
        this.availableUsers = users.filter(u => u.isActive && !u.technicianId);
        this.loading = false;
      },
      error: () => { this.error = 'No se pudieron cargar los usuarios.'; this.loading = false; },
    });
  }

  confirm(): void {
    if (!this.selectedUserId) return;
    this.saving = true;
    this.techniciansService.assign({ userId: this.selectedUserId }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => { this.error = 'No se pudo asignar el perfil técnico.'; this.saving = false; },
    });
  }

  cancel(): void {
    this.dialogRef.close(false);
  }
}
