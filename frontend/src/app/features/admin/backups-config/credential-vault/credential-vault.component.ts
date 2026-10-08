import { Component, OnInit } from '@angular/core';
import { FormControl, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { CredentialVaultService } from '../../../../core/services/credential-vault.service';
import type { CredentialVaultEntry } from '../../../../core/models/credential-vault.models';

@Component({
  selector: 'app-credential-vault',
  templateUrl: './credential-vault.component.html',
})
export class CredentialVaultComponent implements OnInit {
  entries: CredentialVaultEntry[] = [];
  adding = false;
  nameCtrl     = new FormControl('', [Validators.required]);
  passwordCtrl = new FormControl('', [Validators.required]);
  readonly displayedColumns = ['name', 'createdAt', 'actions'];

  constructor(
    private readonly svc:      CredentialVaultService,
    private readonly snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.load();
  }

  private load(): void {
    this.svc.list().subscribe(entries => { this.entries = entries; });
  }

  add(): void {
    if (!this.nameCtrl.valid || !this.passwordCtrl.valid) return;
    this.adding = true;
    this.svc.create(this.nameCtrl.value!, this.passwordCtrl.value!).subscribe({
      next: () => {
        this.nameCtrl.reset();
        this.passwordCtrl.reset();
        this.adding = false;
        this.load();
      },
      error: () => { this.adding = false; },
    });
  }

  delete(id: string): void {
    if (!confirm('¿Eliminar esta credencial del vault?')) return;
    this.svc.delete(id).subscribe({
      next:  () => { this.entries = this.entries.filter(e => e.id !== id); },
      error: () => { this.snackBar.open('No se puede eliminar: la credencial está en uso por una configuración Veeam', 'Cerrar', { duration: 5000 }); },
    });
  }
}
