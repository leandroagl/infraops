import { Component, DestroyRef, inject, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { ClientsService } from '../../../core/services/clients.service';
import { ClientSubscriptionHours, ClientWithHours } from '../../../core/models/client.models';

export type HoursZone = 'crit' | 'ok' | 'warn';

interface TableFilter {
  q: string;
  zone: HoursZone | null;
}

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit, AfterViewInit {
  readonly dataSource = new MatTableDataSource<ClientWithHours>([]);
  readonly displayedColumns = ['name', 'hours'];
  quickFilter = '';
  selectedZone: HoursZone | null = null;
  loadError = false;

  @ViewChild(MatSort) sort!: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.dataSource.filterPredicate = (row, filter) => {
      const { q, zone } = JSON.parse(filter) as TableFilter;
      const matchesText = !q || row.name.toLowerCase().includes(q);
      const matchesZone = !zone
        || (row.hours != null && row.hours.contracted > 0 && this.getHoursState(row.hours) === zone);
      return matchesText && matchesZone;
    };
    this.applyFilter();

    this.clientsService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.dataSource.data = data
            .filter((c) => c.isActive)
            .map((c) => ({ ...c, hours: undefined }));
        },
        error: () => {
          this.loadError = true;
        },
      });

    this.clientsService.getSubscriptionHours()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (hoursData) => {
          const hoursMap = new Map(hoursData.map((h) => [h.clientId, h]));
          this.dataSource.data = this.dataSource.data.map((c) => ({
            ...c,
            hours: hoursMap.get(c.id) ?? { clientId: c.id, contracted: 0, delivered: 0, available: 0 },
          }));
        },
        error: () => {
          this.dataSource.data = this.dataSource.data.map((c) => ({
            ...c,
            hours: { clientId: c.id, contracted: 0, delivered: 0, available: 0 },
          }));
        },
      });
  }

  ngAfterViewInit(): void {
    this.dataSource.sort = this.sort;
    this.dataSource.sortingDataAccessor = (row, column) => {
      if (column === 'hours') return row.hours ? this.getHoursPct(row.hours) : -1;
      return (row as unknown as Record<string, unknown>)[column] as string ?? '';
    };
  }

  applyFilter(): void {
    const filter: TableFilter = { q: this.quickFilter.trim().toLowerCase(), zone: this.selectedZone };
    this.dataSource.filter = JSON.stringify(filter);
  }

  toggleZone(zone: HoursZone): void {
    this.selectedZone = this.selectedZone === zone ? null : zone;
    this.applyFilter();
  }

  navigateToClient(id: string): void {
    this.router.navigate(['/clients', id]);
  }

  private get textFilteredClients(): ClientWithHours[] {
    const q = this.quickFilter.trim().toLowerCase();
    return this.dataSource.data.filter((c) => !q || c.name.toLowerCase().includes(q));
  }

  get kpiHours(): { contracted: number; delivered: number; available: number } {
    return this.textFilteredClients
      .filter((c) => c.hours != null && c.hours.contracted > 0)
      .reduce(
        (acc, c) => ({
          contracted: acc.contracted + c.hours!.contracted,
          delivered:  acc.delivered  + c.hours!.delivered,
          available:  acc.available  + c.hours!.available,
        }),
        { contracted: 0, delivered: 0, available: 0 },
      );
  }

  get kpiHoursPct(): number {
    const { contracted, delivered } = this.kpiHours;
    if (contracted === 0) return 0;
    return Math.min(100, Math.round((delivered / contracted) * 100));
  }

  get kpiStates(): { ok: number; warn: number; crit: number } {
    return this.textFilteredClients
      .filter((c) => c.hours != null && c.hours.contracted > 0)
      .reduce(
        (acc, c) => {
          const state = this.getHoursState(c.hours!);
          return { ...acc, [state]: acc[state] + 1 };
        },
        { ok: 0, warn: 0, crit: 0 },
      );
  }

  zonePct(count: number): number {
    const { ok, warn, crit } = this.kpiStates;
    const total = ok + warn + crit;
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  getHoursState(hours: ClientSubscriptionHours): HoursZone {
    if (hours.contracted === 0) return 'ok';
    const pct = hours.delivered / hours.contracted;
    if (pct > 1) return 'warn';
    if (pct >= 0.6) return 'ok';
    return 'crit';
  }

  getHoursPct(hours: ClientSubscriptionHours): number {
    if (hours.contracted === 0) return 0;
    return Math.round((hours.delivered / hours.contracted) * 100);
  }

  getHoursBarWidth(hours: ClientSubscriptionHours): number {
    return Math.min(100, this.getHoursPct(hours));
  }
}
