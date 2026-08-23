import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  Output,
  SimpleChanges,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { merge, Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { InfraAsset } from '../../../../../core/models/infradoc.models';
import { BmcAlertCategory, BmcEntry } from '../../../../../core/models/maintenance-log.models';

@Component({
  selector: 'app-bmc-host-card',
  templateUrl: './bmc-host-card.component.html',
  styleUrl: './bmc-host-card.component.scss',
})
export class BmcHostCardComponent implements OnInit, OnChanges, OnDestroy {
  @Input() host!: InfraAsset;
  @Input() savedEntry: BmcEntry | null = null;
  @Input() readOnly = false;
  @Output() bmcChange = new EventEmitter<BmcEntry>();

  readonly allCategories: BmcAlertCategory[] = [
    'fan', 'psu', 'temperatura', 'cpu', 'memoria', 'storage', 'nic', 'sistema',
  ];

  alertStatusCtrl     = new FormControl<'ok' | 'alerta'>('ok', { nonNullable: true });
  categoriesCtrl      = new FormControl<BmcAlertCategory[]>([], { nonNullable: true });
  alertLogsCtrl       = new FormControl('', { nonNullable: true });
  firmwareUpdatedCtrl = new FormControl(false, { nonNullable: true });
  firmwareVersionCtrl = new FormControl('', { nonNullable: true });
  biosUpdatedCtrl     = new FormControl(false, { nonNullable: true });
  biosVersionCtrl     = new FormControl('', { nonNullable: true });

  private readonly destroy$ = new Subject<void>();

  ngOnInit(): void {
    merge(
      this.alertStatusCtrl.valueChanges,
      this.categoriesCtrl.valueChanges,
      this.alertLogsCtrl.valueChanges,
      this.firmwareUpdatedCtrl.valueChanges,
      this.firmwareVersionCtrl.valueChanges,
      this.biosUpdatedCtrl.valueChanges,
      this.biosVersionCtrl.valueChanges,
    ).pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.bmcChange.emit(this.buildEntry());
    });

    if (this.readOnly) this.disableAll();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['savedEntry'] && this.savedEntry) {
      this.setValue(this.savedEntry);
    }
    if (changes['readOnly'] && this.readOnly) {
      this.disableAll();
    }
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  buildEntry(): BmcEntry {
    const status = this.alertStatusCtrl.value;
    const entry: BmcEntry = {
      hostId:      this.host.assetId,
      hostName:    this.host.name,
      alertStatus: status,
    };
    if (status === 'alerta') {
      if (this.categoriesCtrl.value.length) entry.alertCategories = this.categoriesCtrl.value;
      if (this.alertLogsCtrl.value)         entry.alertLogs       = this.alertLogsCtrl.value;
    }
    if (this.firmwareUpdatedCtrl.value && this.firmwareVersionCtrl.value) {
      entry.firmwareVersion = this.firmwareVersionCtrl.value;
    }
    if (this.biosUpdatedCtrl.value && this.biosVersionCtrl.value) {
      entry.biosVersion = this.biosVersionCtrl.value;
    }
    return entry;
  }

  setValue(entry: BmcEntry): void {
    this.alertStatusCtrl.setValue(entry.alertStatus,         { emitEvent: false });
    this.categoriesCtrl.setValue(entry.alertCategories ?? [], { emitEvent: false });
    this.alertLogsCtrl.setValue(entry.alertLogs ?? '',        { emitEvent: false });
    if (entry.firmwareVersion) {
      this.firmwareUpdatedCtrl.setValue(true,                 { emitEvent: false });
      this.firmwareVersionCtrl.setValue(entry.firmwareVersion,{ emitEvent: false });
    }
    if (entry.biosVersion) {
      this.biosUpdatedCtrl.setValue(true,                     { emitEvent: false });
      this.biosVersionCtrl.setValue(entry.biosVersion,        { emitEvent: false });
    }
  }

  get showAlertDetails(): boolean {
    return this.alertStatusCtrl.value === 'alerta';
  }

  get isOk(): boolean {
    return this.alertStatusCtrl.value === 'ok';
  }

  get bmcTypeLabel(): string | null {
    const raw = this.host.bmcType;
    if (!raw) return null;
    const lower = raw.toLowerCase();
    if (lower.includes('idrac'))    return 'iDRAC';
    if (lower.includes('ilo'))      return 'iLO';
    if (lower.includes('xclarity')) return 'xClarity';
    return raw;
  }

  private disableAll(): void {
    this.alertStatusCtrl.disable(    { emitEvent: false });
    this.categoriesCtrl.disable(     { emitEvent: false });
    this.alertLogsCtrl.disable(      { emitEvent: false });
    this.firmwareUpdatedCtrl.disable( { emitEvent: false });
    this.firmwareVersionCtrl.disable( { emitEvent: false });
    this.biosUpdatedCtrl.disable(     { emitEvent: false });
    this.biosVersionCtrl.disable(     { emitEvent: false });
  }
}
