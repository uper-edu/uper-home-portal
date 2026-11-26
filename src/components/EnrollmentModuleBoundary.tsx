import { Component, lazy, Suspense, type ComponentType, type ReactNode } from 'react';
import { reportClientFailure } from '../services/clientDiagnostics';

class EnrollmentModuleLoadError extends Error {}

export function lazyEnrollmentModule<Props extends object>(load: () => Promise<ComponentType<Props>>) {
  return lazy(async () => {
    try {
      return { default: await load() };
    } catch (error) {
      reportClientFailure(error, 'preload');
      throw new EnrollmentModuleLoadError('Enrollment section could not be loaded');
    }
  });
}

export class EnrollmentModuleBoundary extends Component<{ children: ReactNode; pending: ReactNode; failure: ReactNode }> {
  state = { failed: false };
  static getDerivedStateFromError(error: unknown) {
    if (!(error instanceof EnrollmentModuleLoadError)) throw error;
    return { failed: true };
  }
  render() {
    return this.state.failed ? this.props.failure : <Suspense fallback={this.props.pending}>{this.props.children}</Suspense>;
  }
}
