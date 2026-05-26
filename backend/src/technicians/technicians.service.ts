import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Not, Repository } from 'typeorm';
import { User } from '../users/user.entity';
import { Technician } from './technician.entity';

export type TechnicianUserResponse = {
  id: string;
  createdAt: Date;
  user: Omit<User, 'passwordHash' | 'lastLogoutAt' | 'technician' | 'technicianId'>;
};

@Injectable()
export class TechniciansService {
  constructor(
    @InjectRepository(Technician)
    private readonly technicianRepository: Repository<Technician>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  async findAll(): Promise<TechnicianUserResponse[]> {
    const users = await this.userRepository.find({
      where: { technicianId: Not(IsNull()) },
      relations: ['technician'],
      order: { name: 'ASC' },
    });
    return users.map((u) => this.toResponse(u));
  }

  async assign(userId: string): Promise<TechnicianUserResponse> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado');
    if (user.technicianId) throw new ConflictException('Este usuario ya tiene perfil técnico');

    const technician = await this.technicianRepository.save(
      this.technicianRepository.create(),
    );
    await this.userRepository.update(userId, { technicianId: technician.id });

    const { passwordHash, lastLogoutAt, technician: _t, technicianId: _tid, ...userFields } = user;
    return { id: technician.id, createdAt: technician.createdAt, user: userFields };
  }

  async remove(id: string): Promise<void> {
    const technician = await this.technicianRepository.findOne({ where: { id } });
    if (!technician) throw new NotFoundException('Perfil técnico no encontrado');

    await this.userRepository.update({ technicianId: id }, { technicianId: null });
    await this.technicianRepository.delete(id);
  }

  private toResponse(user: User): TechnicianUserResponse {
    const { passwordHash, lastLogoutAt, technician, technicianId, ...userFields } = user;
    return {
      id: technicianId!,
      createdAt: technician!.createdAt,
      user: userFields,
    };
  }
}
