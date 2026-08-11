import { Component, OnInit } from '@angular/core';
import { forkJoin } from 'rxjs';
import { MonthlyPreview, SchedulesService } from '../schedules.service';

const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                     'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export interface MonthCard {
  month: number;
  name: string;
  group: 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN';
  preview: MonthlyPreview | null;
  isCurrentMonth: boolean;
  isFuture: boolean;
  expanded: boolean;
}

@Component({
  selector: 'app-calendar-tab',
  templateUrl: './calendar-tab.component.html',
  styleUrl: './calendar-tab.component.scss',
})
export class CalendarTabComponent implements OnInit {
  year = new Date().getFullYear();
  currentMonth = new Date().getMonth() + 1;
  cards: MonthCard[] = [];
  loading = false;

  constructor(private readonly schedulesService: SchedulesService) {}

  ngOnInit(): void {
    this.loadYear();
  }

  prevYear(): void {
    this.year--;
    this.loadYear();
  }

  nextYear(): void {
    this.year++;
    this.loadYear();
  }

  private loadYear(): void {
    this.loading = true;
    const currentYear = new Date().getFullYear();
    const requests = Array.from({ length: 12 }, (_, i) =>
      this.schedulesService.getMonthlyPreview(this.year, i + 1),
    );
    forkJoin(requests).subscribe({
      next: previews => {
        this.cards = previews.map((p, i) => {
          const month = i + 1;
          return {
            month,
            name: MONTH_NAMES[month],
            group: p.group,
            preview: p,
            isCurrentMonth: this.year === currentYear && month === this.currentMonth,
            isFuture: this.year > currentYear || (this.year === currentYear && month > this.currentMonth),
            expanded: false,
          };
        });
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }

  toggle(card: MonthCard): void {
    card.expanded = !card.expanded;
  }

  groupLabel(group: 'BIMONTHLY_ODD' | 'BIMONTHLY_EVEN'): string {
    return group === 'BIMONTHLY_EVEN' ? 'A · Par' : 'B · Impar';
  }
}
