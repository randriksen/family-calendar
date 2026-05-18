export interface BuildInfo {
  version: string;
  buildDate: string;
  buildTime: string;
  commit?: string;
}

// This will be injected at build time
export const BUILD_INFO: BuildInfo = {
  version: '1.1.0',
  buildDate: new Date().toISOString().split('T')[0],
  buildTime: new Date().toISOString(),
};
