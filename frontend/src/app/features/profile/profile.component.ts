import { Component } from '@angular/core';
import { AuthUser } from '../../core/models/auth.models';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
})
export class ProfileComponent {
  user: AuthUser | null;

  constructor(private auth: AuthService) {
    this.user = auth.getCurrentUser();
  }
}
