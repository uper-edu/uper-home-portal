let applicationModule: Promise<typeof import('../components/EnrollmentApplication')> | undefined;
let intakeModule: Promise<typeof import('../components/EnrollmentIntake')> | undefined;

export function loadEnrollmentApplication() {
  return applicationModule ??= import('../components/EnrollmentApplication').catch(error => {
    applicationModule = undefined;
    throw error;
  });
}

export function loadEnrollmentIntake() {
  return intakeModule ??= import('../components/EnrollmentIntake').catch(error => {
    intakeModule = undefined;
    throw error;
  });
}
