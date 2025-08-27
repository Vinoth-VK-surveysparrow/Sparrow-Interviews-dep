/**
 * Test validation utilities to ensure users only access assessments within their selected test
 */

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
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
    const response = await fetch(`${API_BASE_URL}/assessments/test/${selectedTestId}`);
    
    if (!response.ok) {
      return {
        isValid: false,
        testId: selectedTestId,
        assessment: null,
        error: `Failed to fetch test assessments: ${response.status} ${response.statusText}`
      };
    }
    
    const data = await response.json();
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
) {
  return function ValidatedComponent(props: T & { params?: { [key: string]: string } }) {
    // This would be used like:
    // const ValidatedRules = withAssessmentValidation(Rules);
    // But for now, we'll implement validation directly in components
    return <WrappedComponent {...props} />;
  };
}
