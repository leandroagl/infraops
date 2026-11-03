import { Component, EventEmitter, Input, Output } from '@angular/core';
import type { ClientOfflineAlert } from '../../../../core/models/network.models';

@Component({
  selector: 'app-network-alert-drawer',
  templateUrl: './network-alert-drawer.component.html',
  styleUrl: './network-alert-drawer.component.scss',
})
export class NetworkAlertDrawerComponent {
  @Input() client!: ClientOfflineAlert;
  @Output() drawerClosed = new EventEmitter<void>();

  displayedColumns = ['siteName', 'deviceName', 'deviceModel', 'severity'];
}
