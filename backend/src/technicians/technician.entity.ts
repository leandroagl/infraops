import { CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('technicians')
export class Technician {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @CreateDateColumn()
  createdAt: Date;
}
