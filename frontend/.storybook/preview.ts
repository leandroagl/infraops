import { applicationConfig } from '@storybook/angular';
import { provideAnimations } from '@angular/platform-browser/animations';

export const decorators = [
  applicationConfig({
    providers: [provideAnimations()],
  }),
];
