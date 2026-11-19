import { DurableObject } from 'cloudflare:workers';
import { httpServerHandler } from 'cloudflare:node';
import { createUnavailableResponse, forwardClientRequest, redirectInsecureRequest, validateWorkerConfiguration } from './config.js';
import { loadMaintenanceTasks, runMaintenance } from './maintenance.js';
import { bindPipelineDownloads, PIPELINE_FILE_PATH, pipelineFileResponse } from '../adapters/pipelineDownload.js';

// One named API object owns the Mongoose connection. Data stays in Atlas.
export class JobverifyApi extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.environment = env;
    this.storage = ctx.storage;
    bindPipelineDownloads(env.API);
  }

  async initialize() {
    if (!this.initializing) {
      this.initializing = (async () => {
        validateWorkerConfiguration(this.environment);
        const { default: mongoose } = await import('mongoose');
        // Set these before importing routes, which compile the models.
        // Index creation belongs to migration, not an incoming request.
        mongoose.set('autoIndex', false);
        mongoose.set('autoCreate', false);
        mongoose.set('bufferCommands', false);
        const [{ createApp }, { assertSecureMongoConnection }] = await Promise.all([
          import('../../../src/app.js'), import('../../../src/utils/mongoConnectionPolicy.js'),
        ]);
        assertSecureMongoConnection(this.environment.MONGO_URI);
        this.mongoose = mongoose;
        const app = createApp({ isReady: () => mongoose.connection.readyState === 1 });
        app.listen(3000);
        this.handler = httpServerHandler({ port: 3000 });
      })().catch(error => { this.initializing = undefined; throw error; });
    }
    await this.initializing;
  }

  async connect() {
    await this.initialize();
    if (this.mongoose.connection.readyState === 1) return;
    if (!this.connecting) {
      this.connecting = (async () => {
        const connection = this.mongoose.connection;
        const client = connection.getClient();
        if (connection.db && client?.topology?.isDestroyed() === false) {
          // Reuse the live client after a stale heartbeat; replacing it can
          // invalidate concurrent transaction sessions.
          await connection.db.command({ ping: 1 }, { timeoutMS: 5000 });
          if (connection.getClient() !== client || client.topology?.isDestroyed() !== false || connection.readyState === 3) {
            throw new Error('Database connection changed during recovery.');
          }
          const { restoreMongooseReadiness } = await import('../../../db/mongooseRecovery.js');
          restoreMongooseReadiness(connection);
          return;
        }
        await this.mongoose.connect(this.environment.MONGO_URI, {
          maxPoolSize: 6, maxConnecting: 2, minPoolSize: 0, maxIdleTimeMS: 20_000,
          serverSelectionTimeoutMS: 5000, connectTimeoutMS: 5000,
          autoIndex: false, autoCreate: false,
        });
      })().finally(() => { this.connecting = undefined; });
    }
    await this.connecting;
  }

  async fetch(request) {
    const url = new URL(request.url);
    if (url.hostname === 'pipeline-download.internal' && url.pathname === PIPELINE_FILE_PATH) {
      return pipelineFileResponse(request, { token: this.environment.GITHUB_PAT });
    }
    try {
      await this.initialize();
      if (request.method !== 'OPTIONS' && new URL(request.url).pathname !== '/health') await this.connect();
      return await this.handler.fetch(request, this.environment, this.ctx);
    } catch (error) {
      console.error(JSON.stringify({ event: 'api_unavailable', name: error?.name || 'Error' }));
      return createUnavailableResponse(request, this.environment);
    }
  }

  async maintain(scheduledTime) {
    if (this.environment.CLOUDFLARE_MAINTENANCE_ENABLED !== 'true') return;
    if (this.maintenance) return this.maintenance;
    this.maintenance = (async () => {
      await this.connect();
      return runMaintenance({ tasks: await loadMaintenanceTasks(), storage: this.storage, scheduledTime });
    })().finally(() => { this.maintenance = undefined; });
    return this.maintenance;
  }
}

const api = env => env.API.get(env.API.idFromName('jobverify-api-v1'));
export default {
  async fetch(request, env) {
    const redirect = redirectInsecureRequest(request);
    if (redirect) return redirect;
    // File fetching is available only through the private DO binding.
    if (new URL(request.url).pathname === PIPELINE_FILE_PATH) return new Response(null, { status: 404 });
    try {
      return await api(env).fetch(forwardClientRequest(request));
    } catch (error) {
      console.error(JSON.stringify({ event: 'api_forward_unavailable', name: error?.name || 'Error' }));
      return createUnavailableResponse(request, env);
    }
  },
  async scheduled(event, env) {
    if (env.CLOUDFLARE_MAINTENANCE_ENABLED === 'true') await api(env).maintain(event.scheduledTime);
  },
};

