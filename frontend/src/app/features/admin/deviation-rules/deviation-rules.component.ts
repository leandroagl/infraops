import { Component, OnInit } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { forkJoin } from 'rxjs';
import { DeviationRulesService } from '../../../core/services/deviation-rules.service';
import { AvailableDeviationSignal, DeviationOperator, DeviationRuleDto } from '../../../core/models/deviation-rule.models';
import { TaskType } from '../../../core/models/task.models';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { typeLabel } from '../../../shared/utils/task-labels';
import { DeviationRuleEditDialogComponent } from './deviation-rule-edit-dialog/deviation-rule-edit-dialog.component';

const OPERATOR_LABELS: Record<DeviationOperator, string> = {
  gt: '>', gte: '≥', lt: '<', lte: '≤', eq: '=',
};

@Component({
  selector: 'app-deviation-rules',
  templateUrl: './deviation-rules.component.html',
  styleUrl: './deviation-rules.component.scss',
})
export class DeviationRulesComponent implements OnInit {
  rules: DeviationRuleDto[] = [];
  signals: AvailableDeviationSignal[] = [];
  loading = true;
  displayedColumns = ['taskType', 'signal', 'operator', 'threshold', 'enabled', 'team', 'tags', 'actions'];

  constructor(
    private rulesSvc: DeviationRulesService,
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    forkJoin({
      rules: this.rulesSvc.getAll(),
      signals: this.rulesSvc.getAvailableSignals(),
    }).subscribe({
      next: ({ rules, signals }) => { this.rules = rules; this.signals = signals; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  taskTypeLabel(type: TaskType): string {
    return typeLabel(type);
  }

  signalLabel(rule: DeviationRuleDto): string {
    const signal = this.signals.find(s => s.taskType === rule.taskType && s.key === rule.signalKey);
    return signal?.label ?? rule.signalKey;
  }

  operatorLabel(operator: DeviationOperator): string {
    return OPERATOR_LABELS[operator] ?? operator;
  }

  thresholdDisplay(rule: DeviationRuleDto): string {
    if (rule.thresholdBoolean !== null) return rule.thresholdBoolean ? 'Sí' : 'No';
    return rule.thresholdNumber !== null ? String(rule.thresholdNumber) : '—';
  }

  openCreate(): void {
    this.dialog
      .open(DeviationRuleEditDialogComponent, { data: { mode: 'create', signals: this.signals }, width: '520px' })
      .afterClosed()
      .subscribe((created: DeviationRuleDto | null) => {
        if (created) this.rules = [...this.rules, created];
      });
  }

  openEdit(rule: DeviationRuleDto): void {
    this.dialog
      .open(DeviationRuleEditDialogComponent, { data: { mode: 'edit', rule, signals: this.signals }, width: '520px' })
      .afterClosed()
      .subscribe((updated: DeviationRuleDto | null) => {
        if (!updated) return;
        this.rules = this.rules.map(r => (r.id === updated.id ? updated : r));
      });
  }

  deleteRule(rule: DeviationRuleDto): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar regla de desvío',
        message: `¿Estás seguro de que querés eliminar esta regla? Esta acción no se puede deshacer.`,
      },
      width: '420px',
    });
    ref.afterClosed().subscribe(confirmed => {
      if (!confirmed) return;
      this.rulesSvc.remove(rule.id).subscribe({
        next: () => { this.rules = this.rules.filter(r => r.id !== rule.id); },
        error: err =>
          this.snackBar.open(err.error?.message ?? 'No se pudo eliminar la regla.', '', {
            duration: 3000,
            panelClass: 'snack-error',
          }),
      });
    });
  }
}
