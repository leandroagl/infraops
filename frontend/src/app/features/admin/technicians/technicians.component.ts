import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { Technician } from '../../../core/models/technician.models';
import { UserRole } from '../../../core/models/auth.models';
import { TechniciansService } from '../../../core/services/technicians.service';
import { AssignTechnicianDialogComponent } from './assign-technician-dialog/assign-technician-dialog.component';

@Component({
  selector: 'app-technicians',
  templateUrl: './technicians.component.html',
  styleUrl: './technicians.component.scss',
})
export class TechniciansComponent implements OnInit, OnDestroy {
  technicians: Technician[] = [];
  loading = false;
  error = '';

  private destroy$ = new Subject<void>();

  constructor(
    private techniciansService: TechniciansService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  load(): void {
    this.loading = true;
    this.error = '';
    this.techniciansService.getAll().pipe(takeUntil(this.destroy$)).subscribe({
      next: data => { this.technicians = data; this.loading = false; },
      error: () => { this.error = 'No se pudieron cargar los técnicos.'; this.loading = false; },
    });
  }

  openAssignDialog(): void {
    this.dialog
      .open(AssignTechnicianDialogComponent, { width: '440px' })
      .afterClosed()
      .pipe(takeUntil(this.destroy$))
      .subscribe(assigned => { if (assigned) this.load(); });
  }

  remove(tech: Technician): void {
    this.techniciansService.remove(tech.id).pipe(takeUntil(this.destroy$)).subscribe({
      next: () => this.load(),
      error: () =>
        this.snackBar.open('No se pudo eliminar el perfil técnico.', '', {
          duration: 3000,
          panelClass: 'snack-error',
        }),
    });
  }

  roleBadgeClass(role: UserRole): string {
    const map: Record<UserRole, string> = {
      ADMIN: 'badge--accent', TL: 'badge--srv',
      COORDINATOR: 'badge--purple', TECHNICIAN: 'badge--neutral',
    };
    return map[role];
  }

  roleLabel(role: UserRole): string {
    const labels: Record<UserRole, string> = {
      ADMIN: 'Admin', TL: 'Team Lead',
      COORDINATOR: 'Coordinador', TECHNICIAN: 'Técnico',
    };
    return labels[role];
  }
}
