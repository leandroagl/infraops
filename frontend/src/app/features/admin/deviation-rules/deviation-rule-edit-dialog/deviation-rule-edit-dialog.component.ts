import { Component, Inject, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { forkJoin } from 'rxjs';
import { DeviationRulesService } from '../../../../core/services/deviation-rules.service';
import { IntegrationConfigService, HelpdeskTeamDto, HelpdeskTagDto } from '../../../../core/services/integration-config.service';
import {
  AvailableDeviationSignal,
  DeviationOperator,
  DeviationRuleDto,
} from '../../../../core/models/deviation-rule.models';
import { TaskType } from '../../../../core/models/task.models';

export interface DeviationRuleEditDialogData {
  mode: 'create' | 'edit';
  rule?: DeviationRuleDto;
  signals: AvailableDeviationSignal[];
}

const ALL_OPERATORS: { value: DeviationOperator; label: string }[] = [
  { value: 'gt',  label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt',  label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'eq',  label: '=' },
];

@Component({
  selector: 'app-deviation-rule-edit-dialog',
  templateUrl: './deviation-rule-edit-dialog.component.html',
  styleUrls: ['./deviation-rule-edit-dialog.component.scss'],
})
export class DeviationRuleEditDialogComponent implements OnInit {
  teams: HelpdeskTeamDto[] = [];
  tags: HelpdeskTagDto[] = [];
  loading = true;
  saving = false;

  form = new FormGroup({
    taskType:         new FormControl<TaskType | null>(null, Validators.required),
    signalKey:        new FormControl<string | null>(null, Validators.required),
    operator:         new FormControl<DeviationOperator | null>(null, Validators.required),
    thresholdNumber:  new FormControl<number | null>(null),
    thresholdBoolean: new FormControl<boolean>(true),
    enabled:          new FormControl(true),
    helpdeskTeamId:   new FormControl<number | null>(null),
    tagIds:           new FormControl<number[]>([]),
  });

  constructor(
    private dialogRef: MatDialogRef<DeviationRuleEditDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: DeviationRuleEditDialogData,
    private rulesSvc: DeviationRulesService,
    private integrationSvc: IntegrationConfigService,
  ) {}

  ngOnInit(): void {
    if (this.data.mode === 'edit' && this.data.rule) {
      const r = this.data.rule;
      this.form.patchValue({
        taskType: r.taskType,
        signalKey: r.signalKey,
        operator: r.operator,
        thresholdNumber: r.thresholdNumber,
        thresholdBoolean: r.thresholdBoolean ?? true,
        enabled: r.enabled,
        helpdeskTeamId: r.helpdeskTeamId,
        tagIds: r.tagIds,
      });
      this.form.controls.taskType.disable();
      this.form.controls.signalKey.disable();
    }

    forkJoin({
      teams: this.integrationSvc.getHelpdeskTeams(),
      tags: this.integrationSvc.getHelpdeskTags(),
    }).subscribe({
      next: ({ teams, tags }) => { this.teams = teams; this.tags = tags; this.loading = false; },
      error: () => { this.loading = false; },
    });
  }

  get availableTaskTypes(): TaskType[] {
    return [...new Set(this.data.signals.map(s => s.taskType))];
  }

  get availableSignalsForTaskType(): AvailableDeviationSignal[] {
    const taskType = this.form.getRawValue().taskType;
    return this.data.signals.filter(s => s.taskType === taskType);
  }

  get selectedSignal(): AvailableDeviationSignal | undefined {
    const v = this.form.getRawValue();
    return this.data.signals.find(s => s.taskType === v.taskType && s.key === v.signalKey);
  }

  get operatorOptions(): { value: DeviationOperator; label: string }[] {
    if (this.selectedSignal?.valueType === 'boolean') {
      return ALL_OPERATORS.filter(o => o.value === 'eq');
    }
    return ALL_OPERATORS;
  }

  get isValid(): boolean {
    const v = this.form.getRawValue();
    if (!v.taskType || !v.signalKey || !v.operator) return false;
    const signal = this.selectedSignal;
    if (!signal) return false;
    if (signal.valueType === 'number' && (v.thresholdNumber === null || v.thresholdNumber === undefined)) {
      return false;
    }
    if (signal.valueType === 'boolean' && (v.thresholdBoolean === null || v.thresholdBoolean === undefined)) {
      return false;
    }
    return !v.enabled || !!v.helpdeskTeamId;
  }

  onTaskTypeChange(): void {
    this.form.controls.signalKey.setValue(null);
    this.resetOperatorAndThresholds();
  }

  onSignalKeyChange(): void {
    this.resetOperatorAndThresholds();
  }

  private resetOperatorAndThresholds(): void {
    const signal = this.selectedSignal;
    this.form.patchValue({
      operator: signal?.valueType === 'boolean' ? 'eq' : null,
      thresholdNumber: null,
      thresholdBoolean: true,
    });
  }

  save(): void {
    if (!this.isValid) return;
    this.saving = true;

    const v = this.form.getRawValue();
    const isNumber = this.selectedSignal?.valueType === 'number';
    const common = {
      operator: v.operator!,
      thresholdNumber: isNumber ? (v.thresholdNumber ?? undefined) : undefined,
      thresholdBoolean: !isNumber ? (v.thresholdBoolean ?? undefined) : undefined,
      enabled: v.enabled ?? true,
      helpdeskTeamId: v.helpdeskTeamId ?? null,
      tagIds: v.tagIds ?? [],
    };

    const request = this.data.mode === 'create'
      ? this.rulesSvc.create({ taskType: v.taskType!, signalKey: v.signalKey!, ...common })
      : this.rulesSvc.update(this.data.rule!.id, common);

    request.subscribe({
      next: result => { this.saving = false; this.dialogRef.close(result); },
      error: () => { this.saving = false; },
    });
  }

  cancel(): void {
    this.dialogRef.close(null);
  }
}
