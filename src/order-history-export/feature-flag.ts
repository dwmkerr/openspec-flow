// Feature-flag interface for gating the export endpoint and UI.
// Production wires this to the shared flag provider used by the orders page;
// tests inject a deterministic stub.

export interface FeatureFlag {
  isEnabled(userId: string | null): boolean;
}

export const alwaysOn: FeatureFlag = { isEnabled: () => true };
export const alwaysOff: FeatureFlag = { isEnabled: () => false };

export const staticFlag = (enabled: boolean): FeatureFlag => ({
  isEnabled: () => enabled,
});
