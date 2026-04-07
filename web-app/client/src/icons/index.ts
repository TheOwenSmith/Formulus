/**
 * Centralized SVG path definitions for all icons used in the application
 * This file re-exports all icon paths from modular files for easy importing
 */

// UI icons (arrows, layout, actions)
export * from './ui';

// Status and feedback icons (check, warning, edit, loading)
export * from './status';

// User and account management icons (authentication, media)
export * from './user';

// Social media icons
export * from './social';

// Common SVG attributes
export * from './common';

// Algorithm type icons (onboarding workflow)
export { ExamplesIcon, NormalIcon, SimpleIcon, TopKIcon } from './algorithm-types';

// Status icon components (check, spinner)
export { CheckIcon, Spinner } from './status-components';
