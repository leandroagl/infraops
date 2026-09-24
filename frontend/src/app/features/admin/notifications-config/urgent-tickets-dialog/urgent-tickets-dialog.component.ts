import { Component, Inject, OnInit } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationsService } from '../../../../core/services/notifications.service';
import { UrgentBacklogPreview, UrgentBacklogPreviewItem } from '../../../../core/models/notification.models';
import { ExpirationType } from '../../../../core/models/notification.models';

export interface UrgentTicketsDialogData {
  maxDays: number;
}

@Component({
  selector: 'app-urgent-tickets-dialog',
  templateUrl: './urgent-tickets-dialog.component.html',
  styleUrl: './urgent-tickets-dialog.component.scss',
})
export class UrgentTicketsDialogComponent implements OnInit {
  loading = true;
  creating = false;
  preview: UrgentBacklogPreview | null = null;
  error: string | null = null;
  readonly displayedColumns = ['type', 'itemName', 'daysUntil'];

  constructor(
    private readonly dialogRef: MatDialogRef<UrgentTicketsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) readonly data: UrgentTicketsDialogData,
    private readonly svc: NotificationsService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.svc.getUrgentBacklogPreview(this.data.maxDays).subscribe({
      next: (preview) => {
        this.preview = preview;
        this.loading = false;
      },
      error: () => {
        this.error = 'No se pudo cargar la vista previa.';
        this.loading = false;
      },
    });
  }

  confirm(): void {
    this.creating = true;
    this.svc.createUrgentBacklogTickets(this.data.maxDays).subscribe({
      next: (result) => {
        this.dialogRef.close(result);
        this.snackBar.open(
          `${result.created} ticket${result.created !== 1 ? 's' : ''} creado${result.created !== 1 ? 's' : ''}` +
          (result.errors > 0 ? ` (${result.errors} error${result.errors !== 1 ? 'es' : ''})` : ''),
          'OK',
          { duration: 5000 },
        );
      },
      error: () => {
        this.creating = false;
        this.error = 'Error al crear los tickets.';
      },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }

  typeLabel(type: ExpirationType): string {
    const map: Record<ExpirationType, string> = {
      asset_warranty: 'Garantía',
      certificate:    'Certificado',
      domain:         'Dominio',
      software:       'Licencia',
    };
    return map[type];
  }

  daysLabel(item: UrgentBacklogPreviewItem): string {
    if (item.daysUntil < 0) return `Vencido hace ${Math.abs(item.daysUntil)}d`;
    if (item.daysUntil === 0) return 'Vence hoy';
    return `${item.daysUntil}d`;
  }

  daysClass(item: UrgentBacklogPreviewItem): string {
    if (item.daysUntil <= 0) return 'days--crit';
    if (item.daysUntil <= 3) return 'days--warn';
    return 'days--ok';
  }
}
