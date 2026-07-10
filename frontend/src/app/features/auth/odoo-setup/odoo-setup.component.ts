import { Component } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-odoo-setup',
  templateUrl: './odoo-setup.component.html',
  styleUrls: ['./odoo-setup.component.scss'],
})
export class OdooSetupComponent {
  form: FormGroup;
  loading      = false;
  errorMessage = '';

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    private auth: AuthService,
    private router: Router,
  ) {
    const currentUser = this.auth.getCurrentUser();
    this.form = this.fb.group({
      odooApiEmail: [currentUser?.email ?? '', [Validators.required, Validators.email]],
      odooApiKey:   ['', Validators.required],
    });
  }

  submit(): void {
    if (this.form.invalid) return;
    this.loading      = true;
    this.errorMessage = '';

    const { odooApiEmail, odooApiKey } = this.form.value;
    this.profileService.updateOdooCredentials(odooApiEmail, odooApiKey).subscribe({
      next: () => {
        this.auth.clearMustOdooSetup();
        this.loading = false;
        this.router.navigate(['/dashboard']);
      },
      error: (err) => {
        this.loading      = false;
        this.errorMessage = err.error?.message ?? 'Credenciales inválidas. Verificá tu API key de Odoo.';
      },
    });
  }

  logout(): void { this.auth.logout(); }
}
