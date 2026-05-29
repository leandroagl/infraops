import { User } from './user.models';

export interface Technician {
  id: string;
  createdAt: string;
  user: Omit<User, 'technicianId'>;
}

export interface AssignTechnicianPayload {
  userId: string;
}
