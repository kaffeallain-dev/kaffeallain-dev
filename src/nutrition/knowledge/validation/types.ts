export interface ValidationReport {
  foodId: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  errors: string[];
  warnings: string[];
  completeness: number;
}

export interface ValidationResult {
  isValid: boolean;
  report: ValidationReport;
  food: any;
}
