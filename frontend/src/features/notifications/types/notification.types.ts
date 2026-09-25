export interface AppNotification {
  id: string;
  titulo: string;
  mensaje: string;
  link?: string | null;
  leida: boolean;
  createdAt: string;
}
