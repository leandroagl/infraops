import { Component, DestroyRef, inject, OnInit, ViewChild, AfterViewInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { MatTableDataSource } from '@angular/material/table';
import { MatSort } from '@angular/material/sort';
import { ClientsService } from '../../../core/services/clients.service';
import { ClientSubscriptionHours, ClientWithHours } from '../../../core/models/client.models';

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit, AfterViewInit {
  readonly dataSource = new MatTableDataSource<ClientWithHours>([]);
  readonly displayedColumns = ['name', 'hours'];
  quickFilter = '';
  loadError = false;

  @ViewChild(MatSort) sort!: MatSort;

  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly clientsService: ClientsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
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
            hours: hoursMap.get(c.id),
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
  }

  applyFilter(): void {
    this.dataSource.filter = this.quickFilter.trim().toLowerCase();
  }

  navigateToClient(id: string): void {
    this.router.navigate(['/clients', id]);
  }

  getHoursState(hours: ClientSubscriptionHours): 'ok' | 'warn' | 'crit' {
    if (hours.contracted === 0) return 'ok';
    const pct = hours.delivered / hours.contracted;
    if (pct >= 0.9) return 'crit';
    if (pct >= 0.7) return 'warn';
    return 'ok';
  }

  getHoursPct(hours: ClientSubscriptionHours): number {
    if (hours.contracted === 0) return 0;
    return Math.min(100, Math.round((hours.delivered / hours.contracted) * 100));
  }
}
