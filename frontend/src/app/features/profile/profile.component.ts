import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { MeResponse, ProfileService } from '../../core/services/profile.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent implements OnInit {
  me: MeResponse | null = null;
  editForm: FormGroup | null = null;
  editing   = false;
  saving    = false;
  saveError = '';

  constructor(
    private profileService: ProfileService,
    private auth: AuthService,
    private fb: FormBuilder,
    private snackBar: MatSnackBar,
  ) {}

  ngOnInit(): void {
    this.profileService.getMe().subscribe(me => (this.me = me));
  }

  startEdit(): void {
    this.editing   = true;
    this.saveError = '';
    this.editForm  = this.fb.group({
      odooApiEmail: [this.me?.odooApiEmail ?? this.me?.email ?? '', [Validators.required, Validators.email]],
      odooApiKey:   ['', Validators.required],
    });
  }

  cancelEdit(): void {
    this.editing  = false;
    this.editForm = null;
  }

  saveCredentials(): void {
    if (!this.editForm || this.editForm.invalid) return;
    this.saving    = true;
    this.saveError = '';
    const { odooApiEmail, odooApiKey } = this.editForm.value;
    this.profileService.updateOdooCredentials(odooApiEmail, odooApiKey).subscribe({
      next: () => {
        this.saving  = false;
        this.editing = false;
        this.auth.clearMustOdooSetup();
        this.profileService.getMe().subscribe(me => (this.me = me));
        this.snackBar.open('Credenciales actualizadas correctamente', '', { duration: 3000 });
      },
      error: (err) => {
        this.saving    = false;
        this.saveError = err.error?.message ?? 'Credenciales inválidas. Verificá tu API key.';
      },
    });
  }
}
