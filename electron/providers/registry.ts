import type { MediaServerProvider } from "./types";
import { UserFacingError } from "../../src/shared/i18n";
export class ProviderRegistry {
  private readonly providers = new Map<string, MediaServerProvider>();
  constructor(providers: MediaServerProvider[]) {
    for (const provider of providers) {
      if (this.providers.has(provider.id)) throw new Error(`Duplicate provider: ${provider.id}`);
      this.providers.set(provider.id, provider);
    }
  }
  get(id: string): MediaServerProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new UserFacingError("providerMissing");
    return provider;
  }
  list(): { id: string; name: string }[] {
    return [...this.providers.values()].map(({ id, name }) => ({ id, name }));
  }
  partition(server: { id: string; providerId: string }): string {
    this.get(server.providerId);
    return `persist:${server.providerId}-${server.id}`;
  }
}
