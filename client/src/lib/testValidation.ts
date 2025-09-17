/**
 * Test validation utilities to ensure users only access assessments within their selected test
 */
import React from 'react';

export interface TestValidationResult {
  isValid: boolean;
  testId: string | null;
  assessment: any | null;
  error?: string;
}

/**
 * Validates that an assessment exists within the currently selected test
 */
export async function validateAssessmentInCurrentTest(assessmentId: string): Promise<TestValidationResult> {
  try {
    // Get the current test_id from localStorage
    const selectedTestId = localStorage.getItem('selectedTestId');
    
    if (!selectedTestId) {
      return {
        isValid: false,
        testId: null,
        assessment: null,
        error: 'No test selected'
      };
    }

    // Fetch test-specific assessments
    console.log('🔍 testValidation: Fetching test assessments with Firebase auth');
    
    const { AuthenticatedApiService } = await import('./authenticatedApiService');
    const data = await AuthenticatedApiService.getTestAssessments(selectedTestId);
    const testAssessments = data.assessments || [];
    
    // Find the assessment within this test
    const assessment = testAssessments.find((a: any) => a.assessment_id === assessmentId);
    
    if (!assessment) {
      console.error(`❌ Assessment ${assessmentId} not found in test ${selectedTestId}. Available:`, testAssessments.map((a: any) => a.assessment_id));
      return {
        isValid: false,
        testId: selectedTestId,
        assessment: null,
        error: `Assessment ${assessmentId} not found in test ${selectedTestId}`
      };
    }

    console.log(`✅ Assessment ${assessmentId} validated in test ${selectedTestId}`);
    return {
      isValid: true,
      testId: selectedTestId,
      assessment: assessment
    };
    
  } catch (error) {
    console.error('❌ Error validating assessment in test:', error);
    return {
      isValid: false,
      testId: null,
      assessment: null,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Higher-order component to protect pages that require assessment validation
 */
export function withAssessmentValidation<T extends object>(
  WrappedComponent: React.ComponentType<T>,
  assessmentIdParam: string = 'assessmentId'
): React.ComponentType<T & { params?: { [key: string]: string } }> {
  return function ValidatedComponent(props: T & { params?: { [key: string]: string } }) {
    // This would be used like:
    // const ValidatedRules = withAssessmentValidation(Rules);
    // But for now, we'll implement validation directly in components
    return React.createElement(WrappedComponent, props);
  };
}
