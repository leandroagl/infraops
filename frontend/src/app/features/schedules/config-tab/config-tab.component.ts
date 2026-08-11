import { Component, OnInit, OnDestroy } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
import { debounceTime, switchMap, takeUntil } from 'rxjs/operators';
import { forkJoin } from 'rxjs';
import {
  ClientSchedule, RotationConfig, ScheduleGroup, SchedulesService,
} from '../schedules.service';
import { RotationModalComponent } from './rotation-modal/rotation-modal.component';

@Component({
  selector: 'app-config-tab',
  templateUrl: './config-tab.component.html',
  styleUrl: './config-tab.component.scss',
})
export class ConfigTabComponent implements OnInit, OnDestroy {
  rules: ClientSchedule[] = [];
  rotationConfig: RotationConfig | null = null;
  filterGroup: ScheduleGroup | 'ALL' = 'ALL';
  searchTerm = '';
  displayedColumns = ['client', 'group', 'months', 'technician'];
  loading = false;
  technicians: Array<{ id: string; name: string }> = [];

  private readonly saveSubject = new Subject<{
    clientId: string;
    scheduleGroup: ScheduleGroup;
    technicianId: string | null;
  }>();
  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly schedulesService: SchedulesService,
    private readonly dialog: MatDialog,
    private readonly snack: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
    this.schedulesService.getRotationConfig().subscribe(cfg => { this.rotationConfig = cfg; });
    this.saveSubject.pipe(
      debounceTime(300),
      switchMap(change => this.schedulesService.upsert(change.clientId, {
        scheduleGroup: change.scheduleGroup,
        technicianId: change.technicianId,
      })),
      takeUntil(this.destroy$),
    ).subscribe({
      next: updated => {
        const idx = this.rules.findIndex(r => r.clientId === updated.clientId);
        if (idx !== -1) this.rules[idx] = updated;
        this.snack.open('Guardado', undefined, { duration: 1500 });
      },
      error: () => this.snack.open('Error al guardar', 'OK', { duration: 3000 }),
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private load(): void {
    this.loading = true;
    forkJoin({
      schedules: this.schedulesService.findAll(),
      clients: this.schedulesService.getClients(),
      technicians: this.schedulesService.getTechnicians(),
    }).subscribe({
      next: ({ schedules, clients, technicians }) => {
        const scheduleMap = new Map(schedules.map(s => [s.clientId, s]));
        this.rules = clients
          .filter(c => c.isActive)
          .map(c => scheduleMap.get(c.id) ?? {
            id: '',
            clientId: c.id,
            client: { id: c.id, name: c.name },
            scheduleGroup: null,
            technicianId: null,
            technician: null,
            isActive: true,
          } as ClientSchedule);
        this.technicians = technicians.map(t => ({ id: t.id, name: t.user?.name ?? t.id }));
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  get filteredRules(): ClientSchedule[] {
    return this.rules.filter(r => {
      const matchGroup = this.filterGroup === 'ALL' || r.scheduleGroup === this.filterGroup;
      const matchSearch = !this.searchTerm ||
        r.client.name.toLowerCase().includes(this.searchTerm.toLowerCase());
      return matchGroup && matchSearch;
    });
  }

  monthsLabel(group: ScheduleGroup): string {
    if (group === 'BIMONTHLY_EVEN') return 'Feb · Abr · Jun · Ago · Oct · Dic';
    if (group === 'BIMONTHLY_ODD')  return 'Ene · Mar · May · Jul · Sep · Nov';
    return '—';
  }

  onGroupChange(rule: ClientSchedule, group: ScheduleGroup): void {
    rule.scheduleGroup = group;
    this.saveSubject.next({ clientId: rule.clientId, scheduleGroup: group, technicianId: rule.technicianId });
  }

  onTechnicianChange(rule: ClientSchedule, technicianId: string | null): void {
    rule.technicianId = technicianId;
    this.saveSubject.next({ clientId: rule.clientId, scheduleGroup: rule.scheduleGroup, technicianId });
  }

  openRotationModal(): void {
    const ref = this.dialog.open(RotationModalComponent, {
      width: '540px',
      data: this.rotationConfig,
    });
    ref.afterClosed().subscribe((saved: RotationConfig | undefined) => {
      if (saved) this.rotationConfig = saved;
    });
  }
}
