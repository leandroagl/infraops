import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { UserRole } from '../users/user-role.enum';
import { AssignTechnicianDto } from './dto/assign-technician.dto';
import { TechniciansController } from './technicians.controller';
import { TechniciansService } from './technicians.service';

describe('TechniciansController', () => {
  let controller: TechniciansController;
  let techniciansService: {
    findAll: jest.Mock;
    assign: jest.Mock;
    remove: jest.Mock;
  };

  const mockResult = {
    id: 'tech-1',
    createdAt: new Date('2026-01-01'),
    user: {
      id: 'user-1',
      name: 'Valen López',
      email: 'valen@ondra.com',
      role: UserRole.TECHNICIAN,
      isActive: true,
      mustChangePassword: false,
      createdAt: new Date('2026-01-01'),
    },
  };

  beforeEach(async () => {
    techniciansService = {
      findAll: jest.fn(),
      assign: jest.fn(),
      remove: jest.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [TechniciansController],
      providers: [
        { provide: TechniciansService, useValue: techniciansService },
      ],
    }).compile();

    controller = module.get(TechniciansController);
  });

  describe('findAll', () => {
    it('llama a techniciansService.findAll y devuelve el resultado', async () => {
      techniciansService.findAll.mockResolvedValue([mockResult]);

      const result = await controller.findAll();

      expect(techniciansService.findAll).toHaveBeenCalled();
      expect(result).toEqual([mockResult]);
    });
  });

  describe('assign', () => {
    const dto: AssignTechnicianDto = { userId: 'user-1' };

    it('llama a techniciansService.assign con el userId y devuelve el resultado', async () => {
      techniciansService.assign.mockResolvedValue(mockResult);

      const result = await controller.assign(dto);

      expect(techniciansService.assign).toHaveBeenCalledWith('user-1');
      expect(result).toEqual(mockResult);
    });

    it('propaga NotFoundException si el user no existe', async () => {
      techniciansService.assign.mockRejectedValue(new NotFoundException());

      await expect(controller.assign(dto)).rejects.toThrow(NotFoundException);
    });

    it('propaga ConflictException si el user ya tiene perfil técnico', async () => {
      techniciansService.assign.mockRejectedValue(new ConflictException());

      await expect(controller.assign(dto)).rejects.toThrow(ConflictException);
    });
  });

  describe('remove', () => {
    it('llama a techniciansService.remove con el id y devuelve ok: true', async () => {
      techniciansService.remove.mockResolvedValue(undefined);

      const result = await controller.remove('tech-1');

      expect(techniciansService.remove).toHaveBeenCalledWith('tech-1');
      expect(result).toEqual({ ok: true });
    });

    it('propaga NotFoundException si el id no existe', async () => {
      techniciansService.remove.mockRejectedValue(new NotFoundException());

      await expect(controller.remove('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
