import { Component, DestroyRef, inject, OnDestroy, OnInit } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { ClientsService } from '../../../core/services/clients.service';
import { SidenavContextService } from '../../../core/services/sidenav-context.service';

@Component({
  selector: 'app-client-detail',
  templateUrl: './client-detail.component.html',
})
export class ClientDetailComponent implements OnInit, OnDestroy {
  loadError = false;
  private readonly destroyRef = inject(DestroyRef);

  constructor(
    private readonly route: ActivatedRoute,
    private readonly clientsService: ClientsService,
    private readonly sidenavCtx: SidenavContextService,
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id')!;
    this.clientsService.getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (client) => {
          this.sidenavCtx.setClient({ id: client.id, name: client.name });
        },
        error: () => {
          this.loadError = true;
        },
      });
  }

  ngOnDestroy(): void {
    this.sidenavCtx.clearClient();
  }
}
