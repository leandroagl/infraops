import { Component, Input } from '@angular/core';
import { FormGroup } from '@angular/forms';
import { InfraAsset } from '../../../../../core/models/infradoc.models';

@Component({
  selector: 'app-router-device-card',
  templateUrl: './router-device-card.component.html',
  styleUrl: './router-device-card.component.scss',
})
export class RouterDeviceCardComponent {
  @Input() device!: InfraAsset;
  @Input() group!: FormGroup;
  @Input() readOnly = false;

  get deviceLabel(): string {
    const parts = [this.device.make, this.device.model].filter(Boolean);
    return parts.length ? parts.join(' ') : this.device.name;
  }

  get firmwareUpdated(): boolean {
    return this.group.get('firmwareUpdated')?.value === true;
  }
}
