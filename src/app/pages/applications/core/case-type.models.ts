export type FieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'number'
  | 'date'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'radio';

export interface FieldOption {
  value: string | number | boolean;
  label: string;
}

export interface FieldValidationConfig {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  email?: boolean;
}

export interface FieldSchema {
  key: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  options?: FieldOption[];
  defaultValue?: string | number | boolean;
  validations?: FieldValidationConfig;
}

export interface FormSectionSchema {
  id: string;
  title: string;
  hint?: string;
  fields: FieldSchema[];
}

export interface WorkflowStateConfig {
  id: string;
  label: string;
}

export interface WorkflowTransitionConfig {
  from: string;
  to: string;
  actionLabel: string;
  roles: string[];
}

export interface WorkflowConfig {
  initialState: string;
  states: WorkflowStateConfig[];
  transitions: WorkflowTransitionConfig[];
}

export interface DocumentRulesResolver {
  caseCategoryId: number;
  subjectId: number;
}

export interface CaseTypeConfig {
  code: string;
  name: string;
  applicantFormSchemaId: string;
  workflowId: string;
  documentRulesResolver: DocumentRulesResolver;
  sections: FormSectionSchema[];
  workflow: WorkflowConfig;
}
