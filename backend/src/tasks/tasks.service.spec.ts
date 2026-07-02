import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Client } from '../clients/client.entity';
import { OdooService } from '../integrations/odoo/odoo.service';
import { InfrastructureService } from '../integrations/infradoc/infrastructure.service';
import { ClientInfrastructureDto } from '../integrations/infradoc/dto/client-infrastructure.dto';
import { MaintenanceLog } from '../maintenance-logs/maintenance-log.entity';
import { Technician } from '../technicians/technician.entity';
import { User } from '../users/user.entity';
import { FilterTasksDto } from './dto/filter-tasks.dto';
import { TaskStatus } from './task-status.enum';
import { TaskType } from './task-type.enum';
import { Task } from './task.entity';
import { TasksService } from './tasks.service';

describe('TasksService', () => {
  let service: TasksService;
  let taskRepository: {
    find: jest.Mock;
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    update: jest.Mock;
    delete: jest.Mock;
  };
  let clientRepository: { findOne: jest.Mock };
  let technicianRepository: { findOne: jest.Mock };
  let logRepository: { delete: jest.Mock; findOne: jest.Mock };
  let odooService: {
    createTicket: jest.Mock;
    closeTicket: jest.Mock;
    resolveEmployeeId: jest.Mock;
    markTicketInProgress: jest.Mock;
    postInternalNote: jest.Mock;
  };
  let infrastructureService: { getClientInfrastructure: jest.Mock };

  const emptyInfra: ClientInfrastructureDto = {
    esxiHosts: [], windowsVMs: [], domainControllers: [], linuxVMs: [], nas: [], routers: [],
  };

  const infraWithWindows: ClientInfrastructureDto = {
    ...emptyInfra,
    windowsVMs: [{ assetId: 1, name: 'WS-01', ip: null, bmcIp: null, bmcType: null, os: 'Windows Server 2019', model: null, uri1: null, uri2: null }],
  };

  const mockClient: Client = {
    id: 'client-1',
    infradocId: 10,
    name: 'ACME SA',
    abbreviation: null,
    type: null,
    website: null,
    referral: null,
    rate: null,
    currencyCode: null,
    netTerms: null,
    taxIdNumber: null,
    isLead: false,
    primaryAddress: null,
    notes: null,
    isActive: true,
    lastSyncedAt: null,
    odooPartnerId: null,
    odooSyncedAt: null,
    odooSaleLineId: null,
    createdAt: new Date('2026-01-01'),
  };

  const mockTechnician: Technician = {
    id: 'tech-1',
    user: { id: 'user-1' } as User,
    createdAt: new Date('2026-01-01'),
  };

  const mockTask: Task = {
    id: 'task-1',
    clientId: 'client-1',
    client: mockClient,
    technicianId: 'tech-1',
    technician: mockTechnician,
    type: TaskType.WINDOWS_DOMAIN_MAINTENANCE,
    status: TaskStatus.PENDING,
    scheduledDate: '2026-06-01',
    completedDate: null,
    odooTicketId: null,
    createdAt: new Date('2026-05-01'),
  };

  beforeEach(async () => {
    taskRepository = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    clientRepository = { findOne: jest.fn() };
    technicianRepository = { findOne: jest.fn() };
    logRepository = { delete: jest.fn(), findOne: jest.fn().mockResolvedValue(null) };
    odooService = {
      createTicket: jest.fn(),
      closeTicket: jest.fn(),
      resolveEmployeeId: jest.fn(),
      markTicketInProgress: jest.fn(),
      postInternalNote: jest.fn().mockResolvedValue(undefined),
    };
    infrastructureService = { getClientInfrastructure: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: getRepositoryToken(Task),           useValue: taskRepository },
        { provide: getRepositoryToken(Client),         useValue: clientRepository },
        { provide: getRepositoryToken(Technician),     useValue: technicianRepository },
        { provide: getRepositoryToken(MaintenanceLog), useValue: logRepository },
        { provide: OdooService,                        useValue: odooService },
        { provide: InfrastructureService,             useValue: infrastructureService },
      ],
    }).compile();

    service = module.get(TasksService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('retorna todas las tareas sin filtros', async () => {
      taskRepository.find.mockResolvedValue([mockTask]);

      const result = await service.findAll({});

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: {},
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('task-1');
    });

    it('aplica filtro por status cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([]);

      await service.findAll({ status: TaskStatus.PENDING });

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { status: TaskStatus.PENDING },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });

    it('aplica filtro por clientId cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([]);

      await service.findAll({ clientId: 'client-1' });

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { clientId: 'client-1' },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });

    it('aplica filtro por technicianId cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([]);

      await service.findAll({ technicianId: 'tech-1' });

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { technicianId: 'tech-1' },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });

    it('aplica filtro por type cuando se provee', async () => {
      taskRepository.find.mockResolvedValue([mockTask]);

      await service.findAll({
        type: TaskType.WINDOWS_DOMAIN_MAINTENANCE,
      });

      expect(taskRepository.find).toHaveBeenCalledWith({
        where: { type: TaskType.WINDOWS_DOMAIN_MAINTENANCE },
        relations: ['client', 'technician', 'technician.user'],
        order: { scheduledDate: 'ASC' },
      });
    });
  });

  describe('create', () => {
    const createDto = {
      clientId: 'client-1',
      technicianId: 'tech-1',
      type: TaskType.WINDOWS_DOMAIN_MAINTENANCE,
      scheduledDate: '2026-06-01',
    };

    it('crea y devuelve la tarea con cliente y técnico cargados', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockResolvedValue(infraWithWindows);
      odooService.createTicket.mockResolvedValue(42);
      taskRepository.create.mockReturnValue({ ...mockTask, odooTicketId: 42 });
      taskRepository.save.mockResolvedValue({ ...mockTask, odooTicketId: 42 });
      taskRepository.findOne.mockResolvedValue({ ...mockTask, odooTicketId: 42 });

      const result = await service.create(createDto);

      expect(odooService.createTicket).toHaveBeenCalledWith(
        'client-1',
        'tech-1',
        TaskType.WINDOWS_DOMAIN_MAINTENANCE,
      );
      expect(taskRepository.create).toHaveBeenCalledWith({
        clientId: 'client-1',
        technicianId: 'tech-1',
        type: TaskType.WINDOWS_DOMAIN_MAINTENANCE,
        scheduledDate: '2026-06-01',
        odooTicketId: 42,
      });
      expect(taskRepository.save).toHaveBeenCalled();
      expect(result.odooTicketId).toBe(42);
    });

    it('no guarda la tarea si Odoo falla al crear el ticket', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockResolvedValue(infraWithWindows);
      odooService.createTicket.mockRejectedValue(
        new ServiceUnavailableException('Odoo no disponible'),
      );

      await expect(service.create(createDto)).rejects.toThrow(ServiceUnavailableException);
      expect(taskRepository.save).not.toHaveBeenCalled();
    });

    it('lanza NotFoundException con mensaje si el cliente no existe', async () => {
      clientRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        'Cliente no encontrado',
      );
    });

    it('lanza NotFoundException con mensaje si el técnico no existe', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(null);

      await expect(service.create(createDto)).rejects.toThrow(
        'Técnico no encontrado',
      );
    });

    it('lanza BadRequestException si cliente sin VMs Windows para WINDOWS_DOMAIN_MAINTENANCE', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

      await expect(service.create(createDto)).rejects.toThrow(
        'El cliente no tiene VMs Windows ni controladores de dominio en InfraDoc',
      );
      expect(odooService.createTicket).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si cliente sin esxiHosts para SERVER_HOST_MAINTENANCE', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

      await expect(
        service.create({ ...createDto, type: TaskType.SERVER_HOST_MAINTENANCE }),
      ).rejects.toThrow('El cliente no tiene servidores ESXi/BMC registrados en InfraDoc');
      expect(odooService.createTicket).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si cliente sin routers para ROUTER_MAINTENANCE', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

      await expect(
        service.create({ ...createDto, type: TaskType.ROUTER_MAINTENANCE }),
      ).rejects.toThrow('El cliente no tiene routers/firewalls registrados en InfraDoc');
      expect(odooService.createTicket).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si cliente sin NAS para QNAP_MAINTENANCE', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

      await expect(
        service.create({ ...createDto, type: TaskType.QNAP_MAINTENANCE }),
      ).rejects.toThrow('El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc');
      expect(odooService.createTicket).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si cliente sin NAS para VEEAM_BACKUP', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockResolvedValue(emptyInfra);

      await expect(
        service.create({ ...createDto, type: TaskType.VEEAM_BACKUP }),
      ).rejects.toThrow('El cliente no tiene dispositivos NAS/QNAP registrados en InfraDoc (requerido para Veeam)');
      expect(odooService.createTicket).not.toHaveBeenCalled();
    });

    it('no llama a InfrastructureService y crea tarea para SITE_VISIT', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      odooService.createTicket.mockResolvedValue(null);
      taskRepository.create.mockReturnValue({ ...mockTask, type: TaskType.SITE_VISIT, odooTicketId: null });
      taskRepository.save.mockResolvedValue({ ...mockTask, type: TaskType.SITE_VISIT, odooTicketId: null });
      taskRepository.findOne.mockResolvedValue({ ...mockTask, type: TaskType.SITE_VISIT, odooTicketId: null });

      await service.create({ ...createDto, type: TaskType.SITE_VISIT });

      expect(infrastructureService.getClientInfrastructure).not.toHaveBeenCalled();
      expect(taskRepository.save).toHaveBeenCalled();
    });

    it('propaga ServiceUnavailableException cuando InfraDoc no está disponible', async () => {
      clientRepository.findOne.mockResolvedValue(mockClient);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      infrastructureService.getClientInfrastructure.mockRejectedValue(
        new ServiceUnavailableException('InfraDoc no disponible'),
      );

      await expect(service.create(createDto)).rejects.toThrow(ServiceUnavailableException);
      expect(odooService.createTicket).not.toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('actualiza campos editables y devuelve la tarea actualizada', async () => {
      const updatedTask = { ...mockTask, technicianId: 'tech-2' };
      taskRepository.findOne
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce(updatedTask);
      technicianRepository.findOne.mockResolvedValue(mockTechnician);
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.update('task-1', { technicianId: 'tech-2' });

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        technicianId: 'tech-2',
      });
      expect(result.technicianId).toBe('tech-2');
    });

    it('lanza BadRequestException si el body está vacío', async () => {
      await expect(service.update('task-1', {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('nonexistent', { scheduledDate: '2026-07-01' }),
      ).rejects.toThrow('Tarea no encontrada');
    });

    it('lanza NotFoundException si el technicianId nuevo no existe', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      technicianRepository.findOne.mockResolvedValue(null);

      await expect(
        service.update('task-1', { technicianId: 'nonexistent' }),
      ).rejects.toThrow('Técnico no encontrado');
    });
  });

  describe('updateStatus', () => {
    it('transiciona PENDING → IN_PROGRESS correctamente', async () => {
      taskRepository.findOne
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce({ ...mockTask, status: TaskStatus.IN_PROGRESS });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus(
        'task-1',
        TaskStatus.IN_PROGRESS,
      );

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.IN_PROGRESS,
        completedDate: null,
      });
      expect(result.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('transiciona PENDING → NOT_DONE y setea completedDate', async () => {
      const now = new Date();
      jest.useFakeTimers().setSystemTime(now);
      taskRepository.findOne
        .mockResolvedValueOnce(mockTask)
        .mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.NOT_DONE,
          completedDate: now,
        });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('task-1', TaskStatus.NOT_DONE);

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.NOT_DONE,
        completedDate: now,
      });
      expect(result.completedDate).toEqual(now);

      jest.useRealTimers();
    });

    it('transiciona IN_PROGRESS → DONE y setea completedDate', async () => {
      const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      const now = new Date();
      jest.useFakeTimers().setSystemTime(now);
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({
          ...inProgressTask,
          status: TaskStatus.DONE,
          completedDate: now,
        });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      const result = await service.updateStatus('task-1', TaskStatus.DONE);

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.DONE,
        completedDate: now,
      });
      expect(result.completedDate).toEqual(now);

      jest.useRealTimers();
    });

    it('transiciona IN_PROGRESS → ESCALATED y setea completedDate', async () => {
      const inProgressTask = { ...mockTask, status: TaskStatus.IN_PROGRESS };
      const now = new Date();
      jest.useFakeTimers().setSystemTime(now);
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({
          ...inProgressTask,
          status: TaskStatus.ESCALATED,
          completedDate: now,
        });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.ESCALATED);

      expect(taskRepository.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.ESCALATED,
        completedDate: now,
      });

      jest.useRealTimers();
    });

    it('lanza BadRequestException en transición inválida PENDING → DONE', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);

      await expect(
        service.updateStatus('task-1', TaskStatus.DONE),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException en transición inválida PENDING → ESCALATED', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);

      await expect(
        service.updateStatus('task-1', TaskStatus.ESCALATED),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza BadRequestException si la tarea ya está en estado terminal', async () => {
      const doneTask = { ...mockTask, status: TaskStatus.DONE };
      taskRepository.findOne.mockResolvedValue(doneTask);

      await expect(
        service.updateStatus('task-1', TaskStatus.PENDING),
      ).rejects.toThrow(BadRequestException);
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', TaskStatus.IN_PROGRESS),
      ).rejects.toThrow('Tarea no encontrada');
    });

    it('llama closeTicket al transicionar a DONE cuando la tarea tiene odooTicketId', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.DONE, 90);

      expect(odooService.resolveEmployeeId).toHaveBeenCalledWith('user-1');
      expect(odooService.closeTicket).toHaveBeenCalledWith(42, 22, 1.5);
    });

    it('llama closeTicket al transicionar a NOT_DONE cuando la tarea tiene odooTicketId', async () => {
      const taskWithTicket = {
        ...mockTask,
        status: TaskStatus.PENDING,
        odooTicketId: 55,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(taskWithTicket)
        .mockResolvedValueOnce({
          ...taskWithTicket,
          status: TaskStatus.NOT_DONE,
        });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.NOT_DONE, 60);

      expect(odooService.closeTicket).toHaveBeenCalledWith(55, 22, 1.0);
    });

    it('no llama closeTicket cuando odooTicketId es null', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: null,
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.DONE, 90);

      expect(odooService.closeTicket).not.toHaveBeenCalled();
      expect(odooService.resolveEmployeeId).not.toHaveBeenCalled();
    });

    it('no llama closeTicket al transicionar a ESCALATED', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({
          ...inProgressTask,
          status: TaskStatus.ESCALATED,
        });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.ESCALATED);

      expect(odooService.closeTicket).not.toHaveBeenCalled();
    });

    it('propaga el error de Odoo y no actualiza el status en DB cuando closeTicket falla', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne.mockResolvedValueOnce(inProgressTask);
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockRejectedValue(
        new ServiceUnavailableException('Odoo caído'),
      );

      await expect(
        service.updateStatus('task-1', TaskStatus.DONE, 90),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si el técnico no tiene odooEmployeeId y hay ticket', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne.mockResolvedValueOnce(inProgressTask);
      odooService.resolveEmployeeId.mockResolvedValue(null);

      await expect(
        service.updateStatus('task-1', TaskStatus.DONE, 90),
      ).rejects.toThrow(BadRequestException);
      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('lanza BadRequestException si la tarea tiene ticket pero el técnico no tiene usuario asociado', async () => {
      const taskWithNoUser = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: null },
      };
      taskRepository.findOne.mockResolvedValueOnce(taskWithNoUser);

      await expect(
        service.updateStatus('task-1', TaskStatus.DONE, 60),
      ).rejects.toThrow(BadRequestException);
      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('llama markTicketInProgress al transicionar a IN_PROGRESS cuando la tarea tiene odooTicketId', async () => {
      const pendingTaskWithTicket = {
        ...mockTask,
        status: TaskStatus.PENDING,
        odooTicketId: 42,
      };
      taskRepository.findOne
        .mockResolvedValueOnce(pendingTaskWithTicket)
        .mockResolvedValueOnce({
          ...pendingTaskWithTicket,
          status: TaskStatus.IN_PROGRESS,
        });
      odooService.markTicketInProgress.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.IN_PROGRESS);

      expect(odooService.markTicketInProgress).toHaveBeenCalledWith(42);
    });

    it('no llama markTicketInProgress al transicionar a IN_PROGRESS cuando odooTicketId es null', async () => {
      taskRepository.findOne
        .mockResolvedValueOnce(mockTask) // mockTask ya tiene odooTicketId: null
        .mockResolvedValueOnce({ ...mockTask, status: TaskStatus.IN_PROGRESS });
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.IN_PROGRESS);

      expect(odooService.markTicketInProgress).not.toHaveBeenCalled();
    });

    it('no llama markTicketInProgress al transicionar a DONE', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });

      await service.updateStatus('task-1', TaskStatus.DONE, 90);

      expect(odooService.markTicketInProgress).not.toHaveBeenCalled();
    });

    it('propaga el error de Odoo y no actualiza el status en DB cuando markTicketInProgress falla', async () => {
      const pendingTaskWithTicket = {
        ...mockTask,
        status: TaskStatus.PENDING,
        odooTicketId: 42,
      };
      taskRepository.findOne.mockResolvedValueOnce(pendingTaskWithTicket);
      odooService.markTicketInProgress.mockRejectedValue(
        new ServiceUnavailableException('Odoo caído'),
      );

      await expect(
        service.updateStatus('task-1', TaskStatus.IN_PROGRESS),
      ).rejects.toThrow(ServiceUnavailableException);
      expect(taskRepository.update).not.toHaveBeenCalled();
    });

    it('postea nota interna en Odoo al completar DONE cuando el log tiene notes', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });
      logRepository.findOne.mockResolvedValue({ notes: 'Se detectó disco con advertencia.' });

      await service.updateStatus('task-1', TaskStatus.DONE, 90);

      expect(odooService.postInternalNote).toHaveBeenCalledWith(42, 'Se detectó disco con advertencia.');
    });

    it('no postea nota interna cuando el log no tiene notes', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });
      logRepository.findOne.mockResolvedValue({ notes: null });

      await service.updateStatus('task-1', TaskStatus.DONE, 90);

      expect(odooService.postInternalNote).not.toHaveBeenCalled();
    });

    it('no postea nota interna cuando no existe log para la tarea', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });
      logRepository.findOne.mockResolvedValue(null);

      await service.updateStatus('task-1', TaskStatus.DONE, 90);

      expect(odooService.postInternalNote).not.toHaveBeenCalled();
    });

    it('no postea nota interna al transicionar a NOT_DONE', async () => {
      const taskWithTicket = {
        ...mockTask,
        status: TaskStatus.PENDING,
        odooTicketId: 55,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(taskWithTicket)
        .mockResolvedValueOnce({ ...taskWithTicket, status: TaskStatus.NOT_DONE });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });
      logRepository.findOne.mockResolvedValue({ notes: 'Nota que no debe enviarse.' });

      await service.updateStatus('task-1', TaskStatus.NOT_DONE, 0);

      expect(odooService.postInternalNote).not.toHaveBeenCalled();
    });

    it('completa la transición a DONE aunque postInternalNote falle', async () => {
      const inProgressTask = {
        ...mockTask,
        status: TaskStatus.IN_PROGRESS,
        odooTicketId: 42,
        technician: { user: { id: 'user-1' } },
      };
      taskRepository.findOne
        .mockResolvedValueOnce(inProgressTask)
        .mockResolvedValueOnce({ ...inProgressTask, status: TaskStatus.DONE });
      odooService.resolveEmployeeId.mockResolvedValue(22);
      odooService.closeTicket.mockResolvedValue(undefined);
      taskRepository.update.mockResolvedValue({ affected: 1 });
      logRepository.findOne.mockResolvedValue({ notes: 'Nota.' });
      odooService.postInternalNote.mockRejectedValue(new Error('Odoo caído'));

      await expect(service.updateStatus('task-1', TaskStatus.DONE, 90)).resolves.not.toThrow();
      expect(taskRepository.update).toHaveBeenCalledWith('task-1', expect.objectContaining({ status: TaskStatus.DONE }));
    });
  });

  describe('remove', () => {
    it('elimina el log asociado y la tarea cuando la tarea existe', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.delete.mockResolvedValue({ affected: 1 });
      taskRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('task-1');

      expect(taskRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'task-1' },
      });
      expect(logRepository.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(taskRepository.delete).toHaveBeenCalledWith('task-1');
    });

    it('elimina la tarea aunque no haya log asociado (delete es no-op)', async () => {
      taskRepository.findOne.mockResolvedValue(mockTask);
      logRepository.delete.mockResolvedValue({ affected: 0 });
      taskRepository.delete.mockResolvedValue({ affected: 1 });

      await service.remove('task-1');

      expect(logRepository.delete).toHaveBeenCalledWith({ taskId: 'task-1' });
      expect(taskRepository.delete).toHaveBeenCalledWith('task-1');
    });

    it('lanza NotFoundException si la tarea no existe', async () => {
      taskRepository.findOne.mockResolvedValue(null);

      await expect(service.remove('nonexistent')).rejects.toThrow(
        'Tarea no encontrada',
      );

      expect(logRepository.delete).not.toHaveBeenCalled();
      expect(taskRepository.delete).not.toHaveBeenCalled();
    });
  });
});
