export interface CreateCompanyInput {
  nombre: string;
  razonSocial?: string;
  nit?: string;
  emailContacto?: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  pais?: string;
  contrato?: string;
  remotelyGroupId?: string | null;
}

export type UpdateCompanyInput = Partial<CreateCompanyInput> & { activo?: boolean; verificado?: boolean };
