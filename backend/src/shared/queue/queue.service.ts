import Queue from 'bull';
import { env } from '../../config/env.js';
import { logger } from '../utils/logger.js';

export type JobProcessor<T> = (data: T) => Promise<void>;

// Wrapper delgado sobre Bull. Cada feature que necesite colas crea su propia
// instancia con un nombre propio (p.ej. "notifications-email"), en vez de
// compartir una cola genérica entre features distintas.
export class QueueService<T = unknown> {
  private readonly queue: Queue.Queue<T>;

  constructor(private readonly name: string = env.queueName) {
    this.queue = new Queue<T>(this.name, {
      redis: {
        host: env.redisHost,
        port: env.redisPort,
        password: env.redisPassword || undefined,
        db: env.redisDb,
      },
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });

    this.queue.on('failed', (job: Queue.Job<T>, err: Error) => {
      logger.error(`Job ${job.id} falló en la cola "${this.name}": ${err.message}`);
    });

    this.queue.on('completed', (job: Queue.Job<T>) => {
      logger.debug(`Job ${job.id} completado en la cola "${this.name}"`);
    });
  }

  async addJob(data: T, options?: Queue.JobOptions): Promise<Queue.Job<T>> {
    return this.queue.add(data, options);
  }

  process(processor: JobProcessor<T>, concurrency: number = env.queueConcurrency): void {
    this.queue.process(concurrency, async (job: Queue.Job<T>) => {
      await processor(job.data);
    });
  }

  async getJobStatus(jobId: string): Promise<string | null> {
    const job = await this.queue.getJob(jobId);
    return job ? job.getState() : null;
  }

  async close(): Promise<void> {
    await this.queue.close();
  }
}
