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

  get firmwareUpdated(): boolean {
    return this.group.get('firmwareUpdated')?.value === true;
  }
}
