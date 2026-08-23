import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MarkdownModule } from 'ngx-markdown';
import { MatButtonModule } from '@angular/material/button';

import { DocsRoutingModule } from './docs-routing.module';
import { DocsComponent } from './docs.component';

@NgModule({
  declarations: [DocsComponent],
  imports: [
    CommonModule,
    DocsRoutingModule,
    MarkdownModule.forChild(),
    MatButtonModule,
  ],
})
export class DocsModule {}
