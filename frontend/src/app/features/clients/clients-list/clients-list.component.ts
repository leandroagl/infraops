import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { switchMap } from 'rxjs/operators';
import { ClientsService } from '../../../core/services/clients.service';
import {
  ClientSubscriptionHours,
  ClientWithHours,
  hoursBarState,
  HoursBarState,
} from '../../../core/models/client.models';

export type HoursZone = 'crit' | 'low' | 'ok' | 'warn';

const MONTH_NAMES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  allClients: ClientWithHours[] = [];
  quickFilter   = '';
  selectedZone: HoursZone | null = null;
  loadError     = false;
  selectedMonth: number;
  selectedYear:  number;

  private readonly load$ = new Subject<void>();
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly router: Router,
  ) {
    const now     = new Date();
    this.selectedMonth = now.getMonth() + 1;
    this.selectedYear  = now.getFullYear();
  }

  ngOnInit(): void {
    // Carga lista de clientes una sola vez
    this.clientsService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.allClients = data
            .filter((c) => c.isActive)
            .map((c) => ({ ...c, hours: undefined }));
        },
        error: () => { this.loadError = true; },
      });

    // Carga horas reactivamente al navegar entre meses
    this.load$
      .pipe(
        switchMap(() =>
          this.clientsService.getSubscriptionHours(this.selectedMonth, this.selectedYear)
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (hoursData) => {
          const map = new Map(hoursData.map((h) => [h.clientId, h]));
          this.allClients = this.allClients.map((c) => ({
            ...c,
            hours: map.get(c.id) ?? { clientId: c.id, contracted: 0, delivered: 0, available: 0 },
          }));
        },
        error: () => {
          this.allClients = this.allClients.map((c) => ({
            ...c,
            hours: { clientId: c.id, contracted: 0, delivered: 0, available: 0 },
          }));
        },
      });

    this.load$.next();
  }

  // ── Month navigation ────────────────────────────────────────
  get monthLabel(): string {
    return `${MONTH_NAMES[this.selectedMonth - 1]} ${this.selectedYear}`;
  }

  get isPastMonth(): boolean {
    const now = new Date();
    return this.selectedYear < now.getFullYear()
      || (this.selectedYear === now.getFullYear() && this.selectedMonth < now.getMonth() + 1);
  }

  get isCurrentMonth(): boolean {
    const now = new Date();
    return this.selectedMonth === now.getMonth() + 1 && this.selectedYear === now.getFullYear();
  }

  navigateMonth(dir: -1 | 1): void {
    if (dir === 1 && this.isCurrentMonth) return;  // no navegar al futuro

    let m = this.selectedMonth + dir;
    let y = this.selectedYear;
    if (m < 1)  { m = 12; y--; }
    if (m > 12) { m = 1;  y++; }

    // Marcar horas como cargando (skeleton) antes de pedir al servidor
    this.allClients = this.allClients.map((c) => ({ ...c, hours: undefined }));
    this.selectedMonth = m;
    this.selectedYear  = y;
    this.quickFilter   = '';
    this.selectedZone  = null;
    this.load$.next();
  }

  // ── Filters ─────────────────────────────────────────────────
  get filteredClients(): ClientWithHours[] {
    const q    = this.quickFilter.trim().toLowerCase();
    const zone = this.selectedZone;
    return this.allClients
      .filter((c) => {
        const textMatch = !q || c.name.toLowerCase().includes(q);
        const zoneMatch = !zone || (c.hours != null && c.hours.contracted > 0
          && this.getHoursState(c.hours) === zone);
        return textMatch && zoneMatch;
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'es'));
  }

  toggleZone(zone: HoursZone): void {
    this.selectedZone = this.selectedZone === zone ? null : zone;
  }

  navigateToClient(id: string): void {
    this.router.navigate(['/clients', id]);
  }

  // ── KPI helpers ─────────────────────────────────────────────
  private get textFilteredClients(): ClientWithHours[] {
    const q = this.quickFilter.trim().toLowerCase();
    return this.allClients.filter((c) => !q || c.name.toLowerCase().includes(q));
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
    return Math.round((delivered / contracted) * 100);
  }

  get kpiStates(): { ok: number; warn: number; crit: number; low: number } {
    return this.textFilteredClients
      .filter((c) => c.hours != null && c.hours.contracted > 0)
      .reduce(
        (acc, c) => {
          const state = this.getHoursState(c.hours!);
          return { ...acc, [state]: acc[state] + 1 };
        },
        { ok: 0, warn: 0, crit: 0, low: 0 },
      );
  }

  zonePct(count: number): number {
    const { ok, warn, crit, low } = this.kpiStates;
    const total = ok + warn + crit + low;
    return total === 0 ? 0 : Math.round((count / total) * 100);
  }

  // ── Hour state methods ───────────────────────────────────────
  /** Zona de consumo — para filtros del KPI strip (sin cambios). */
  getHoursState(hours: ClientSubscriptionHours): HoursZone {
    if (hours.contracted === 0) return 'ok';
    const pct = hours.delivered / hours.contracted;
    if (pct > 1)    return 'warn';
    if (pct >= 0.6) return 'ok';
    if (pct > 0)    return 'low';
    return 'crit';
  }

  /** Calidad de consumo — para color de barras (mayor consumo = mejor). */
  getHoursBarState(hours: ClientSubscriptionHours): HoursBarState {
    if (hours.contracted === 0) return 'crit';
    const pct = Math.round((hours.delivered / hours.contracted) * 100);
    return hoursBarState(pct);
  }

  getHoursPct(hours: ClientSubscriptionHours): number {
    if (hours.contracted === 0) return 0;
    return Math.round((hours.delivered / hours.contracted) * 100);
  }

  getHoursBarWidth(hours: ClientSubscriptionHours): number {
    return Math.min(100, this.getHoursPct(hours));
  }

  get globalHoursBarState(): HoursBarState {
    return hoursBarState(this.kpiHoursPct);
  }
}
