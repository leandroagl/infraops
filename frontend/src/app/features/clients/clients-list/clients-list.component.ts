import { Component, DestroyRef, inject, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { ColDef, CellClickedEvent, ValueFormatterParams } from 'ag-grid-community';
import { ClientsService } from '../../../core/services/clients.service';
import { Client } from '../../../core/models/client.models';

@Component({
  selector: 'app-clients-list',
  templateUrl: './clients-list.component.html',
  styleUrls: ['./clients-list.component.scss'],
})
export class ClientsListComponent implements OnInit {
  clients: Client[] = [];
  quickFilter = '';
  loadError = false;
  private readonly destroyRef = inject(DestroyRef);

  readonly columnDefs: ColDef[] = [
    {
      field: 'name',
      headerName: 'Cliente',
      flex: 1,
      sort: 'asc',
      cellStyle: { color: 'var(--accent)', cursor: 'pointer' },
    },
    {
      field: 'primaryAddress',
      headerName: 'Dirección primaria',
      flex: 2,
      valueFormatter: (p: ValueFormatterParams) => p.value ?? '—',
    },
  ];

  constructor(
    private readonly clientsService: ClientsService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.clientsService.getAll()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          this.clients = data.filter((c) => c.isActive);
        },
        error: () => {
          this.loadError = true;
        },
      });
  }

  onCellClicked(event: CellClickedEvent): void {
    if (event.colDef.field === 'name') {
      this.router.navigate(['/clients', event.data.id]);
    }
  }
}
