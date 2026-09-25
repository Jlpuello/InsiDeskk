export { notificationRoutes } from './notification.routes.js';
export {
  NotificationService,
  registerNotificationListeners,
  shutdownNotificationQueues,
} from './services/notification.service.js';
export type {
  NotificationChannel,
  SendEmailJobData,
  SendNotificationJobData,
  TestNotificationInput,
} from './types/notification.types.js';
