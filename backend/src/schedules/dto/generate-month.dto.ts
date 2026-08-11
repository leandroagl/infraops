import { IsInt, Max, Min } from 'class-validator';

export class GenerateMonthDto {
  @IsInt() @Min(2024) @Max(2100)
  year: number;

  @IsInt() @Min(1) @Max(12)
  month: number;
}
