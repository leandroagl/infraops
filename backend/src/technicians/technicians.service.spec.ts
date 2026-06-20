import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { IsNull, Not } from 'typeorm';
import { Technician } from './technician.entity';
import { TechniciansService } from './technicians.service';
import { User } from '../users/user.entity';
import { UserRole } from '../users/user-role.enum';

describe('TechniciansService', () => {
  let service: TechniciansService;
  let userRepository: {
    findOne: jest.Mock;
    find: jest.Mock;
    update: jest.Mock;
  };
  let technicianRepository: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    delete: jest.Mock;
  };

  const mockTechnician: Technician = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
  };

  const mockUser: User = {
    id: 'user-1',
    name: 'Valen López',
    email: 'valen@ondra.com',
    passwordHash: 'hashed',
    role: UserRole.TECHNICIAN,
    mustChangePassword: false,
    lastLogoutAt: null,
    isActive: true,
    technicianId: null,
    technician: null,
    createdAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    userRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      update: jest.fn(),
    };
    technicianRepository = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        TechniciansService,
        { provide: getRepositoryToken(User), useValue: userRepository },
        {
          provide: getRepositoryToken(Technician),
          useValue: technicianRepository,
        },
      ],
    }).compile();

    service = module.get(TechniciansService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('retorna todos los usuarios con perfil técnico sin passwordHash ni technician', async () => {
      const userWithTech = {
        ...mockUser,
        technicianId: 'tech-1',
        technician: mockTechnician,
      };
      userRepository.find.mockResolvedValue([userWithTech]);

      const result = await service.findAll();

      expect(userRepository.find).toHaveBeenCalledWith({
        where: { technicianId: Not(IsNull()) },
        relations: ['technician'],
        order: { name: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('tech-1');
      expect(result[0].createdAt).toEqual(mockTechnician.createdAt);
      expect(result[0].user.id).toBe('user-1');
      expect(result[0].user).not.toHaveProperty('passwordHash');
      expect(result[0].user).not.toHaveProperty('technicianId');
      expect(result[0].user).not.toHaveProperty('technician');
    });
  });

  describe('assign', () => {
    it('crea perfil técnico, actualiza technicianId en el user y devuelve el resultado', async () => {
      userRepository.findOne.mockResolvedValue(mockUser);
      technicianRepository.create.mockReturnValue(mockTechnician);
      technicianRepository.save.mockResolvedValue(mockTechnician);
      userRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.assign('user-1');

      expect(technicianRepository.create).toHaveBeenCalled();
      expect(technicianRepository.save).toHaveBeenCalledWith(mockTechnician);
      expect(userRepository.update).toHaveBeenCalledWith('user-1', {
        technicianId: 'tech-1',
      });
      expect(result.id).toBe('tech-1');
      expect(result.user.id).toBe('user-1');
      expect(result.user).not.toHaveProperty('passwordHash');
    });

    it('lanza NotFoundException si el user no existe', async () => {
      userRepository.findOne.mockResolvedValue(null);

      await expect(service.assign('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lanza ConflictException si el user ya tiene perfil técnico', async () => {
      userRepository.findOne.mockResolvedValue({
        ...mockUser,
        technicianId: 'tech-existing',
      });

      await expect(service.assign('user-1')).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('limpia technicianId del user y elimina el Technician', async () => {
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      userRepository.update.mockResolvedValue({ affected: 1 });
      technicianRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('tech-1');

      expect(userRepository.update).toHaveBeenCalledWith(
        { technicianId: 'tech-1' },
        { technicianId: null },
      );
      expect(technicianRepository.delete).toHaveBeenCalledWith('tech-1');
    });

    it('lanza NotFoundException si el Technician no existe', async () => {
      technicianRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
