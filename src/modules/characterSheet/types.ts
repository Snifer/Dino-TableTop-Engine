export type WidgetType =
  | 'frame'
  | 'label'
  | 'text'
  | 'counter'
  | 'check'
  | 'button'
  | 'grid'
  | 'list'
  | 'image'
  | 'calculated';

export interface WidgetStyle {
  border?: boolean;
  borderWidth?: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
  borderColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  textColor?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold';
  fontStyle?: 'normal' | 'italic';
  textDecoration?: 'none' | 'underline' | 'line-through';
  textAlign?: 'left' | 'center' | 'right';
  fontFamily?: string;
  opacity?: number;
  title?: string;
  titleAlign?: 'left' | 'center' | 'right';
}

export interface GridColumn {
  key: string;
  label: string;
  type: 'text' | 'number' | 'check';
  width?: number;
}

export interface WidgetAction {
  formula: string;
  reason?: string;
  render?: boolean;
}

export interface SheetWidget {
  id: string;
  type: WidgetType;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  style?: WidgetStyle;
  
  // Data binding
  bind?: string; // Frontmatter key, e.g. "hp", "fuerza" or heading "## Historia"
  
  // Counter options
  min?: number | string; // Number or "@key"
  max?: number | string; // Number or "@key"
  step?: number;
  display?: 'number' | 'bar' | 'both';
  
  // Text options
  lines?: number;
  placeholder?: string;
  readOnly?: boolean;
  
  // Grid / Table options
  columns?: GridColumn[];
  
  // Button & Counter action
  action?: WidgetAction;
  
  // Calculated widget formula
  formula?: string; // e.g. "floor((@fuerza - 10) / 2)"
  
  // Image / portrait options
  imagePath?: string;
  shape?: 'square' | 'circle';
  fit?: 'cover' | 'contain';
}

export interface SheetBackground {
  path: string;
  fit: 'cover' | 'contain';
  opacity: number;
}

export interface SheetTemplate {
  id: string;
  name: string;
  width: number;
  height: number;
  background?: SheetBackground | null;
  widgets: SheetWidget[];
}

export interface CharacterSheetSettings {
  property: string; // Default: 'dte-sheet'
  templates: SheetTemplate[];
  defaultTemplateId?: string | null;
}
