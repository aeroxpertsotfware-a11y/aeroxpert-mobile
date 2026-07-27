// src/types/Usuario.ts
export type Usuario = {
  _id: string;
  nombre: string;
  email: string;
  rol: string;
  documento?: string;
  aprobado?: boolean;
};
