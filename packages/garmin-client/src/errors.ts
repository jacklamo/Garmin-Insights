// Message is fixed on purpose: never forward upstream messages, they may embed URLs/headers/keys.
export class GarminHttpError extends Error {
  constructor(public step: string, public status: number) {
    super(`Garmin request failed at ${step} (status ${status})`);
    this.name = 'GarminHttpError';
  }
}
