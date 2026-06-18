import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { DcHealthSnapshot } from '../../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-dc-health-card',
  templateUrl: './dc-health-card.component.html',
  styleUrl: './dc-health-card.component.scss',
})
export class DcHealthCardComponent implements OnInit, OnDestroy {
  @Input() dc!: InfraAsset;
  @Input() formGroup!: FormGroup;
  @Input() readOnly = false;

  parsed: DcHealthSnapshot | null = null;
  parseError: string | null = null;

  private destroy$ = new Subject<void>();

  ngOnInit(): void {
    this.formGroup.get('rawJson')!.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(raw => this.tryParse(raw));

    const initial = this.formGroup.get('rawJson')!.value;
    if (initial) this.tryParse(initial);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  tryParse(raw: string): void {
    if (!raw || !raw.trim()) {
      this.parsed = null;
      this.parseError = null;
      return;
    }
    try {
      const obj = JSON.parse(raw) as DcHealthSnapshot;
      if (obj.is_dc === false) {
        this.parsed = null;
        this.parseError = 'Este equipo no es un controlador de dominio';
        return;
      }
      this.parsed = obj;
      this.parseError = null;
    } catch {
      this.parsed = null;
      this.parseError = 'JSON inválido';
    }
  }

  edit(): void {
    this.parsed = null;
  }

  statusClass(value: boolean | null): string {
    if (value === true) return 'dc-badge--ok';
    if (value === false) return 'dc-badge--crit';
    return 'dc-badge--na';
  }

  statusLabel(value: boolean | null): string {
    if (value === true) return 'OK';
    if (value === false) return 'ERROR';
    return 'N/A';
  }
}
