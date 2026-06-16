// Re-export shim — StepActions will be extracted from UseCaseBuilderWizard.tsx
// in a future refactoring pass. Until then, this shim allows the new
// UseCaseBuilder/index.tsx to import it without touching the legacy file.
//
// Once the full extraction is done, replace this file with the real implementation
// and delete it from the monolith.
export { StepActions } from './UseCaseBuilder/steps/StepActions'
