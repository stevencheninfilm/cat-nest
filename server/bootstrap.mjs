import { createCourtServer } from './court.mjs';
import { createPetHandler } from './pet-server.mjs';

/** The shared service can serve GitHub-backed homes while Postgres is offline.
 * Court-only callers retain createCourtServer's default fail-closed startup. */
export async function createApplicationServer({ petOptions = {}, courtOptions = {} } = {}) {
  let server;
  const petHandler = createPetHandler({
    ...petOptions,
    serveStatic: false,
    healthDetails: () => {
      const court = server.courtStorageStatus();
      return { court, degraded: !court.available };
    },
  });
  try {
    server = await createCourtServer({ ...courtOptions, allowUnavailableStorage: true, handleRequest: petHandler });
  } catch (error) {
    petHandler.close();
    throw error;
  }
  server.closePetHandler = petHandler.close;
  server.on('close', petHandler.close);
  return server;
}
