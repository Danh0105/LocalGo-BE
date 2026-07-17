export interface AboutMediaRef {
  mediaId: string | null;
  imageAlt: string;
}

export interface AboutStatisticSnapshot {
  id: string;
  value: string;
  unit: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AboutHighlightSnapshot extends AboutMediaRef {
  id: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AboutMilestoneSnapshot {
  id: string;
  year: string;
  title: string;
  description: string;
  sortOrder: number;
  isActive: boolean;
}

export interface AboutSnapshot {
  title: string;
  hero: AboutMediaRef;
  overview: { title: string; paragraphs: string[] };
  statistics: AboutStatisticSnapshot[];
  highlightsSectionTitle: string;
  highlights: AboutHighlightSnapshot[];
  milestonesSectionTitle: string;
  milestones: AboutMilestoneSnapshot[];
}
