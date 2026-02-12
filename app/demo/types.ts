export interface Feature {
  title: string;
  description: string;
}

export interface DemoStepContent {
  id: number;
  label: string;
  title: string;
  description: string[];
  message: string;
  features: Feature[];
  ctaLabel: string;
}

export enum StepId {
  Setup = 1,
  Input = 2,
  Generation = 3,
  Completion = 4
}
