import { Component, OnInit } from '@angular/core';
import { AuthService } from '../../core/services/auth.service';
import { DocSection, DOCS_SECTIONS } from './data/docs-sections';
import { UserRole } from '../../core/models/auth.models';

@Component({
  selector: 'app-docs',
  templateUrl: './docs.component.html',
  styleUrl: './docs.component.scss',
})
export class DocsComponent implements OnInit {
  visibleSections: DocSection[] = [];
  activeSection!: DocSection;

  private currentUserRole: UserRole = 'TECHNICIAN';

  constructor(private readonly auth: AuthService) {}

  ngOnInit(): void {
    const user = this.auth.getCurrentUser();
    this.currentUserRole = user?.role ?? 'TECHNICIAN';
    this.visibleSections = DOCS_SECTIONS.filter(s =>
      s.roles.includes('*') || s.roles.includes(this.currentUserRole),
    );
    this.activeSection = this.visibleSections[0];
  }

  get activeAssetPath(): string {
    return 'assets/docs/' + this.activeSection.file;
  }

  get activeIndex(): number {
    return this.visibleSections.indexOf(this.activeSection);
  }

  get hasPrev(): boolean {
    return this.activeIndex > 0;
  }

  get hasNext(): boolean {
    return this.activeIndex < this.visibleSections.length - 1;
  }

  get prevSection(): DocSection | null {
    return this.hasPrev ? this.visibleSections[this.activeIndex - 1] : null;
  }

  get nextSection(): DocSection | null {
    return this.hasNext ? this.visibleSections[this.activeIndex + 1] : null;
  }

  selectSection(section: DocSection): void {
    this.activeSection = section;
  }

  goPrev(): void {
    if (this.hasPrev) this.activeSection = this.visibleSections[this.activeIndex - 1];
  }

  goNext(): void {
    if (this.hasNext) this.activeSection = this.visibleSections[this.activeIndex + 1];
  }

  groupedSections(): { group: string; sections: DocSection[] }[] {
    const groups: { group: string; sections: DocSection[] }[] = [];
    for (const section of this.visibleSections) {
      const existing = groups.find(g => g.group === section.group);
      if (existing) {
        existing.sections.push(section);
      } else {
        groups.push({ group: section.group, sections: [section] });
      }
    }
    return groups;
  }
}
